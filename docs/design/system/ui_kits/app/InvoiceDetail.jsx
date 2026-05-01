// InvoiceDetail.jsx — split view: source PDF | extracted/compliance/timeline/mapping
function SourcePDF({ row }) {
  return (
    <div style={{ background: "var(--bg-sunken)", border: "1px solid var(--line)", borderRadius: 10, padding: 12, height: "100%", display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--ink-soft)", font: "500 12px var(--font-sans)" }}>
        <span><span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4 }}>description</span>{row.number}.pdf</span>
        <span>Page 1 / 2</span>
      </div>
      <div style={{ flex: 1, background: "white", borderRadius: 8, border: "1px solid var(--line)", position: "relative", overflow: "hidden", color: "#0f172a" }}>
        <div style={{ padding: "18px 24px", fontFamily: "Times, serif", fontSize: 12, lineHeight: 1.4 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{ font: "700 16px serif" }}>{row.vendor}</div>
              <div style={{ color: "#475569" }}>14, Industrial Estate Road · Coimbatore 641 014</div>
              <div style={{ color: "#475569" }}>GSTIN: <b>{row.gstin}</b></div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ font: "700 14px serif" }}>TAX INVOICE</div>
              <div>Invoice #: <b>{row.number}</b></div>
              <div>Date: {row.date}</div>
              <div>IRN: <span style={{ background: "rgba(225,29,72,.18)", padding: "1px 4px", borderRadius: 3 }}>missing</span></div>
            </div>
          </div>
          <hr style={{ margin: "14px 0", borderColor: "#cbd5e1" }} />
          <div style={{ marginBottom: 8 }}>Bill To: Sundaram Textiles Pvt Ltd · GSTIN 33AABCS9999K1Z2</div>
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#f1f5f9" }}><th style={{ textAlign: "left", padding: 6 }}>Description</th><th style={{ padding: 6 }}>HSN/SAC</th><th style={{ padding: 6, textAlign: "right" }}>Qty</th><th style={{ padding: 6, textAlign: "right" }}>Rate</th><th style={{ padding: 6, textAlign: "right" }}>Amount</th></tr></thead>
            <tbody>
              <tr><td style={{ padding: 6 }}>Professional services — Q4 retainer</td><td style={{ padding: 6 }}>998314</td><td style={{ padding: 6, textAlign: "right" }}>1</td><td style={{ padding: 6, textAlign: "right" }}>{(row.gross/100/1.18).toFixed(0)}</td><td style={{ padding: 6, textAlign: "right" }}>{(row.gross/100/1.18).toFixed(0)}</td></tr>
            </tbody>
          </table>
          <div style={{ marginTop: 10, textAlign: "right" }}>Sub-total: ₹ {(row.gross/100/1.18).toFixed(2)}<br/>IGST 18%: ₹ {(row.gross/100 - row.gross/100/1.18).toFixed(2)}<br/><b>Total: ₹ {(row.gross/100).toFixed(2)}</b></div>
        </div>
        {/* bounding box highlight */}
        <div style={{ position: "absolute", top: 60, right: 24, width: 180, height: 22, border: "2px solid var(--accent)", background: "rgba(17,82,212,.12)", borderRadius: 2 }} title="GSTIN extracted here"></div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button className="iconbtn"><span className="material-symbols-outlined">zoom_in</span></button>
        <button className="iconbtn"><span className="material-symbols-outlined">zoom_out</span></button>
        <button className="iconbtn"><span className="material-symbols-outlined">rotate_right</span></button>
        <span style={{ flex: 1 }}></span>
        <button className="iconbtn" title="Open in new tab"><span className="material-symbols-outlined">open_in_new</span></button>
      </div>
    </div>
  );
}

