import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { isAllowedUserEmail, isProtectedAdminEmail, normalizeEmail } from "../../shared/permissions";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      const email = userInfo.email ? normalizeEmail(userInfo.email) : "";
      if (!email || !isAllowedUserEmail(email)) {
        res.status(403).json({ error: "E-mail não autorizado para este sistema." });
        return;
      }

      const existingByOpenId = await db.getUserByOpenId(userInfo.openId);
      const existingByEmail = await db.getUsersByEmail(email);
      if (!existingByOpenId && existingByEmail.length === 0 && !isProtectedAdminEmail(email)) {
        res.status(403).json({ error: "Usuário ainda não cadastrado por um administrador." });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        role: isProtectedAdminEmail(email) ? "admin" : existingByEmail[0]?.role,
        active: isProtectedAdminEmail(email) ? true : existingByEmail[0]?.active,
        lastSignedIn: new Date(),
      });

      const persistedUser = await db.getUserByOpenId(userInfo.openId);
      if (!persistedUser?.active) {
        res.status(403).json({ error: "Usuário inativo." });
        return;
      }

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
