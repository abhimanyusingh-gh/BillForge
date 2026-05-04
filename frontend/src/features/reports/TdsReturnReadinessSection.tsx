export function TdsReturnReadinessSection() {
  return (
    <section className="tds-section tds-placeholder-section" data-testid="tds-return-readiness-placeholder">
      <header className="tds-section-head">
        <h3>Quarterly return readiness</h3>
        <span className="tds-section-hint">Pre-flight before TRACES upload</span>
      </header>
      <div className="tds-placeholder-body">
        <span className="material-symbols-outlined tds-placeholder-icon">fact_check</span>
        <div>
          <p className="tds-placeholder-title">26Q / 24Q readiness checks coming soon</p>
          <p className="tds-placeholder-desc">
            Deductee PAN coverage, challan match, bill classification and Form 26AS reconciliation
            will surface here once the BE return-readiness endpoint lands (issue #428).
          </p>
        </div>
      </div>
    </section>
  );
}
