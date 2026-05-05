import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useEditVendor } from "@/features/vendors/detail/useEditVendor";
import { useSessionStore } from "@/state/sessionStore";
import { asClientOrgId, asTenantId } from "@/types/ids";
import { asVendorId } from "@/domain/vendor/vendor";

const editVendorMock = vi.fn();

vi.mock("@/api/vendorService", () => ({
  vendorService: {
    editVendor: (...args: unknown[]) => editVendorMock(...args)
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
  editVendorMock.mockReset();
  act(() => {
    useSessionStore.getState().clearSession();
  });
});

afterEach(() => {
  act(() => {
    useSessionStore.getState().clearSession();
  });
});

describe("useEditVendor", () => {
  it("calls the service with tenant + client org + vendor id and returns the updated vendor", async () => {
    seedSession();
    const updated = { id: asVendorId("v1"), name: "New Name" };
    editVendorMock.mockResolvedValue(updated);

    const { result } = renderHook(() => useEditVendor());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.edit(asVendorId("v1"), { name: "New Name" });
    });

    expect(returned).toBe(updated);
    expect(editVendorMock).toHaveBeenCalledWith(
      asTenantId("t1"),
      asClientOrgId("co1"),
      asVendorId("v1"),
      { name: "New Name" }
    );
  });

  it("captures the error message and re-throws on failure", async () => {
    seedSession();
    editVendorMock.mockRejectedValue(new Error("server boom"));

    const { result } = renderHook(() => useEditVendor());

    await act(async () => {
      await expect(result.current.edit(asVendorId("v1"), { name: "x" })).rejects.toThrow("server boom");
    });
    expect(result.current.error).toBe("server boom");
  });

  it("rejects when no tenant or client org is active", async () => {
    const { result } = renderHook(() => useEditVendor());
    await act(async () => {
      await expect(result.current.edit(asVendorId("v1"), {})).rejects.toThrow(/active tenant/);
    });
  });
});
