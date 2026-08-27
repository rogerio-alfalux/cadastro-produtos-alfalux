import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { can, type AppPermission } from "../../shared/permissions";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

function requirePermission(permission: AppPermission) {
  return t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    if (!can(ctx.user.role, permission, ctx.user.permissionOverrides)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  });
}

export const entityAdminProcedure = t.procedure.use(requirePermission("manageEntities"));
export const documentProcedure = t.procedure.use(requirePermission("manageDocuments"));
export const costProcedure = t.procedure.use(requirePermission("editCosts"));
export const reportProcedure = t.procedure.use(requirePermission("viewReports"));

export const adminProcedure = t.procedure.use(
  requirePermission("manageUsers"),
);
