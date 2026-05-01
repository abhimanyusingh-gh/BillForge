/**
 * @jest-environment jsdom
 */
import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TdsDashboardPage } from "@/features/reports/TdsDashboardPage";
import { writeTenantSetupCompleted } from "@/hooks/useTenantSetupCompleted";
import { resetStores } from "@/test-utils/resetStores";

jest.mock("recharts", () => {
  const Stub = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return new Proxy({}, { get: () => Stub });
});

jest.mock("@/api/client", () => {
  const { buildApiClientMockModule } = require("@/test-utils/mockApiClient");
  return buildApiClientMockModule();
});

jest.mock("@/api/reports", () => {
  const actual = jest.requireActual("@/api/reports");
  return {
    ...actual,
    fetchTdsLiabilityReport: jest.fn()
  };
});

const mockedReports = jest.requireMock("@/api/reports") as {
  fetchTdsLiabilityReport: jest.Mock;
};

function emptyReport() {
  return {
    tan: "BLRA12345A",
    fy: "2025-26",
    bySection: [],
    byVendor: [],
    byQuarter: []
  };
}

function populatedReport() {
  return {
    tan: "BLRA12345A",
    fy: "2025-26",
    bySection: [{ section: "194C", cumulativeBaseMinor: 200_000, cumulativeTdsMinor: 4_000, invoiceCount: 3, thresholdCrossedAt: null }],
    byVendor: [
      {
        vendorFingerprint: "vendor-1",
        section: "194C",
        cumulativeBaseMinor: 200_000,
        cumulativeTdsMinor: 4_000,
        invoiceCount: 3,
        thresholdCrossedAt: "2026-01-10T00:00:00.000Z"
      }
    ],
    byQuarter: [
      { quarter: "Q1", section: "194C", cumulativeBaseMinor: 100_000, cumulativeTdsMinor: 2_000, invoiceCount: 2 },
      { quarter: "Q2", section: "194C", cumulativeBaseMinor: 100_000, cumulativeTdsMinor: 2_000, invoiceCount: 1 }
    ]
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<TdsDashboardPage />, { wrapper });
}

beforeEach(() => {
  jest.clearAllMocks();
  window.history.replaceState({}, "", "/");
  resetStores();
  writeTenantSetupCompleted(true);
});

afterEach(() => {
  window.history.replaceState({}, "", "/");
});

describe("TdsDashboardPage — 4-state UX coverage", () => {
  it("renders the loading skeleton state while the query is pending", () => {
    mockedReports.fetchTdsLiabilityReport.mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId("tds-dashboard-loading")).toBeInTheDocument();
  });

  it("renders the empty state surfaces (table + chart) when the report has no data", async () => {
    mockedReports.fetchTdsLiabilityReport.mockResolvedValue(emptyReport());
    renderPage();
    await waitFor(() => expect(screen.getByTestId("tds-table-empty")).toBeInTheDocument());
    expect(screen.getByTestId("tds-chart-empty")).toBeInTheDocument();
    expect(screen.getByTestId("tds-dashboard-tan")).toHaveTextContent("BLRA12345A");
  });

  it("renders the populated dashboard when data arrives (KPIs + table + chart)", async () => {
    mockedReports.fetchTdsLiabilityReport.mockResolvedValue(populatedReport());
    renderPage();
    await waitFor(() => expect(screen.getByTestId("tds-liability-table")).toBeInTheDocument());
    expect(screen.getByTestId("tds-cumulative-chart")).toBeInTheDocument();
    expect(screen.getByTestId("tds-kpi-tiles")).toBeInTheDocument();
  });

  it("renders the error state with a retry CTA when the query fails", async () => {
    mockedReports.fetchTdsLiabilityReport.mockRejectedValue(new Error("network down"));
    renderPage();
    await waitFor(() => expect(screen.getByTestId("tds-dashboard-error")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
