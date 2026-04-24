/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { Invoice } from "@/types";
import { ActionHintBadge } from "@/components/invoice/ActionHintBadge";

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

describe("ActionHintBadge", () => {
  it("renders the Ready hint for PARSED invoices", () => {
    render(<ActionHintBadge invoice={{ ...baseInvoice, status: "PARSED" }} />);
    const badge = screen.getByText("Ready to approve");
    expect(badge).toBeInTheDocument();
    expect(badge.closest(".action-hint-badge")).toHaveClass("action-hint-ready");
  });

  it("renders the Blocked hint for FAILED_OCR invoices", () => {
    render(<ActionHintBadge invoice={{ ...baseInvoice, status: "FAILED_OCR" }} />);
    expect(screen.getByText("OCR failed — reingest").closest(".action-hint-badge")).toHaveClass(
      "action-hint-blocked"
    );
  });

  it("renders the Pending hint for PENDING invoices", () => {
    render(<ActionHintBadge invoice={{ ...baseInvoice, status: "PENDING" }} />);
    expect(screen.getByText("Awaiting OCR").closest(".action-hint-badge")).toHaveClass(
      "action-hint-pending"
    );
  });

  it("renders the MissingData hint when INR invoice lacks customer GSTIN", () => {
    render(
      <ActionHintBadge
        invoice={{
          ...baseInvoice,
          status: "NEEDS_REVIEW",
          parsed: { currency: "INR", customerName: "Acme Pvt Ltd" }
        }}
      />
    );
    expect(screen.getByText("Missing customer GSTIN").closest(".action-hint-badge")).toHaveClass(
      "action-hint-missingdata"
    );
  });

  it("renders the Done hint for EXPORTED invoices", () => {
    render(<ActionHintBadge invoice={{ ...baseInvoice, status: "EXPORTED" }} />);
    expect(screen.getByText("Exported").closest(".action-hint-badge")).toHaveClass(
      "action-hint-done"
    );
  });

  it("renders the Ready-to-export hint for APPROVED invoices", () => {
    render(<ActionHintBadge invoice={{ ...baseInvoice, status: "APPROVED" }} />);
    expect(screen.getByText("Ready to export").closest(".action-hint-badge")).toHaveClass(
      "action-hint-ready"
    );
  });
});
