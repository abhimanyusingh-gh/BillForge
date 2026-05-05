import { useCallback, useState } from "react";
import { ApiError } from "@/api/client";
import { authService } from "@/api/authService";
import { useSessionStore } from "@/state/sessionStore";

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
      const token = await authService.login({ email, password });
      setAccessToken(token);

      const session = await authService.fetchSession();
      setSession(session);

      if (typeof window !== "undefined") {
        window.location.hash = session.flags.mustChangePassword ? "#/change-password" : "#/";
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
