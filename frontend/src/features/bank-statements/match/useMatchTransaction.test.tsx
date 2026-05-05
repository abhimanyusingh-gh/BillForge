import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useMatchTransaction, MATCH_STATUS } from "@/features/bank-statements/match/useMatchTransaction";
import { useSessionStore } from "@/state/sessionStore";
import { asClientOrgId, asInvoiceId, asTenantId, asTransactionId } from "@/types/ids";

const matchTransactionMock = vi.fn();

vi.mock("@/api/bankService", () => ({
  bankService: {
    listStatements: vi.fn(),
    getStatementMatches: vi.fn(),
    uploadStatement: vi.fn(),
    matchTransaction: (...args: unknown[]) => matchTransactionMock(...args),
    unmatchTransaction: vi.fn(),
    reconcileStatement: vi.fn(),
    listBankAccounts: vi.fn()
  }
}));

function seed() {
  act(() => {
    useSessionStore.setState({
      tenant: { id: asTenantId("t1"), name: "T1" },
      currentClientOrgId: asClientOrgId("co1")
    });
  });
}

beforeEach(() => {
  matchTransactionMock.mockReset();
  act(() => useSessionStore.getState().clearSession());
});

afterEach(() => {
  act(() => useSessionStore.getState().clearSession());
});

describe("useMatchTransaction", () => {
  it("calls the service with the bank context and transitions to success", async () => {
    seed();
    matchTransactionMock.mockResolvedValue(undefined);
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useMatchTransaction(onSuccess));

    let returned = false;
    await act(async () => {
      returned = await result.current.match(asTransactionId("tx1"), asInvoiceId("inv1"));
    });

    await waitFor(() => expect(result.current.status).toBe(MATCH_STATUS.SUCCESS));
    expect(returned).toBe(true);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(matchTransactionMock).toHaveBeenCalledWith({
      tenantId: asTenantId("t1"),
      clientOrgId: asClientOrgId("co1"),
      txnId: asTransactionId("tx1"),
      invoiceId: asInvoiceId("inv1")
    });
  });

  it("captures error message when the service rejects", async () => {
    seed();
    matchTransactionMock.mockRejectedValue(new Error("oops"));

    const { result } = renderHook(() => useMatchTransaction());

    let returned = true;
    await act(async () => {
      returned = await result.current.match(asTransactionId("tx1"), asInvoiceId("inv1"));
    });

    expect(returned).toBe(false);
    expect(result.current.status).toBe(MATCH_STATUS.ERROR);
    expect(result.current.error).toBe("oops");
  });

  it("rejects when there is no active client org", async () => {
    const { result } = renderHook(() => useMatchTransaction());

    let returned = true;
    await act(async () => {
      returned = await result.current.match(asTransactionId("tx1"), asInvoiceId("inv1"));
    });

    expect(returned).toBe(false);
    expect(result.current.error).toBe("No active client org.");
    expect(matchTransactionMock).not.toHaveBeenCalled();
  });
});
