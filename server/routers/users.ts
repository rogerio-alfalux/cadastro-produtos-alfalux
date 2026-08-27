import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { users } from "../../drizzle/schema";
import {
  GEYSA_ADMIN_EMAIL,
  OWNER_ADMIN_EMAIL,
  isAllowedUserEmail,
  isProtectedAdminEmail,
  normalizeEmail,
} from "../../shared/permissions";
import {
  deleteUsersByEmail,
  getDb,
  getUsersByEmail,
  listManagedUsers,
  updateUsersByEmail,
} from "../db";
import { hashPassword, validatePasswordStrength } from "../passwords";
import { adminProcedure, router } from "../_core/trpc";

const manageableRole = z.enum(["engineering", "costs"]);

function validateManagedIdentity(email: string, role: "engineering" | "costs" | "admin") {
  if (!isAllowedUserEmail(email)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Use um e-mail do domínio grupoalfalux.com.br." });
  }
  if (role === "admin" && !isProtectedAdminEmail(email)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Somente o proprietário e Geysa podem ser administradores." });
  }
}

export const usersRouter = router({
  list: adminProcedure.query(() => listManagedUsers()),

  create: adminProcedure
    .input(z.object({
      name: z.string().trim().min(2).max(120),
      email: z.string().email(),
      password: z.string(),
      role: manageableRole,
    }))
    .mutation(async ({ input }) => {
      const email = normalizeEmail(input.email);
      validateManagedIdentity(email, input.role);
      const passwordError = validatePasswordStrength(input.password);
      if (passwordError) throw new TRPCError({ code: "BAD_REQUEST", message: passwordError });

      const existing = await getUsersByEmail(email);
      const passwordHash = hashPassword(input.password);
      if (existing.length > 0) {
        await updateUsersByEmail(email, {
          name: input.name.trim(),
          role: input.role,
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
      role: z.enum(["admin", "engineering", "costs"]),
      active: z.boolean(),
      password: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const email = normalizeEmail(input.email);
      validateManagedIdentity(email, input.role);
      const protectedAdmin = isProtectedAdminEmail(email);
      if (protectedAdmin && (!input.active || input.role !== "admin")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Os administradores protegidos não podem ser desativados ou rebaixados." });
      }
      const existing = await getUsersByEmail(email);
      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });

      const update: Partial<typeof users.$inferInsert> = {
        name: input.name.trim(),
        role: input.role,
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
      if (isProtectedAdminEmail(email)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "O proprietário e Geysa não podem ser excluídos." });
      }
      if (normalizeEmail(ctx.user.email ?? "") === email) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode excluir o próprio usuário." });
      }
      await deleteUsersByEmail(email);
      return { success: true } as const;
    }),
});

export const INITIAL_ADMIN_EMAILS = [OWNER_ADMIN_EMAIL, GEYSA_ADMIN_EMAIL] as const;
