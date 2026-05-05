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
  const errorId = "auth-signin-error";

  return (
    <>
      <div className="auth-eyebrow">
        <span className="material-symbols-outlined">login</span>
        Welcome back
      </div>
      <h1 className="auth-h">Sign in to LedgerBuddy</h1>
      <p className="auth-sub">
        Use your work account, or sign in with email &amp; password.
      </p>

      <div className="login-idp-slot" />

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        aria-describedby={error ? errorId : undefined}
      >
        <div className="field">
          <label htmlFor="auth-signin-email">Work email</label>
          <div className="input-with-icon">
            <span className="material-symbols-outlined lead-icon">alternate_email</span>
            <input
              id="auth-signin-email"
              className="input mono"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="you@firm.in"
              aria-invalid={error ? true : undefined}
              required
              autoFocus
            />
          </div>
        </div>

        <div className="field">
          <div className="field-row">
            <label htmlFor="auth-signin-password">Password</label>
          </div>
          <div className="input-with-icon">
            <span className="material-symbols-outlined lead-icon">lock</span>
            <input
              id="auth-signin-password"
              className="input mono"
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
              className="trail-btn"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              <span className="material-symbols-outlined">
                {showPassword ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
        </div>

        <div className="checkrow auth-checkrow-spaced">
          <input
            id="auth-signin-remember"
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
          />
          <label htmlFor="auth-signin-remember">
            Keep me signed in for 30 days on this device
          </label>
        </div>

        <button type="submit" className="btn primary" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>

        {error ? (
          <div className="alert warn auth-error-alert" role="alert" aria-live="polite">
            <span className="material-symbols-outlined">error</span>
            <div id={errorId}>{error}</div>
          </div>
        ) : null}
      </form>

      <div className="foot-link">
        New to LedgerBuddy?{" "}
        <a href="#" onClick={(event) => event.preventDefault()}>
          Talk to sales
        </a>{" "}
        · CAs only
      </div>
    </>
  );
}
