import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvoiceFieldsPanel } from "@/features/invoices/detail/InvoiceFieldsPanel";
import { useSessionStore } from "@/state/sessionStore";
import { asClientOrgId, asTenantId, asUserId } from "@/types/ids";
import { asInvoiceId, INVOICE_STATUS, type Invoice } from "@/domain/invoice/invoice";

const updateInvoiceMock = vi.fn();

vi.mock("@/api/invoiceService", () => ({
  invoiceService: {
    listInvoices: vi.fn(),
    getInvoice: vi.fn(),
    updateInvoice: (...args: unknown[]) => updateInvoiceMock(...args),
    approveInvoices: vi.fn(),
    retryInvoices: vi.fn(),
    deleteInvoices: vi.fn(),
    workflowApprove: vi.fn(),
    workflowReject: vi.fn(),
    retriggerCompliance: vi.fn(),
    previewUrl: vi.fn()
  }
}));

function makeInvoice(): Invoice {
  return {
    id: asInvoiceId("a1"),
    status: INVOICE_STATUS.NEEDS_REVIEW,
    vendor: "Acme Corp",
    invoiceNumber: "INV-1001",
    invoiceDate: "2026-04-12",
    receivedAt: null,
    totalAmount: 5_00_000,
    tdsAmount: 25_000,
    netAmount: 4_75_000,
    confidence: 0.91,
    fileName: "INV-1001.pdf",
    parsed: {
      vendor: "Acme Corp",
      invoiceNumber: "INV-1001",
      invoiceDate: "2026-04-12",
      gstin: "27AABCU9603R1ZX",
      pan: "AABCU9603R",
      hsn: "998314",
      irn: "",
      totalAmount: 5_00_000,
      taxAmount: null,
      netAmount: 4_75_000,
      tdsSection: "194J",
      tdsAmount: 25_000,
      tcsAmount: null,
      glCode: "5301",
      glName: "Legal & Professional Fees",
      costCenter: null
    },
    riskSignals: [],
    timeline: [],
    workflowStep: null,
    workflowTotalSteps: null
  };
}

function seedSession(): void {
  act(() => {
    useSessionStore.setState({
      user: { id: asUserId("u1"), email: "u@x.in", role: "TENANT_ADMIN" },
      tenant: { id: asTenantId("65f0000000000000000000a1"), name: "Acme" },
      flags: { mustChangePassword: false, requiresTenantSetup: false },
      accessToken: "tok",
      currentClientOrgId: asClientOrgId("69f99e5bddd231bb20bd66c4")
    });
  });
}

beforeEach(() => {
  updateInvoiceMock.mockReset();
  act(() => {
    useSessionStore.getState().clearSession();
  });
});

afterEach(() => {
  act(() => {
    useSessionStore.getState().clearSession();
  });
});

describe("InvoiceFieldsPanel", () => {
  it("hydrates the form with the invoice's parsed fields", () => {
    seedSession();
    render(<InvoiceFieldsPanel invoice={makeInvoice()} onSaved={() => {}} />);
    expect(screen.getByLabelText("Vendor")).toHaveValue("Acme Corp");
    expect(screen.getByLabelText("Invoice number")).toHaveValue("INV-1001");
    expect(screen.getByLabelText("Vendor GSTIN")).toHaveValue("27AABCU9603R1ZX");
  });

  it("blocks save when GSTIN is invalid", async () => {
    seedSession();
    render(<InvoiceFieldsPanel invoice={makeInvoice()} onSaved={() => {}} />);

    fireEvent.change(screen.getByLabelText("Vendor GSTIN"), { target: { value: "BADGSTIN" } });
    expect(await screen.findByText("Invalid GSTIN")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
    expect(updateInvoiceMock).not.toHaveBeenCalled();
  });

  it("invokes update + onSaved when the form is valid", async () => {
    updateInvoiceMock.mockResolvedValueOnce({});
    seedSession();
    const onSaved = vi.fn();
    render(<InvoiceFieldsPanel invoice={makeInvoice()} onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText("HSN or SAC"), { target: { value: "998315" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(updateInvoiceMock).toHaveBeenCalledTimes(1));
    expect(onSaved).toHaveBeenCalledTimes(1);
    const payload = updateInvoiceMock.mock.calls[0]?.[3];
    expect(payload).toMatchObject({ parsed: { hsn: "998315" } });
  });
});
