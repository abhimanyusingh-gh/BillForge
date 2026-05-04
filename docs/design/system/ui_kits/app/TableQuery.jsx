// TableQuery.jsx — shared infrastructure for server-driven table search/sort/date-filter.
//
// USAGE
// -----
//   const { rows, sort, onSort, query, setQueryInput, queryInput,
//           dateRange, setDateRange, isLoading } = useTableQuery({
//     id: "invoices",                  // session-storage key
//     all: window.INVOICES,
//     defaultSort: { col: "date", dir: "desc" },
//     searchKeys: ["vendor","number","section","status","date"],
//     dateKey: "date",                 // optional — column whose value is a date
//     parseDate: parseInvDate,         // optional — d/m/y string parser
//     comparators: { ... },            // optional — col → (a,b)=>n
//     latency: 420,                    // optional — mock fetch ms
//   });
//
//   <TableToolbar
//      query={...} sort={...} dateRange={...} dateKey="date" totalCount={...} ...
//      placeholder="Search vendor, number..." />
//
//   <SortHeader col="vendor" label="Vendor" sort={sort} onSort={onSort} />
//
// CONTRACT
// --------
// Hook owns: queryInput (controlled), debounced query, sort state, dateRange,
// loading flag, and the "fetched" rows. Replace `runFetch` with a real GET
// /resource?q=&sort=&dir=&from=&to= call to ship.

