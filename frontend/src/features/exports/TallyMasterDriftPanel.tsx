export function TallyMasterDriftPanel() {
  return (
    <section className="tds-section" data-testid="tally-master-drift-placeholder">
      <header className="tds-section-head">
        <h3>Master data drift</h3>
        <span className="tds-section-hint">LB &rarr; Tally</span>
      </header>
      <div className="tally-drift-empty">
        Ledger / vendor / TDS-nature drift checks will appear here once master sync is wired (issue #428).
      </div>
    </section>
  );
}