// Inline-editable amount cell. Stores values in paise.
function EditableAmt({ value, onChange, color }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(((value || 0) / 100).toFixed(2));
  React.useEffect(() => { setDraft(((value || 0) / 100).toFixed(2)); }, [value]);
  const commit = () => { const n = Math.round(parseFloat(draft || "0") * 100); if (!Number.isNaN(n)) onChange?.(n); setEditing(false); };
  if (editing) return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ color: "var(--ink-muted)" }}>₹</span>
      <input autoFocus value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
             style={{ width: 110, height: 24, padding: "0 6px", borderRadius: 4, border: "1px solid var(--accent)", background: "var(--bg-main)", color: "var(--ink)", font: "600 13px var(--font-mono)", textAlign: "right", outline: "none" }} />
    </span>
  );
  return <span onClick={() => setEditing(true)} title="Click to edit" style={{ color: color || "inherit", cursor: "pointer", borderBottom: "1px dashed var(--line)" }}>{window.inrFmt(value)}</span>;
}

function NetPayableCard({ row, onEdit }) {
  const sections = ["194C", "194I", "194J", "194Q", "194R", "206AA", "—"];
  const rates = { "194C": 2, "194I": 10, "194J": 10, "194Q": 0.1, "194R": 10, "206AA": 20, "—": 0 };
  const [editingSec, setEditingSec] = React.useState(false);

  const setSection = (s) => {
    const r = rates[s];
    const tds = Math.round((row.gross || 0) * r / 100);
    onEdit?.({ section: s, rate: r, tds, net: (row.gross || 0) - tds - (row.tcs || 0) });
    setEditingSec(false);
  };
  const setGross = (g) => {
    const tds = Math.round(g * (row.rate || 0) / 100);
    onEdit?.({ gross: g, tds, net: g - tds - (row.tcs || 0) });
  };
  const setTds = (t)   => onEdit?.({ tds: t, net: (row.gross || 0) - t - (row.tcs || 0) });
  const setTcs = (t)   => onEdit?.({ tcs: t, net: (row.gross || 0) - (row.tds || 0) - t });

  return (
    <div className="net-card">
      <div className="net-row">
        <span>Gross invoice</span>
        <span className="v"><EditableAmt value={row.gross} onChange={setGross} /></span>
      </div>
      <div className="net-row deduct tag-row">
        <span>TDS deducted{" "}
          {editingSec ? (
            <select autoFocus value={row.section} onBlur={() => setEditingSec(false)} onChange={e => setSection(e.target.value)}
                    style={{ height: 22, padding: "0 6px", borderRadius: 4, border: "1px solid var(--accent)", background: "var(--bg-main)", color: "var(--ink)", font: "600 11px var(--font-mono)", marginLeft: 4 }}>
              {sections.map(s => <option key={s}>{s}</option>)}
            </select>
          ) : (
            <span className="net-tag" onClick={() => setEditingSec(true)} title="Click to change section" style={{ cursor: "pointer" }}>{row.section} · {row.rate}%</span>
          )}
        </span>
        <span className="v">− <EditableAmt value={row.tds} onChange={setTds} color="var(--warn)" /></span>
      </div>
      <div className="net-row deduct"><span>TCS</span><span className="v">− <EditableAmt value={row.tcs} onChange={setTcs} color="var(--warn)" /></span></div>
      <div className="net-final"><span className="label">Net Payable</span><span className="amt">{window.inrFmt(row.net)}</span></div>
    </div>
  );
}

function RiskList({ row }) {
  const items = [];
  if (row.severity === "critical" && row.gstin === "—") items.push({ sev: "critical", code: "PAN_GSTIN_MISSING", msg: "PAN/GSTIN absent. TDS will apply at Section 206AA penalty rate (20%)." });
  if (row.severity === "critical" && row.gstin !== "—") items.push({ sev: "critical", code: "VENDOR_BANK_CHANGED", msg: "Vendor bank account changed in last 7 days. Verify before payment." });
  if (row.severity === "warning") items.push({ sev: "warning", code: "IRN_MISSING_OVER_THRESHOLD", msg: "E-invoice IRN missing. Required above ₹5L for B2B." });
  items.push({ sev: "info", code: "GSTIN_CROSS_CHECKED", msg: "Buyer GSTIN cross-checked against tenant master." });
  return (
    <div>
      {items.map((it, i) => (
        <div key={i} className={"risk-row " + it.sev}>
          <span className="icon"><span className="material-symbols-outlined">{it.sev === "critical" ? "priority_high" : it.sev === "warning" ? "warning" : "info"}</span></span>
          <div className="body">
            <div className="risk-code">{it.code}</div>
            <div className="risk-msg">{it.msg}</div>
          </div>
          <button className="iconbtn" style={{ height: 26, width: 26 }}><span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span></button>
        </div>
      ))}
    </div>
  );
}

