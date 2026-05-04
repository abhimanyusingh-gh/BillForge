// PlatformTenantsTable.jsx — denser cross-tenant table
//
// Sort is server-driven: the table is "dumb" — it renders rows in the order
// it gets them and forwards header clicks to the parent via onSort(col).
// The parent dispatches a fetch (here, a mocked latency) and feeds back
// `sort = { col, dir, loading }`. While loading, headers freeze (no clicks)
// and the active header shows a spinner; rows fade.
function PaSortHeader({ col, label, align, sort, onSort, sortable = true }) {
  const active = sort && sort.col === col;
  const dir = active ? sort.dir : null;
  const loading = active && sort.loading;
  const icon = !sortable ? null : loading ? "progress_activity" : !active ? "unfold_more" : dir === "asc" ? "arrow_upward" : "arrow_downward";
  return (
    <th
      className={"pa-th" + (sortable ? " sortable" : "") + (active ? " active" : "") + (loading ? " loading" : "")}
      style={{ textAlign: align || "left" }}
      onClick={() => sortable && !sort?.loading && onSort?.(col)}
      aria-sort={!active ? "none" : dir === "asc" ? "ascending" : "descending"}
    >
      <span className="pa-th-inner" style={{ justifyContent: align === "right" ? "flex-end" : "flex-start" }}>
        <span className="pa-th-label">{label}</span>
        {icon ? <span className={"material-symbols-outlined pa-th-icon" + (loading ? " spin" : "")}>{icon}</span> : null}
      </span>
    </th>
  );
}
window.PaSortHeader = PaSortHeader;

