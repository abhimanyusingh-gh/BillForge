const IST_TIME_ZONE = "Asia/Kolkata";

const ISO_PART_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: IST_TIME_ZONE,
  year: "numeric",
  month: "2-digit"
});

interface IstParts {
  year: number;
  month: number;
}

function toIstParts(date: Date): IstParts {
  const parts = ISO_PART_FORMATTER.formatToParts(date);
  const lookup: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") lookup[part.type] = part.value;
  }
  return { year: Number(lookup.year), month: Number(lookup.month) };
}

function formatFinancialYear(startYear: number): string {
  const endYear = (startYear + 1) % 100;
  const endSuffix = endYear.toString().padStart(2, "0");
  return `${startYear}-${endSuffix}`;
}

export function determineFY(date: Date): string {
  const { year, month } = toIstParts(date);
  const startYear = month >= 4 ? year : year - 1;
  return formatFinancialYear(startYear);
}

const FY_FORMAT = /^\d{4}-\d{2}$/;

export function isValidFY(value: string): boolean {
  return FY_FORMAT.test(value);
}

export function fyOptions(reference: Date, count: number): string[] {
  const currentStart = Number(determineFY(reference).slice(0, 4));
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(formatFinancialYear(currentStart - i));
  }
  return out;
}

const IST_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: IST_TIME_ZONE,
  year: "numeric",
  month: "short",
  day: "2-digit"
});

export function formatIstDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return IST_DATE_FORMATTER.format(date);
}

const FY_QUARTER = {
  Q1: "Q1",
  Q2: "Q2",
  Q3: "Q3",
  Q4: "Q4"
} as const;

type FyQuarter = (typeof FY_QUARTER)[keyof typeof FY_QUARTER];

const QUARTER_MONTH_RANGE: Record<FyQuarter, { startMonth: number; endMonth: number }> = {
  [FY_QUARTER.Q1]: { startMonth: 4, endMonth: 6 },
  [FY_QUARTER.Q2]: { startMonth: 7, endMonth: 9 },
  [FY_QUARTER.Q3]: { startMonth: 10, endMonth: 12 },
  [FY_QUARTER.Q4]: { startMonth: 1, endMonth: 3 }
};

interface IsoDateRange {
  from: string;
  to: string;
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function fyStartYear(fy: string): number {
  return Number(fy.slice(0, 4));
}

export function fyToDateRange(fy: string): IsoDateRange {
  const startYear = fyStartYear(fy);
  return {
    from: isoDate(startYear, 4, 1),
    to: isoDate(startYear + 1, 3, 31)
  };
}

export function fyQuarterToDateRange(fy: string, quarter: FyQuarter): IsoDateRange {
  const startYear = fyStartYear(fy);
  const { startMonth, endMonth } = QUARTER_MONTH_RANGE[quarter];
  const startCalendarYear = startMonth >= 4 ? startYear : startYear + 1;
  const endCalendarYear = endMonth >= 4 ? startYear : startYear + 1;
  return {
    from: isoDate(startCalendarYear, startMonth, 1),
    to: isoDate(endCalendarYear, endMonth, lastDayOfMonth(endCalendarYear, endMonth))
  };
}