function Timeline({ row }) {
  const isAwait = row.status === "awaiting_approval";
  const isApproved = row.status === "approved" || row.status === "exported";
  const isExported = row.status === "exported";
  return (
    <div className="timeline">
      <div className="tl-step done"><strong>Ingested</strong> · Gmail mailbox <span className="ts">{row.date} 09:14 IST</span></div>
      <div className="tl-step done"><strong>Parsed</strong> · 14 fields, confidence 0.91 <span className="ts">{row.date} 09:14 IST</span></div>
      <div className={"tl-step " + (row.status === "needs_review" ? "current" : "done")}><strong>Reviewed</strong> · {row.status === "needs_review" ? "pending — 2 risk signals" : "Sneha Iyer (AP Clerk)"} <span className="ts">{row.status === "needs_review" ? "—" : "13-Apr-2026 11:02 IST"}</span></div>
      <div className={"tl-step " + (isAwait ? "current" : (isApproved ? "done" : "pending"))}><strong>Approval</strong> · Step {isAwait ? "2" : (isApproved ? "3" : "1")} / 3 — CA sign-off <span className="ts">{isAwait ? "Awaiting Mahir Khan, CA" : isApproved ? "14-Apr-2026 14:08 IST" : "—"}</span></div>
      <div className={"tl-step " + (isExported ? "done" : "pending")}><strong>Tally export</strong> · {isExported ? "Voucher V-2604-0012" : "—"} <span className="ts">{isExported ? "14-Apr-2026 17:32 IST" : "—"}</span></div>
    </div>
  );
}

