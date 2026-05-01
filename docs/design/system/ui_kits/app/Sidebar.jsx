// Sidebar.jsx — left navigation with collapse
function Sidebar({ active, onChange, counts, collapsed, onToggle, tenant }) {
  const Item = ({ id, icon, label, badge }) => (
    <button className={"nav-link " + (active === id ? "active" : "")} onClick={() => onChange(id)} title={collapsed ? label : undefined}>
      <span className="material-symbols-outlined">{icon}</span>
      {collapsed ? null : <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>}
      {!collapsed && badge ? <span className="nav-badge">{badge}</span> : null}
      {collapsed && badge ? <span className="nav-badge" style={{ position: "absolute", top: 2, right: 2, padding: "0 4px", fontSize: 9 }}>{badge}</span> : null}
    </button>
  );
  const Section = ({ children }) => collapsed ? <div style={{ height: 1, background: "var(--line)", margin: "8px 6px" }} /> : <div className="nav-section">{children}</div>;
  return (
    <aside className={"app-sidebar" + (collapsed ? " collapsed" : "")}>
      <div className="brand" style={{ justifyContent: collapsed ? "center" : "flex-start", paddingBottom: collapsed ? 8 : 4 }}>
        <span className="mark">₹</span>
        {collapsed ? null : <span className="name">LedgerBuddy</span>}
        {!collapsed ? <button className="iconbtn" onClick={onToggle} title="Collapse sidebar" style={{ marginLeft: "auto", height: 24, width: 24, border: 0 }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span></button> : null}
      </div>
      {!collapsed && tenant ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 10px 12px", marginTop: -4 }} title={tenant}>
          <span className="material-symbols-outlined" style={{ fontSize: 12, color: "var(--ink-muted)" }}>business</span>
          <span style={{ font: "600 11px var(--font-sans)", color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tenant}</span>
        </div>
      ) : null}
      {collapsed ? <button className="iconbtn" onClick={onToggle} title="Expand sidebar" style={{ alignSelf: "center", margin: "0 auto 8px", height: 24, width: 24, border: 0 }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span></button> : null}
      <Item id="dashboard" icon="dashboard" label="Overview" />
      <Item id="action" icon="priority_high" label="Action Required" badge={counts.action} />
      <Item id="invoices" icon="receipt_long" label="Invoices" />
      <Item id="vendors" icon="business" label="Vendors" />
      <Item id="payments" icon="payments" label="Payments" />
      <Section>Banking</Section>
      <Item id="recon" icon="account_balance" label="Reconciliation" />
      <Item id="statements" icon="description" label="Bank Statements" />
      <Section>Compliance</Section>
      <Item id="tds" icon="receipt" label="TDS Dashboard" />
      <Item id="exports" icon="cloud_upload" label="Tally Export" />
      <Item id="tallysync" icon="cable" label="Tally Sync" />
      <Item id="triage" icon="alt_route" label="Triage" badge={counts.triage} />
      <Section>Setup</Section>
      <Item id="mailboxes" icon="mail" label="Mailboxes" />
      <Item id="clients" icon="account_tree" label="Client Orgs" />
      <Item id="config" icon="tune" label="Config" />
    </aside>
  );
}
window.Sidebar = Sidebar;
