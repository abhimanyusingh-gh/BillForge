import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Sidebar } from "@/features/workspace/sidebar/Sidebar";
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

function seedTenant() {
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
  fetchActionRequiredCountMock.mockResolvedValue(0);
  fetchTriageCountMock.mockResolvedValue(0);
  act(() => {
    useSessionStore.getState().clearSession();
    useSessionStore.setState({ sidebarCollapsed: false });
  });
  seedTenant();
  window.location.hash = "";
});

afterEach(() => {
  act(() => {
    useSessionStore.getState().clearSession();
  });
});

describe("Sidebar", () => {
  it("renders all primary nav items with bundle labels", async () => {
    render(<Sidebar activeRoute="/" />);
    expect(screen.getByRole("button", { name: /Overview/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Action Required/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Invoices/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Vendors/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reconciliation/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Inbox Routing/ })).toBeInTheDocument();
    expect(screen.getByText("Banking")).toBeInTheDocument();
    expect(screen.getByText("Compliance")).toBeInTheDocument();
    expect(screen.getByText("Setup")).toBeInTheDocument();
    await waitFor(() => expect(fetchActionRequiredCountMock).toHaveBeenCalled());
  });

  it("marks the active route with aria-current page", async () => {
    render(<Sidebar activeRoute="/invoices" />);
    const invoices = screen.getByRole("button", { name: /Invoices/ });
    expect(invoices).toHaveAttribute("aria-current", "page");
    const overview = screen.getByRole("button", { name: /Overview/ });
    expect(overview).not.toHaveAttribute("aria-current");
    await waitFor(() => expect(fetchActionRequiredCountMock).toHaveBeenCalled());
  });

  it("navigates to the item route on click", async () => {
    render(<Sidebar activeRoute="/" />);
    fireEvent.click(screen.getByRole("button", { name: /Vendors/ }));
    expect(window.location.hash).toBe("#/vendors");
    await waitFor(() => expect(fetchActionRequiredCountMock).toHaveBeenCalled());
  });

  it("renders BE-driven counter badges when totals are positive", async () => {
    fetchActionRequiredCountMock.mockResolvedValue(7);
    fetchTriageCountMock.mockResolvedValue(3);
    render(<Sidebar activeRoute="/" />);
    await waitFor(() => {
      expect(screen.getByText("7")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });
});
