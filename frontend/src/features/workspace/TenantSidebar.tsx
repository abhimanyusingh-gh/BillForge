import type { TenantViewTab } from "@/types";
import { Badge, BADGE_SIZE, BADGE_TONE } from "@/components/ds/Badge";
import type { StandaloneHashRoute } from "@/features/workspace/tabHashConfig";

const SIDEBAR_ITEM_ID = {
  Overview: "overview",
  ActionRequired: "actionRequired",
  Invoices: "invoices",
  Vendors: "vendors",
  Payments: "payments",
  Reconciliation: "reconciliation",
  BankStatements: "bankStatements",
  TdsDashboard: "tdsDashboard",
  TallyExport: "tallyExport",
  TallySync: "tallySync",
  Mailboxes: "mailboxes",
  InboxRouting: "inboxRouting",
  ClientOrgs: "clientOrgs",
  Config: "config"
} as const;

type SidebarItemId = (typeof SIDEBAR_ITEM_ID)[keyof typeof SIDEBAR_ITEM_ID];

const SIDEBAR_TARGET_KIND = {
  Tab: "tab",
  StandaloneHash: "standalone-hash",
  Action: "action"
} as const;

const SIDEBAR_ACTION = {
  OpenActionRequired: "openActionRequired"
} as const;

type SidebarAction = (typeof SIDEBAR_ACTION)[keyof typeof SIDEBAR_ACTION];

type SidebarTarget =
  | { kind: typeof SIDEBAR_TARGET_KIND.Tab; tab: TenantViewTab }
  | { kind: typeof SIDEBAR_TARGET_KIND.StandaloneHash; route: StandaloneHashRoute }
  | { kind: typeof SIDEBAR_TARGET_KIND.Action; action: SidebarAction };

const SIDEBAR_REQUIRES = {
  Always: "always",
  Config: "config",
  Connections: "connections"
} as const;

type SidebarRequires = (typeof SIDEBAR_REQUIRES)[keyof typeof SIDEBAR_REQUIRES];

interface SidebarItemConfig {
  id: SidebarItemId;
  label: string;
  icon: string;
  target: SidebarTarget;
  requires: SidebarRequires;
}

const SIDEBAR_SECTION_ID = {
  Primary: "primary",
  Banking: "banking",
  Compliance: "compliance",
  Setup: "setup"
} as const;

type SidebarSectionId = (typeof SIDEBAR_SECTION_ID)[keyof typeof SIDEBAR_SECTION_ID];

interface SidebarSectionConfig {
  id: SidebarSectionId;
  eyebrow: string | null;
  items: readonly SidebarItemConfig[];
}

