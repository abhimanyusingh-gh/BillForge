function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateOffset(mutate: (d: Date) => void): string {
  const d = new Date();
  mutate(d);
  return toLocalDateStr(d);
}

export const todayStr = (): string => toLocalDateStr(new Date());
export const firstOfMonthStr = (): string => dateOffset((d) => d.setDate(1));
const firstOfQuarterStr = (): string => dateOffset((d) => {
  d.setMonth(Math.floor(d.getMonth() / 3) * 3);
  d.setDate(1);
});
const nDaysAgoStr = (n: number): string => dateOffset((d) => d.setDate(d.getDate() - n + 1));

function lastMonthRange(): { from: string; to: string } {
  const first = new Date();
  first.setDate(1);
  const lastDay = new Date(first.getTime() - 1);
  return { from: toLocalDateStr(new Date(lastDay.getFullYear(), lastDay.getMonth(), 1)), to: toLocalDateStr(lastDay) };
}

export type PresetKey = "this-month" | "last-month" | "7d" | "30d" | "quarter" | null;


export function fmtInr(minor: number): string {
  return (minor / 100).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

export function fmtInrShort(minor: number): string {
  const major = minor / 100;
  if (major >= 10_000_000) return `\u20B9${(major / 10_000_000).toFixed(1)}Cr`;
  if (major >= 100_000) return `\u20B9${(major / 100_000).toFixed(1)}L`;
  if (major >= 1_000) return `\u20B9${(major / 1_000).toFixed(1)}K`;
  return `\u20B9${major.toFixed(0)}`;
}

export const PRESETS: Array<{ key: PresetKey; label: string; range: () => { from: string; to: string } }> = [
  { key: "this-month", label: "This Month", range: () => ({ from: firstOfMonthStr(), to: todayStr() }) },
  { key: "last-month", label: "Last Month", range: lastMonthRange },
  { key: "7d", label: "Last 7 Days", range: () => ({ from: nDaysAgoStr(7), to: todayStr() }) },
  { key: "30d", label: "Last 30 Days", range: () => ({ from: nDaysAgoStr(30), to: todayStr() }) },
  { key: "quarter", label: "This Quarter", range: () => ({ from: firstOfQuarterStr(), to: todayStr() }) }
];
