// TeamMemberModal.jsx — add or edit a team member with granular access
function TeamMemberModal({ open, member, onClose, onSave }) {
  const blank = { name: "", email: "", role: "AP Clerk", status: "active", twoFA: true, clientOrgs: [], canApproveAbove: 100000, canExport: false, canEditTds: false };
  const [m, setM] = React.useState(blank);

  React.useEffect(() => { setM(member ? { ...blank, ...member } : blank); }, [member, open]);

  if (!open) return null;
  const editing = !!member;
  const allOrgs = ["Sundaram Textiles Pvt Ltd", "Hari Vishnu Industries", "Coastal Aqua Exports LLP", "Patel & Patel Logistics", "Madurai Sweets & Snacks", "Innova Software Solutions", "BlueOcean Marine Pvt Ltd", "Greenleaf Organics"];
  const roles = [
    { id: "Owner",             desc: "Full access · billing · firm settings" },
    { id: "CA Sign-off",       desc: "Final approval · UDIN · TDS challan release" },
    { id: "Senior Accountant", desc: "Approve up to limit · edit TDS · push to Tally" },
    { id: "AP Clerk",          desc: "Triage · enter bills · request approval" },
    { id: "Read-only auditor", desc: "View everything · export reports · no edits" },
  ];

  const togOrg = (o) => setM(prev => ({ ...prev, clientOrgs: prev.clientOrgs.includes(o) ? prev.clientOrgs.filter(x => x !== o) : [...prev.clientOrgs, o] }));
  const ready = m.name.trim().length > 1 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m.email) && m.clientOrgs.length > 0;

  const inputCss = { height: 32, padding: "0 10px", border: "1px solid var(--line)", background: "var(--bg-main)", color: "var(--ink)", borderRadius: 6, font: "500 13px var(--font-sans)", outline: "none" };
  const Field = ({ label, hint, children }) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ font: "600 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)" }}>{label}</span>
      {children}
      {hint ? <span style={{ font: "500 11px var(--font-sans)", color: "var(--ink-muted)" }}>{hint}</span> : null}
    </label>
  );

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ width: 640, maxHeight: "92vh", overflowY: "auto" }}>
        <div className="modal-head">
          <div>
            <h2>{editing ? "Edit team member" : "Invite team member"}</h2>
            <div style={{ font: "500 12px var(--font-sans)", color: "var(--ink-soft)", marginTop: 2 }}>{editing ? `${m.email} · last seen ${m.lastSeen || "—"}` : "They'll receive an email to set a password and enable 2FA."}</div>
          </div>
          <button className="iconbtn" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Full name"><input style={inputCss} value={m.name} onChange={e => setM({ ...m, name: e.target.value })} placeholder="Reena Patel" autoFocus /></Field>
            <Field label="Work email" hint={m.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m.email) ? "Invalid email" : null}>
              <input style={{ ...inputCss, fontFamily: "var(--font-mono)", fontSize: 12 }} value={m.email} onChange={e => setM({ ...m, email: e.target.value })} placeholder="reena@khan-ca.in" disabled={editing} />
            </Field>
          </div>

          {/* Role */}
          <div>
            <div style={{ font: "600 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)", marginBottom: 6 }}>Role</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {roles.map(r => (
                <button key={r.id} type="button" onClick={() => setM({ ...m, role: r.id })}
                        style={{ textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid " + (m.role === r.id ? "var(--accent)" : "var(--line)"), background: m.role === r.id ? "var(--accent-soft-bg)" : "var(--bg-panel)", color: "var(--ink)", borderRadius: 8, cursor: "pointer" }}>
                  <span style={{ width: 14, height: 14, borderRadius: 999, border: "2px solid " + (m.role === r.id ? "var(--accent)" : "var(--ink-muted)"), background: m.role === r.id ? "var(--accent)" : "transparent", boxShadow: m.role === r.id ? "inset 0 0 0 2px var(--bg-panel)" : "none", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ font: "600 12.5px var(--font-sans)" }}>{r.id}</div>
                    <div style={{ font: "500 11px var(--font-sans)", color: "var(--ink-soft)" }}>{r.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Client org access */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ font: "600 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)" }}>Client org access</span>
              <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button type="button" onClick={() => setM({ ...m, clientOrgs: [...allOrgs] })} style={{ font: "600 11px var(--font-sans)", color: "var(--accent)", background: "transparent", border: 0, cursor: "pointer" }}>Select all</button>
                <button type="button" onClick={() => setM({ ...m, clientOrgs: [] })} style={{ font: "600 11px var(--font-sans)", color: "var(--ink-soft)", background: "transparent", border: 0, cursor: "pointer" }}>None</button>
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: 6, border: "1px solid var(--line)", borderRadius: 8, background: "var(--bg-sunken)", maxHeight: 180, overflowY: "auto" }}>
              {allOrgs.map(o => {
                const on = m.clientOrgs.includes(o);
                return (
                  <label key={o} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, background: on ? "var(--bg-panel)" : "transparent", cursor: "pointer", font: "500 12px var(--font-sans)", color: "var(--ink)" }}>
                    <input type="checkbox" checked={on} onChange={() => togOrg(o)} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o}</span>
                  </label>
                );
              })}
            </div>
            <div style={{ font: "500 11px var(--font-sans)", color: m.clientOrgs.length === 0 ? "var(--warn)" : "var(--ink-muted)", marginTop: 4 }}>{m.clientOrgs.length === 0 ? "Select at least one client org." : `${m.clientOrgs.length} of ${allOrgs.length} selected`}</div>
          </div>

          {/* Permissions */}
          <div>
            <div style={{ font: "600 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)", marginBottom: 6 }}>Permissions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[
                { k: "canExport",  label: "Push vouchers to Tally + export TDS challans", sub: "Senior Accountant and above can override" },
                { k: "canEditTds", label: "Override TDS section / rate on invoices",       sub: "Without this, they can only flag for review" },
              ].map(p => (
                <label key={p.k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid var(--line-soft)", borderRadius: 6, cursor: "pointer", background: "var(--bg-panel)" }}>
                  <input type="checkbox" checked={!!m[p.k]} onChange={e => setM({ ...m, [p.k]: e.target.checked })} />
                  <div style={{ flex: 1 }}>
                    <div style={{ font: "600 12.5px var(--font-sans)", color: "var(--ink)" }}>{p.label}</div>
                    <div style={{ font: "500 11px var(--font-sans)", color: "var(--ink-soft)" }}>{p.sub}</div>
                  </div>
                </label>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid var(--line-soft)", borderRadius: 6, background: "var(--bg-panel)" }}>
                <div>
                  <div style={{ font: "600 12.5px var(--font-sans)", color: "var(--ink)" }}>Approval limit</div>
                  <div style={{ font: "500 11px var(--font-sans)", color: "var(--ink-soft)" }}>Net Payable up to which they can approve solo</div>
                </div>
                <select value={m.canApproveAbove} onChange={e => setM({ ...m, canApproveAbove: +e.target.value })} style={{ ...inputCss, width: 200 }}>
                  <option value={0}>No approval rights</option>
                  <option value={50000}>≤ {window.inrFmt(50000)}</option>
                  <option value={500000}>≤ {window.inrFmt(500000)}</option>
                  <option value={1000000}>≤ {window.inrFmt(1000000)}</option>
                  <option value={10000000}>≤ {window.inrFmt(10000000)}</option>
                  <option value={-1}>Unlimited</option>
                </select>
              </div>
            </div>
          </div>

          {/* Account state */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Account state">
              <select style={inputCss} value={m.status} onChange={e => setM({ ...m, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="invited">Invited (pending)</option>
              </select>
            </Field>
            <Field label="Two-factor auth" hint="Required for Owner & CA Sign-off — cannot be disabled">
              <select style={inputCss} value={m.twoFA ? "on" : "off"} onChange={e => setM({ ...m, twoFA: e.target.value === "on" })} disabled={m.role === "Owner" || m.role === "CA Sign-off"}>
                <option value="on">Required</option>
                <option value="off">Optional</option>
              </select>
            </Field>
          </div>
        </div>

        <div className="modal-foot" style={{ display: "flex", justifyContent: "space-between" }}>
          {editing ? (
            <button onClick={() => { onSave?.({ ...m, _delete: true }); onClose(); }}
                    style={{ height: 32, padding: "0 12px", borderRadius: 8, border: "1px solid var(--warn)", background: "transparent", color: "var(--warn)", font: "600 12.5px var(--font-sans)", cursor: "pointer" }}>
              Remove from firm
            </button>
          ) : <span />}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{ height: 32, padding: "0 14px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--ink)", font: "600 13px var(--font-sans)" }}>Cancel</button>
            <button disabled={!ready} onClick={() => { onSave?.(m); onClose(); }} style={{ height: 32, padding: "0 14px", borderRadius: 8, border: 0, background: ready ? "var(--accent)" : "var(--bg-sunken)", color: ready ? "white" : "var(--ink-muted)", font: "600 13px var(--font-sans)", cursor: ready ? "pointer" : "not-allowed" }}>{editing ? "Save changes" : "Send invite"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
window.TeamMemberModal = TeamMemberModal;
