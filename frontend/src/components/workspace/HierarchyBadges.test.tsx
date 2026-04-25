/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TenantBadge, ActiveRealmBadge } from "@/components/workspace/HierarchyBadges";
import {
  ACTIVE_CLIENT_ORG_QUERY_PARAM,
  ACTIVE_CLIENT_ORG_STORAGE_KEY,
  setActiveClientOrgId
} from "@/hooks/useActiveClientOrg";

function clearActiveRealm() {
  window.history.replaceState({}, "", "/");
  window.localStorage.clear();
}

describe("components/workspace/TenantBadge", () => {
  it("renders the tenant (CA firm) name passed via props", () => {
    render(<TenantBadge tenantName="Mahir & Co." />);
    const badge = screen.getByTestId("tenant-badge");
    expect(badge).toHaveTextContent("Mahir & Co.");
    expect(badge).toHaveAttribute("title", "CA firm: Mahir & Co.");
    expect(badge).toHaveAttribute("aria-label", "Tenant Mahir & Co.");
  });

  it("falls back to em-dash placeholder when tenant name is blank", () => {
    render(<TenantBadge tenantName="   " />);
    expect(screen.getByTestId("tenant-badge")).toHaveTextContent("—");
  });

  it("uses className-driven styling (no inline styles)", () => {
    render(<TenantBadge tenantName="Acme" />);
    const badge = screen.getByTestId("tenant-badge");
    expect(badge).toHaveClass("workspace-hierarchy-badge");
    expect(badge).toHaveClass("workspace-hierarchy-badge-tenant");
    expect(badge.getAttribute("style")).toBeFalsy();
  });
});

describe("components/workspace/ActiveRealmBadge", () => {
  beforeEach(clearActiveRealm);
  afterEach(clearActiveRealm);

  it("renders the matching companyName when an active realm is set", () => {
    setActiveClientOrgId("org-1");
    render(
      <ActiveRealmBadge
        clientOrgs={[
          { id: "org-1", companyName: "Sharma Textiles" },
          { id: "org-2", companyName: "Bose Steel" }
        ]}
      />
    );
    const badge = screen.getByTestId("active-realm-badge");
    expect(badge).toHaveTextContent("Sharma Textiles");
    expect(badge).toHaveAttribute("title", "Active client: Sharma Textiles");
  });

  it("renders the 'Select a client' CTA button when no realm is active", () => {
    const onOpenSwitcher = jest.fn();
    render(<ActiveRealmBadge clientOrgs={[]} onOpenSwitcher={onOpenSwitcher} />);
    const cta = screen.getByTestId("select-client-cta");
    expect(cta.tagName).toBe("BUTTON");
    expect(cta).toHaveTextContent("Select a client");
    fireEvent.click(cta);
    expect(onOpenSwitcher).toHaveBeenCalledTimes(1);
  });

  it("renders a loading state while clientOrgs is undefined and a realm is active", () => {
    setActiveClientOrgId("org-1");
    render(<ActiveRealmBadge clientOrgs={undefined} />);
    const badge = screen.getByTestId("active-realm-badge");
    expect(badge).toHaveAttribute("data-loading", "true");
    expect(badge).toHaveTextContent("Loading");
  });

  it("falls back to the raw clientOrgId when no matching org is in the list", () => {
    setActiveClientOrgId("org-missing");
    render(<ActiveRealmBadge clientOrgs={[{ id: "org-1", companyName: "Sharma" }]} />);
    expect(screen.getByTestId("active-realm-badge")).toHaveTextContent("org-missing");
  });

  it("reads the active id from the URL query parameter (URL > localStorage)", () => {
    window.localStorage.setItem(ACTIVE_CLIENT_ORG_STORAGE_KEY, "from-storage");
    window.history.replaceState({}, "", `/?${ACTIVE_CLIENT_ORG_QUERY_PARAM}=from-url`);
    render(
      <ActiveRealmBadge
        clientOrgs={[
          { id: "from-url", companyName: "URL-driven Co." },
          { id: "from-storage", companyName: "Storage-driven Co." }
        ]}
      />
    );
    expect(screen.getByTestId("active-realm-badge")).toHaveTextContent("URL-driven Co.");
  });

  it("falls back to localStorage when the URL has no active id", () => {
    window.localStorage.setItem(ACTIVE_CLIENT_ORG_STORAGE_KEY, "from-storage");
    render(
      <ActiveRealmBadge
        clientOrgs={[{ id: "from-storage", companyName: "Storage-driven Co." }]}
      />
    );
    expect(screen.getByTestId("active-realm-badge")).toHaveTextContent("Storage-driven Co.");
  });
});
