import type { Invoice } from "@/types";
import {
  PRE_EXPORT_REASON,
  buildPreExportFailureGroups,
  getPreExportFailures,
  totalPreExportFailures
} from "@/lib/invoice/preExportFailures";

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
    status: "APPROVED",
    processingIssues: [],
    createdAt: "2026-04-20T00:00:00Z",
    updatedAt: "2026-04-20T00:00:00Z",
    parsed: {
      invoiceNumber: `INV-${id}`,
      vendorName: `Vendor-${id}`,
      currency: "INR",
      customerGstin: "29ABCDE1234F1Z5"
    },
    ...rest
  } as Invoice;
}

describe("lib/invoice/preExportFailures", () => {
  it("returns no failures for a clean INR approved invoice", () => {
    const clean = makeInvoice({ id: "clean" });
    expect(getPreExportFailures(clean)).toEqual([]);
  });

  it("flags missing customer GSTIN on INR invoices", () => {
    const invoice = makeInvoice({
      id: "no-gstin",
      parsed: { invoiceNumber: "I-1", vendorName: "V", currency: "INR", customerGstin: "" }
    });
    const failures = getPreExportFailures(invoice);
    expect(failures).toHaveLength(1);
    expect(failures[0].reason).toBe(PRE_EXPORT_REASON.MissingGstin);
    expect(failures[0].invoiceId).toBe("no-gstin");
  });

  it("does not flag missing customer GSTIN for non-INR invoices", () => {
    const invoice = makeInvoice({
      id: "usd",
      parsed: { invoiceNumber: "I-1", vendorName: "V", currency: "USD", customerGstin: "" }
    });
    expect(getPreExportFailures(invoice)).toEqual([]);
  });

  it("flags critical risk signals", () => {
    const invoice = makeInvoice({
      id: "risk",
      complianceSummary: {
        tdsSection: null,
        glCode: null,
        riskSignalCount: 1,
        riskSignalMaxSeverity: "critical"
      }
    });
    const failures = getPreExportFailures(invoice);
    expect(failures[0].reason).toBe(PRE_EXPORT_REASON.CriticalRisk);
  });

  it("flags previously-failed exports ahead of compliance checks", () => {
    const invoice = makeInvoice({
      id: "retry",
      export: { error: "tally rejected" },
      parsed: { invoiceNumber: "I", vendorName: "V", currency: "INR", customerGstin: "" }
    });
    const failures = getPreExportFailures(invoice);
    expect(failures).toHaveLength(1);
    expect(failures[0].reason).toBe(PRE_EXPORT_REASON.ExportFailed);
    expect(failures[0].detail).toMatch(/tally rejected/);
  });

  it("groups failures by reason and orders groups by severity", () => {
    const invoices = [
      makeInvoice({
        id: "gstin-1",
        parsed: { invoiceNumber: "g1", vendorName: "V", currency: "INR", customerGstin: "" }
      }),
      makeInvoice({
        id: "gstin-2",
        parsed: { invoiceNumber: "g2", vendorName: "V", currency: "INR", customerGstin: "" }
      }),
      makeInvoice({
        id: "risk-1",
        complianceSummary: {
          tdsSection: null,
          glCode: null,
          riskSignalCount: 1,
          riskSignalMaxSeverity: "critical"
        }
      }),
      makeInvoice({ id: "clean" })
    ];
    const groups = buildPreExportFailureGroups(invoices);
    expect(groups.map((group) => group.reason)).toEqual([
      PRE_EXPORT_REASON.CriticalRisk,
      PRE_EXPORT_REASON.MissingGstin
    ]);
    expect(groups[1].failures).toHaveLength(2);
    expect(totalPreExportFailures(groups)).toBe(3);
  });

  it("returns zero total for an all-clear batch", () => {
    const groups = buildPreExportFailureGroups([
      makeInvoice({ id: "a" }),
      makeInvoice({ id: "b" })
    ]);
    expect(groups).toEqual([]);
    expect(totalPreExportFailures(groups)).toBe(0);
  });
});
