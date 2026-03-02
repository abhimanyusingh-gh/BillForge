import type { NextFunction, Request, Response } from "express";
import type { AuthService } from "./AuthService.js";

function resolveBearerToken(request: Request): string {
  const authorization = request.header("authorization");
  if (typeof authorization !== "string") {
    return "";
  }
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    const queryToken = typeof request.query.authToken === "string" ? request.query.authToken.trim() : "";
    return queryToken;
  }
  return token.trim();
}

export function createAuthenticationMiddleware(authService: AuthService) {
  return async function authenticate(request: Request, response: Response, next: NextFunction) {
    try {
      const token = resolveBearerToken(request);
      if (!token) {
        response.status(401).json({ message: "Missing bearer token." });
        return;
      }

      request.authContext = await authService.resolveRequestContext(token);
      next();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed.";
      response.status(401).json({ message });
    }
  };
}

export function requireTenantSetupCompleted(request: Request, response: Response, next: NextFunction): void {
  const context = request.authContext;
  if (!context) {
    response.status(401).json({ message: "Authentication required." });
    return;
  }

  if (context.onboardingStatus !== "completed") {
    response.status(403).json({ message: "Tenant onboarding is incomplete.", requires_tenant_setup: true });
    return;
  }

  next();
}

export function requireTenantAdmin(request: Request, response: Response, next: NextFunction): void {
  const context = request.authContext;
  if (!context) {
    response.status(401).json({ message: "Authentication required." });
    return;
  }

  if (context.role !== "TENANT_ADMIN") {
    response.status(403).json({ message: "Tenant admin role required." });
    return;
  }

  next();
}

export function requirePlatformAdmin(request: Request, response: Response, next: NextFunction): void {
  const context = request.authContext;
  if (!context) {
    response.status(401).json({ message: "Authentication required." });
    return;
  }

  if (!context.isPlatformAdmin) {
    response.status(403).json({ message: "Platform admin access required." });
    return;
  }

  next();
}
