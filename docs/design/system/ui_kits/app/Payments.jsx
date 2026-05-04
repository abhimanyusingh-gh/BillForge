// Payments.jsx — payment runs + outflow planner
function Payments() {
  const allRows = React.useMemo(() => ([
    { id: "p1", vendor: "Tata Consultancy Services", invoice: "INV-241208-9145", net: 42480000, due: "30-Apr-2026", method: "RTGS", account: "ICICI ··2419", state: "approved", days: 3 },
    { id: "p2", vendor: "Reliance Jio Infocomm",     invoice: "RJIL-92834",       net: 83556000, due: "08-May-2026", method: "RTGS", account: "ICICI ··2419", state: "approved", days: 11 },
    { id: "p3", vendor: "Mahalakshmi Power Loom",    invoice: "MPL/2526/0412",    net: 11404800, due: "25-Apr-2026", method: "NEFT", account: "HDFC ··2034",  state: "msme_due", days: -2, badge: "MSME · 45-day" },
    { id: "p4", vendor: "Sundaram Stationers",       invoice: "SS/26/0093",       net: 3998400,  due: "22-May-2026", method: "NEFT", account: "HDFC ··2034",  state: "scheduled", days: 25 },
    { id: "p5", vendor: "Asian Paints Ltd",          invoice: "AP-INV-22041",     net: 122277600, due: "20-May-2026", method: "RTGS", account: "ICICI ··2419", state: "scheduled", days: 23 },
  ]), []);

  const stateLabel = { approved: "READY", scheduled: "SCHEDULED", msme_due: "MSME OVERDUE" };
  const tq = window.useTableQuery({
    id: "payments",
    all: allRows,
    defaultSort: { col: "due", dir: "asc" },
    searchKeys: ["vendor", "invoice", "method", "account"],
    dateKey: "due",
    comparators: {
      state: (a, b) => (stateLabel[a.state] || a.state).localeCompare(stateLabel[b.state] || b.state),
      net: (a, b) => a.net - b.net,
      days: (a, b) => a.days - b.days,
      due: (a, b) => window.parseFlexibleDate(a.due) - window.parseFlexibleDate(b.due),
    },
  });
  const rows = tq.rows;

  const totalDue = rows.reduce((a, q) => a + q.net, 0);
  const overdue = rows.filter(q => q.days < 0).reduce((a, q) => a + q.net, 0);
  const next7 = rows.filter(q => q.days >= 0 && q.days <= 7).reduce((a, q) => a + q.net, 0);

  return (
    <div>
      <div className="page-header">
        <h1>Payments</h1>
        <span className="count">{allRows.length} approved · ready to disburse</span>
        <div className="page-tools"></div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        {[
          { lbl: "Total approved", val: window.inrFmt(totalDue), tone: "ink" },
          { lbl: "MSME / overdue",  val: window.inrFmt(overdue), tone: "warn", hint: "1 invoice past 45-day clock" },
          { lbl: "Due in next 7 d", val: window.inrFmt(next7),   tone: "amber" },
          { lbl: "Bank A/c balance", val: window.inrFmt(220000000), hint: "ICICI Current ··2419", tone: "ink" },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, background: "var(--bg-panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ font: "700 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".1em", color: "var(--ink-soft)" }}>{s.lbl}</div>
            <div style={{ font: "700 20px var(--font-mono)", color: s.tone === "warn" ? "var(--warn)" : s.tone === "amber" ? "#b8770b" : "var(--ink)", marginTop: 4 }}>{s.val}</div>
            {s.hint ? <div style={{ font: "500 11px var(--font-sans)", color: "var(--ink-soft)", marginTop: 2 }}>{s.hint}</div> : null}
          </div>
        ))}
      </div>

      <window.TableToolbar
        queryInput={tq.queryInput} setQueryInput={tq.setQueryInput}
        isLoading={tq.isLoading} query={tq.query} sort={tq.sort}
        dateKey="due" dateRangeId={tq.dateRangeId} customRange={tq.customRange}
        setDateRangeId={tq.setDateRangeId}
        placeholder="Search vendor, invoice, method…"
        totalCount={tq.totalCount} resultCount={rows.length}
        onClear={tq.clearAll}
      />

      <div className="table-wrap" style={{ position: "relative" }}>
        <window.FetchOverlay isLoading={tq.isLoading} query={tq.query} sort={tq.sort} kind="payments" />
        <table className={"lbtable" + (tq.isLoading ? " tq-loading" : "")}>
          <thead><tr>
            <th style={{ width: 26 }}><input type="checkbox" defaultChecked /></th>
            <window.SortHeader col="vendor" label="Vendor" sort={tq.sort} onSort={tq.onSort} />
            <window.SortHeader col="invoice" label="Invoice" sort={tq.sort} onSort={tq.onSort} width={140} />
            <window.SortHeader col="due" label="Due" sort={tq.sort} onSort={tq.onSort} hint="date" width={110} />
            <window.SortHeader col="method" label="Method" sort={tq.sort} onSort={tq.onSort} width={90} />
            <window.SortHeader col="account" label="From account" sort={tq.sort} onSort={tq.onSort} width={140} />
            <window.SortHeader col="state" label="State" sort={tq.sort} onSort={tq.onSort} width={140} />
            <window.SortHeader col="net" label="Amount" sort={tq.sort} onSort={tq.onSort} hint="numeric" align="right" width={140} />
          </tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <window.TableEmpty colSpan={8} query={tq.query} hasFilters={tq.query || tq.dateRangeId !== "all"} onClear={tq.clearAll} />
            ) : rows.map(q => (
              <tr key={q.id}>
                <td><input type="checkbox" defaultChecked /></td>
                <td style={{ fontWeight: 600 }}>{q.vendor}{q.badge ? <span style={{ marginLeft: 6, font: "600 9px var(--font-mono)", padding: "1px 5px", background: "var(--amber-soft-bg)", color: "#b8770b", borderRadius: 999 }}>{q.badge}</span> : null}</td>
                <td className="mono-cell">{q.invoice}</td>
                <td className="mono-cell" style={{ color: q.days < 0 ? "var(--warn)" : q.days < 7 ? "#b8770b" : "var(--ink-soft)" }}>{q.due}<div style={{ font: "500 10px var(--font-mono)" }}>{q.days < 0 ? `${-q.days}d overdue` : `${q.days}d left`}</div></td>
                <td className="mono-cell">{q.method}</td>
                <td className="mono-cell" style={{ color: "var(--ink-soft)" }}>{q.account}</td>
                <td>
                  {q.state === "approved" ? <span className="spill s-approved"><span className="dot"></span>READY</span> :
                   q.state === "scheduled" ? <span className="spill s-pending"><span className="dot"></span>SCHEDULED</span> :
                   <span className="spill s-needs_review"><span className="dot"></span>MSME OVERDUE</span>}
                </td>
                <td className="num-cell">{window.inrFmt(q.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
window.Payments = Payments;
