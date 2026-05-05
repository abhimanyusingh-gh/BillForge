import { useEffect, useState } from "react";
import { ChangePasswordPanel } from "@/features/auth/change-password/ChangePasswordPanel";
import { LoginPage } from "@/features/auth/login/LoginPage";
import { AppShell } from "@/features/workspace/shell/AppShell";
import { PlaceholderPage } from "@/features/placeholder/PlaceholderPage";
import { InvoiceListPage } from "@/features/invoices/list/InvoiceListPage";
import { InvoiceDetailPage } from "@/features/invoices/detail/InvoiceDetailPage";
import { findNavItemByRoute, NAV_ITEMS } from "@/domain/workspace/navItems";
import { selectIsAuthenticated, useSessionStore } from "@/state/sessionStore";
import { useTheme } from "@/state/useTheme";

const INVOICE_DETAIL_PREFIX = "/invoices/";

function parseInvoiceDetailId(route: string): string | null {
  if (!route.startsWith(INVOICE_DETAIL_PREFIX)) return null;
  const id = route.slice(INVOICE_DETAIL_PREFIX.length);
  return id.length > 0 ? id : null;
}

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
      findNavItemByRoute(route) === undefined &&
      parseInvoiceDetailId(route) === null
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

  const invoiceDetailId = parseInvoiceDetailId(route);
  if (invoiceDetailId !== null) {
    return (
      <AppShell activeRoute="/invoices">
        <InvoiceDetailPage invoiceIdRaw={invoiceDetailId} />
      </AppShell>
    );
  }

  if (route === "/invoices") {
    return (
      <AppShell activeRoute="/invoices">
        <InvoiceListPage />
      </AppShell>
    );
  }

  const item = findNavItemByRoute(route) ?? NAV_ITEMS[0];

  return (
    <AppShell activeRoute={item.route}>
      <PlaceholderPage label={item.label} />
    </AppShell>
  );
}