function PlatformTenantsTable({ tenants, selectedId, onSelect, onToggleEnabled, query, setQuery, filter, setFilter, sort, onSort }) {
  const filtered = tenants.filter(t => {
    if (filter === "active" && t.state !== "active") return false;
    if (filter === "trial" && t.state !== "trial") return false;
    if (filter === "disabled" && t.state !== "disabled") return false;
    if (filter === "alert" && t.failedDocs === 0 && t.bridge === "online" && t.mailFails === 0) return false;
    if (query && !t.name.toLowerCase().includes(query.toLowerCase()) && !t.owner.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });
  const fmt = (n) => n.toLocaleString("en-IN");
  const ActionCell = ({ t }) => (
    <span style={{ display: "inline-flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
      <button className="pa-btn pa-btn-ghost pa-btn-sm" title="Impersonate"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>support_agent</span></button>
      <button className="pa-btn pa-btn-ghost pa-btn-sm" title={t.state === "disabled" ? "Enable" : "Disable"} onClick={() => onToggleEnabled(t.id, t.state === "disabled")}>
        <span className="material-symbols-outlined" style={{ fontSize: 14, color: t.state === "disabled" ? "var(--emerald)" : "var(--warn)" }}>{t.state === "disabled" ? "play_arrow" : "pause"}</span>
      </button>
      <button className="pa-btn pa-btn-ghost pa-btn-sm" title="More"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>more_horiz</span></button>
    </span>
  );
  const sortLabel = sort ? `sorted by ${sort.col} · ${sort.dir}${sort.loading ? " · loading…" : ""}` : "default order";
  return (
    <div className="pa-card">
      <div className="pa-card-head">
        <span className="material-symbols-outlined" style={{ color: "var(--accent)" }}>groups</span>
        <h2>Tenants</h2>
        <span className="pa-card-sub">{filtered.length} of {tenants.length} · {sortLabel}</span>
        <div className="pa-card-tools">
          <div className="chips" style={{ margin: 0 }}>
            {[
              { id: "all", label: "All", n: tenants.length },
              { id: "active", label: "Active", n: tenants.filter(t=>t.state==="active").length },
              { id: "trial", label: "Trial", n: tenants.filter(t=>t.state==="trial").length },
              { id: "disabled", label: "Disabled", n: tenants.filter(t=>t.state==="disabled").length },
              { id: "alert", label: "Needs attention", n: tenants.filter(t=>t.failedDocs>0||t.bridge!=="online"||t.mailFails>0).length },
            ].map(c => (
              <button key={c.id} className={"chip" + (filter === c.id ? " active" : "")} onClick={() => setFilter(c.id)}>
                {c.label} <span className="num">{c.n}</span>
              </button>
            ))}
          </div>
          <div className="pa-search">
            <span className="material-symbols-outlined">search</span>
            <input placeholder="Filter by name or owner" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
        </div>
      </div>
      <div className={"pa-card-body flush" + (sort?.loading ? " pa-loading" : "")} style={{ overflow: "auto" }}>
        <table className="pa-tenants-table">
          <thead>
            <tr>
              <PaSortHeader col="name"        label="Tenant"      sort={sort} onSort={onSort} />
              <PaSortHeader col="plan"        label="Plan"        sort={sort} onSort={onSort} />
              <PaSortHeader col="seats"       label="Seats"       sort={sort} onSort={onSort} />
              <PaSortHeader col="clientOrgs"  label="Client orgs" sort={sort} onSort={onSort} />
              <PaSortHeader col="docsToday"   label="Docs · today" align="right" sort={sort} onSort={onSort} />
              <PaSortHeader col="failedDocs"  label="Failures"     align="right" sort={sort} onSort={onSort} />
              <PaSortHeader col="bridge"      label="Tally bridge" sort={sort} onSort={onSort} />
              <PaSortHeader col="mrr"         label="MRR"         sort={sort} onSort={onSort} />
              <PaSortHeader col="lastSeen"    label="Last seen"   sort={sort} onSort={onSort} />
              <PaSortHeader col="state"       label="State"       sort={sort} onSort={onSort} />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => {
              const initials = t.name.split(" ").slice(0,2).map(s=>s[0]).join("");
              const seatPct = (t.seatsUsed / t.seats) * 100;
              const seatBarCls = seatPct >= 100 ? "full" : seatPct >= 80 ? "warn" : "";
              return (
                <tr key={t.id} className={selectedId === t.id ? "row-active" : ""} onClick={() => onSelect(t.id)}>
                  <td>
                    <div className="pa-tenant-cell">
                      <div className="pa-tenant-avatar">{initials}</div>
                      <div style={{ minWidth: 0 }}>
                        <div className="pa-tenant-name">{t.name}</div>
                        <div className="pa-tenant-meta">{t.region} · {t.owner}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="mono-cell" style={{ color: "var(--ink-soft)" }}>{t.plan}</span></td>
                  <td>
                    <span className={"pa-mini-bar " + seatBarCls}><span style={{ width: Math.min(seatPct,100) + "%" }}></span></span>
                    <span className="mono-cell">{t.seatsUsed} / {t.seats}</span>
                  </td>
                  <td className="num-cell">{t.clientOrgs}</td>
                  <td className="num-cell">{fmt(t.docsToday)}</td>
                  <td className="num-cell" style={{ color: t.failedDocs > 0 ? "var(--warn)" : "var(--ink-muted)" }}>{t.failedDocs || "—"}</td>
                  <td>
                    <span className={"pa-bridge-" + t.bridge} style={{ font: "600 11px var(--font-mono)", textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 999, background: "currentColor" }} />{t.bridge}
                    </span>
                  </td>
                  <td className="num-cell">{t.mrr ? "₹ " + fmt(t.mrr) : <span style={{ color: "var(--ink-muted)" }}>—</span>}</td>
                  <td className="mono-cell" style={{ color: "var(--ink-soft)" }}>{t.lastSeen}</td>
                  <td>
                    <span className={"pa-state-pill pa-state-" + t.state}>
                      <span className="dot" />{t.state}
                    </span>
                  </td>
                  <td><ActionCell t={t} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 ? <div className="pa-empty">No tenants match the current filter.</div> : null}
        {sort?.loading ? (
          <div className="pa-fetch-overlay">
            <span className="material-symbols-outlined spin">progress_activity</span>
            Sorting on server by <b>{sort.col}</b> · {sort.dir === "asc" ? "ascending" : "descending"}
          </div>
        ) : null}
      </div>
    </div>
  );
}
window.PlatformTenantsTable = PlatformTenantsTable;

// PlatformActivityMonitor.jsx — combined audit + system feed
function PlatformActivityMonitor({ activity, scope }) {
  const [filter, setFilter] = React.useState("all");
  const filtered = activity.filter(a => {
    if (filter === "audit" && a.type !== "audit") return false;
    if (filter === "system" && a.type !== "system") return false;
    if (filter === "alerts" && a.sev !== "warning" && a.sev !== "critical") return false;
    return true;
  });
  const iconFor = (a) => {
    if (a.sev === "critical") return { cls: "critical", icon: "error" };
    if (a.sev === "warning")  return { cls: "warning", icon: "warning" };
    if (a.type === "audit")   return { cls: "audit-info", icon: "person" };
    return { cls: "system-info", icon: "settings" };
  };
  return (
    <div className="pa-card">
      <div className="pa-card-head">
        <span className="material-symbols-outlined" style={{ color: "var(--accent)" }}>schedule</span>
        <h2>Activity</h2>
        <span className="pa-card-sub">{scope || "all tenants"} · last 30 minutes</span>
        <div className="pa-card-tools">
          <div className="chips pa-activity-filters" style={{ margin: 0 }}>
            {[{id:"all",label:"All"},{id:"audit",label:"Audit"},{id:"system",label:"System"},{id:"alerts",label:"Alerts"}].map(f => (
              <button key={f.id} className={"chip" + (filter === f.id ? " active" : "")} onClick={() => setFilter(f.id)}>{f.label}</button>
            ))}
          </div>
          <button className="pa-btn pa-btn-ghost pa-btn-sm"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span></button>
        </div>
      </div>
      <div className="pa-card-body flush">
        <div className="pa-activity">
          {filtered.map((a, i) => {
            const { cls, icon } = iconFor(a);
            return (
              <div key={i} className="pa-activity-row">
                <div className="pa-activity-time">{a.ts}</div>
                <div className={"pa-activity-icon " + cls}><span className="material-symbols-outlined">{icon}</span></div>
                <div className="pa-activity-body">
                  {a.tenant ? <span className="pa-activity-tenant">{a.tenant}</span> : <span className="pa-activity-tenant" style={{ color: "var(--ink-muted)" }}>System</span>}
                  <span className="pa-activity-msg">{a.msg}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
window.PlatformActivityMonitor = PlatformActivityMonitor;

// PlatformFailedDocs.jsx — failed-documents queue
function PlatformFailedDocs({ docs, sort, onSort }) {
  const sortLabel = sort ? `sorted by ${sort.col} · ${sort.dir}${sort.loading ? " · loading…" : ""}` : "";
  return (
    <div className="pa-card">
      <div className="pa-card-head">
        <span className="material-symbols-outlined" style={{ color: "var(--warn)" }}>error</span>
        <h2>Failed documents</h2>
        <span className="pa-card-sub">{docs.length} stuck across all tenants{sortLabel ? " · " + sortLabel : ""}</span>
        <div className="pa-card-tools">
          <button className="pa-btn pa-btn-sm"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span> Retry all</button>
        </div>
      </div>
      <div className={"pa-card-body flush" + (sort?.loading ? " pa-loading" : "")} style={{ overflow: "auto", position: "relative" }}>
        <table className="pa-tenants-table pa-failed-table">
          <thead>
            <tr>
              <th style={{ width: 24 }}></th>
              <PaSortHeader col="file"    label="File"     sort={sort} onSort={onSort} />
              <PaSortHeader col="tenant"  label="Tenant"   sort={sort} onSort={onSort} />
              <PaSortHeader col="realm"   label="Client org" sort={sort} onSort={onSort} />
              <PaSortHeader col="reason"  label="Reason"   sort={sort} onSort={onSort} />
              <PaSortHeader col="stage"   label="Stage"    sort={sort} onSort={onSort} />
              <PaSortHeader col="age"     label="Age"      align="right" sort={sort} onSort={onSort} />
              <PaSortHeader col="retries" label="Retries"  align="right" sort={sort} onSort={onSort} />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {docs.map(d => (
              <tr key={d.id}>
                <td><span className="material-symbols-outlined" style={{ color: "var(--warn)", fontSize: 18 }}>description</span></td>
                <td>
                  <div style={{ font: "600 12.5px var(--font-sans)", color: "var(--ink)" }}>{d.file}</div>
                  <div className="mono-cell" style={{ color: "var(--ink-muted)" }}>{d.id}</div>
                </td>
                <td><span style={{ font: "600 12px var(--font-sans)", color: "var(--ink)" }}>{d.tenant}</span></td>
                <td><span className="mono-cell" style={{ color: "var(--ink-soft)" }}>{d.realm}</span></td>
                <td><span style={{ font: "500 12px var(--font-sans)", color: "var(--ink-soft)" }}>{d.reason}</span></td>
                <td><span className={"stage-pill " + d.stage}>{d.stage}</span></td>
                <td className="mono-cell" style={{ color: "var(--ink-muted)", textAlign: "right" }}>{d.age}</td>
                <td className="mono-cell" style={{ color: d.retries >= 2 ? "var(--warn)" : "var(--ink-soft)", textAlign: "right" }}>{d.retries}×</td>
                <td>
                  <span style={{ display: "inline-flex", gap: 4 }}>
                    <button className="pa-btn pa-btn-sm">Retry</button>
                    <button className="pa-btn pa-btn-ghost pa-btn-sm" title="Open"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span></button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sort?.loading ? (
          <div className="pa-fetch-overlay">
            <span className="material-symbols-outlined spin">progress_activity</span>
            Sorting on server by <b>{sort.col}</b> · {sort.dir === "asc" ? "ascending" : "descending"}
          </div>
        ) : null}
      </div>
    </div>
  );
}
window.PlatformFailedDocs = PlatformFailedDocs;

// PlatformTenantDetail.jsx — slide-over with privileged actions
function PlatformTenantDetail({ tenant, onClose, onToggleEnabled }) {
  if (!tenant) return null;
  const fmt = (n) => n.toLocaleString("en-IN");
  return (
    <div className="pa-slideover-scrim" onClick={onClose}>
      <div className="pa-slideover" onClick={e => e.stopPropagation()}>
        <div className="pa-slideover-head">
          <div className="pa-tenant-avatar" style={{ width: 36, height: 36, borderRadius: 8, fontSize: 13 }}>{tenant.name.split(" ").slice(0,2).map(s=>s[0]).join("")}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>{tenant.name}</h2>
            <div className="pa-slideover-sub">{tenant.region} · Practice ID PCA-{tenant.id.toUpperCase()}-091 · signed up {tenant.signedUp}</div>
          </div>
          <span className={"pa-state-pill pa-state-" + tenant.state}><span className="dot" />{tenant.state}</span>
          <button className="iconbtn" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="pa-slideover-body">
          <div className="pa-detail-grid">
            <div className="pa-detail-cell"><div className="label">Owner</div><div className="value" style={{ fontFamily: "var(--font-sans)" }}>{tenant.owner}</div><div style={{ font: "500 11px var(--font-mono)", color: "var(--ink-soft)" }}>{tenant.ownerEmail}</div></div>
            <div className="pa-detail-cell"><div className="label">Plan · seats</div><div className="value">{tenant.plan} · {tenant.seatsUsed} / {tenant.seats}</div></div>
            <div className="pa-detail-cell"><div className="label">MRR</div><div className="value">{tenant.mrr ? "₹ " + fmt(tenant.mrr) : "—"}</div></div>
            <div className="pa-detail-cell"><div className="label">Client orgs</div><div className="value">{tenant.clientOrgs}</div></div>
            <div className="pa-detail-cell"><div className="label">Docs · today / 7d</div><div className="value">{fmt(tenant.docsToday)} <span style={{ color: "var(--ink-muted)" }}>/ {fmt(tenant.docs7)}</span></div></div>
            <div className="pa-detail-cell"><div className="label">Failed · today</div><div className="value" style={{ color: tenant.failedDocs > 0 ? "var(--warn)" : "var(--ink)" }}>{tenant.failedDocs || "0"}</div></div>
            <div className="pa-detail-cell"><div className="label">Tally bridge</div><div className={"value pa-bridge-" + tenant.bridge} style={{ textTransform: "uppercase" }}>● {tenant.bridge}</div></div>
            <div className="pa-detail-cell"><div className="label">Mailbox failures</div><div className="value" style={{ color: tenant.mailFails > 0 ? "var(--amber)" : "var(--ink)" }}>{tenant.mailFails || "0"}</div></div>
            <div className="pa-detail-cell"><div className="label">Last activity</div><div className="value" style={{ fontFamily: "var(--font-sans)" }}>{tenant.lastSeen}</div></div>
          </div>

          <div className="pa-section-h">Privileged actions</div>
          {[
            { icon: "support_agent", title: "Impersonate tenant admin", sub: "Sign in as " + tenant.owner + " for support. Action is logged.", btn: "Impersonate" },
            { icon: "cable", title: "Force re-sync Tally bridge", sub: "Re-poll AlterID and reconcile last 50 vouchers.", btn: "Re-sync" },
            { icon: "lock_reset", title: "Reset admin password", sub: "Generate temp password and email " + tenant.ownerEmail + ".", btn: "Reset" },
            { icon: "tune", title: "Adjust subscription / seats", sub: "Currently " + tenant.plan + " · " + tenant.seats + " seats.", btn: "Adjust" },
          ].map((a, i) => (
            <div key={i} className="pa-action-row">
              <span className="pa-action-icon"><span className="material-symbols-outlined" style={{ fontSize: 16 }}>{a.icon}</span></span>
              <div className="pa-action-body">
                <div className="pa-action-title">{a.title}</div>
                <div className="pa-action-sub">{a.sub}</div>
              </div>
              <button className="pa-btn pa-btn-sm">{a.btn}</button>
            </div>
          ))}
          <div className="pa-action-row danger">
            <span className="pa-action-icon"><span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete_forever</span></span>
            <div className="pa-action-body">
              <div className="pa-action-title">Hard-delete tenant</div>
              <div className="pa-action-sub">Removes all client orgs, invoices, vouchers, and audit log. Irreversible. Requires typed confirmation.</div>
            </div>
            <button className="pa-btn pa-btn-sm pa-btn-danger">Delete…</button>
          </div>

          <div className="pa-section-h">Recent activity</div>
          <div className="pa-card" style={{ margin: 0 }}>
            <div className="pa-card-body flush">
              {window.PA_ACTIVITY.filter(a => a.tenant === tenant.name.split(",")[0] || (tenant.name.startsWith(a.tenant || "")) || (a.tenant && tenant.name.startsWith(a.tenant.split(" ")[0]))).slice(0, 5).concat([{ ts: "10:21:35", type: "audit", sev: "info", tenant: tenant.name, msg: "Sign-in from " + tenant.region }]).slice(0, 6).map((a, i) => (
                <div key={i} className="pa-activity-row">
                  <div className="pa-activity-time">{a.ts}</div>
                  <div className={"pa-activity-icon " + (a.sev === "critical" ? "critical" : a.sev === "warning" ? "warning" : a.type === "audit" ? "audit-info" : "system-info")}>
                    <span className="material-symbols-outlined">{a.sev === "critical" ? "error" : a.sev === "warning" ? "warning" : a.type === "audit" ? "person" : "settings"}</span>
                  </div>
                  <div className="pa-activity-body"><span className="pa-activity-msg">{a.msg}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="pa-slideover-foot">
          <button className="pa-btn pa-btn-ghost" onClick={onClose}>Close</button>
          <span style={{ flex: 1 }} />
          <button className="pa-btn" onClick={() => onToggleEnabled(tenant.id, tenant.state === "disabled")}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{tenant.state === "disabled" ? "play_arrow" : "pause"}</span>
            {tenant.state === "disabled" ? "Enable tenant" : "Disable tenant"}
          </button>
          <button className="pa-btn pa-btn-primary"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span> Open tenant workspace</button>
        </div>
      </div>
    </div>
  );
}
window.PlatformTenantDetail = PlatformTenantDetail;
