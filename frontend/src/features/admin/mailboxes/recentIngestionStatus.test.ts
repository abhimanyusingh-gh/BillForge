import {
  INVOICE_STATUS,
  INVOICE_STATUS_PRESENTATION,
  getInvoiceStatusPresentation
} from "@/features/admin/mailboxes/recentIngestionStatus";

describe("features/admin/mailboxes/recentIngestionStatus", () => {
  it("maps every INVOICE_STATUS value to a humanized label and a Badge tone", () => {
    for (const key of Object.keys(INVOICE_STATUS)) {
      const presentation = INVOICE_STATUS_PRESENTATION[key as keyof typeof INVOICE_STATUS];
      expect(presentation.label).not.toMatch(/^[A-Z_]+$/);
      expect(presentation.tone).toEqual(expect.any(String));
    }
  });

  it("PARSED resolves to a success-toned `Processed` badge", () => {
    expect(getInvoiceStatusPresentation(INVOICE_STATUS.PARSED)).toEqual({
      label: "Processed",
      tone: "success"
    });
  });

  it("PENDING_TRIAGE resolves to a warning-toned `Triage` badge", () => {
    expect(getInvoiceStatusPresentation(INVOICE_STATUS.PENDING_TRIAGE)).toEqual({
      label: "Triage",
      tone: "warning"
    });
  });

  it("falls back to neutral + `Unknown` when status is null/empty", () => {
    expect(getInvoiceStatusPresentation(null)).toEqual({ label: "Unknown", tone: "neutral" });
    expect(getInvoiceStatusPresentation("")).toEqual({ label: "Unknown", tone: "neutral" });
  });

  it("humanizes unknown SCREAMING_SNAKE_CASE statuses to title-case neutral badges", () => {
    expect(getInvoiceStatusPresentation("WEIRD_NEW_STATE")).toEqual({
      label: "Weird New State",
      tone: "neutral"
    });
  });
});
