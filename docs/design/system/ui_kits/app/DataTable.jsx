// DataTable.jsx — sortable, paginated, reorderable-column table used across all tabs
// Usage:
//   <DataTable
//     columns={[{key:"number", label:"Invoice #", width:120, sortable:true, render:row=>...}, ...]}
//     rows={[...]}
//     defaultSort={{key:"date", dir:"desc"}}
//     pageSize={10}
//     totalRows={342}            // optional: server total for pagination label
//     onPageChange={(p)=>...}    // optional
//     onSortChange={(s)=>...}    // optional
//     storageKey="invoices"      // persists column order
//     onRowClick={row=>...}
//     activeRowId={id}
//     rowKey={r=>r.id}
//   />
function DataTable({ columns, rows, defaultSort, pageSize = 10, totalRows, onPageChange, onSortChange, storageKey, onRowClick, activeRowId, rowKey, dense, emptyLabel = "Nothing here yet." }) {
  const [order, setOrder] = React.useState(() => {
    if (storageKey) {
      try { const raw = localStorage.getItem("lb-cols-" + storageKey); if (raw) { const saved = JSON.parse(raw); const valid = saved.filter(k => columns.find(c => c.key === k)); const missing = columns.map(c => c.key).filter(k => !valid.includes(k)); return [...valid, ...missing]; } } catch {}
    }
    return columns.map(c => c.key);
  });
  React.useEffect(() => {
    setOrder(prev => {
      const valid = prev.filter(k => columns.find(c => c.key === k));
      const missing = columns.map(c => c.key).filter(k => !valid.includes(k));
      return [...valid, ...missing];
    });
  }, [columns.map(c => c.key).join("|")]);

  React.useEffect(() => { if (storageKey) try { localStorage.setItem("lb-cols-" + storageKey, JSON.stringify(order)); } catch {} }, [order, storageKey]);

  const [sort, setSort] = React.useState(defaultSort || null);
  const [page, setPage] = React.useState(1);
  const [dragKey, setDragKey] = React.useState(null);
  const [dropKey, setDropKey] = React.useState(null);

  const onHeaderClick = (col) => {
    if (col.sortable === false) return;
    setSort(prev => {
      let next;
      if (!prev || prev.key !== col.key) next = { key: col.key, dir: "asc" };
      else if (prev.dir === "asc") next = { key: col.key, dir: "desc" };
      else next = null;
      onSortChange?.(next);
      return next;
    });
  };

  const sortedRows = React.useMemo(() => {
    if (!sort) return rows;
    const col = columns.find(c => c.key === sort.key);
    const accessor = col?.sortBy || ((r) => r[sort.key]);
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = accessor(a); const vb = accessor(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return sort.dir === "asc" ? va - vb : vb - va;
      const sa = String(va).toLowerCase(); const sb = String(vb).toLowerCase();
      return sort.dir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
    return copy;
  }, [rows, sort, columns]);

  const total = totalRows ?? sortedRows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const startIdx = (safePage - 1) * pageSize;
  const pageRows = totalRows != null ? sortedRows : sortedRows.slice(startIdx, startIdx + pageSize);

  const goPage = (p) => { const n = Math.max(1, Math.min(pageCount, p)); setPage(n); onPageChange?.(n); };

  const orderedCols = order.map(k => columns.find(c => c.key === k)).filter(Boolean);

  const onDragStart = (k) => (e) => { setDragKey(k); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", k); } catch {} };
  const onDragOver = (k) => (e) => { e.preventDefault(); if (k !== dragKey) setDropKey(k); };
  const onDrop = (k) => (e) => {
    e.preventDefault();
    if (!dragKey || dragKey === k) { setDragKey(null); setDropKey(null); return; }
    setOrder(prev => {
      const next = prev.filter(x => x !== dragKey);
      const idx = next.indexOf(k);
      next.splice(idx, 0, dragKey);
      return next;
    });
    setDragKey(null); setDropKey(null);
  };
  const onDragEnd = () => { setDragKey(null); setDropKey(null); };

  return (
    <div>
      <div className="table-wrap">
        <table className="lbtable" style={{ tableLayout: "fixed", width: "100%" }}>
          <colgroup>
            {orderedCols.map(c => <col key={c.key} style={{ width: c.width ? c.width + "px" : "auto" }} />)}
          </colgroup>
          <thead>
            <tr>
              {orderedCols.map((c, i) => {
                const isSorted = sort?.key === c.key;
                const isDrop = dropKey === c.key;
                return (
                  <th key={c.key}
                      draggable
                      onDragStart={onDragStart(c.key)}
                      onDragOver={onDragOver(c.key)}
                      onDrop={onDrop(c.key)}
                      onDragEnd={onDragEnd}
                      onClick={() => onHeaderClick(c)}
                      title={(c.sortable === false ? "" : "Click to sort · ") + "Drag to rearrange"}
                      style={{
                        textAlign: c.align || "left",
                        cursor: c.sortable === false ? "grab" : "pointer",
                        userSelect: "none",
                        position: "relative",
                        background: isDrop ? "var(--accent-soft-bg)" : undefined,
                        boxShadow: isDrop ? "inset 2px 0 0 var(--accent)" : undefined,
                      }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 12, color: "var(--ink-muted)", cursor: "grab", marginRight: 2 }}>drag_indicator</span>
                      <span>{c.label}</span>
                      {c.sortable !== false ? (
                        <span className="material-symbols-outlined" style={{ fontSize: 13, color: isSorted ? "var(--accent)" : "var(--ink-muted)", opacity: isSorted ? 1 : .5 }}>
                          {isSorted ? (sort.dir === "asc" ? "arrow_upward" : "arrow_downward") : "unfold_more"}
                        </span>
                      ) : null}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={orderedCols.length} style={{ padding: 28, textAlign: "center", color: "var(--ink-muted)", font: "500 12px var(--font-sans)" }}>{emptyLabel}</td></tr>
            ) : pageRows.map((row, i) => {
              const id = rowKey ? rowKey(row) : (row.id ?? i);
              const isActive = activeRowId != null && id === activeRowId;
              return (
                <tr key={id}
                    onClick={() => onRowClick?.(row)}
                    style={{ cursor: onRowClick ? "pointer" : "default", background: isActive ? "var(--accent-soft-bg)" : undefined, height: dense ? 32 : undefined }}>
                  {orderedCols.map(c => (
                    <td key={c.key} style={{ textAlign: c.align || "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.render ? c.render(row) : <span>{row[c.key]}</span>}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 4px 0", font: "500 12px var(--font-sans)", color: "var(--ink-soft)" }}>
        <span>
          {pageRows.length > 0 ? (
            <>Showing <b style={{ color: "var(--ink)", fontFamily: "var(--font-mono)" }}>{startIdx + 1}–{Math.min(startIdx + pageSize, total)}</b> of <b style={{ color: "var(--ink)", fontFamily: "var(--font-mono)" }}>{total.toLocaleString("en-IN")}</b></>
          ) : null}
        </span>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => goPage(1)} disabled={safePage === 1} style={btnPag(safePage === 1)} title="First">«</button>
          <button onClick={() => goPage(safePage - 1)} disabled={safePage === 1} style={btnPag(safePage === 1)}>‹ Prev</button>
          <span style={{ font: "600 12px var(--font-mono)", color: "var(--ink)", padding: "0 6px" }}>{safePage} / {pageCount}</span>
          <button onClick={() => goPage(safePage + 1)} disabled={safePage === pageCount} style={btnPag(safePage === pageCount)}>Next ›</button>
          <button onClick={() => goPage(pageCount)} disabled={safePage === pageCount} style={btnPag(safePage === pageCount)} title="Last">»</button>
        </div>
      </div>
    </div>
  );
}
function btnPag(disabled) {
  return { height: 26, padding: "0 8px", borderRadius: 6, border: "1px solid var(--line)", background: disabled ? "var(--bg-sunken)" : "var(--bg-panel)", color: disabled ? "var(--ink-muted)" : "var(--ink)", font: "600 11px var(--font-sans)", cursor: disabled ? "not-allowed" : "pointer" };
}

// Standardised toolbar — search + filters + date range — used above every table
function TableToolbar({ search, onSearch, placeholder = "Search…", filters, dateRange, onDateRangeChange, right, count }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
      <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 380 }}>
        <span className="material-symbols-outlined" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "var(--ink-muted)", pointerEvents: "none" }}>search</span>
        <input value={search || ""} onChange={e => onSearch?.(e.target.value)} placeholder={placeholder}
               style={{ width: "100%", height: 30, padding: "0 30px 0 30px", border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--ink)", borderRadius: 8, font: "500 12.5px var(--font-sans)", outline: "none" }} />
        {search ? (
          <button onClick={() => onSearch?.("")} style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", width: 22, height: 22, borderRadius: 999, border: 0, background: "transparent", cursor: "pointer", color: "var(--ink-muted)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
          </button>
        ) : (
          <span className="lb-kbd" style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)" }}>/</span>
        )}
      </div>
      {filters}
      {dateRange !== false ? <window.DateRange value={dateRange} onChange={onDateRangeChange} /> : null}
      {right}
      {count != null ? <span style={{ marginLeft: "auto", font: "500 11px var(--font-sans)", color: "var(--ink-soft)" }}>{count}</span> : null}
    </div>
  );
}

// Reusable chip-group filter (single-select)
function ChipGroup({ value, onChange, options }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--bg-panel)", border: "1px solid var(--line)", borderRadius: 8, padding: 2 }}>
      {options.map(o => {
        const on = value === o.id;
        return (
          <button key={o.id} onClick={() => onChange?.(o.id)}
                  style={{ height: 24, padding: "0 10px", borderRadius: 6, border: 0, background: on ? "var(--accent)" : "transparent", color: on ? "white" : "var(--ink-soft)", font: "600 11.5px var(--font-sans)", cursor: "pointer" }}>
            {o.label}{o.count != null ? <span style={{ marginLeft: 6, font: "600 10.5px var(--font-mono)", opacity: .85 }}>{o.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

window.DataTable = DataTable;
window.TableToolbar = TableToolbar;
window.ChipGroup = ChipGroup;
