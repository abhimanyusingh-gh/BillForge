// PlatformAdminApp.jsx — composes the platform admin console
//
// Server-driven sort: each table owns a `sort = { col, dir, loading }` and
// exposes `onSort(col)`. We dispatch a fake fetch (setTimeout) that flips
// `loading=true`, sorts the dataset on the "server", then commits the new
// order. Real backend would replace `runServerSort` with an HTTP request:
//   GET /platform/tenants?sort=docsToday&dir=desc
function useServerSort(initialCol, initialDir, dataset, comparators) {
  const [sort, setSort] = React.useState({ col: initialCol, dir: initialDir, loading: false });
  const [rows, setRows] = React.useState(() => runServerSort(dataset, initialCol, initialDir, comparators));
  const lastTokenRef = React.useRef(0);

  // Re-sort whenever the source dataset changes (e.g. enable/disable a tenant)
  React.useEffect(() => {
    setRows(runServerSort(dataset, sort.col, sort.dir, comparators));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset]);

  const onSort = React.useCallback((col) => {
    setSort(s => {
      const dir = s.col === col ? (s.dir === "asc" ? "desc" : "asc") : (col === "name" || col === "tenant" || col === "file" || col === "realm" || col === "reason" || col === "stage" || col === "lastSeen" ? "asc" : "desc");
      const next = { col, dir, loading: true };
      const token = ++lastTokenRef.current;
      // mock backend latency
      setTimeout(() => {
        if (lastTokenRef.current !== token) return;
        setRows(runServerSort(dataset, col, dir, comparators));
        setSort({ col, dir, loading: false });
      }, 480);
      return next;
    });
  }, [dataset, comparators]);

  return [rows, sort, onSort];
}
function runServerSort(rows, col, dir, comparators) {
  const cmp = comparators[col] || ((a, b) => String(a[col] ?? "").localeCompare(String(b[col] ?? "")));
  const out = [...rows].sort(cmp);
  if (dir === "desc") out.reverse();
  return out;
}

const PA_TENANT_COMPARATORS = {
  name:       (a, b) => a.name.localeCompare(b.name),
  plan:       (a, b) => a.plan.localeCompare(b.plan) || a.seats - b.seats,
  seats:      (a, b) => (a.seatsUsed / a.seats) - (b.seatsUsed / b.seats) || a.seats - b.seats,
  clientOrgs: (a, b) => a.clientOrgs - b.clientOrgs,
  docsToday:  (a, b) => a.docsToday - b.docsToday,
  failedDocs: (a, b) => a.failedDocs - b.failedDocs,
  bridge:     (a, b) => ({ online: 0, lagging: 1, offline: 2 }[a.bridge] - { online: 0, lagging: 1, offline: 2 }[b.bridge]),
  mrr:        (a, b) => a.mrr - b.mrr,
  lastSeen:   (a, b) => a.lastSeen.localeCompare(b.lastSeen),
  state:      (a, b) => a.state.localeCompare(b.state),
};
const PA_FAILED_COMPARATORS = {
  file:    (a, b) => a.file.localeCompare(b.file),
  tenant:  (a, b) => a.tenant.localeCompare(b.tenant),
  realm:   (a, b) => a.realm.localeCompare(b.realm),
  reason:  (a, b) => a.reason.localeCompare(b.reason),
  stage:   (a, b) => a.stage.localeCompare(b.stage),
  age:     (a, b) => parseInt(a.age, 10) - parseInt(b.age, 10),
  retries: (a, b) => a.retries - b.retries,
};

function PlatformAdminApp({ onSwitchToTenant, dark, onToggleTheme }) {
  const [tab, setTab] = React.useState("dashboard");
  const [selectedId, setSelectedId] = React.useState(null);
  const [tenants, setTenants] = React.useState(window.PA_TENANTS);
  const [success, setSuccess] = React.useState(null);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState("all");

  const [tenantRows,  tenantSort,  onTenantSort]  = useServerSort("docsToday", "desc", tenants,             PA_TENANT_COMPARATORS);
  const [failedRows,  failedSort,  onFailedSort]  = useServerSort("age",       "desc", window.PA_FAILED_DOCS, PA_FAILED_COMPARATORS);

  const counts = {
    tenants: tenants.length,
    failedDocuments: window.PA_FAILED_DOCS.length,
  };
  const selected = tenants.find(t => t.id === selectedId);
  const onToggleEnabled = (id, enable) =>
    setTenants(ts => ts.map(t => t.id === id ? { ...t, state: enable ? "active" : "disabled" } : t));

  return (
    <div className="pa-shell" data-screen-label={"Platform admin · " + tab}>
      <PlatformAdminTopNav activeTab={tab} onTabChange={setTab} counts={counts} onSwitchToTenant={onSwitchToTenant} dark={dark} onToggleTheme={onToggleTheme} />
      <main className="pa-main">
        {tab === "dashboard" && (
          <>
            <PlatformKpis tenants={tenants} />
            <div className="pa-row-grid">
              <div className="pa-card">
                <div className="pa-card-head">
                  <span className="material-symbols-outlined" style={{ color: "var(--accent)" }}>insights</span>
                  <h2>Documents processed · 14 days</h2>
                  <span className="pa-card-sub">across all tenants</span>
                </div>
                <div className="pa-card-body">
                  <PlatformChart docs={window.PA_DOCS_14D} fails={window.PA_FAIL_14D} />
                </div>
              </div>
              <PlatformActivityMonitor activity={window.PA_ACTIVITY.slice(0, 8)} scope="all tenants" />
            </div>
            <PlatformTenantsTable tenants={tenantRows} selectedId={selectedId} onSelect={setSelectedId} onToggleEnabled={onToggleEnabled} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} sort={tenantSort} onSort={onTenantSort} />
          </>
        )}
        {tab === "tenants" && (
          <PlatformTenantsTable tenants={tenantRows} selectedId={selectedId} onSelect={setSelectedId} onToggleEnabled={onToggleEnabled} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} sort={tenantSort} onSort={onTenantSort} />
        )}
        {tab === "failed" && (
          <PlatformFailedDocs docs={failedRows} sort={failedSort} onSort={onFailedSort} />
        )}
        {tab === "activity" && (
          <PlatformActivityMonitor activity={window.PA_ACTIVITY} scope="all tenants" />
        )}
        {tab === "onboard" && (
          <PlatformOnboardSection inline success={success} onCreated={setSuccess} onDismissSuccess={() => setSuccess(null)} />
        )}
      </main>
      {selected ? <PlatformTenantDetail tenant={selected} onClose={() => setSelectedId(null)} onToggleEnabled={onToggleEnabled} /> : null}
    </div>
  );
}
window.PlatformAdminApp = PlatformAdminApp;
