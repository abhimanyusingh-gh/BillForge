// RecordPaymentModal.jsx — bank-reconciliation mapper for an invoice. Pick from unmapped bank
// transactions, record partial / multi-payment settlements, surface the running balance.
// `embedded` flag drops the modal scrim/header/footer so this can render inside a tab panel.
function RecordPaymentModal({ invoice, onClose, onSave, seedPayments, embedded }) {
  const inv = invoice || window.INVOICES.find(i => i.status !== "exported") || window.INVOICES[0];
  const initialSeed = Array.isArray(seedPayments) ? seedPayments : [];
  const [payments, setPayments] = React.useState(initialSeed);
  const [manualOpen, setManualOpen] = React.useState(false);
  const [draft, setDraft] = React.useState({
    date: "27-Apr-2026",
    amount: Math.max(0, (inv.net || 0) - seedPayments.reduce((s, p) => s + p.amount, 0)),
    mode: "NEFT",
    utr: "",
    account: "HDFC Current ··2034",
    linkedTxn: "",
    note: "",
  });

  // Available bank transactions to link (debits across the tenant's bank accounts)
  // `vendor` is the company we believe the debit went to (extracted from description / payee master)
  const bankTxns = [
    { id: "t_seed1", date: "20-Apr-2026", account: "HDFC Current ··2034", vendor: "Reliance Jio Infocomm",     vendorConf: 0.97, desc: "NEFT/N164020/RELIANCE JIO/PART-1",   utr: "N164020", amount: 41778000 },
    { id: "t1",      date: "27-Apr-2026", account: "HDFC Current ··2034", vendor: "Reliance Jio Infocomm",     vendorConf: 0.99, desc: "NEFT/N164520/RELIANCE JIO INFOCOMM", utr: "N164520", amount: 41778000 },
    { id: "t1b",     date: "27-Apr-2026", account: "ICICI Current ··2419", vendor: "Reliance Jio Infocomm",    vendorConf: 0.92, desc: "RTGS/IRR526/RELIANCE JIO/FINAL",    utr: "IRR526",  amount: 41778000 },
    { id: "t2",      date: "26-Apr-2026", account: "HDFC Current ··2034", vendor: "Mahalakshmi Power Loom",    vendorConf: 0.98, desc: "NEFT/N163780/MAHALAKSHMI POWER LOOM", utr: "N163780", amount: 11404800 },
    { id: "t3",      date: "25-Apr-2026", account: "ICICI Current ··2419", vendor: "Reliance Jio Infocomm",    vendorConf: 0.71, desc: "ACH/TPSL/RELIANCE JIO 9000444112",   utr: "TPSL-J",  amount: 83556000 },
    { id: "t4",      date: "24-Apr-2026", account: "HDFC Current ··2034", vendor: "Patel & Patel Logistics",   vendorConf: 0.88, desc: "NEFT/N162018/PATEL LOGISTICS",        utr: "N162018", amount: 720000   },
    { id: "t5",      date: "22-Apr-2026", account: "HDFC Current ··2034", vendor: "Tata Consultancy Services", vendorConf: 0.95, desc: "RTGS/N162900/TATA CONSULTANCY SVC",   utr: "N162900", amount: 42480000 },
    { id: "t6",      date: "21-Apr-2026", account: "ICICI Current ··2419", vendor: "Sundaram Stationers",      vendorConf: 0.62, desc: "UPI/sundaram@hdfc/STATIONERY",       utr: "UPI8821", amount: 3998400  },
    { id: "t7",      date: "19-Apr-2026", account: "HDFC Current ··2034", vendor: null,                        vendorConf: 0,    desc: "NEFT/N161522/REF: ADJ-99-X",          utr: "N161522", amount: 250000   },
  ];

  const accounts = ["HDFC Current ··2034", "ICICI Current ··2419", "SBI Current ··8842"];
  const modes = ["NEFT", "RTGS", "UPI", "IMPS", "Cheque", "Cash", "Adjustment / Credit note"];

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, (inv.net || 0) - totalPaid);
  const overpay = totalPaid > (inv.net || 0);
  const settled = !overpay && balance === 0;

  const inputCss = { height: 30, padding: "0 10px", border: "1px solid var(--line)", background: "var(--bg-main)", color: "var(--ink)", borderRadius: 6, font: "500 12.5px var(--font-mono)", outline: "none", width: "100%" };
  const labelCss = { display: "flex", flexDirection: "column", gap: 4 };
  const labelText = { font: "600 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)" };

  // Bank txns already mapped to OTHER invoices in the wider system (would come from ledger in real app)
  const usedByOthers = new Set(["t_seed2"]);
  const usedHere = new Set(payments.map(p => p.linkedTxn).filter(Boolean));

  const setAmount = (rupees) => {
    const n = Math.round((parseFloat(rupees) || 0) * 100);
    setDraft({ ...draft, amount: n });
  };

  const linkTxn = (txn) => {
    setManualOpen(true);
    setDraft({
      ...draft,
      linkedTxn: txn.id,
      utr: txn.utr,
      date: txn.date,
      account: txn.account,
      mode: txn.desc.startsWith("RTGS") ? "RTGS" : txn.desc.startsWith("UPI") ? "UPI" : txn.desc.startsWith("ACH") ? "NEFT" : "NEFT",
      amount: Math.min(balance || txn.amount, txn.amount),
    });
  };

  const addPayment = () => {
    if (!draft.amount || draft.amount <= 0) return;
    setPayments(prev => [...prev, { id: "p" + Date.now(), ...draft }]);
    setDraft({
      date: "27-Apr-2026",
      amount: Math.max(0, balance - draft.amount),
      mode: "NEFT",
      utr: "",
      account: draft.account,
      linkedTxn: "",
      note: "",
    });
  };

  const removePayment = (id) => setPayments(prev => prev.filter(p => p.id !== id));

  // Multiselect of bank transactions to map in one go
  const [selected, setSelected] = React.useState(() => new Set());
  const toggleSelected = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const clearSelection = () => setSelected(new Set());

  const addSelectedAsPayments = () => {
    if (selected.size === 0) return;
    const txns = bankTxns.filter(t => selected.has(t.id));
    const now = Date.now();
    let remaining = balance;
    const newPayments = txns.map((t, i) => {
      // For the LAST txn, cap at remaining balance to avoid auto-overpay (user can edit later).
      // For preceding txns, take their full amount.
      const isLast = i === txns.length - 1;
      let amt = t.amount;
      if (isLast && remaining > 0 && remaining < t.amount) amt = remaining;
      remaining = Math.max(0, remaining - amt);
      const mode = t.desc.startsWith("RTGS") ? "RTGS" : t.desc.startsWith("UPI") ? "UPI" : t.desc.startsWith("ACH") ? "NEFT" : "NEFT";
      return { id: "p" + now + "_" + i, date: t.date, amount: amt, mode, utr: t.utr, account: t.account, linkedTxn: t.id, note: "" };
    });
    setPayments(prev => [...prev, ...newPayments]);
    setSelected(new Set());
    // Reset draft amount to new balance after these are added
    const totalAdded = newPayments.reduce((s, p) => s + p.amount, 0);
    setDraft(prev => ({ ...prev, amount: Math.max(0, balance - totalAdded), linkedTxn: "", utr: "" }));
  };

  const finish = () => {
    onSave?.({ invoiceId: inv.id, payments, settled });
    onClose?.();
  };

  // Bank txn suggestions: hide ones used by OTHER invoices or already linked here
  const suggested = bankTxns
    .filter(t => !usedByOthers.has(t.id) && !usedHere.has(t.id))
    .map(t => {
      let score = 0;
      if (Math.abs(t.amount - balance) < 10) score += 0.7;
      if (Math.abs(t.amount - (inv.net || 0)) < 10) score += 0.3;
      if (t.desc.toUpperCase().includes(inv.vendor.toUpperCase().split(" ")[0])) score += 0.3;
      return { ...t, score };
    })
    .sort((a, b) => b.score - a.score);

  // Auto-save in embedded mode whenever the payment list changes
  React.useEffect(() => {
    if (!embedded) return;
    onSave?.({ invoiceId: inv.id, payments });
    // eslint-disable-next-line
  }, [embedded, payments]);

  const Shell = embedded
    ? ({ children }) => (
        <div style={{ background: "var(--bg-panel)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {children}
        </div>
      )
    : ({ children }) => (
        <div className="scrim" onClick={onClose}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ width: 880, maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
            {children}
          </div>
        </div>
      );

  return (
    <Shell>
        {/* Head — only when not embedded; tab strip already labels the section */}
        {!embedded ? (
          <div className="modal-head">
            <div>
              <h2>Map to bank transactions</h2>
              <div style={{ font: "500 12px var(--font-sans)", color: "var(--ink-soft)", marginTop: 2 }}>
                <span className="lb-mono" style={{ color: "var(--accent)" }}>{inv.number}</span> · {inv.vendor} · net payable <span className="lb-mono" style={{ color: "var(--ink)" }}>{window.inrFmt(inv.net)}</span> · pick unmapped debits below or record manually
              </div>
            </div>
            <button className="iconbtn" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
          </div>
        ) : null}

        {/* Summary strip */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 1, background: "var(--line)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
          {[
            { label: "Net payable",    val: window.inrFmt(inv.net),     color: "var(--ink)" },
            { label: "Already paid",   val: window.inrFmt(totalPaid),   color: "var(--emerald)" },
            { label: "Balance due",    val: window.inrFmt(balance),     color: balance > 0 ? "var(--warn)" : "var(--emerald)" },
            { label: "Status",         val: overpay ? "OVERPAID" : settled ? "FULLY PAID" : payments.length ? "PARTIAL" : "UNPAID", color: overpay ? "var(--warn)" : settled ? "var(--emerald)" : payments.length ? "#b8770b" : "var(--ink-soft)" },
          ].map((m, i) => (
            <div key={i} style={{ background: "var(--bg-panel)", padding: "10px 14px" }}>
              <div style={{ font: "600 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)" }}>{m.label}</div>
              <div style={{ font: i === 3 ? "700 13px var(--font-sans)" : "700 16px var(--font-mono)", color: m.color, marginTop: 4 }}>{m.val}</div>
            </div>
          ))}
        </div>

        <div className="modal-body" style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 16, overflowY: embedded ? "visible" : "auto", padding: embedded ? 16 : undefined }}>
          {/* Left: payment ledger + add new */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ font: "600 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)", marginBottom: 6 }}>Payments recorded · {payments.length}</div>
              {payments.length ? (
                <div style={{ border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
                  <table className="lbtable" style={{ width: "100%" }}>
                    <thead>
                      <tr>
                        <th style={{ width: 100 }}>Date</th>
                        <th>Mode / UTR</th>
                        <th style={{ width: 120, textAlign: "right" }}>Amount</th>
                        <th style={{ width: 110 }}>Bank txn</th>
                        <th style={{ width: 28 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map(p => (
                        <tr key={p.id}>
                          <td className="mono-cell" style={{ color: "var(--ink-soft)" }}>{p.date}</td>
                          <td>
                            <div style={{ font: "600 12px var(--font-sans)", color: "var(--ink)" }}>{p.mode}</div>
                            <div style={{ font: "500 11px var(--font-mono)", color: "var(--ink-soft)" }}>{p.utr || "—"} · {p.account}</div>
                          </td>
                          <td className="num-cell" style={{ font: "700 13px var(--font-mono)", color: "var(--emerald)" }}>+ {window.inrFmt(p.amount)}</td>
                          <td>
                            {p.linkedTxn ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 7px", background: "var(--accent-soft-bg)", color: "var(--accent)", borderRadius: 4, font: "600 10px var(--font-mono)" }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>link</span>{p.linkedTxn}
                              </span>
                            ) : (
                              <span style={{ font: "500 11px var(--font-sans)", color: "var(--warn)" }}>not linked</span>
                            )}
                          </td>
                          <td>
                            <button onClick={() => removePayment(p.id)} className="iconbtn" style={{ width: 24, height: 24 }} title="Remove"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: "10px 12px", borderRadius: 8, border: "1px dashed var(--line)", font: "500 12px var(--font-sans)", color: "var(--ink-muted)", textAlign: "center" }}>No payments recorded yet — add one below.</div>
              )}
            </div>

            {/* Add new payment — collapsed by default; opens via button */}
            {!manualOpen ? (
              <button onClick={() => setManualOpen(true)}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 38, borderRadius: 8, border: "1px dashed var(--line)", background: "var(--bg-panel)", color: "var(--accent)", font: "600 12.5px var(--font-sans)", cursor: "pointer" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
                Add payment manually
                <span style={{ font: "500 11px var(--font-sans)", color: "var(--ink-muted)", marginLeft: 4 }}>· cash, cheque, or off-system transfer</span>
              </button>
            ) : (
            <div style={{ background: "var(--bg-panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ font: "700 12px var(--font-sans)", color: "var(--ink)" }}>Add payment</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ font: "500 11px var(--font-sans)", color: balance > 0 ? "var(--warn)" : "var(--ink-soft)" }}>Balance · {window.inrFmt(balance)}</span>
                  <button onClick={() => { setManualOpen(false); setDraft({ ...draft, linkedTxn: "", utr: "", note: "" }); }}
                          className="iconbtn" title="Close manual entry" style={{ width: 22, height: 22 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={labelCss}>
                  <span style={labelText}>Payment date</span>
                  <input type="text" style={inputCss} value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} />
                </label>
                <label style={labelCss}>
                  <span style={labelText}>Amount (₹)</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <input type="text" style={{ ...inputCss, textAlign: "right" }} value={(draft.amount / 100).toFixed(2)} onChange={e => setAmount(e.target.value)} />
                    <button onClick={() => setDraft({ ...draft, amount: balance })} style={{ height: 30, padding: "0 8px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--accent)", font: "600 11px var(--font-sans)", cursor: "pointer", whiteSpace: "nowrap" }}>Full</button>
                    <button onClick={() => setDraft({ ...draft, amount: Math.round(balance / 2) })} style={{ height: 30, padding: "0 8px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--accent)", font: "600 11px var(--font-sans)", cursor: "pointer", whiteSpace: "nowrap" }}>½</button>
                  </div>
                </label>
                <label style={labelCss}>
                  <span style={labelText}>Mode</span>
                  <select style={{ ...inputCss, font: "600 12.5px var(--font-sans)" }} value={draft.mode} onChange={e => setDraft({ ...draft, mode: e.target.value })}>
                    {modes.map(m => <option key={m}>{m}</option>)}
                  </select>
                </label>
                <label style={labelCss}>
                  <span style={labelText}>UTR / reference</span>
                  <input type="text" style={inputCss} value={draft.utr} onChange={e => setDraft({ ...draft, utr: e.target.value })} placeholder="e.g. N164520" />
                </label>
                <label style={{ ...labelCss, gridColumn: "1 / -1" }}>
                  <span style={labelText}>From bank account</span>
                  <select style={{ ...inputCss, font: "600 12.5px var(--font-sans)" }} value={draft.account} onChange={e => setDraft({ ...draft, account: e.target.value })}>
                    {accounts.map(a => <option key={a}>{a}</option>)}
                  </select>
                </label>
                <label style={{ ...labelCss, gridColumn: "1 / -1" }}>
                  <span style={labelText}>Note (optional)</span>
                  <input type="text" style={{ ...inputCss, font: "500 12.5px var(--font-sans)" }} value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} placeholder="e.g. Part 2 of 2 · final settlement" />
                </label>
              </div>

              {draft.linkedTxn ? (
                <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 6, background: "var(--accent-soft-bg)", border: "1px solid var(--accent)", display: "flex", alignItems: "center", gap: 8, font: "500 12px var(--font-sans)", color: "var(--ink)" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--accent)" }}>link</span>
                  <span>Linked to bank transaction <span className="lb-mono" style={{ color: "var(--accent)", fontWeight: 700 }}>{draft.linkedTxn}</span></span>
                  <button onClick={() => setDraft({ ...draft, linkedTxn: "", utr: "" })} style={{ marginLeft: "auto", font: "600 11px var(--font-sans)", color: "var(--warn)", background: "transparent", border: 0, cursor: "pointer" }}>Unlink</button>
                </div>
              ) : null}

              <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                <button onClick={addPayment} disabled={!draft.amount} style={{ flex: 1, height: 34, borderRadius: 8, border: 0, background: draft.amount ? "var(--accent)" : "var(--bg-sunken)", color: draft.amount ? "white" : "var(--ink-muted)", font: "700 13px var(--font-sans)", cursor: draft.amount ? "pointer" : "not-allowed" }}>
                  + Add payment {draft.amount ? "· " + window.inrFmt(draft.amount) : ""}
                </button>
              </div>
            </div>
            )}
          </div>

          {/* Right: link to bank transactions (multiselect) */}
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ font: "600 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)" }}>Unmapped bank transactions · {suggested.length}</span>
              <span style={{ font: "500 11px var(--font-sans)", color: "var(--ink-muted)" }}>Tick one or many to map</span>
            </div>

            {/* Selection summary — sticky CTA */}
            {selected.size > 0 ? (() => {
              const sel = suggested.filter(t => selected.has(t.id));
              const selTotal = sel.reduce((s, t) => s + t.amount, 0);
              const exact = Math.abs(selTotal - balance) < 10;
              const over = selTotal > balance;
              return (
                <div style={{ marginBottom: 6, padding: "9px 10px", borderRadius: 8, background: "var(--accent-soft-bg)", border: "1px solid var(--accent)", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, font: "500 12px var(--font-sans)", color: "var(--ink)" }}>
                    <span style={{ font: "700 12px var(--font-sans)", color: "var(--accent)" }}>{selected.size} selected</span>
                    <span style={{ color: "var(--ink-muted)" }}>·</span>
                    <span className="lb-mono" style={{ font: "700 13px var(--font-mono)", color: exact ? "var(--emerald)" : over ? "var(--warn)" : "var(--ink)" }}>
                      {window.inrFmt(selTotal)}
                    </span>
                    <span style={{ marginLeft: "auto", font: "600 11px var(--font-sans)", color: exact ? "var(--emerald)" : over ? "var(--warn)" : "#b8770b", textTransform: "uppercase", letterSpacing: ".06em" }}>
                      {exact ? "matches balance" : over ? "exceeds balance by " + window.inrFmt(selTotal - balance) : "covers " + Math.round(Math.min(100, selTotal / Math.max(1, balance) * 100)) + "% of balance"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={addSelectedAsPayments}
                            style={{ flex: 1, height: 30, borderRadius: 6, border: 0, background: "var(--accent)", color: "white", font: "700 12px var(--font-sans)", cursor: "pointer" }}>
                      + Map {selected.size} txn{selected.size === 1 ? "" : "s"} as payment{selected.size === 1 ? "" : "s"}
                    </button>
                    <button onClick={clearSelection}
                            style={{ height: 30, padding: "0 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--ink-soft)", font: "600 11px var(--font-sans)", cursor: "pointer" }}>
                      Clear
                    </button>
                  </div>
                </div>
              );
            })() : null}

            <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 360, overflowY: "auto", paddingRight: 4 }}>
              {suggested.map(t => {
                const checked = selected.has(t.id);
                const exact = Math.abs(t.amount - balance) < 10;
                return (
                  <div key={t.id} onClick={() => toggleSelected(t.id)}
                       role="button" tabIndex={0}
                       onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleSelected(t.id); } }}
                       style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 5, padding: "9px 10px", border: "1px solid " + (checked ? "var(--accent)" : "var(--line)"), background: checked ? "var(--accent-soft-bg)" : "var(--bg-panel)", borderRadius: 8, cursor: "pointer", userSelect: "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span aria-hidden style={{ width: 16, height: 16, borderRadius: 4, border: "1.5px solid " + (checked ? "var(--accent)" : "var(--ink-muted)"), background: checked ? "var(--accent)" : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {checked ? <span className="material-symbols-outlined" style={{ fontSize: 13, color: "white", fontWeight: 800 }}>check</span> : null}
                      </span>
                      <span style={{ font: "700 13px var(--font-sans)", color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0 }} title={t.vendor || "Unknown payee"}>
                        {t.vendor ? "→ " + t.vendor : <span style={{ color: "var(--ink-muted)", fontStyle: "italic", fontWeight: 600 }}>→ Unknown payee</span>}
                      </span>
                      {t.vendor && t.vendorConf < 0.85 ? (
                        <span title={"Vendor inferred from description with " + Math.round(t.vendorConf * 100) + "% confidence"}
                              style={{ font: "700 9px var(--font-sans)", color: "#b8770b", background: "rgba(245,158,11,.14)", padding: "2px 5px", borderRadius: 3, textTransform: "uppercase", letterSpacing: ".06em", flexShrink: 0 }}>
                          ~{Math.round(t.vendorConf * 100)}%
                        </span>
                      ) : null}
                      <span style={{ font: "700 13px var(--font-mono)", color: exact ? "var(--emerald)" : "var(--ink)", flexShrink: 0 }}>− {window.inrFmt(t.amount)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 24, flexWrap: "wrap" }}>
                      <span style={{ font: "500 11px var(--font-sans)", color: "var(--ink-soft)" }}>{t.date}</span>
                      <span style={{ font: "600 11px var(--font-mono)", color: "var(--ink-soft)" }}>{t.utr}</span>
                      <span style={{ font: "500 11px var(--font-sans)", color: "var(--ink-muted)" }}>· {t.account}</span>
                    </div>
                    <div style={{ font: "500 10.5px var(--font-mono)", color: "var(--ink-muted)", paddingLeft: 24, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: ".01em" }} title={t.desc}>
                      <span style={{ font: "600 9px var(--font-sans)", color: "var(--ink-muted)", marginRight: 6, textTransform: "uppercase", letterSpacing: ".06em" }}>narration</span>
                      {t.desc}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 24 }}>
                      {exact ? (
                        <span style={{ font: "600 10px var(--font-sans)", color: "var(--emerald)", textTransform: "uppercase", letterSpacing: ".06em" }}>matches balance exactly</span>
                      ) : t.score > 0.3 ? (
                        <span style={{ font: "600 10px var(--font-sans)", color: "#b8770b", textTransform: "uppercase", letterSpacing: ".06em" }}>vendor name match · {Math.round(t.score * 100)}%</span>
                      ) : null}
                      <span style={{ marginLeft: "auto" }}>
                        <button onClick={e => { e.stopPropagation(); linkTxn(t); }}
                                title="Use this txn to fill the Add payment form"
                                style={{ font: "600 10px var(--font-sans)", color: "var(--accent)", background: "transparent", border: 0, cursor: "pointer", textTransform: "uppercase", letterSpacing: ".06em" }}>
                          Use in form ↑
                        </button>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 6, background: "var(--bg-sunken)", font: "500 11px var(--font-sans)", color: "var(--ink-soft)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4, color: "var(--accent)" }}>info</span>
              Tick multiple debits to settle a single invoice with several transactions (split-tender). Each becomes a recorded payment and is marked reconciled.
            </div>
          </div>
        </div>

        {/* Foot — embedded mode shows a status strip only; modal mode shows action buttons */}
        {embedded ? (
          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--line)", background: "var(--bg-sunken)", display: "flex", alignItems: "center", gap: 10, font: "500 12px var(--font-sans)", color: "var(--ink-soft)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--accent)" }}>save</span>
            <span>Changes auto-save · {payments.length} payment{payments.length === 1 ? "" : "s"} recorded · {window.inrFmt(totalPaid)} of {window.inrFmt(inv.net)}</span>
            {settled ? <span style={{ color: "var(--emerald)", fontWeight: 700 }}>· FULLY PAID</span> : null}
            {overpay ? <span style={{ color: "var(--warn)", fontWeight: 700 }}>· OVERPAID by {window.inrFmt(totalPaid - inv.net)}</span> : null}
          </div>
        ) : (
          <div className="modal-foot" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ font: "500 12px var(--font-sans)", color: "var(--ink-soft)" }}>
              {payments.length} payment{payments.length === 1 ? "" : "s"} · {window.inrFmt(totalPaid)} of {window.inrFmt(inv.net)}
              {settled ? <span style={{ color: "var(--emerald)", fontWeight: 700, marginLeft: 6 }}>· Will mark FULLY PAID</span> : null}
              {overpay ? <span style={{ color: "var(--warn)", fontWeight: 700, marginLeft: 6 }}>· OVERPAID by {window.inrFmt(totalPaid - inv.net)}</span> : null}
            </span>
            <span style={{ flex: 1 }} />
            <button onClick={onClose} style={{ height: 32, padding: "0 14px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--ink)", font: "600 13px var(--font-sans)", cursor: "pointer" }}>Cancel</button>
            <button onClick={finish} style={{ height: 32, padding: "0 16px", borderRadius: 8, border: 0, background: "var(--accent)", color: "white", font: "700 13px var(--font-sans)", cursor: "pointer" }}>{settled ? "Save & mark settled" : payments.length ? "Save mapping" : "Save"}</button>
          </div>
        )}
    </Shell>
  );
}
window.RecordPaymentModal = RecordPaymentModal;
