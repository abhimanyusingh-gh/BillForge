import type { PlatformTenantUsageSummary } from "@/api";
import { Badge } from "@/components/ds";
import { PlatformSection } from "@/features/platform-admin/PlatformSection";

interface PlatformActivityMonitorProps {
  selectedTenant: PlatformTenantUsageSummary | null;
  collapsed: boolean;
  onToggle: () => void;
  onRefresh: () => void;
}

const ONBOARDING_TONE = {
  completed: { tone: "success", icon: "check_circle" },
  pending: { tone: "warning", icon: "hourglass_top" }
} as const;

const GMAIL_TONE = {
  CONNECTED: { tone: "success", label: "Connected", icon: "check_circle" },
  NEEDS_REAUTH: { tone: "warning", label: "Needs reauth", icon: "warning" },
  DISCONNECTED: { tone: "neutral", label: "Disconnected", icon: "link_off" }
} as const;

export function PlatformActivityMonitor({
  selectedTenant,
  collapsed,
  onToggle,
  onRefresh
}: PlatformActivityMonitorProps) {
  return (
    <PlatformSection
      title="Activity Monitor"
      icon="schedule"
      collapsed={collapsed}
      onToggle={onToggle}
      subtitle={selectedTenant ? selectedTenant.tenantName : "select a tenant"}
      actions={
        <button type="button" className="app-button app-button-secondary" onClick={onRefresh}>
          <span className="material-symbols-outlined">refresh</span>
          Refresh
        </button>
      }
    >
      {selectedTenant ? (
        <div className="pa-card-body">
          <p className="muted" data-testid="platform-activity-tenant">
            Selected tenant: <strong>{selectedTenant.tenantName}</strong>
          </p>
          <div className="platform-stats-grid">
            <article className="platform-stat-tile">
              <span className="platform-stat-label">Onboarding</span>
              <span className="platform-stat-value">
                <Badge
                  tone={ONBOARDING_TONE[selectedTenant.onboardingStatus].tone}
                  icon={ONBOARDING_TONE[selectedTenant.onboardingStatus].icon}
                  size="sm"
                >
                  {selectedTenant.onboardingStatus}
                </Badge>
              </span>
            </article>
            <article className="platform-stat-tile">
              <span className="platform-stat-label">Users</span>
              <span className="platform-stat-value">{selectedTenant.userCount}</span>
            </article>
            <article className="platform-stat-tile">
              <span className="platform-stat-label">Documents</span>
              <span className="platform-stat-value">{selectedTenant.totalDocuments}</span>
            </article>
            <article className="platform-stat-tile">
              <span className="platform-stat-label">Approved</span>
              <span className="platform-stat-value">{selectedTenant.approvedDocuments}</span>
            </article>
            <article className="platform-stat-tile">
              <span className="platform-stat-label">Exported</span>
              <span className="platform-stat-value">{selectedTenant.exportedDocuments}</span>
            </article>
            <article className="platform-stat-tile" data-tone={selectedTenant.failedDocuments > 0 ? "warn" : undefined}>
              <span className="platform-stat-label">Failed</span>
              <span className={`platform-stat-value ${selectedTenant.failedDocuments > 0 ? "platform-stat-value-alert" : ""}`}>
                {selectedTenant.failedDocuments}
              </span>
            </article>
          </div>
          <div className="pa-section-h">Connection</div>
          <div className="detail-grid">
            <p>
              <span>Gmail Connection</span>
              <strong>
                <Badge
                  tone={GMAIL_TONE[selectedTenant.gmailConnectionState].tone}
                  icon={GMAIL_TONE[selectedTenant.gmailConnectionState].icon}
                  size="sm"
                >
                  {GMAIL_TONE[selectedTenant.gmailConnectionState].label}
                </Badge>
              </strong>
            </p>
            <p>
              <span>Last Ingested</span>
              <strong>{selectedTenant.lastIngestedAt ? new Date(selectedTenant.lastIngestedAt).toLocaleString() : "-"}</strong>
            </p>
          </div>
        </div>
      ) : (
        <div className="pa-activity-empty">
          <div className="pa-activity-empty-icon">
            <span className="material-symbols-outlined">visibility_off</span>
          </div>
          <h4 className="pa-activity-empty-title">No Tenant Selected</h4>
          <p>Select a tenant from the table above to view detailed platform activity for that tenant.</p>
        </div>
      )}
    </PlatformSection>
  );
}
