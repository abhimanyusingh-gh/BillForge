// NewVendorModal.jsx — popup for + New Vendor (replaces inline form pattern)
function NewVendorModal({ open, onClose }) {
  const [pan, setPan] = React.useState("");
  const [gstin, setGstin] = React.useState("");
  const [name, setName] = React.useState("");
  const [section, setSection] = React.useState("194C");
  const [msme, setMsme] = React.useState(false);

  if (!open) return null;
  const panOk = /^[A-Z]{5}\d{4}[A-Z]$/.test(pan);
  const gstinOk = gstin === "" || /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z]\d$/.test(gstin);
  const ready = panOk && name.trim().length > 2;

  const Field = ({ label, hint, children }) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ font: "600 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)" }}>{label}</span>
      {children}
      {hint ? <span style={{ font: "500 11px var(--font-sans)", color: "var(--ink-muted)" }}>{hint}</span> : null}
    </label>
  );
  const inputCss = { height: 32, padding: "0 10px", border: "1px solid var(--line)", background: "var(--bg-main)", color: "var(--ink)", borderRadius: 6, font: "500 13px var(--font-mono)", outline: "none" };

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ width: 540 }}>
        <div className="modal-head">
          <div>
            <h2>New vendor</h2>
            <div style={{ font: "500 12px var(--font-sans)", color: "var(--ink-soft)", marginTop: 2 }}>Sundaram Textiles Pvt Ltd · vendor master</div>
          </div>
          <button className="iconbtn" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="PAN" hint={pan && !panOk ? "Format: AAAAA9999A — 5 letters, 4 digits, 1 letter" : "Required · drives TDS section defaults"}>
            <input style={{ ...inputCss, borderColor: pan && !panOk ? "var(--warn)" : "var(--line)", textTransform: "uppercase" }} value={pan} onChange={e => setPan(e.target.value.toUpperCase())} placeholder="AECPS1234C" maxLength={10} />
          </Field>
          <Field label="GSTIN" hint={gstin && !gstinOk ? "Format: 2-digit state + PAN + entity code + Z + checksum" : "Optional · we'll cross-check the embedded PAN"}>
            <input style={{ ...inputCss, borderColor: gstin && !gstinOk ? "var(--warn)" : "var(--line)", textTransform: "uppercase" }} value={gstin} onChange={e => setGstin(e.target.value.toUpperCase())} placeholder="33AECPS1234C1Z5" maxLength={15} />
          </Field>
          <Field label="Vendor name" hint="As it should appear in Tally Party Ledger">
            <input style={{ ...inputCss, fontFamily: "var(--font-sans)" }} value={name} onChange={e => setName(e.target.value)} placeholder="Vendor legal name" />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Default TDS section">
              <select style={{ ...inputCss, fontFamily: "var(--font-sans)" }} value={section} onChange={e => setSection(e.target.value)}>
                <option>194C — Contractor (1% / 2%)</option>
                <option>194J — Professional (10%)</option>
                <option>194Q — Goods purchase (0.1%)</option>
                <option>194I — Rent (10%)</option>
                <option>206AA — No PAN (20%)</option>
              </select>
            </Field>
            <Field label="MSME">
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 32, font: "500 13px var(--font-sans)", color: "var(--ink)" }}>
                <input type="checkbox" checked={msme} onChange={e => setMsme(e.target.checked)} />
                Registered MSME · 45-day clock
              </label>
            </Field>
          </div>
          <div style={{ background: "var(--accent-soft-bg)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", font: "500 12px var(--font-sans)", color: "var(--ink-soft)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: "middle", color: "var(--accent)", marginRight: 6 }}>info</span>
            Bank details, address and TDS lower-deduction certificates can be added later from the vendor's detail panel.
          </div>
        </div>
        <div className="modal-foot">
          <button onClick={onClose} style={{ height: 32, padding: "0 14px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--ink)", font: "600 13px var(--font-sans)" }}>Cancel</button>
          <button disabled={!ready} onClick={onClose} style={{ height: 32, padding: "0 14px", borderRadius: 8, border: 0, background: ready ? "var(--accent)" : "var(--bg-sunken)", color: ready ? "white" : "var(--ink-muted)", font: "600 13px var(--font-sans)", cursor: ready ? "pointer" : "not-allowed" }}>Create vendor</button>
        </div>
      </div>
    </div>
  );
}
window.NewVendorModal = NewVendorModal;
