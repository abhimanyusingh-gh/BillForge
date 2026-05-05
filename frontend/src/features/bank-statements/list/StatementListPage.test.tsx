import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { StatementListPage } from "@/features/bank-statements/list/StatementListPage";
import { useSessionStore } from "@/state/sessionStore";
import { asBankStatementId, asClientOrgId, asTenantId } from "@/types/ids";
import { BANK_STATEMENT_STATUS } from "@/domain/bank/statement";

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

function seed() {
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

describe("StatementListPage", () => {
  it("renders header, dropzone, and empty-state when no statements exist", async () => {
    seed();
    listStatementsMock.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });

    render(<StatementListPage />);

    expect(screen.getByRole("heading", { name: "Bank Statements" })).toBeInTheDocument();
    expect(screen.getByTestId("statement-dropzone")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/No statements yet/)).toBeInTheDocument()
    );
  });

  it("renders rows for fetched statements", async () => {
    seed();
    listStatementsMock.mockResolvedValue({
      items: [
        {
          id: asBankStatementId("s1"),
          clientOrgId: asClientOrgId("co1"),
          bankName: "HDFC",
          accountNumberMasked: "··2034",
          fileName: "hdfc.pdf",
          periodFrom: "2026-04-01",
          periodTo: "2026-04-30",
          uploadedAt: "2026-04-27",
          transactionCount: 100,
          matchedCount: 80,
          unmatchedCount: 20,
          status: BANK_STATEMENT_STATUS.ACTIVE
        }
      ],
      total: 1,
      page: 1,
      limit: 20
    });

    render(<StatementListPage />);

    await waitFor(() => expect(screen.getByText(/HDFC/)).toBeInTheDocument());
    expect(screen.getByText(/hdfc.pdf/)).toBeInTheDocument();
    expect(screen.getByText("20 TO MATCH")).toBeInTheDocument();
  });

  it("surfaces an error message when the load fails", async () => {
    seed();
    listStatementsMock.mockRejectedValue(new Error("nope"));

    render(<StatementListPage />);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("nope"));
  });
});
