// Mailboxes.jsx — connected mail accounts + ingestion log
function Mailboxes() {
  const boxes = [
    { id: "m1", addr: "ap@sundaram.in",         prov: "Gmail",   client: "Sundaram Textiles Pvt Ltd",   today: 14, fy: 612, last: "10:21",     state: "ok" },
    { id: "m2", addr: "bills@hvind.com",        prov: "Outlook", client: "Hari Vishnu Industries",       today: 4,  fy: 188, last: "10:14",     state: "ok" },
    { id: "m3", addr: "ap@coastalaqua.in",      prov: "Gmail",   client: "Coastal Aqua Exports LLP",     today: 0,  fy: 41,  last: "Yesterday", state: "warn",  note: "Token expires in 9 days" },
    { id: "m4", addr: "vendor-bills@madurai.in",prov: "IMAP",    client: "Madurai Sweets & Snacks",      today: 0,  fy: 67,  last: "5 d ago",   state: "fail",  note: "AUTH_FAILED · re-auth required" },
    { id: "m5", addr: "ar@patel.in",            prov: "Gmail",   client: "Patel & Patel Logistics",      today: 2,  fy: 134, last: "09:48",     state: "ok" },
    { id: "m6", addr: "—",                      prov: "Forward", client: "Triage (firm-wide)",           today: 6,  fy: 88,  last: "10:02",     state: "ok",    note: "bills@khan.ledgerbuddy.in" },
  ];
  const log = React.useMemo(() => ([
    { ts: "10:21", from: "billing@tcs.com",        subj: "Invoice INV-241208-9145.pdf",          to: "ap@sundaram.in",   state: "routed",   client: "Sundaram Textiles" },
    { ts: "10:18", from: "noreply@reliance.in",    subj: "RJIL Tax Invoice — Apr 2026",          to: "ap@sundaram.in",   state: "routed",   client: "Sundaram Textiles" },
    { ts: "10:14", from: "accounts@asianpaints.in",subj: "AP-INV-22041",                          to: "ap@hvind.com",     state: "routed",   client: "Hari Vishnu" },
    { ts: "10:02", from: "support@anontrader.com", subj: "Bill #AT-0006",                         to: "bills@khan.ledgerbuddy.in", state: "triage", client: "—" },
    { ts: "09:48", from: "newsletter@vendor.io",   subj: "Quarterly newsletter",                  to: "ap@sundaram.in",   state: "skipped",  client: "—",  reason: "non-invoice" },
  ]), []);

  const mtq = window.useTableQuery({
    id: "mailbox-log",
    all: log,
    defaultSort: { col: "ts", dir: "desc" },
    searchKeys: ["from", "subj", "to", "client", "state"],
    dateKey: "ts",
    comparators: {
      ts: (a, b) => window.parseFlexibleDate(a.ts) - window.parseFlexibleDate(b.ts),
      state: (a, b) => String(a.state).localeCompare(String(b.state)),
    },
  });

  return (
    <div>
      <div className="page-header">
        <h1>Mailboxes</h1>
        <span className="count">{boxes.length} connected · 26 ingested today</span>
        <div className="page-tools">
          <button style={{ height: 30, padding: "0 14px", borderRadius: 8, border: 0, background: "var(--accent)", color: "white", font: "600 12px var(--font-sans)" }}>+ Connect mailbox</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        {boxes.map(m => (
          <div key={m.id} style={{ background: "var(--bg-panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ width: 32, height: 32, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", background: m.state === "ok" ? "var(--emerald-soft-bg)" : m.state === "warn" ? "var(--amber-soft-bg)" : "var(--warn-soft-bg)", color: m.state === "ok" ? "var(--emerald)" : m.state === "warn" ? "#b8770b" : "var(--warn)" }}>
                <span className="material-symbols-outlined">{m.prov === "Forward" ? "forward_to_inbox" : "mail"}</span>
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mono-cell" style={{ font: "600 13px var(--font-mono)", color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.addr}</div>
                <div style={{ font: "500 11px var(--font-sans)", color: "var(--ink-soft)" }}>{m.prov} · {m.client}</div>
              </div>
              <button className="iconbtn" style={{ height: 28, width: 28 }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>more_vert</span></button>
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 14, font: "500 11px var(--font-sans)", color: "var(--ink-soft)" }}>
              <span>Today <b style={{ color: "var(--ink)", fontFamily: "var(--font-mono)" }}>{m.today}</b></span>
              <span>FY <b style={{ color: "var(--ink)", fontFamily: "var(--font-mono)" }}>{m.fy}</b></span>
              <span>Last <b style={{ color: "var(--ink)", fontFamily: "var(--font-mono)" }}>{m.last}</b></span>
              <span style={{ marginLeft: "auto", color: m.state === "fail" ? "var(--warn)" : m.state === "warn" ? "#b8770b" : "var(--emerald)", fontWeight: 600 }}>{m.note || (m.state === "ok" ? "● ok" : m.state)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="section" style={{ marginTop: 0 }}>
        <div className="stitle"><h3>Ingestion log · today</h3><span className="lb-caption">26 messages · 18 invoices routed</span></div>
        <window.TableToolbar
          compact
          queryInput={mtq.queryInput} setQueryInput={mtq.setQueryInput}
          isLoading={mtq.isLoading} query={mtq.query} sort={mtq.sort}
          dateKey="ts" dateRangeId={mtq.dateRangeId} customRange={mtq.customRange}
          setDateRangeId={mtq.setDateRangeId}
          placeholder="Search sender, subject…"
          totalCount={mtq.totalCount} resultCount={mtq.rows.length}
          onClear={mtq.clearAll}
        />
        <div style={{ position: "relative" }}>
          <window.FetchOverlay isLoading={mtq.isLoading} query={mtq.query} sort={mtq.sort} kind="messages" />
          <table className={"lbtable" + (mtq.isLoading ? " tq-loading" : "")} style={{ marginTop: 4 }}>
            <thead><tr>
              <window.SortHeader col="ts" label="Time" sort={mtq.sort} onSort={mtq.onSort} hint="date" width={60} />
              <window.SortHeader col="from" label="From" sort={mtq.sort} onSort={mtq.onSort} />
              <window.SortHeader col="subj" label="Subject" sort={mtq.sort} onSort={mtq.onSort} />
              <window.SortHeader col="to" label="To mailbox" sort={mtq.sort} onSort={mtq.onSort} />
              <window.SortHeader col="client" label="Routed" sort={mtq.sort} onSort={mtq.onSort} />
              <window.SortHeader col="state" label="Result" sort={mtq.sort} onSort={mtq.onSort} width={150} />
            </tr></thead>
            <tbody>
              {mtq.rows.length === 0 ? (
                <window.TableEmpty colSpan={6} query={mtq.query} hasFilters={mtq.query || mtq.dateRangeId !== "all"} onClear={mtq.clearAll} />
              ) : mtq.rows.map((l, i) => (
                <tr key={i}>
                  <td className="mono-cell" style={{ color: "var(--ink-soft)" }}>{l.ts}</td>
                  <td className="mono-cell">{l.from}</td>
                  <td>{l.subj}</td>
                  <td className="mono-cell" style={{ color: "var(--ink-soft)" }}>{l.to}</td>
                  <td>{l.client === "—" ? <span style={{ color: "var(--ink-muted)" }}>—</span> : l.client}</td>
                  <td>
                    {l.state === "routed"  ? <span className="spill s-approved"><span className="dot"></span>ROUTED</span> :
                     l.state === "triage"  ? <span className="spill s-needs_review"><span className="dot"></span>TRIAGE</span> :
                     <span className="spill s-pending"><span className="dot"></span>SKIPPED · {l.reason}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
window.Mailboxes = Mailboxes;
