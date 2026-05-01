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
    <div className="platform-stats-grid" data-testid="tds-kpi-tiles">
      <KpiCard
        label="Total TDS Deducted (FYTD)"
        value={fmtInr(totalDeductedFytdMinor)}
        accent
        icon="receipt_long"
      />
      <KpiCard
        label="Threshold Crossings"
        value={thresholdCrossingsCount}
        warn={thresholdCrossingsCount > 0}
        icon="warning"
      />
      <KpiCard
        label="Vendors Above Threshold"
        value={vendorsAboveThresholdCount}
        warn={vendorsAboveThresholdCount > 0}
        icon="store"
      />
    </div>
  );
}
