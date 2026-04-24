import type { ReactNode } from "react";
import type { TenantViewTab } from "@/types";
import { TenantSidebar } from "@/features/workspace/TenantSidebar";
import { UrlMigrationBanner } from "@/features/workspace/UrlMigrationBanner";
import type { HashRouteMigration } from "@/features/workspace/useTabHashRouting";

interface AppShellProps {
  activeTab: TenantViewTab;
  onTabChange: (tab: TenantViewTab) => void;
  canViewTenantConfig: boolean;
  canViewConnections: boolean;
  invoiceActionRequiredCount: number;
  topNav: ReactNode;
  subNav?: ReactNode;
  migration: HashRouteMigration | null;
  onDismissMigration: () => void;
  children: ReactNode;
}

export function AppShell({
  activeTab,
  onTabChange,
  canViewTenantConfig,
  canViewConnections,
  invoiceActionRequiredCount,
  topNav,
  subNav,
  migration,
  onDismissMigration,
  children
}: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="app-shell-sidebar" aria-label="Primary navigation">
        <TenantSidebar
          activeTab={activeTab}
          onTabChange={onTabChange}
          canViewTenantConfig={canViewTenantConfig}
          canViewConnections={canViewConnections}
          invoiceActionRequiredCount={invoiceActionRequiredCount}
        />
      </aside>
      <div className="app-shell-column">
        {migration ? (
          <UrlMigrationBanner
            oldPath={migration.oldPath}
            newPath={migration.newPath}
            onDismiss={onDismissMigration}
          />
        ) : null}
        {topNav}
        {subNav}
        <main className="app-shell-main" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
