import { AuthShell } from "@/features/auth/LoginPage";

interface ChangePasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface ChangePasswordPanelProps {
  form: ChangePasswordForm;
  mustChange: boolean;
  error: string | null;
  onFieldChange: (field: keyof ChangePasswordForm, value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
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

export function ChangePasswordPanel({
  form,
  mustChange,
  error,
  onFieldChange,
  onSubmit,
  onCancel
}: ChangePasswordPanelProps) {
  const errorId = "auth-change-password-error";
  const strength = passwordStrength(form.newPassword);
  const strengthLabel = STRENGTH_LABELS[Math.min(strength, STRENGTH_LABELS.length - 1)];
  const strengthClass = strengthToneClass(strength);
  const matches = form.newPassword.length > 0 && form.newPassword === form.confirmPassword;
  const showMismatch = form.confirmPassword.length > 0 && !matches;

  return (
    <AuthShell hideTopHelp={mustChange}>
      <div className="auth-eyebrow">
        <span className="material-symbols-outlined">lock_reset</span>
        Account security
      </div>
      <h1 className="auth-h">{mustChange ? "Set a new password" : "Change your password"}</h1>
      <p className="auth-sub">
        {mustChange
          ? "You must change your temporary password before continuing. Other devices will be signed out."
          : "Enter your current password and choose a new one. Other devices will be signed out."}
      </p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        aria-describedby={error ? errorId : undefined}
      >
        {FIELDS.map((field) => {
          const isNew = field.key === "newPassword";
          const isConfirm = field.key === "confirmPassword";
          const inputClass =
            "input mono" + (isConfirm && showMismatch ? " error" : "");
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
                        className={index < strength ? "auth-strength-bar on" : "auth-strength-bar"}
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

        <button
          type="submit"
          className="btn primary"
          disabled={!matches || strength < 3 || form.currentPassword.length === 0}
        >
          {mustChange ? "Update password & sign in" : "Change password"}
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>
        {!mustChange ? (
          <button type="button" className="auth-link-button auth-link-button-block" onClick={onCancel}>
            Cancel
          </button>
        ) : null}

        <div className="auth-error-region" role="alert" aria-live="polite">
          {error ? (
            <p id={errorId} className="auth-error-text">
              <span className="material-symbols-outlined">error</span>
              {error}
            </p>
          ) : null}
        </div>
      </form>
    </AuthShell>
  );
}
