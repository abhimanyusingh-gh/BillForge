import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/common/EmptyState";

const USER_SETTINGS_TABS = [
  { id: "profile", label: "Profile", icon: "person" },
  { id: "password", label: "Password", icon: "lock" },
  { id: "twofa", label: "Two-factor auth", icon: "shield" },
  { id: "notifications", label: "Notifications", icon: "notifications" },
  { id: "audit", label: "Audit log", icon: "schedule" },
  { id: "preferences", label: "Preferences", icon: "tune" },
] as const;

type UserSettingsTabId = (typeof USER_SETTINGS_TABS)[number]["id"];

const TAB_STORAGE_KEY = "ledgerbuddy:user-settings-tab";

interface UserSettingsPageProps {
  userEmail: string;
  userRoleLabel: string;
  onClose: () => void;
  onChangePassword: () => void;
}

function readStoredTab(): UserSettingsTabId {
  if (typeof window === "undefined") return "profile";
  const raw = window.localStorage.getItem(TAB_STORAGE_KEY);
  if (raw && USER_SETTINGS_TABS.some((tab) => tab.id === raw)) {
    return raw as UserSettingsTabId;
  }
  return "profile";
}

export function UserSettingsPage({
  userEmail,
  userRoleLabel,
  onClose,
  onChangePassword,
}: UserSettingsPageProps) {
  const [activeTab, setActiveTab] = useState<UserSettingsTabId>(() => readStoredTab());

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  const selectTab = useCallback((id: UserSettingsTabId) => setActiveTab(id), []);

  return (
    <div className="user-settings-shell">
      <div className="page-header user-settings-page-header">
        <h1>User settings</h1>
        <span className="count">{userEmail}</span>
        <div className="page-tools">
          <button
            type="button"
            className="app-button app-button-secondary user-settings-back"
            onClick={onClose}
          >
            <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
            Back
          </button>
        </div>
      </div>

      <div className="user-settings-grid">
        <nav className="user-settings-rail" aria-label="User settings">
          {USER_SETTINGS_TABS.map((tab) => {
            const on = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={"user-settings-rail-item" + (on ? " is-active" : "")}
                aria-current={on ? "page" : undefined}
                onClick={() => selectTab(tab.id)}
              >
                <span className="material-symbols-outlined" aria-hidden="true">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="user-settings-panel">
          {activeTab === "profile" ? (
            <UserSettingsProfileTab userEmail={userEmail} userRoleLabel={userRoleLabel} />
          ) : null}
          {activeTab === "password" ? (
            <UserSettingsPasswordTab onChangePassword={onChangePassword} />
          ) : null}
          {activeTab === "twofa" ? <UserSettingsTwoFactorPlaceholder /> : null}
          {activeTab === "notifications" ? <UserSettingsNotificationsPlaceholder /> : null}
          {activeTab === "audit" ? <UserSettingsAuditPlaceholder /> : null}
          {activeTab === "preferences" ? <UserSettingsPreferencesPlaceholder /> : null}
        </div>
      </div>
    </div>
  );
}

interface UserSettingsProfileTabProps {
  userEmail: string;
  userRoleLabel: string;
}

function UserSettingsProfileTab({ userEmail, userRoleLabel }: UserSettingsProfileTabProps) {
  return (
    <section className="user-settings-section">
      <header className="user-settings-section-head">
        <h2>Profile</h2>
        <p>Visible to teammates and on approval emails.</p>
      </header>

      <div className="user-settings-fields">
        <label className="user-settings-field">
          <span className="user-settings-field-label">Work email</span>
          <input
            className="user-settings-input user-settings-input-mono is-locked"
            value={userEmail}
            readOnly
            aria-readonly="true"
          />
          <span className="user-settings-field-hint">Managed by your firm — contact owner to change.</span>
        </label>

        <label className="user-settings-field">
          <span className="user-settings-field-label">Role</span>
          <input
            className="user-settings-input is-locked"
            value={userRoleLabel}
            readOnly
            aria-readonly="true"
          />
          <span className="user-settings-field-hint">Only firm owners can change roles.</span>
        </label>
      </div>
    </section>
  );
}

interface UserSettingsPasswordTabProps {
  onChangePassword: () => void;
}

function UserSettingsPasswordTab({ onChangePassword }: UserSettingsPasswordTabProps) {
  return (
    <section className="user-settings-section">
      <header className="user-settings-section-head">
        <h2>Password</h2>
        <p>Change the password used to sign in to LedgerBuddy.</p>
      </header>
      <div className="user-settings-actions">
        <button type="button" className="app-button app-button-primary" onClick={onChangePassword}>
          Change password
        </button>
      </div>
    </section>
  );
}

function UserSettingsTwoFactorPlaceholder() {
  return (
    <section
      className="user-settings-section user-settings-security-slot"
      data-testid="user-settings-security-slot"
    >
      <EmptyState
        icon="shield"
        heading="Two-factor auth"
        description="Reserved for post-MVP rollout (issue #386). Will offer authenticator app + recovery codes via Keycloak."
      />
    </section>
  );
}

function UserSettingsNotificationsPlaceholder() {
  return (
    <section className="user-settings-section">
      <EmptyState
        icon="notifications"
        heading="Notifications"
        description="Per-user notification routing is firm-wide today. Channel preferences (email · in-app · push) ship in a follow-up."
      />
    </section>
  );
}

function UserSettingsAuditPlaceholder() {
  return (
    <section className="user-settings-section">
      <EmptyState
        icon="schedule"
        heading="Audit log"
        description="Your last 90 days of activity will appear here once audit-log streaming lands."
      />
    </section>
  );
}

function UserSettingsPreferencesPlaceholder() {
  return (
    <section className="user-settings-section">
      <EmptyState
        icon="tune"
        heading="Preferences"
        description="Density · keyboard shortcuts · landing page · monetary format · date format ship in a follow-up."
      />
    </section>
  );
}
