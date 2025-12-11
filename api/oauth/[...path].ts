import type { VercelRequest, VercelResponse } from "@vercel/node";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";
import * as db from "../../server/db";
import { sdk } from "../../server/_core/sdk";

function getQueryParam(req: VercelRequest, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function getSessionCookieOptions(req: VercelRequest) {
  const isSecure = req.headers["x-forwarded-proto"] === "https";
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax" as const,
    path: "/",
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = req.query.path;
  
  // Handle /api/oauth/callback
  if (Array.isArray(path) && path[0] === "callback") {
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

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.setHeader("Set-Cookie", `${COOKIE_NAME}=${sessionToken}; Path=${cookieOptions.path}; ${cookieOptions.httpOnly ? "HttpOnly;" : ""} ${cookieOptions.secure ? "Secure;" : ""} SameSite=${cookieOptions.sameSite}; Max-Age=${ONE_YEAR_MS / 1000}`);

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
    return;
  }

  res.status(404).json({ error: "Not found" });
}