const SIDEBAR_SECTIONS: readonly SidebarSectionConfig[] = [
  {
    id: SIDEBAR_SECTION_ID.Primary,
    eyebrow: null,
    items: [
      { id: SIDEBAR_ITEM_ID.Overview, label: "Overview", icon: "dashboard", target: { kind: SIDEBAR_TARGET_KIND.Tab, tab: "overview" }, requires: SIDEBAR_REQUIRES.Always },
      { id: SIDEBAR_ITEM_ID.ActionRequired, label: "Action Required", icon: "priority_high", target: { kind: SIDEBAR_TARGET_KIND.Action, action: SIDEBAR_ACTION.OpenActionRequired }, requires: SIDEBAR_REQUIRES.Always },
      { id: SIDEBAR_ITEM_ID.Invoices, label: "Invoices", icon: "receipt_long", target: { kind: SIDEBAR_TARGET_KIND.Tab, tab: "dashboard" }, requires: SIDEBAR_REQUIRES.Always },
      { id: SIDEBAR_ITEM_ID.Vendors, label: "Vendors", icon: "business", target: { kind: SIDEBAR_TARGET_KIND.StandaloneHash, route: "vendors" }, requires: SIDEBAR_REQUIRES.Always },
      { id: SIDEBAR_ITEM_ID.Payments, label: "Payments", icon: "payments", target: { kind: SIDEBAR_TARGET_KIND.StandaloneHash, route: "payments" }, requires: SIDEBAR_REQUIRES.Always }
    ]
  },
  {
    id: SIDEBAR_SECTION_ID.Banking,
    eyebrow: "Banking",
    items: [
      { id: SIDEBAR_ITEM_ID.Reconciliation, label: "Reconciliation", icon: "account_balance", target: { kind: SIDEBAR_TARGET_KIND.Tab, tab: "statements" }, requires: SIDEBAR_REQUIRES.Connections },
      { id: SIDEBAR_ITEM_ID.BankStatements, label: "Bank Statements", icon: "description", target: { kind: SIDEBAR_TARGET_KIND.StandaloneHash, route: "bankStatements" }, requires: SIDEBAR_REQUIRES.Connections }
    ]
  },
  {
    id: SIDEBAR_SECTION_ID.Compliance,
    eyebrow: "Compliance",
    items: [
      { id: SIDEBAR_ITEM_ID.TdsDashboard, label: "TDS Dashboard", icon: "receipt", target: { kind: SIDEBAR_TARGET_KIND.StandaloneHash, route: "reportsTds" }, requires: SIDEBAR_REQUIRES.Always },
      { id: SIDEBAR_ITEM_ID.TallyExport, label: "Tally Export", icon: "cloud_upload", target: { kind: SIDEBAR_TARGET_KIND.Tab, tab: "exports" }, requires: SIDEBAR_REQUIRES.Always },
      { id: SIDEBAR_ITEM_ID.TallySync, label: "Tally Sync", icon: "cable", target: { kind: SIDEBAR_TARGET_KIND.StandaloneHash, route: "tallySync" }, requires: SIDEBAR_REQUIRES.Always }
    ]
  },
  {
    id: SIDEBAR_SECTION_ID.Setup,
    eyebrow: "Setup",
    items: [
      { id: SIDEBAR_ITEM_ID.Mailboxes, label: "Mailboxes", icon: "mail", target: { kind: SIDEBAR_TARGET_KIND.StandaloneHash, route: "mailboxes" }, requires: SIDEBAR_REQUIRES.Always },
      { id: SIDEBAR_ITEM_ID.InboxRouting, label: "Inbox Routing", icon: "alt_route", target: { kind: SIDEBAR_TARGET_KIND.StandaloneHash, route: "inboxRouting" }, requires: SIDEBAR_REQUIRES.Always },
      { id: SIDEBAR_ITEM_ID.ClientOrgs, label: "Client Orgs", icon: "account_tree", target: { kind: SIDEBAR_TARGET_KIND.StandaloneHash, route: "clientOrgs" }, requires: SIDEBAR_REQUIRES.Always },
      { id: SIDEBAR_ITEM_ID.Config, label: "Config", icon: "tune", target: { kind: SIDEBAR_TARGET_KIND.Tab, tab: "config" }, requires: SIDEBAR_REQUIRES.Config }
    ]
  }
] as const;

interface TenantSidebarProps {
  tenantName: string;
  activeTab: TenantViewTab;
  activeStandaloneRoute: StandaloneHashRoute | null;
  onTabChange: (tab: TenantViewTab) => void;
  onStandaloneRouteChange: (route: StandaloneHashRoute) => void;
  onOpenActionRequired: () => void;
  canViewTenantConfig: boolean;
  canViewConnections: boolean;
  invoiceActionRequiredCount: number | null;
  inboxRoutingPendingCount?: number;
}

function badgeAriaLabel(label: string, count: number, suffix: string): string {
  return count > 0 ? `${label}, ${count} ${suffix}` : label;
}

function isItemAllowed(item: SidebarItemConfig, canViewTenantConfig: boolean, canViewConnections: boolean): boolean {
  if (item.requires === SIDEBAR_REQUIRES.Config) return canViewTenantConfig;
  if (item.requires === SIDEBAR_REQUIRES.Connections) return canViewConnections;
  return true;
}

function isItemActive(
  item: SidebarItemConfig,
  activeTab: TenantViewTab,
  activeStandaloneRoute: StandaloneHashRoute | null
): boolean {
  if (item.target.kind === SIDEBAR_TARGET_KIND.Tab) {
    return activeStandaloneRoute === null && item.target.tab === activeTab;
  }
  if (item.target.kind === SIDEBAR_TARGET_KIND.StandaloneHash) {
    return activeStandaloneRoute === item.target.route;
  }
  return false;
}

