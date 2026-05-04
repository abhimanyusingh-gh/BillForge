// Dashboard.jsx — overview / amiss-first dashboard for the Action Required clerk
//
// FILTER POPUP
// ------------
// The "tune" icon in the page header opens <DashboardFilterPopup>, which scopes
// the dashboard by client org (multi-select), period (FY + month picker), risk
// severity, and amount band. Active filters apply to ALL panels: KPI tiles,
// amiss list, sparkline, TDS breakdown, recent activity. Filter state persists
// to sessionStorage under "dash:filter" so it survives reload.
const DEFAULT_DASH_FILTER = {
  orgs: ["Sundaram Textiles Pvt Ltd"], // primary client org pre-selected
  fy: "FY 2025-26",
  months: ["Apr"],   // [] means all months in the FY
  severity: "all",   // all | critical | warning | normal
  statuses: ["needs_review", "awaiting_approval", "approved", "exported"],
  minAmount: 0,
  maxAmount: 0,      // 0 = no cap
};
function loadDashFilter() {
  try {
    const raw = sessionStorage.getItem("dash:filter");
    return raw ? { ...DEFAULT_DASH_FILTER, ...JSON.parse(raw) } : DEFAULT_DASH_FILTER;
  } catch (e) { return DEFAULT_DASH_FILTER; }
}
function saveDashFilter(f) {
  try { sessionStorage.setItem("dash:filter", JSON.stringify(f)); } catch (e) {}
}
function dashFilterCount(f) {
  let n = 0;
  if (f.orgs.length !== DEFAULT_DASH_FILTER.orgs.length || !f.orgs.every(o => DEFAULT_DASH_FILTER.orgs.includes(o))) n++;
  if (f.fy !== DEFAULT_DASH_FILTER.fy) n++;
  if (f.months.length !== DEFAULT_DASH_FILTER.months.length || !f.months.every(m => DEFAULT_DASH_FILTER.months.includes(m))) n++;
  if (f.severity !== "all") n++;
  if (f.statuses.length !== 4) n++;
  if (f.minAmount > 0 || f.maxAmount > 0) n++;
  return n;
}

// Apply filter to the invoice array. The Dashboard mock data doesn't have a
// `clientOrg` field per row — we treat orgs as informational and mostly filter
// on month + severity + status + amount.
function applyDashFilter(invoices, f) {
  return invoices.filter(r => {
    if (f.statuses.length && !f.statuses.includes(r.status)) return false;
    if (f.severity !== "all" && r.severity !== f.severity) return false;
    if (f.minAmount > 0 && r.net < f.minAmount) return false;
    if (f.maxAmount > 0 && r.net > f.maxAmount) return false;
    if (f.months && f.months.length > 0) {
      // r.date is "DD-MMM-YYYY"; pull the month token
      const m = String(r.date || "").match(/-([A-Za-z]{3})-/);
      if (m && !f.months.includes(m[1])) return false;
    }
    return true;
  });
}

const ALL_ORGS = [
  "Sundaram Textiles Pvt Ltd",
  "Hari Vishnu Industries",
  "Coastal Aqua Exports LLP",
  "Madurai Sweets & Snacks",
  "Innova Software Solutions",
  "Patel & Patel Logistics",
];
const ALL_MONTHS = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];
const FY_OPTIONS = ["FY 2025-26", "FY 2024-25", "FY 2023-24"];
const STATUS_OPTIONS = [
  { id: "needs_review",      label: "Needs review",      color: "var(--warn)" },
  { id: "awaiting_approval", label: "Awaiting approval", color: "#7c3aed" },
  { id: "approved",          label: "Approved",          color: "var(--accent)" },
  { id: "exported",          label: "Exported",          color: "var(--emerald)" },
];
const SEVERITY_OPTIONS = [
  { id: "all",      label: "Any" },
  { id: "critical", label: "Critical" },
  { id: "warning",  label: "Warning" },
  { id: "normal",   label: "Normal" },
];

