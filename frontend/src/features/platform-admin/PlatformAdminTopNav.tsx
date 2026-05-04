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
      <div className="brand-row">
        <span className="pa-mark" aria-hidden="true">₹</span>
        <span className="pa-name">LedgerBuddy</span>
        <span className="pa-scope-pill">
          <span className="material-symbols-outlined" aria-hidden="true">shield_person</span>
          Platform admin
        </span>
      </div>
      <div className="pa-tabs">
        <span className="pa-tab active">
          <span className="material-symbols-outlined">dashboard</span>
          <span>Overview</span>
        </span>
        <span className="pa-tab">
          <span className="material-symbols-outlined">groups</span>
          <span>Tenants</span>
          {counts.tenants > 0 ? <span className="pa-tab-badge">{counts.tenants}</span> : null}
        </span>
        {counts.failedDocuments > 0 ? (
          <span className="pa-tab">
            <span className="material-symbols-outlined">error</span>
            <span>Failed</span>
            <span className="pa-tab-badge">{counts.failedDocuments}</span>
          </span>
        ) : null}
      </div>
      <div className="pa-spacer" />
      {themeToggle ?? null}
      <div className="pa-account">
        <span className="pa-account-role">Platform Admin</span>
        <strong className="pa-account-email">{userEmail}</strong>
      </div>
      <button
        type="button"
        className="pa-btn pa-btn-ghost"
        onClick={onChangePassword}
        aria-label="Change Password"
        title="Change Password"
      >
        <span className="material-symbols-outlined">key</span>
      </button>
      <button type="button" className="pa-btn pa-btn-primary" onClick={onLogout}>
        <span className="material-symbols-outlined">logout</span>
        Logout
      </button>
    </header>
  );
}
