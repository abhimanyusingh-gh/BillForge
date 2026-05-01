// TdsDashboard.jsx — TDS compliance dashboard
function TdsDashboard() {
  // FY 2025-26, current quarter Q4 (Jan-Mar) ending; next return is 26Q4 due 31-May-2026
  const quarter = { fy: "2025-26", q: "Q4", period: "Jan – Mar 2026", returnForm: "26Q", dueDate: "31-May-2026", daysLeft: 34 };

  // Per-due challan deposits keyed by due id. Seeded so one row already shows DEPOSITED.
  const [ledger, setLedger] = React.useState(() => ({
    tcs: [{ id: "ch_seed_tcs", date: "07-Apr-2026", amount: 4720000 - 100, cin: "0510308202604071234", bsr: "0510308", account: "HDFC Current ··2034", linkedTxn: "tx_seed_tcs", note: "April challan" }],
  }));
  const [openDueId, setOpenDueId] = React.useState(null);

  // Base figures (deducted at source, plus deposited not counting our seeded TCS one).
  // We layer per-section live deposits from `ledger` on top so the dashboard
  // updates the moment a challan is mapped to a bank debit.
  const baseSections = [
    { sec: "194C", desc: "Contractors", rate: "1% / 2%", deducted: 4216800, depositedBase: 4216800 - 115200 - 81600, count: 47, threshold: 10000000, used: 9120000 },
    { sec: "194J", desc: "Professional fees", rate: "10%", deducted: 14004000, depositedBase: 14004000 - 4720000 - 1524000, count: 18, threshold: 5000000, used: 14004000 },
    { sec: "194Q", desc: "Purchase of goods", rate: "0.1%", deducted: 122400, depositedBase: 122400, count: 2, threshold: 5000000000, used: 122400000 },
    { sec: "194I", desc: "Rent", rate: "10%", deducted: 720000, depositedBase: 720000, count: 4, threshold: 24000000, used: 7200000 },
    { sec: "206AA", desc: "PAN missing penalty", rate: "20%", deducted: 0, depositedBase: 0, count: 0, threshold: null, used: null },
  ];

  const pending = [
    { id: "infy", who: "Infosys Ltd",                 sec: "194J", amt: 1524000, by: "07-May-2026", daysLeft: 10, severity: "info" },
    { id: "mpl",  who: "Mahalakshmi Power Loom",      sec: "194C", amt: 115200,  by: "07-May-2026", daysLeft: 10, severity: "info" },
    { id: "tcs",  who: "Tata Consultancy Services",   sec: "194J", amt: 4720000, by: "30-Apr-2026", daysLeft: 3,  severity: "warning" },
    { id: "ss",   who: "Sundaram Stationers",         sec: "194C", amt: 81600,   by: "07-Apr-2026", daysLeft: -20, severity: "critical" },
  ];

  // Layer ledger deposits onto base section figures.
  const sections = baseSections.map(s => {
    const liveForSection = pending
      .filter(p => p.sec === s.sec)
      .reduce((a, p) => a + (ledger[p.id] || []).reduce((x, c) => x + c.amount, 0), 0);
    return { ...s, deposited: s.depositedBase + liveForSection };
  });
  const totalDeducted = sections.reduce((a, s) => a + s.deducted, 0);
  const totalDeposited = sections.reduce((a, s) => a + s.deposited, 0);
  const gap = totalDeducted - totalDeposited;

  // Derive the "deposited" state per due from the ledger
  const dueState = (d) => {
    const list = ledger[d.id] || [];
    const paid = list.reduce((s, p) => s + p.amount, 0);
    const balance = Math.max(0, d.amt - paid);
    let label = "PENDING", color = "var(--ink-soft)";
    if (paid > 0 && balance > 0) { label = "PARTIAL";   color = "#b8770b"; }
    else if (paid > 0 && balance <= 0) { label = "DEPOSITED"; color = "var(--emerald)"; }
    return { paid, balance, label, color, count: list.length };
  };

  const bars = [
    { m: "Apr-25",  v: 1240000 }, { m: "May-25", v: 1860000 }, { m: "Jun-25", v: 2010000 },
    { m: "Jul-25",  v: 1550000 }, { m: "Aug-25", v: 1740000 }, { m: "Sep-25", v: 1920000 },
    { m: "Oct-25",  v: 2200000 }, { m: "Nov-25", v: 1640000 }, { m: "Dec-25", v: 1810000 },
    { m: "Jan-26",  v: 4920000 }, { m: "Feb-26", v: 3120000 }, { m: "Mar-26", v: 5100000 },
  ];
  const maxBar = Math.max(...bars.map(b => b.v));

  const Stat = ({ label, value, hint, accent }) => (
    <div style={{ flex: 1, background: "var(--bg-panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ font: "700 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".1em", color: "var(--ink-soft)" }}>{label}</div>
      <div style={{ font: "700 22px var(--font-mono)", color: accent || "var(--ink)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {hint ? <div style={{ font: "500 11px var(--font-sans)", color: "var(--ink-soft)", marginTop: 2 }}>{hint}</div> : null}
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h1>TDS Dashboard</h1>
        <span className="count">FY {quarter.fy} · {quarter.q} · {quarter.period}</span>
        <div className="page-tools">
          <span style={{ font: "500 11px var(--font-sans)", color: "var(--ink-soft)" }}>Period</span>
          <select style={{ height: 28, borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg-panel)", padding: "0 8px", font: "500 12px var(--font-sans)", color: "var(--ink)" }}>
            <option>FY 2025-26 · Q4</option><option>FY 2025-26 · Q3</option><option>FY 2024-25 · Q4</option>
          </select>
          <button style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg-panel)", font: "600 12px var(--font-sans)" }}>Generate {quarter.returnForm} draft</button>
          <button style={{ height: 30, padding: "0 14px", borderRadius: 8, border: 0, background: "var(--accent)", color: "white", font: "600 12px var(--font-sans)" }}>Pay challan</button>
        </div>
      </div>

      {/* hero stats row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <Stat label="Deducted (FY)" value={window.inrFmt(totalDeducted)} hint={`${sections.reduce((a,s)=>a+s.count,0)} invoices · 4 sections`} />
        <Stat label="Deposited" value={window.inrFmt(totalDeposited)} hint={gap > 0 ? "Short — see below" : "Up to date"} accent={gap > 0 ? "var(--warn)" : "var(--emerald)"} />
        <Stat label={`${quarter.returnForm} due`} value={quarter.dueDate} hint={`${quarter.daysLeft} days left · ${quarter.returnForm} return`} accent={quarter.daysLeft < 14 ? "var(--warn)" : "var(--ink)"} />
        <div style={{ flex: 1.4, background: "var(--bg-panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 14px 12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ font: "700 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".1em", color: "var(--ink-soft)" }}>Monthly TDS deducted</div>
            <div style={{ font: "500 11px var(--font-mono)", color: "var(--ink-soft)" }}>FY {quarter.fy}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${bars.length}, 1fr)`, alignItems: "end", gap: 4, height: 56, marginTop: 8 }}>
            {bars.map((b, i) => {
              const h = (b.v / maxBar) * 100;
              const isQuarter = i >= 9; // Jan-Mar
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", height: h + "%", background: isQuarter ? "var(--accent)" : "rgba(17,82,212,.30)", borderRadius: 2, minHeight: 2 }} title={b.m + " · " + window.inrFmt(b.v)}></div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${bars.length}, 1fr)`, gap: 4, marginTop: 4 }}>
            {bars.map((b, i) => (
              <div key={i} style={{ font: "500 9px var(--font-mono)", color: "var(--ink-muted)", textAlign: "center" }}>{b.m.slice(0, 3)}</div>
            ))}
          </div>
        </div>
      </div>

      {/* section breakdown */}
      <div className="table-wrap">
        <table className="lbtable">
            <thead><tr>
              <th style={{ width: 80 }}>Section</th>
              <th>Description</th>
              <th style={{ width: 90 }}>Rate</th>
              <th style={{ width: 60, textAlign: "right" }}>Bills</th>
              <th style={{ textAlign: "right" }}>Deducted</th>
              <th style={{ textAlign: "right" }}>Deposited</th>
              <th>Threshold use</th>
            </tr></thead>
            <tbody>
              {sections.map((s, i) => {
                const pct = s.threshold ? Math.min(100, (s.used / s.threshold) * 100) : null;
                const dGap = s.deducted - s.deposited;
                return (
                  <tr key={i}>
                    <td className="mono-cell" style={{ color: "var(--accent)", fontWeight: 600 }}>{s.sec}</td>
                    <td>{s.desc}</td>
                    <td className="mono-cell" style={{ color: "var(--ink-soft)" }}>{s.rate}</td>
                    <td className="num-cell">{s.count}</td>
                    <td className="num-cell">{window.inrFmt(s.deducted)}</td>
                    <td className="num-cell" style={{ color: dGap > 0 ? "var(--warn)" : "var(--ink)" }}>
                      {window.inrFmt(s.deposited)}
                      {dGap > 0 ? <div style={{ font: "500 10px var(--font-mono)", color: "var(--warn)" }}>− {window.inrFmt(dGap)} short</div> : null}
                    </td>
                    <td>
                      {pct == null ? <span style={{ color: "var(--ink-muted)", font: "500 11px var(--font-mono)" }}>—</span> : (
                        <div>
                          <div style={{ height: 5, background: "var(--bg-sunken)", borderRadius: 999, overflow: "hidden" }}>
                            <div style={{ width: pct + "%", height: "100%", background: pct > 80 ? "var(--warn)" : pct > 50 ? "#f59e0b" : "var(--accent)" }}></div>
                          </div>
                          <div style={{ font: "500 10px var(--font-mono)", color: "var(--ink-soft)", marginTop: 2 }}>
                            {window.inrFmt(s.used)} / {window.inrFmt(s.threshold)}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pending challan deposits — TABLE */}
        <div className="section" style={{ marginTop: 12 }}>
          <div className="stitle">
            <h3>Pending challan deposits</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="lb-caption" style={{ marginRight: 4 }}>Sec. 200 · 7th of next month</span>
              <button onClick={() => setOpenDueId("__aggregate__")}
                      style={{ height: 26, padding: "0 10px", borderRadius: 5, border: "1px solid var(--accent)", background: "var(--accent)", color: "white", font: "700 11px var(--font-sans)", cursor: "pointer", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 13, lineHeight: 1, fontWeight: 700 }}>+</span>
                Map aggregated challan
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="lbtable">
              <thead><tr>
                <th style={{ width: 32 }}></th>
                <th>Deductee</th>
                <th style={{ width: 80 }}>Section</th>
                <th style={{ width: 130 }}>Due by</th>
                <th style={{ width: 130, textAlign: "right" }}>TDS amount</th>
                <th style={{ width: 130, textAlign: "right" }}>Deposited</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 36 }}></th>
              </tr></thead>
              <tbody>
                {pending.map((p, i) => {
                  const st = dueState(p);
                  const sev = st.label === "DEPOSITED" ? "info" : p.severity;
                  const icon = st.label === "DEPOSITED" ? "check_circle" : sev === "critical" ? "priority_high" : sev === "warning" ? "warning" : "schedule";
                  const iconColor = st.label === "DEPOSITED" ? "var(--emerald)" : sev === "critical" ? "var(--warn)" : sev === "warning" ? "#b8770b" : "var(--ink-soft)";
                  const dateColor = st.label === "DEPOSITED" ? "var(--ink-soft)" : p.daysLeft < 0 ? "var(--warn)" : p.daysLeft < 7 ? "#b8770b" : "var(--ink)";
                  return (
                    <tr key={i} onClick={() => setOpenDueId(p.id)}
                        role="button" tabIndex={0}
                        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenDueId(p.id); } }}
                        style={{ cursor: "pointer" }}
                        title="Map to bank debit">
                      <td style={{ textAlign: "center" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: iconColor, verticalAlign: "middle" }}>{icon}</span>
                      </td>
                      <td>
                        <div style={{ font: "600 13px var(--font-sans)", color: "var(--ink)" }}>{p.who}</div>
                        {st.label === "DEPOSITED" ? (
                          <div style={{ font: "500 11px var(--font-mono)", color: "var(--ink-soft)" }}>CIN {(ledger[p.id] || [])[0]?.cin || "—"}</div>
                        ) : null}
                      </td>
                      <td className="mono-cell" style={{ color: "var(--accent)", fontWeight: 600 }}>{p.sec}</td>
                      <td>
                        <div className="mono-cell" style={{ color: dateColor, fontWeight: st.label === "DEPOSITED" ? 500 : 600, padding: 0 }}>{p.by}</div>
                        {st.label !== "DEPOSITED" ? (
                          <div style={{ font: "500 10px var(--font-sans)", color: dateColor }}>
                            {p.daysLeft < 0 ? `${-p.daysLeft} days overdue · 1.5%/mo` : `${p.daysLeft} days left`}
                          </div>
                        ) : null}
                      </td>
                      <td className="num-cell">{window.inrFmt(p.amt)}</td>
                      <td className="num-cell" style={{ color: st.label === "DEPOSITED" ? "var(--emerald)" : st.label === "PARTIAL" ? "#b8770b" : "var(--ink-muted)" }}>
                        {st.paid > 0 ? window.inrFmt(st.paid) : "—"}
                        {st.label === "PARTIAL" ? <div style={{ font: "500 10px var(--font-mono)", color: "var(--warn)" }}>− {window.inrFmt(st.balance)} short</div> : null}
                      </td>
                      <td>
                        <span style={{ font: "700 10px var(--font-sans)", color: st.color, textTransform: "uppercase", letterSpacing: ".06em", padding: "3px 7px", background: st.label === "DEPOSITED" ? "var(--emerald-soft-bg)" : st.label === "PARTIAL" ? "var(--amber-soft-bg)" : "var(--bg-sunken)", borderRadius: 4, display: "inline-block" }}>{st.label}</span>
                      </td>
                      <td>
                        <button className="iconbtn" style={{ height: 26, width: 26 }} title="Map to bank debit" onClick={e => { e.stopPropagation(); setOpenDueId(p.id); }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      {/* quarterly return readiness */}
      <div className="section" style={{ marginTop: 12 }}>
        <div className="stitle">
          <h3>{quarter.returnForm} for {quarter.q} · readiness</h3>
          <span className="lb-caption">Pre-flight before TRACES upload</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {[
            { lbl: "Deductee PANs", val: "67 / 71", state: "warn", hint: "4 invoices missing PAN — 206AA at 20%" },
            { lbl: "Challans matched", val: "14 / 16", state: "warn", hint: "2 challans pending Form 26AS reflection" },
            { lbl: "Bills classified", val: "71 / 71", state: "pass", hint: "Every bill mapped to a section" },
            { lbl: "Form 26AS reconciled", val: "Apr–Feb", state: "warn", hint: "Mar 2026 not yet refreshed" },
          ].map((r, i) => (
            <div key={i} style={{ background: "var(--bg-sunken)", borderRadius: 8, padding: "10px 12px", border: "1px solid var(--line)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 14, height: 14, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", background: r.state === "pass" ? "var(--emerald-soft-bg)" : "var(--amber-soft-bg)", color: r.state === "pass" ? "var(--emerald)" : "#b8770b" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 10 }}>{r.state === "pass" ? "check" : "warning"}</span>
                </span>
                <span style={{ font: "700 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)" }}>{r.lbl}</span>
              </div>
              <div style={{ font: "700 18px var(--font-mono)", color: "var(--ink)", marginTop: 6 }}>{r.val}</div>
              <div style={{ font: "500 11px var(--font-sans)", color: "var(--ink-soft)", marginTop: 2 }}>{r.hint}</div>
            </div>
          ))}
        </div>
      </div>

      {openDueId ? (
        <window.TdsBankMapModal
          dues={pending}
          ledger={ledger}
          focusDueId={openDueId === "__aggregate__" ? null : openDueId}
          onClose={() => setOpenDueId(null)}
          onSave={({ txn, allocations }) => {
            // Append one ledger entry per allocated due, all sharing the same CIN/BSR/date
            // so they show up as one challan that paid many deductees.
            setLedger(prev => {
              const next = { ...prev };
              const stamp = Date.now();
              allocations.forEach((a, i) => {
                if (a.amount <= 0) return;
                const entry = {
                  id: "ch" + stamp + "_" + i,
                  date: txn.date,
                  amount: a.amount,
                  cin: txn.cin,
                  bsr: txn.bsr,
                  account: txn.account,
                  linkedTxn: txn.id,
                  note: "Aggregated challan",
                };
                next[a.dueId] = [...(next[a.dueId] || []), entry];
              });
              return next;
            });
            setOpenDueId(null);
          }}
        />
      ) : null}
    </div>
  );
}
window.TdsDashboard = TdsDashboard;
