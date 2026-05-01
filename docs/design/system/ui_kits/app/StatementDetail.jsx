// StatementDetail.jsx — extracted transactions in a statement + match-to-invoice
function StatementDetail({ stmt, onClose }) {
  // Synthesised line items for the statement
  const baseTxns = [
    { id: "t1",  date: "27-Apr-2026", desc: "NEFT/N164520/TATA CONSULTANCY/INV-2603-0009",        ref: "N164520", debit: 42480000, credit: 0, balance: 18420000, matchTo: "i_tcs", confidence: 0.98, state: "matched" },
    { id: "t2",  date: "27-Apr-2026", desc: "RTGS/HDFCR526/MAHALAKSHMI POWER LOOM/INV-MPL-1842",  ref: "HDFCR526", debit: 11404800, credit: 0, balance: 60900000, matchTo: "i_mahaloom", confidence: 0.94, state: "matched" },
    { id: "t3",  date: "26-Apr-2026", desc: "UPI/421894/GST PMT-06/CHALLAN-2604",                  ref: "421894",   debit: 14820000, credit: 0, balance: 72304800, matchTo: null, confidence: 0,    state: "ledger", suggestedLedger: "GST Payable" },
    { id: "t4",  date: "26-Apr-2026", desc: "NEFT IN/SUNDARAM EXP/B2B SETTLEMENT",                 ref: "N164019", debit: 0, credit: 8800000, balance: 87124800, matchTo: null, confidence: 0,    state: "ledger", suggestedLedger: "Customer Receipts · Sundaram Exports" },
    { id: "t5",  date: "25-Apr-2026", desc: "ACH/TPSL/RELIANCE JIO 9000444112",                    ref: "TPSL-J",   debit: 83556000, credit: 0, balance: 78324800, matchTo: "i_jio",  confidence: 0.91, state: "suggested" },
    { id: "t6",  date: "25-Apr-2026", desc: "NEFT OUT/N163422/AMOUNT 39,98,400",                   ref: "N163422",  debit: 3998400, credit: 0, balance: 161880800, matchTo: null,    confidence: 0.62, state: "ambiguous", candidates: ["i_stat", "i_misc"] },
    { id: "t7",  date: "24-Apr-2026", desc: "BANK CHARGES Q-2604",                                 ref: "BCHG",     debit: 4720, credit: 0, balance: 165879200, matchTo: null, confidence: 0, state: "ledger", suggestedLedger: "Bank Charges" },
    { id: "t8",  date: "24-Apr-2026", desc: "INTEREST CREDIT QTR ENDING 31-MAR",                   ref: "INTC",     debit: 0, credit: 122400, balance: 165883920, matchTo: null, confidence: 0, state: "ledger", suggestedLedger: "Interest Income" },
    { id: "t9",  date: "23-Apr-2026", desc: "NEFT/N162018/PATEL LOGISTICS/INV-PL-09314",           ref: "N162018",  debit: 720000, credit: 0, balance: 165761520, matchTo: "i_patel", confidence: 0.88, state: "suggested" },
    { id: "t10", date: "23-Apr-2026", desc: "NEFT/N161780/INNOVA SOFTWARE/INV-INV-0094",           ref: "N161780",  debit: 2480000, credit: 0, balance: 168241520, matchTo: "i_innova", confidence: 0.95, state: "matched" },
    { id: "t11", date: "22-Apr-2026", desc: "INWARD/UTR3902481/UNKNOWN PAYER 4002000",             ref: "UTR3902",  debit: 0, credit: 4002000, balance: 170721520, matchTo: null, confidence: 0, state: "unmatched", note: "Payer not in vendor / customer master" },
    { id: "t12", date: "22-Apr-2026", desc: "NEFT/N161122/BLUEOCEAN MARINE",                       ref: "N161122",  debit: 122400, credit: 0, balance: 166719520, matchTo: "i_blueocean", confidence: 0.86, state: "suggested" },
  ];

  // Invoice candidate pool (drawn from app data)
  const allInvoices = [
    { id: "i_tcs",       no: "INV-2603-0009", vendor: "Tata Consultancy Services", amt: 42480000, due: "30-Apr-2026" },
    { id: "i_mahaloom",  no: "INV-MPL-1842",  vendor: "Mahalakshmi Power Loom",    amt: 11404800, due: "29-Apr-2026" },
    { id: "i_jio",       no: "INV-JIO-2604",  vendor: "Reliance Jio Infocomm",     amt: 83556000, due: "26-Apr-2026" },
    { id: "i_patel",     no: "INV-PL-09314",  vendor: "Patel & Patel Logistics",   amt: 720000,   due: "25-Apr-2026" },
    { id: "i_innova",    no: "INV-INV-0094",  vendor: "Innova Software Solutions", amt: 2480000,  due: "24-Apr-2026" },
    { id: "i_blueocean", no: "INV-BO-4012",   vendor: "BlueOcean Marine Pvt Ltd",  amt: 122400,   due: "26-Apr-2026" },
    { id: "i_stat",      no: "INV-SS-2604",   vendor: "Sundaram Stationers",       amt: 3998400,  due: "27-Apr-2026" },
    { id: "i_misc",      no: "INV-XPL-0102",  vendor: "Express Logistics",         amt: 3998400,  due: "27-Apr-2026" },
    { id: "i_green",     no: "INV-GLO-7710",  vendor: "Greenleaf Organics",        amt: 81600,    due: "30-Apr-2026" },
    { id: "i_madurai",   no: "INV-MS-2204",   vendor: "Madurai Sweets & Snacks",   amt: 240000,   due: "01-May-2026" },
  ];

  const [txns, setTxns] = React.useState(baseTxns);
  const [activeId, setActiveId] = React.useState(baseTxns.find(t => t.state !== "matched")?.id || baseTxns[0].id);
  const [filter, setFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");

  const counts = {
    all: txns.length,
    matched: txns.filter(t => t.state === "matched").length,
    suggested: txns.filter(t => t.state === "suggested").length,
    ambiguous: txns.filter(t => t.state === "ambiguous").length,
    unmatched: txns.filter(t => t.state === "unmatched").length,
    ledger: txns.filter(t => t.state === "ledger").length,
  };

  const filtered = txns.filter(t => {
    if (filter !== "all" && t.state !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.desc.toLowerCase().includes(q) && !t.ref.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const active = txns.find(t => t.id === activeId) || txns[0];

  const setMatch = (txnId, invId) => setTxns(prev => prev.map(t => t.id === txnId ? { ...t, matchTo: invId, state: invId ? "matched" : "unmatched", confidence: invId ? 1 : 0, candidates: undefined } : t));
  const setLedger = (txnId, ledger) => setTxns(prev => prev.map(t => t.id === txnId ? { ...t, suggestedLedger: ledger, state: "ledger", matchTo: null } : t));

  const stateChip = (s, conf) => {
    const map = {
      matched:    { label: "MATCHED",      cls: "s-approved" },
      suggested:  { label: `MATCH ${Math.round((conf||0)*100)}%`, cls: "s-parsed" },
      ambiguous:  { label: `AMBIGUOUS`,    cls: "s-needs_review" },
      ledger:     { label: "LEDGER ENTRY", cls: "s-pending" },
      unmatched:  { label: "UNMATCHED",    cls: "s-needs_review" },
    };
    const m = map[s] || { label: s.toUpperCase(), cls: "s-pending" };
    return <span className={"spill " + m.cls}><span className="dot"></span>{m.label}</span>;
  };

  const Amount = ({ debit, credit }) => debit ? (
    <span style={{ font: "600 13px var(--font-mono)", color: "var(--warn)" }}>− {window.inrFmt(debit)}</span>
  ) : (
    <span style={{ font: "600 13px var(--font-mono)", color: "var(--emerald)" }}>+ {window.inrFmt(credit)}</span>
  );

  return (
    <div className="scrim" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ position: "absolute", inset: 24, background: "var(--bg-main)", border: "1px solid var(--line)", borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 64px rgba(15,23,42,.32)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: "1px solid var(--line)", background: "var(--bg-panel)" }}>
          <button onClick={onClose} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 10px 0 8px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--ink)", font: "600 12px var(--font-sans)", cursor: "pointer" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
            Back
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 6, font: "500 12px var(--font-sans)", color: "var(--ink-soft)" }}>
            <button onClick={onClose} style={{ background: "transparent", border: 0, color: "var(--accent)", font: "600 12px var(--font-sans)", cursor: "pointer", padding: 0 }}>Bank Statements</button>
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--ink-muted)" }}>chevron_right</span>
            <span className="lb-mono" style={{ color: "var(--ink)" }}>{stmt.file}</span>
          </div>
          <span style={{ marginLeft: 12, font: "500 12px var(--font-sans)", color: "var(--ink-soft)" }}>{stmt.account} · {stmt.period} · {txns.length} transactions</span>
          <div style={{ marginLeft: "auto", display: "inline-flex", gap: 6 }}>
            <button style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--ink)", font: "600 12px var(--font-sans)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4 }}>auto_awesome</span>
              Auto-match all
            </button>
            <button style={{ height: 30, padding: "0 14px", borderRadius: 8, border: 0, background: "var(--accent)", color: "white", font: "600 12px var(--font-sans)" }}>Push to Tally</button>
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ padding: "10px 18px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--line)", background: "var(--bg-panel)" }}>
          <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 360 }}>
            <span className="material-symbols-outlined" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "var(--ink-muted)" }}>search</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search description, UTR…"
                   style={{ width: "100%", height: 30, padding: "0 12px 0 30px", border: "1px solid var(--line)", background: "var(--bg-main)", color: "var(--ink)", borderRadius: 8, font: "500 12.5px var(--font-sans)", outline: "none" }} />
          </div>
          <window.ChipGroup value={filter} onChange={setFilter} options={[
            { id: "all",       label: "All",        count: counts.all },
            { id: "unmatched", label: "Unmatched",  count: counts.unmatched },
            { id: "ambiguous", label: "Ambiguous",  count: counts.ambiguous },
            { id: "suggested", label: "Suggested",  count: counts.suggested },
            { id: "ledger",    label: "Ledger",     count: counts.ledger },
            { id: "matched",   label: "Matched",    count: counts.matched },
          ]} />
        </div>

        {/* Body — split */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", flex: 1, minHeight: 0 }}>
          {/* Transactions list */}
          <div style={{ overflow: "auto", borderRight: "1px solid var(--line)" }}>
            <table className="lbtable" style={{ width: "100%" }}>
              <thead style={{ position: "sticky", top: 0, background: "var(--bg-panel)", zIndex: 2 }}>
                <tr>
                  <th style={{ width: 100 }}>Date</th>
                  <th>Description</th>
                  <th style={{ width: 110 }}>Reference</th>
                  <th style={{ width: 130, textAlign: "right" }}>Amount</th>
                  <th style={{ width: 130, textAlign: "right" }}>Balance</th>
                  <th style={{ width: 200 }}>Matched / suggested</th>
                  <th style={{ width: 130 }}>State</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const inv = t.matchTo ? allInvoices.find(i => i.id === t.matchTo) : null;
                  const isActive = activeId === t.id;
                  return (
                    <tr key={t.id} onClick={() => setActiveId(t.id)} style={{ cursor: "pointer", background: isActive ? "var(--accent-soft-bg)" : undefined }}>
                      <td className="mono-cell" style={{ color: "var(--ink-soft)" }}>{t.date}</td>
                      <td style={{ font: "500 12.5px var(--font-sans)" }}>{t.desc}</td>
                      <td className="mono-cell" style={{ color: "var(--accent)" }}>{t.ref}</td>
                      <td className="num-cell"><Amount debit={t.debit} credit={t.credit} /></td>
                      <td className="num-cell" style={{ color: "var(--ink-soft)" }}>{window.inrFmt(t.balance)}</td>
                      <td>
                        {inv ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                            <span style={{ font: "600 12px var(--font-mono)", color: "var(--accent)" }}>{inv.no}</span>
                            <span style={{ font: "500 11px var(--font-sans)", color: "var(--ink-soft)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{inv.vendor}</span>
                          </div>
                        ) : t.state === "ledger" ? (
                          <span style={{ font: "500 12px var(--font-sans)", color: "var(--ink-soft)", fontStyle: "italic" }}>→ {t.suggestedLedger}</span>
                        ) : t.state === "ambiguous" ? (
                          <span style={{ font: "500 12px var(--font-sans)", color: "#b8770b" }}>{t.candidates?.length} candidates</span>
                        ) : (
                          <span style={{ color: "var(--ink-muted)" }}>—</span>
                        )}
                      </td>
                      <td>{stateChip(t.state, t.confidence)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Right: match panel */}
          <div style={{ overflow: "auto", padding: 16, background: "var(--bg-panel)" }}>
            {active ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <div style={{ font: "600 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)", marginBottom: 6 }}>Selected transaction</div>
                  <div style={{ background: "var(--bg-sunken)", borderRadius: 8, padding: "10px 12px", border: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ font: "500 11px var(--font-mono)", color: "var(--ink-soft)" }}>{active.date} · {active.ref}</span>
                      <Amount debit={active.debit} credit={active.credit} />
                    </div>
                    <div style={{ font: "500 12.5px var(--font-sans)", color: "var(--ink)", marginTop: 4 }}>{active.desc}</div>
                  </div>
                </div>

                {/* Match to invoice */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <span style={{ font: "600 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)" }}>Match to invoice</span>
                    {active.matchTo ? (
                      <button onClick={() => setMatch(active.id, null)} style={{ font: "600 11px var(--font-sans)", color: "var(--warn)", background: "transparent", border: 0, cursor: "pointer" }}>Clear match</button>
                    ) : null}
                  </div>

                  {/* Suggestions: prioritise amount + UTR matches */}
                  {(() => {
                    const amt = active.debit || active.credit;
                    const sugg = allInvoices
                      .map(i => {
                        let score = 0;
                        if (i.amt === amt) score += 0.6;
                        if (active.desc.toUpperCase().includes(i.vendor.toUpperCase().split(" ")[0])) score += 0.3;
                        if (active.desc.includes(i.no)) score += 0.6;
                        return { ...i, score };
                      })
                      .filter(i => i.score > 0)
                      .sort((a, b) => b.score - a.score)
                      .slice(0, 4);

                    if (sugg.length === 0) return <div style={{ font: "500 12px var(--font-sans)", color: "var(--ink-muted)", padding: "8px 0" }}>No close matches by amount or vendor.</div>;
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {sugg.map(i => {
                          const on = active.matchTo === i.id;
                          return (
                            <button key={i.id} onClick={() => setMatch(active.id, i.id)}
                                    style={{ textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid " + (on ? "var(--accent)" : "var(--line)"), background: on ? "var(--accent-soft-bg)" : "var(--bg-main)", borderRadius: 8, cursor: "pointer" }}>
                              <span style={{ width: 14, height: 14, borderRadius: 999, border: "2px solid " + (on ? "var(--accent)" : "var(--ink-muted)"), background: on ? "var(--accent)" : "transparent", boxShadow: on ? "inset 0 0 0 2px var(--bg-main)" : "none", flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ font: "600 12.5px var(--font-mono)", color: "var(--accent)" }}>{i.no}</div>
                                <div style={{ font: "500 11px var(--font-sans)", color: "var(--ink-soft)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.vendor} · due {i.due}</div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ font: "600 12px var(--font-mono)", color: i.amt === (active.debit || active.credit) ? "var(--emerald)" : "var(--ink)" }}>{window.inrFmt(i.amt)}</div>
                                <div style={{ font: "600 9px var(--font-sans)", color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: ".06em" }}>{Math.round(i.score * 100)}%</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Browse all */}
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: "pointer", font: "600 11px var(--font-sans)", color: "var(--accent)" }}>Browse all open invoices ({allInvoices.length})</summary>
                    <div style={{ marginTop: 6, maxHeight: 180, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 8, background: "var(--bg-main)" }}>
                      {allInvoices.map(i => (
                        <button key={i.id} onClick={() => setMatch(active.id, i.id)} style={{ display: "flex", width: "100%", justifyContent: "space-between", padding: "6px 10px", background: "transparent", border: 0, borderBottom: "1px solid var(--line-soft)", cursor: "pointer", textAlign: "left", font: "500 12px var(--font-sans)", color: "var(--ink)" }}
                                onMouseEnter={e => e.currentTarget.style.background = "var(--bg-sunken)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <span><span className="lb-mono" style={{ color: "var(--accent)" }}>{i.no}</span> · {i.vendor}</span>
                          <span style={{ font: "600 11px var(--font-mono)", color: "var(--ink-soft)" }}>{window.inrFmt(i.amt)}</span>
                        </button>
                      ))}
                    </div>
                  </details>
                </div>

                {/* Or: post to ledger */}
                <div>
                  <div style={{ font: "600 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)", marginBottom: 6 }}>Or post directly to ledger</div>
                  <select value={active.suggestedLedger || ""} onChange={e => setLedger(active.id, e.target.value)}
                          style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--bg-main)", color: "var(--ink)", font: "500 12.5px var(--font-sans)", outline: "none" }}>
                    <option value="">— Choose ledger —</option>
                    <option>Bank Charges</option>
                    <option>GST Payable</option>
                    <option>TDS Payable</option>
                    <option>Interest Income</option>
                    <option>Customer Receipts · Sundaram Exports</option>
                    <option>Suspense — Awaiting clarification</option>
                  </select>
                  <div style={{ font: "500 11px var(--font-sans)", color: "var(--ink-muted)", marginTop: 4 }}>Use for charges, taxes, suspense items — anything that isn't an open invoice.</div>
                </div>

                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <button style={{ flex: 1, height: 32, borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg-main)", color: "var(--ink)", font: "600 12px var(--font-sans)", cursor: "pointer" }}>Split transaction</button>
                  <button style={{ flex: 1, height: 32, borderRadius: 8, border: "1px solid var(--warn)", background: "transparent", color: "var(--warn)", font: "600 12px var(--font-sans)", cursor: "pointer" }}>Mark unidentified</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
window.StatementDetail = StatementDetail;
