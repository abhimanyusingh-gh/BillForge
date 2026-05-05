import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInvoiceList } from "@/features/invoices/list/useInvoiceList";
import { useSessionStore } from "@/state/sessionStore";
import { asClientOrgId, asTenantId, asUserId } from "@/types/ids";
import { asInvoiceId, INVOICE_STATUS, type Invoice } from "@/domain/invoice/invoice";

const listInvoicesMock = vi.fn();

vi.mock("@/api/invoiceService", () => ({
  invoiceService: {
    listInvoices: (...args: unknown[]) => listInvoicesMock(...args),
    getInvoice: vi.fn(),
    updateInvoice: vi.fn(),
    approveInvoices: vi.fn(),
    retryInvoices: vi.fn(),
    deleteInvoices: vi.fn(),
    workflowApprove: vi.fn(),
    workflowReject: vi.fn(),
    retriggerCompliance: vi.fn(),
    previewUrl: vi.fn()
  }
}));

function makeInvoice(id: string, vendor: string): Invoice {
  return {
    id: asInvoiceId(id),
    status: INVOICE_STATUS.APPROVED,
    vendor,
    invoiceNumber: "INV-1",
    invoiceDate: null,
    receivedAt: null,
    totalAmount: 100000,
    tdsAmount: 1000,
    netAmount: 99000,
    confidence: 0.9,
    fileName: null,
    parsed: {
      vendor, invoiceNumber: "INV-1", invoiceDate: null,
      gstin: null, pan: null, hsn: null, irn: null,
      totalAmount: 100000, taxAmount: null, netAmount: 99000,
      tdsSection: null, tdsAmount: 1000, tcsAmount: null,
      glCode: null, glName: null, costCenter: null
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
  listInvoicesMock.mockReset();
  act(() => {
    useSessionStore.getState().clearSession();
  });
});

afterEach(() => {
  act(() => {
    useSessionStore.getState().clearSession();
  });
});

describe("useInvoiceList", () => {
  it("fetches invoices for the active tenant + client org", async () => {
    listInvoicesMock.mockResolvedValueOnce({
      items: [makeInvoice("a1", "Acme Corp"), makeInvoice("a2", "Globex Ltd")],
      total: 2,
      page: 1,
      limit: 50
    });
    seedSession();
    const { result } = renderHook(() => useInvoiceList());

    await waitFor(() => expect(result.current.invoices.length).toBe(2));
    expect(result.current.total).toBe(2);
    expect(listInvoicesMock).toHaveBeenCalledTimes(1);
  });

  it("re-fetches with the new status filter when setStatus is called", async () => {
    listInvoicesMock.mockResolvedValue({ items: [], total: 0, page: 1, limit: 50 });
    seedSession();
    const { result } = renderHook(() => useInvoiceList());

    await waitFor(() => expect(listInvoicesMock).toHaveBeenCalledTimes(1));
    act(() => result.current.setStatus(INVOICE_STATUS.APPROVED));
    await waitFor(() => expect(listInvoicesMock).toHaveBeenCalledTimes(2));
    const lastCall = listInvoicesMock.mock.calls.at(-1)!;
    expect(lastCall[2]).toMatchObject({ status: INVOICE_STATUS.APPROVED });
  });

  it("filters invoices on the client by search text", async () => {
    listInvoicesMock.mockResolvedValue({
      items: [makeInvoice("a1", "Acme Corp"), makeInvoice("a2", "Globex Ltd")],
      total: 2, page: 1, limit: 50
    });
    seedSession();
    const { result } = renderHook(() => useInvoiceList());
    await waitFor(() => expect(result.current.invoices.length).toBe(2));

    act(() => result.current.setSearch("acme"));
    await waitFor(() => expect(result.current.invoices.length).toBe(1));
    expect(result.current.invoices[0].vendor).toBe("Acme Corp");
  });

  it("surfaces backend errors", async () => {
    listInvoicesMock.mockRejectedValueOnce(new Error("Boom"));
    seedSession();
    const { result } = renderHook(() => useInvoiceList());
    await waitFor(() => expect(result.current.error).toBe("Boom"));
  });
});
