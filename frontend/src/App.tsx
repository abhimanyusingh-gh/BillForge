import { useEffect, useState } from "react";
import { ChangePasswordPanel } from "@/features/auth/ChangePasswordPanel";
import { LoginPage } from "@/features/auth/LoginPage";
import { selectIsAuthenticated, useSessionStore } from "@/state/sessionStore";

function readRoute(): string {
  if (typeof window === "undefined") return "/";
  const hash = window.location.hash;
  if (hash.length <= 1) return "/";
  return hash.slice(1);
}

function useHashRoute(): string {
  const [route, setRoute] = useState<string>(() => readRoute());
  useEffect(() => {
    const onChange = () => setRoute(readRoute());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function App() {
  const route = useHashRoute();
  const isAuthenticated = useSessionStore(selectIsAuthenticated);
  const mustChangePassword = useSessionStore((state) => state.flags.mustChangePassword);
  const theme = useSessionStore((state) => state.theme);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = theme;
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthenticated && route !== "/login") {
      window.location.hash = "#/login";
      return;
    }
    if (isAuthenticated && route === "/login") {
      window.location.hash = mustChangePassword ? "#/change-password" : "#/";
      return;
    }
    if (isAuthenticated && mustChangePassword && route !== "/change-password") {
      window.location.hash = "#/change-password";
    }
  }, [isAuthenticated, mustChangePassword, route]);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (mustChangePassword || route === "/change-password") {
    return <ChangePasswordPanel />;
  }

  return (
    <main className="app-placeholder">
      <h1>LedgerBuddy</h1>
      <p>Signed in. Pages will land here as they&apos;re built.</p>
    </main>
  );
}
