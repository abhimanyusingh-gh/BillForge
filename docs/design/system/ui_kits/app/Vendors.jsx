// Vendors.jsx — list + detail (uses inline create button — kept for older index pages)
function VendorsTableInner({ active, setActive, withCreate, onCreate }) {
  const tq = window.useTableQuery({
    id: "vendors",
    all: window.VENDORS,
    defaultSort: { col: "name", dir: "asc" },
    searchKeys: ["name", "pan", "gstin", "section", "tally"],
    dateKey: "lastInvoice",
    comparators: {
      fyTds: (a, b) => a.fyTds - b.fyTds,
      bills: (a, b) => a.bills - b.bills,
      tally: (a, b) => String(a.tally).localeCompare(String(b.tally)),
      lastInvoice: (a, b) => window.parseFlexibleDate(a.lastInvoice) - window.parseFlexibleDate(b.lastInvoice),
    },
  });
  const rows = tq.rows;
  return (
    <React.Fragment>
      <window.TableToolbar
        queryInput={tq.queryInput} setQueryInput={tq.setQueryInput}
        isLoading={tq.isLoading} query={tq.query} sort={tq.sort}
        dateKey="lastInvoice" dateRangeId={tq.dateRangeId} customRange={tq.customRange}
        setDateRangeId={tq.setDateRangeId}
        placeholder="Search vendor, PAN, section…"
        totalCount={tq.totalCount} resultCount={rows.length}
        onClear={tq.clearAll}
      />
      <div className="table-wrap" style={{ position: "relative" }}>
        <window.FetchOverlay isLoading={tq.isLoading} query={tq.query} sort={tq.sort} kind="vendors" />
        <table className={"lbtable" + (tq.isLoading ? " tq-loading" : "")}>
          <thead><tr>
            <window.SortHeader col="name" label="Vendor" sort={tq.sort} onSort={tq.onSort} />
            <window.SortHeader col="pan" label="PAN" sort={tq.sort} onSort={tq.onSort} width={120} />
            <window.SortHeader col="section" label="Section" sort={tq.sort} onSort={tq.onSort} width={100} />
            <window.SortHeader col="fyTds" label="FY 25-26 TDS" sort={tq.sort} onSort={tq.onSort} hint="numeric" align="right" width={140} />
            <window.SortHeader col="tally" label="Tally" sort={tq.sort} onSort={tq.onSort} width={130} />
            <window.SortHeader col="bills" label="Bills" sort={tq.sort} onSort={tq.onSort} hint="numeric" align="right" width={70} />
          </tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <window.TableEmpty colSpan={6} query={tq.query} hasFilters={tq.query || tq.dateRangeId !== "all"} onClear={tq.clearAll} />
            ) : rows.map(x => (
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
    </React.Fragment>
  );
}
window.VendorsTableInner = VendorsTableInner;

function VendorDetailPanel({ v }) {
  return (
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
  );
}
window.VendorDetailPanel = VendorDetailPanel;

function Vendors() {
  const [active, setActive] = React.useState(window.VENDORS[0].name);
  const v = window.VENDORS.find(x => x.name === active) || window.VENDORS[0];
  return (
    <div>
      <div className="page-header">
        <h1>Vendors</h1>
        <span className="count">{window.VENDORS.length} active</span>
        <div className="page-tools">
          <button style={{ height: 30, padding: "0 12px", borderRadius: 8, border: 0, background: "var(--accent)", color: "white", font: "600 12px var(--font-sans)" }}>+ New vendor</button>
        </div>
      </div>
      <div className="vendors-grid" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12, alignItems: "start" }}>
        <div><window.VendorsTableInner active={active} setActive={setActive} /></div>
        <div>
          <div className="tq-toolbar-spacer-rail" aria-hidden="true"></div>
          <window.VendorDetailPanel v={v} />
        </div>
      </div>
    </div>
  );
}
window.Vendors = Vendors;
