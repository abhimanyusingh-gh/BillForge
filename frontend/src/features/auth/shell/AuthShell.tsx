import type { ReactNode } from "react";
import { LoginBrandPanel } from "@/features/auth/shell/LoginBrandPanel";

interface AuthShellProps {
  hideTopHelp?: boolean;
  children: ReactNode;
}

export function AuthShell({ hideTopHelp, children }: AuthShellProps) {
  return (
    <div className="auth-shell">
      <LoginBrandPanel />
      <div className="auth-right">
        <div className="top-row">
          <div className="brand-row">
            <span className="mark">₹</span>
            <span className="name">LedgerBuddy</span>
          </div>
          {hideTopHelp ? (
            <span />
          ) : (
            <a
              href="#"
              className="help"
              onClick={(event) => event.preventDefault()}
            >
              <span className="material-symbols-outlined">help</span>
              Help &amp; status
            </a>
          )}
        </div>
        <div className="auth-card-wrap">
          <div className="auth-card">{children}</div>
        </div>
        <div className="auth-bottom">
          <div className="legal">© 2026 LedgerBuddy Technologies Pvt Ltd</div>
          <div className="trust">
            <span className="ok">SOC 2 TYPE II</span>
            <span className="dot" />
            <span>ISO 27001</span>
            <span className="dot" />
            <span>India data residency</span>
          </div>
        </div>
      </div>
    </div>
  );
}
