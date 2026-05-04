import { useMemo } from "react";
import { TDS_QUARTER, type TdsQuarter } from "@/api/reports";
import { DateRange, type DateRangePreset, type DateRangeValue } from "@/components/ds";
import { fyQuarterToDateRange, fyToDateRange } from "@/features/reports/fiscalYear";

interface FyQuarterFilterProps {
  fy: string;
  quarter: TdsQuarter | null;
  fyOptions: readonly string[];
  onFyChange: (fy: string) => void;
  onQuarterChange: (quarter: TdsQuarter | null) => void;
}

const QUARTER_VALUES = Object.values(TDS_QUARTER) as TdsQuarter[];

const QUARTER_SUB: Record<TdsQuarter, string> = {
  [TDS_QUARTER.Q1]: "Apr–Jun",
  [TDS_QUARTER.Q2]: "Jul–Sep",
  [TDS_QUARTER.Q3]: "Oct–Dec",
  [TDS_QUARTER.Q4]: "Jan–Mar"
};

function fyYearPresetId(fy: string): string {
  return `fy-${fy}`;
}

function fyQuarterPresetId(fy: string, quarter: TdsQuarter): string {
  return `fy-${fy}-${quarter}`;
}

function buildYearPresets(fyOptions: readonly string[]): DateRangePreset[] {
  return fyOptions.map((fy) => {
    const range = fyToDateRange(fy);
    return {
      id: fyYearPresetId(fy),
      label: `FY ${fy}`,
      from: range.from,
      to: range.to
    };
  });
}

function buildQuarterPresets(fy: string): DateRangePreset[] {
  return QUARTER_VALUES.map((quarter) => {
    const range = fyQuarterToDateRange(fy, quarter);
    return {
      id: fyQuarterPresetId(fy, quarter),
      label: `FY ${fy} · ${quarter}`,
      sub: QUARTER_SUB[quarter],
      from: range.from,
      to: range.to
    };
  });
}

function valueFor(fy: string, quarter: TdsQuarter | null): DateRangeValue {
  if (quarter === null) {
    const range = fyToDateRange(fy);
    return { from: range.from, to: range.to, presetId: fyYearPresetId(fy), label: `FY ${fy}` };
  }
  const range = fyQuarterToDateRange(fy, quarter);
  return {
    from: range.from,
    to: range.to,
    presetId: fyQuarterPresetId(fy, quarter),
    label: `FY ${fy} · ${quarter}`
  };
}

export function FyQuarterFilter({
  fy,
  quarter,
  fyOptions,
  onFyChange,
  onQuarterChange
}: FyQuarterFilterProps) {
  const yearPresets = useMemo(() => buildYearPresets(fyOptions), [fyOptions]);
  const quarterPresets = useMemo(() => buildQuarterPresets(fy), [fy]);
  const value = useMemo(() => valueFor(fy, quarter), [fy, quarter]);

  function handleChange(next: DateRangeValue) {
    if (!next.presetId) return;
    for (const fyOption of fyOptions) {
      if (next.presetId === fyYearPresetId(fyOption)) {
        if (fyOption !== fy) onFyChange(fyOption);
        if (quarter !== null) onQuarterChange(null);
        return;
      }
      for (const q of QUARTER_VALUES) {
        if (next.presetId === fyQuarterPresetId(fyOption, q)) {
          if (fyOption !== fy) onFyChange(fyOption);
          if (quarter !== q) onQuarterChange(q);
          return;
        }
      }
    }
  }

  return (
    <div className="page-tools" data-testid="tds-filter-bar">
      <DateRange
        ariaLabel="Financial year and quarter filter"
        value={value}
        onChange={handleChange}
        yearPresets={yearPresets}
        quarterPresets={quarterPresets}
        showCustom={false}
        showCompare={false}
      />
    </div>
  );
}
