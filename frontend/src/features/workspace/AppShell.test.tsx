/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AppShell } from "@/features/workspace/AppShell";

function renderShell(overrides: Partial<React.ComponentProps<typeof AppShell>> = {}) {
  const props: React.ComponentProps<typeof AppShell> = {
    activeTab: "overview",
    onTabChange: jest.fn(),
    canViewTenantConfig: true,
    canViewConnections: true,
    invoiceActionRequiredCount: 0,
    topNav: <header data-testid="topnav">TopNav</header>,
    subNav: null,
    migration: null,
    onDismissMigration: jest.fn(),
    children: <div data-testid="page-content">Page</div>,
    ...overrides
  };
  return { props, ...render(<AppShell {...props} />) };
}

describe("AppShell", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the primary sidebar, topnav, and main landmarks", () => {
    renderShell();
    expect(screen.getByRole("navigation", { name: /primary/i })).toBeInTheDocument();
    expect(screen.getByTestId("topnav")).toBeInTheDocument();
    expect(screen.getByRole("main")).toContainElement(screen.getByTestId("page-content"));
  });

  it("highlights the sidebar item matching activeTab via aria-current", () => {
    renderShell({ activeTab: "dashboard" });
    const nav = screen.getByRole("navigation", { name: /primary/i });
    const invoicesBtn = within(nav).getByRole("button", { name: /Invoices/ });
    expect(invoicesBtn).toHaveAttribute("aria-current", "page");
  });

  it("invokes onTabChange when a sidebar item is clicked", () => {
    const { props } = renderShell();
    fireEvent.click(screen.getByRole("button", { name: /Exports/ }));
    expect(props.onTabChange).toHaveBeenCalledWith("exports");
  });

  it("renders the URL migration banner when migration prop is provided", () => {
    const onDismissMigration = jest.fn();
    renderShell({
      migration: { oldPath: "?tab=dashboard", newPath: "#/invoices" },
      onDismissMigration
    });
    expect(screen.getByRole("status")).toHaveTextContent("#/invoices");

    fireEvent.click(screen.getByRole("button", { name: /dismiss url migration/i }));
    expect(onDismissMigration).toHaveBeenCalledTimes(1);
  });

  it("does not render the banner when migration is null", () => {
    renderShell({ migration: null });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("renders subNav between topnav and main when provided", () => {
    renderShell({ subNav: <div data-testid="subnav">SubNav</div> });
    expect(screen.getByTestId("subnav")).toBeInTheDocument();
  });

  it("exposes the main landmark with id=main-content for skip-link/landmark navigation", () => {
    renderShell();
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toHaveAttribute("tabIndex", "-1");
  });
});
