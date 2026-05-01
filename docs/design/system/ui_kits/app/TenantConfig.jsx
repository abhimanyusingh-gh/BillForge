// TenantConfig.jsx — progressive disclosure setup
function TenantConfig() {
  const sections = [
    {
      id: "tenant",
      label: "Firm",
      icon: "business",
      done: 4,
      total: 4,
      summary: "Khan & Associates, CA · 8 client orgs · 12 seats",
      detail: () => (
        <div className="kvgrid">
          <div className="kv"><span>Firm name</span><span className="v">Khan & Associates, CA</span></div>
          <div className="kv"><span>Practice ID</span><span className="v">PCA-2604-091</span></div>
          <div className="kv"><span>Subscription</span><span className="v">Practice · 12 seats</span></div>
          <div className="kv"><span>Default timezone</span><span className="v">Asia/Kolkata (IST)</span></div>
        </div>
      ),
    },
    {
      id: "clients",
      label: "Client orgs",
      icon: "account_tree",
      done: 7,
      total: 8,
      summary: "1 client org missing GSTIN — Coastal Aqua Exports LLP",
      detail: () => (
        <table className="lbtable" style={{ width: "100%" }}>
          <thead><tr><th>Client org</th><th>GSTIN</th><th>Tally company</th><th>Mailbox</th><th></th></tr></thead>
          <tbody>
            {[
              { n: "Sundaram Textiles Pvt Ltd",   g: "33AABCS9999K1Z2", t: "sundaram-textiles.tdc", m: "ap@sundaram.in", ok: true },
              { n: "Hari Vishnu Industries",      g: "27AAAHV4567P1Z9", t: "hari-vishnu.tdc",       m: "bills@hvind.com", ok: true },
              { n: "Coastal Aqua Exports LLP",    g: "—",               t: "coastal-aqua.tdc",      m: "—",               ok: false },
              { n: "Patel & Patel Logistics",     g: "24AAACP1234R1ZX", t: "patel-logistics.tdc",   m: "books@patel.in",  ok: true },
              { n: "Madurai Sweets & Snacks",     g: "33AABCM7777Q1Z3", t: "madurai-sweets.tdc",    m: "—",               ok: true },
            ].map((r, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{r.n}</td>
                <td className="mono-cell" style={{ color: r.g === "—" ? "var(--warn)" : "var(--ink-soft)" }}>{r.g}</td>
                <td className="mono-cell" style={{ color: "var(--ink-soft)" }}>{r.t}</td>
                <td className="mono-cell" style={{ color: r.m === "—" ? "var(--ink-muted)" : "var(--ink-soft)" }}>{r.m}</td>
                <td>
                  {r.ok
                    ? <span className="spill s-approved"><span className="dot"></span>READY</span>
                    : <span className="spill s-needs_review"><span className="dot"></span>INCOMPLETE</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ),
    },
    {
      id: "mailboxes",
      label: "Mailboxes",
      icon: "mail",
      done: 6,
      total: 8,
      summary: "1 mailbox bouncing · 1 token expiring in 9 days",
      detail: () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { addr: "ap@sundaram.in",       prov: "Gmail",     last: "10:21",     ok: "ok",    note: "62 ingested today" },
            { addr: "bills@hvind.com",      prov: "Outlook",   last: "10:14",     ok: "ok",    note: "8 ingested today" },
            { addr: "ap@coastalaqua.in",    prov: "Gmail",     last: "yesterday", ok: "warn",  note: "Token expires in 9 days" },
            { addr: "vendor-bills@madurai.in", prov: "IMAP",   last: "5d ago",    ok: "fail",  note: "AUTH_FAILED — re-auth required" },
          ].map((m, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid var(--line-soft)", borderRadius: 8 }}>
              <span style={{ width: 24, height: 24, borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", background: m.ok === "ok" ? "var(--emerald-soft-bg)" : m.ok === "warn" ? "var(--amber-soft-bg)" : "var(--warn-soft-bg)", color: m.ok === "ok" ? "var(--emerald)" : m.ok === "warn" ? "#b8770b" : "var(--warn)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{m.ok === "ok" ? "check" : m.ok === "warn" ? "warning" : "error"}</span>
              </span>
              <span className="mono-cell" style={{ flex: 1, color: "var(--ink)" }}>{m.addr}</span>
              <span style={{ font: "500 11px var(--font-sans)", color: "var(--ink-soft)" }}>{m.prov}</span>
              <span style={{ font: "500 11px var(--font-mono)", color: "var(--ink-muted)" }}>{m.last}</span>
              <span style={{ font: "500 11px var(--font-sans)", color: m.ok === "fail" ? "var(--warn)" : m.ok === "warn" ? "#b8770b" : "var(--ink-soft)", minWidth: 220, textAlign: "right" }}>{m.note}</span>
              {m.ok !== "ok" ? <button style={{ font: "600 11px var(--font-sans)", color: "var(--accent)", background: "transparent", border: 0, cursor: "pointer" }}>Fix</button> : null}
            </div>
          ))}
          <button style={{ marginTop: 4, height: 30, borderRadius: 8, border: "1px dashed var(--line)", background: "transparent", color: "var(--ink-soft)", font: "600 12px var(--font-sans)", cursor: "pointer" }}>+ Connect mailbox</button>
        </div>
      ),
    },
    {
      id: "tally",
      label: "Tally bridge",
      icon: "cable",
      done: 1,
      total: 1,
      summary: "Bridge ONLINE · 8 / 8 companies mapped",
      detail: () => (
        <div className="kvgrid">
          <div className="kv"><span>Bridge agent</span><span className="v" style={{ color: "var(--emerald)" }}>● ONLINE · 0.7.2</span></div>
          <div className="kv"><span>Tally version</span><span className="v">Prime 4.1</span></div>
          <div className="kv"><span>Poll interval</span><span className="v">10 s</span></div>
          <div className="kv"><span>Companies mapped</span><span className="v">8 / 8</span></div>
        </div>
      ),
    },
    {
      id: "tds",
      label: "TDS rules",
      icon: "receipt",
      done: 5,
      total: 6,
      summary: "1 default missing · 194Q threshold not configured for FY 26-27",
      detail: () => (
        <table className="lbtable" style={{ width: "100%" }}>
          <thead><tr><th>Vendor type</th><th>Default section</th><th>Rate</th><th>Threshold</th><th>Override allowed</th></tr></thead>
          <tbody>
            <tr><td>Professional services</td><td className="mono-cell" style={{ color: "var(--accent)" }}>194J</td><td className="mono-cell">10%</td><td className="num-cell">{window.inrFmt(3000000)}</td><td>Yes</td></tr>
            <tr><td>Contractor (corp)</td><td className="mono-cell" style={{ color: "var(--accent)" }}>194C</td><td className="mono-cell">2%</td><td className="num-cell">{window.inrFmt(3000000)}</td><td>Yes</td></tr>
            <tr><td>Contractor (individual)</td><td className="mono-cell" style={{ color: "var(--accent)" }}>194C</td><td className="mono-cell">1%</td><td className="num-cell">{window.inrFmt(3000000)}</td><td>Yes</td></tr>
            <tr><td>Goods purchase &gt; ₹50L</td><td className="mono-cell" style={{ color: "var(--accent)" }}>194Q</td><td className="mono-cell">0.1%</td><td className="num-cell" style={{ color: "var(--warn)" }}>FY 26-27 missing</td><td>No</td></tr>
            <tr><td>Rent (immovable)</td><td className="mono-cell" style={{ color: "var(--accent)" }}>194I</td><td className="mono-cell">10%</td><td className="num-cell">{window.inrFmt(2400000)}</td><td>Yes</td></tr>
            <tr><td>PAN absent</td><td className="mono-cell" style={{ color: "var(--warn)" }}>206AA</td><td className="mono-cell">20%</td><td className="num-cell">—</td><td>No</td></tr>
          </tbody>
        </table>
      ),
    },
    {
      id: "approvals",
      label: "Approval policies",
      icon: "rule",
      done: 3,
      total: 4,
      summary: "3 chains configured · suggest a chain for ₹>10L invoices",
      detail: () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { trigger: "Net Payable < ₹50,000",          steps: ["AP Clerk"],                       state: "ok" },
            { trigger: "Net Payable ₹50,000 – ₹10,00,000", steps: ["AP Clerk", "Senior Accountant"], state: "ok" },
            { trigger: "Net Payable > ₹10,00,000",       steps: ["AP Clerk", "Senior", "CA Sign-off"], state: "ok" },
            { trigger: "Vendor bank changed last 7 days", steps: ["AP Clerk", "Senior", "Force re-verify bank"], state: "draft" },
          ].map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--bg-panel)" }}>
              <span style={{ flex: 1, font: "500 12.5px var(--font-sans)", color: "var(--ink)" }}>If <b style={{ fontFamily: "var(--font-mono)" }}>{p.trigger}</b></span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                {p.steps.map((s, j) => (
                  <React.Fragment key={j}>
                    <span style={{ padding: "2px 8px", background: "var(--accent-soft-bg)", color: "var(--accent)", borderRadius: 999, font: "600 11px var(--font-sans)" }}>{s}</span>
                    {j < p.steps.length - 1 ? <span style={{ color: "var(--ink-muted)" }}>→</span> : null}
                  </React.Fragment>
                ))}
              </span>
              {p.state === "draft" ? <span className="spill s-parsed"><span className="dot"></span>DRAFT</span> : <span className="spill s-approved"><span className="dot"></span>ACTIVE</span>}
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "team",
      label: "Team & access",
      icon: "groups",
      done: 12,
      total: 12,
      summary: "12 members · 4 roles",
      detail: () => (
        <table className="lbtable" style={{ width: "100%" }}>
          <thead><tr><th>Member</th><th>Role</th><th>Client orgs</th><th>2FA</th><th>Last seen</th></tr></thead>
          <tbody>
            <tr><td>Mahir Khan</td><td>CA / Owner</td><td>All (8)</td><td><span className="spill s-approved"><span className="dot"></span>ON</span></td><td className="mono-cell">2 min ago</td></tr>
            <tr><td>Reena Patel</td><td>Senior Accountant</td><td>5</td><td><span className="spill s-approved"><span className="dot"></span>ON</span></td><td className="mono-cell">14 min ago</td></tr>
            <tr><td>Sneha Iyer</td><td>AP Clerk</td><td>3</td><td><span className="spill s-approved"><span className="dot"></span>ON</span></td><td className="mono-cell">just now</td></tr>
            <tr><td>Ravi Subramanian</td><td>Read-only auditor</td><td>2</td><td><span className="spill s-parsed"><span className="dot"></span>OFF</span></td><td className="mono-cell">3 d ago</td></tr>
          </tbody>
        </table>
      ),
    },
  ];

  const [open, setOpen] = React.useState({ tenant: false, clients: true, mailboxes: false, tally: false, tds: false, approvals: false, team: false });
  const toggle = (id) => setOpen(o => ({ ...o, [id]: !o[id] }));

  const totalDone = sections.reduce((a, s) => a + s.done, 0);
  const totalTotal = sections.reduce((a, s) => a + s.total, 0);
  const overallPct = Math.round((totalDone / totalTotal) * 100);

  return (
    <div style={{ maxWidth: 920 }}>
      <div className="page-header">
        <h1>Configuration</h1>
        <span className="count">Firm setup · progressive</span>
        <div className="page-tools">
          <span style={{ font: "500 11px var(--font-sans)", color: "var(--ink-soft)" }}>{totalDone} / {totalTotal} configured</span>
        </div>
      </div>

      {/* progress hero */}
      <div style={{ background: "var(--bg-panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <div style={{ font: "700 13px var(--font-sans)", color: "var(--ink)" }}>Setup readiness</div>
          <div style={{ font: "700 16px var(--font-mono)", color: overallPct === 100 ? "var(--emerald)" : "var(--accent)" }}>{overallPct}%</div>
        </div>
        <div style={{ height: 6, background: "var(--bg-sunken)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: overallPct + "%", height: "100%", background: overallPct === 100 ? "var(--emerald)" : "var(--accent)" }}></div>
        </div>
        <div style={{ marginTop: 8, font: "500 12px var(--font-sans)", color: "var(--ink-soft)" }}>
          You can start using LedgerBuddy as soon as a single client org has a mailbox + Tally company mapped. Other settings expand as you need them.
        </div>
      </div>

      {/* accordion sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sections.map(s => {
          const isOpen = open[s.id];
          const complete = s.done === s.total;
          return (
            <div key={s.id} style={{ background: "var(--bg-panel)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
              <button onClick={() => toggle(s.id)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 16px", background: "transparent", border: 0, cursor: "pointer", textAlign: "left" }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", background: complete ? "var(--emerald-soft-bg)" : "var(--accent-soft-bg)", color: complete ? "var(--emerald)" : "var(--accent)" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{s.icon}</span>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                    <span style={{ font: "700 14px var(--font-sans)", color: "var(--ink)" }}>{s.label}</span>
                    <span style={{ font: "500 11px var(--font-mono)", color: complete ? "var(--emerald)" : "var(--ink-soft)" }}>{s.done} / {s.total}</span>
                  </div>
                  <div style={{ font: "500 12px var(--font-sans)", color: complete ? "var(--ink-soft)" : "var(--warn)", marginTop: 2 }}>{s.summary}</div>
                </div>
                <span className="material-symbols-outlined" style={{ color: "var(--ink-muted)", transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform .15s" }}>expand_more</span>
              </button>
              {isOpen ? <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--line-soft)" }}>{s.detail()}</div> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
window.TenantConfig = TenantConfig;