function DashboardFilterPopup({ open, onClose, value, onChange, anchorRef }) {
  const popRef = React.useRef(null);
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => { if (open) setDraft(value); }, [open, value]);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (popRef.current && !popRef.current.contains(e.target) && !anchorRef?.current?.contains(e.target)) onClose();
    };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open, onClose, anchorRef]);
  if (!open) return null;

  const toggleOrg  = (o) => setDraft(d => ({ ...d, orgs: d.orgs.includes(o) ? d.orgs.filter(x => x !== o) : [...d.orgs, o] }));
  const toggleMonth = (m) => setDraft(d => ({ ...d, months: d.months.includes(m) ? d.months.filter(x => x !== m) : [...d.months, m] }));
  const toggleStatus = (s) => setDraft(d => ({ ...d, statuses: d.statuses.includes(s) ? d.statuses.filter(x => x !== s) : [...d.statuses, s] }));

  const apply = () => { onChange(draft); onClose(); };
  const reset = () => setDraft(DEFAULT_DASH_FILTER);

  return (
    <div className="dash-filter-pop" ref={popRef} role="dialog" aria-label="Filter overview">
      <div className="dash-filter-head">
        <span className="material-symbols-outlined" style={{ color: "var(--accent)" }}>tune</span>
        <h3>Filter overview</h3>
        <button className="iconbtn" onClick={onClose} title="Close (Esc)" style={{ marginLeft: "auto" }}>
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <div className="dash-filter-body">
        {/* Client orgs */}
        <section>
          <div className="dash-filter-label">
            <span>Client organizations</span>
            <span className="dash-filter-meta">{draft.orgs.length} of {ALL_ORGS.length} selected</span>
          </div>
          <div className="dash-filter-row" style={{ marginBottom: 6 }}>
            <button className="tq-btn ghost" type="button" onClick={() => setDraft(d => ({ ...d, orgs: [...ALL_ORGS] }))}>Select all</button>
            <button className="tq-btn ghost" type="button" onClick={() => setDraft(d => ({ ...d, orgs: [] }))}>Clear</button>
          </div>
          <div className="dash-checks">
            {ALL_ORGS.map(o => {
              const on = draft.orgs.includes(o);
              return (
                <label key={o} className={"dash-check" + (on ? " on" : "")}>
                  <input type="checkbox" checked={on} onChange={() => toggleOrg(o)} />
                  <span className="dash-check-dot" />
                  <span className="dash-check-text">{o}</span>
                </label>
              );
            })}
          </div>
        </section>

        {/* Period */}
        <section>
          <div className="dash-filter-label">
            <span>Period</span>
            <span className="dash-filter-meta">{draft.months.length === 0 ? "Whole FY" : draft.months.length === 1 ? draft.months[0] : draft.months.length + " months"}</span>
          </div>
          <div className="dash-filter-row">
            <select className="dash-select" value={draft.fy} onChange={e => setDraft(d => ({ ...d, fy: e.target.value }))}>
              {FY_OPTIONS.map(fy => <option key={fy}>{fy}</option>)}
            </select>
            <button className="tq-btn ghost" type="button" onClick={() => setDraft(d => ({ ...d, months: [] }))}>Whole FY</button>
            <button className="tq-btn ghost" type="button" onClick={() => setDraft(d => ({ ...d, months: ["Apr","May","Jun"] }))}>Q1</button>
            <button className="tq-btn ghost" type="button" onClick={() => setDraft(d => ({ ...d, months: ["Jul","Aug","Sep"] }))}>Q2</button>
          </div>
          <div className="dash-month-grid">
            {ALL_MONTHS.map(m => {
              const on = draft.months.includes(m);
              return (
                <button key={m} type="button" className={"dash-month" + (on ? " on" : "")} onClick={() => toggleMonth(m)}>{m}</button>
              );
            })}
          </div>
        </section>

        {/* Status + severity row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <section>
            <div className="dash-filter-label"><span>Status</span></div>
            <div className="dash-checks">
              {STATUS_OPTIONS.map(s => {
                const on = draft.statuses.includes(s.id);
                return (
                  <label key={s.id} className={"dash-check" + (on ? " on" : "")}>
                    <input type="checkbox" checked={on} onChange={() => toggleStatus(s.id)} />
                    <span className="dash-check-dot" style={on ? { background: s.color, borderColor: s.color } : null} />
                    <span className="dash-check-text">{s.label}</span>
                  </label>
                );
              })}
            </div>
          </section>
          <section>
            <div className="dash-filter-label"><span>Severity</span></div>
            <div className="dash-seg">
              {SEVERITY_OPTIONS.map(s => (
                <button key={s.id} type="button" className={"dash-seg-btn" + (draft.severity === s.id ? " on" : "")} onClick={() => setDraft(d => ({ ...d, severity: s.id }))}>{s.label}</button>
              ))}
            </div>
          </section>
        </div>

        {/* Amount range */}
        <section>
          <div className="dash-filter-label">
            <span>Net amount</span>
            <span className="dash-filter-meta">{draft.minAmount > 0 || draft.maxAmount > 0 ? "₹" + (draft.minAmount || 0).toLocaleString("en-IN") + " – " + (draft.maxAmount > 0 ? "₹" + draft.maxAmount.toLocaleString("en-IN") : "no cap") : "Any amount"}</span>
          </div>
          <div className="dash-amount-row">
            <label className="dash-amount">
              <span>Min ₹</span>
              <input type="number" min="0" value={draft.minAmount || ""} onChange={e => setDraft(d => ({ ...d, minAmount: parseInt(e.target.value || "0", 10) }))} placeholder="0" />
            </label>
            <span className="dash-amount-dash">—</span>
            <label className="dash-amount">
              <span>Max ₹</span>
              <input type="number" min="0" value={draft.maxAmount || ""} onChange={e => setDraft(d => ({ ...d, maxAmount: parseInt(e.target.value || "0", 10) }))} placeholder="No cap" />
            </label>
          </div>
        </section>
      </div>

      <div className="dash-filter-foot">
        <button className="tq-btn ghost" type="button" onClick={reset}>
          <span className="material-symbols-outlined">restart_alt</span>
          Reset to default
        </button>
        <div style={{ flex: 1 }} />
        <button className="tq-btn ghost" type="button" onClick={onClose}>Cancel</button>
        <button className="tq-btn primary" type="button" onClick={apply}>
          <span className="material-symbols-outlined">check</span>
          Apply
        </button>
      </div>
    </div>
  );
}

