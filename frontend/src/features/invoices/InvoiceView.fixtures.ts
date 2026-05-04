import type { Invoice, InvoiceListResponse, InvoiceStatus } from "@/types";

const FIXTURE_TENANT_ID = "tenant-test";
const FIXTURE_RECEIVED_AT = "2026-04-20T10:00:00.000Z";
const FIXTURE_CREATED_AT = "2026-04-20T10:00:00.000Z";
const FIXTURE_UPDATED_AT = "2026-04-20T10:05:00.000Z";

interface MakeInvoiceOverrides extends Partial<Omit<Invoice, "_id">> {
  id: string;
}

function makeInvoice(overrides: MakeInvoiceOverrides): Invoice {
  const { id, parsed, ...rest } = overrides;
  const baseParsed: Invoice["parsed"] = {
    invoiceNumber: `INV-${id}`,
    vendorName: `Vendor ${id}`,
    currency: "INR",
    invoiceDate: "2026-04-15",
    totalAmountMinor: 100000,
    customerGstin: "29ABCDE1234F1Z5"
  };
  return {
    _id: id,
    tenantId: FIXTURE_TENANT_ID,
    workloadTier: "standard",
    sourceType: "upload",
    sourceKey: `key-${id}`,
    sourceDocumentId: `doc-${id}`,
    attachmentName: `${id}.pdf`,
    mimeType: "application/pdf",
    receivedAt: FIXTURE_RECEIVED_AT,
    confidenceScore: 85,
    confidenceTone: "green",
    autoSelectForApproval: false,
    status: "PARSED",
    processingIssues: [],
    createdAt: FIXTURE_CREATED_AT,
    updatedAt: FIXTURE_UPDATED_AT,
    parsed: { ...baseParsed, ...(parsed ?? {}) },
    ...rest
  } as Invoice;
}

export const NEEDS_REVIEW_INVOICES: ReadonlyArray<Invoice> = [
  makeInvoice({ id: "inv-101", status: "NEEDS_REVIEW", confidenceTone: "yellow", confidenceScore: 60 }),
  makeInvoice({ id: "inv-102", status: "NEEDS_REVIEW", confidenceTone: "red", confidenceScore: 40 })
];

export const AWAITING_APPROVAL_INVOICES: ReadonlyArray<Invoice> = [
  makeInvoice({ id: "inv-201", status: "AWAITING_APPROVAL" }),
  makeInvoice({ id: "inv-202", status: "AWAITING_APPROVAL" })
];

export const EXPORTED_INVOICES: ReadonlyArray<Invoice> = [
  makeInvoice({
    id: "inv-401",
    status: "EXPORTED",
    export: {
      system: "tally",
      batchId: "batch-1",
      exportedAt: "2026-04-19T11:00:00.000Z",
      externalReference: "TXN-1"
    }
  })
];

export const MIXED_STATUS_INVOICES: ReadonlyArray<Invoice> = [
  makeInvoice({ id: "inv-001", status: "PARSED" }),
  NEEDS_REVIEW_INVOICES[0],
  AWAITING_APPROVAL_INVOICES[0],
  makeInvoice({
    id: "inv-301",
    status: "APPROVED",
    approval: { approvedBy: "Alice", approvedAt: "2026-04-19T09:00:00.000Z", email: "alice@example.com" }
  }),
  EXPORTED_INVOICES[0]
];

export function makeListResponse(items: ReadonlyArray<Invoice>): InvoiceListResponse {
  const counts = countByStatus(items);
  return {
    items: [...items],
    page: 1,
    limit: 20,
    total: items.length,
    totalAll: items.length,
    approvedAll: counts.APPROVED,
    pendingAll: counts.PARSED + counts.NEEDS_REVIEW + counts.AWAITING_APPROVAL,
    failedAll: counts.FAILED_OCR + counts.FAILED_PARSE,
    needsReviewAll: counts.NEEDS_REVIEW,
    parsedAll: counts.PARSED,
    awaitingApprovalAll: counts.AWAITING_APPROVAL,
    failedOcrAll: counts.FAILED_OCR,
    failedParseAll: counts.FAILED_PARSE,
    exportedAll: counts.EXPORTED
  };
}

function countByStatus(items: ReadonlyArray<Invoice>): Record<InvoiceStatus, number> {
  const counts: Record<InvoiceStatus, number> = {
    PENDING: 0,
    PARSED: 0,
    NEEDS_REVIEW: 0,
    AWAITING_APPROVAL: 0,
    FAILED_OCR: 0,
    FAILED_PARSE: 0,
    APPROVED: 0,
    EXPORTED: 0
  };
  for (const invoice of items) counts[invoice.status] += 1;
  return counts;
}

export const EMPTY_LIST_RESPONSE: InvoiceListResponse = {
  items: [],
  page: 1,
  limit: 20,
  total: 0,
  totalAll: 0,
  approvedAll: 0,
  pendingAll: 0,
  failedAll: 0,
  needsReviewAll: 0,
  parsedAll: 0,
  awaitingApprovalAll: 0,
  failedOcrAll: 0,
  failedParseAll: 0,
  exportedAll: 0
};

export const FIXTURE_USER_CAPABILITIES = {
  canApproveInvoices: true,
  canEditInvoiceFields: true,
  canDeleteInvoices: true,
  canRetryInvoices: true,
  canUploadFiles: true,
  canStartIngestion: true,
  canExportToTally: true
} as const;
