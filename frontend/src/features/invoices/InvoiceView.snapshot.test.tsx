/**
 * @jest-environment jsdom
 */
import { act, render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  AWAITING_APPROVAL_INVOICES,
  EMPTY_LIST_RESPONSE,
  EXPORTED_INVOICES,
  FIXTURE_USER_CAPABILITIES,
  MIXED_STATUS_INVOICES,
  NEEDS_REVIEW_INVOICES,
  makeListResponse
} from "@/features/invoices/InvoiceView.fixtures";
import { useUserPrefsStore, TABLE_DENSITY } from "@/stores/userPrefsStore";

jest.mock("@/api/client", () => {
  const { buildApiClientMockModule } = require("@/test-utils/mockApiClient");
  return {
    ...buildApiClientMockModule(),
    authenticatedUrl: (path: string) => `https://test.local${path}`,
    safeNum: (v: unknown, fallback: number) =>
      typeof v === "number" && Number.isFinite(v) ? v : fallback,
    stripNulls: (value: unknown) => value
  };
});
jest.mock("@/api", () => ({
  fetchInvoices: jest.fn(),
  fetchInvoiceById: jest.fn(),
  fetchIngestionStatus: jest.fn(),
  fetchGlCodes: jest.fn(),
  fetchTdsRates: jest.fn(),
  approveInvoices: jest.fn(),
  approveWorkflowStep: jest.fn(),
  rejectWorkflowStep: jest.fn(),
  deleteInvoices: jest.fn(),
  retryInvoices: jest.fn(),
  generateTallyXmlFile: jest.fn(),
  downloadTallyXmlFile: jest.fn(),
  pauseIngestion: jest.fn(),
  runIngestion: jest.fn(),
  subscribeIngestionSSE: jest.fn(() => () => {}),
  updateInvoiceParsedFields: jest.fn(),
  updateInvoiceComplianceOverride: jest.fn(),
  renameInvoiceAttachment: jest.fn(),
  uploadInvoiceFiles: jest.fn(),
  requestPresignedUrls: jest.fn(),
  registerUploadedKeys: jest.fn()
}));

const apiMock = jest.requireMock("@/api") as {
  fetchInvoices: jest.Mock;
  fetchInvoiceById: jest.Mock;
  fetchIngestionStatus: jest.Mock;
  fetchGlCodes: jest.Mock;
  fetchTdsRates: jest.Mock;
  subscribeIngestionSSE: jest.Mock;
};

import { InvoiceView } from "@/features/invoices/InvoiceView";

const FIXED_NOW = new Date("2026-04-21T08:00:00.000Z");

const BASE_PROPS = {
  tenantId: "tenant-test",
  userId: "user-test",
  userEmail: "user@example.com",
  canViewAllInvoices: true,
  capabilities: FIXTURE_USER_CAPABILITIES,
  requiresTenantSetup: false,
  tenantMode: "test" as const,
  tenantUsers: [],
  onGmailStatusRefresh: () => {},
  onNavCountsChange: () => {},
  onSessionExpired: () => {},
  addToast: () => {}
};

const realToLocaleString = Date.prototype.toLocaleString;
const realDateTimeFormat = Intl.DateTimeFormat;

beforeAll(() => {
  process.env.TZ = "UTC";
});

function lockLocaleAndTimezone() {
  jest
    .spyOn(Date.prototype, "toLocaleString")
    .mockImplementation(function (this: Date, _locale, options) {
      return realToLocaleString.call(this, "en-US", { timeZone: "UTC", ...(options ?? {}) });
    });
  jest.spyOn(Intl, "DateTimeFormat").mockImplementation(((_locale: unknown, options?: Intl.DateTimeFormatOptions) =>
    new realDateTimeFormat("en-US", { timeZone: "UTC", ...(options ?? {}) })) as unknown as typeof Intl.DateTimeFormat);
}

function installMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn()
    })
  });
}

