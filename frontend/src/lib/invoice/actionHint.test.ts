import type { Invoice } from "@/types";
import { ACTION_HINT_KIND, getActionHint } from "@/lib/invoice/actionHint";

const baseInvoice: Invoice = {
  _id: "1",
  tenantId: "tenant-a",
  workloadTier: "standard",
  sourceType: "email",
  sourceKey: "inbox",
  sourceDocumentId: "10",
  attachmentName: "inv.pdf",
  mimeType: "application/pdf",
  receivedAt: "2026-02-19T00:00:00.000Z",
  confidenceScore: 0,
  confidenceTone: "red",
  autoSelectForApproval: false,
  status: "PARSED",
  processingIssues: [],
  createdAt: "2026-02-19T00:00:00.000Z",
  updatedAt: "2026-02-19T00:00:00.000Z"
};

describe("getActionHint", () => {
  it("returns Pending hint for PENDING", () => {
    expect(getActionHint({ ...baseInvoice, status: "PENDING" })).toEqual({
      kind: ACTION_HINT_KIND.Pending,
      text: "Awaiting OCR"
    });
  });

  it("returns Blocked hint for FAILED_OCR", () => {
    expect(getActionHint({ ...baseInvoice, status: "FAILED_OCR" })).toEqual({
      kind: ACTION_HINT_KIND.Blocked,
      text: "OCR failed — reingest"
    });
  });

  it("returns Blocked hint for FAILED_PARSE", () => {
    expect(getActionHint({ ...baseInvoice, status: "FAILED_PARSE" })).toEqual({
      kind: ACTION_HINT_KIND.Blocked,
      text: "Parse failed — reingest"
    });
  });

  it("returns Ready-to-approve for PARSED with no blockers", () => {
    expect(getActionHint({ ...baseInvoice, status: "PARSED" })).toEqual({
      kind: ACTION_HINT_KIND.Ready,
      text: "Ready to approve"
    });
  });

  it("returns MissingData when INR invoice has customer name but no GSTIN", () => {
    const invoice: Invoice = {
      ...baseInvoice,
      status: "NEEDS_REVIEW",
      parsed: { currency: "INR", customerName: "Acme Pvt Ltd", customerGstin: "" }
    };
    expect(getActionHint(invoice)).toEqual({
      kind: ACTION_HINT_KIND.MissingData,
      text: "Missing customer GSTIN"
    });
  });

  it("does not flag MissingData for non-INR currency", () => {
    const invoice: Invoice = {
      ...baseInvoice,
      status: "PARSED",
      parsed: { currency: "USD", customerName: "Acme Inc." }
    };
    expect(getActionHint(invoice)?.kind).toBe(ACTION_HINT_KIND.Ready);
  });

  it("returns Blocked when a critical risk signal is open (via summary)", () => {
    const invoice: Invoice = {
      ...baseInvoice,
      status: "PARSED",
      complianceSummary: {
        tdsSection: null,
        glCode: null,
        riskSignalCount: 1,
        riskSignalMaxSeverity: "critical"
      }
    };
    expect(getActionHint(invoice)).toEqual({
      kind: ACTION_HINT_KIND.Blocked,
      text: "Critical risk signal open"
    });
  });

  it("returns Pending with step label for AWAITING_APPROVAL", () => {
    const invoice: Invoice = {
      ...baseInvoice,
      status: "AWAITING_APPROVAL",
      workflowState: { currentStep: 2, status: "in_progress" }
    };
    expect(getActionHint(invoice)).toEqual({
      kind: ACTION_HINT_KIND.Pending,
      text: "In approval (step 2)"
    });
  });

  it("returns Pending without step label when no currentStep", () => {
    const invoice: Invoice = { ...baseInvoice, status: "AWAITING_APPROVAL" };
    expect(getActionHint(invoice)).toEqual({
      kind: ACTION_HINT_KIND.Pending,
      text: "In approval"
    });
  });

  it("returns Ready-to-export for APPROVED", () => {
    expect(getActionHint({ ...baseInvoice, status: "APPROVED" })).toEqual({
      kind: ACTION_HINT_KIND.Ready,
      text: "Ready to export"
    });
  });

  it("returns Done for EXPORTED", () => {
    expect(getActionHint({ ...baseInvoice, status: "EXPORTED" })).toEqual({
      kind: ACTION_HINT_KIND.Done,
      text: "Exported"
    });
  });
});
