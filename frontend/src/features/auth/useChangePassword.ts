import { useCallback, useMemo, useState } from "react";
import { ApiError } from "@/api/client";
import { authService } from "@/api/authService";
import {
  evaluateChangePassword,
  type ChangePasswordInput,
  type ChangePasswordValidation
} from "@/domain/auth/passwordPolicy";
import { useSessionStore } from "@/state/sessionStore";

interface UseChangePasswordResult {
  form: ChangePasswordInput;
  validation: ChangePasswordValidation;
  submitting: boolean;
  error: string | null;
  canSubmit: boolean;
  setField: (field: keyof ChangePasswordInput, value: string) => void;
  submit: () => Promise<void>;
}

const EMPTY_FORM: ChangePasswordInput = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: ""
};

export function useChangePassword(): UseChangePasswordResult {
  const [form, setForm] = useState<ChangePasswordInput>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flags = useSessionStore((state) => state.flags);
  const setSession = useSessionStore((state) => state.setSession);
  const user = useSessionStore((state) => state.user);
  const tenant = useSessionStore((state) => state.tenant);

  const validation = useMemo(() => evaluateChangePassword(form), [form]);
  const canSubmit = validation.isAcceptable && !submitting;

  const setField = useCallback((field: keyof ChangePasswordInput, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await authService.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword
      });
      if (user !== null && tenant !== null) {
        setSession({
          user,
          tenant,
          flags: { ...flags, mustChangePassword: false }
        });
      }
      if (typeof window !== "undefined") {
        window.location.hash = "#/";
      }
    } catch (caught) {
      const message =
        caught instanceof ApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "Could not change password. Please try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, form.currentPassword, form.newPassword, user, tenant, flags, setSession]);

  return {
    form,
    validation,
    submitting,
    error,
    canSubmit,
    setField,
    submit
  };
}
