import { useMemo } from "react";
import { useActiveClientOrg } from "@/hooks/useActiveClientOrg";

export interface ClientOrgOption {
  id: string;
  companyName: string;
}

interface TenantBadgeProps {
  tenantName: string;
}

/**
 * Displays the CA firm (tenant) name in the topbar.
 * Always visible for any authenticated user — anchors the upper level
 * of the {tenantId, clientOrgId} composite-key hierarchy.
 */
export function TenantBadge({ tenantName }: TenantBadgeProps) {
  const label = tenantName.trim().length > 0 ? tenantName : "—";
  return (
    <span
      className="workspace-hierarchy-badge workspace-hierarchy-badge-tenant"
      data-testid="tenant-badge"
      title={`CA firm: ${label}`}
      aria-label={`Tenant ${label}`}
    >
      <span className="material-symbols-outlined workspace-hierarchy-badge-icon" aria-hidden="true">
        domain
      </span>
      {label}
    </span>
  );
}

interface ActiveRealmBadgeProps {
  /** Tenant's known ClientOrganization rows. Undefined = still loading. */
  clientOrgs?: ClientOrgOption[];
  /**
   * Invoked when the user clicks the "Select a client" CTA. The realm switcher
   * (#152) and onboarding (#150) wire this up; for now it's a noop fallback.
   */
  onOpenSwitcher?: () => void;
}

/**
 * Displays the active client realm (ClientOrganization.companyName) in the topbar.
 * When no realm is selected, renders a CTA button that opens the switcher
 * (TODO: wire to realm switcher in #152, fall through to onboarding #150 if empty).
 */
export function ActiveRealmBadge({ clientOrgs, onOpenSwitcher }: ActiveRealmBadgeProps) {
  const { activeClientOrgId } = useActiveClientOrg();

  const activeName = useMemo(() => {
    if (!activeClientOrgId || !clientOrgs) return null;
    const match = clientOrgs.find((org) => org.id === activeClientOrgId);
    return match?.companyName ?? null;
  }, [activeClientOrgId, clientOrgs]);

  if (activeClientOrgId === null) {
    // Until #152 wires the realm switcher, the CTA is a no-op. Render it
    // as a disabled button (aria-disabled, no click handler) so the user
    // gets accurate affordance instead of a silent dead button.
    const switcherReady = typeof onOpenSwitcher === "function";
    return (
      <button
        type="button"
        className="workspace-hierarchy-badge workspace-hierarchy-badge-realm-empty"
        // TODO(#152): open realm switcher; fall through to onboarding (#150) when no orgs exist.
        onClick={switcherReady ? onOpenSwitcher : undefined}
        disabled={!switcherReady}
        aria-disabled={!switcherReady}
        title={switcherReady ? undefined : "Realm switcher coming soon"}
        data-testid="select-client-cta"
        aria-label="Select a client"
      >
        <span className="material-symbols-outlined workspace-hierarchy-badge-icon" aria-hidden="true">
          add_business
        </span>
        Select a client
      </button>
    );
  }

  const isLoading = clientOrgs === undefined;
  const label = isLoading ? "Loading…" : activeName ?? activeClientOrgId;

  return (
    <span
      className="workspace-hierarchy-badge workspace-hierarchy-badge-realm"
      data-testid="active-realm-badge"
      data-loading={isLoading ? "true" : undefined}
      title={`Active client: ${label}`}
      aria-label={`Active client ${label}`}
    >
      <span className="material-symbols-outlined workspace-hierarchy-badge-icon" aria-hidden="true">
        business_center
      </span>
      {label}
    </span>
  );
}
