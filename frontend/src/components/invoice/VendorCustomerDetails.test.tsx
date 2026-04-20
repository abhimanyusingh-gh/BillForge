/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { VendorCustomerDetails } from "./VendorCustomerDetails";
import type { Invoice } from "@/types";

function makeInvoice(overrides: Partial<Invoice["parsed"]> = {}): Invoice {
  return {
    _id: "inv-1",
    tenantId: "t-1",
    workloadTier: "standard",
    sourceType: "email",
    sourceKey: "k1",
    sourceDocumentId: "d1",
    attachmentName: "invoice.pdf",
    mimeType: "application/pdf",
    receivedAt: new Date().toISOString(),
    confidenceScore: 85,
    confidenceTone: "green",
    autoSelectForApproval: false,
    status: "PARSED",
    processingIssues: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    parsed: {
      vendorName: "Acme Corp",
      vendorAddress: "123 Main St\nMumbai, MH 400001",
      vendorGstin: "27AADCB2230M1Z3",
      vendorPan: "AADCB2230M",
      customerName: "BillForge Inc",
      customerAddress: "456 Oak Ave\nDelhi, DL 110001",
      customerGstin: "07BBBBB1234B1Z5",
      ...overrides,
    },
  } as Invoice;
}

const defaultProps = {
  vendorDetailsExpanded: true,
  onToggleVendorDetails: jest.fn(),
  customerDetailsExpanded: true,
  onToggleCustomerDetails: jest.fn(),
};

