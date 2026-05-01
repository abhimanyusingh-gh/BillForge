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
