// RealmSwitcher.jsx — command palette
function RealmSwitcher({ open, realms, currentId, onPick, onClose }) {
  const [query, setQuery] = React.useState("");
  const [hi, setHi] = React.useState(0);
  React.useEffect(() => { if (open) { setQuery(""); setHi(0); } }, [open]);
  if (!open) return null;
  const filtered = realms.filter(r => r.name.toLowerCase().includes(query.toLowerCase()));
  const recent = filtered.filter(r => r.recent).sort((a, b) => a.recent - b.recent);
  const others = filtered.filter(r => !r.recent);
  let idx = 0;
  const renderRow = (r) => {
    const i = idx++;
    return (
      <div key={r.id} className={"cmdk-row " + (i === hi ? "highlight" : "")} onMouseEnter={() => setHi(i)} onClick={() => onPick(r)}>
        <span className="leading"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>account_tree</span></span>
        <span>{r.name}</span>
        {currentId === r.id ? <span className="meta" style={{ color: "var(--accent)" }}>active</span> : null}
      </div>
    );
  };
  return (
    <div className="scrim" onClick={onClose}>
      <div className="cmdk" onClick={e => e.stopPropagation()}>
        <div className="cmdk-input">
          <span className="material-symbols-outlined">search</span>
          <input autoFocus placeholder="Switch client org…" value={query} onChange={e => setQuery(e.target.value)}
                 onKeyDown={e => {
                   if (e.key === "Escape") onClose();
                   if (e.key === "Enter" && filtered[hi]) onPick(filtered[hi]);
                   if (e.key === "ArrowDown") setHi(Math.min(filtered.length - 1, hi + 1));
                   if (e.key === "ArrowUp") setHi(Math.max(0, hi - 1));
                 }} />
          <span className="lb-kbd">Esc</span>
        </div>
        <div style={{ overflow: "auto" }}>
          {recent.length ? (
            <div className="cmdk-section">
              <h4>Recent</h4>
              {recent.map(renderRow)}
            </div>
          ) : null}
          {others.length ? (
            <div className="cmdk-section">
              <h4>All client orgs ({others.length})</h4>
              {others.map(renderRow)}
            </div>
          ) : null}
        </div>
        <div className="cmdk-foot">
          <span><span className="kbd">↵</span>Switch</span>
          <span><span className="kbd">↑</span><span className="kbd">↓</span>Navigate</span>
          <span style={{ marginLeft: "auto" }}><span className="kbd">⌘K</span>Toggle</span>
        </div>
      </div>
    </div>
  );
}
window.RealmSwitcher = RealmSwitcher;
