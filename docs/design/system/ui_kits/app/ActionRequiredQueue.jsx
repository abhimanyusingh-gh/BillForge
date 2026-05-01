// ActionRequiredQueue.jsx — default landing surface
function ActionRequiredQueue({ rows, activeId, onSelect, onOpenDetail }) {
  return (
    <div>
      <div className="page-header">
        <h1>Action Required</h1>
        <span className="count">{rows.length} invoices</span>
        <div className="page-tools">
          <span style={{ font: "500 11px var(--font-sans)", color: "var(--ink-soft)" }}>Walk queue</span>
          <span className="lb-kbd">J</span>
          <span style={{ color: "var(--ink-muted)" }}>/</span>
          <span className="lb-kbd">K</span>
          <span style={{ marginLeft: 12, font: "500 11px var(--font-sans)", color: "var(--ink-soft)" }}>Approve</span>
          <span className="lb-kbd">A</span>
        </div>
      </div>
      <div className="chips">
        <button className="chip active">All <span className="num">{rows.length}</span></button>
        <button className="chip">NEEDS_REVIEW <span className="num">{rows.filter(r=>r.status==="needs_review").length}</span></button>
        <button className="chip">AWAITING_APPROVAL <span className="num">{rows.filter(r=>r.status==="awaiting_approval").length}</span></button>
        <button className="chip">Mine</button>
        <button className="chip">All assignees</button>
      </div>
      <div className="table-wrap">
        <table className="lbtable">
          <thead><tr>
            <th style={{ width: 18 }}></th>
            <th style={{ width: 170 }}>Status</th>
            <th>Vendor</th>
            <th style={{ width: 130 }}>Invoice #</th>
            <th style={{ width: 100 }}>Date</th>
            <th style={{ width: 90 }}>Section</th>
            <th>Hint</th>
            <th style={{ width: 60, textAlign: "right" }}>Age</th>
            <th style={{ width: 130, textAlign: "right" }}>Net Payable</th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
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
