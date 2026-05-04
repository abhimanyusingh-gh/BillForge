/**
 * @jest-environment jsdom
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ActionRequiredPage, ACTION_PAGE_VIEW } from "@/features/invoices/ActionRequiredPage";
import { setActiveClientOrgId } from "@/hooks/useActiveClientOrg";
import { writeTenantSetupCompleted } from "@/hooks/useTenantSetupCompleted";
import type { Invoice } from "@/types";

jest.mock("@/api", () => ({
  fetchInvoices: jest.fn()
}));

const { fetchInvoices } = jest.requireMock("@/api") as { fetchInvoices: jest.Mock };

function makeInvoice(overrides: Partial<Invoice> & { id: string }): Invoice {
  const { id, ...rest } = overrides;
  return {
    _id: id,
    tenantId: "t",
    workloadTier: "standard",
    sourceType: "upload",
    sourceKey: id,
    sourceDocumentId: id,
    attachmentName: `${id}.pdf`,
    mimeType: "application/pdf",
    receivedAt: "2026-04-20T00:00:00Z",
    confidenceScore: 80,
    confidenceTone: "green",
    autoSelectForApproval: false,
    status: "PARSED",
    processingIssues: [],
    createdAt: "2026-04-20T00:00:00Z",
    updatedAt: "2026-04-20T00:00:00Z",
    parsed: { invoiceNumber: `N-${id}`, vendorName: `V-${id}`, currency: "INR", customerGstin: "29ABCDE1234F1Z5" },
    ...rest
  } as Invoice;
}

function renderWithClient(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  window.history.replaceState({}, "", "/");
  window.sessionStorage.clear();
  setActiveClientOrgId("realm-test");
  writeTenantSetupCompleted(true);
});

afterEach(() => {
  setActiveClientOrgId(null);
});

describe("features/invoices/ActionRequiredPage — full-page route contract", () => {
  it("renders the loading skeleton while the query is pending", () => {
    fetchInvoices.mockImplementation(() => new Promise(() => {}));
    renderWithClient(<ActionRequiredPage />);
    const body = screen.getByTestId("action-page-body");
    expect(body.dataset.view).toBe(ACTION_PAGE_VIEW.Loading);
  });

  it("renders the empty state when no invoices require action", async () => {
    fetchInvoices.mockResolvedValue({
      items: [makeInvoice({ id: "ok", status: "APPROVED" })],
      page: 1,
      limit: 100,
      total: 1
    });
    renderWithClient(<ActionRequiredPage />);
    expect(await screen.findByTestId("action-page-empty")).toHaveTextContent(/all caught up/i);
  });

  it("renders rows and navigates on click", async () => {
    fetchInvoices.mockResolvedValue({
      items: [
        makeInvoice({ id: "ocr-1", status: "FAILED_OCR" }),
        makeInvoice({ id: "await-1", status: "AWAITING_APPROVAL" })
      ],
      page: 1,
      limit: 100,
      total: 2
    });
    const onSelectInvoice = jest.fn();
    renderWithClient(<ActionRequiredPage onSelectInvoice={onSelectInvoice} />);
    const rows = await screen.findAllByTestId("action-page-row");
    expect(rows.length).toBe(2);
    act(() => {
      fireEvent.click(rows[0]);
    });
    expect(onSelectInvoice).toHaveBeenCalledTimes(1);
  });

  it("filters rows by chip selection", async () => {
    fetchInvoices.mockResolvedValue({
      items: [
        makeInvoice({ id: "ocr-1", status: "FAILED_OCR" }),
        makeInvoice({ id: "await-1", status: "AWAITING_APPROVAL" }),
        makeInvoice({ id: "await-2", status: "AWAITING_APPROVAL" })
      ],
      page: 1,
      limit: 100,
      total: 3
    });
    renderWithClient(<ActionRequiredPage />);
    expect(await screen.findAllByTestId("action-page-row")).toHaveLength(3);
    const awaitChip = screen.getByRole("button", { name: /Awaiting/ });
    act(() => {
      fireEvent.click(awaitChip);
    });
    expect(screen.getAllByTestId("action-page-row")).toHaveLength(2);
  });
});
