// VendorsV2.jsx — uses NewVendorModal popup
function VendorsV2() {
  const [active, setActive] = React.useState(window.VENDORS[0].name);
  const [newOpen, setNewOpen] = React.useState(false);
  const v = window.VENDORS.find(x => x.name === active);
  return (
    <div>
      <div className="page-header">
        <h1>Vendors</h1>
        <span className="count">{window.VENDORS.length} active</span>
        <div className="page-tools">
          <button onClick={() => setNewOpen(true)} style={{ height: 30, padding: "0 12px", borderRadius: 8, border: 0, background: "var(--accent)", color: "white", font: "600 12px var(--font-sans)", cursor: "pointer" }}>+ New vendor</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12 }}>
        <div className="table-wrap">
          <table className="lbtable">
            <thead><tr>
              <th>Vendor</th><th>PAN</th><th>Section</th><th style={{ textAlign: "right" }}>FY 25-26 TDS</th><th>Tally</th><th style={{ textAlign: "right" }}>Bills</th>
            </tr></thead>
            <tbody>
              {window.VENDORS.map(x => (
                <tr key={x.name} className={active === x.name ? "row-active" : ""} onClick={() => setActive(x.name)}>
                  <td style={{ fontWeight: 600 }}>{x.name}{x.msme ? <span style={{ marginLeft: 6, font: "600 9px var(--font-mono)", padding: "1px 5px", background: "var(--amber-soft-bg)", color: "#b8770b", borderRadius: 999 }}>MSME</span> : null}</td>
                  <td className="mono-cell">{x.pan}</td>
                  <td className="mono-cell" style={{ color: x.section === "—" ? "var(--ink-muted)" : "var(--accent)" }}>{x.section}</td>
                  <td className="num-cell">{window.inrFmt(x.fyTds)}</td>
                  <td>
                    {x.tally === "synced" ? <span className="spill s-approved"><span className="dot"></span>SYNCED</span> :
                     x.tally === "drift" ? <span className="spill s-parsed"><span className="dot"></span>DRIFT</span> :
                     x.tally === "pending" ? <span className="spill s-pending"><span className="dot"></span>PENDING</span> :
                     <span className="spill s-needs_review"><span className="dot"></span>NOT IN TALLY</span>}
                  </td>
                  <td className="num-cell">{x.bills}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div className="section" style={{ marginTop: 0 }}>
            <h2 style={{ font: "700 18px var(--font-sans)", margin: "0 0 4px" }}>{v.name}</h2>
            <div className="sub">PAN <span className="lb-mono">{v.pan}</span> · GSTIN <span className="lb-mono">{v.gstin}</span></div>
            <div className="kvgrid" style={{ marginTop: 12 }}>
              <div className="kv"><span>Default section</span><span className="v" style={{ color: "var(--accent)" }}>{v.section}</span></div>
              <div className="kv"><span>Bills (FY)</span><span className="v">{v.bills}</span></div>
              <div className="kv"><span>Last invoice</span><span className="v">{v.lastInvoice}</span></div>
              <div className="kv"><span>MSME</span><span className="v">{v.msme ? "Yes · 45-day" : "No"}</span></div>
            </div>
          </div>
          <div className="section">
            <div className="stitle"><h3>FY 2025-26 TDS by section</h3><span className="lb-caption">cumulative · threshold gates</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[{ sec: v.section === "—" ? "194C" : v.section, rate: 10, used: v.fyTds, threshold: 10000000 }].map((b, i) => {
                const pct = Math.min(100, (b.used / b.threshold) * 100);
                return (
                  <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", font: "500 12px var(--font-sans)", color: "var(--ink-soft)" }}>
                      <span><b style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>{b.sec}</b> · {b.rate}%</span>
                      <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink)" }}>{window.inrFmt(b.used)} / {window.inrFmt(b.threshold)}</span>
                    </div>
                    <div style={{ marginTop: 4, height: 6, background: "var(--bg-sunken)", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ width: pct + "%", height: "100%", background: pct > 80 ? "var(--warn)" : "var(--accent)" }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <window.NewVendorModal open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}
window.VendorsV2 = VendorsV2;
