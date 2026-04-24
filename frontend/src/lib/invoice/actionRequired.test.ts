import type { Invoice } from "@/types";
import {
  ACTION_REASON,
  buildActionQueue,
  totalActionCount
} from "@/lib/invoice/actionRequired";

function makeInvoice(overrides: Partial<Invoice> & { id: string }): Invoice {
  const { id, ...rest } = overrides;
  return {
    _id: id,
    tenantId: "t1",
    workloadTier: "standard",
    sourceType: "upload",
    sourceKey: `k-${id}`,
    sourceDocumentId: `d-${id}`,
    attachmentName: `${id}.pdf`,
    mimeType: "application/pdf",
    receivedAt: "2026-04-20T00:00:00Z",
    confidenceScore: 80,
    confidenceTone: "green",
    autoSelectForApproval: false,
    status: "PARSED",
    processingIssues: [],
    createdAt: "2026-04-20T00:00:00Z",
    updatedAt: "2026-04-20T00:00:00Z",
    parsed: { invoiceNumber: "INV-1", vendorName: "Acme", currency: "INR", customerGstin: "29ABCDE1234F1Z5" },
    ...rest
  } as Invoice;
}

describe("lib/invoice/actionRequired", () => {
  it("returns an empty list when no invoices require action", () => {
    const queue = buildActionQueue([
      makeInvoice({ id: "1", status: "APPROVED" }),
      makeInvoice({ id: "2", status: "EXPORTED" })
    ]);
    expect(queue).toEqual([]);
    expect(totalActionCount(queue)).toBe(0);
  });

  it("groups invoices by reason and orders groups by severity", () => {
    const invoices: Invoice[] = [
      makeInvoice({ id: "ocr", status: "FAILED_OCR" }),
      makeInvoice({ id: "approval", status: "AWAITING_APPROVAL" }),
      makeInvoice({
        id: "gstin",
        status: "PARSED",
        parsed: { invoiceNumber: "INV-GST", vendorName: "NoGst", currency: "INR", customerGstin: "" }
      }),
      makeInvoice({
        id: "risk",
        status: "PARSED",
        complianceSummary: {
          tdsSection: null,
          glCode: null,
          riskSignalCount: 1,
          riskSignalMaxSeverity: "critical"
        }
      })
    ];
    const queue = buildActionQueue(invoices);
    const reasons = queue.map((group) => group.reason);
    expect(reasons).toEqual([
      ACTION_REASON.FailedOcr,
      ACTION_REASON.CriticalRisk,
      ACTION_REASON.MissingGstin,
      ACTION_REASON.AwaitingApproval
    ]);
    expect(totalActionCount(queue)).toBe(4);
  });

  it("prefers FailedOcr over MissingGstin when both apply", () => {
    const queue = buildActionQueue([
      makeInvoice({
        id: "both",
        status: "FAILED_OCR",
        parsed: { invoiceNumber: "x", vendorName: "y", currency: "INR", customerGstin: "" }
      })
    ]);
    expect(queue).toHaveLength(1);
    expect(queue[0].reason).toBe(ACTION_REASON.FailedOcr);
  });

  it("flags export errors as ExportFailed", () => {
    const queue = buildActionQueue([
      makeInvoice({ id: "e", status: "APPROVED", export: { error: "tally rejected" } })
    ]);
    expect(queue[0].reason).toBe(ACTION_REASON.ExportFailed);
  });

  it("ignores missing customer GSTIN when currency is not INR", () => {
    const queue = buildActionQueue([
      makeInvoice({
        id: "usd",
        status: "PARSED",
        parsed: { invoiceNumber: "U-1", vendorName: "US Inc", currency: "USD", customerGstin: "" }
      })
    ]);
    expect(queue).toEqual([]);
  });

  it("sorts items within a group newest-first", () => {
    const queue = buildActionQueue([
      makeInvoice({ id: "old", status: "AWAITING_APPROVAL", receivedAt: "2026-04-01T00:00:00Z" }),
      makeInvoice({ id: "new", status: "AWAITING_APPROVAL", receivedAt: "2026-04-22T00:00:00Z" })
    ]);
    expect(queue[0].items.map((item) => item.invoiceId)).toEqual(["new", "old"]);
  });
});
