import type { PlatformTenantUsageSummary } from "@/api";
import { Badge } from "@/components/ds";
import { PlatformSection } from "@/features/platform-admin/PlatformSection";

interface PlatformUsageOverviewSectionProps {
  usage: PlatformTenantUsageSummary[];
  selectedTenantId: string | null;
  collapsed: boolean;
  onToggle: () => void;
  onRefresh: () => void;
  onSelectTenant: (tenantId: string) => void;
  onToggleEnabled: (tenantId: string, enabled: boolean) => void;
}

const GMAIL_BRIDGE: Record<PlatformTenantUsageSummary["gmailConnectionState"], "online" | "lagging" | "offline"> = {
  CONNECTED: "online",
  NEEDS_REAUTH: "lagging",
  DISCONNECTED: "offline"
};

function tenantInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function PlatformUsageOverviewSection({
  usage,
  selectedTenantId,
  collapsed,
  onToggle,
  onRefresh,
  onSelectTenant,
  onToggleEnabled
}: PlatformUsageOverviewSectionProps) {
  return (
    <PlatformSection
      title="Platform Tenant Usage Overview"
      icon="groups"
      collapsed={collapsed}
      onToggle={onToggle}
      subtitle={`${usage.length} tenants`}
      actions={
        <button type="button" className="app-button app-button-secondary" onClick={onRefresh}>
          <span className="material-symbols-outlined">refresh</span>
          Refresh Usage
        </button>
      }
    >
      <div className="pa-card-body flush scroll-x">
        <table data-testid="platform-usage-table" className="pa-tenants-table">
          <thead>
            <tr>
              <th>Tenant</th>
              <th>Admin Email</th>
              <th>Onboarding</th>
              <th className="align-right">Users</th>
              <th className="align-right">Documents</th>
              <th className="align-right">Approved</th>
              <th className="align-right">Exported</th>
              <th className="align-right">Needs Review</th>
              <th className="align-right">Failed</th>
              <th className="align-right">OCR Tokens</th>
              <th className="align-right">SLM Tokens</th>
              <th>Gmail</th>
              <th className="align-right">Last Ingested</th>
              <th>State</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {usage.map((entry) => {
              const bridge = GMAIL_BRIDGE[entry.gmailConnectionState];
              const isActive = entry.tenantId === selectedTenantId;
              return (
                <tr
                  key={entry.tenantId}
                  className={isActive ? "row-active" : ""}
                  onClick={() => onSelectTenant(entry.tenantId)}
                >
                  <td>
                    <div className="pa-tenant-cell">
                      <div className="pa-tenant-avatar" aria-hidden="true">{tenantInitials(entry.tenantName)}</div>
                      <div>
                        <div className="pa-tenant-name">{entry.tenantName}</div>
                        <div className="pa-tenant-meta">{entry.adminEmail ?? "no admin"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="mono-cell">{entry.adminEmail ?? "-"}</td>
                  <td>
                    <Badge tone={entry.onboardingStatus === "completed" ? "success" : "warning"} size="sm">
                      {entry.onboardingStatus}
                    </Badge>
                  </td>
                  <td className="num-cell">{entry.userCount}</td>
                  <td className="num-cell">{entry.totalDocuments.toLocaleString()}</td>
                  <td className="num-cell">{entry.approvedDocuments.toLocaleString()}</td>
                  <td className="num-cell">{entry.exportedDocuments.toLocaleString()}</td>
                  <td className="num-cell">{entry.needsReviewDocuments.toLocaleString()}</td>
                  <td className={`num-cell ${entry.failedDocuments > 0 ? "pa-failure-warn" : "pa-failure-muted"}`}>
                    {entry.failedDocuments || "—"}
                  </td>
                  <td className="num-cell">{entry.ocrTokensTotal.toLocaleString()}</td>
                  <td className="num-cell">{entry.slmTokensTotal.toLocaleString()}</td>
                  <td>
                    <span className={`pa-bridge-cell pa-bridge-${bridge}`}>
                      <span className="pa-bridge-cell-dot" aria-hidden="true" />
                      {bridge}
                    </span>
                  </td>
                  <td className="mono-cell align-right">{entry.lastIngestedAt ? new Date(entry.lastIngestedAt).toLocaleString() : "-"}</td>
                  <td>
                    <span className={`pa-state-pill pa-state-${entry.enabled ? "active" : "disabled"}`}>
                      <span className="pa-state-dot" aria-hidden="true" />
                      {entry.enabled ? "active" : "disabled"}
                    </span>
                  </td>
                  <td>
                    <span className="pa-row-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className={`pa-action-icon-btn ${entry.enabled ? "is-disable" : "is-enable"}`}
                        title={entry.enabled ? "Disable" : "Enable"}
                        onClick={() => onToggleEnabled(entry.tenantId, !entry.enabled)}
                      >
                        <span className="material-symbols-outlined">{entry.enabled ? "pause" : "play_arrow"}</span>
                      </button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {usage.length === 0 ? <div className="pa-empty">No tenants yet.</div> : null}
      </div>
      <p className="muted pa-card-body">This view is usage-only. Invoice content is not exposed at platform scope.</p>
    </PlatformSection>
  );
}
