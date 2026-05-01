import { TDS_QUARTER, type TdsQuarter } from "@/api/reports";

const QUARTER_VALUES = Object.values(TDS_QUARTER) as TdsQuarter[];

interface FyQuarterFilterProps {
  fy: string;
  quarter: TdsQuarter | null;
  fyOptions: readonly string[];
  onFyChange: (fy: string) => void;
  onQuarterChange: (quarter: TdsQuarter | null) => void;
}

export function FyQuarterFilter({ fy, quarter, fyOptions, onFyChange, onQuarterChange }: FyQuarterFilterProps) {
  return (
    <div className="tds-filter-bar" data-testid="tds-filter-bar">
      <label className="tds-filter-field">
        <span className="tds-filter-label">Financial year</span>
        <select
          className="tds-filter-select"
          value={fy}
          onChange={(event) => onFyChange(event.target.value)}
          data-testid="tds-fy-select"
        >
          {fyOptions.map((option) => (
            <option key={option} value={option}>
              FY {option}
            </option>
          ))}
        </select>
      </label>
      <div className="ds-segmented-group tds-quarter-segmented" role="group" aria-label="Quarter filter">
        <button
          type="button"
          className="ds-pill"
          data-active={quarter === null ? "true" : undefined}
          aria-pressed={quarter === null}
          onClick={() => onQuarterChange(null)}
          data-testid="tds-quarter-all"
        >
          Full year
        </button>
        {QUARTER_VALUES.map((option) => (
          <button
            key={option}
            type="button"
            className="ds-pill"
            data-active={quarter === option ? "true" : undefined}
            aria-pressed={quarter === option}
            onClick={() => onQuarterChange(option)}
            data-testid={`tds-quarter-${option}`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
