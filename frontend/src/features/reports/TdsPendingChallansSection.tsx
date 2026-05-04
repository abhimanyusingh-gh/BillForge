export function TdsPendingChallansSection() {
  return (
    <section className="tds-section tds-placeholder-section" data-testid="tds-pending-challans-placeholder">
      <header className="tds-section-head">
        <h3>Pending challan deposits</h3>
        <span className="tds-section-hint">Sec. 200 · 7th of next month</span>
      </header>
      <div className="tds-placeholder-body">
        <span className="material-symbols-outlined tds-placeholder-icon">receipt_long</span>
        <div>
          <p className="tds-placeholder-title">Challan deposit tracking is on the way</p>
          <p className="tds-placeholder-desc">
            Once bank-debit ↔ deductee allocation is wired (issue #428), pending challans, partial
            deposits, and aggregated CBDT mappings will appear here.
          </p>
        </div>
      </div>
    </section>
  );
}
