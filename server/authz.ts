import type { NextFunction, Request, Response } from "express";
import { can, type AppPermission } from "../shared/permissions";
import { sdk } from "./_core/sdk";

export function requireRestPermission(permission: AppPermission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!can(user.role, permission, user.permissionOverrides)) {
        res.status(403).json({ error: "Permissão insuficiente." });
        return;
      }
      res.locals.user = user;
      next();
    } catch {
      res.status(401).json({ error: "Autenticação necessária." });
    }
  };
}
