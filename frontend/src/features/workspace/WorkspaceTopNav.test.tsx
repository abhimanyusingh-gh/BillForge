/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

jest.mock("@/api/client", () => {
  const { buildApiClientMockModule } = require("@/test-utils/mockApiClient");
  return buildApiClientMockModule();
});
jest.mock("@/api", () => ({
  fetchInvoices: jest.fn().mockResolvedValue({ items: [], total: 0 })
}));

import { getMockedApiClient } from "@/test-utils/mockApiClient";
const apiClient = getMockedApiClient();

import { WorkspaceTopNav } from "@/features/workspace/WorkspaceTopNav";
import type { ClientOrganization } from "@/api/clientOrgs";
import {
  ACTIVE_CLIENT_ORG_STORAGE_KEY,
  setActiveClientOrgId
} from "@/hooks/useActiveClientOrg";
import { writeActiveTenantId } from "@/api/tenantStorage";

function buildOrg(overrides: Partial<ClientOrganization> & { _id: string; companyName: string }): ClientOrganization {
  return {
    tenantId: "tenant-1",
    gstin: "29ABCPK1234F1Z5",
    f12OverwriteByGuidVerified: false,
    detectedVersion: null,
    createdAt: "2026-04-20T00:00:00Z",
    updatedAt: "2026-04-20T00:00:00Z",
    ...overrides
  };
}

function clearActiveRealm() {
  window.history.replaceState({}, "", "/");
  window.sessionStorage.clear();
  writeActiveTenantId(null);
}

function renderTopNav(overrides: Partial<React.ComponentProps<typeof WorkspaceTopNav>> = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } }
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  const props: React.ComponentProps<typeof WorkspaceTopNav> = {
    userEmail: "ca@example.com",
    onLogout: jest.fn(),
    onChangePassword: jest.fn(),
    ...overrides
  };
  return { props, ...render(<Wrapper><WorkspaceTopNav {...props} /></Wrapper>) };
}

beforeEach(() => {
  jest.clearAllMocks();
  clearActiveRealm();
  writeActiveTenantId("tenant-1");
});
afterEach(clearActiveRealm);

describe("WorkspaceTopNav — bundle-aligned chrome", () => {
  it("renders the CLIENT ORG eyebrow + single client-org pill with ⌘K hint", async () => {
    apiClient.get.mockResolvedValueOnce({ data: { items: [] } });
    renderTopNav();
    expect(screen.getByText(/Client org/i)).toBeInTheDocument();
    const pill = await screen.findByTestId("active-realm-badge");
    expect(pill).toHaveTextContent("⌘K");
  });

  it("opens the realm switcher when the client-org pill is clicked", async () => {
    apiClient.get.mockResolvedValueOnce({
      data: { items: [buildOrg({ _id: "org-1", companyName: "Sharma Textiles" })] }
    });
    setActiveClientOrgId("org-1");
    renderTopNav();
    await waitFor(() => expect(screen.getByTestId("active-realm-badge")).toHaveTextContent("Sharma Textiles"));
    fireEvent.click(screen.getByTestId("active-realm-badge"));
    expect(screen.getByTestId("realm-switcher-overlay")).toBeInTheDocument();
  });

  it("toggles the switcher with the Cmd+K shortcut", async () => {
    apiClient.get.mockResolvedValueOnce({
      data: { items: [buildOrg({ _id: "org-1", companyName: "Sharma Textiles" })] }
    });
    renderTopNav();
    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    expect(screen.queryByTestId("realm-switcher-overlay")).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByTestId("realm-switcher-overlay")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.queryByTestId("realm-switcher-overlay")).not.toBeInTheDocument();
  });

  it("opens the switcher with Ctrl+K (non-mac) as well", async () => {
    apiClient.get.mockResolvedValueOnce({ data: { items: [] } });
    renderTopNav();
    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByTestId("realm-switcher-overlay")).toBeInTheDocument();
  });

  it("commits a new realm via the switcher and updates session storage", async () => {
    apiClient.get.mockResolvedValueOnce({
      data: {
        items: [
          buildOrg({ _id: "org-1", companyName: "Sharma Textiles" }),
          buildOrg({ _id: "org-2", companyName: "Bose Steel" })
        ]
      }
    });
    renderTopNav();
    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId("active-realm-badge"));
    fireEvent.click(screen.getByTestId("realm-switcher-option-org-2"));
    expect(window.sessionStorage.getItem(ACTIVE_CLIENT_ORG_STORAGE_KEY)).toBe("org-2");
    expect(screen.queryByTestId("realm-switcher-overlay")).not.toBeInTheDocument();
  });

  it("does not render the legacy Action button (Action lives in sidebar now)", async () => {
    apiClient.get.mockResolvedValueOnce({ data: { items: [] } });
    renderTopNav();
    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    expect(screen.queryByTestId("action-required-trigger")).not.toBeInTheDocument();
  });

  it("does not render a Logout button at the topnav root (lives inside avatar menu)", async () => {
    apiClient.get.mockResolvedValueOnce({ data: { items: [] } });
    renderTopNav();
    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /^Logout$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Sign out$/i })).not.toBeInTheDocument();
  });

  it("opens the avatar menu and exposes Sign out + Change password", async () => {
    apiClient.get.mockResolvedValueOnce({ data: { items: [] } });
    const { props } = renderTopNav();
    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /Account menu/i }));
    const menu = screen.getByTestId("topnav-avatar-menu");
    fireEvent.click(within(menu).getByRole("menuitem", { name: /Sign out/i }));
    expect(props.onLogout).toHaveBeenCalledTimes(1);
  });

  it("opens placeholder dialogs for search + bell when no handlers are wired", async () => {
    apiClient.get.mockResolvedValueOnce({ data: { items: [] } });
    renderTopNav();
    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /^Search$/i }));
    expect(screen.getByTestId("topnav-search-placeholder")).toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId("topnav-search-placeholder")).getByRole("button", { name: /Close/i }));
    expect(screen.queryByTestId("topnav-search-placeholder")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Notifications$/i }));
    expect(screen.getByTestId("topnav-notifications-placeholder")).toBeInTheDocument();
  });

  it("invokes onChangePassword from the avatar menu", async () => {
    apiClient.get.mockResolvedValueOnce({ data: { items: [] } });
    const { props } = renderTopNav();
    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /Account menu/i }));
    const menu = screen.getByTestId("topnav-avatar-menu");
    fireEvent.click(within(menu).getByRole("menuitem", { name: /Change password/i }));
    expect(props.onChangePassword).toHaveBeenCalledTimes(1);
  });
});

