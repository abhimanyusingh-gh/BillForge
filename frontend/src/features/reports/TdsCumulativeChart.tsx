import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { TDS_QUARTER, type TdsLiabilityQuarterBucket, type TdsQuarter } from "@/api/reports";
import { fmtInr, fmtInrShort } from "@/features/overview/OverviewDashboardUtils";

interface TdsCumulativeChartProps {
  byQuarter: TdsLiabilityQuarterBucket[];
  isFiltered: boolean;
  onClearFilters?: () => void;
}

const QUARTER_ORDER: readonly TdsQuarter[] = [TDS_QUARTER.Q1, TDS_QUARTER.Q2, TDS_QUARTER.Q3, TDS_QUARTER.Q4];

const SERIES_COLORS = [
  "var(--accent)",
  "var(--chart-emerald)",
  "var(--chart-violet)",
  "var(--chart-rose)",
  "var(--warn)"
];

interface ChartRow {
  quarter: TdsQuarter;
  [section: string]: number | TdsQuarter;
}

function buildSeries(byQuarter: TdsLiabilityQuarterBucket[]): { rows: ChartRow[]; sections: string[] } {
  const sections = Array.from(new Set(byQuarter.map((entry) => entry.section))).sort();
  const cumulativeBySection = new Map<string, number>();
  const rows: ChartRow[] = QUARTER_ORDER.map((quarter) => {
    const row: ChartRow = { quarter };
    for (const section of sections) {
      const found = byQuarter.find((entry) => entry.quarter === quarter && entry.section === section);
      const incremental = found?.cumulativeTdsMinor ?? 0;
      const prior = cumulativeBySection.get(section) ?? 0;
      const next = prior + incremental;
      cumulativeBySection.set(section, next);
      row[section] = next;
    }
    return row;
  });
  return { rows, sections };
}

export function TdsCumulativeChart({ byQuarter, isFiltered, onClearFilters }: TdsCumulativeChartProps) {
  const { rows, sections } = useMemo(() => buildSeries(byQuarter), [byQuarter]);

  if (byQuarter.length === 0) {
    return isFiltered ? (
      <div className="tds-chart-empty" data-testid="tds-chart-zero-result">
        <p>No quarterly TDS data for the current filter.</p>
        {onClearFilters ? (
          <button type="button" className="app-button app-button-secondary" onClick={onClearFilters}>
            Clear filters
          </button>
        ) : null}
      </div>
    ) : (
      <div className="tds-chart-empty" data-testid="tds-chart-empty">
        <p>No TDS deductions recorded for this financial year.</p>
      </div>
    );
  }

  return (
    <div className="tds-cumulative-chart" data-testid="tds-cumulative-chart">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={rows} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
          <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(value: number) => fmtInrShort(value)} width={56} />
          <Tooltip formatter={(value: number, name: string) => [fmtInr(value), `Section ${name}`]} />
          <Legend />
          {sections.map((section, index) => (
            <Line
              key={section}
              type="monotone"
              dataKey={section}
              stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
              strokeWidth={2}
              dot
              animationDuration={600}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
