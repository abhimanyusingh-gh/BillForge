import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useEnsureClientOrgSelected } from "@/features/workspace/realm-palette/useEnsureClientOrgSelected";
import { useSessionStore } from "@/state/sessionStore";
import { asClientOrgId, asTenantId } from "@/types/ids";

const listClientOrgsMock = vi.fn();

vi.mock("@/api/clientOrgService", () => ({
  clientOrgService: {
    listClientOrgs: (...args: unknown[]) => listClientOrgsMock(...args)
  }
}));

const sampleOrgs = [
  { id: asClientOrgId("co1"), companyName: "Acme Foods Pvt Ltd", gstin: "29ABCDE1234F1Z5", stateName: "Karnataka" },
  { id: asClientOrgId("co2"), companyName: "Bharat Steels", gstin: "27BHARA1234F1Z5", stateName: "Maharashtra" }
];

beforeEach(() => {
  listClientOrgsMock.mockReset();
  act(() => {
    useSessionStore.getState().clearSession();
  });
});

afterEach(() => {
  act(() => {
    useSessionStore.getState().clearSession();
  });
});

describe("useEnsureClientOrgSelected", () => {
  it("auto-selects the first org when tenant is set and no org is selected", async () => {
    listClientOrgsMock.mockResolvedValue(sampleOrgs);
    act(() => {
      useSessionStore.setState({ tenant: { id: asTenantId("t1"), name: "Khan & Associates" } });
    });

    renderHook(() => useEnsureClientOrgSelected());

    await waitFor(() => {
      expect(useSessionStore.getState().currentClientOrgId).toBe(asClientOrgId("co1"));
    });
  });

  it("does not fetch or change state when an org is already selected", async () => {
    listClientOrgsMock.mockResolvedValue(sampleOrgs);
    act(() => {
      useSessionStore.setState({
        tenant: { id: asTenantId("t1"), name: "Khan & Associates" },
        currentClientOrgId: asClientOrgId("co2")
      });
    });

    renderHook(() => useEnsureClientOrgSelected());

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(listClientOrgsMock).not.toHaveBeenCalled();
    expect(useSessionStore.getState().currentClientOrgId).toBe(asClientOrgId("co2"));
  });

  it("leaves currentClientOrgId null when the tenant has zero client orgs", async () => {
    listClientOrgsMock.mockResolvedValue([]);
    act(() => {
      useSessionStore.setState({ tenant: { id: asTenantId("t1"), name: "Khan & Associates" } });
    });

    renderHook(() => useEnsureClientOrgSelected());

    await waitFor(() => {
      expect(listClientOrgsMock).toHaveBeenCalled();
    });
    expect(useSessionStore.getState().currentClientOrgId).toBeNull();
  });

  it("skips when no tenant is set", async () => {
    renderHook(() => useEnsureClientOrgSelected());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(listClientOrgsMock).not.toHaveBeenCalled();
  });
});
