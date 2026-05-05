import { AuthShell } from "@/features/auth/shell/AuthShell";
import { LoginFormPanel } from "@/features/auth/login/LoginFormPanel";
import { useLogin } from "@/features/auth/login/useLogin";

export function LoginPage() {
  const login = useLogin();

  return (
    <AuthShell>
      <LoginFormPanel
        email={login.email}
        password={login.password}
        submitting={login.submitting}
        error={login.error}
        onEmailChange={login.setEmail}
        onPasswordChange={login.setPassword}
        onSubmit={() => {
          void login.submit();
        }}
      />
    </AuthShell>
  );
}
