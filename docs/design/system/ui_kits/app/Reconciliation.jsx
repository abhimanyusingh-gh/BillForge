// Reconciliation.jsx — split pane
function Reconciliation() {
  const txs = [
    { id: "t1", vendor: "Reliance Jio Infocomm", date: "08-Apr-2026", amt: 83556000, ref: "NEFT/UTR2604081234", matched: true },
    { id: "t2", vendor: "Mahalakshmi Power Loom", date: "10-Apr-2026", amt: 11404800, ref: "RTGS/UTR2604101102", matched: false },
    { id: "t3", vendor: "Sundaram Stationers", date: "07-Apr-2026", amt: 3998400, ref: "NEFT/UTR2604070544", matched: true },
    { id: "t4", vendor: "Tata Consultancy Services", date: "12-Apr-2026", amt: 42480000, ref: "RTGS/UTR2604120821", matched: false },
  ];
  const [activeId, setActiveId] = React.useState("t2");
  const tx = txs.find(t => t.id === activeId);
  const inv = window.INVOICES.find(i => i.vendor === tx.vendor) || window.INVOICES[1];
  return (
    <div>
      <div className="page-header">
        <h1>Reconciliation</h1>
        <span className="count">HDFC Current · 0xxxx2034 · 4 unmatched</span>
        <div className="page-tools">
          <button className="iconbtn"><span className="material-symbols-outlined">filter_list</span></button>
          <button style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg-panel)", font: "600 12px var(--font-sans)" }}>Auto-match</button>
        </div>
      </div>
      <div className="recon-grid">
        <div className="recon-col">
          <h3>Bank transactions · debit</h3>
          {txs.map(t => (
            <div key={t.id} className={"tx-row " + (activeId === t.id ? "active" : "")} onClick={() => setActiveId(t.id)}>
              <div className="tx-line1"><span className="vendor">{t.vendor}</span><span className="amt">− {window.inrFmt(t.amt)}</span></div>
              <div className="tx-line2"><span>{t.date}</span><span className="ref">{t.ref}</span></div>
              <div>{t.matched ? <span className="spill s-approved"><span className="dot"></span>MATCHED</span> : <span className="spill s-needs_review"><span className="dot"></span>UNMATCHED</span>}</div>
            </div>
          ))}
        </div>
        <div className="recon-col">
          <h3>Expected debit</h3>
          <div className="expected-card">
            <div className="expected-row"><span>Gross invoice</span><span className="v">{window.inrFmt(inv.gross)}</span></div>
            <div className="expected-row"><span>− TDS {inv.section} ({inv.rate}%)</span><span className="v" style={{ color: "var(--warn)" }}>− {window.inrFmt(inv.tds)}</span></div>
            <div className="expected-row"><span>− TCS</span><span className="v">— {window.inrFmt(inv.tcs)}</span></div>
            <div className="expected-final"><span style={{ font: "700 11px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".1em" }}>Net payable</span><span className="v">{window.inrFmt(inv.net)}</span></div>
            <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: "var(--bg-sunken)", border: "1px dashed var(--line)" }}>
              <div style={{ font: "600 11px var(--font-sans)", color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".08em" }}>Bank debit</div>
              <div style={{ font: "700 18px var(--font-mono)", color: "var(--ink)" }}>− {window.inrFmt(tx.amt)}</div>
              <div style={{ marginTop: 4, font: "600 12px var(--font-mono)" }} className={tx.amt === inv.net ? "diff-pos" : "diff-neg"}>
                {tx.amt === inv.net ? "✓ matches expected debit" : `± ${window.inrFmt(Math.abs(tx.amt - inv.net))} variance`}
              </div>
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
              <button style={{ flex: 1, height: 32, borderRadius: 8, border: 0, background: "var(--accent)", color: "white", font: "600 13px var(--font-sans)" }}>Link 1:1</button>
              <button style={{ flex: 1, height: 32, borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg-panel)", font: "600 12px var(--font-sans)" }}>Split…</button>
            </div>
          </div>
        </div>
        <div className="recon-col">
          <h3>Candidate invoices</h3>
          {window.INVOICES.slice(0, 4).map(i => (
            <div key={i.id} className={"tx-row " + (i.vendor === tx.vendor ? "active" : "")}>
              <div className="tx-line1"><span className="vendor">{i.vendor}</span><span className="amt">{window.inrFmt(i.net)}</span></div>
              <div className="tx-line2"><span>{i.number} · {i.date}</span><span className="ref">{i.section}</span></div>
              <div><span className={"spill s-" + i.status}><span className="dot"></span>{i.status.toUpperCase()}</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
window.Reconciliation = Reconciliation;
