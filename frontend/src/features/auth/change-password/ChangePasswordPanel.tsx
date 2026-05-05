import { AuthShell } from "@/features/auth/shell/AuthShell";
import { useChangePassword } from "@/features/auth/change-password/useChangePassword";
import type { ChangePasswordInput } from "@/domain/auth/passwordPolicy";
import { useSessionStore } from "@/state/sessionStore";

interface FieldDef {
  key: keyof ChangePasswordInput;
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

const STRENGTH_BAR_INDEXES = [0, 1, 2, 3, 4] as const;

const TONE_CLASS = {
  weak: "auth-strength-weak",
  fair: "auth-strength-fair",
  strong: "auth-strength-strong"
} as const;

export function ChangePasswordPanel() {
  const mustChange = useSessionStore((state) => state.flags.mustChangePassword);
  const { form, validation, submitting, error, canSubmit, setField, submit } =
    useChangePassword();

  const errorId = "auth-change-password-error";
  const strengthClass = TONE_CLASS[validation.tone];

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
          void submit();
        }}
        aria-describedby={error ? errorId : undefined}
      >
        {FIELDS.map((field) => {
          const isNew = field.key === "newPassword";
          const isConfirm = field.key === "confirmPassword";
          const inputClass = "input mono" + (isConfirm && validation.showMismatch ? " error" : "");
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
                  onChange={(event) => setField(field.key, event.target.value)}
                  placeholder={field.placeholder}
                  aria-invalid={
                    isConfirm && validation.showMismatch ? true : error ? true : undefined
                  }
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
                          index < validation.strength
                            ? "auth-strength-bar on"
                            : "auth-strength-bar"
                        }
                      />
                    ))}
                  </div>
                  <span className="auth-strength-label">{validation.label}</span>
                </div>
              ) : null}
              {isConfirm && validation.showMismatch ? (
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
            disabled={submitting}
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
