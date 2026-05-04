// Invoices.jsx — table-first; click row to open detail; approved rows open Bank-Map modal; multi-file drag-drop upload
//
// SERVER-DRIVEN SEARCH + SORT
// ---------------------------
// `query` (debounced 280ms) and `sort = { col, dir, loading }` are dispatched
// to a mocked backend via `runInvoiceFetch` (setTimeout). The table is dumb:
// it renders whatever rows the parent gives it, in order. Real backend would
// replace `runInvoiceFetch` with:
//   GET /invoices?q=&sort=&dir=&filter=&page=
// While a fetch is in flight, headers freeze, the active header spins, and a
// "Searching on server" pill surfaces above the rows.
const INV_COMPARATORS = {
  status:  (a, b) => a.status.localeCompare(b.status),
  vendor:  (a, b) => a.vendor.localeCompare(b.vendor),
  number:  (a, b) => String(a.number).localeCompare(String(b.number)),
  date:    (a, b) => parseInvDate(a.date) - parseInvDate(b.date),
  section: (a, b) => String(a.section).localeCompare(String(b.section)),
  gross:   (a, b) => a.gross - b.gross,
  tds:     (a, b) => a.tds - b.tds,
  net:     (a, b) => a.net - b.net,
};
function parseInvDate(s) {
  // expect "DD-MMM-YYYY"
  if (!s) return 0;
  const m = String(s).match(/(\d{1,2})[-\s]([A-Za-z]{3})[-\s](\d{4})/);
  if (!m) return Date.parse(s) || 0;
  const months = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
  return new Date(parseInt(m[3],10), months[m[2]] ?? 0, parseInt(m[1],10)).getTime();
}
function runInvoiceFetch(all, { query, filter, sort }) {
  const q = (query || "").trim().toLowerCase();
  let rows = all;
  if (filter !== "all") rows = rows.filter(r => r.status === filter);
  if (q) {
    rows = rows.filter(r =>
      r.vendor.toLowerCase().includes(q)
      || String(r.number).toLowerCase().includes(q)
      || String(r.date).toLowerCase().includes(q)
      || String(r.section).toLowerCase().includes(q)
      || String(r.status).toLowerCase().includes(q)
    );
  }
  if (sort && sort.col) {
    const cmp = INV_COMPARATORS[sort.col];
    if (cmp) {
      rows = [...rows].sort(cmp);
      if (sort.dir === "desc") rows.reverse();
    }
  }
  return rows;
}
// Local sortable header — self-contained so we don't depend on PlatformAdmin.css
function InvSortHeader({ col, label, align, sort, onSort, style }) {
  const active = sort && sort.col === col;
  const dir = active ? sort.dir : null;
  const loading = active && sort.loading;
  const icon = loading ? "progress_activity" : !active ? "unfold_more" : dir === "asc" ? "arrow_upward" : "arrow_downward";
  return (
    <th
      className={"inv-th sortable" + (active ? " active" : "") + (loading ? " loading" : "")}
      style={{ ...(style || {}), textAlign: align || "left" }}
      onClick={() => !sort?.loading && onSort?.(col)}
      aria-sort={!active ? "none" : dir === "asc" ? "ascending" : "descending"}
    >
      <span className="inv-th-inner" style={{ justifyContent: align === "right" ? "flex-end" : "flex-start" }}>
        <span>{label}</span>
        <span className={"material-symbols-outlined inv-th-icon" + (loading ? " spin" : "")}>{icon}</span>
      </span>
    </th>
  );
}

