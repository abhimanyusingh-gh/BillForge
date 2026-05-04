import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RealmSwitcher } from "@/features/workspace/RealmSwitcher";
import { useTenantClientOrgs } from "@/hooks/useTenantClientOrgs";
import { useActiveClientOrg } from "@/hooks/useActiveClientOrg";
import { useModalDismiss } from "@/hooks/useModalDismiss";

const REALM_SWITCHER_SHORTCUT = {
  key: "k",
  withMeta: true
} as const;

interface WorkspaceTopNavProps {
  userEmail: string;
  onLogout: () => void;
  onChangePassword: () => void;
  themeToggle?: React.ReactNode;
  notificationCount?: number;
  onOpenNotifications?: () => void;
  onOpenSearch?: () => void;
  onGoToOnboarding?: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  return target.isContentEditable;
}

function avatarInitials(email: string): string {
  const trimmed = email.trim();
  if (!trimmed) return "U";
  return trimmed[0].toUpperCase();
}

export function WorkspaceTopNav({
  userEmail,
  onLogout,
  onChangePassword,
  themeToggle,
  notificationCount = 0,
  onOpenNotifications,
  onOpenSearch,
  onGoToOnboarding
}: WorkspaceTopNavProps) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchPlaceholderOpen, setSearchPlaceholderOpen] = useState(false);
  const [notificationsPlaceholderOpen, setNotificationsPlaceholderOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { clientOrgs, isLoading, isError, refetch } = useTenantClientOrgs();
  const { activeClientOrgId } = useActiveClientOrg();

  const openSwitcher = useCallback(() => setSwitcherOpen(true), []);
  const closeSwitcher = useCallback(() => setSwitcherOpen(false), []);

  useEffect(() => {
    function handler(event: KeyboardEvent) {
      const isShortcut =
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        !event.altKey &&
        event.key.toLowerCase() === REALM_SWITCHER_SHORTCUT.key;
      if (!isShortcut) return;
      if (isEditableTarget(event.target)) {
        const tag = (event.target as HTMLElement).tagName.toLowerCase();
        if (tag !== "input" && tag !== "textarea") return;
      }
      event.preventDefault();
      setSwitcherOpen((prev) => !prev);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const avatarLabel = useMemo(() => avatarInitials(userEmail), [userEmail]);

  const activeOrgName = useMemo(() => {
    if (!activeClientOrgId || !clientOrgs) return null;
    return clientOrgs.find((org) => org.id === activeClientOrgId)?.companyName ?? null;
  }, [activeClientOrgId, clientOrgs]);

  const pillLabel = (() => {
    if (activeClientOrgId === null) return "Select a client";
    if (isLoading && !clientOrgs) return "Loading…";
    return activeOrgName ?? activeClientOrgId;
  })();

  const pillTitle = activeClientOrgId === null
    ? "Select a client organization"
    : `Active client: ${pillLabel} — click or press ⌘K to switch`;

  return (
    <header className="app-topnav">
      <div className="topnav-realm-group">
        <span className="topnav-eyebrow">Client org</span>
        <button
          type="button"
          className="topnav-realm-pill"
          data-testid="active-realm-badge"
          onClick={openSwitcher}
          aria-haspopup="dialog"
          title={pillTitle}
          aria-label={`${pillLabel}, open client org switcher`}
        >
          <span className="material-symbols-outlined topnav-realm-pill-icon" aria-hidden="true">
            account_tree
          </span>
          <span className="topnav-realm-pill-label">{pillLabel}</span>
          <span className="topnav-realm-pill-kbd" aria-hidden="true">⌘K</span>
        </button>
      </div>

      <div className="topnav-actions">
        <button
          type="button"
          className="topnav-icon-btn"
          title="Search"
          aria-label="Search"
          onClick={onOpenSearch ?? (() => setSearchPlaceholderOpen(true))}
        >
          <span className="material-symbols-outlined" aria-hidden="true">search</span>
        </button>
        <button
          type="button"
          className="topnav-icon-btn"
          title="Notifications"
          aria-label={notificationCount > 0 ? `Notifications, ${notificationCount} unread` : "Notifications"}
          onClick={onOpenNotifications ?? (() => setNotificationsPlaceholderOpen(true))}
        >
          <span className="material-symbols-outlined" aria-hidden="true">notifications</span>
          {notificationCount > 0 ? (
            <span className="topnav-icon-badge" aria-hidden="true">{notificationCount}</span>
          ) : null}
        </button>
        {themeToggle ?? null}
        <div className="topnav-avatar-wrap" ref={menuRef}>
          <button
            type="button"
            className="topnav-avatar"
            aria-label={`Account menu, signed in as ${userEmail}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={userEmail}
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            {avatarLabel}
          </button>
          {menuOpen ? (
            <div className="topnav-avatar-menu" role="menu" data-testid="topnav-avatar-menu">
              <div className="topnav-avatar-menu-identity">
                <div className="topnav-avatar-menu-email">{userEmail}</div>
              </div>
              <button
                type="button"
                className="topnav-avatar-menu-item"
                role="menuitem"
                onClick={() => { setMenuOpen(false); onChangePassword(); }}
              >
                <span className="material-symbols-outlined" aria-hidden="true">lock</span>
                <span>Change password</span>
              </button>
              <button
                type="button"
                className="topnav-avatar-menu-item topnav-avatar-menu-item-danger"
                role="menuitem"
                onClick={() => { setMenuOpen(false); onLogout(); }}
              >
                <span className="material-symbols-outlined" aria-hidden="true">logout</span>
                <span>Sign out</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <RealmSwitcher
        open={switcherOpen}
        onClose={closeSwitcher}
        clientOrgs={clientOrgs}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => { void refetch(); }}
        onGoToOnboarding={onGoToOnboarding}
      />

      <PlaceholderDialog
        open={searchPlaceholderOpen}
        title="Search"
        message="Search coming soon — try ⌘K to switch realms instead."
        testId="topnav-search-placeholder"
        onClose={() => setSearchPlaceholderOpen(false)}
      />

      <PlaceholderDialog
        open={notificationsPlaceholderOpen}
        title="Notifications"
        message="No notifications."
        testId="topnav-notifications-placeholder"
        onClose={() => setNotificationsPlaceholderOpen(false)}
      />
    </header>
  );
}

interface PlaceholderDialogProps {
  open: boolean;
  title: string;
  message: string;
  testId: string;
  onClose: () => void;
}

function PlaceholderDialog({ open, title, message, testId, onClose }: PlaceholderDialogProps) {
  useModalDismiss({ open, onClose });
  if (!open) return null;
  return (
    <div className="popup-overlay" role="presentation" onClick={onClose}>
      <section
        className="popup-card popup-card-narrow"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="popup-header">
          <h2>{title}</h2>
        </div>
        <p className="topnav-placeholder-message">{message}</p>
        <div className="confirm-actions">
          <button type="button" className="app-button app-button-secondary" onClick={onClose}>Close</button>
        </div>
      </section>
    </div>
  );
}
