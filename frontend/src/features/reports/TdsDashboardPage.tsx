import { useMemo } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { useTdsLiabilityReport } from "@/hooks/useTdsLiabilityReport";
import { FyQuarterFilter } from "@/features/reports/FyQuarterFilter";
import { TdsKpiTiles } from "@/features/reports/TdsKpiTiles";
import { TdsLiabilityTable } from "@/features/reports/TdsLiabilityTable";
import { TdsCumulativeChart } from "@/features/reports/TdsCumulativeChart";
import { TdsPendingChallansSection } from "@/features/reports/TdsPendingChallansSection";
import { TdsReturnReadinessSection } from "@/features/reports/TdsReturnReadinessSection";
import { fyOptions } from "@/features/reports/fiscalYear";
import { useTdsDashboardHashState } from "@/features/reports/useTdsDashboardHashState";
import type { TdsLiabilityReport } from "@/api/reports";

const FY_OPTION_COUNT = 5;

interface KpiSummary {
  totalDeductedFytdMinor: number;
  thresholdCrossingsCount: number;
  vendorsAboveThresholdCount: number;
}

function summarizeKpis(report: TdsLiabilityReport | undefined): KpiSummary {
  if (!report) {
    return { totalDeductedFytdMinor: 0, thresholdCrossingsCount: 0, vendorsAboveThresholdCount: 0 };
  }
  const totalDeductedFytdMinor = report.bySection.reduce((sum, bucket) => sum + bucket.cumulativeTdsMinor, 0);
  const thresholdCrossingsCount = report.byVendor.filter((bucket) => bucket.thresholdCrossedAt !== null).length;
  const vendorSet = new Set<string>();
  for (const bucket of report.byVendor) {
    if (bucket.thresholdCrossedAt !== null) {
      vendorSet.add(bucket.vendorFingerprint);
    }
  }
  return {
    totalDeductedFytdMinor,
    thresholdCrossingsCount,
    vendorsAboveThresholdCount: vendorSet.size
  };
}

export function TdsDashboardPage() {
  const { state, setFy, setQuarter, setVendor } = useTdsDashboardHashState();
  const fyOptionList = useMemo(() => fyOptions(new Date(), FY_OPTION_COUNT), []);
  const queryParams = useMemo(
    () => ({
      fy: state.fy,
      ...(state.quarter ? { quarter: state.quarter } : {}),
      ...(state.vendorFingerprint ? { vendorFingerprint: state.vendorFingerprint } : {})
    }),
    [state.fy, state.quarter, state.vendorFingerprint]
  );
  const query = useTdsLiabilityReport(queryParams);

  const isFiltered = state.quarter !== null || state.vendorFingerprint !== null;
  const kpis = useMemo(() => summarizeKpis(query.data), [query.data]);

  function handleClearFilters() {
    setQuarter(null);
    setVendor(null);
  }

  const periodLabel = state.quarter ? `FY ${state.fy} · ${state.quarter}` : `FY ${state.fy}`;

  return (
    <section className="tds-dashboard-page" data-testid="tds-dashboard-page">
      <header className="page-header tds-dashboard-header">
        <h1>TDS Dashboard</h1>
        <span className="count tds-dashboard-period-pill">{periodLabel}</span>
        <span className="tds-dashboard-tan-chip" data-testid="tds-dashboard-tan">
          TAN <span className="lb-mono">{query.data?.tan ?? "—"}</span>
        </span>
      </header>

      <div className="tds-dashboard-toolbar">
        <FyQuarterFilter
          fy={state.fy}
          quarter={state.quarter}
          fyOptions={fyOptionList}
          onFyChange={setFy}
          onQuarterChange={setQuarter}
        />
      </div>

      {state.vendorFingerprint ? (
        <div className="tds-active-vendor-banner" data-testid="tds-active-vendor-banner">
          <span>
            Filtered to vendor: <strong className="lb-mono">{state.vendorFingerprint}</strong>
          </span>
          <button type="button" className="app-button app-button-secondary" onClick={() => setVendor(null)}>
            Clear vendor
          </button>
        </div>
      ) : null}

      {query.isLoading ? (
        <div className="tds-loading" data-testid="tds-dashboard-loading" role="status" aria-busy="true">
          <div className="tds-kpi-grid">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="tds-stat-tile tds-stat-tile-skeleton">
                <div className="skeleton skeleton-text" />
                <div className="skeleton skeleton-value" />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {query.isError ? (
        <div className="tds-error" data-testid="tds-dashboard-error" role="alert">
          <EmptyState
            icon="error"
            heading="Failed to load TDS liability"
            description={query.error instanceof Error ? query.error.message : "Try again in a moment."}
            action={
              <button
                type="button"
                className="app-button app-button-primary"
                onClick={() => void query.refetch()}
              >
                Retry
              </button>
            }
          />
        </div>
      ) : null}

      {query.data ? (
        <>
          <TdsKpiTiles
            totalDeductedFytdMinor={kpis.totalDeductedFytdMinor}
            thresholdCrossingsCount={kpis.thresholdCrossingsCount}
            vendorsAboveThresholdCount={kpis.vendorsAboveThresholdCount}
            byQuarter={query.data.byQuarter}
            fy={state.fy}
          />

          <section className="tds-section">
            <header className="tds-section-head">
              <h3>Vendor Liability Breakdown</h3>
              <span className="tds-section-hint">Sorted by cumulative TDS</span>
            </header>
            <TdsLiabilityTable
              rows={query.data.byVendor}
              isFiltered={isFiltered}
              onClearFilters={handleClearFilters}
              onSelectVendor={setVendor}
            />
          </section>

          <section className="tds-section">
            <header className="tds-section-head">
              <h3>Quarterly Cumulative TDS by Section</h3>
              <span className="tds-section-hint">FY {state.fy}</span>
            </header>
            <TdsCumulativeChart
              byQuarter={query.data.byQuarter}
              isFiltered={isFiltered}
              onClearFilters={handleClearFilters}
            />
          </section>

          <TdsPendingChallansSection />
          <TdsReturnReadinessSection />
        </>
      ) : null}
    </section>
  );
}
