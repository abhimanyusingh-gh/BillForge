import { LoginBrandPanel } from "@/features/auth/LoginBrandPanel";

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
  icon: string;
  autoComplete: string;
}

const FIELDS: ReadonlyArray<FieldDef> = [
  {
    key: "currentPassword",
    label: "Current password",
    placeholder: "Current password",
    icon: "lock",
    autoComplete: "current-password"
  },
  {
    key: "newPassword",
    label: "New password",
    placeholder: "New password",
    icon: "key",
    autoComplete: "new-password"
  },
  {
    key: "confirmPassword",
    label: "Confirm new password",
    placeholder: "Confirm new password",
    icon: "key",
    autoComplete: "new-password"
  }
];

export function ChangePasswordPanel({
  form,
  mustChange,
  error,
  onFieldChange,
  onSubmit,
  onCancel
}: ChangePasswordPanelProps) {
  const errorId = "auth-change-password-error";
  return (
    <div className="auth-shell">
      <LoginBrandPanel />
      <div className="auth-right">
        <div className="auth-top-row">
          <div className="brand-row">
            <span className="mark">₹</span>
            <span className="name">LedgerBuddy</span>
          </div>
          <span />
        </div>
        <div className="auth-card-wrap">
          <div className="auth-card">
            <div className="auth-eyebrow">
              <span className="material-symbols-outlined">key</span>
              Account security
            </div>
            <h1 className="auth-h">Change your password</h1>
            <p className="auth-sub">
              {mustChange
                ? "You must change your temporary password before continuing."
                : "Enter your current password and choose a new one."}
            </p>
            <form
              className="auth-form"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                onSubmit();
              }}
              aria-describedby={error ? errorId : undefined}
            >
              {FIELDS.map((field) => (
                <div key={field.key} className="auth-field">
                  <label htmlFor={`auth-cp-${field.key}`}>{field.label}</label>
                  <div className="auth-input-with-icon">
                    <span className="material-symbols-outlined auth-lead-icon">{field.icon}</span>
                    <input
                      id={`auth-cp-${field.key}`}
                      className="auth-input auth-input-mono"
                      type="password"
                      autoComplete={field.autoComplete}
                      value={form[field.key]}
                      onChange={(event) => onFieldChange(field.key, event.target.value)}
                      placeholder={field.placeholder}
                      aria-invalid={error ? true : undefined}
                      required
                    />
                  </div>
                </div>
              ))}
              <button type="submit" className="auth-btn auth-btn-primary">
                Change password
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
          </div>
        </div>
        <div className="auth-bottom">
          <div className="auth-legal">© 2026 LedgerBuddy Technologies Pvt Ltd</div>
          <div className="auth-trust">
            <span className="auth-trust-ok">SOC 2 TYPE II</span>
            <span className="auth-trust-dot" />
            <span>ISO 27001</span>
            <span className="auth-trust-dot" />
            <span>India data residency</span>
          </div>
        </div>
      </div>
    </div>
  );
}
