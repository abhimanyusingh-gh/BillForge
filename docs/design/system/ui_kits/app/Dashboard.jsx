// Dashboard.jsx — overview / amiss-first dashboard for the Action Required clerk
function Dashboard({ onNavigate }) {
  const inv = window.INVOICES;
  const fmt = window.inrFmt;
  const needs = inv.filter(i => i.status === "needs_review").length;
  const await_ = inv.filter(i => i.status === "awaiting_approval").length;
  const approved = inv.filter(i => i.status === "approved").length;
  const exported = inv.filter(i => i.status === "exported").length;
  const totalNet = inv.reduce((s, i) => s + i.net, 0);
  const tdsTotal = inv.reduce((s, i) => s + i.tds, 0);
  const stuck = inv.filter(i => i.age >= 5 && i.status !== "exported");
  const critical = inv.filter(i => i.severity === "critical");

  const Tile = ({ title, value, sub, accent, onClick }) => (
    <button onClick={onClick} style={{ textAlign: "left", flex: 1, background: "var(--bg-panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "14px 16px", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ font: "700 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".1em", color: "var(--ink-soft)" }}>{title}</div>
      <div style={{ font: "700 24px var(--font-mono)", fontVariantNumeric: "tabular-nums", color: accent || "var(--ink)", marginTop: 4, letterSpacing: "-.01em" }}>{value}</div>
      <div style={{ font: "500 11px var(--font-sans)", color: "var(--ink-soft)", marginTop: 2 }}>{sub}</div>
    </button>
  );

  // Inflow sparkline data — synthetic 14-day
  const series = [3,4,2,5,7,4,6,8,5,9,7,11,8,12];
  const max = Math.max(...series);

  return (
    <div>
      <div className="page-header">
        <h1>Overview</h1>
        <span className="count">Sundaram Textiles · FY 2025-26 · Apr</span>
        <div className="page-tools">
          <button className="iconbtn"><span className="material-symbols-outlined">tune</span></button>
        </div>
      </div>

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
          <div className="risk-row info">
            <span className="icon"><span className="material-symbols-outlined">cable</span></span>
            <div className="body">
              <div className="risk-code">Tally bridge AlterID lag</div>
              <div className="risk-msg">Last poll 4m ago — pre-export check will warn until refreshed.</div>
            </div>
            <button className="iconbtn" style={{ height: 26, width: 26 }} onClick={() => onNavigate("tallysync")}><span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span></button>
          </div>
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
