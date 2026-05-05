import { INVOICE_STATUS, type InvoiceStatus } from "@/domain/invoice/invoice";

const INR_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

export function formatInr(minorUnits: number | null | undefined): string {
  if (minorUnits === null || minorUnits === undefined) return "—";
  return INR_FORMATTER.format(Math.round(minorUnits / 100));
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  [INVOICE_STATUS.PENDING]: "Pending",
  [INVOICE_STATUS.PARSED]: "Parsed",
  [INVOICE_STATUS.NEEDS_REVIEW]: "Needs review",
  [INVOICE_STATUS.AWAITING_APPROVAL]: "Awaiting approval",
  [INVOICE_STATUS.APPROVED]: "Approved",
  [INVOICE_STATUS.EXPORTED]: "Exported",
  [INVOICE_STATUS.REJECTED]: "Rejected",
  [INVOICE_STATUS.FAILED]: "Failed"
};

export function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
