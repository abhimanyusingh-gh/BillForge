// BankStatements.jsx — uploaded statement files + parse status + global drag-drop
function BankStatements() {
  const [drag, setDrag] = React.useState(false);
  const [openId, setOpenId] = React.useState(null);
  const [uploads, setUploads] = React.useState([]);
  const fileRef = React.useRef(null);

  const handleFiles = (fileList) => {
    const list = Array.from(fileList || []);
    if (list.length === 0) return;
    const next = list.map((f, i) => ({
      id: "u" + Date.now() + "_" + i,
      name: f.name,
      size: f.size,
      kind: /\.(pdf)$/i.test(f.name) ? "pdf" : /\.(csv)$/i.test(f.name) ? "csv" : /\.(ofx)$/i.test(f.name) ? "ofx" : /\.(xlsx?|xls)$/i.test(f.name) ? "xls" : "doc",
      status: "queued",
    }));
    setUploads(prev => [...next, ...prev]);
    next.forEach((u, i) => setTimeout(() => setUploads(prev => prev.map(x => x.id === u.id ? { ...x, status: "parsing" } : x)), 200 + i * 100));
    next.forEach((u, i) => setTimeout(() => setUploads(prev => prev.map(x => x.id === u.id ? { ...x, status: "parsed", lines: 120 + Math.floor(Math.random() * 300) } : x)), 1200 + i * 220));
  };
  const onDrop = (e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); };
  const onDragOver = (e) => { e.preventDefault(); setDrag(true); };
  const onDragLeave = () => setDrag(false);

  const fmtSize = (n) => n > 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
  const kindIcon = { pdf: "picture_as_pdf", csv: "table_view", ofx: "data_object", xls: "grid_on", doc: "draft" };
  const statusChip = {
    queued:  { label: "QUEUED",   cls: "s-pending" },
    parsing: { label: "PARSING…", cls: "s-parsed" },
    parsed:  { label: "READY TO MATCH", cls: "s-approved" },
  };

  const stmts = React.useMemo(() => ([
    { id: "s1", account: "HDFC Current ··2034", period: "Apr 2026", file: "hdfc_2034_apr26.pdf",   uploaded: "27-Apr-2026", lines: 412, matched: 348, unmatched: 64, state: "active" },
    { id: "s2", account: "ICICI Current ··2419", period: "Apr 2026", file: "icici_2419_apr26.csv", uploaded: "27-Apr-2026", lines: 198, matched: 198, unmatched: 0,  state: "matched" },
    { id: "s3", account: "HDFC Current ··2034", period: "Mar 2026", file: "hdfc_2034_mar26.pdf",   uploaded: "02-Apr-2026", lines: 488, matched: 488, unmatched: 0,  state: "matched" },
    { id: "s4", account: "ICICI Current ··2419", period: "Mar 2026", file: "icici_2419_mar26.ofx", uploaded: "02-Apr-2026", lines: 222, matched: 222, unmatched: 0,  state: "matched" },
    { id: "s5", account: "HDFC Current ··2034", period: "Feb 2026", file: "hdfc_2034_feb26.pdf",   uploaded: "03-Mar-2026", lines: 0,   matched: 0,  unmatched: 0,   state: "parsing", error: "Parsing — 2 of 4 pages" },
  ]), []);

  const btq = window.useTableQuery({
    id: "bank-statements",
    all: stmts,
    defaultSort: { col: "uploaded", dir: "desc" },
    searchKeys: ["account", "period", "file", "state"],
    dateKey: "uploaded",
    comparators: {
      lines: (a, b) => a.lines - b.lines,
      uploaded: (a, b) => window.parseFlexibleDate(a.uploaded) - window.parseFlexibleDate(b.uploaded),
      state: (a, b) => String(a.state).localeCompare(String(b.state)),
    },
  });
  const btqRows = btq.rows;

  return (
    <div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} style={{ position: "relative", minHeight: "calc(100vh - 80px)" }}>
      <div className="page-header">
        <h1>Bank Statements</h1>
        <span className="count">2 accounts · 12 statements this FY</span>
        <div className="page-tools">
          <button style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg-panel)", font: "600 12px var(--font-sans)" }}>Connect bank feed</button>
          <button onClick={() => fileRef.current?.click()} style={{ height: 30, padding: "0 14px", borderRadius: 8, border: 0, background: "var(--accent)", color: "white", font: "600 12px var(--font-sans)", cursor: "pointer" }}>+ Upload statement</button>
          <input ref={fileRef} type="file" multiple accept=".pdf,.csv,.ofx,.xlsx,.xls,.mt940" onChange={e => handleFiles(e.target.files)} style={{ display: "none" }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        {[
          { name: "HDFC Current", tail: "··2034", bal: 18420000, asof: "27-Apr 10:21", feed: "manual" },
          { name: "ICICI Current", tail: "··2419", bal: 220000000, asof: "27-Apr 10:18", feed: "auto · daily" },
        ].map((a, i) => (
          <div key={i} style={{ background: "var(--bg-panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px", display: "flex", gap: 14, alignItems: "center" }}>
            <span style={{ width: 32, height: 32, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--accent-soft-bg)", color: "var(--accent)" }}>
              <span className="material-symbols-outlined">account_balance</span>
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ font: "700 13px var(--font-sans)" }}>{a.name} <span style={{ color: "var(--ink-soft)", fontFamily: "var(--font-mono)", fontWeight: 500 }}>{a.tail}</span></div>
              <div style={{ font: "500 11px var(--font-sans)", color: "var(--ink-soft)" }}>Feed · {a.feed} · as of {a.asof}</div>
            </div>
            <div style={{ font: "700 18px var(--font-mono)", color: "var(--ink)" }}>{window.inrFmt(a.bal)}</div>
          </div>
        ))}
      </div>

      {/* dropzone */}
      <div style={{ border: "2px dashed var(--line)", borderRadius: 10, padding: "18px 14px", display: "flex", alignItems: "center", gap: 14, background: "var(--bg-panel)", marginBottom: 12 }}>
        <span style={{ width: 38, height: 38, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--accent-soft-bg)", color: "var(--accent)" }}>
          <span className="material-symbols-outlined">upload_file</span>
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ font: "600 13px var(--font-sans)" }}>Drop statement files here</div>
          <div style={{ font: "500 12px var(--font-sans)", color: "var(--ink-soft)", marginTop: 2 }}>PDF, CSV, OFX, MT940 — auto-detected · multiple files OK</div>
        </div>
        <button onClick={() => fileRef.current?.click()} style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg-panel)", font: "600 12px var(--font-sans)", cursor: "pointer" }}>Browse files</button>
      </div>

      {uploads.length > 0 ? (
        <div style={{ marginBottom: 12, border: "1px solid var(--line)", borderRadius: 10, background: "var(--bg-panel)", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid var(--line-soft)", background: "var(--bg-sunken)" }}>
            <span style={{ font: "600 11px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)" }}>Recent uploads · {uploads.length}</span>
            <span style={{ marginLeft: 8, font: "500 11.5px var(--font-sans)", color: "var(--ink-soft)" }}>
              {uploads.filter(u => u.status === "parsed").length} ready ·
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
                    <div style={{ font: "500 11px var(--font-mono)", color: "var(--ink-soft)" }}>{fmtSize(u.size)}{u.lines ? <span> · {u.lines} lines extracted</span> : null}</div>
                  </div>
                  <span className={"spill " + chip.cls}><span className="dot"></span>{chip.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <window.TableToolbar
        queryInput={btq.queryInput} setQueryInput={btq.setQueryInput}
        isLoading={btq.isLoading} query={btq.query} sort={btq.sort}
        dateKey="uploaded" dateRangeId={btq.dateRangeId} customRange={btq.customRange}
        setDateRangeId={btq.setDateRangeId}
        placeholder="Search account, period, file…"
        totalCount={btq.totalCount} resultCount={btqRows.length}
        onClear={btq.clearAll}
      />

      <div className="table-wrap" style={{ position: "relative" }}>
        <window.FetchOverlay isLoading={btq.isLoading} query={btq.query} sort={btq.sort} kind="statements" />
        <table className={"lbtable" + (btq.isLoading ? " tq-loading" : "")}>
          <thead><tr>
            <window.SortHeader col="account" label="Account" sort={btq.sort} onSort={btq.onSort} />
            <window.SortHeader col="period" label="Period" sort={btq.sort} onSort={btq.onSort} width={110} />
            <window.SortHeader col="file" label="File" sort={btq.sort} onSort={btq.onSort} />
            <window.SortHeader col="uploaded" label="Uploaded" sort={btq.sort} onSort={btq.onSort} hint="date" width={120} />
            <window.SortHeader col="lines" label="Lines" sort={btq.sort} onSort={btq.onSort} hint="numeric" align="right" width={80} />
            <window.SortHeader col="reconciliation" label="Reconciliation" sort={btq.sort} onSort={btq.onSort} sortable={false} width={170} />
            <window.SortHeader col="state" label="State" sort={btq.sort} onSort={btq.onSort} width={140} />
            <th style={{ width: 60 }}></th>
          </tr></thead>
          <tbody>
            {btqRows.length === 0 ? (
              <window.TableEmpty colSpan={8} query={btq.query} hasFilters={btq.query || btq.dateRangeId !== "all"} onClear={btq.clearAll} />
            ) : btqRows.map(s => (
              <tr key={s.id} style={{ cursor: "pointer" }} onClick={() => setOpenId(s.id)}>
                <td className="mono-cell">{s.account}</td>
                <td>{s.period}</td>
                <td className="mono-cell" style={{ color: "var(--accent)" }}>{s.file}</td>
                <td className="mono-cell" style={{ color: "var(--ink-soft)" }}>{s.uploaded}</td>
                <td className="num-cell">{s.lines || "—"}</td>
                <td>
                  {s.lines === 0 ? <span style={{ color: "var(--ink-muted)" }}>—</span> : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 140 }}>
                      <div style={{ height: 5, background: "var(--bg-sunken)", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{ width: ((s.matched / s.lines) * 100) + "%", height: "100%", background: s.unmatched ? "#f59e0b" : "var(--emerald)" }}></div>
                      </div>
                      <div style={{ font: "500 10px var(--font-mono)", color: "var(--ink-soft)" }}>{s.matched} matched · {s.unmatched} unmatched</div>
                    </div>
                  )}
                </td>
                <td>
                  {s.state === "matched"  ? <span className="spill s-approved"><span className="dot"></span>RECONCILED</span> :
                   s.state === "active"   ? <span className="spill s-needs_review"><span className="dot"></span>{s.unmatched} TO MATCH</span> :
                   <span className="spill s-parsed"><span className="dot"></span>PARSING</span>}
                </td>
                <td className="mono-cell" style={{ color: "var(--accent)", cursor: "pointer" }} onClick={() => setOpenId(s.id)}>{s.state === "active" ? "open →" : s.state === "matched" ? "view" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drag ? (
        <div style={{ position: "absolute", inset: 0, background: "rgba(17,82,212,.06)", border: "2px dashed var(--accent)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 50 }}>
          <div style={{ textAlign: "center" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 40, color: "var(--accent)" }}>cloud_upload</span>
            <div style={{ font: "700 16px var(--font-sans)", color: "var(--accent)", marginTop: 6 }}>Drop bank statements anywhere</div>
            <div style={{ font: "500 12px var(--font-sans)", color: "var(--ink-soft)" }}>PDF, CSV, OFX, MT940 · auto-detected · matched against open invoices.</div>
          </div>
        </div>
      ) : null}
      {openId ? <window.StatementDetail stmt={stmts.find(x => x.id === openId)} onClose={() => setOpenId(null)} /> : null}
    </div>
  );
}
window.BankStatements = BankStatements;
