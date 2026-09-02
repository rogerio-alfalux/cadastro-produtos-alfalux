import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { users } from "../../drizzle/schema";
import {
  APP_ROLES,
  type AppRole,
  type PermissionOverrides,
  can,
  isAllowedUserEmail,
  normalizeEmail,
  normalizePermissionOverrides,
} from "../../shared/permissions";
import {
  deleteUsersByEmail,
  getDb,
  getUsersByEmail,
  listManagedUsers,
  updateUsersByEmail,
} from "../db";
import { createPasswordResetToken, hashPassword, hashPasswordResetToken, validatePasswordStrength } from "../passwords";
import { adminProcedure, router } from "../_core/trpc";

const appRoleSchema = z.enum(APP_ROLES);
const permissionOverridesSchema = z.object({
  viewCatalog: z.boolean().optional(),
  manageUsers: z.boolean().optional(),
  viewReports: z.boolean().optional(),
  manageEntities: z.boolean().optional(),
  manageDocuments: z.boolean().optional(),
  viewCosts: z.boolean().optional(),
  editCosts: z.boolean().optional(),
}).strict();

function validateManagedIdentity(email: string) {
  if (!isAllowedUserEmail(email)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Use um e-mail do domínio grupoalfalux.com.br." });
  }
}

function isActiveAdmin(user: { role: AppRole; active: boolean }) {
  return user.active && user.role === "admin";
}

function isUserManager(user: { role: AppRole; active: boolean; permissionOverrides?: unknown }) {
  return user.active && can(user.role, "manageUsers", user.permissionOverrides);
}

async function ensureAccessContinuity(
  email: string,
  nextRole: AppRole,
  nextActive: boolean,
  nextOverrides: PermissionOverrides,
) {
  const managedUsers = await listManagedUsers();
  const current = managedUsers.find((user) => normalizeEmail(user.email ?? "") === email);
  const currentIsAdmin = current ? isActiveAdmin(current) : false;
  const nextIsAdmin = nextActive && nextRole === "admin";
  if (currentIsAdmin && !nextIsAdmin && managedUsers.filter(isActiveAdmin).length <= 1) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Mantenha ao menos um administrador ativo." });
  }

  const currentIsManager = current ? isUserManager(current) : false;
  const nextIsManager = nextActive && can(nextRole, "manageUsers", nextOverrides);
  if (currentIsManager && !nextIsManager && managedUsers.filter(isUserManager).length <= 1) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Mantenha ao menos um usuário ativo com permissão para gerenciar acessos." });
  }
}

export const usersRouter = router({
  list: adminProcedure.query(() => listManagedUsers()),

  issuePasswordResetLink: adminProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const email = normalizeEmail(input.email);
      validateManagedIdentity(email);
      const existing = await getUsersByEmail(email);
      const currentUser = existing.find((user) => user.active) ?? existing[0];
      if (!currentUser?.active) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Usuário ativo não encontrado." });
      }

      const token = createPasswordResetToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await updateUsersByEmail(email, {
        passwordResetTokenHash: hashPasswordResetToken(token),
        passwordResetExpiresAt: expiresAt,
      });
      return { token, expiresAt };
    }),

  create: adminProcedure
    .input(z.object({
      name: z.string().trim().min(2).max(120),
      email: z.string().email(),
      password: z.string(),
      role: appRoleSchema,
      permissionOverrides: permissionOverridesSchema.optional(),
    }))
    .mutation(async ({ input }) => {
      const email = normalizeEmail(input.email);
      validateManagedIdentity(email);
      const passwordError = validatePasswordStrength(input.password);
      if (passwordError) throw new TRPCError({ code: "BAD_REQUEST", message: passwordError });

      const permissionOverrides = normalizePermissionOverrides(input.permissionOverrides);
      const existing = await getUsersByEmail(email);
      const passwordHash = hashPassword(input.password);
      if (existing.length > 0) {
        await updateUsersByEmail(email, {
          name: input.name.trim(),
          role: input.role,
          permissionOverrides,
          passwordHash,
          active: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
        });
      } else {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        await db.insert(users).values({
          openId: `local:${randomUUID()}`,
          name: input.name.trim(),
          email,
          loginMethod: "password",
          role: input.role,
          permissionOverrides,
          passwordHash,
          active: true,
          failedLoginAttempts: 0,
          lastSignedIn: new Date(),
        });
      }
      return { success: true } as const;
    }),

  update: adminProcedure
    .input(z.object({
      email: z.string().email(),
      name: z.string().trim().min(2).max(120),
      role: appRoleSchema,
      active: z.boolean(),
      password: z.string().optional(),
      permissionOverrides: permissionOverridesSchema.optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const email = normalizeEmail(input.email);
      validateManagedIdentity(email);
      const existing = await getUsersByEmail(email);
      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });

      const currentUser = existing.find((user) => user.active && !!user.passwordHash) ?? existing[0];
      const nextOverrides = normalizePermissionOverrides(input.permissionOverrides ?? currentUser.permissionOverrides);
      const changingSelf = normalizeEmail(ctx.user.email ?? "") === email;
      if (changingSelf && (!input.active || !can(input.role, "manageUsers", nextOverrides))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode remover seu próprio acesso administrativo." });
      }
      await ensureAccessContinuity(email, input.role, input.active, nextOverrides);

      const update: Partial<typeof users.$inferInsert> = {
        name: input.name.trim(),
        role: input.role,
        permissionOverrides: nextOverrides,
        active: input.active,
        failedLoginAttempts: 0,
        lockedUntil: null,
      };
      if (input.password) {
        const passwordError = validatePasswordStrength(input.password);
        if (passwordError) throw new TRPCError({ code: "BAD_REQUEST", message: passwordError });
        update.passwordHash = hashPassword(input.password);
      }
      await updateUsersByEmail(email, update);
      return { success: true } as const;
    }),

  remove: adminProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input, ctx }) => {
      const email = normalizeEmail(input.email);
      if (normalizeEmail(ctx.user.email ?? "") === email) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode excluir o próprio usuário." });
      }

      const managedUsers = await listManagedUsers();
      const target = managedUsers.find((user) => normalizeEmail(user.email ?? "") === email);
      if (target && isActiveAdmin(target) && managedUsers.filter(isActiveAdmin).length <= 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Mantenha ao menos um administrador ativo." });
      }
      if (target && isUserManager(target) && managedUsers.filter(isUserManager).length <= 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Mantenha ao menos um usuário ativo com permissão para gerenciar acessos." });
      }

      await deleteUsersByEmail(email);
      return { success: true } as const;
    }),
});