(function () {
  /* ------------------------------------------------------------------ */
  /*  Date helpers                                                       */
  /* ------------------------------------------------------------------ */
  const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  function parseFlexibleDate(s) {
    if (!s) return 0;
    if (s instanceof Date) return s.getTime();
    if (typeof s === "number") return s;
    const str = String(s).trim();
    // DD-MMM-YYYY or DD MMM YYYY (e.g. "20-Apr-2026")
    let m = str.match(/(\d{1,2})[-\s]([A-Za-z]{3,})[-\s](\d{2,4})/);
    if (m) {
      const mo = MONTHS[m[2].toLowerCase().slice(0, 3)] ?? 0;
      const yr = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
      return new Date(yr, mo, parseInt(m[1], 10)).getTime();
    }
    // YYYY-MM-DD
    m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10)).getTime();
    // DD/MM/YYYY
    m = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) {
      const yr = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
      return new Date(yr, parseInt(m[2], 10) - 1, parseInt(m[1], 10)).getTime();
    }
    // HH:MM today (audit log)
    m = str.match(/^(\d{1,2}):(\d{2})/);
    if (m) {
      const today = new Date();
      return new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(m[1], 10), parseInt(m[2], 10)).getTime();
    }
    const t = Date.parse(str);
    return isNaN(t) ? 0 : t;
  }
  window.parseFlexibleDate = parseFlexibleDate;

  function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); }
  function endOfDay(d)   { const x = new Date(d); x.setHours(23, 59, 59, 999); return x.getTime(); }
  function ymd(d)        { const x = new Date(d); const m = String(x.getMonth() + 1).padStart(2, "0"); const day = String(x.getDate()).padStart(2, "0"); return x.getFullYear() + "-" + m + "-" + day; }

  /* ------------------------------------------------------------------ */
  /*  Date range presets                                                 */
  /* ------------------------------------------------------------------ */
  // FY in India runs Apr 1 → Mar 31; "this FY" = current Indian FY.
  function fyBounds(now) {
    const m = now.getMonth();
    const y = now.getFullYear();
    const startYear = m >= 3 ? y : y - 1;
    return { from: new Date(startYear, 3, 1).getTime(), to: endOfDay(now) };
  }
  function presetRange(id, now = new Date()) {
    if (id === "all") return null;
    if (id === "today") return { from: startOfDay(now), to: endOfDay(now) };
    if (id === "7d")    return { from: startOfDay(new Date(now.getTime() - 6 * 86400000)), to: endOfDay(now) };
    if (id === "30d")   return { from: startOfDay(new Date(now.getTime() - 29 * 86400000)), to: endOfDay(now) };
    if (id === "month") return { from: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), to: endOfDay(now) };
    if (id === "fy")    return fyBounds(now);
    return null;
  }
  window.presetRange = presetRange;

  /* ------------------------------------------------------------------ */
  /*  Default comparator factory                                         */
  /* ------------------------------------------------------------------ */
  function makeDefaultComparator(col, parseDate) {
    return function (a, b) {
      const av = a?.[col];
      const bv = b?.[col];
      // numeric?
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      // try date
      const ad = parseDate ? parseDate(av) : parseFlexibleDate(av);
      const bd = parseDate ? parseDate(bv) : parseFlexibleDate(bv);
      if (ad && bd && ad !== bd) return ad - bd;
      return String(av ?? "").localeCompare(String(bv ?? ""));
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Mock fetch — sort + filter + search                                */
  /* ------------------------------------------------------------------ */
  function runFetch(all, opts) {
    const { query, sort, dateRange, dateKey, parseDate, searchKeys, comparators, extraFilter } = opts;
    let rows = Array.isArray(all) ? all.slice() : [];
    if (extraFilter) rows = rows.filter(extraFilter);
    if (dateRange && dateKey) {
      rows = rows.filter(r => {
        const t = (parseDate || parseFlexibleDate)(r[dateKey]);
        if (!t) return true;
        if (dateRange.from && t < dateRange.from) return false;
        if (dateRange.to && t > dateRange.to) return false;
        return true;
      });
    }
    const q = (query || "").trim().toLowerCase();
    if (q) {
      const keys = searchKeys && searchKeys.length ? searchKeys : null;
      rows = rows.filter(r => {
        if (keys) {
          for (const k of keys) {
            const v = r[k];
            if (v != null && String(v).toLowerCase().includes(q)) return true;
          }
          return false;
        }
        // fallback: scan all string-ish values
        for (const k in r) {
          const v = r[k];
          if (v != null && (typeof v === "string" || typeof v === "number") && String(v).toLowerCase().includes(q)) return true;
        }
        return false;
      });
    }
    if (sort && sort.col) {
      const cmp = (comparators && comparators[sort.col]) || makeDefaultComparator(sort.col, parseDate);
      rows.sort(cmp);
      if (sort.dir === "desc") rows.reverse();
    }
    return rows;
  }
  window.runTableFetch = runFetch;

  /* ------------------------------------------------------------------ */
  /*  Session-storage persistence                                        */
  /* ------------------------------------------------------------------ */
  function loadState(id, fallback) {
    try {
      const raw = sessionStorage.getItem("tq:" + id);
      return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
    } catch (e) { return fallback; }
  }
  function saveState(id, state) {
    try { sessionStorage.setItem("tq:" + id, JSON.stringify(state)); } catch (e) {}
  }

  /* ------------------------------------------------------------------ */
  /*  useTableQuery hook                                                 */
  /* ------------------------------------------------------------------ */
  function useTableQuery(opts) {
    const {
      id, all, defaultSort, searchKeys, dateKey, parseDate, comparators,
      latency = 380, defaultDateRangeId = "all", extraFilter,
    } = opts;
    const persisted = id ? loadState(id, {}) : {};

    // Defensive: if caller passes a fresh array literal each render, hash its
    // contents to a stable identity so the fetch effect doesn't loop.
    const allRef = React.useRef(all);
    const allSig = React.useMemo(() => {
      try { return JSON.stringify(all); } catch (e) { return String(Math.random()); }
    }, [all]);
    React.useEffect(() => { allRef.current = all; }, [allSig]); // eslint-disable-line
    const [queryInput, setQueryInput] = React.useState(persisted.query || "");
    const [query, setQuery] = React.useState(persisted.query || "");
    const [sort, setSort] = React.useState(persisted.sort || { col: defaultSort?.col, dir: defaultSort?.dir || "asc", loading: false });
    const [dateRangeId, setDateRangeIdState] = React.useState(persisted.dateRangeId || defaultDateRangeId);
    const [customRange, setCustomRange] = React.useState(persisted.customRange || null);
    const fetchToken = React.useRef(0);

    const dateRange = React.useMemo(() => {
      if (dateRangeId === "custom") return customRange;
      return presetRange(dateRangeId);
    }, [dateRangeId, customRange]);

    // Initial rows synchronously so first render isn't empty
    const [rows, setRows] = React.useState(() => runFetch(all, {
      query: persisted.query || "", sort: persisted.sort || defaultSort,
      dateRange: dateRangeId === "custom" ? customRange : presetRange(dateRangeId),
      dateKey, parseDate, searchKeys, comparators, extraFilter,
    }));

    // Debounce typing → query
    React.useEffect(() => {
      const t = setTimeout(() => setQuery(queryInput), 280);
      return () => clearTimeout(t);
    }, [queryInput]);

    // Persist
    React.useEffect(() => {
      if (id) saveState(id, { query, sort: { col: sort.col, dir: sort.dir }, dateRangeId, customRange });
    }, [id, query, sort.col, sort.dir, dateRangeId, customRange]);

    // Dispatch a "server" fetch on every relevant change
    React.useEffect(() => {
      const token = ++fetchToken.current;
      setSort(s => ({ ...s, loading: true }));
      const delay = query ? Math.max(latency + 100, 480) : latency;
      const t = setTimeout(() => {
        if (fetchToken.current !== token) return;
        setRows(runFetch(allRef.current, { query, sort, dateRange, dateKey, parseDate, searchKeys, comparators, extraFilter }));
        setSort(s => ({ ...s, loading: false }));
      }, delay);
      return () => clearTimeout(t);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, sort.col, sort.dir, dateRangeId, customRange, allSig]);

    const onSort = React.useCallback((col, hint) => {
      setSort(s => {
        if (s.loading) return s;
        if (s.col === col) return { ...s, dir: s.dir === "asc" ? "desc" : "asc" };
        const numeric = hint === "numeric" || hint === "date";
        return { col, dir: numeric ? "desc" : "asc", loading: false };
      });
    }, []);

    const setDateRangeId = React.useCallback((nextId, range) => {
      setDateRangeIdState(nextId);
      if (nextId === "custom" && range) setCustomRange(range);
      if (nextId !== "custom") setCustomRange(null);
    }, []);

    const clearAll = React.useCallback(() => {
      setQueryInput("");
      setDateRangeIdState(defaultDateRangeId);
      setCustomRange(null);
    }, [defaultDateRangeId]);

    return {
      rows, sort, onSort,
      query, queryInput, setQueryInput,
      dateRangeId, customRange, dateRange, setDateRangeId,
      isLoading: !!sort.loading,
      clearAll,
      totalCount: (all || []).length,
    };
  }
  window.useTableQuery = useTableQuery;

  /* ------------------------------------------------------------------ */
  /*  <SortHeader> — drop-in <th> replacement                            */
  /* ------------------------------------------------------------------ */
  function SortHeader({ col, label, align, sort, onSort, hint, sortable = true, style, width }) {
    const active = sort && sort.col === col;
    const dir = active ? sort.dir : null;
    const loading = active && sort.loading;
    const icon = !sortable ? null : loading ? "progress_activity" : !active ? "unfold_more" : dir === "asc" ? "arrow_upward" : "arrow_downward";
    return (
      <th
        className={"tq-th" + (sortable ? " sortable" : "") + (active ? " active" : "") + (loading ? " loading" : "")}
        style={{ ...(style || {}), width: width != null ? width : style?.width, textAlign: align || "left" }}
        onClick={() => sortable && !sort?.loading && onSort?.(col, hint)}
        aria-sort={!active ? "none" : dir === "asc" ? "ascending" : "descending"}
      >
        <span className="tq-th-inner" style={{ justifyContent: align === "right" ? "flex-end" : "flex-start" }}>
          <span>{label}</span>
          {icon ? <span className={"material-symbols-outlined tq-th-icon" + (loading ? " spin" : "")}>{icon}</span> : null}
        </span>
      </th>
    );
  }
  window.SortHeader = SortHeader;

  /* ------------------------------------------------------------------ */
  /*  <DateRangePicker>                                                  */
  /* ------------------------------------------------------------------ */
  const PRESETS = [
    { id: "all",   label: "All time" },
    { id: "today", label: "Today" },
    { id: "7d",    label: "7 days" },
    { id: "30d",   label: "30 days" },
    { id: "month", label: "This month" },
    { id: "fy",    label: "This FY" },
    { id: "custom",label: "Custom…" },
  ];
  function DateRangePicker({ dateRangeId, customRange, onChange }) {
    const [open, setOpen] = React.useState(false);
    const [from, setFrom] = React.useState(customRange?.from ? ymd(customRange.from) : "");
    const [to, setTo] = React.useState(customRange?.to ? ymd(customRange.to) : "");
    const wrapRef = React.useRef(null);
    React.useEffect(() => {
      if (!open) return;
      const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
      document.addEventListener("mousedown", onDoc);
      return () => document.removeEventListener("mousedown", onDoc);
    }, [open]);
    const active = PRESETS.find(p => p.id === dateRangeId) || PRESETS[0];
    const customLabel = customRange?.from && customRange?.to ? (ymd(customRange.from) + " → " + ymd(customRange.to)) : null;
    const label = dateRangeId === "custom" && customLabel ? customLabel : active.label;
    const isFiltered = dateRangeId !== "all";
    return (
      <div className="tq-date" ref={wrapRef}>
        <button type="button" className={"tq-date-trigger" + (isFiltered ? " active" : "")} onClick={() => setOpen(o => !o)}>
          <span className="material-symbols-outlined">date_range</span>
          <span className="tq-date-label">{label}</span>
          <span className="material-symbols-outlined tq-date-caret">expand_more</span>
        </button>
        {open ? (
          <div className="tq-date-pop" role="dialog">
            <div className="tq-date-presets">
              {PRESETS.map(p => (
                <button key={p.id} type="button"
                  className={"tq-date-preset" + (p.id === dateRangeId ? " active" : "")}
                  onClick={() => {
                    if (p.id === "custom") return;
                    onChange(p.id, null);
                    setOpen(false);
                  }}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="tq-date-custom">
              <label>
                <span>From</span>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
              </label>
              <label>
                <span>To</span>
                <input type="date" value={to} onChange={e => setTo(e.target.value)} />
              </label>
              <div className="tq-date-actions">
                <button type="button" className="tq-btn ghost" onClick={() => { setFrom(""); setTo(""); onChange("all", null); setOpen(false); }}>Clear</button>
                <button type="button" className="tq-btn primary" disabled={!from || !to}
                  onClick={() => {
                    const f = startOfDay(new Date(from));
                    const t = endOfDay(new Date(to));
                    onChange("custom", { from: Math.min(f, t), to: Math.max(f, t) });
                    setOpen(false);
                  }}>Apply</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }
  window.DateRangePicker = DateRangePicker;

  /* ------------------------------------------------------------------ */
  /*  <TableToolbar>                                                     */
  /* ------------------------------------------------------------------ */
  function TableToolbar({
    queryInput, setQueryInput, isLoading, query, sort,
    dateKey, dateRangeId, customRange, setDateRangeId,
    placeholder, totalCount, resultCount, onClear, children,
    rightChildren, hideDate, compact, label,
  }) {
    const filtered = (query && query.length > 0) || (dateRangeId && dateRangeId !== "all");
    return (
      <div className={"tq-toolbar" + (compact ? " compact" : "")}>
        {label ? <span className="tq-toolbar-label">{label}</span> : null}
        <div className="tq-search">
          <span className="material-symbols-outlined">search</span>
          <input
            type="text"
            value={queryInput}
            onChange={e => setQueryInput(e.target.value)}
            placeholder={placeholder || "Search…"}
            spellCheck={false}
          />
          {queryInput ? (
            <button type="button" className="tq-search-clear" onClick={() => setQueryInput("")} title="Clear search">
              <span className="material-symbols-outlined">close</span>
            </button>
          ) : null}
          {isLoading && query ? (
            <span className="tq-search-spinner" title="Searching on server"><span className="material-symbols-outlined spin">progress_activity</span></span>
          ) : null}
        </div>
        {!hideDate && dateKey ? (
          <DateRangePicker dateRangeId={dateRangeId} customRange={customRange} onChange={setDateRangeId} />
        ) : null}
        {children}
        <div className="tq-toolbar-spacer"></div>
        {filtered ? (
          <button type="button" className="tq-btn ghost" onClick={onClear} title="Clear all filters">
            <span className="material-symbols-outlined">backspace</span>
            Clear
          </button>
        ) : null}
        {typeof resultCount === "number" ? (
          <span className="tq-result-count">
            {isLoading ? "…" : (
              filtered
                ? <><b>{resultCount.toLocaleString("en-IN")}</b> of {totalCount.toLocaleString("en-IN")} match</>
                : <><b>{resultCount.toLocaleString("en-IN")}</b> total</>
            )}
          </span>
        ) : null}
        {rightChildren}
      </div>
    );
  }
  window.TableToolbar = TableToolbar;

  /* ------------------------------------------------------------------ */
  /*  <FetchOverlay> — pill that shows what the "server" is doing        */
  /* ------------------------------------------------------------------ */
  function FetchOverlay({ isLoading, query, sort, kind = "rows" }) {
    if (!isLoading) return null;
    return (
      <span className="tq-fetch-overlay">
        <span className="material-symbols-outlined spin">progress_activity</span>
        {query
          ? <>Searching <b>"{query}"</b> on server…</>
          : (sort && sort.col)
            ? <>Sorting {kind} on server by <b>{sort.col}</b> · {sort.dir === "asc" ? "ascending" : "descending"}…</>
            : <>Loading {kind}…</>
        }
      </span>
    );
  }
  window.FetchOverlay = FetchOverlay;

  /* ------------------------------------------------------------------ */
  /*  <EmptyState>                                                       */
  /* ------------------------------------------------------------------ */
  function TableEmpty({ colSpan = 1, query, hasFilters, onClear, message }) {
    return (
      <tr><td colSpan={colSpan}>
        <div className="tq-empty">
          <span className="material-symbols-outlined">search_off</span>
          <div>
            <div className="tq-empty-title">{message || "Nothing matches your filters."}</div>
            <div className="tq-empty-sub">
              {query
                ? <>No rows match <b>"{query}"</b>.</>
                : <>No rows in this view.</>
              }
              {hasFilters && onClear ? <>{" "}<button type="button" className="tq-link" onClick={onClear}>Reset</button></> : null}
            </div>
          </div>
        </div>
      </td></tr>
    );
  }
  window.TableEmpty = TableEmpty;
})();
