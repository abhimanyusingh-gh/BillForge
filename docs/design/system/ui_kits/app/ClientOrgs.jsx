// ClientOrgs.jsx — client org master + per-org health
function ClientOrgs() {
  const [newOpen, setNewOpen] = React.useState(false);
  const orgs = [
    { id: "r1", name: "Sundaram Textiles Pvt Ltd",   gstin: "33AABCS9999K1Z2", tally: "ok",   bills: 612, dueTds: 4720000,  members: 4, state: "active",   alterDrift: 0 },
    { id: "r2", name: "Hari Vishnu Industries",      gstin: "27AAAHV4567P1Z9", tally: "ok",   bills: 188, dueTds: 1240000,  members: 3, state: "active",   alterDrift: 0 },
    { id: "r3", name: "Coastal Aqua Exports LLP",    gstin: "—",                tally: "warn", bills: 41,  dueTds: 0,        members: 2, state: "incomplete", alterDrift: 0 },
    { id: "r4", name: "Patel & Patel Logistics",     gstin: "24AAACP1234R1ZX", tally: "ok",   bills: 134, dueTds: 720000,   members: 2, state: "active",   alterDrift: 0 },
    { id: "r5", name: "Madurai Sweets & Snacks",     gstin: "33AABCM7777Q1Z3", tally: "fail", bills: 67,  dueTds: 240000,   members: 2, state: "active",   alterDrift: 12 },
    { id: "r6", name: "Innova Software Solutions",   gstin: "29AABCI0001K1ZA", tally: "ok",   bills: 92,  dueTds: 2480000,  members: 3, state: "active",   alterDrift: 0 },
    { id: "r7", name: "BlueOcean Marine Pvt Ltd",    gstin: "33AABCB5555F1Z6", tally: "ok",   bills: 41,  dueTds: 122400,   members: 2, state: "active",   alterDrift: 0 },
    { id: "r8", name: "Greenleaf Organics",          gstin: "29AABCG3333H1ZP", tally: "warn", bills: 28,  dueTds: 81600,    members: 1, state: "onboarding",alterDrift: 4 },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Client Orgs</h1>
        <span className="count">{orgs.length} client orgs · 1 incomplete · 1 onboarding</span>
        <div className="page-tools">
          <button style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg-panel)", font: "600 12px var(--font-sans)" }}>Bulk import…</button>
          <button onClick={() => setNewOpen(true)} style={{ height: 30, padding: "0 14px", borderRadius: 8, border: 0, background: "var(--accent)", color: "white", font: "600 12px var(--font-sans)", cursor: "pointer" }}>+ New client org</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
        {orgs.map(o => (
          <div key={o.id} style={{ background: "var(--bg-panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 32, height: 32, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--accent-soft-bg)", color: "var(--accent)", font: "700 12px var(--font-sans)" }}>
                {o.name.split(" ").slice(0, 2).map(w => w[0]).join("")}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "700 13px var(--font-sans)", color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.name}</div>
                <div className="mono-cell" style={{ color: o.gstin === "—" ? "var(--warn)" : "var(--ink-soft)" }}>{o.gstin}</div>
              </div>
              {o.state === "active"     ? <span className="spill s-approved"><span className="dot"></span>ACTIVE</span> :
               o.state === "onboarding" ? <span className="spill s-parsed"><span className="dot"></span>ONBOARDING</span> :
                                          <span className="spill s-needs_review"><span className="dot"></span>INCOMPLETE</span>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              <div style={{ background: "var(--bg-sunken)", borderRadius: 6, padding: "6px 8px" }}>
                <div style={{ font: "600 9px var(--font-sans)", color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".08em" }}>Bills FY</div>
                <div style={{ font: "700 14px var(--font-mono)" }}>{o.bills}</div>
              </div>
              <div style={{ background: "var(--bg-sunken)", borderRadius: 6, padding: "6px 8px" }}>
                <div style={{ font: "600 9px var(--font-sans)", color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".08em" }}>TDS due</div>
                <div style={{ font: "700 13px var(--font-mono)", color: o.dueTds > 0 ? "var(--warn)" : "var(--ink)" }}>{o.dueTds > 0 ? window.inrFmt(o.dueTds) : "—"}</div>
              </div>
              <div style={{ background: "var(--bg-sunken)", borderRadius: 6, padding: "6px 8px" }}>
                <div style={{ font: "600 9px var(--font-sans)", color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".08em" }}>Team</div>
                <div style={{ font: "700 14px var(--font-mono)" }}>{o.members}</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, font: "500 11px var(--font-sans)", color: "var(--ink-soft)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: o.tally === "ok" ? "var(--emerald)" : o.tally === "warn" ? "#f59e0b" : "var(--warn)" }}></span>
                Tally · {o.tally === "ok" ? "synced" : o.tally === "warn" ? `${o.alterDrift} drift` : "auth failed"}
              </span>
              <span style={{ marginLeft: "auto", color: "var(--accent)", fontWeight: 600, cursor: "pointer" }}>Open →</span>
            </div>
          </div>
        ))}
      </div>
      <window.NewClientOrgModal open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}
window.ClientOrgs = ClientOrgs;
