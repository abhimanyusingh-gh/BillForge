import { Router } from "express";
import type { AuthService } from "../auth/AuthService.js";
import { env } from "../config/env.js";

export function createAuthRouter(authService: AuthService) {
  const router = Router();

  router.get("/auth/login", async (request, response, next) => {
    try {
      const nextPath = typeof request.query.next === "string" ? request.query.next : "/";
      const loginHint = typeof request.query.login_hint === "string" ? request.query.login_hint : "";
      const redirectUrl = await authService.getAuthorizationUrl({
        nextPath,
        loginHint
      });
      response.redirect(302, redirectUrl);
    } catch (error) {
      next(error);
    }
  });

  router.get("/auth/callback", async (request, response, next) => {
    try {
      const code = typeof request.query.code === "string" ? request.query.code.trim() : "";
      const state = typeof request.query.state === "string" ? request.query.state.trim() : "";
      if (!code || !state) {
        response.status(400).json({ message: "Missing OAuth callback code/state." });
        return;
      }

      const result = await authService.handleAuthorizationCallback(code, state);
      const redirect = new URL("/auth/callback", env.FRONTEND_BASE_URL);
      redirect.searchParams.set("token", result.sessionToken);
      redirect.searchParams.set("next", result.redirectPath);
      response.redirect(302, redirect.toString());
    } catch (error) {
      next(error);
    }
  });

  return router;
}
