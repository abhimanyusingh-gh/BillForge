// PreExportModal.jsx — Tally pre-flight validation
function PreExportModal({ open, onClose }) {
  if (!open) return null;
  const checks = [
    { state: "pass", label: "GL code mapped", detail: "All 12 invoices have a GL ledger configured." },
    { state: "pass", label: "Vendor exists in Tally master", detail: "12/12 vendors found in active Tally company." },
    { state: "warn", label: "AlterID freshness", detail: "Bridge agent last polled 4m ago — ledger master may be slightly stale." },
    { state: "fail", label: "No critical risk signals", detail: "1 invoice has VENDOR_BANK_CHANGED (critical). Exclude or resolve before export." },
    { state: "pass", label: "Voucher GUIDs assigned", detail: "12 fresh GUIDs generated; idempotent re-push safe." },
    { state: "pass", label: "F12 settings compatible", detail: "BILLALLOCATIONS + ALTERID export enabled." },
  ];
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Pre-export validation</h2>
            <div style={{ font: "500 12px var(--font-sans)", color: "var(--ink-soft)", marginTop: 2 }}>12 invoices · ₹ 8,42,16,000.00 net · Sundaram Textiles Pvt Ltd</div>
          </div>
          <button className="iconbtn" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="modal-body">
          <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
            <div style={{ flex: 1, background: "var(--emerald-soft-bg)", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ font: "700 22px var(--font-mono)", color: "var(--emerald)" }}>10</div>
              <div style={{ font: "600 11px var(--font-sans)", color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".08em" }}>Ready</div>
            </div>
            <div style={{ flex: 1, background: "var(--amber-soft-bg)", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ font: "700 22px var(--font-mono)", color: "#b8770b" }}>1</div>
              <div style={{ font: "600 11px var(--font-sans)", color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".08em" }}>Warnings</div>
            </div>
            <div style={{ flex: 1, background: "var(--warn-soft-bg)", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ font: "700 22px var(--font-mono)", color: "var(--warn)" }}>1</div>
              <div style={{ font: "600 11px var(--font-sans)", color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".08em" }}>Blockers</div>
            </div>
          </div>
          {checks.map((c, i) => (
            <div key={i} className={"check-row " + (c.state === "pass" ? "pass" : c.state === "warn" ? "warn" : "fail")}>
              <span className="icon"><span className="material-symbols-outlined">{c.state === "pass" ? "check" : c.state === "warn" ? "warning" : "close"}</span></span>
              <div style={{ flex: 1 }}>
                <div style={{ font: "600 13px var(--font-sans)", color: "var(--ink)" }}>{c.label}</div>
                <div style={{ font: "500 12px var(--font-sans)", color: "var(--ink-soft)" }}>{c.detail}</div>
              </div>
              {c.state === "fail" ? <button style={{ font: "600 11px var(--font-sans)", color: "var(--accent)", background: "transparent", border: 0, cursor: "pointer" }}>Exclude 1</button> : null}
            </div>
          ))}
        </div>
        <div className="modal-foot">
          <button style={{ height: 32, padding: "0 14px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--ink)", font: "600 13px var(--font-sans)" }} onClick={onClose}>Cancel</button>
          <button style={{ height: 32, padding: "0 14px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--ink-soft)", font: "600 13px var(--font-sans)" }}>Exclude blockers · Export 11</button>
          <button style={{ height: 32, padding: "0 14px", borderRadius: 8, border: 0, background: "var(--accent)", color: "white", font: "600 13px var(--font-sans)" }} disabled>Export 12 (1 blocker)</button>
        </div>
      </div>
    </div>
  );
}
window.PreExportModal = PreExportModal;
