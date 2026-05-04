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
      title="Activity"
      icon="schedule"
      collapsed={collapsed}
      onToggle={onToggle}
      subtitle={selectedTenant ? selectedTenant.tenantName : "select a tenant"}
      actions={
        <button type="button" className="pa-btn pa-btn-ghost pa-btn-sm" onClick={onRefresh}>
          <span className="material-symbols-outlined">refresh</span>
          Refresh
        </button>
      }
    >
      {selectedTenant ? (
        <div className="pa-card-body">
          <div className="pa-detail-grid">
            <div className="pa-detail-cell">
              <div className="label">Tenant</div>
              <div className="value" data-testid="platform-activity-tenant">{selectedTenant.tenantName}</div>
            </div>
            <div className="pa-detail-cell">
              <div className="label">Onboarding</div>
              <div className="value">
                <Badge
                  tone={ONBOARDING_TONE[selectedTenant.onboardingStatus].tone}
                  icon={ONBOARDING_TONE[selectedTenant.onboardingStatus].icon}
                  size="sm"
                >
                  {selectedTenant.onboardingStatus}
                </Badge>
              </div>
            </div>
            <div className="pa-detail-cell">
              <div className="label">Users</div>
              <div className="value">{selectedTenant.userCount}</div>
            </div>
            <div className="pa-detail-cell">
              <div className="label">Documents</div>
              <div className="value">{selectedTenant.totalDocuments.toLocaleString()}</div>
            </div>
            <div className="pa-detail-cell">
              <div className="label">Approved</div>
              <div className="value">{selectedTenant.approvedDocuments.toLocaleString()}</div>
            </div>
            <div className="pa-detail-cell">
              <div className="label">Exported</div>
              <div className="value">{selectedTenant.exportedDocuments.toLocaleString()}</div>
            </div>
            <div className="pa-detail-cell">
              <div className="label">Failed</div>
              <div className="value pa-detail-cell-failed" data-tone={selectedTenant.failedDocuments > 0 ? "warn" : undefined}>
                {selectedTenant.failedDocuments}
              </div>
            </div>
            <div className="pa-detail-cell">
              <div className="label">Gmail connection</div>
              <div className="value">
                <Badge
                  tone={GMAIL_TONE[selectedTenant.gmailConnectionState].tone}
                  icon={GMAIL_TONE[selectedTenant.gmailConnectionState].icon}
                  size="sm"
                >
                  {GMAIL_TONE[selectedTenant.gmailConnectionState].label}
                </Badge>
              </div>
            </div>
            <div className="pa-detail-cell">
              <div className="label">Last ingested</div>
              <div className="value">
                {selectedTenant.lastIngestedAt ? new Date(selectedTenant.lastIngestedAt).toLocaleString() : "—"}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="pa-empty">
          <span className="material-symbols-outlined pa-empty-icon">visibility_off</span>
          <div className="pa-empty-title">No tenant selected</div>
          <div>Select a tenant from the table above to view detailed platform activity.</div>
        </div>
      )}
    </PlatformSection>
  );
}
