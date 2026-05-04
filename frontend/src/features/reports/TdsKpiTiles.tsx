import { KpiCard } from "@/features/overview/OverviewDashboardCharts";
import { fmtInr } from "@/features/overview/OverviewDashboardUtils";

interface TdsKpiTilesProps {
  totalDeductedFytdMinor: number;
  thresholdCrossingsCount: number;
  vendorsAboveThresholdCount: number;
}

export function TdsKpiTiles({
  totalDeductedFytdMinor,
  thresholdCrossingsCount,
  vendorsAboveThresholdCount
}: TdsKpiTilesProps) {
  return (
    <div className="platform-stats-grid tds-kpi-grid" data-testid="tds-kpi-tiles">
      <KpiCard
        label="Total TDS Deducted (FYTD)"
        value={fmtInr(totalDeductedFytdMinor)}
        sub="Across all sections"
        accent
        icon="receipt_long"
      />
      <KpiCard
        label="Threshold Crossings"
        value={thresholdCrossingsCount}
        sub={thresholdCrossingsCount > 0 ? "Action required" : "All within limits"}
        warn={thresholdCrossingsCount > 0}
        icon="warning"
      />
      <KpiCard
        label="Vendors Above Threshold"
        value={vendorsAboveThresholdCount}
        sub={vendorsAboveThresholdCount > 0 ? "Review vendor exposure" : "No vendors flagged"}
        warn={vendorsAboveThresholdCount > 0}
        icon="store"
      />
    </div>
  );
}
