/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { OverviewDashboard } from "@/features/overview/OverviewDashboard";
import { ADMIN_CLIENT_ORG_QUERY_PARAM } from "@/hooks/useAdminClientOrgFilter";
import { resetStores } from "@/test-utils/resetStores";

const ORG_A = "65a1b2c3d4e5f6a7b8c9d0e1";
const ORG_B = "65a1b2c3d4e5f6a7b8c9d0e2";

jest.mock("@/api", () => ({
  fetchAnalyticsOverview: jest.fn(),
  fetchInvoices: jest.fn().mockResolvedValue({ items: [], page: 1, limit: 100, total: 0 })
}));

jest.mock("@/api/clientOrgs", () => ({
  fetchClientOrganizations: jest.fn()
}));

const mockedApi = jest.requireMock("@/api") as { fetchAnalyticsOverview: jest.Mock };
const mockedOrgs = jest.requireMock("@/api/clientOrgs") as { fetchClientOrganizations: jest.Mock };

function emptyOverview() {
  return {
    kpis: { totalInvoices: 0, approvedAmountMinor: 0, pendingAmountMinor: 0, exportedCount: 0, needsReviewCount: 0, approvedCount: 0 },
    statusBreakdown: [],
    dailyApprovals: [],
    dailyIngestion: [],
    dailyExports: [],
    topVendorsByApproved: [],
    topVendorsByPending: []
  };
}

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<OverviewDashboard />, { wrapper });
}

beforeEach(() => {
  jest.clearAllMocks();
  window.history.replaceState({}, "", "/");
  window.sessionStorage.clear();
  resetStores();
  mockedApi.fetchAnalyticsOverview.mockResolvedValue(emptyOverview());
  mockedOrgs.fetchClientOrganizations.mockResolvedValue([
    { _id: ORG_A, tenantId: "t-1", gstin: "27AAAAA0000A1Z5", companyName: "Sharma Textiles", f12OverwriteByGuidVerified: false, detectedVersion: null, createdAt: "", updatedAt: "" },
    { _id: ORG_B, tenantId: "t-1", gstin: "27AAAAA0000A1Z6", companyName: "Bose Steel", f12OverwriteByGuidVerified: false, detectedVersion: null, createdAt: "", updatedAt: "" }
  ]);
});

afterEach(() => {
  window.history.replaceState({}, "", "/");
});

describe("OverviewDashboard — admin clientOrgId integration (#162)", () => {
  it("mounts the AdminRealmSwitcher in the dashboard topbar", async () => {
    renderDashboard();
    expect(await screen.findByTestId("admin-realm-switcher")).toBeInTheDocument();
  });

  it("calls fetchAnalyticsOverview WITHOUT clientOrgId by default (All clients aggregate)", async () => {
    renderDashboard();
    await waitFor(() => expect(mockedApi.fetchAnalyticsOverview).toHaveBeenCalled());
    const calls = mockedApi.fetchAnalyticsOverview.mock.calls;
    for (const args of calls) {
      expect(args[3]).toBeNull();
    }
  });

  it("calls fetchAnalyticsOverview WITH clientOrgId when URL has ?clientOrgId=...", async () => {
    window.history.replaceState({}, "", `/?${ADMIN_CLIENT_ORG_QUERY_PARAM}=${ORG_A}`);
    renderDashboard();
    await waitFor(() => expect(mockedApi.fetchAnalyticsOverview).toHaveBeenCalled());
    const calls = mockedApi.fetchAnalyticsOverview.mock.calls;
    expect(calls[0][3]).toBe(ORG_A);
  });

  it("re-fetches WITHOUT clientOrgId when 'All clients' is selected", async () => {
    window.history.replaceState({}, "", `/?${ADMIN_CLIENT_ORG_QUERY_PARAM}=${ORG_A}`);
    renderDashboard();
    await waitFor(() => expect(mockedApi.fetchAnalyticsOverview).toHaveBeenCalled());
    mockedApi.fetchAnalyticsOverview.mockClear();
    fireEvent.click(await screen.findByTestId("admin-realm-switcher-segment-all"));
    await waitFor(() => expect(mockedApi.fetchAnalyticsOverview).toHaveBeenCalled());
    const lastArgs = mockedApi.fetchAnalyticsOverview.mock.calls[0];
    expect(lastArgs[3]).toBeNull();
  });
});

describe("OverviewDashboard — Approval scope toggle a11y", () => {
  it("groups the two scope segments under role=group with aria-label='Approval scope'", async () => {
    renderDashboard();
    const group = await screen.findByRole("group", { name: "Approval scope" });
    expect(group).toBeInTheDocument();
  });

  it("each scope pill exposes aria-pressed reflecting the active state (default 'all')", async () => {
    renderDashboard();
    const group = await screen.findByRole("group", { name: "Approval scope" });
    const mineBtn = within(group).getByRole("button", { name: "My Approvals" });
    const allBtn = within(group).getByRole("button", { name: "All Users" });
    expect(mineBtn).toHaveAttribute("aria-pressed", "false");
    expect(allBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("clicking a scope pill toggles aria-pressed between the two options", async () => {
    renderDashboard();
    const group = await screen.findByRole("group", { name: "Approval scope" });
    const mineBtn = within(group).getByRole("button", { name: "My Approvals" });
    const allBtn = within(group).getByRole("button", { name: "All Users" });
    fireEvent.click(mineBtn);
    expect(mineBtn).toHaveAttribute("aria-pressed", "true");
    expect(allBtn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(allBtn);
    expect(mineBtn).toHaveAttribute("aria-pressed", "false");
    expect(allBtn).toHaveAttribute("aria-pressed", "true");
  });
});

describe("OverviewDashboard — bundle layout (R4)", () => {
  it("renders the Overview page header", async () => {
    renderDashboard();
    expect(await screen.findByRole("heading", { level: 1, name: /Overview/ })).toBeInTheDocument();
  });

  it("renders four KPI tiles with bundle ordering", async () => {
    renderDashboard();
    await waitFor(() => expect(mockedApi.fetchAnalyticsOverview).toHaveBeenCalled());
    expect(await screen.findByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("Awaiting approval")).toBeInTheDocument();
    expect(screen.getByText("Approved amount")).toBeInTheDocument();
    expect(screen.getByText("Exported")).toBeInTheDocument();
  });

  it("renders the 'What needs your attention' panel and placeholder side cards", async () => {
    renderDashboard();
    expect(await screen.findByTestId("overview-attention-panel")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: /Net payable/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: /TDS deducted/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: /Recent activity/ })).toBeInTheDocument();
  });
});
