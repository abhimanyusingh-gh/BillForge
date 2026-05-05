import { useCallback, useState } from "react";
import { ApiError, apiClient } from "@/api/client";
import { authUrls } from "@/api/authUrls";
import { useSessionStore, type AuthTenant, type AuthUser, type SessionFlags } from "@/state/sessionStore";
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

interface UseLoginResult {
  email: string;
  password: string;
  submitting: boolean;
  error: string | null;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  submit: () => Promise<void>;
}

export function useLogin(): UseLoginResult {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setAccessToken = useSessionStore((state) => state.setAccessToken);
  const setSession = useSessionStore((state) => state.setSession);
  const clearSession = useSessionStore((state) => state.clearSession);

  const submit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const tokenResponse = await apiClient.post<LoginTokenResponse>(
        authUrls.login(),
        { email, password },
        { skipAuth: true }
      );
      const token = typeof tokenResponse?.token === "string" ? tokenResponse.token.trim() : "";
      if (token === "") {
        throw new Error("Login did not return a session token.");
      }
      setAccessToken(token);

      const sessionResponse = await apiClient.get<SessionContextResponse>(authUrls.session());
      setSession({
        user: toAuthUser(sessionResponse.user),
        tenant: toAuthTenant(sessionResponse.tenant),
        flags: toSessionFlags(sessionResponse.flags)
      });

      if (typeof window !== "undefined") {
        const next = sessionResponse.flags?.must_change_password === true ? "#/change-password" : "#/";
        window.location.hash = next;
      }
    } catch (caught) {
      clearSession();
      const message =
        caught instanceof ApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "Sign-in failed. Please try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [email, password, submitting, setAccessToken, setSession, clearSession]);

  return {
    email,
    password,
    submitting,
    error,
    setEmail,
    setPassword,
    submit
  };
}
