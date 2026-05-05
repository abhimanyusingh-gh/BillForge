import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useStatements } from "@/features/bank-statements/list/useStatements";
import { useSessionStore } from "@/state/sessionStore";
import { asClientOrgId, asTenantId } from "@/types/ids";

const listStatementsMock = vi.fn();

vi.mock("@/api/bankService", () => ({
  bankService: {
    listStatements: (...args: unknown[]) => listStatementsMock(...args),
    getStatementMatches: vi.fn(),
    uploadStatement: vi.fn(),
    matchTransaction: vi.fn(),
    unmatchTransaction: vi.fn(),
    reconcileStatement: vi.fn(),
    listBankAccounts: vi.fn()
  }
}));

function seedSession() {
  act(() => {
    useSessionStore.setState({
      tenant: { id: asTenantId("t1"), name: "T1" },
      currentClientOrgId: asClientOrgId("co1")
    });
  });
}

beforeEach(() => {
  listStatementsMock.mockReset();
  act(() => useSessionStore.getState().clearSession());
});

afterEach(() => {
  act(() => useSessionStore.getState().clearSession());
});

describe("useStatements", () => {
  it("loads statements once tenant + client org are set", async () => {
    seedSession();
    listStatementsMock.mockResolvedValue({ items: [{ id: "s1" }], total: 1, page: 1, limit: 20 });

    const { result } = renderHook(() => useStatements());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.total).toBe(1);
    expect(result.current.items).toHaveLength(1);
    expect(listStatementsMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: asTenantId("t1"), clientOrgId: asClientOrgId("co1") })
    );
  });

  it("surfaces error message on failure", async () => {
    seedSession();
    listStatementsMock.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useStatements());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe("boom");
    expect(result.current.items).toHaveLength(0);
  });

  it("skips fetch when no client org is selected", async () => {
    const { result } = renderHook(() => useStatements());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(listStatementsMock).not.toHaveBeenCalled();
    expect(result.current.items).toHaveLength(0);
  });

  it("re-fetches when reload() is invoked", async () => {
    seedSession();
    listStatementsMock.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });

    const { result } = renderHook(() => useStatements());
    await waitFor(() => expect(listStatementsMock).toHaveBeenCalledTimes(1));

    act(() => result.current.reload());
    await waitFor(() => expect(listStatementsMock).toHaveBeenCalledTimes(2));
  });
});
