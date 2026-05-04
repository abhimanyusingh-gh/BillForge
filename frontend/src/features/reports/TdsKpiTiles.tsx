import { fmtInr, fmtInrShort } from "@/features/overview/OverviewDashboardUtils";
import type { TdsLiabilityQuarterBucket } from "@/api/reports";

interface TdsKpiTilesProps {
  totalDeductedFytdMinor: number;
  thresholdCrossingsCount: number;
  vendorsAboveThresholdCount: number;
  byQuarter?: TdsLiabilityQuarterBucket[];
  fy?: string;
}

interface StatTileProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warn" | "good" | "accent";
  testId?: string;
}

function StatTile({ label, value, hint, tone = "default", testId }: StatTileProps) {
  return (
    <div className="tds-stat-tile" data-tone={tone} data-testid={testId}>
      <span className="tds-stat-tile-label">{label}</span>
      <span className="tds-stat-tile-value lb-mono">{value}</span>
      {hint ? <span className="tds-stat-tile-hint">{hint}</span> : null}
    </div>
  );
}

interface QuarterBarProps {
  byQuarter: TdsLiabilityQuarterBucket[];
  fy?: string;
}

function QuarterBar({ byQuarter, fy }: QuarterBarProps) {
  const totals: Record<string, number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
  for (const bucket of byQuarter) {
    totals[bucket.quarter] = (totals[bucket.quarter] ?? 0) + bucket.cumulativeTdsMinor;
  }
  const order = ["Q1", "Q2", "Q3", "Q4"] as const;
  const max = Math.max(1, ...order.map((q) => totals[q]));
  return (
    <div className="tds-stat-tile tds-stat-tile-chart" data-testid="tds-quarter-bar">
      <div className="tds-stat-tile-chart-head">
        <span className="tds-stat-tile-label">Quarterly TDS deducted</span>
        {fy ? <span className="tds-stat-tile-chart-fy lb-mono">FY {fy}</span> : null}
      </div>
      <div className="tds-stat-tile-bars" role="img" aria-label="Quarterly TDS bar chart">
        {order.map((q) => {
          const v = totals[q] ?? 0;
          const pct = (v / max) * 100;
          return (
            <div key={q} className="tds-stat-tile-bar-col">
              <div
                className="tds-stat-tile-bar"
                data-quarter={q}
                style={{ height: `${pct}%` }}
                title={`${q} · ${fmtInr(v)}`}
              />
              <span className="tds-stat-tile-bar-label">{q}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TdsKpiTiles({
  totalDeductedFytdMinor,
  thresholdCrossingsCount,
  vendorsAboveThresholdCount,
  byQuarter,
  fy
}: TdsKpiTilesProps) {
  const showBar = byQuarter && byQuarter.length > 0;
  return (
    <div className="tds-kpi-grid" data-testid="tds-kpi-tiles">
      <StatTile
        label="Deducted (FYTD)"
        value={fmtInr(totalDeductedFytdMinor)}
        hint="Across all sections"
        tone="accent"
      />
      <StatTile
        label="Threshold crossings"
        value={thresholdCrossingsCount}
        hint={thresholdCrossingsCount > 0 ? "Action required" : "All within limits"}
        tone={thresholdCrossingsCount > 0 ? "warn" : "default"}
      />
      <StatTile
        label="Vendors above threshold"
        value={vendorsAboveThresholdCount}
        hint={vendorsAboveThresholdCount > 0 ? "Review vendor exposure" : "No vendors flagged"}
        tone={vendorsAboveThresholdCount > 0 ? "warn" : "default"}
      />
      {showBar ? (
        <QuarterBar byQuarter={byQuarter!} fy={fy} />
      ) : (
        <StatTile
          label="Quarterly TDS deducted"
          value={fmtInrShort(0)}
          hint="No quarterly data yet"
          tone="default"
        />
      )}
    </div>
  );
}
