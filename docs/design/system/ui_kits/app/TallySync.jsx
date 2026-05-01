// TallySync.jsx — bridge agent + push log + ledger drift console
function TallySync() {
  // Bridge agent telemetry
  const bridge = {
    state: "online",
    company: "Sundaram Textiles Pvt Ltd",
    file: "C:\\Tally\\Data\\10042\\sundaram-textiles.tdc",
    lastPoll: "27-Apr-2026 10:24:08 IST",
    lastPollAgo: 14, // seconds
    alterId: 84221,
    alterIdLastSeen: 84198,
    version: "Tally Prime 4.1 · Bridge 0.7.2",
    f12: { billAlloc: true, alterIdExport: true, gstinExport: true, narrationExport: true },
  };

  // Push log
  const pushes = [
    { id: "p1", ts: "27-Apr-2026 09:48", batch: "B-2604-014", what: "Voucher #V-2704-0094", vendor: "Tata Consultancy Services", amt: 42480000, state: "success", retries: 0 },
    { id: "p2", ts: "27-Apr-2026 09:48", batch: "B-2604-014", what: "Voucher #V-2704-0095", vendor: "Mahalakshmi Power Loom", amt: 11404800, state: "success", retries: 0 },
    { id: "p3", ts: "27-Apr-2026 09:31", batch: "B-2604-013", what: "Vendor master sync", vendor: "Asian Paints Ltd", amt: null, state: "queued", retries: 0 },
    { id: "p4", ts: "27-Apr-2026 09:11", batch: "B-2604-013", what: "Voucher #V-2704-0091", vendor: "Reliance Jio Infocomm", amt: 83556000, state: "drift", retries: 1 },
    { id: "p5", ts: "26-Apr-2026 18:02", batch: "B-2604-012", what: "Voucher #V-2604-0088", vendor: "Sundaram Stationers", amt: 3998400, state: "failed", retries: 3, error: "LEDGERNOTFOUND: Legal & Professional Fees" },
  ];

  const drift = [
    { kind: "Ledger", lb: "Legal & Professional Fees", tally: "Legal Fees", count: 1, action: "alias-or-create" },
    { kind: "Vendor", lb: "Tata Consultancy Services Pvt Ltd", tally: "TCS Ltd", count: 4, action: "merge" },
    { kind: "Group",  lb: "Indirect Expenses",                tally: "Indirect Expenses", count: 0, action: "ok" },
    { kind: "TDS Nature", lb: "Section 194J · Professional",  tally: "194J Professional/Technical", count: 7, action: "alias" },
  ];

  const StateBadge = ({ s, retries }) => {
    if (s === "success") return <span className="spill s-approved"><span className="dot"></span>SUCCESS</span>;
    if (s === "queued")  return <span className="spill s-pending"><span className="dot"></span>QUEUED</span>;
    if (s === "drift")   return <span className="spill s-parsed"><span className="dot"></span>RETRY · DRIFT</span>;
    if (s === "failed")  return <span className="spill s-needs_review"><span className="dot"></span>FAILED · {retries}/3</span>;
    return null;
  };

  return (
    <div>
      <div className="page-header">
        <h1>Tally Sync Console</h1>
        <span className="count">Bridge agent · {bridge.version}</span>
        <div className="page-tools">
          <button style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg-panel)", font: "600 12px var(--font-sans)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4 }}>refresh</span>
            Resync masters
          </button>
          <button style={{ height: 30, padding: "0 14px", borderRadius: 8, border: 0, background: "var(--accent)", color: "white", font: "600 12px var(--font-sans)" }}>
            Retry failures
          </button>
        </div>
      </div>

      {/* Bridge agent status strip */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 14, padding: 14, background: "var(--bg-panel)", border: "1px solid var(--line)", borderRadius: 10, marginBottom: 12, alignItems: "center" }}>
        <div style={{ position: "relative", width: 38, height: 38, borderRadius: 999, background: "var(--emerald-soft-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span className="material-symbols-outlined" style={{ color: "var(--emerald)" }}>cable</span>
          <span style={{ position: "absolute", right: -2, bottom: -2, width: 12, height: 12, borderRadius: 999, background: "var(--emerald)", border: "2px solid var(--bg-panel)", boxShadow: "0 0 0 0 rgba(34,197,94,0.6)", animation: "lbpulse 1.6s infinite" }}></span>
        </div>
        <div>
          <div style={{ font: "700 13px var(--font-sans)", color: "var(--ink)" }}>
            Bridge ONLINE — polling {bridge.company}
          </div>
          <div style={{ font: "500 12px var(--font-mono)", color: "var(--ink-soft)", marginTop: 2 }}>
            {bridge.file}
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 6, font: "500 11px var(--font-sans)", color: "var(--ink-soft)" }}>
            <span><b style={{ color: "var(--ink)", fontFamily: "var(--font-mono)" }}>{bridge.lastPollAgo}s</b> ago · last poll {bridge.lastPoll}</span>
            <span>AlterID <b style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>{bridge.alterId.toLocaleString()}</b> <span style={{ color: bridge.alterId !== bridge.alterIdLastSeen ? "var(--warn)" : "var(--emerald)" }}>{bridge.alterId !== bridge.alterIdLastSeen ? `(+${bridge.alterId - bridge.alterIdLastSeen} since last full sync)` : "(in sync)"}</span></span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ font: "600 10px var(--font-sans)", color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".1em", marginRight: 4 }}>F12</span>
          {Object.entries(bridge.f12).map(([k, on]) => (
            <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, font: "600 10px var(--font-sans)", background: on ? "var(--emerald-soft-bg)" : "var(--warn-soft-bg)", color: on ? "var(--emerald)" : "var(--warn)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 10 }}>{on ? "check" : "close"}</span>{k}
            </span>
          ))}
        </div>
      </div>

      {/* push log + drift */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12 }}>
        <div className="table-wrap">
          <table className="lbtable">
            <thead><tr>
              <th style={{ width: 130 }}>Timestamp</th>
              <th style={{ width: 110 }}>Batch</th>
              <th>Action</th>
              <th>Counterparty</th>
              <th style={{ textAlign: "right", width: 110 }}>Amount</th>
              <th style={{ width: 130 }}>State</th>
            </tr></thead>
            <tbody>
              {pushes.map(p => (
                <tr key={p.id}>
                  <td className="mono-cell" style={{ color: "var(--ink-soft)" }}>{p.ts}</td>
                  <td className="mono-cell" style={{ color: "var(--accent)" }}>{p.batch}</td>
                  <td>
                    <div style={{ font: "500 12.5px var(--font-sans)" }}>{p.what}</div>
                    {p.error ? <div style={{ font: "500 11px var(--font-mono)", color: "var(--warn)", marginTop: 2 }}>{p.error}</div> : null}
                  </td>
                  <td style={{ color: "var(--ink-soft)" }}>{p.vendor}</td>
                  <td className="num-cell">{p.amt == null ? "—" : window.inrFmt(p.amt)}</td>
                  <td><StateBadge s={p.state} retries={p.retries} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="section" style={{ marginTop: 0 }}>
          <div className="stitle">
            <h3>Master data drift</h3>
            <span className="lb-caption">{drift.filter(d => d.count > 0).length} mismatches · LB → Tally</span>
          </div>
          {drift.map((d, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: i < drift.length - 1 ? "1px solid var(--line-soft)" : 0 }}>
              <span style={{ width: 60, font: "700 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)" }}>{d.kind}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "500 12.5px var(--font-sans)", color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.lb}</div>
                <div style={{ font: "500 11px var(--font-mono)", color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "var(--ink-muted)" }}>↪ Tally</span>{d.tally}
                </div>
              </div>
              {d.count > 0 ? <span style={{ font: "600 10px var(--font-mono)", color: "var(--warn)", padding: "1px 6px", background: "var(--warn-soft-bg)", borderRadius: 999 }}>{d.count} bill{d.count > 1 ? "s" : ""}</span> : <span style={{ font: "600 10px var(--font-sans)", color: "var(--emerald)" }}>OK</span>}
              {d.action !== "ok" ? <button style={{ font: "600 11px var(--font-sans)", color: "var(--accent)", background: "transparent", border: 0, cursor: "pointer", textTransform: "capitalize" }}>{d.action}</button> : null}
            </div>
          ))}
        </div>
      </div>

      <style>{`@keyframes lbpulse { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,.55); } 70% { box-shadow: 0 0 0 8px rgba(34,197,94,0); } 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); } }`}</style>
    </div>
  );
}
window.TallySync = TallySync;
