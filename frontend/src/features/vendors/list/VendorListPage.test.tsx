import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { VendorListPage } from "@/features/vendors/list/VendorListPage";
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
  if (typeof window !== "undefined") window.location.hash = "#/vendors";
});

afterEach(() => {
  act(() => {
    useSessionStore.getState().clearSession();
  });
});

describe("VendorListPage", () => {
  it("renders one row per BE vendor (real shape) and navigates on row click", async () => {
    seedSession();
    listVendorsMock.mockResolvedValue({
      items: [
        {
          id: asVendorId("v1"),
          name: "Acme Pvt Ltd",
          pan: "AAACA1234A",
          gstin: "29AAACA1234A1Z5",
          defaultGlCode: "EXP-101",
          defaultTdsSection: "194C",
          invoiceCount: 7,
          lastInvoiceDate: "2026-04-01",
          vendorStatus: "active",
          msme: { classification: "small", agreedPaymentDays: 45 }
        },
        {
          id: asVendorId("v2"),
          name: "Beta Suppliers",
          pan: null,
          gstin: null,
          defaultGlCode: null,
          defaultTdsSection: null,
          invoiceCount: 2,
          lastInvoiceDate: null,
          vendorStatus: "blocked",
          msme: null
        }
      ],
      page: 1,
      limit: 20,
      total: 2
    });

    render(<VendorListPage />);

    await waitFor(() => {
      expect(screen.getByText("Acme Pvt Ltd")).toBeTruthy();
    });
    expect(screen.getByText("Beta Suppliers")).toBeTruthy();
    expect(screen.getByText("2 total")).toBeTruthy();
    expect(screen.getAllByText("MSME").length).toBeGreaterThanOrEqual(1);

    const acmeRow = screen.getByLabelText("Open vendor Acme Pvt Ltd");
    fireEvent.click(acmeRow);
    expect(window.location.hash).toBe("#/vendors/v1");
  });

  it("renders an empty-state hint when no vendors come back", async () => {
    seedSession();
    listVendorsMock.mockResolvedValue({ items: [], page: 1, limit: 20, total: 0 });

    render(<VendorListPage />);

    await waitFor(() => {
      expect(screen.getByText(/No vendors yet/)).toBeTruthy();
    });
  });
});
