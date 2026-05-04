// Triage.jsx — cross-client-org ambiguity inbox with bulk select + multi-file upload
function Triage() {
  const initialRows = [
    { id: "t1", reason: "MULTI_MATCH_GSTIN", vendor: "Tata Consultancy Services", number: "INV-241208-9145", date: "12-Apr-2026", candidates: ["Sundaram Textiles", "Hari Vishnu Industries"], routeTo: "" },
    { id: "t2", reason: "NO_GSTIN",          vendor: "Anonymous Trader",          number: "AT-0006",          date: "06-Apr-2026", candidates: ["—"], routeTo: "" },
    { id: "t3", reason: "BOUNCE",            vendor: "Reliance Jio Infocomm",     number: "RJIL-92834",       date: "08-Apr-2026", candidates: ["Sundaram Textiles", "Coastal Aqua Exports"], routeTo: "" },
    { id: "t4", reason: "MULTI_MATCH_PAN",   vendor: "Asian Paints Ltd",          number: "AP-INV-22041",     date: "05-Apr-2026", candidates: ["Madurai Sweets", "Sundaram Textiles", "Hari Vishnu Industries"], routeTo: "" },
    { id: "t5", reason: "NO_GSTIN",          vendor: "Local Stationer",           number: "LS-2026-0411",     date: "04-Apr-2026", candidates: ["—"], routeTo: "" },
    { id: "t6", reason: "MULTI_MATCH_GSTIN", vendor: "Bharti Airtel",             number: "BA-INV-22411",     date: "03-Apr-2026", candidates: ["Sundaram Textiles", "Coastal Aqua Exports", "Innova Software"], routeTo: "" },
  ];
  const [rows, setRows] = React.useState(initialRows);
  const [sel, setSel] = React.useState(new Set());
  const [bulkRoute, setBulkRoute] = React.useState("");
  const [uploads, setUploads] = React.useState([]); // pending uploaded files
  const [drag, setDrag] = React.useState(false);
  const fileRef = React.useRef(null);

  const ttq = window.useTableQuery({
    id: "triage",
    all: rows,
    defaultSort: { col: "date", dir: "desc" },
    searchKeys: ["vendor", "number", "reason"],
    dateKey: "date",
    comparators: {
      reason: (a, b) => a.reason.localeCompare(b.reason),
      date: (a, b) => window.parseFlexibleDate(a.date) - window.parseFlexibleDate(b.date),
    },
  });
  const ttqRows = ttq.rows;

  const reasonStyle = {
    MULTI_MATCH_GSTIN: { bg: "var(--amber-soft-bg)", color: "#b8770b" },
    MULTI_MATCH_PAN:   { bg: "var(--amber-soft-bg)", color: "#b8770b" },
    NO_GSTIN:          { bg: "var(--warn-soft-bg)",  color: "var(--warn)" },
    BOUNCE:            { bg: "rgba(139,92,246,.16)", color: "#7c3aed" },
  };

  const allClientOrgs = ["Sundaram Textiles", "Hari Vishnu Industries", "Madurai Sweets", "Coastal Aqua Exports", "Innova Software", "Mahalakshmi Power Loom", "Patel Logistics", "BlueOcean Marine"];

  const allChecked = sel.size === rows.length && rows.length > 0;
  const someChecked = sel.size > 0 && !allChecked;
  const toggleAll = () => setSel(allChecked ? new Set() : new Set(rows.map(r => r.id)));
  const toggleOne = (id) => setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const applyBulkRoute = () => {
    if (!bulkRoute || sel.size === 0) return;
    setRows(prev => prev.map(r => sel.has(r.id) ? { ...r, routeTo: bulkRoute } : r));
  };
  const bulkRouteAndConfirm = () => {
    if (!bulkRoute || sel.size === 0) return;
    setRows(prev => prev.filter(r => !sel.has(r.id)));
    setSel(new Set());
    setBulkRoute("");
  };
  const bulkReject = () => {
    setRows(prev => prev.filter(r => !sel.has(r.id)));
    setSel(new Set());
  };

  // Multi-file ingest (drag-drop or picker)
  const handleFiles = (fileList) => {
    const list = Array.from(fileList || []);
    if (list.length === 0) return;
    const next = list.map((f, i) => ({
      id: "u" + Date.now() + "_" + i,
      name: f.name,
      size: f.size,
      kind: /\.(pdf)$/i.test(f.name) ? "pdf" : /\.(xml|json)$/i.test(f.name) ? "data" : /\.(png|jpg|jpeg)$/i.test(f.name) ? "image" : /\.(csv|xlsx?|ofx)$/i.test(f.name) ? "stmt" : "doc",
      status: "queued",
    }));
    setUploads(prev => [...next, ...prev]);
    // Simulate parse
    next.forEach((u, i) => setTimeout(() => {
      setUploads(prev => prev.map(x => x.id === u.id ? { ...x, status: "parsing" } : x));
    }, 200 + i * 120));
    next.forEach((u, i) => setTimeout(() => {
      setUploads(prev => prev.map(x => x.id === u.id ? { ...x, status: i % 4 === 1 ? "needs_route" : "routed", routedTo: i % 4 === 1 ? null : allClientOrgs[i % allClientOrgs.length] } : x));
    }, 1100 + i * 220));
  };

  const onDragOver = (e) => { e.preventDefault(); setDrag(true); };
  const onDragLeave = () => setDrag(false);
  const onDrop = (e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); };

  const fmtSize = (n) => n > 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
  const kindIcon = { pdf: "picture_as_pdf", data: "data_object", image: "image", stmt: "account_balance", doc: "draft" };
  const statusChip = {
    queued:       { label: "QUEUED",    cls: "s-pending" },
    parsing:      { label: "PARSING…",  cls: "s-parsed" },
    routed:       { label: "ROUTED",    cls: "s-approved" },
    needs_route:  { label: "NEEDS ROUTE", cls: "s-needs_review" },
  };

  return (
    <div>
      <div className="page-header">
        <h1>Inbox Routing</h1>
        <span className="count">{rows.length} unrouted · across 8 client orgs</span>
        <div className="page-tools">
          <button onClick={() => fileRef.current?.click()} style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--ink)", font: "600 12px var(--font-sans)", display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload</span>
            Upload invoices / statements
          </button>
          <input ref={fileRef} type="file" multiple accept=".pdf,.xml,.json,.png,.jpg,.jpeg,.csv,.xlsx,.xls,.ofx" onChange={(e) => handleFiles(e.target.files)} style={{ display: "none" }} />
        </div>
      </div>

      {/* Drop zone — always visible */}
      <div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
           style={{ marginBottom: 14, padding: "14px 16px", borderRadius: 10, border: "1.5px dashed " + (drag ? "var(--accent)" : "var(--line)"), background: drag ? "var(--accent-soft-bg)" : "var(--bg-panel)", display: "flex", alignItems: "center", gap: 12, transition: "background .15s, border-color .15s" }}>
        <span className="material-symbols-outlined" style={{ fontSize: 28, color: drag ? "var(--accent)" : "var(--ink-soft)" }}>cloud_upload</span>
        <div style={{ flex: 1 }}>
          <div style={{ font: "600 13px var(--font-sans)", color: "var(--ink)" }}>{drag ? "Drop to upload" : "Drag & drop invoices or bank statements here"}</div>
          <div style={{ font: "500 11.5px var(--font-sans)", color: "var(--ink-soft)" }}>Multiple files OK · PDF, XML, OFX, CSV, XLSX, image scans · auto-routed by GSTIN / vendor / amount</div>
        </div>
        <button onClick={() => fileRef.current?.click()} style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid var(--accent)", background: "transparent", color: "var(--accent)", font: "600 12px var(--font-sans)", cursor: "pointer" }}>Browse files</button>
      </div>

      {/* Active upload tray */}
      {uploads.length > 0 ? (
        <div style={{ marginBottom: 14, border: "1px solid var(--line)", borderRadius: 10, background: "var(--bg-panel)", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid var(--line-soft)", background: "var(--bg-sunken)" }}>
            <span style={{ font: "600 11px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)" }}>Recent uploads · {uploads.length}</span>
            <span style={{ marginLeft: 8, font: "500 11.5px var(--font-sans)", color: "var(--ink-soft)" }}>
              {uploads.filter(u => u.status === "routed").length} auto-routed ·
              {" "}{uploads.filter(u => u.status === "needs_route").length} need routing ·
              {" "}{uploads.filter(u => u.status === "parsing" || u.status === "queued").length} processing
            </span>
            <button onClick={() => setUploads([])} style={{ marginLeft: "auto", font: "600 11px var(--font-sans)", color: "var(--ink-soft)", background: "transparent", border: 0, cursor: "pointer" }}>Clear</button>
          </div>
          <div style={{ maxHeight: 180, overflowY: "auto" }}>
            {uploads.map(u => {
              const chip = statusChip[u.status];
              return (
                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid var(--line-soft)" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--ink-soft)" }}>{kindIcon[u.kind]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "600 12.5px var(--font-sans)", color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</div>
                    <div style={{ font: "500 11px var(--font-mono)", color: "var(--ink-soft)" }}>
                      {fmtSize(u.size)}
                      {u.routedTo ? <span> · → <span style={{ color: "var(--accent)" }}>{u.routedTo}</span></span> : null}
                    </div>
                  </div>
                  <span className={"spill " + chip.cls}><span className="dot"></span>{chip.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div style={{ font: "500 13px var(--font-sans)", color: "var(--ink-soft)", marginBottom: 12, padding: "8px 12px", background: "var(--accent-soft-bg)", borderRadius: 8, border: "1px solid var(--line)" }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: "middle", color: "var(--accent)", marginRight: 6 }}>info</span>
        These invoices arrived in the firm-wide mailbox but the system could not auto-route them to a client org. Pick the right destination — this is a routing decision, not an approval decision.
      </div>

      {/* Bulk action bar */}
      {sel.size > 0 ? (        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", marginBottom: 10, background: "var(--accent-soft-bg)", border: "1px solid var(--accent)", borderRadius: 10 }}>
          <span style={{ font: "700 12px var(--font-sans)", color: "var(--accent)" }}>{sel.size} selected</span>
          <span style={{ width: 1, height: 18, background: "var(--line)" }} />
          <span style={{ font: "500 12px var(--font-sans)", color: "var(--ink-soft)" }}>Route all to:</span>
          <select value={bulkRoute} onChange={e => setBulkRoute(e.target.value)}
                  style={{ height: 28, padding: "0 8px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--ink)", font: "500 12px var(--font-sans)", minWidth: 200 }}>
            <option value="">— Choose client org —</option>
            {allClientOrgs.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <button onClick={applyBulkRoute} disabled={!bulkRoute}
                  style={{ height: 28, padding: "0 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg-panel)", color: bulkRoute ? "var(--ink)" : "var(--ink-muted)", font: "600 12px var(--font-sans)", cursor: bulkRoute ? "pointer" : "not-allowed" }}>
            Stage
          </button>
          <button onClick={bulkRouteAndConfirm} disabled={!bulkRoute}
                  style={{ height: 28, padding: "0 12px", borderRadius: 6, border: 0, background: bulkRoute ? "var(--accent)" : "var(--bg-sunken)", color: bulkRoute ? "white" : "var(--ink-muted)", font: "600 12px var(--font-sans)", cursor: bulkRoute ? "pointer" : "not-allowed" }}>
            Route & confirm
          </button>
          <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6 }}>
            <button onClick={bulkReject} style={{ height: 28, padding: "0 10px", borderRadius: 6, border: "1px solid var(--warn)", background: "transparent", color: "var(--warn)", font: "600 12px var(--font-sans)", cursor: "pointer" }}>Reject all</button>
            <button onClick={() => setSel(new Set())} style={{ height: 28, padding: "0 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--ink-soft)", font: "600 12px var(--font-sans)", cursor: "pointer" }}>Clear selection</button>
          </span>
        </div>
      ) : null}

      <window.TableToolbar
        queryInput={ttq.queryInput} setQueryInput={ttq.setQueryInput}
        isLoading={ttq.isLoading} query={ttq.query} sort={ttq.sort}
        dateKey="date" dateRangeId={ttq.dateRangeId} customRange={ttq.customRange}
        setDateRangeId={ttq.setDateRangeId}
        placeholder="Search vendor, invoice, reason…"
        totalCount={ttq.totalCount} resultCount={ttqRows.length}
        onClear={ttq.clearAll}
      />

      <div className="table-wrap" style={{ position: "relative" }}>
        <window.FetchOverlay isLoading={ttq.isLoading} query={ttq.query} sort={ttq.sort} kind="items" />
        <table className={"lbtable" + (ttq.isLoading ? " tq-loading" : "")}>
          <thead><tr>
            <th style={{ width: 36 }}>
              <input type="checkbox" checked={allChecked} ref={el => { if (el) el.indeterminate = someChecked; }} onChange={toggleAll} />
            </th>
            <window.SortHeader col="reason" label="Reason" sort={ttq.sort} onSort={ttq.onSort} width={200} />
            <window.SortHeader col="vendor" label="Vendor" sort={ttq.sort} onSort={ttq.onSort} />
            <window.SortHeader col="number" label="Invoice #" sort={ttq.sort} onSort={ttq.onSort} width={140} />
            <window.SortHeader col="date" label="Date" sort={ttq.sort} onSort={ttq.onSort} hint="date" width={110} />
            <window.SortHeader col="routeTo" label="Route to client org" sort={ttq.sort} onSort={ttq.onSort} sortable={false} />
            <th style={{ width: 130 }}>Action</th>
          </tr></thead>
          <tbody>
            {ttqRows.length === 0 ? (
              <window.TableEmpty colSpan={7} query={ttq.query} hasFilters={ttq.query || ttq.dateRangeId !== "all"} onClear={ttq.clearAll} />
            ) : ttqRows.map(r => {
              const s = reasonStyle[r.reason];
              const checked = sel.has(r.id);
              return (
                <tr key={r.id} style={{ background: checked ? "var(--accent-soft-bg)" : undefined }}>
                  <td><input type="checkbox" checked={checked} onChange={() => toggleOne(r.id)} /></td>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px", borderRadius: 6, background: s.bg, color: s.color, font: "600 11px var(--font-mono)" }}>
                      {r.reason}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{r.vendor}</td>
                  <td className="mono-cell">{r.number}</td>
                  <td className="mono-cell">{r.date}</td>
                  <td>
                    <select value={r.routeTo} onChange={e => setRows(p => p.map(x => x.id === r.id ? { ...x, routeTo: e.target.value } : x))}
                            style={{ width: "100%", height: 26, borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--ink)", font: "500 12px var(--font-sans)", padding: "0 8px" }}>
                      <option value="">— Choose —</option>
                      {r.candidates.filter(c => c !== "—").map((c, i) => <option key={i} value={c}>{c} (suggested)</option>)}
                      {allClientOrgs.filter(o => !r.candidates.includes(o)).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </td>
                  <td>
                    <div style={{ display: "inline-flex", gap: 4 }}>
                      <button style={{ height: 26, padding: "0 9px", borderRadius: 6, border: 0, background: "var(--accent)", color: "white", font: "600 11px var(--font-sans)" }}>Route</button>
                      <button style={{ height: 26, padding: "0 9px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--ink-soft)", font: "600 11px var(--font-sans)" }}>Reject</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
window.Triage = Triage;
