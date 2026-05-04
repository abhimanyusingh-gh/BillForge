import { useState } from "react";

interface LoginFormPanelProps {
  email: string;
  password: string;
  submitting: boolean;
  error: string | null;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
}

const PLATFORM_DOMAIN_PATTERN = /@ledgerbuddy\.in$/i;

type LoginRole = "tenant" | "platform";

function roleForEmail(email: string): LoginRole {
  return PLATFORM_DOMAIN_PATTERN.test(email.trim()) ? "platform" : "tenant";
}

export function LoginFormPanel({
  email,
  password,
  submitting,
  error,
  onEmailChange,
  onPasswordChange,
  onSubmit
}: LoginFormPanelProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const role = roleForEmail(email);
  const errorId = "auth-signin-error";

  return (
    <>
      <div className="auth-eyebrow">
        <span className="material-symbols-outlined">login</span>
        Welcome back
      </div>
      <h1 className="auth-h">Sign in to LedgerBuddy</h1>
      <p className="auth-sub">Use your work account, or sign in with email &amp; password.</p>

      {/* login-idp-slot: post-MVP SSO buttons (Google Workspace, Microsoft 365) populate this slot via #385. */}
      <div className="login-idp-slot" />

      <form
        className="auth-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        aria-describedby={error ? errorId : undefined}
      >
        <div className="auth-field">
          <label htmlFor="auth-signin-email">Work email</label>
          <div className="auth-input-with-icon">
            <span className="material-symbols-outlined auth-lead-icon">alternate_email</span>
            <input
              id="auth-signin-email"
              className="auth-input auth-input-mono auth-input-with-pill"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="you@firm.in"
              aria-invalid={error ? true : undefined}
              required
            />
            <span
              className={`auth-role-pill auth-role-pill-${role}`}
              title={role === "platform" ? "Platform admin scope" : "Tenant scope"}
            >
              <span className="material-symbols-outlined">
                {role === "platform" ? "admin_panel_settings" : "business_center"}
              </span>
              {role === "platform" ? "Platform" : "Tenant"}
            </span>
          </div>
        </div>

        <div className="auth-field">
          <div className="auth-field-row">
            <label htmlFor="auth-signin-password">Password</label>
            <button type="button" className="auth-link-button">Forgot?</button>
          </div>
          <div className="auth-input-with-icon">
            <span className="material-symbols-outlined auth-lead-icon">lock</span>
            <input
              id="auth-signin-password"
              className="auth-input auth-input-mono"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder="Enter password"
              aria-invalid={error ? true : undefined}
              required
            />
            <button
              type="button"
              className="auth-trail-btn"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              <span className="material-symbols-outlined">
                {showPassword ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
        </div>

        <div className="auth-checkrow">
          <input
            id="auth-signin-remember"
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
          />
          <label htmlFor="auth-signin-remember">Keep me signed in for 30 days on this device</label>
        </div>

        <button type="submit" className="auth-btn auth-btn-primary" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>

        <div className="auth-error-region" role="alert" aria-live="polite">
          {error ? (
            <p id={errorId} className="auth-error-text">
              <span className="material-symbols-outlined">error</span>
              {error}
            </p>
          ) : null}
        </div>
      </form>

      <div className="auth-foot-link">
        New to LedgerBuddy? <a href="#" onClick={(event) => event.preventDefault()}>Talk to sales</a> · CAs only
      </div>
    </>
  );
}
