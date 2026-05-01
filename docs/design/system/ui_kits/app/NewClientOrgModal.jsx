// NewClientOrgModal.jsx — popup for creating a client org
function NewClientOrgModal({ open, onClose }) {
  const [name, setName] = React.useState("");
  const [gstin, setGstin] = React.useState("");
  const [pan, setPan] = React.useState("");
  const [state, setState] = React.useState("Tamil Nadu (33)");
  const [fy, setFy] = React.useState("Apr 2025 – Mar 2026");
  const [tallyMode, setTallyMode] = React.useState("bridge");
  const [seedFromGstin, setSeedFromGstin] = React.useState(true);

  if (!open) return null;
  const gstinOk = gstin === "" || /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z]\d$/.test(gstin);
  const panOk = pan === "" || /^[A-Z]{5}\d{4}[A-Z]$/.test(pan);
  const ready = name.trim().length > 2 && gstinOk && panOk;

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
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ width: 580 }}>
        <div className="modal-head">
          <div>
            <h2>New client org</h2>
            <div style={{ font: "500 12px var(--font-sans)", color: "var(--ink-soft)", marginTop: 2 }}>Khan & Associates, CA · firm-wide</div>
          </div>
          <button className="iconbtn" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="Legal name" hint="As registered with MCA / used in Tally Company">
            <input style={{ ...inputCss, fontFamily: "var(--font-sans)" }} value={name} onChange={e => setName(e.target.value)} placeholder="Acme Industries Pvt Ltd" autoFocus />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="GSTIN" hint={gstin && !gstinOk ? "Format: 2-digit state + PAN + entity + Z + checksum" : "Optional but recommended"}>
              <input style={{ ...inputCss, borderColor: gstin && !gstinOk ? "var(--warn)" : "var(--line)", textTransform: "uppercase" }} value={gstin} onChange={e => setGstin(e.target.value.toUpperCase())} placeholder="33AABCS9999K1Z2" maxLength={15} />
            </Field>
            <Field label="PAN" hint={pan && !panOk ? "Format: AAAAA9999A" : "Auto-derived from GSTIN if blank"}>
              <input style={{ ...inputCss, borderColor: pan && !panOk ? "var(--warn)" : "var(--line)", textTransform: "uppercase" }} value={pan} onChange={e => setPan(e.target.value.toUpperCase())} placeholder="AABCS9999K" maxLength={10} />
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Home state">
              <select style={{ ...inputCss, fontFamily: "var(--font-sans)" }} value={state} onChange={e => setState(e.target.value)}>
                <option>Tamil Nadu (33)</option><option>Maharashtra (27)</option><option>Karnataka (29)</option><option>Gujarat (24)</option><option>Delhi (07)</option><option>Telangana (36)</option>
              </select>
            </Field>
            <Field label="Financial year">
              <select style={{ ...inputCss, fontFamily: "var(--font-sans)" }} value={fy} onChange={e => setFy(e.target.value)}>
                <option>Apr 2025 – Mar 2026</option><option>Apr 2024 – Mar 2025</option>
              </select>
            </Field>
          </div>

          <div>
            <div style={{ font: "600 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)", marginBottom: 6 }}>Tally connection</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { id: "bridge", label: "LedgerBuddy Bridge", sub: "Recommended · poll AlterID, push XML" },
                { id: "later",  label: "Set up later",       sub: "Just file uploads for now" },
              ].map(o => (
                <button key={o.id} type="button" onClick={() => setTallyMode(o.id)}
                        style={{ textAlign: "left", padding: "10px 12px", border: "1px solid " + (tallyMode === o.id ? "var(--accent)" : "var(--line)"), background: tallyMode === o.id ? "var(--accent-soft-bg)" : "var(--bg-panel)", color: "var(--ink)", borderRadius: 8, cursor: "pointer" }}>
                  <div style={{ font: "600 13px var(--font-sans)" }}>{o.label}</div>
                  <div style={{ font: "500 11px var(--font-sans)", color: "var(--ink-soft)", marginTop: 2 }}>{o.sub}</div>
                </button>
              ))}
            </div>
          </div>

          <label style={{ display: "inline-flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", background: "var(--accent-soft-bg)", border: "1px solid var(--line)", borderRadius: 8, font: "500 12px var(--font-sans)", color: "var(--ink-soft)" }}>
            <input type="checkbox" checked={seedFromGstin} onChange={e => setSeedFromGstin(e.target.checked)} style={{ marginTop: 2 }} />
            <span>Seed vendor master from GST returns once <span className="lb-mono">{gstin || "GSTIN"}</span> is verified — typically 60–80 vendors auto-populated.</span>
          </label>
        </div>
        <div className="modal-foot">
          <button onClick={onClose} style={{ height: 32, padding: "0 14px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--ink)", font: "600 13px var(--font-sans)" }}>Cancel</button>
          <button disabled={!ready} onClick={onClose} style={{ height: 32, padding: "0 14px", borderRadius: 8, border: 0, background: ready ? "var(--accent)" : "var(--bg-sunken)", color: ready ? "white" : "var(--ink-muted)", font: "600 13px var(--font-sans)", cursor: ready ? "pointer" : "not-allowed" }}>Create client org</button>
        </div>
      </div>
    </div>
  );
}
window.NewClientOrgModal = NewClientOrgModal;
