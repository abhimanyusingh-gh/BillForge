interface PlatformAdminTopNavProps {
  userEmail: string;
  onLogout: () => void;
  onChangePassword: () => void;
  counts: { tenants: number; failedDocuments: number };
  themeToggle?: React.ReactNode;
}

export function PlatformAdminTopNav({ userEmail, onLogout, onChangePassword, counts, themeToggle }: PlatformAdminTopNavProps) {
  return (
    <header className="pa-topnav">
      <div className="pa-brand-row">
        <span className="pa-mark" aria-hidden="true">
          <span className="material-symbols-outlined" aria-hidden="true">account_balance</span>
        </span>
        <span className="pa-name">LedgerBuddy</span>
        <span className="pa-scope-pill">
          <span className="material-symbols-outlined" aria-hidden="true">shield_person</span>
          Platform admin
        </span>
      </div>
      <span className="pa-card-sub" aria-label={`${counts.tenants} tenants`}>
        {counts.tenants} tenants
      </span>
      {counts.failedDocuments > 0 ? (
        <span className="pa-tab-badge" aria-label={`${counts.failedDocuments} failed documents`}>
          {counts.failedDocuments} failed
        </span>
      ) : null}
      <div className="pa-spacer" />
      {themeToggle ?? null}
      <div className="pa-account">
        <span className="pa-account-role">Platform Admin</span>
        <strong className="pa-account-email">{userEmail}</strong>
      </div>
      <button
        type="button"
        className="app-button app-button-secondary"
        onClick={onChangePassword}
        aria-label="Change Password"
        title="Change Password"
      >
        <span className="material-symbols-outlined">key</span>
      </button>
      <button type="button" className="app-button app-button-primary" onClick={onLogout}>
        <span className="material-symbols-outlined">logout</span>
        Logout
      </button>
    </header>
  );
}
