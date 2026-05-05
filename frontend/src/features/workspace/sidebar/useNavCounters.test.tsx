import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useNavCounters } from "@/features/workspace/sidebar/useNavCounters";
import { useSessionStore } from "@/state/sessionStore";
import { asClientOrgId, asTenantId } from "@/types/ids";

const fetchActionRequiredCountMock = vi.fn();
const fetchTriageCountMock = vi.fn();

vi.mock("@/api/workspaceService", () => ({
  workspaceService: {
    fetchActionRequiredCount: (...args: unknown[]) => fetchActionRequiredCountMock(...args),
    fetchTriageCount: (...args: unknown[]) => fetchTriageCountMock(...args)
  }
}));

function seedTenantWithClientOrg() {
  act(() => {
    useSessionStore.setState({
      tenant: { id: asTenantId("t1"), name: "Khan & Associates" },
      currentClientOrgId: asClientOrgId("co1")
    });
  });
}

beforeEach(() => {
  fetchActionRequiredCountMock.mockReset();
  fetchTriageCountMock.mockReset();
  act(() => {
    useSessionStore.getState().clearSession();
  });
});

afterEach(() => {
  vi.useRealTimers();
  act(() => {
    useSessionStore.getState().clearSession();
  });
});

describe("useNavCounters", () => {
  it("returns the BE counts and clears the loading flag when tenant + clientOrg are set", async () => {
    seedTenantWithClientOrg();
    fetchActionRequiredCountMock.mockResolvedValue(11);
    fetchTriageCountMock.mockResolvedValue(4);

    const { result } = renderHook(() => useNavCounters());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.action).toBe(11);
    expect(result.current.triage).toBe(4);
  });

  it("falls back to zero when the service rejects", async () => {
    seedTenantWithClientOrg();
    fetchActionRequiredCountMock.mockRejectedValue(new Error("boom"));
    fetchTriageCountMock.mockResolvedValue(0);

    const { result } = renderHook(() => useNavCounters());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.action).toBe(0);
    expect(result.current.triage).toBe(0);
  });

  it("aborts the in-flight fetch on unmount", async () => {
    seedTenantWithClientOrg();
    let signalRef: AbortSignal | undefined;
    fetchActionRequiredCountMock.mockImplementation((_tenantId, _clientOrgId, signal: AbortSignal) => {
      signalRef = signal;
      return new Promise(() => undefined);
    });
    fetchTriageCountMock.mockResolvedValue(0);

    const { unmount } = renderHook(() => useNavCounters());
    await waitFor(() => expect(signalRef?.aborted).toBe(false));
    unmount();
    expect(signalRef?.aborted).toBe(true);
  });

  it("returns zero counters and skips fetching when no tenant is set", async () => {
    const { result } = renderHook(() => useNavCounters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.action).toBe(0);
    expect(result.current.triage).toBe(0);
    expect(fetchActionRequiredCountMock).not.toHaveBeenCalled();
    expect(fetchTriageCountMock).not.toHaveBeenCalled();
  });

  it("keeps action at zero when no client org is selected, but fetches triage", async () => {
    act(() => {
      useSessionStore.setState({
        tenant: { id: asTenantId("t1"), name: "Khan & Associates" },
        currentClientOrgId: null
      });
    });
    fetchTriageCountMock.mockResolvedValue(5);

    const { result } = renderHook(() => useNavCounters());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.action).toBe(0);
    expect(result.current.triage).toBe(5);
    expect(fetchActionRequiredCountMock).not.toHaveBeenCalled();
  });
});
