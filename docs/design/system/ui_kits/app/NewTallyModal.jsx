// NewTallyModal.jsx — popup for adding a Tally connection
function NewTallyModal({ open, onClose }) {
  const [step, setStep] = React.useState(1);
  const [mode, setMode] = React.useState("bridge"); // bridge | odbc | upload
  const [clientOrg, setClientOrg] = React.useState("Sundaram Textiles Pvt Ltd");
  const [company, setCompany] = React.useState("");
  const [path, setPath] = React.useState("C:\\Tally\\Data\\10042\\sundaram-textiles.tdc");
  const [poll, setPoll] = React.useState(10);
  const [pairing, setPairing] = React.useState("LB-7K3Q-9F2X");
  const [discovered, setDiscovered] = React.useState(false);

  React.useEffect(() => { if (!open) { setStep(1); setDiscovered(false); } }, [open]);
  React.useEffect(() => {
    if (step === 2 && mode === "bridge" && !discovered) {
      const t = setTimeout(() => setDiscovered(true), 1400);
      return () => clearTimeout(t);
    }
  }, [step, mode, discovered]);

  if (!open) return null;

  const inputCss = { height: 32, padding: "0 10px", border: "1px solid var(--line)", background: "var(--bg-main)", color: "var(--ink)", borderRadius: 6, font: "500 13px var(--font-mono)", outline: "none" };
  const Field = ({ label, hint, children }) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ font: "600 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)" }}>{label}</span>
      {children}
      {hint ? <span style={{ font: "500 11px var(--font-sans)", color: "var(--ink-muted)" }}>{hint}</span> : null}
    </label>
  );

  const Stepper = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, font: "600 11px var(--font-sans)", color: "var(--ink-soft)", marginBottom: 12 }}>
      {["Method", "Pairing", "Map company", "Confirm"].map((s, i) => (
        <React.Fragment key={s}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: step === i + 1 ? "var(--accent)" : step > i + 1 ? "var(--emerald)" : "var(--ink-muted)" }}>
            <span style={{ width: 18, height: 18, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", background: step === i + 1 ? "var(--accent-soft-bg)" : step > i + 1 ? "var(--emerald-soft-bg)" : "var(--bg-sunken)", color: step === i + 1 ? "var(--accent)" : step > i + 1 ? "var(--emerald)" : "var(--ink-muted)", font: "700 10px var(--font-mono)" }}>{step > i + 1 ? "✓" : i + 1}</span>
            {s}
          </span>
          {i < 3 ? <span style={{ color: "var(--ink-muted)" }}>—</span> : null}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ width: 620 }}>
        <div className="modal-head">
          <div>
            <h2>Add Tally connection</h2>
            <div style={{ font: "500 12px var(--font-sans)", color: "var(--ink-soft)", marginTop: 2 }}>Connect a Tally company to a LedgerBuddy client org</div>
          </div>
          <button className="iconbtn" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Stepper />

          {step === 1 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Field label="Client org">
                <select style={{ ...inputCss, fontFamily: "var(--font-sans)" }} value={clientOrg} onChange={e => setClientOrg(e.target.value)}>
                  <option>Sundaram Textiles Pvt Ltd</option>
                  <option>Hari Vishnu Industries</option>
                  <option>Coastal Aqua Exports LLP</option>
                  <option>Patel & Patel Logistics</option>
                  <option>Madurai Sweets & Snacks</option>
                </select>
              </Field>
              <div>
                <div style={{ font: "600 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)", marginBottom: 6 }}>Connection method</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    { id: "bridge", t: "LedgerBuddy Bridge agent", s: "Recommended · poll AlterID, push XML, retries on drift", icon: "cable" },
                    { id: "odbc",   t: "ODBC / Tally on cloud",     s: "For TallyPrime Server or hosted setups",                  icon: "dns" },
                    { id: "upload", t: "Manual XML upload",         s: "Air-gapped — drag exports here weekly",                    icon: "upload_file" },
                  ].map(o => (
                    <button key={o.id} type="button" onClick={() => setMode(o.id)}
                            style={{ textAlign: "left", display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", border: "1px solid " + (mode === o.id ? "var(--accent)" : "var(--line)"), background: mode === o.id ? "var(--accent-soft-bg)" : "var(--bg-panel)", color: "var(--ink)", borderRadius: 8, cursor: "pointer" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 20, color: mode === o.id ? "var(--accent)" : "var(--ink-soft)", marginTop: 2 }}>{o.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ font: "600 13px var(--font-sans)" }}>{o.t}</div>
                        <div style={{ font: "500 11px var(--font-sans)", color: "var(--ink-soft)", marginTop: 2 }}>{o.s}</div>
                      </div>
                      {mode === o.id ? <span className="material-symbols-outlined" style={{ color: "var(--accent)" }}>check_circle</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            mode === "bridge" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ background: "var(--bg-sunken)", border: "1px solid var(--line)", borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ font: "600 11px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)", marginBottom: 4 }}>Pairing code</div>
                  <div style={{ font: "700 22px var(--font-mono)", color: "var(--accent)", letterSpacing: ".15em" }}>{pairing}</div>
                  <div style={{ font: "500 11px var(--font-sans)", color: "var(--ink-soft)", marginTop: 6 }}>
                    Run <span className="lb-mono" style={{ color: "var(--ink)" }}>ledgerbuddy-bridge.exe pair {pairing}</span> on the Tally machine. Code expires in 10 min.
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid " + (discovered ? "var(--emerald)" : "var(--line)"), borderRadius: 8, background: discovered ? "var(--emerald-soft-bg)" : "var(--bg-panel)" }}>
                  <span style={{ width: 28, height: 28, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", background: discovered ? "var(--emerald)" : "var(--bg-sunken)", color: discovered ? "white" : "var(--ink-muted)" }}>
                    {discovered ? <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span> : <span className="lbspin" />}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ font: "600 13px var(--font-sans)", color: discovered ? "var(--emerald)" : "var(--ink)" }}>{discovered ? "Bridge agent paired" : "Waiting for bridge…"}</div>
                    <div style={{ font: "500 11px var(--font-mono)", color: "var(--ink-soft)" }}>{discovered ? "DESKTOP-K2N9 · Tally Prime 4.1 · 4 companies discovered" : "Listening on local network"}</div>
                  </div>
                </div>
                <style>{`.lbspin{width:14px;height:14px;border-radius:999px;border:2px solid var(--line);border-top-color:var(--accent);animation:lbsp 1s linear infinite}@keyframes lbsp{to{transform:rotate(360deg)}}`}</style>
              </div>
            ) : mode === "odbc" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Host"><input style={inputCss} placeholder="tally.acme.local" /></Field>
                <Field label="Port"><input style={inputCss} placeholder="9000" defaultValue="9000" /></Field>
                <Field label="Username"><input style={{ ...inputCss, fontFamily: "var(--font-sans)" }} placeholder="readwrite-svc" /></Field>
                <Field label="Password"><input type="password" style={inputCss} placeholder="••••••••" /></Field>
              </div>
            ) : (
              <div style={{ border: "2px dashed var(--line)", borderRadius: 10, padding: 32, textAlign: "center", background: "var(--bg-sunken)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 32, color: "var(--ink-soft)" }}>upload_file</span>
                <div style={{ font: "600 13px var(--font-sans)", color: "var(--ink)", marginTop: 6 }}>Drop Tally XML export here</div>
                <div style={{ font: "500 12px var(--font-sans)", color: "var(--ink-soft)", marginTop: 2 }}>Day Book or Vendor master · we'll diff against last upload</div>
              </div>
            )
          ) : null}

          {step === 3 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Field label="Tally company" hint="Pick the company file that maps to this client org">
                <select style={{ ...inputCss, fontFamily: "var(--font-sans)" }} value={company} onChange={e => setCompany(e.target.value)}>
                  <option value="">— Choose —</option>
                  <option>Sundaram Textiles Pvt Ltd (FY 25-26)</option>
                  <option>Sundaram Exports (FY 25-26)</option>
                  <option>Sundaram Trading (FY 24-25 archived)</option>
                  <option>Acme Test Company</option>
                </select>
              </Field>
              <Field label="Company file path" hint="Auto-filled from bridge — edit if it's on a network share"><input style={inputCss} value={path} onChange={e => setPath(e.target.value)} /></Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Poll interval" hint="How often to check AlterID for changes">
                  <select style={{ ...inputCss, fontFamily: "var(--font-sans)" }} value={poll} onChange={e => setPoll(+e.target.value)}>
                    <option value={5}>5 seconds (real-time)</option>
                    <option value={10}>10 seconds (recommended)</option>
                    <option value={60}>1 minute</option>
                    <option value={900}>15 minutes (low bandwidth)</option>
                  </select>
                </Field>
                <Field label="Push direction">
                  <select style={{ ...inputCss, fontFamily: "var(--font-sans)" }} defaultValue="two">
                    <option value="two">Two-way (read + push vouchers)</option>
                    <option value="read">Read-only (audit mode)</option>
                  </select>
                </Field>
              </div>
              <div style={{ background: "var(--accent-soft-bg)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px", font: "500 12px var(--font-sans)", color: "var(--ink-soft)" }}>
                <div style={{ font: "600 11px var(--font-sans)", color: "var(--accent)", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".08em" }}>F12 prerequisites</div>
                Bill-wise allocation · AlterID export · GSTIN in vendor masters · Narration export — we'll verify these on first sync.
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ background: "var(--bg-sunken)", border: "1px solid var(--line)", borderRadius: 8, padding: "12px 14px" }}>
                <div className="kvgrid">
                  <div className="kv"><span>Client org</span><span className="v">{clientOrg}</span></div>
                  <div className="kv"><span>Method</span><span className="v">{mode === "bridge" ? "Bridge agent" : mode === "odbc" ? "ODBC" : "Manual upload"}</span></div>
                  <div className="kv"><span>Tally company</span><span className="v">{company || "—"}</span></div>
                  <div className="kv"><span>File</span><span className="v" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{path}</span></div>
                  <div className="kv"><span>Poll interval</span><span className="v">{poll}s</span></div>
                </div>
              </div>
              <div style={{ font: "500 12px var(--font-sans)", color: "var(--ink-soft)" }}>
                On save, LedgerBuddy will run a one-time master sync (vendors, ledgers, TDS natures) and start polling for new vouchers. You'll see this connection appear in the Tally Sync console.
              </div>
            </div>
          ) : null}
        </div>
        <div className="modal-foot" style={{ display: "flex", justifyContent: "space-between" }}>
          <button onClick={() => step > 1 ? setStep(step - 1) : onClose()} style={{ height: 32, padding: "0 14px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--ink)", font: "600 13px var(--font-sans)" }}>{step > 1 ? "Back" : "Cancel"}</button>
          {step < 4 ? (
            <button disabled={step === 2 && mode === "bridge" && !discovered} onClick={() => setStep(step + 1)} style={{ height: 32, padding: "0 14px", borderRadius: 8, border: 0, background: (step === 2 && mode === "bridge" && !discovered) ? "var(--bg-sunken)" : "var(--accent)", color: (step === 2 && mode === "bridge" && !discovered) ? "var(--ink-muted)" : "white", font: "600 13px var(--font-sans)", cursor: (step === 2 && mode === "bridge" && !discovered) ? "not-allowed" : "pointer" }}>Continue</button>
          ) : (
            <button onClick={onClose} style={{ height: 32, padding: "0 14px", borderRadius: 8, border: 0, background: "var(--accent)", color: "white", font: "600 13px var(--font-sans)", cursor: "pointer" }}>Save & sync now</button>
          )}
        </div>
      </div>
    </div>
  );
}
window.NewTallyModal = NewTallyModal;
