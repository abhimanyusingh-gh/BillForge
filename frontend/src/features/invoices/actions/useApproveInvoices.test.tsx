import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useApproveInvoices } from "@/features/invoices/actions/useApproveInvoices";
import { useSessionStore } from "@/state/sessionStore";
import { asClientOrgId, asTenantId, asUserId } from "@/types/ids";
import { asInvoiceId } from "@/domain/invoice/invoice";

const approveMock = vi.fn();
const workflowApproveMock = vi.fn();

vi.mock("@/api/invoiceService", () => ({
  invoiceService: {
    listInvoices: vi.fn(),
    getInvoice: vi.fn(),
    updateInvoice: vi.fn(),
    approveInvoices: (...args: unknown[]) => approveMock(...args),
    retryInvoices: vi.fn(),
    deleteInvoices: vi.fn(),
    workflowApprove: (...args: unknown[]) => workflowApproveMock(...args),
    workflowReject: vi.fn(),
    retriggerCompliance: vi.fn(),
    previewUrl: vi.fn()
  }
}));

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
  approveMock.mockReset();
  workflowApproveMock.mockReset();
  act(() => {
    useSessionStore.getState().clearSession();
  });
});

afterEach(() => {
  act(() => {
    useSessionStore.getState().clearSession();
  });
});

describe("useApproveInvoices", () => {
  it("calls approveInvoices and triggers onApproved", async () => {
    approveMock.mockResolvedValueOnce({ modifiedCount: 2 });
    seedSession();
    const onApproved = vi.fn();
    const { result } = renderHook(() => useApproveInvoices(onApproved));

    let count = 0;
    await act(async () => {
      count = await result.current.approve([asInvoiceId("a1"), asInvoiceId("a2")]);
    });

    expect(count).toBe(2);
    expect(approveMock).toHaveBeenCalledTimes(1);
    expect(onApproved).toHaveBeenCalledTimes(1);
  });

  it("returns 0 immediately when there is no active client org", async () => {
    const { result } = renderHook(() => useApproveInvoices());
    let count = 1;
    await act(async () => {
      count = await result.current.approve([asInvoiceId("a1")]);
    });
    expect(count).toBe(0);
    expect(approveMock).not.toHaveBeenCalled();
  });

  it("surfaces backend errors", async () => {
    approveMock.mockRejectedValueOnce(new Error("Server unavailable"));
    seedSession();
    const { result } = renderHook(() => useApproveInvoices());

    await act(async () => {
      await result.current.approve([asInvoiceId("a1")]);
    });
    expect(result.current.error).toBe("Server unavailable");
  });

  it("calls workflowApprove for a single invoice", async () => {
    workflowApproveMock.mockResolvedValueOnce(undefined);
    seedSession();
    const { result } = renderHook(() => useApproveInvoices());

    let ok = false;
    await act(async () => {
      ok = await result.current.workflowApprove(asInvoiceId("a1"), "approved by CA");
    });

    expect(ok).toBe(true);
    expect(workflowApproveMock).toHaveBeenCalledTimes(1);
  });
});
