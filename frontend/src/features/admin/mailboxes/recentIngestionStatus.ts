import type { BadgeTone } from "@/components/ds";

export const INVOICE_STATUS = {
  PENDING: "PENDING",
  PARSED: "PARSED",
  NEEDS_REVIEW: "NEEDS_REVIEW",
  AWAITING_APPROVAL: "AWAITING_APPROVAL",
  FAILED_OCR: "FAILED_OCR",
  FAILED_PARSE: "FAILED_PARSE",
  APPROVED: "APPROVED",
  EXPORTED: "EXPORTED",
  PENDING_TRIAGE: "PENDING_TRIAGE",
  REJECTED: "REJECTED"
} as const;

export type InvoiceStatusKey = keyof typeof INVOICE_STATUS;

export interface InvoiceStatusPresentation {
  label: string;
  tone: BadgeTone;
}

export const INVOICE_STATUS_PRESENTATION: Record<InvoiceStatusKey, InvoiceStatusPresentation> = {
  PENDING: { label: "Processing", tone: "neutral" },
  PARSED: { label: "Processed", tone: "success" },
  NEEDS_REVIEW: { label: "Needs review", tone: "warning" },
  AWAITING_APPROVAL: { label: "Awaiting approval", tone: "info" },
  FAILED_OCR: { label: "Failed", tone: "danger" },
  FAILED_PARSE: { label: "Failed", tone: "danger" },
  APPROVED: { label: "Approved", tone: "success" },
  EXPORTED: { label: "Exported", tone: "info" },
  PENDING_TRIAGE: { label: "Triage", tone: "warning" },
  REJECTED: { label: "Rejected", tone: "danger" }
};

const FALLBACK_PRESENTATION: InvoiceStatusPresentation = {
  label: "Unknown",
  tone: "neutral"
};

export function getInvoiceStatusPresentation(status: string | null | undefined): InvoiceStatusPresentation {
  if (!status) return FALLBACK_PRESENTATION;
  if (status in INVOICE_STATUS_PRESENTATION) {
    return INVOICE_STATUS_PRESENTATION[status as InvoiceStatusKey];
  }
  const humanLabel = status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { label: humanLabel, tone: "neutral" };
}
