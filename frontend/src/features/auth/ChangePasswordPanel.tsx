import { useState } from "react";
import { ApiError, apiClient } from "@/api/client";
import { authUrls } from "@/api/authUrls";
import { AuthShell } from "@/features/auth/AuthShell";
import { useSessionStore } from "@/state/sessionStore";

interface ChangePasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface FieldDef {
  key: keyof ChangePasswordForm;
  label: string;
  placeholder: string;
  autoComplete: string;
}

const FIELDS: ReadonlyArray<FieldDef> = [
  {
    key: "currentPassword",
    label: "Current password",
    placeholder: "Current password",
    autoComplete: "current-password"
  },
  {
    key: "newPassword",
    label: "New password",
    placeholder: "At least 10 characters",
    autoComplete: "new-password"
  },
  {
    key: "confirmPassword",
    label: "Confirm new password",
    placeholder: "Confirm new password",
    autoComplete: "new-password"
  }
];

const STRENGTH_LABELS = ["Too short", "Weak", "Fair", "Good", "Strong", "Excellent"] as const;
const STRENGTH_BAR_INDEXES = [0, 1, 2, 3, 4] as const;

function passwordStrength(value: string): number {
  let score = 0;
  if (value.length >= 10) score += 1;
  if (/[A-Z]/.test(value)) score += 1;
  if (/[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return score;
}

function strengthToneClass(score: number): string {
  if (score <= 1) return "auth-strength-weak";
  if (score <= 3) return "auth-strength-fair";
  return "auth-strength-strong";
}

export function ChangePasswordPanel() {
  const flags = useSessionStore((state) => state.flags);
  const setSession = useSessionStore((state) => state.setSession);
  const user = useSessionStore((state) => state.user);
  const tenant = useSessionStore((state) => state.tenant);

  const mustChange = flags.mustChangePassword;

  const [form, setForm] = useState<ChangePasswordForm>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errorId = "auth-change-password-error";
  const strength = passwordStrength(form.newPassword);
  const strengthLabel = STRENGTH_LABELS[Math.min(strength, STRENGTH_LABELS.length - 1)];
  const strengthClass = strengthToneClass(strength);
  const matches = form.newPassword.length > 0 && form.newPassword === form.confirmPassword;
  const showMismatch = form.confirmPassword.length > 0 && !matches;
  const canSubmit =
    matches && strength >= 3 && form.currentPassword.length > 0 && !submitting;

  const onFieldChange = (field: keyof ChangePasswordForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post(authUrls.changePassword(), {
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
  };

  const onCancel = () => {
    if (typeof window !== "undefined") {
      window.location.hash = "#/";
    }
  };

  return (
    <AuthShell hideTopHelp={mustChange}>
      <div className="auth-eyebrow">
        <span className="material-symbols-outlined">lock_reset</span>
        Account security
      </div>
      <h1 className="auth-h">
        {mustChange ? "Set a new password" : "Change your password"}
      </h1>
      <p className="auth-sub">
        {mustChange
          ? "You must change your temporary password before continuing. Other devices will be signed out."
          : "Enter your current password and choose a new one. Other devices will be signed out."}
      </p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
        aria-describedby={error ? errorId : undefined}
      >
        {FIELDS.map((field) => {
          const isNew = field.key === "newPassword";
          const isConfirm = field.key === "confirmPassword";
          const inputClass = "input mono" + (isConfirm && showMismatch ? " error" : "");
          return (
            <div key={field.key} className="field">
              <label htmlFor={`auth-cp-${field.key}`}>{field.label}</label>
              <div className="input-with-icon">
                <span className="material-symbols-outlined lead-icon">lock</span>
                <input
                  id={`auth-cp-${field.key}`}
                  className={inputClass}
                  type="password"
                  autoComplete={field.autoComplete}
                  value={form[field.key]}
                  onChange={(event) => onFieldChange(field.key, event.target.value)}
                  placeholder={field.placeholder}
                  aria-invalid={isConfirm && showMismatch ? true : error ? true : undefined}
                  required
                />
              </div>
              {isNew && form.newPassword.length > 0 ? (
                <div className={`auth-strength ${strengthClass}`}>
                  <div className="auth-strength-bars">
                    {STRENGTH_BAR_INDEXES.map((index) => (
                      <span
                        key={index}
                        className={
                          index < strength ? "auth-strength-bar on" : "auth-strength-bar"
                        }
                      />
                    ))}
                  </div>
                  <span className="auth-strength-label">{strengthLabel}</span>
                </div>
              ) : null}
              {isConfirm && showMismatch ? (
                <span className="field-error">
                  <span className="material-symbols-outlined">error</span>
                  Passwords don't match
                </span>
              ) : null}
            </div>
          );
        })}

        <div className="auth-requirements">
          <b>Requirements</b>
          Min 10 chars · upper, lower, digit, symbol · cannot reuse last 5
        </div>

        <button type="submit" className="btn primary" disabled={!canSubmit}>
          {mustChange ? "Update password & sign in" : "Change password"}
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>

        {!mustChange ? (
          <button
            type="button"
            className="btn ghost auth-cancel-btn"
            onClick={onCancel}
          >
            Cancel
          </button>
        ) : null}

        {error ? (
          <div className="alert warn auth-error-alert" role="alert" aria-live="polite">
            <span className="material-symbols-outlined">error</span>
            <div id={errorId}>{error}</div>
          </div>
        ) : null}
      </form>
    </AuthShell>
  );
}
