import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useVendorList } from "@/features/vendors/list/useVendorList";
import { useSessionStore } from "@/state/sessionStore";
import { asClientOrgId, asTenantId } from "@/types/ids";
import { asVendorId } from "@/domain/vendor/vendor";

const listVendorsMock = vi.fn();

vi.mock("@/api/vendorService", () => ({
  vendorService: {
    listVendors: (...args: unknown[]) => listVendorsMock(...args)
  }
}));

function seedSession() {
  act(() => {
    useSessionStore.setState({
      tenant: { id: asTenantId("t1"), name: "Tenant Alpha" },
      currentClientOrgId: asClientOrgId("co1")
    });
  });
}

beforeEach(() => {
  listVendorsMock.mockReset();
  act(() => {
    useSessionStore.getState().clearSession();
  });
});

afterEach(() => {
  act(() => {
    useSessionStore.getState().clearSession();
  });
});

describe("useVendorList", () => {
  it("loads vendors via the service when tenant + client org are set", async () => {
    seedSession();
    listVendorsMock.mockResolvedValue({
      items: [
        {
          id: asVendorId("v1"),
          name: "Acme Pvt Ltd",
          pan: "AAACA1234A",
          gstin: null,
          defaultGlCode: null,
          defaultTdsSection: "194C",
          invoiceCount: 3,
          lastInvoiceDate: "2026-04-01",
          vendorStatus: "active",
          msme: null
        }
      ],
      page: 1,
      limit: 20,
      total: 1
    });

    const { result } = renderHook(() => useVendorList());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.page?.items).toHaveLength(1);
    expect(result.current.page?.items[0].name).toBe("Acme Pvt Ltd");
    expect(listVendorsMock).toHaveBeenCalledWith(
      asTenantId("t1"),
      asClientOrgId("co1"),
      {},
      expect.any(AbortSignal)
    );
  });

  it("re-fetches when filters change", async () => {
    seedSession();
    listVendorsMock.mockResolvedValue({ items: [], page: 1, limit: 20, total: 0 });

    const { result } = renderHook(() => useVendorList());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setFilters({ status: "active" });
    });

    await waitFor(() => {
      expect(listVendorsMock).toHaveBeenCalledTimes(2);
    });
    expect(listVendorsMock.mock.calls[1][2]).toEqual({ status: "active" });
  });

  it("surfaces an error message when the service rejects", async () => {
    seedSession();
    listVendorsMock.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useVendorList());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe("boom");
  });

  it("does not call the service without an active tenant + client org", () => {
    renderHook(() => useVendorList());
    expect(listVendorsMock).not.toHaveBeenCalled();
  });
});
