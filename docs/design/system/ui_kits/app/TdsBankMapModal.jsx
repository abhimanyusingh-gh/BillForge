// TdsBankMapModal.jsx — aggregated TDS challan mapper.
// CAs typically lump multiple deductee dues into one CBDT challan; this modal
// reflects that: pick ONE bank debit, then tick the dues it covered. The
// challan amount auto-allocates across the selected dues (FIFO by due date),
// and you can override individual allocations.
//
// Props:
//   dues          — full list of pending dues [{id, who, sec, amt, by, daysLeft}]
//   ledger        — current allocations keyed by dueId, used to compute remaining balance per due
//   focusDueId    — when opened from a row click, that row is pre-ticked
//   onClose, onSave({txnId, allocations: [{dueId, amount, cin, bsr, date, account}]})
function TdsBankMapModal({ dues, ledger, focusDueId, onClose, onSave }) {
  // Bank debits the feed has flagged as outbound to ITD/CBDT.
  // The user can also enter a manual challan (offline payment, joint family etc).
  const bankTxns = [
    { id: "tx_aggr_apr", date: "07-Apr-2026", account: "HDFC Current ··2034", vendor: "Income Tax Dept · CBDT",  vendorConf: 0.99, desc: "TAX/CHALLAN-281/CBDT/AGGR-APR26",   cin: "0510308202604071234", bsr: "0510308", amount: 4920000 },
    { id: "tx_inf",      date: "27-Apr-2026", account: "HDFC Current ··2034", vendor: "Income Tax Dept · CBDT",  vendorConf: 0.97, desc: "TAX/CHALLAN-281/CBDT/INFY",        cin: "0510308202604277712", bsr: "0510308", amount: 1524000 },
    { id: "tx_apr_c",    date: "07-Apr-2026", account: "ICICI Current ··2419", vendor: "Income Tax Dept · CBDT", vendorConf: 0.95, desc: "ITD/TDS DEPOSIT 26Q4 · 194C",      cin: "6360218202604071019", bsr: "6360218", amount: 196800 },
    { id: "tx_rent",     date: "07-Apr-2026", account: "HDFC Current ··2034", vendor: "Income Tax Dept · CBDT",  vendorConf: 0.92, desc: "RTGS/CBDT-OLT/CHALLAN 281 · 194I", cin: "0510308202604071411", bsr: "0510308", amount: 720000 },
    { id: "tx_misc",     date: "10-Apr-2026", account: "HDFC Current ··2034", vendor: "Income Tax Dept · CBDT",  vendorConf: 0.78, desc: "ONLINE TAX PMT REF #4488",          cin: "0510308202604107719", bsr: "0510308", amount: 81600 },
    { id: "tx_unk",      date: "08-Apr-2026", account: "ICICI Current ··2419", vendor: null,                     vendorConf: 0,    desc: "NEFT/ADJ-TAX-MISC-991",            cin: "—",                  bsr: "—",       amount: 50000 },
  ];

  // Find which txn IDs are already used in the ledger so we can disable them
  const usedTxnIds = new Set();
  Object.values(ledger || {}).forEach(arr => (arr || []).forEach(p => p.linkedTxn && usedTxnIds.add(p.linkedTxn)));

  // Pick the best initial txn:
  //   1. A debit whose amount === sum of unpaid amounts of (focused due + other dues with same date) — exact match
  //   2. otherwise leave none selected
  const remaining = (d) => Math.max(0, d.amt - (ledger?.[d.id] || []).reduce((s, p) => s + p.amount, 0));
  const initialTxn = (() => {
    if (!focusDueId) return null;
    const focusDue = dues.find(d => d.id === focusDueId);
    if (!focusDue) return null;
    const exact = bankTxns.find(t => !usedTxnIds.has(t.id) && Math.abs(t.amount - remaining(focusDue)) < 10);
    if (exact) return exact.id;
    // closest larger amount that could plausibly be aggregated
    const candidate = bankTxns.filter(t => !usedTxnIds.has(t.id) && t.amount >= remaining(focusDue)).sort((a, b) => a.amount - b.amount)[0];
    return candidate ? candidate.id : (bankTxns.find(t => !usedTxnIds.has(t.id))?.id || null);
  })();

  const [txnId, setTxnId] = React.useState(initialTxn);
  const [manualChallan, setManualChallan] = React.useState(null); // {amount, cin, bsr, date, account}
  const txn = txnId ? bankTxns.find(t => t.id === txnId) : null;
  const challanAmount = manualChallan ? manualChallan.amount : (txn ? txn.amount : 0);

  // Selection of dues, with allocation (in paise). Defaults to remaining due amount but capped by leftover challan.
  const initialSelected = focusDueId ? new Set([focusDueId]) : new Set();
  const [selected, setSelected] = React.useState(initialSelected);
  // dueId -> amount (manual override)
  const [overrides, setOverrides] = React.useState({});

  // Auto-allocate challan across selected dues, FIFO by due date (earliest first).
  // If user has overridden a specific due's amount, respect it; the rest get the remainder.
  const sortedSelectedDues = React.useMemo(() => {
    const list = dues.filter(d => selected.has(d.id));
    return list.sort((a, b) => {
      // earliest due date first; tie-break by amount desc
      return a.daysLeft - b.daysLeft || b.amt - a.amt;
    });
  }, [selected, dues]);

  const allocations = React.useMemo(() => {
    let pool = challanAmount;
    // First subtract overrides
    const overrideTotal = sortedSelectedDues.reduce((s, d) => s + (overrides[d.id] != null ? overrides[d.id] : 0), 0);
    pool = Math.max(0, pool - overrideTotal);
    // Then auto-fill the rest in FIFO order
    return sortedSelectedDues.map(d => {
      if (overrides[d.id] != null) return { dueId: d.id, amount: overrides[d.id], auto: false };
      const want = remaining(d);
      const give = Math.min(pool, want);
      pool -= give;
      return { dueId: d.id, amount: give, auto: true };
    });
  }, [sortedSelectedDues, overrides, challanAmount, ledger]);

  const allocTotal = allocations.reduce((s, a) => s + a.amount, 0);
  const unallocated = challanAmount - allocTotal;
  const fullyAllocated = unallocated === 0 && challanAmount > 0;
  const overAllocated = unallocated < 0;

  const toggleDue = (id) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    setOverrides(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const setOverride = (id, amt) => {
    const n = Math.max(0, Math.round(amt) || 0);
    setOverrides(prev => ({ ...prev, [id]: n }));
  };
  const clearOverride = (id) => setOverrides(prev => { const n = { ...prev }; delete n[id]; return n; });

  const score = (t) => {
    let s = 0;
    if (Math.abs(t.amount - challanAmountForScore) < 10) s += 0.7;
    if (t.vendor && /CBDT|Income Tax/i.test(t.vendor)) s += 0.3;
    return s;
  };
  // for sort stability without circular refs we use a static target = sum of all unpaid dues
  const totalUnpaid = dues.reduce((s, d) => s + remaining(d), 0);
  const challanAmountForScore = totalUnpaid;
  const scoredTxns = bankTxns.map(t => ({ ...t, _score: score(t) })).sort((a, b) => b._score - a._score);

  const finish = () => {
    if (!txn && !manualChallan) return;
    if (!fullyAllocated) return;
    onSave?.({
      txn: txn || manualChallan,
      txnIsManual: !!manualChallan,
      allocations: allocations.filter(a => a.amount > 0),
    });
    onClose?.();
  };

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Helper to render a coloured challan-amount pill
  const ChallanPill = () => (
    <span className="lb-mono" style={{ font: "700 13px var(--font-mono)", color: "var(--ink)" }}>
      {window.inrFmt(challanAmount)}
    </span>
  );

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ width: 980, maxHeight: "94vh", display: "flex", flexDirection: "column" }}>
        <div className="modal-head">
          <div>
            <h2>Map aggregated TDS challan</h2>
            <div style={{ font: "500 12px var(--font-sans)", color: "var(--ink-soft)", marginTop: 2 }}>
              Pick one CBDT debit, then tick the deductee dues it covers. LedgerBuddy splits the challan amount across them.
            </div>
          </div>
          <button className="iconbtn" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>

        {/* Summary strip */}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: 1, background: "var(--line)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
          <div style={{ background: "var(--bg-panel)", padding: "10px 14px" }}>
            <div style={{ font: "600 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)" }}>Challan</div>
            <div style={{ font: "700 16px var(--font-mono)", color: "var(--ink)", marginTop: 4 }}>
              {challanAmount ? window.inrFmt(challanAmount) : <span style={{ font: "500 13px var(--font-sans)", color: "var(--ink-muted)" }}>— pick a debit</span>}
            </div>
          </div>
          <div style={{ background: "var(--bg-panel)", padding: "10px 14px" }}>
            <div style={{ font: "600 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)" }}>Dues selected</div>
            <div style={{ font: "700 16px var(--font-mono)", color: "var(--ink)", marginTop: 4 }}>{selected.size}</div>
          </div>
          <div style={{ background: "var(--bg-panel)", padding: "10px 14px" }}>
            <div style={{ font: "600 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)" }}>Allocated</div>
            <div style={{ font: "700 16px var(--font-mono)", color: overAllocated ? "var(--warn)" : "var(--emerald)", marginTop: 4 }}>{window.inrFmt(allocTotal)}</div>
          </div>
          <div style={{ background: "var(--bg-panel)", padding: "10px 14px" }}>
            <div style={{ font: "600 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)" }}>Unallocated</div>
            <div style={{ font: "700 16px var(--font-mono)", color: overAllocated ? "var(--warn)" : unallocated === 0 && challanAmount > 0 ? "var(--emerald)" : "#b8770b", marginTop: 4 }}>
              {overAllocated ? "− " + window.inrFmt(-unallocated) : window.inrFmt(unallocated)}
            </div>
          </div>
        </div>

        <div className="modal-body" style={{ display: "grid", gridTemplateColumns: "1fr 1.25fr", gap: 16, overflowY: "auto" }}>
          {/* Left — pick the bank debit (the challan) */}
          <div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ font: "600 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)" }}>1 · Pick the CBDT debit</span>
              <button onClick={() => { setTxnId(null); setManualChallan({ amount: 0, cin: "", bsr: "", date: "", account: "Manual entry" }); }}
                      style={{ height: 22, padding: "0 8px", borderRadius: 4, border: "1px solid var(--line)", background: "var(--bg-panel)", font: "600 10px var(--font-sans)", color: "var(--ink-soft)", cursor: "pointer", textTransform: "uppercase", letterSpacing: ".06em" }}>
                + Manual challan
              </button>
            </div>

            {manualChallan ? (
              <div style={{ padding: 10, border: "1.5px solid var(--accent)", borderRadius: 8, background: "var(--accent-soft-bg)", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ font: "700 12px var(--font-sans)", color: "var(--ink)" }}>Manual challan</span>
                  <button onClick={() => { setManualChallan(null); setTxnId(initialTxn); }} className="iconbtn" style={{ width: 22, height: 22 }} title="Clear"><span className="material-symbols-outlined" style={{ fontSize: 13 }}>close</span></button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ font: "600 10px var(--font-sans)", color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".06em" }}>Amount</span>
                    <input type="number" value={manualChallan.amount || ""} onChange={e => setManualChallan(c => ({ ...c, amount: +e.target.value || 0 }))}
                           style={{ height: 28, padding: "0 8px", borderRadius: 5, border: "1px solid var(--line)", font: "600 12px var(--font-mono)", background: "var(--bg-panel)" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ font: "600 10px var(--font-sans)", color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".06em" }}>Date</span>
                    <input type="text" value={manualChallan.date} placeholder="DD-MMM-YYYY" onChange={e => setManualChallan(c => ({ ...c, date: e.target.value }))}
                           style={{ height: 28, padding: "0 8px", borderRadius: 5, border: "1px solid var(--line)", font: "500 12px var(--font-mono)", background: "var(--bg-panel)" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ font: "600 10px var(--font-sans)", color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".06em" }}>CIN</span>
                    <input type="text" value={manualChallan.cin} onChange={e => setManualChallan(c => ({ ...c, cin: e.target.value }))}
                           style={{ height: 28, padding: "0 8px", borderRadius: 5, border: "1px solid var(--line)", font: "500 11px var(--font-mono)", background: "var(--bg-panel)" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ font: "600 10px var(--font-sans)", color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".06em" }}>BSR code</span>
                    <input type="text" value={manualChallan.bsr} onChange={e => setManualChallan(c => ({ ...c, bsr: e.target.value }))}
                           style={{ height: 28, padding: "0 8px", borderRadius: 5, border: "1px solid var(--line)", font: "500 11px var(--font-mono)", background: "var(--bg-panel)" }} />
                  </label>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 460, overflowY: "auto", paddingRight: 4 }}>
                {scoredTxns.map(t => {
                  const isSel = txnId === t.id;
                  const isUsed = usedTxnIds.has(t.id);
                  return (
                    <div key={t.id}
                         onClick={() => !isUsed && setTxnId(t.id)}
                         role="button" tabIndex={isUsed ? -1 : 0}
                         onKeyDown={e => { if (!isUsed && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setTxnId(t.id); } }}
                         style={{
                           padding: "9px 10px",
                           borderRadius: 8,
                           border: "1.5px solid " + (isSel ? "var(--accent)" : "var(--line)"),
                           background: isUsed ? "var(--bg-sunken)" : isSel ? "var(--accent-soft-bg)" : "var(--bg-panel)",
                           opacity: isUsed ? 0.55 : 1,
                           cursor: isUsed ? "not-allowed" : "pointer",
                           display: "flex", flexDirection: "column", gap: 4,
                         }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span aria-hidden style={{ width: 14, height: 14, borderRadius: 999, border: "2px solid " + (isSel ? "var(--accent)" : "var(--ink-muted)"), background: isSel ? "var(--accent)" : "transparent", flexShrink: 0, position: "relative" }}>
                          {isSel ? <span style={{ position: "absolute", inset: 2, borderRadius: 999, background: "white" }}></span> : null}
                        </span>
                        <span style={{ font: "700 13px var(--font-sans)", color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0 }} title={t.vendor || "Unknown payee"}>
                          {t.vendor ? "→ " + t.vendor : <span style={{ color: "var(--ink-muted)", fontStyle: "italic", fontWeight: 600 }}>→ Unknown payee</span>}
                        </span>
                        {t.vendor && t.vendorConf < 0.85 ? (
                          <span title={"Payee inferred · " + Math.round(t.vendorConf * 100) + "%"}
                                style={{ font: "700 9px var(--font-sans)", color: "#b8770b", background: "rgba(245,158,11,.14)", padding: "2px 5px", borderRadius: 3, textTransform: "uppercase", letterSpacing: ".06em", flexShrink: 0 }}>
                            ~{Math.round(t.vendorConf * 100)}%
                          </span>
                        ) : null}
                        <span style={{ font: "700 13px var(--font-mono)", color: "var(--ink)", flexShrink: 0 }}>− {window.inrFmt(t.amount)}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 22, flexWrap: "wrap" }}>
                        <span style={{ font: "500 11px var(--font-sans)", color: "var(--ink-soft)" }}>{t.date}</span>
                        <span style={{ font: "600 11px var(--font-mono)", color: "var(--ink-soft)" }}>CIN {t.cin}</span>
                        <span style={{ font: "500 11px var(--font-sans)", color: "var(--ink-muted)" }}>· {t.account}</span>
                        {isUsed ? <span style={{ font: "700 9px var(--font-sans)", color: "var(--ink-soft)", padding: "1px 5px", borderRadius: 3, background: "var(--bg-panel)", border: "1px solid var(--line)", textTransform: "uppercase", letterSpacing: ".06em" }}>already mapped</span> : null}
                      </div>
                      <div style={{ font: "500 10.5px var(--font-mono)", color: "var(--ink-muted)", paddingLeft: 22, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={t.desc}>
                        <span style={{ font: "600 9px var(--font-sans)", color: "var(--ink-muted)", marginRight: 6, textTransform: "uppercase", letterSpacing: ".06em" }}>narration</span>
                        {t.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right — pick which dues this challan covers */}
          <div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ font: "600 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)" }}>2 · Tick dues this challan covers · {selected.size} of {dues.length}</span>
              <span style={{ font: "500 11px var(--font-sans)", color: "var(--ink-soft)" }}>Auto-allocates by due date</span>
            </div>

            {challanAmount === 0 ? (
              <div style={{ padding: 14, borderRadius: 8, border: "1px dashed var(--line)", font: "500 12px var(--font-sans)", color: "var(--ink-muted)", textAlign: "center" }}>Pick a debit on the left to start allocating.</div>
            ) : null}

            <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 460, overflowY: "auto", paddingRight: 4, opacity: challanAmount === 0 ? 0.5 : 1, pointerEvents: challanAmount === 0 ? "none" : "auto" }}>
              {dues.map(d => {
                const checked = selected.has(d.id);
                const rem = remaining(d);
                const alloc = allocations.find(a => a.dueId === d.id);
                const allocAmt = alloc ? alloc.amount : 0;
                const isAuto = alloc ? alloc.auto : true;
                const fullyCovered = checked && allocAmt >= rem - 1;
                const partial = checked && allocAmt > 0 && allocAmt < rem;
                return (
                  <div key={d.id}
                       onClick={(e) => { if (e.target.tagName !== "INPUT" && e.target.tagName !== "BUTTON") toggleDue(d.id); }}
                       role="button" tabIndex={0}
                       onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleDue(d.id); } }}
                       style={{
                         padding: "9px 10px",
                         borderRadius: 8,
                         border: "1px solid " + (checked ? "var(--accent)" : "var(--line)"),
                         background: checked ? "var(--accent-soft-bg)" : "var(--bg-panel)",
                         cursor: "pointer",
                         display: "flex", flexDirection: "column", gap: 5,
                       }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span aria-hidden style={{ width: 16, height: 16, borderRadius: 4, border: "1.5px solid " + (checked ? "var(--accent)" : "var(--ink-muted)"), background: checked ? "var(--accent)" : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {checked ? <span className="material-symbols-outlined" style={{ fontSize: 13, color: "white", fontWeight: 800 }}>check</span> : null}
                      </span>
                      <span style={{ font: "700 13px var(--font-sans)", color: "var(--ink)", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.who}</span>
                      <span style={{ font: "700 11px var(--font-mono)", color: "var(--accent)", padding: "1px 5px", border: "1px solid var(--accent)", borderRadius: 3, flexShrink: 0 }}>{d.sec}</span>
                      <span style={{ font: "500 11px var(--font-mono)", color: "var(--ink-soft)", flexShrink: 0 }}>due {d.by.split("-").slice(0, 2).join("-")}</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 24 }}>
                      <span style={{ font: "500 11px var(--font-sans)", color: "var(--ink-soft)" }}>Outstanding</span>
                      <span style={{ font: "600 12px var(--font-mono)", color: "var(--ink)" }}>{window.inrFmt(rem)}</span>
                      {checked ? (
                        <>
                          <span style={{ marginLeft: "auto", font: "500 11px var(--font-sans)", color: "var(--ink-soft)" }}>Allocate</span>
                          <input
                            type="number"
                            value={allocAmt || ""}
                            onClick={e => e.stopPropagation()}
                            onChange={e => setOverride(d.id, +e.target.value)}
                            style={{
                              width: 100, height: 26, padding: "0 6px", borderRadius: 4,
                              border: "1px solid " + (fullyCovered ? "var(--emerald)" : partial ? "#b8770b" : "var(--line)"),
                              font: "700 12px var(--font-mono)",
                              color: fullyCovered ? "var(--emerald)" : partial ? "#b8770b" : "var(--ink)",
                              textAlign: "right",
                              background: "var(--bg-panel)",
                            }}
                          />
                          {!isAuto ? (
                            <button onClick={e => { e.stopPropagation(); clearOverride(d.id); }}
                                    title="Reset to auto"
                                    style={{ height: 22, padding: "0 6px", borderRadius: 3, border: "1px solid var(--line)", background: "var(--bg-panel)", font: "600 9px var(--font-sans)", color: "var(--ink-soft)", cursor: "pointer", textTransform: "uppercase", letterSpacing: ".06em" }}>
                              auto
                            </button>
                          ) : (
                            <span style={{ font: "600 9px var(--font-sans)", color: "var(--ink-muted)", padding: "2px 5px", borderRadius: 3, background: "var(--bg-sunken)", textTransform: "uppercase", letterSpacing: ".06em" }}>auto</span>
                          )}
                        </>
                      ) : null}
                    </div>

                    {checked ? (
                      <div style={{ paddingLeft: 24, font: "600 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".06em" }}>
                        {fullyCovered ? <span style={{ color: "var(--emerald)" }}>fully covered by this challan</span>
                          : partial ? <span style={{ color: "#b8770b" }}>partial · {window.inrFmt(rem - allocAmt)} still owed</span>
                          : allocAmt === 0 ? <span style={{ color: "var(--warn)" }}>nothing allocated · increase challan or remove this due</span>
                          : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Foot */}
        <div className="modal-foot" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!challanAmount ? (
            <span style={{ font: "500 12px var(--font-sans)", color: "var(--ink-muted)" }}>Pick a CBDT debit to start.</span>
          ) : selected.size === 0 ? (
            <span style={{ font: "500 12px var(--font-sans)", color: "#b8770b" }}>Tick at least one due — challan amount <ChallanPill /> will split across them.</span>
          ) : overAllocated ? (
            <span style={{ font: "600 12px var(--font-sans)", color: "var(--warn)" }}>Allocated <span className="lb-mono">{window.inrFmt(allocTotal)}</span> exceeds challan <ChallanPill /> by <span className="lb-mono">{window.inrFmt(-unallocated)}</span></span>
          ) : !fullyAllocated ? (
            <span style={{ font: "500 12px var(--font-sans)", color: "#b8770b" }}>
              <span className="lb-mono">{window.inrFmt(unallocated)}</span> of challan <ChallanPill /> still unallocated · add more dues or increase amounts
            </span>
          ) : (
            <span style={{ font: "600 12px var(--font-sans)", color: "var(--emerald)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: "middle" }}>check_circle</span>
              &nbsp;Challan <ChallanPill /> fully allocated across {selected.size} due{selected.size === 1 ? "" : "s"}
            </span>
          )}
          <span style={{ flex: 1 }} />
          <button onClick={onClose} style={{ height: 32, padding: "0 14px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--ink)", font: "600 13px var(--font-sans)", cursor: "pointer" }}>Cancel</button>
          <button onClick={finish}
                  disabled={!fullyAllocated || selected.size === 0}
                  style={{
                    height: 32, padding: "0 16px", borderRadius: 8, border: 0,
                    background: !fullyAllocated || selected.size === 0 ? "var(--ink-muted)" : "var(--accent)",
                    color: "white", font: "700 13px var(--font-sans)",
                    cursor: !fullyAllocated || selected.size === 0 ? "not-allowed" : "pointer",
                    opacity: !fullyAllocated || selected.size === 0 ? 0.6 : 1,
                  }}>
            Map challan to {selected.size} due{selected.size === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );
}
window.TdsBankMapModal = TdsBankMapModal;
