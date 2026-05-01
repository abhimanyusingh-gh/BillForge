// DateRange.jsx — Indian-FY-aware date-range picker (FY = Apr–Mar; Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar)
function DateRange({ value, onChange, compact }) {
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState("preset"); // preset | quarter | year | custom
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // App is at FY 25-26, "today" = 27-Apr-2026 (Q1 of FY 26-27, but data is in FY 25-26)
  const FY_LIST = [
    { id: "fy26", label: "FY 25-26", from: "01-Apr-2025", to: "31-Mar-2026" },
    { id: "fy27", label: "FY 26-27", from: "01-Apr-2026", to: "27-Apr-2026" }, // current FY, partial
    { id: "fy25", label: "FY 24-25", from: "01-Apr-2024", to: "31-Mar-2025" },
    { id: "fy24", label: "FY 23-24", from: "01-Apr-2023", to: "31-Mar-2024" },
    { id: "fy23", label: "FY 22-23", from: "01-Apr-2022", to: "31-Mar-2023" },
  ];

  const QUARTERS = [
    // FY 25-26 quarters
    { id: "fy26q1", label: "FY 25-26 · Q1", sub: "Apr–Jun 2025", from: "01-Apr-2025", to: "30-Jun-2025" },
    { id: "fy26q2", label: "FY 25-26 · Q2", sub: "Jul–Sep 2025", from: "01-Jul-2025", to: "30-Sep-2025" },
    { id: "fy26q3", label: "FY 25-26 · Q3", sub: "Oct–Dec 2025", from: "01-Oct-2025", to: "31-Dec-2025" },
    { id: "fy26q4", label: "FY 25-26 · Q4", sub: "Jan–Mar 2026", from: "01-Jan-2026", to: "31-Mar-2026" },
    // FY 26-27 (current)
    { id: "fy27q1", label: "FY 26-27 · Q1", sub: "Apr–Jun 2026 · current", from: "01-Apr-2026", to: "27-Apr-2026" },
    // FY 24-25
    { id: "fy25q4", label: "FY 24-25 · Q4", sub: "Jan–Mar 2025", from: "01-Jan-2025", to: "31-Mar-2025" },
    { id: "fy25q3", label: "FY 24-25 · Q3", sub: "Oct–Dec 2024", from: "01-Oct-2024", to: "31-Dec-2024" },
    { id: "fy25q2", label: "FY 24-25 · Q2", sub: "Jul–Sep 2024", from: "01-Jul-2024", to: "30-Sep-2024" },
  ];

  const PRESETS = [
    { id: "today",  label: "Today",            from: "27-Apr-2026", to: "27-Apr-2026" },
    { id: "wtd",    label: "Week to date",     from: "26-Apr-2026", to: "27-Apr-2026" },
    { id: "mtd",    label: "Month to date",    from: "01-Apr-2026", to: "27-Apr-2026" },
    { id: "last7",  label: "Last 7 days",      from: "21-Apr-2026", to: "27-Apr-2026" },
    { id: "last30", label: "Last 30 days",     from: "28-Mar-2026", to: "27-Apr-2026" },
    { id: "last90", label: "Last 90 days",     from: "27-Jan-2026", to: "27-Apr-2026" },
    { id: "ytd",    label: "FY to date",       from: "01-Apr-2026", to: "27-Apr-2026" },
    { id: "qtd",    label: "Quarter to date",  from: "01-Apr-2026", to: "27-Apr-2026" },
  ];

  const v = value || { ...PRESETS[2], kind: "preset" };

  const choose = (kind, p) => {
    onChange?.({ id: p.id, label: p.label, from: p.from, to: p.to, kind });
    if (kind !== "custom") setOpen(false);
  };

  const Pill = ({ id, label }) => (
    <button onClick={() => setTab(id)}
            style={{ height: 24, padding: "0 10px", borderRadius: 6, border: 0, background: tab === id ? "var(--accent)" : "transparent", color: tab === id ? "white" : "var(--ink-soft)", font: "600 11px var(--font-sans)", cursor: "pointer" }}>
      {label}
    </button>
  );

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 10px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--ink)", font: "600 12px var(--font-sans)", cursor: "pointer" }}>
        <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--ink-soft)" }}>event</span>
        <span>{v.label}</span>
        {!compact ? <span style={{ font: "500 11px var(--font-mono)", color: "var(--ink-soft)" }}>{v.from} → {v.to}</span> : null}
        <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--ink-muted)" }}>expand_more</span>
      </button>
      {open ? (
        <div style={{ position: "absolute", right: 0, top: 36, width: 380, background: "var(--bg-panel)", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "0 12px 32px rgba(15,23,42,.18)", zIndex: 60 }}>
          <div style={{ display: "inline-flex", gap: 2, padding: 6, background: "var(--bg-sunken)", borderRadius: 8, margin: 8 }}>
            <Pill id="preset"  label="Presets" />
            <Pill id="quarter" label="Quarter" />
            <Pill id="year"    label="Financial year" />
            <Pill id="custom"  label="Custom" />
          </div>

          {tab === "preset" ? (
            <div style={{ padding: "0 8px 8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              {PRESETS.map(p => (
                <button key={p.id} onClick={() => choose("preset", p)}
                        style={{ textAlign: "left", padding: "8px 10px", borderRadius: 6, border: 0, background: v.id === p.id ? "var(--accent-soft-bg)" : "transparent", color: v.id === p.id ? "var(--accent)" : "var(--ink)", font: "600 12px var(--font-sans)", cursor: "pointer" }}>
                  {p.label}
                  <div style={{ font: "500 10px var(--font-mono)", color: "var(--ink-muted)", marginTop: 2 }}>{p.from} → {p.to}</div>
                </button>
              ))}
            </div>
          ) : null}

          {tab === "quarter" ? (
            <div style={{ padding: "0 8px 8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, maxHeight: 260, overflowY: "auto" }}>
              {QUARTERS.map(q => (
                <button key={q.id} onClick={() => choose("quarter", q)}
                        style={{ textAlign: "left", padding: "8px 10px", borderRadius: 6, border: "1px solid " + (v.id === q.id ? "var(--accent)" : "transparent"), background: v.id === q.id ? "var(--accent-soft-bg)" : "transparent", color: "var(--ink)", font: "600 12px var(--font-sans)", cursor: "pointer" }}>
                  {q.label}
                  <div style={{ font: "500 10px var(--font-sans)", color: q.sub.includes("current") ? "var(--accent)" : "var(--ink-soft)", marginTop: 2 }}>{q.sub}</div>
                </button>
              ))}
            </div>
          ) : null}

          {tab === "year" ? (
            <div style={{ padding: "0 8px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
              {FY_LIST.map(f => (
                <button key={f.id} onClick={() => choose("year", f)}
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 6, border: "1px solid " + (v.id === f.id ? "var(--accent)" : "transparent"), background: v.id === f.id ? "var(--accent-soft-bg)" : "var(--bg-sunken)", color: "var(--ink)", font: "600 13px var(--font-sans)", cursor: "pointer" }}>
                  <span>{f.label}</span>
                  <span style={{ font: "500 11px var(--font-mono)", color: "var(--ink-soft)" }}>{f.from} → {f.to}</span>
                </button>
              ))}
              <div style={{ font: "500 11px var(--font-sans)", color: "var(--ink-muted)", padding: "6px 10px 4px" }}>Indian financial year runs 1 April – 31 March.</div>
            </div>
          ) : null}

          {tab === "custom" ? (
            <div style={{ padding: "0 12px 12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ font: "600 10px var(--font-sans)", textTransform: "uppercase", color: "var(--ink-soft)" }}>From</span>
                  <input type="date" defaultValue="2026-04-01" style={{ height: 28, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 6, font: "500 12px var(--font-mono)", background: "var(--bg-main)", color: "var(--ink)" }} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ font: "600 10px var(--font-sans)", textTransform: "uppercase", color: "var(--ink-soft)" }}>To</span>
                  <input type="date" defaultValue="2026-04-27" style={{ height: 28, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 6, font: "500 12px var(--font-mono)", background: "var(--bg-main)", color: "var(--ink)" }} />
                </label>
              </div>
              <button onClick={() => { choose("custom", { id: "custom", label: "Custom", from: "01-Apr-2026", to: "27-Apr-2026" }); setOpen(false); }}
                      style={{ marginTop: 10, width: "100%", height: 30, borderRadius: 6, border: 0, background: "var(--accent)", color: "white", font: "600 12px var(--font-sans)", cursor: "pointer" }}>
                Apply range
              </button>
            </div>
          ) : null}

          <div style={{ padding: "8px 12px", borderTop: "1px solid var(--line-soft)", font: "500 11px var(--font-sans)", color: "var(--ink-muted)", display: "flex", justifyContent: "space-between" }}>
            <span>Compares to previous period</span>
            <span style={{ fontFamily: "var(--font-mono)" }}>IST</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
window.DateRange = DateRange;
