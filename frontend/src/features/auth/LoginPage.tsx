import { AuthShell } from "@/features/auth/AuthShell";
import { LoginFormPanel } from "@/features/auth/LoginFormPanel";
import { useLogin } from "@/features/auth/useLogin";

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
