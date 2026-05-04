/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TenantSidebar } from "@/features/workspace/TenantSidebar";

const ORDERED_LABELS = [
  "Overview",
  "Action Required",
  "Invoices",
  "Vendors",
  "Payments",
  "Reconciliation",
  "Bank Statements",
  "TDS Dashboard",
  "Tally Export",
  "Tally Sync",
  "Mailboxes",
  "Inbox Routing",
  "Client Orgs",
  "Config"
];

const SECTION_EYEBROWS = ["Banking", "Compliance", "Setup"];

function renderSidebar(overrides: Partial<React.ComponentProps<typeof TenantSidebar>> = {}) {
  const props: React.ComponentProps<typeof TenantSidebar> = {
    tenantName: "Khan & Associates, CA",
    activeTab: "overview",
    activeStandaloneRoute: null,
    onTabChange: jest.fn(),
    onStandaloneRouteChange: jest.fn(),
    canViewTenantConfig: true,
    canViewConnections: true,
    invoiceActionRequiredCount: 0,
    ...overrides
  };
  const utils = render(<TenantSidebar {...props} />);
  return { ...utils, props };
}

describe("TenantSidebar — bundle-aligned IA", () => {
  it("renders brand + tenant subtitle under brand", () => {
    renderSidebar();
    expect(screen.getByText("LedgerBuddy")).toBeInTheDocument();
    expect(screen.getByText("Khan & Associates, CA")).toBeInTheDocument();
  });

  it("does not render tenant subtitle when tenant name is blank", () => {
    renderSidebar({ tenantName: "   " });
    expect(screen.queryByText("Khan & Associates, CA")).not.toBeInTheDocument();
  });

  it("renders all items in bundle order across all sections", () => {
    renderSidebar();
    const nav = screen.getByRole("navigation", { name: "Primary" });
    const labels = within(nav).getAllByRole("button").map((btn) => btn.querySelector(".sidebar-link-label")?.textContent);
    expect(labels).toEqual(ORDERED_LABELS);
  });

  it("renders the three section eyebrows: Banking, Compliance, Setup", () => {
    renderSidebar();
    for (const eyebrow of SECTION_EYEBROWS) {
      expect(screen.getByRole("heading", { name: eyebrow, level: 6 })).toBeInTheDocument();
    }
  });

  it("never renders a 'Soon' pill on any sidebar item (bundle treats placeholders as first-class)", () => {
    renderSidebar();
    expect(screen.queryByText(/Soon/i)).not.toBeInTheDocument();
  });

  it("marks Invoices as aria-current=page when activeTab is dashboard", () => {
    renderSidebar({ activeTab: "dashboard" });
    const invoicesBtn = screen.getByRole("button", { name: /Invoices/ });
    expect(invoicesBtn).toHaveAttribute("aria-current", "page");
    const overviewBtn = screen.getByRole("button", { name: /^Overview/ });
    expect(overviewBtn).not.toHaveAttribute("aria-current");
  });

  it("calls onTabChange with the mapped tab when a tab-backed item is clicked", () => {
    const { props } = renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: /Invoices/ }));
    expect(props.onTabChange).toHaveBeenCalledWith("dashboard");
    fireEvent.click(screen.getByRole("button", { name: /Tally Export/ }));
    expect(props.onTabChange).toHaveBeenCalledWith("exports");
    fireEvent.click(screen.getByRole("button", { name: /Config/ }));
    expect(props.onTabChange).toHaveBeenCalledWith("config");
  });

  it("calls onStandaloneRouteChange for hash-backed items (Vendors, Payments, Tally Sync, etc.)", () => {
    const { props } = renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: /Vendors/ }));
    expect(props.onStandaloneRouteChange).toHaveBeenCalledWith("vendors");
    fireEvent.click(screen.getByRole("button", { name: /Payments/ }));
    expect(props.onStandaloneRouteChange).toHaveBeenCalledWith("payments");
    fireEvent.click(screen.getByRole("button", { name: /Tally Sync/ }));
    expect(props.onStandaloneRouteChange).toHaveBeenCalledWith("tallySync");
    fireEvent.click(screen.getByRole("button", { name: /Inbox Routing/ }));
    expect(props.onStandaloneRouteChange).toHaveBeenCalledWith("inboxRouting");
    fireEvent.click(screen.getByRole("button", { name: /Client Orgs/ }));
    expect(props.onStandaloneRouteChange).toHaveBeenCalledWith("clientOrgs");
    fireEvent.click(screen.getByRole("button", { name: /Bank Statements/ }));
    expect(props.onStandaloneRouteChange).toHaveBeenCalledWith("bankStatements");
  });

  it("routes Action Required to the actionRequired standalone hash route", () => {
    const { props } = renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: /Action Required/ }));
    expect(props.onStandaloneRouteChange).toHaveBeenCalledWith("actionRequired");
    expect(props.onTabChange).not.toHaveBeenCalled();
  });

  it("disables Config when canViewTenantConfig is false", () => {
    renderSidebar({ canViewTenantConfig: false });
    const configBtn = screen.getByRole("button", { name: /Config/ });
    expect(configBtn).toBeDisabled();
    expect(configBtn).toHaveAttribute("aria-disabled", "true");
  });

  it("disables Reconciliation and Bank Statements when canViewConnections is false", () => {
    renderSidebar({ canViewConnections: false });
    expect(screen.getByRole("button", { name: /Reconciliation/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Bank Statements/ })).toBeDisabled();
  });

  it("renders the action-required count badge on Action Required when > 0", () => {
    renderSidebar({ invoiceActionRequiredCount: 7 });
    const btn = screen.getByRole("button", { name: /Action Required/ });
    expect(within(btn).getByText("7")).toBeInTheDocument();
  });

  it("extends aria-label with the action-required count when > 0 (a11y for SR users)", () => {
    renderSidebar({ invoiceActionRequiredCount: 7 });
    expect(screen.getByRole("button", { name: "Action Required, 7 action required" })).toBeInTheDocument();
  });

  it("calls onStandaloneRouteChange('reportsTds') when TDS Dashboard is clicked", () => {
    const { props } = renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: /TDS Dashboard/ }));
    expect(props.onStandaloneRouteChange).toHaveBeenCalledWith("reportsTds");
    expect(props.onTabChange).not.toHaveBeenCalled();
  });

  it("marks TDS Dashboard as aria-current=page when activeStandaloneRoute is 'reportsTds'", () => {
    renderSidebar({ activeStandaloneRoute: "reportsTds", activeTab: "overview" });
    const btn = screen.getByRole("button", { name: /TDS Dashboard/ });
    expect(btn).toHaveAttribute("aria-current", "page");
  });

  it("does not mark any tab item as active while a standalone route is open", () => {
    renderSidebar({ activeStandaloneRoute: "vendors", activeTab: "overview" });
    expect(screen.getByRole("button", { name: /^Overview/ })).not.toHaveAttribute("aria-current");
  });
});
