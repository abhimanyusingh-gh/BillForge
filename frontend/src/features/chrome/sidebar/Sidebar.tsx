import { Fragment } from "react";
import { NAV_ITEMS, type NavBadgeKey, type NavItem } from "@/domain/chrome/navItems";
import { useChromeCounters } from "@/features/chrome/sidebar/useChromeCounters";
import { useSessionStore } from "@/state/sessionStore";

interface SidebarProps {
  activeRoute: string;
}

function readBadge(counters: { action: number; triage: number }, key: NavBadgeKey | undefined): number {
  if (key === "action") return counters.action;
  if (key === "triage") return counters.triage;
  return 0;
}

function navigate(route: string): void {
  if (typeof window === "undefined") return;
  window.location.hash = `#${route}`;
}

function NavLink({
  item,
  active,
  badge,
  collapsed
}: {
  item: NavItem;
  active: boolean;
  badge: number;
  collapsed: boolean;
}) {
  const className = `nav-link${active ? " active" : ""}${collapsed ? " collapsed" : ""}`;
  return (
    <button
      type="button"
      className={className}
      onClick={() => navigate(item.route)}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
    >
      <span className="material-symbols-outlined nav-link-icon">{item.icon}</span>
      {collapsed ? null : <span className="nav-link-label">{item.label}</span>}
      {badge > 0 ? (
        <span className={collapsed ? "nav-badge nav-badge-collapsed" : "nav-badge"}>{badge}</span>
      ) : null}
    </button>
  );
}

export function Sidebar({ activeRoute }: SidebarProps) {
  const counters = useChromeCounters();
  const collapsed = useSessionStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useSessionStore((state) => state.toggleSidebar);
  const tenant = useSessionStore((state) => state.tenant);

  const sectionsRendered = new Set<string>();

  return (
    <aside className={`app-sidebar${collapsed ? " collapsed" : ""}`} aria-label="Primary navigation">
      <div className={`brand${collapsed ? " brand-collapsed" : ""}`}>
        <span className="mark">₹</span>
        {collapsed ? null : <span className="name">LedgerBuddy</span>}
        {!collapsed ? (
          <button
            type="button"
            className="iconbtn iconbtn-flush sidebar-toggle"
            onClick={toggleSidebar}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <span className="material-symbols-outlined chevron-icon">chevron_left</span>
          </button>
        ) : null}
      </div>
      {!collapsed && tenant ? (
        <div className="sidebar-tenant" title={tenant.name}>
          <span className="material-symbols-outlined sidebar-tenant-icon">business</span>
          <span className="sidebar-tenant-name">{tenant.name}</span>
        </div>
      ) : null}
      {collapsed ? (
        <button
          type="button"
          className="iconbtn iconbtn-flush sidebar-toggle sidebar-toggle-collapsed"
          onClick={toggleSidebar}
          title="Expand sidebar"
          aria-label="Expand sidebar"
        >
          <span className="material-symbols-outlined chevron-icon">chevron_right</span>
        </button>
      ) : null}
      {NAV_ITEMS.map((item) => {
        const showSection = item.section !== undefined && !sectionsRendered.has(item.section);
        if (item.section !== undefined) sectionsRendered.add(item.section);
        return (
          <Fragment key={item.id}>
            {showSection && item.section !== undefined ? (
              collapsed ? <div className="nav-section-divider" /> : <div className="nav-section">{item.section}</div>
            ) : null}
            <NavLink
              item={item}
              active={activeRoute === item.route}
              badge={readBadge(counters, item.badgeKey)}
              collapsed={collapsed}
            />
          </Fragment>
        );
      })}
    </aside>
  );
}
