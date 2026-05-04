// ActionRequiredQueue.jsx — default landing surface
function ActionRequiredQueue({ rows: incoming, activeId, onSelect, onOpenDetail }) {
  const [statusFilter, setStatusFilter] = React.useState("all");
  const tq = window.useTableQuery({
    id: "action-required",
    all: incoming,
    defaultSort: { col: "age", dir: "desc" },
    searchKeys: ["vendor", "number", "section", "hint", "status"],
    dateKey: "date",
    extraFilter: statusFilter === "all" ? null : (r => r.status === statusFilter),
    comparators: {
      net: (a, b) => a.net - b.net,
      age: (a, b) => a.age - b.age,
      date: (a, b) => window.parseFlexibleDate(a.date) - window.parseFlexibleDate(b.date),
      status: (a, b) => a.status.localeCompare(b.status),
    },
  });
  const rows = tq.rows;
  const counts = {
    all: incoming.length,
    needs_review: incoming.filter(r => r.status === "needs_review").length,
    awaiting_approval: incoming.filter(r => r.status === "awaiting_approval").length,
  };

  return (
    <div>
      <div className="page-header">
        <h1>Action Required</h1>
        <span className="count">{incoming.length} invoices</span>
        <div className="page-tools">
          <span style={{ font: "500 11px var(--font-sans)", color: "var(--ink-soft)" }}>Walk queue</span>
          <span className="lb-kbd">J</span>
          <span style={{ color: "var(--ink-muted)" }}>/</span>
          <span className="lb-kbd">K</span>
          <span style={{ marginLeft: 12, font: "500 11px var(--font-sans)", color: "var(--ink-soft)" }}>Approve</span>
          <span className="lb-kbd">A</span>
        </div>
      </div>
      <window.TableToolbar
        queryInput={tq.queryInput} setQueryInput={tq.setQueryInput}
        isLoading={tq.isLoading} query={tq.query} sort={tq.sort}
        dateKey="date" dateRangeId={tq.dateRangeId} customRange={tq.customRange}
        setDateRangeId={tq.setDateRangeId}
        placeholder="Search vendor, invoice, hint…"
        totalCount={tq.totalCount} resultCount={rows.length}
        onClear={() => { tq.clearAll(); setStatusFilter("all"); }}
      >
        <div className="tq-chip-row">
          <button className={"tq-chip" + (statusFilter === "all" ? " active" : "")} onClick={() => setStatusFilter("all")}>All <span className="num">{counts.all}</span></button>
          <button className={"tq-chip" + (statusFilter === "needs_review" ? " active" : "")} onClick={() => setStatusFilter("needs_review")}>Needs review <span className="num">{counts.needs_review}</span></button>
          <button className={"tq-chip" + (statusFilter === "awaiting_approval" ? " active" : "")} onClick={() => setStatusFilter("awaiting_approval")}>Awaiting <span className="num">{counts.awaiting_approval}</span></button>
        </div>
      </window.TableToolbar>

      <div className="table-wrap" style={{ position: "relative" }}>
        <window.FetchOverlay isLoading={tq.isLoading} query={tq.query} sort={tq.sort} kind="invoices" />
        <table className={"lbtable" + (tq.isLoading ? " tq-loading" : "")}>
          <thead><tr>
            <th style={{ width: 18 }}></th>
            <window.SortHeader col="status" label="Status" sort={tq.sort} onSort={tq.onSort} width={170} />
            <window.SortHeader col="vendor" label="Vendor" sort={tq.sort} onSort={tq.onSort} />
            <window.SortHeader col="number" label="Invoice #" sort={tq.sort} onSort={tq.onSort} width={130} />
            <window.SortHeader col="date" label="Date" sort={tq.sort} onSort={tq.onSort} hint="date" width={110} />
            <window.SortHeader col="section" label="Section" sort={tq.sort} onSort={tq.onSort} width={90} />
            <window.SortHeader col="hint" label="Hint" sort={tq.sort} onSort={tq.onSort} sortable={false} />
            <window.SortHeader col="age" label="Age" sort={tq.sort} onSort={tq.onSort} hint="numeric" align="right" width={70} />
            <window.SortHeader col="net" label="Net Payable" sort={tq.sort} onSort={tq.onSort} hint="numeric" align="right" width={140} />
          </tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <window.TableEmpty colSpan={9} query={tq.query} hasFilters={tq.query || tq.dateRangeId !== "all" || statusFilter !== "all"} onClear={() => { tq.clearAll(); setStatusFilter("all"); }} />
            ) : rows.map(r => (
              <tr key={r.id}
                  className={activeId === r.id ? "row-active" : ""}
                  onClick={() => onSelect(r.id)}
                  onDoubleClick={() => onOpenDetail(r.id)}>
                <td><span className={"cdot " + r.severity}></span></td>
                <td><span className={"spill s-" + r.status}><span className="dot"></span>{r.status.toUpperCase()}</span></td>
                <td style={{ fontWeight: 600, color: "var(--ink)" }}>{r.vendor}</td>
                <td className="mono-cell">{r.number}</td>
                <td className="mono-cell">{r.date}</td>
                <td className="mono-cell" style={{ color: r.section === "—" ? "var(--ink-muted)" : "var(--accent)" }}>{r.section}</td>
                <td style={{ color: "var(--ink-soft)" }}>{r.hint}</td>
                <td className="num-cell" style={{ color: r.age > 5 ? "var(--warn)" : "var(--ink-soft)" }}>{r.age}d</td>
                <td className="num-cell">{window.inrFmt(r.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
window.ActionRequiredQueue = ActionRequiredQueue;
