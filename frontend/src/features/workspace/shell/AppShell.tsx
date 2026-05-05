import { useEffect, useMemo, type ReactNode } from "react";
import { Sidebar } from "@/features/workspace/sidebar/Sidebar";
import { TopNav } from "@/features/workspace/topnav/TopNav";
import { useClientOrgs } from "@/features/workspace/realm-palette/useClientOrgs";
import { MissingClientOrgPopover } from "@/features/workspace/onboarding/MissingClientOrgPopover";
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
  const selectClientOrg = useSessionStore((state) => state.selectClientOrg);
  const { orgs, isLoading } = useClientOrgs(true);

  useEffect(() => {
    if (currentClientOrgId === null && orgs.length > 0) {
      selectClientOrg(orgs[0].id);
    }
  }, [currentClientOrgId, orgs, selectClientOrg]);

  const realmLabel = useMemo(() => {
    if (currentClientOrgId !== null) {
      const match = orgs.find((org) => org.id === currentClientOrgId);
      if (match) return match.companyName;
    }
    return tenant?.name ?? FALLBACK_REALM_LABEL;
  }, [currentClientOrgId, orgs, tenant]);

  const showOnboarding = !isLoading && orgs.length === 0;

  return (
    <div className={`app-shell${collapsed ? " sb-collapsed" : ""}`}>
      <Sidebar activeRoute={activeRoute} />
      <TopNav realmLabel={realmLabel} />
      <main className="app-main">{children}</main>
      {showOnboarding ? <MissingClientOrgPopover /> : null}
    </div>
  );
}
