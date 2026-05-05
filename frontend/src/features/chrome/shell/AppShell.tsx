import { useMemo, type ReactNode } from "react";
import { Sidebar } from "@/features/chrome/sidebar/Sidebar";
import { TopNav } from "@/features/chrome/topnav/TopNav";
import { useClientOrgs } from "@/features/chrome/realm-palette/useClientOrgs";
import { useSessionStore } from "@/state/sessionStore";

interface AppShellProps {
  activeRoute: string;
  children: ReactNode;
}

const FALLBACK_REALM_LABEL = "Select client org";

export function AppShell({ activeRoute, children }: AppShellProps) {
  const collapsed = useSessionStore((state) => state.sidebarCollapsed);
  const currentClientOrgId = useSessionStore((state) => state.currentClientOrgId);
  const tenant = useSessionStore((state) => state.tenant);
  const { orgs } = useClientOrgs(true);

  const realmLabel = useMemo(() => {
    if (currentClientOrgId !== null) {
      const match = orgs.find((org) => org.id === currentClientOrgId);
      if (match) return match.companyName;
    }
    return tenant?.name ?? FALLBACK_REALM_LABEL;
  }, [currentClientOrgId, orgs, tenant]);

  return (
    <div className={`app-shell${collapsed ? " sb-collapsed" : ""}`}>
      <Sidebar activeRoute={activeRoute} />
      <TopNav realmLabel={realmLabel} />
      <main className="app-main">{children}</main>
    </div>
  );
}
