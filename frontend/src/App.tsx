import { useEffect, useState, type ReactNode } from "react";
import { ChangePasswordPanel } from "@/features/auth/change-password/ChangePasswordPanel";
import { LoginPage } from "@/features/auth/login/LoginPage";
import { AppShell } from "@/features/workspace/shell/AppShell";
import { PlaceholderPage } from "@/features/placeholder/PlaceholderPage";
import { StatementListPage } from "@/features/bank-statements/list/StatementListPage";
import { BankConnectionsPage } from "@/features/bank-statements/connections/BankConnectionsPage";
import { findNavItemByRoute, NAV_ITEMS, type NavItem } from "@/domain/workspace/navItems";
import { selectIsAuthenticated, useSessionStore } from "@/state/sessionStore";
import { useTheme } from "@/state/useTheme";

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
  useTheme();

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
      return;
    }
    if (
      isAuthenticated &&
      !mustChangePassword &&
      route !== "/change-password" &&
      findNavItemByRoute(route) === undefined
    ) {
      window.location.hash = `#${NAV_ITEMS[0].route}`;
    }
  }, [isAuthenticated, mustChangePassword, route]);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (mustChangePassword || route === "/change-password") {
    return <ChangePasswordPanel />;
  }

  const item = findNavItemByRoute(route) ?? NAV_ITEMS[0];

  return (
    <AppShell activeRoute={item.route}>
      {renderRoute(item)}
    </AppShell>
  );
}

function renderRoute(item: NavItem): ReactNode {
  if (item.route === "/bank-statements") return <StatementListPage />;
  if (item.route === "/bank-connections") return <BankConnectionsPage />;
  return <PlaceholderPage label={item.label} />;
}