beforeEach(() => {
  jest.useFakeTimers({ now: FIXED_NOW });
  jest.clearAllMocks();
  lockLocaleAndTimezone();
  window.localStorage.clear();
  useUserPrefsStore.setState((state) => ({
    ...state,
    invoiceView: { ...state.invoiceView, panelSplitPercent: 58, tableDensity: TABLE_DENSITY.COMFORTABLE }
  }));
  installMatchMedia();
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    cb(0);
    return 0;
  });
  jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

  apiMock.fetchIngestionStatus.mockResolvedValue({
    state: "idle",
    running: false,
    totalFiles: 0,
    processedFiles: 0,
    newInvoices: 0,
    duplicates: 0,
    failures: 0,
    lastUpdatedAt: FIXED_NOW.toISOString()
  });
  apiMock.fetchGlCodes.mockResolvedValue({ items: [], total: 0 });
  apiMock.fetchTdsRates.mockResolvedValue([]);
  apiMock.fetchInvoiceById.mockResolvedValue(null);
  apiMock.subscribeIngestionSSE.mockReturnValue(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function flushAsync() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function getListPanel(container: HTMLElement): Element {
  const panel = container.querySelector("[data-testid='invoice-list-panel']");
  if (!panel) throw new Error("invoice-list-panel not found");
  return panel;
}

async function waitForDataRows(container: HTMLElement) {
  await waitFor(() =>
    expect(container.querySelector("[data-testid='lb-datatable-row']")).not.toBeNull()
  );
}

describe("features/invoices/InvoiceView — snapshot baseline", () => {
  it("renders the loading skeleton while invoices load", async () => {
    apiMock.fetchInvoices.mockImplementation(() => new Promise(() => {}));
    const { container } = render(<InvoiceView {...BASE_PROPS} />);
    await flushAsync();
    expect(getListPanel(container)).toMatchSnapshot();
  });

  it("renders the empty state when no invoices and no filters", async () => {
    apiMock.fetchInvoices.mockResolvedValue(EMPTY_LIST_RESPONSE);
    const { container } = render(<InvoiceView {...BASE_PROPS} />);
    await waitFor(() => expect(container.querySelector(".empty-state")).not.toBeNull());
    await flushAsync();
    expect(getListPanel(container)).toMatchSnapshot();
  });

  it("renders the error banner when fetch fails", async () => {
    apiMock.fetchInvoices.mockRejectedValue(new Error("boom"));
    const { container } = render(<InvoiceView {...BASE_PROPS} />);
    await waitFor(() => expect(container.querySelector("p.error")).not.toBeNull());
    await flushAsync();
    expect(container.querySelector("p.error")).toMatchSnapshot();
  });

  it("renders the data state with mixed-status invoices", async () => {
    apiMock.fetchInvoices.mockResolvedValue(makeListResponse(MIXED_STATUS_INVOICES));
    const { container } = render(<InvoiceView {...BASE_PROPS} />);
    await waitForDataRows(container);
    await flushAsync();
    expect(getListPanel(container)).toMatchSnapshot();
  });

  it("renders rows scoped to NEEDS_REVIEW invoices", async () => {
    apiMock.fetchInvoices.mockResolvedValue(makeListResponse(NEEDS_REVIEW_INVOICES));
    const { container } = render(<InvoiceView {...BASE_PROPS} />);
    await waitForDataRows(container);
    await flushAsync();
    expect(container.querySelector("[data-testid='invoice-list-table']")).toMatchSnapshot();
  });

  it("renders the EXPORTED row class when invoice is exported", async () => {
    apiMock.fetchInvoices.mockResolvedValue(makeListResponse(EXPORTED_INVOICES));
    const { container } = render(<InvoiceView {...BASE_PROPS} />);
    await waitForDataRows(container);
    await flushAsync();
    expect(container.querySelector("[data-testid='invoice-list-table']")).toMatchSnapshot();
  });

  it("renders compact density when user prefs override default", async () => {
    useUserPrefsStore.setState((state) => ({
      ...state,
      invoiceView: { ...state.invoiceView, tableDensity: TABLE_DENSITY.COMPACT }
    }));
    apiMock.fetchInvoices.mockResolvedValue(makeListResponse(AWAITING_APPROVAL_INVOICES));
    const { container } = render(<InvoiceView {...BASE_PROPS} />);
    await waitForDataRows(container);
    await flushAsync();
    const panel = getListPanel(container);
    expect(panel.getAttribute("data-density")).toBe("compact");
    expect(panel).toMatchSnapshot();
  });

  // Re-mock the filter response rather than driving the filter UI:
  // snapshot baseline values determinism over user-flow fidelity; the W3-7
  // decomp PR validates same input -> same render.
  it("renders the filtered-empty state when filters yield no rows", async () => {
    apiMock.fetchInvoices.mockResolvedValueOnce(makeListResponse(MIXED_STATUS_INVOICES));
    apiMock.fetchInvoices.mockResolvedValue(EMPTY_LIST_RESPONSE);
    const { container, rerender } = render(<InvoiceView {...BASE_PROPS} />);
    await waitFor(() => expect(apiMock.fetchInvoices).toHaveBeenCalled());
    await flushAsync();
    apiMock.fetchInvoices.mockResolvedValue(EMPTY_LIST_RESPONSE);
    rerender(<InvoiceView {...BASE_PROPS} />);
    await flushAsync();
    expect(getListPanel(container)).toMatchSnapshot();
  });
});