describe("VendorCustomerDetails", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders vendor details when fields are present", () => {
    render(<VendorCustomerDetails invoice={makeInvoice()} {...defaultProps} />);
    expect(screen.getByText("Vendor Details")).toBeInTheDocument();
    expect(screen.getByText("AADCB2230M")).toBeInTheDocument();
    expect(screen.getByText("27AADCB2230M1Z3")).toBeInTheDocument();
    expect(screen.getByText((_content, element) =>
      element?.tagName === "SPAN" && element?.textContent === "123 Main St\nMumbai, MH 400001"
    )).toBeInTheDocument();
  });

  it("renders customer details when fields are present", () => {
    render(<VendorCustomerDetails invoice={makeInvoice()} {...defaultProps} />);
    expect(screen.getByText("Customer Details")).toBeInTheDocument();
    expect(screen.getByText("BillForge Inc")).toBeInTheDocument();
    expect(screen.getByText("07BBBBB1234B1Z5")).toBeInTheDocument();
    expect(screen.getByText((_content, element) =>
      element?.tagName === "SPAN" && element?.textContent === "456 Oak Ave\nDelhi, DL 110001"
    )).toBeInTheDocument();
  });

  it("shows Not extracted for missing vendor fields", () => {
    const invoice = makeInvoice({
      vendorName: undefined,
      vendorAddress: undefined,
      vendorGstin: undefined,
      vendorPan: undefined,
    });
    render(<VendorCustomerDetails invoice={invoice} {...defaultProps} />);
    const notExtracted = screen.getAllByText("Not extracted");
    expect(notExtracted.length).toBeGreaterThanOrEqual(3);
  });

  it("shows Not extracted for missing customer fields", () => {
    const invoice = makeInvoice({
      customerName: undefined,
      customerAddress: undefined,
      customerGstin: undefined,
    });
    render(<VendorCustomerDetails invoice={invoice} {...defaultProps} />);
    const notExtracted = screen.getAllByText("Not extracted");
    expect(notExtracted.length).toBeGreaterThanOrEqual(3);
  });

  it("shows Valid badge for valid GSTIN format", () => {
    render(<VendorCustomerDetails invoice={makeInvoice()} {...defaultProps} />);
    const validBadges = screen.getAllByText("Valid");
    expect(validBadges.length).toBeGreaterThanOrEqual(1);
  });

  it("shows Invalid format badge for invalid GSTIN", () => {
    const invoice = makeInvoice({ vendorGstin: "BADGSTIN" });
    render(<VendorCustomerDetails invoice={invoice} {...defaultProps} />);
    const invalidBadges = screen.getAllByText("Invalid format");
    expect(invalidBadges.length).toBeGreaterThanOrEqual(1);
  });

  it("shows GSTIN cross-checked badge for PAN matching GSTIN", () => {
    render(<VendorCustomerDetails invoice={makeInvoice()} {...defaultProps} />);
    expect(screen.getByText("GSTIN cross-checked")).toBeInTheDocument();
  });

  it("shows Format valid badge when PAN does not match GSTIN", () => {
    const invoice = makeInvoice({ vendorPan: "ZZZZZ9999Z" });
    render(<VendorCustomerDetails invoice={invoice} {...defaultProps} />);
    expect(screen.getByText("Format valid")).toBeInTheDocument();
  });

  it("shows Invalid format for invalid PAN", () => {
    const invoice = makeInvoice({ vendorPan: "BADPAN" });
    render(<VendorCustomerDetails invoice={invoice} {...defaultProps} />);
    const invalidBadges = screen.getAllByText("Invalid format");
    expect(invalidBadges.length).toBeGreaterThanOrEqual(1);
  });

  it("shows Matches tenant GSTIN badge when customer GSTIN matches tenant", () => {
    const invoice = makeInvoice({ customerGstin: "27AADCB2230M1Z3" });
    render(
      <VendorCustomerDetails
        invoice={invoice}
        {...defaultProps}
        tenantGstin="27AADCB2230M1Z3"
      />
    );
    expect(screen.getByText("Matches tenant GSTIN")).toBeInTheDocument();
  });

  it("does not show tenant match badge when GSTINs differ", () => {
    render(
      <VendorCustomerDetails
        invoice={makeInvoice()}
        {...defaultProps}
        tenantGstin="99ZZZZZ9999Z1Z9"
      />
    );
    expect(screen.queryByText("Matches tenant GSTIN")).not.toBeInTheDocument();
  });

  it("hides vendor body when collapsed", () => {
    render(
      <VendorCustomerDetails
        invoice={makeInvoice()}
        {...defaultProps}
        vendorDetailsExpanded={false}
      />
    );
    expect(screen.getByText("Vendor Details")).toBeInTheDocument();
    expect(screen.queryByText("AADCB2230M")).not.toBeInTheDocument();
  });

  it("hides customer body when collapsed", () => {
    render(
      <VendorCustomerDetails
        invoice={makeInvoice()}
        {...defaultProps}
        customerDetailsExpanded={false}
      />
    );
    expect(screen.getByText("Customer Details")).toBeInTheDocument();
    expect(screen.queryByText("BillForge Inc")).not.toBeInTheDocument();
  });

  it("calls onToggleVendorDetails when vendor header is clicked", () => {
    const onToggle = jest.fn();
    render(
      <VendorCustomerDetails
        invoice={makeInvoice()}
        {...defaultProps}
        onToggleVendorDetails={onToggle}
      />
    );
    fireEvent.click(screen.getByText("Vendor Details"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("calls onToggleCustomerDetails when customer header is clicked", () => {
    const onToggle = jest.fn();
    render(
      <VendorCustomerDetails
        invoice={makeInvoice()}
        {...defaultProps}
        onToggleCustomerDetails={onToggle}
      />
    );
    fireEvent.click(screen.getByText("Customer Details"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("shows section headers even when no parsed data exists", () => {
    const invoice = makeInvoice();
    invoice.parsed = undefined;
    render(<VendorCustomerDetails invoice={invoice} {...defaultProps} />);
    expect(screen.getByText("Vendor Details")).toBeInTheDocument();
    expect(screen.getByText("Customer Details")).toBeInTheDocument();
  });

  it("shows vendor name reference note when vendor name exists", () => {
    render(<VendorCustomerDetails invoice={makeInvoice()} {...defaultProps} />);
    expect(screen.getByText("Shown in key fields above")).toBeInTheDocument();
  });
});
