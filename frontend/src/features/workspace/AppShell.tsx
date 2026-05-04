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
      <TenantSidebar
        tenantName={tenantName}
        activeTab={activeTab}
        activeStandaloneRoute={activeStandaloneRoute}
        onTabChange={onTabChange}
        onStandaloneRouteChange={onStandaloneRouteChange}
        canViewTenantConfig={canViewTenantConfig}
        canViewConnections={canViewConnections}
        invoiceActionRequiredCount={invoiceActionRequiredCount}
      />
      {topNav}
      <main id="main-content" tabIndex={-1}>
        {migration ? (
          <UrlMigrationBanner oldPath={migration.oldPath} newPath={migration.newPath} />
        ) : null}
        {subNav}
        {children}
      </main>
    </div>
  );
}