function activateTarget(
  target: SidebarTarget,
  onTabChange: (tab: TenantViewTab) => void,
  onStandaloneRouteChange: (route: StandaloneHashRoute) => void,
  onOpenActionRequired: () => void
): void {
  switch (target.kind) {
    case SIDEBAR_TARGET_KIND.Tab:
      onTabChange(target.tab);
      return;
    case SIDEBAR_TARGET_KIND.StandaloneHash:
      onStandaloneRouteChange(target.route);
      return;
    case SIDEBAR_TARGET_KIND.Action:
      if (target.action === SIDEBAR_ACTION.OpenActionRequired) {
        onOpenActionRequired();
      }
      return;
    default: {
      const _exhaustive: never = target;
      return _exhaustive;
    }
  }
}

export function TenantSidebar({
  tenantName,
  activeTab,
  activeStandaloneRoute,
  onTabChange,
  onStandaloneRouteChange,
  onOpenActionRequired,
  canViewTenantConfig,
  canViewConnections,
  invoiceActionRequiredCount,
  inboxRoutingPendingCount = 0
}: TenantSidebarProps) {
  const actionCount = invoiceActionRequiredCount ?? 0;
  const trimmedTenant = tenantName.trim();
  return (
    <nav className="app-sidebar" aria-label="Primary">
      <div className="sidebar-brand">
        <span className="sidebar-brand-mark" aria-hidden="true">₹</span>
        <span className="sidebar-brand-name">LedgerBuddy</span>
      </div>
      {trimmedTenant.length > 0 ? (
        <div className="sidebar-tenant-sub" title={trimmedTenant}>
          <span className="material-symbols-outlined sidebar-tenant-sub-icon" aria-hidden="true">business</span>
          <span className="sidebar-tenant-sub-label">{trimmedTenant}</span>
        </div>
      ) : null}
      {SIDEBAR_SECTIONS.map((section) => (
        <section key={section.id} className="sidebar-section" aria-label={section.eyebrow ?? undefined}>
          {section.eyebrow !== null ? (
            <h6 className="sidebar-section-eyebrow">{section.eyebrow}</h6>
          ) : null}
          <ul className="sidebar-section-list">
            {section.items.map((item) => {
              const allowed = isItemAllowed(item, canViewTenantConfig, canViewConnections);
              const isActive = allowed && isItemActive(item, activeTab, activeStandaloneRoute);
              const showActionBadge = item.id === SIDEBAR_ITEM_ID.ActionRequired && actionCount > 0;
              const showInboxBadge = item.id === SIDEBAR_ITEM_ID.InboxRouting && inboxRoutingPendingCount > 0;
              const ariaLabel = item.id === SIDEBAR_ITEM_ID.ActionRequired
                ? badgeAriaLabel(item.label, actionCount, "action required")
                : item.id === SIDEBAR_ITEM_ID.InboxRouting
                  ? badgeAriaLabel(item.label, inboxRoutingPendingCount, "pending")
                  : undefined;
              return (
                <li key={item.id} className="sidebar-section-item">
                  <button
                    type="button"
                    className={isActive ? "sidebar-link sidebar-link-active" : "sidebar-link"}
                    aria-current={isActive ? "page" : undefined}
                    aria-disabled={!allowed || undefined}
                    aria-label={ariaLabel}
                    disabled={!allowed}
                    data-item-id={item.id}
                    onClick={() => {
                      if (!allowed) return;
                      activateTarget(item.target, onTabChange, onStandaloneRouteChange, onOpenActionRequired);
                    }}
                  >
                    <span className="material-symbols-outlined sidebar-link-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="sidebar-link-label">{item.label}</span>
                    {showActionBadge ? (
                      <Badge tone={BADGE_TONE.danger} size={BADGE_SIZE.sm} title={`${actionCount} action required`}>
                        {actionCount}
                      </Badge>
                    ) : null}
                    {showInboxBadge ? (
                      <Badge tone={BADGE_TONE.warning} size={BADGE_SIZE.sm} title={`${inboxRoutingPendingCount} pending`}>
                        {inboxRoutingPendingCount}
                      </Badge>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
