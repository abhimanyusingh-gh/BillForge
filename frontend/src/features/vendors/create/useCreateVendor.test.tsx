import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCreateVendor } from "@/features/vendors/create/useCreateVendor";
import { DuplicateVendorError } from "@/api/vendorService";
import { useSessionStore } from "@/state/sessionStore";
import { asClientOrgId, asTenantId } from "@/types/ids";
import { asVendorId } from "@/domain/vendor/vendor";

const createVendorMock = vi.fn();

vi.mock("@/api/vendorService", async () => {
  const actual = await vi.importActual<typeof import("@/api/vendorService")>("@/api/vendorService");
  return {
    ...actual,
    vendorService: {
      createVendor: (...args: unknown[]) => createVendorMock(...args)
    }
  };
});

function seedSession() {
  act(() => {
    useSessionStore.setState({
      tenant: { id: asTenantId("t1"), name: "Tenant Alpha" },
      currentClientOrgId: asClientOrgId("co1")
    });
  });
}

beforeEach(() => {
  createVendorMock.mockReset();
  act(() => {
    useSessionStore.getState().clearSession();
  });
});

afterEach(() => {
  act(() => {
    useSessionStore.getState().clearSession();
  });
});

describe("useCreateVendor", () => {
  it("submits and returns the created vendor on success", async () => {
    seedSession();
    const created = { id: asVendorId("v-new"), name: "Acme" };
    createVendorMock.mockResolvedValue(created);

    const { result } = renderHook(() => useCreateVendor());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.submit({
        companyName: "Acme",
        gstin: "27AAAAA0000A1Z5",
        panNumber: "AAAAA0000A",
        defaultTdsSection: "194C"
      });
    });

    expect(returned).toBe(created);
    expect(createVendorMock).toHaveBeenCalledWith(
      asTenantId("t1"),
      asClientOrgId("co1"),
      { companyName: "Acme", gstin: "27AAAAA0000A1Z5", panNumber: "AAAAA0000A", defaultTdsSection: "194C" }
    );
    expect(result.current.error).toBeNull();
    expect(result.current.existingVendor).toBeNull();
  });

  it("captures the error message and re-throws on 400 validation failures", async () => {
    seedSession();
    createVendorMock.mockRejectedValue(new Error("gstin format is invalid."));

    const { result } = renderHook(() => useCreateVendor());

    await act(async () => {
      await expect(
        result.current.submit({ companyName: "Acme", gstin: "BAD" })
      ).rejects.toThrow("gstin format is invalid.");
    });
    expect(result.current.error).toBe("gstin format is invalid.");
    expect(result.current.existingVendor).toBeNull();
  });

  it("on 409 duplicate exposes existingVendor and resolves with null instead of throwing", async () => {
    seedSession();
    const existing = { id: asVendorId("v-existing"), name: "Acme Original" };
    createVendorMock.mockRejectedValue(
      new DuplicateVendorError("Vendor with this GSTIN already exists for this client.", existing as never)
    );

    const { result } = renderHook(() => useCreateVendor());

    let returned: unknown = "untouched";
    await act(async () => {
      returned = await result.current.submit({ companyName: "Acme", gstin: "27AAAAA0000A1Z5" });
    });

    expect(returned).toBeNull();
    expect(result.current.existingVendor).toBe(existing);
    expect(result.current.error).toBe("Vendor with this GSTIN already exists for this client.");
  });
});
