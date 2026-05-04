import { LoginBrandPanel } from "@/features/auth/LoginBrandPanel";
import { LoginFormPanel } from "@/features/auth/LoginFormPanel";

interface LoginPageProps {
  email: string;
  password: string;
  submitting: boolean;
  error: string | null;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
}

export function LoginPage({
  email,
  password,
  submitting,
  error,
  onEmailChange,
  onPasswordChange,
  onSubmit
}: LoginPageProps) {
  return (
    <div className="auth-shell">
      <LoginBrandPanel />
      <div className="auth-right">
        <div className="auth-top-row">
          <div className="brand-row">
            <span className="mark">₹</span>
            <span className="name">LedgerBuddy</span>
          </div>
          <a href="#" className="auth-help" onClick={(event) => event.preventDefault()}>
            <span className="material-symbols-outlined">help</span>
            Help &amp; status
          </a>
        </div>
        <div className="auth-card-wrap">
          <div className="auth-card">
            <LoginFormPanel
              email={email}
              password={password}
              submitting={submitting}
              error={error}
              onEmailChange={onEmailChange}
              onPasswordChange={onPasswordChange}
              onSubmit={onSubmit}
            />
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
