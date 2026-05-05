import { apiClient } from "@/api/client";
import { authUrls } from "@/api/authUrls";
import type { AuthTenant, AuthUser, SessionFlags } from "@/state/sessionStore";
import { asTenantId, asUserId } from "@/types/ids";

interface LoginTokenResponse {
  token?: string;
}

interface SessionContextResponse {
  user: {
    id: string;
    email: string;
    role: string;
  };
  tenant: {
    id: string;
    name: string;
    mode?: "test" | "live";
  };
  flags?: {
    must_change_password?: boolean;
    requires_tenant_setup?: boolean;
  };
}

interface LoginInput {
  email: string;
  password: string;
}

interface SessionContext {
  user: AuthUser;
  tenant: AuthTenant;
  flags: SessionFlags;
}

interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

function toAuthUser(raw: SessionContextResponse["user"]): AuthUser {
  return {
    id: asUserId(raw.id),
    email: raw.email,
    role: raw.role
  };
}

function toAuthTenant(raw: SessionContextResponse["tenant"]): AuthTenant {
  return {
    id: asTenantId(raw.id),
    name: raw.name,
    mode: raw.mode
  };
}

function toSessionFlags(raw: SessionContextResponse["flags"]): SessionFlags {
  return {
    mustChangePassword: raw?.must_change_password === true,
    requiresTenantSetup: raw?.requires_tenant_setup === true
  };
}

async function login(input: LoginInput): Promise<string> {
  const response = await apiClient.post<LoginTokenResponse>(
    authUrls.login(),
    { email: input.email, password: input.password },
    { skipAuth: true }
  );
  const token = typeof response?.token === "string" ? response.token.trim() : "";
  if (token === "") {
    throw new Error("Login did not return a session token.");
  }
  return token;
}

async function fetchSession(): Promise<SessionContext> {
  const response = await apiClient.get<SessionContextResponse>(authUrls.session());
  return {
    user: toAuthUser(response.user),
    tenant: toAuthTenant(response.tenant),
    flags: toSessionFlags(response.flags)
  };
}

async function changePassword(input: ChangePasswordInput): Promise<void> {
  await apiClient.post(authUrls.changePassword(), {
    currentPassword: input.currentPassword,
    newPassword: input.newPassword
  });
}

export const authService = {
  login,
  fetchSession,
  changePassword
};
