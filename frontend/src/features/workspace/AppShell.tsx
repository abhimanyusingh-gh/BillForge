import type { ReactNode } from "react";
import type { TenantViewTab } from "@/types";
import { TenantSidebar } from "@/features/workspace/TenantSidebar";
import { UrlMigrationBanner } from "@/features/workspace/UrlMigrationBanner";
import type { HashRouteMigration } from "@/features/workspace/useTabHashRouting";
import type { StandaloneHashRoute } from "@/features/workspace/tabHashConfig";

interface AppShellProps {
  tenantName: string;
  activeTab: TenantViewTab;
  activeStandaloneRoute: StandaloneHashRoute | null;
  onTabChange: (tab: TenantViewTab) => void;
  onStandaloneRouteChange: (route: StandaloneHashRoute) => void;
  onOpenActionRequired: () => void;
  canViewTenantConfig: boolean;
  canViewConnections: boolean;
  invoiceActionRequiredCount: number | null;
  topNav: ReactNode;
  subNav?: ReactNode;
  migration: HashRouteMigration | null;
  children: ReactNode;
}

export function AppShell({
  tenantName,
  activeTab,
  activeStandaloneRoute,
  onTabChange,
  onStandaloneRouteChange,
  onOpenActionRequired,
  canViewTenantConfig,
  canViewConnections,
  invoiceActionRequiredCount,
  topNav,
  subNav,
  migration,
  children
}: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="app-shell-sidebar app-sidebar" aria-label="Primary navigation">
        <TenantSidebar
          tenantName={tenantName}
          activeTab={activeTab}
          activeStandaloneRoute={activeStandaloneRoute}
          onTabChange={onTabChange}
          onStandaloneRouteChange={onStandaloneRouteChange}
          onOpenActionRequired={onOpenActionRequired}
          canViewTenantConfig={canViewTenantConfig}
          canViewConnections={canViewConnections}
          invoiceActionRequiredCount={invoiceActionRequiredCount}
        />
      </aside>
      {topNav}
      <main className="app-shell-main app-main" id="main-content" tabIndex={-1}>
        {migration ? (
          <UrlMigrationBanner oldPath={migration.oldPath} newPath={migration.newPath} />
        ) : null}
        {subNav}
        {children}
      </main>
    </div>
  );
}