function Invoices({ activeId, onSelect }) {
  const [drag, setDrag] = React.useState(false);
  const [filter, setFilter] = React.useState("all");
  const [detail, setDetail] = React.useState(null);
  const [detailTab, setDetailTab] = React.useState("invoice"); // "invoice" | "map"
  const [uploads, setUploads] = React.useState([]);

  // Search + sort state
  const [queryInput, setQueryInput] = React.useState("");      // controlled input
  const [query, setQuery] = React.useState("");                // debounced — what the "server" sees
  const [sort, setSort] = React.useState({ col: "date", dir: "desc", loading: false });
  const [rows, setRows] = React.useState(() => runInvoiceFetch(window.INVOICES, { query: "", filter: "all", sort: { col: "date", dir: "desc" } }));
  const fetchToken = React.useRef(0);

  // Debounce typing → query
  React.useEffect(() => {
    const t = setTimeout(() => setQuery(queryInput), 280);
    return () => clearTimeout(t);
  }, [queryInput]);

  // Dispatch a "server" fetch whenever query / filter / sort.col / sort.dir changes
  React.useEffect(() => {
    const token = ++fetchToken.current;
    setSort(s => ({ ...s, loading: true }));
    const delay = query ? 540 : 380;
    const t = setTimeout(() => {
      if (fetchToken.current !== token) return;
      const next = runInvoiceFetch(window.INVOICES, { query, filter, sort });
      setRows(next);
      setSort(s => ({ ...s, loading: false }));
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filter, sort.col, sort.dir]);

  const onSort = (col) => {
    if (sort.loading) return;
    setSort(s => {
      if (s.col === col) return { ...s, dir: s.dir === "asc" ? "desc" : "asc" };
      // sensible defaults: text → asc, numeric/date → desc
      const numeric = col === "gross" || col === "tds" || col === "net" || col === "date";
      return { col, dir: numeric ? "desc" : "asc", loading: false };
    });
  };

  // Per-invoice payment ledger: { [invoiceId]: [{...payment}] }
  const [ledger, setLedger] = React.useState(() => ({
    // i3 (Reliance Jio) seeded as PARTIAL
    i3: [{ id: "p_seed1", date: "20-Apr-2026", amount: 41778000, mode: "NEFT", utr: "N164020", account: "HDFC Current ··2034", linkedTxn: "t_seed1", note: "Part 1 of 2" }],
    // i6 (Asian Paints) seeded as FULLY PAID
    i6: [{ id: "p_seed2", date: "07-Apr-2026", amount: 122277600, mode: "NEFT", utr: "N162004", account: "HDFC Current ··2034", linkedTxn: "t_seed2", note: "Full settlement" }],
  }));
  const fileRef = React.useRef(null);

  const handleFiles = (fileList) => {
    const list = Array.from(fileList || []);
    if (list.length === 0) return;
    const next = list.map((f, i) => ({
      id: "u" + Date.now() + "_" + i,
      name: f.name,
      size: f.size,
      kind: /\.(pdf)$/i.test(f.name) ? "pdf" : /\.(xml|json)$/i.test(f.name) ? "data" : /\.(png|jpg|jpeg)$/i.test(f.name) ? "image" : "doc",
      status: "queued",
    }));
    setUploads(prev => [...next, ...prev]);
    next.forEach((u, i) => setTimeout(() => setUploads(prev => prev.map(x => x.id === u.id ? { ...x, status: "parsing" } : x)), 200 + i * 100));
    next.forEach((u, i) => setTimeout(() => setUploads(prev => prev.map(x => x.id === u.id ? { ...x, status: i % 5 === 2 ? "needs_review" : "parsed", routedTo: "Action Required" } : x)), 1100 + i * 200));
  };

  const onDrop = (e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); };
  const onDragOver = (e) => { e.preventDefault(); setDrag(true); };
  const onDragLeave = () => setDrag(false);

  React.useEffect(() => {
    if (!detail) return;
    const onKey = (e) => { if (e.key === "Escape") setDetail(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail]);

  const row = window.INVOICES.find(r => r.id === detail);
  const payState = (inv) => {
    const list = ledger[inv.id] || [];
    const paid = list.reduce((s, p) => s + p.amount, 0);
    const balance = (inv.net || 0) - paid;
    let label = "UNPAID", color = "var(--ink-soft)";
    if (paid > 0 && balance > 0) { label = "PARTIAL";  color = "#b8770b"; }
    else if (paid > 0 && balance <= 0) { label = "FULLY PAID"; color = "var(--emerald)"; }
    if (paid > inv.net) { label = "OVERPAID"; color = "var(--warn)"; }
    return { paid, balance: Math.max(0, balance), label, color, count: list.length };
  };

  const mapInv = null;
  const mapInvPayments = [];

  if (row) {
    const isMappable = row.status === "approved" || row.status === "exported";
    const tab = isMappable ? detailTab : "invoice";
    const ps = payState(row);
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <button onClick={() => setDetail(null)} title="Back to invoices (Esc)"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 10px 0 8px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--ink)", font: "600 12px var(--font-sans)", cursor: "pointer" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
            Back
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 6, font: "500 12px var(--font-sans)", color: "var(--ink-soft)" }}>
            <button onClick={() => setDetail(null)} style={{ background: "transparent", border: 0, color: "var(--accent)", font: "600 12px var(--font-sans)", cursor: "pointer", padding: 0 }}>Invoices</button>
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--ink-muted)" }}>chevron_right</span>
            <span className="lb-mono" style={{ color: "var(--ink)" }}>{row.number}</span>
            <span style={{ color: "var(--ink-muted)" }}>·</span>
            <span>{row.vendor}</span>
          </div>
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, font: "500 11px var(--font-sans)", color: "var(--ink-muted)" }}>
            <span className="lb-kbd">Esc</span>
          </span>
        </div>

        {/* Tab strip — only when invoice is mappable */}
        {isMappable ? (
          <div role="tablist" aria-label="Invoice sections"
               style={{ display: "flex", alignItems: "stretch", gap: 0, marginBottom: 12, borderBottom: "1px solid var(--line)" }}>
            {[
              { id: "invoice", label: "Invoice details", icon: "description", meta: row.status.toUpperCase() },
              { id: "map",     label: "Map to bank transactions", icon: "account_balance", meta: ps.label, metaColor: ps.color },
            ].map(t => {
              const active = tab === t.id;
              return (
                <button key={t.id} role="tab" aria-selected={active} onClick={() => setDetailTab(t.id)}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 8,
                          padding: "10px 16px", marginBottom: -1,
                          background: "transparent",
                          border: 0,
                          borderBottom: "2px solid " + (active ? "var(--accent)" : "transparent"),
                          color: active ? "var(--ink)" : "var(--ink-soft)",
                          font: (active ? "700" : "600") + " 13px var(--font-sans)",
                          cursor: "pointer",
                        }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: active ? "var(--accent)" : "var(--ink-muted)" }}>{t.icon}</span>
                  <span>{t.label}</span>
                  <span style={{
                          marginLeft: 4,
                          padding: "2px 7px", borderRadius: 4,
                          font: "700 9.5px var(--font-sans)",
                          letterSpacing: ".06em", textTransform: "uppercase",
                          background: active ? "var(--bg-sunken)" : "transparent",
                          color: t.metaColor || "var(--ink-muted)",
                          border: "1px solid " + (active ? "var(--line)" : "transparent"),
                        }}>{t.meta}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {tab === "invoice" ? (
          <window.InvoiceDetail row={row} />
        ) : (
          <window.RecordPaymentModal
            embedded
            invoice={row}
            seedPayments={ledger[row.id] || []}
            onSave={({ invoiceId, payments }) => setLedger(prev => ({ ...prev, [invoiceId]: payments }))}
          />
        )}
      </div>
    );
  }

  const fmtSize = (n) => n > 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
  const kindIcon = { pdf: "picture_as_pdf", data: "data_object", image: "image", doc: "draft" };
  const statusChip = {
    queued:       { label: "QUEUED",      cls: "s-pending" },
    parsing:      { label: "PARSING…",    cls: "s-parsed" },
    parsed:       { label: "PARSED",      cls: "s-approved" },
    needs_review: { label: "NEEDS REVIEW",cls: "s-needs_review" },
  };

  return (
    <div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} style={{ position: "relative", minHeight: "calc(100vh - 80px)" }}>
      <div className="page-header">
        <h1>Invoices</h1>
        <span className="count">
          {sort.loading
            ? "loading…"
            : (rows.length === window.INVOICES.length
                ? rows.length + " this month"
                : rows.length + " of " + window.INVOICES.length + (query || filter !== "all" ? " match" : "")
              )
          }
        </span>
        <div className="page-tools">
          <div className="inv-search">
            <span className="material-symbols-outlined">search</span>
            <input
              type="text"
              value={queryInput}
              onChange={e => setQueryInput(e.target.value)}
              placeholder="Search vendor, invoice #, section, status…"
              spellCheck={false}
            />
            {queryInput ? (
              <button type="button" className="inv-search-clear" onClick={() => setQueryInput("")} title="Clear search">
                <span className="material-symbols-outlined">close</span>
              </button>
            ) : null}
            {sort.loading && query ? (
              <span className="inv-search-spinner" title="Searching on server">
                <span className="material-symbols-outlined spin">progress_activity</span>
              </span>
            ) : null}
          </div>
          <button onClick={() => fileRef.current?.click()} title="Upload invoices (or drag anywhere on the page)" style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--ink)", font: "600 12px var(--font-sans)", cursor: "pointer" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4 }}>upload</span>
            Upload
          </button>
          <input ref={fileRef} type="file" multiple accept=".pdf,.xml,.json,.png,.jpg,.jpeg" onChange={e => handleFiles(e.target.files)} style={{ display: "none" }} />
          <button style={{ height: 30, padding: "0 12px", borderRadius: 8, border: 0, background: "var(--accent)", color: "white", font: "600 12px var(--font-sans)" }}>+ Manual entry</button>
        </div>
      </div>

      {uploads.length > 0 ? (
        <div style={{ marginBottom: 12, border: "1px solid var(--line)", borderRadius: 10, background: "var(--bg-panel)", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid var(--line-soft)", background: "var(--bg-sunken)" }}>
            <span style={{ font: "600 11px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)" }}>Recent uploads · {uploads.length}</span>
            <span style={{ marginLeft: 8, font: "500 11.5px var(--font-sans)", color: "var(--ink-soft)" }}>
              {uploads.filter(u => u.status === "parsed").length} parsed ·
              {" "}{uploads.filter(u => u.status === "needs_review").length} need review ·
              {" "}{uploads.filter(u => u.status === "parsing" || u.status === "queued").length} processing
            </span>
            <button onClick={() => setUploads([])} style={{ marginLeft: "auto", font: "600 11px var(--font-sans)", color: "var(--ink-soft)", background: "transparent", border: 0, cursor: "pointer" }}>Clear</button>
          </div>
          <div style={{ maxHeight: 160, overflowY: "auto" }}>
            {uploads.map(u => {
              const chip = statusChip[u.status];
              return (
                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid var(--line-soft)" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--ink-soft)" }}>{kindIcon[u.kind]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "600 12.5px var(--font-sans)", color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</div>
                    <div style={{ font: "500 11px var(--font-mono)", color: "var(--ink-soft)" }}>{fmtSize(u.size)}{u.routedTo ? <span> · → <span style={{ color: "var(--accent)" }}>{u.routedTo}</span></span> : null}</div>
                  </div>
                  <span className={"spill " + chip.cls}><span className="dot"></span>{chip.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="chips">
        {[
          ["all", "All", window.INVOICES.length],
          ["needs_review", "Needs review", window.INVOICES.filter(i => i.status === "needs_review").length],
          ["awaiting_approval", "Awaiting approval", window.INVOICES.filter(i => i.status === "awaiting_approval").length],
          ["approved", "Approved · ready to map", window.INVOICES.filter(i => i.status === "approved").length],
          ["exported", "Exported", window.INVOICES.filter(i => i.status === "exported").length],
        ].map(([id, label, n]) => (
          <button key={id} className={"chip " + (filter === id ? "active" : "")} onClick={() => setFilter(id)}>{label} <span className="num">{n}</span></button>
        ))}
      </div>

      <div className={"table-wrap inv-table-wrap" + (sort.loading ? " is-loading" : "")}>
        {sort.loading ? (
          <span className="inv-fetch-overlay">
            <span className="material-symbols-outlined spin">progress_activity</span>
            {query
              ? <>Searching <b>“{query}”</b> on server…</>
              : <>Sorting on server by <b>{sort.col}</b> · {sort.dir === "asc" ? "ascending" : "descending"}…</>
            }
          </span>
        ) : null}
        <table className="lbtable">
          <thead><tr>
            <th style={{ width: 18 }}></th>
            <InvSortHeader col="status"  label="Status"      sort={sort} onSort={onSort} style={{ width: 170 }} />
            <InvSortHeader col="vendor"  label="Vendor"      sort={sort} onSort={onSort} />
            <InvSortHeader col="number"  label="Invoice #"   sort={sort} onSort={onSort} style={{ width: 140 }} />
            <InvSortHeader col="date"    label="Date"        sort={sort} onSort={onSort} style={{ width: 100 }} />
            <InvSortHeader col="section" label="Section"     sort={sort} onSort={onSort} style={{ width: 90 }} />
            <InvSortHeader col="gross"   label="Gross"       align="right" sort={sort} onSort={onSort} style={{ width: 100 }} />
            <InvSortHeader col="tds"     label="TDS"         align="right" sort={sort} onSort={onSort} style={{ width: 100 }} />
            <InvSortHeader col="net"     label="Net Payable" align="right" sort={sort} onSort={onSort} style={{ width: 130 }} />
            <th style={{ width: 170 }}>Payment</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && !sort.loading ? (
              <tr><td colSpan={10}>
                <div className="inv-empty">
                  <span className="material-symbols-outlined">search_off</span>
                  <div>
                    <div style={{ font: "600 13px var(--font-sans)", color: "var(--ink)" }}>No invoices match your search.</div>
                    <div style={{ font: "500 12px var(--font-sans)", color: "var(--ink-soft)", marginTop: 2 }}>
                      {query ? <>Nothing matches <b style={{ color: "var(--ink)" }}>"{query}"</b>{filter !== "all" ? <> within <b style={{ color: "var(--ink)" }}>{filter.replace(/_/g, " ")}</b></> : null}.</> : <>No invoices in this filter.</>}
                      {" "}<button type="button" onClick={() => { setQueryInput(""); setFilter("all"); }} style={{ background: "transparent", border: 0, color: "var(--accent)", font: "600 12px var(--font-sans)", cursor: "pointer", padding: 0 }}>Reset</button>
                    </div>
                  </div>
                </div>
              </td></tr>
            ) : null}
            {rows.map(r => {
              const ps = payState(r);
              const isMappable = r.status === "approved" || r.status === "exported";
              return (
                <tr key={r.id} className={activeId === r.id ? "row-active" : ""} title={isMappable ? "Click to map to bank transaction" : "Click to open"}
                    style={isMappable ? { cursor: "pointer" } : undefined}
                    onClick={() => {
                      onSelect(r.id);
                      setDetail(r.id);
                      setDetailTab(isMappable ? "map" : "invoice");
                    }}>
                  <td><span className={"cdot " + r.severity}></span></td>
                  <td><span className={"spill s-" + r.status}><span className="dot"></span>{r.status.toUpperCase()}</span></td>
                  <td style={{ fontWeight: 600 }}>{r.vendor}</td>
                  <td className="mono-cell">{r.number}</td>
                  <td className="mono-cell">{r.date}</td>
                  <td className="mono-cell" style={{ color: r.section === "—" ? "var(--ink-muted)" : "var(--accent)" }}>{r.section}</td>
                  <td className="num-cell">{window.inrFmt(r.gross)}</td>
                  <td className="num-cell" style={{ color: "var(--warn)" }}>− {window.inrFmt(r.tds)}</td>
                  <td className="num-cell" style={{ fontWeight: 600 }}>{window.inrFmt(r.net)}</td>
                  <td>
                    {isMappable ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "1px 7px", borderRadius: 999, background: "color-mix(in oklab, " + ps.color + " 14%, transparent)", color: ps.color, font: "700 10px var(--font-sans)", letterSpacing: ".04em" }}>
                            <span style={{ width: 6, height: 6, borderRadius: 999, background: ps.color }}></span>
                            {ps.label}
                          </span>
                          {ps.count > 0 ? <span style={{ font: "500 10px var(--font-sans)", color: "var(--ink-muted)" }}>{ps.count}× txn</span> : null}
                        </div>
                        {ps.balance > 0 && ps.paid > 0 ? (
                          <span style={{ font: "600 11px var(--font-mono)", color: "#b8770b" }}>balance {window.inrFmt(ps.balance)}</span>
                        ) : ps.paid === 0 ? (
                          <button
                            type="button"
                            className="map-bank-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelect(r.id);
                              setDetail(r.id);
                              setDetailTab("map");
                            }}
                          >
                            <span className="material-symbols-outlined">account_balance</span>
                            Map bank txn
                          </button>
                        ) : (
                          <span style={{ font: "500 10.5px var(--font-sans)", color: "var(--ink-muted)" }}>settled</span>
                        )}
                      </div>
                    ) : (
                      <span style={{ font: "500 11px var(--font-sans)", color: "var(--ink-muted)" }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {drag ? (
        <div style={{ position: "absolute", inset: 0, background: "rgba(17,82,212,.06)", border: "2px dashed var(--accent)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ textAlign: "center" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 40, color: "var(--accent)" }}>cloud_upload</span>
            <div style={{ font: "700 16px var(--font-sans)", color: "var(--accent)", marginTop: 6 }}>Drop multiple invoices to ingest</div>
            <div style={{ font: "500 12px var(--font-sans)", color: "var(--ink-soft)" }}>OCR + parse all at once, then route to <b>Action Required</b>.</div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
window.Invoices = Invoices;