function Dashboard({ onNavigate }) {
  const inv = window.INVOICES;
  const fmt = window.inrFmt;
  const [filter, setFilter] = React.useState(loadDashFilter);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const filterBtnRef = React.useRef(null);

  React.useEffect(() => { saveDashFilter(filter); }, [filter]);
  const filterN = dashFilterCount(filter);

  // Apply filter
  const filteredInv = React.useMemo(() => applyDashFilter(inv, filter), [inv, filter]);

  const needs    = filteredInv.filter(i => i.status === "needs_review").length;
  const await_   = filteredInv.filter(i => i.status === "awaiting_approval").length;
  const approved = filteredInv.filter(i => i.status === "approved").length;
  const exported = filteredInv.filter(i => i.status === "exported").length;
  const totalNet = filteredInv.reduce((s, i) => s + i.net, 0);
  const tdsTotal = filteredInv.reduce((s, i) => s + i.tds, 0);
  const stuck    = filteredInv.filter(i => i.age >= 5 && i.status !== "exported");
  const critical = filteredInv.filter(i => i.severity === "critical");

  const Tile = ({ title, value, sub, accent, onClick }) => (
    <button onClick={onClick} style={{ textAlign: "left", flex: 1, background: "var(--bg-panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "14px 16px", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ font: "700 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".1em", color: "var(--ink-soft)" }}>{title}</div>
      <div style={{ font: "700 24px var(--font-mono)", fontVariantNumeric: "tabular-nums", color: accent || "var(--ink)", marginTop: 4, letterSpacing: "-.01em" }}>{value}</div>
      <div style={{ font: "500 11px var(--font-sans)", color: "var(--ink-soft)", marginTop: 2 }}>{sub}</div>
    </button>
  );

  const series = [3,4,2,5,7,4,6,8,5,9,7,11,8,12];
  const max = Math.max(...series);

  // Header subtitle reflects filter
  const headerScope = (() => {
    const orgPart = filter.orgs.length === 0 ? "No client" : filter.orgs.length === 1 ? filter.orgs[0].replace(/ Pvt Ltd$| LLP$/, "") : filter.orgs.length + " client orgs";
    const monthPart = filter.months.length === 0 ? "Whole FY" : filter.months.length === 1 ? filter.months[0] : filter.months.length + " months";
    return orgPart + " · " + filter.fy + " · " + monthPart;
  })();

  return (
    <div>
      <div className="page-header" style={{ position: "relative" }}>
        <h1>Overview</h1>
        <span className="count">{headerScope}</span>
        <div className="page-tools">
          <button
            ref={filterBtnRef}
            className={"iconbtn dash-filter-btn" + (filterOpen ? " open" : "") + (filterN > 0 ? " filtered" : "")}
            onClick={() => setFilterOpen(o => !o)}
            title="Filter overview"
          >
            <span className="material-symbols-outlined">tune</span>
            {filterN > 0 ? <span className="dash-filter-badge">{filterN}</span> : null}
          </button>
          <DashboardFilterPopup open={filterOpen} onClose={() => setFilterOpen(false)} value={filter} onChange={setFilter} anchorRef={filterBtnRef} />
        </div>
      </div>

      {filterN > 0 ? (
        <div className="dash-filter-summary">
          <span className="material-symbols-outlined">filter_alt</span>
          <span><b>{filterN}</b> filter{filterN === 1 ? "" : "s"} active · showing <b>{filteredInv.length}</b> of {inv.length} invoices</span>
          {filter.severity !== "all" ? <span className="dash-chip">severity: {filter.severity}</span> : null}
          {filter.minAmount > 0 || filter.maxAmount > 0 ? <span className="dash-chip">net ≥ ₹{filter.minAmount.toLocaleString("en-IN")}{filter.maxAmount > 0 ? " ≤ ₹" + filter.maxAmount.toLocaleString("en-IN") : ""}</span> : null}
          {filter.statuses.length !== 4 ? <span className="dash-chip">{filter.statuses.length} status{filter.statuses.length === 1 ? "" : "es"}</span> : null}
          <button type="button" className="tq-link" style={{ marginLeft: "auto" }} onClick={() => setFilter(DEFAULT_DASH_FILTER)}>Reset</button>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <Tile title="Needs review" value={needs} sub={needs ? "Walk queue · J / K" : "Inbox zero"} accent="var(--warn)" onClick={() => onNavigate("action")} />
        <Tile title="Awaiting approval" value={await_} sub="With Mahir Khan, CA" accent="#7c3aed" onClick={() => onNavigate("action")} />
        <Tile title="Ready to export" value={approved} sub="One click → Tally" accent="var(--accent)" onClick={() => onNavigate("exports")} />
        <Tile title="Exported · MTD" value={fmt(exported * 318600000)} sub={`${exported} vouchers · 1 batch`} onClick={() => onNavigate("exports")} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>
        {/* Amiss panel */}
        <div className="section" style={{ marginTop: 0 }}>
          <div className="stitle"><h3>What needs your attention</h3><span className="lb-caption">amiss-first · {critical.length + stuck.length} items</span></div>

          {critical.length === 0 && stuck.length === 0 ? (
            <div style={{ padding: "24px 14px", textAlign: "center", color: "var(--ink-soft)", font: "500 12.5px var(--font-sans)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 32, color: "var(--emerald)", display: "block", marginBottom: 6 }}>check_circle</span>
              Nothing flagged in this scope.
            </div>
          ) : null}

          {critical.map(c => (
            <div key={c.id} className="risk-row critical" onClick={() => onNavigate("invoices", c.id)} style={{ cursor: "pointer" }}>
              <span className="icon"><span className="material-symbols-outlined">priority_high</span></span>
              <div className="body">
                <div className="risk-code">{c.vendor} · {c.number}</div>
                <div className="risk-msg">{c.hint} · {fmt(c.net)}</div>
              </div>
              <span className="lb-mono" style={{ color: "var(--ink-muted)", fontSize: 11 }}>{c.age}d</span>
            </div>
          ))}
          {stuck.filter(s => !critical.find(c => c.id === s.id)).map(s => (
            <div key={s.id} className="risk-row warning" onClick={() => onNavigate("invoices", s.id)} style={{ cursor: "pointer" }}>
              <span className="icon"><span className="material-symbols-outlined">hourglass_empty</span></span>
              <div className="body">
                <div className="risk-code">Stuck {s.age} days · {s.vendor}</div>
                <div className="risk-msg">{s.hint}</div>
              </div>
              <span className="lb-mono" style={{ color: "var(--ink-muted)", fontSize: 11 }}>{fmt(s.net)}</span>
            </div>
          ))}
          {filterN === 0 ? (
            <div className="risk-row info">
              <span className="icon"><span className="material-symbols-outlined">cable</span></span>
              <div className="body">
                <div className="risk-code">Tally bridge AlterID lag</div>
                <div className="risk-msg">Last poll 4m ago — pre-export check will warn until refreshed.</div>
              </div>
              <button className="iconbtn" style={{ height: 26, width: 26 }} onClick={() => onNavigate("tallysync")}><span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span></button>
            </div>
          ) : null}
        </div>

        {/* Right column: cashflow + TDS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="section" style={{ marginTop: 0 }}>
            <div className="stitle"><h3>Net payable · 14 days</h3><span className="lb-caption">{fmt(totalNet)}</span></div>
            <svg viewBox="0 0 280 70" width="100%" height="70" preserveAspectRatio="none">
              {series.map((v, i) => {
                const w = 280 / series.length - 4;
                const h = (v / max) * 60;
                const x = i * (280 / series.length) + 2;
                const y = 65 - h;
                const last = i === series.length - 1;
                return <rect key={i} x={x} y={y} width={w} height={h} rx="2" fill={last ? "var(--accent)" : "rgba(17,82,212,.30)"} />;
              })}
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", font: "500 10px var(--font-mono)", color: "var(--ink-muted)", marginTop: 4 }}>
              <span>01 Apr</span><span>14 Apr</span>
            </div>
          </div>

          <div className="section">
            <div className="stitle"><h3>TDS deducted · MTD</h3><span className="lb-caption">{fmt(tdsTotal)}</span></div>
            {[
              { sec: "194J", val: 49404000, pct: 78 },
              { sec: "194C", val: 196800, pct: 12 },
              { sec: "194Q", val: 122400, pct: 4 },
            ].map(b => (
              <div key={b.sec} style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", font: "500 11px var(--font-sans)", color: "var(--ink-soft)" }}>
                  <span><b style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>{b.sec}</b> · {b.pct}%</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink)" }}>{fmt(b.val)}</span>
                </div>
                <div style={{ marginTop: 3, height: 5, background: "var(--bg-sunken)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ width: b.pct + "%", height: "100%", background: "var(--accent)" }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="section">
        <div className="stitle"><h3>Recent activity</h3><span className="lb-caption">last 24h</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <div style={{ font: "500 12px var(--font-sans)", color: "var(--ink-soft)" }}>09:14 — Ingested 12 invoices from <b style={{ color: "var(--ink)" }}>ap@sundaram.in</b></div>
          <div style={{ font: "500 12px var(--font-sans)", color: "var(--ink-soft)" }}>11:02 — Sneha Iyer reviewed <b style={{ color: "var(--ink)" }}>RJIL-92834</b></div>
          <div style={{ font: "500 12px var(--font-sans)", color: "var(--ink-soft)" }}>14:08 — Mahir Khan, CA approved <b style={{ color: "var(--ink)" }}>AP-INV-22041</b></div>
          <div style={{ font: "500 12px var(--font-sans)", color: "var(--ink-soft)" }}>17:32 — Exported batch <b style={{ color: "var(--ink)" }}>B-2604-014</b> · 12 vouchers</div>
        </div>
      </div>
    </div>
  );
}
window.Dashboard = Dashboard;
