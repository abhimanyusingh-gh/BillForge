import { useMemo } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { useTdsLiabilityReport } from "@/hooks/useTdsLiabilityReport";
import { FyQuarterFilter } from "@/features/reports/FyQuarterFilter";
import { TdsKpiTiles } from "@/features/reports/TdsKpiTiles";
import { TdsLiabilityTable } from "@/features/reports/TdsLiabilityTable";
import { TdsCumulativeChart } from "@/features/reports/TdsCumulativeChart";
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

  return (
    <section className="tds-dashboard-page" data-testid="tds-dashboard-page">
      <header className="tds-dashboard-header">
        <div>
          <h2>TDS Liability Dashboard</h2>
          <p className="tds-dashboard-subtitle" data-testid="tds-dashboard-tan">
            TAN: {query.data?.tan ?? "—"}
          </p>
        </div>
      </header>

      <FyQuarterFilter
        fy={state.fy}
        quarter={state.quarter}
        fyOptions={fyOptionList}
        onFyChange={setFy}
        onQuarterChange={setQuarter}
      />

      {state.vendorFingerprint ? (
        <div className="tds-active-vendor-banner" data-testid="tds-active-vendor-banner">
          <span>
            Filtered to vendor: <strong>{state.vendorFingerprint}</strong>
          </span>
          <button type="button" className="app-button app-button-secondary" onClick={() => setVendor(null)}>
            Clear vendor
          </button>
        </div>
      ) : null}

      {query.isLoading ? (
        <div className="tds-loading" data-testid="tds-dashboard-loading" role="status" aria-busy="true">
          <div className="platform-stats-grid">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="platform-stat-tile">
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
          />

          <div className="tds-dashboard-section">
            <h3>Quarterly Cumulative TDS by Section</h3>
            <TdsCumulativeChart
              byQuarter={query.data.byQuarter}
              isFiltered={isFiltered}
              onClearFilters={handleClearFilters}
            />
          </div>

          <div className="tds-dashboard-section">
            <h3>Vendor Liability Breakdown</h3>
            <TdsLiabilityTable
              rows={query.data.byVendor}
              isFiltered={isFiltered}
              onClearFilters={handleClearFilters}
              onSelectVendor={setVendor}
            />
          </div>
        </>
      ) : null}
    </section>
  );
}
