export type InvoiceId = string & { readonly __brand: "InvoiceId" };

export function asInvoiceId(value: string): InvoiceId {
  return value as InvoiceId;
}

export const INVOICE_STATUS = {
  PENDING: "pending",
  PARSED: "parsed",
  NEEDS_REVIEW: "needs_review",
  AWAITING_APPROVAL: "awaiting_approval",
  APPROVED: "approved",
  EXPORTED: "exported",
  REJECTED: "rejected",
  FAILED: "failed"
} as const;

export type InvoiceStatus = (typeof INVOICE_STATUS)[keyof typeof INVOICE_STATUS];

export interface InvoiceParsedFields {
  vendor: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  gstin: string | null;
  pan: string | null;
  hsn: string | null;
  irn: string | null;
  totalAmount: number | null;
  taxAmount: number | null;
  netAmount: number | null;
  tdsSection: string | null;
  tdsAmount: number | null;
  tcsAmount: number | null;
  glCode: string | null;
  glName: string | null;
  costCenter: string | null;
}

export interface InvoiceRiskSignal {
  code: string;
  severity: "critical" | "warning" | "info";
  message: string;
  status: string;
}

export interface InvoiceTimelineEntry {
  step: string;
  occurredAt: string | null;
  actor: string | null;
  state: "done" | "current" | "pending";
}

export interface Invoice {
  id: InvoiceId;
  status: InvoiceStatus;
  vendor: string;
  invoiceNumber: string;
  invoiceDate: string | null;
  receivedAt: string | null;
  totalAmount: number | null;
  tdsAmount: number | null;
  netAmount: number | null;
  confidence: number | null;
  fileName: string | null;
  parsed: InvoiceParsedFields;
  riskSignals: InvoiceRiskSignal[];
  timeline: InvoiceTimelineEntry[];
  workflowStep: number | null;
  workflowTotalSteps: number | null;
}

export interface InvoiceListResponse {
  items: Invoice[];
  total: number;
  page: number;
  limit: number;
}

export interface InvoiceListFilters {
  status?: InvoiceStatus | "all";
  fromDate?: string;
  toDate?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}