function TallyMapping({ row }) {
  const rows = [
    { field: "Voucher type", ext: "Purchase invoice", target: "VOUCHERTYPENAME", value: "Purchase" },
    { field: "Vendor (Party)", ext: row.vendor, target: "PARTYLEDGERNAME", value: row.vendor },
    { field: "Net amount", ext: window.inrFmt(row.gross), target: "AMOUNT", value: (row.gross / 100).toFixed(2) },
    { field: "TDS section", ext: row.section, target: "TDSSECTION", value: row.section },
    { field: "TDS amount", ext: window.inrFmt(row.tds), target: "Ledger: TDS Payable", value: "Dr " + (row.tds / 100).toFixed(2) },
    { field: "GL code", ext: "Legal & Professional Fees", target: "LEDGERNAME", value: "Legal & Professional Fees" },
    { field: "Voucher GUID", ext: "—", target: "GUID", value: "9c4e-…b21f" },
  ];
  return (
    <table className="maptable">
      <thead><tr><th>Field</th><th>Extracted</th><th></th><th>Tally target</th><th>Mapped value</th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={{ color: "var(--ink-soft)" }}>{r.field}</td>
            <td>{r.ext}</td>
            <td className="arrow">→</td>
            <td className="mono" style={{ color: "var(--accent)" }}>{r.target}</td>
            <td className="mono">{r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Inline-editable text/select cell for extracted fields
function EditableField({ value, placeholder, onChange, options, mono, danger, validate }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value ?? "");
  React.useEffect(() => { setDraft(value ?? ""); }, [value]);
  const valid = validate ? validate(draft) : true;
  const commit = () => { if (valid) { onChange?.(draft); setEditing(false); } };

  if (editing) {
    return options ? (
      <select autoFocus value={draft} onChange={e => { setDraft(e.target.value); onChange?.(e.target.value); setEditing(false); }} onBlur={() => setEditing(false)}
              style={{ height: 22, padding: "0 4px", borderRadius: 4, border: "1px solid var(--accent)", background: "var(--bg-main)", color: "var(--ink)", font: mono ? "600 12px var(--font-mono)" : "600 12.5px var(--font-sans)", maxWidth: "100%" }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    ) : (
      <input autoFocus value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }} placeholder={placeholder}
             style={{ width: "100%", height: 22, padding: "0 6px", borderRadius: 4, border: "1px solid " + (valid ? "var(--accent)" : "var(--warn)"), background: "var(--bg-main)", color: "var(--ink)", font: mono ? "600 12.5px var(--font-mono)" : "500 12.5px var(--font-sans)", outline: "none" }} />
    );
  }
  const isEmpty = !value || value === "—" || value === "missing";
  return (
    <span onClick={() => setEditing(true)} title="Click to edit"
          style={{ cursor: "pointer", borderBottom: "1px dashed var(--line)", color: danger ? "var(--warn)" : (isEmpty ? "var(--ink-muted)" : "var(--ink)"), font: mono ? "500 12.5px var(--font-mono)" : "500 12.5px var(--font-sans)", display: "inline-flex", alignItems: "center", gap: 4 }}>
      {isEmpty ? (placeholder || "—") : value}
      <span className="material-symbols-outlined" style={{ fontSize: 11, color: "var(--ink-muted)", opacity: .6 }}>edit</span>
    </span>
  );
}

function InvoiceDetail({ row: initialRow }) {
  const [row, setRow] = React.useState(initialRow);
  React.useEffect(() => { setRow(initialRow); }, [initialRow?.id]);
  const update = (patch) => setRow(prev => ({ ...prev, ...patch }));

  const igst = Math.round((row.gross || 0) - (row.gross || 0) / 1.18);
  const [extra, setExtra] = React.useState({ hsn: "998314", irn: "", costCenter: "Operations", cgst: "", sgst: "", igst: window.inrFmt(igst), gl: "Legal & Professional Fees", glCode: "5301" });
  const GL_OPTIONS = [
    { name: "Legal & Professional Fees",       code: "5301", section: "194J" },
    { name: "Contractor Charges — Corporate",  code: "5210", section: "194C" },
    { name: "Rent — Office Premises",          code: "5101", section: "194I" },
    { name: "Goods Purchase",                  code: "1401", section: "194Q" },
    { name: "Software Licences & Subscriptions", code: "5410", section: "194J" },
    { name: "Bank Charges",                    code: "5601", section: "—" },
    { name: "Telecom & Internet",              code: "5510", section: "194J" },
    { name: "Travel & Conveyance",             code: "5701", section: "—" },
    { name: "Stationery & Consumables",        code: "5801", section: "—" },
  ];

  return (
    <div className="split">
      <div className="col">
        <SourcePDF row={row} />
      </div>
      <div className="div"></div>
      <div className="col detail">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2>{row.vendor}</h2>
            <div className="sub"><span className="lb-mono">{row.number}</span> · {row.date} · <span className={"spill s-" + row.status}><span className="dot"></span>{row.status.toUpperCase()}</span></div>
          </div>
          <div style={{ display: "inline-flex", gap: 6 }}>
            <button className="iconbtn" title="Reject"><span className="material-symbols-outlined">close</span></button>
            <button style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", borderRadius: 8, border: "1px solid var(--accent)", background: "var(--accent)", color: "#fff", font: "600 13px var(--font-sans)" }}>
              Approve <span style={{ font: "600 10px var(--font-mono)", padding: "1px 5px", background: "rgba(255,255,255,.20)", borderRadius: 3 }}>A</span>
            </button>
          </div>
        </div>

        <NetPayableCard row={row} onEdit={update} />

        {/* GL code — prominent, editable */}
        <div style={{ background: "var(--bg-panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--accent-soft-bg)", color: "var(--accent)", flexShrink: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>account_tree</span>
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ font: "600 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)" }}>GL code (Tally ledger)</span>
            <span style={{ font: "500 11px var(--font-mono)", color: "var(--ink-muted)" }}>Maps to <span style={{ color: "var(--accent)" }}>LEDGERNAME</span> on push</span>
          </div>
          <select value={extra.gl} onChange={e => {
                    const opt = GL_OPTIONS.find(o => o.name === e.target.value);
                    setExtra({ ...extra, gl: opt.name, glCode: opt.code });
                    if (opt.section !== "—" && row.section !== opt.section) {
                      const rates = { "194C": 2, "194I": 10, "194J": 10, "194Q": 0.1 };
                      const tds = Math.round((row.gross || 0) * (rates[opt.section] || 0) / 100);
                      update({ section: opt.section, rate: rates[opt.section] || 0, tds, net: (row.gross || 0) - tds - (row.tcs || 0) });
                    }
                  }}
                  style={{ marginLeft: "auto", height: 30, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--bg-main)", color: "var(--ink)", font: "600 12.5px var(--font-sans)", outline: "none", minWidth: 240 }}>
            {GL_OPTIONS.map(o => <option key={o.code} value={o.name}>{o.name}</option>)}
          </select>
          <span className="lb-mono" style={{ padding: "3px 8px", background: "var(--bg-sunken)", borderRadius: 4, color: "var(--accent)", fontWeight: 700 }}>{extra.glCode}</span>
        </div>

        <div className="section">
          <div className="stitle"><h3>Extracted fields</h3><span className="lb-caption">Click any value to edit · changes auto-save</span></div>
          <div className="kvgrid">
            <div className="kv"><span>Vendor GSTIN</span><span className="v"><EditableField value={row.gstin === "—" ? "" : row.gstin} placeholder="GSTIN" mono danger={!row.gstin || row.gstin === "—"}
              validate={v => !v || /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z]\d$/i.test(v)}
              onChange={v => update({ gstin: v ? v.toUpperCase() : "—" })} /></span></div>
            <div className="kv"><span>Vendor PAN</span><span className="v"><EditableField value={row.gstin === "—" ? "" : row.gstin.slice(2, 12)} placeholder="PAN" mono
              validate={v => !v || /^[A-Z]{5}\d{4}[A-Z]$/i.test(v)} onChange={() => {}} /></span></div>
            <div className="kv"><span>Invoice #</span><span className="v"><EditableField value={row.number} mono onChange={v => update({ number: v })} /></span></div>
            <div className="kv"><span>Invoice date</span><span className="v"><EditableField value={row.date} mono onChange={v => update({ date: v })} /></span></div>
            <div className="kv"><span>HSN / SAC</span><span className="v"><EditableField value={extra.hsn} mono onChange={v => setExtra({ ...extra, hsn: v })} /></span></div>
            <div className="kv"><span>IRN</span><span className="v"><EditableField value={extra.irn} placeholder="missing" mono danger={!extra.irn} onChange={v => setExtra({ ...extra, irn: v })} /></span></div>
            <div className="kv"><span>CGST 9%</span><span className="v"><EditableField value={extra.cgst} placeholder="—" mono onChange={v => setExtra({ ...extra, cgst: v })} /></span></div>
            <div className="kv"><span>SGST 9%</span><span className="v"><EditableField value={extra.sgst} placeholder="—" mono onChange={v => setExtra({ ...extra, sgst: v })} /></span></div>
            <div className="kv"><span>IGST 18%</span><span className="v"><EditableField value={extra.igst} mono onChange={v => setExtra({ ...extra, igst: v })} /></span></div>
            <div className="kv"><span>Cost center</span><span className="v"><EditableField value={extra.costCenter} options={["Operations", "Sales", "R&D", "Admin", "Marketing"]} onChange={v => setExtra({ ...extra, costCenter: v })} /></span></div>
          </div>
        </div>

        <div className="section">
          <div className="stitle"><h3>Risk signals</h3><span className="lb-caption">{row.severity === "critical" ? "1 critical · 1 warning" : "1 warning"}</span></div>
          <RiskList row={row} />
        </div>

        <div className="section">
          <div className="stitle"><h3>Workflow</h3><span className="lb-caption">3-step approval</span></div>
          <Timeline row={row} />
        </div>

        <div className="section">
          <div className="stitle"><h3>Tally voucher mapping</h3><span className="lb-caption">Purchase voucher · Tally Prime</span></div>
          <TallyMapping row={row} />
        </div>
      </div>
    </div>
  );
}

window.InvoiceDetail = InvoiceDetail;
