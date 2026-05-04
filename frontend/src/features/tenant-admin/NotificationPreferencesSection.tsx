import { useCallback, useEffect, useState } from "react";
import {
  fetchNotificationConfig,
  saveNotificationConfig,
  fetchNotificationLog,
  type NotificationConfig,
  type NotificationLogEvent,
  type NotificationLogResponse
} from "@/api/admin";
import { getUserFacingErrorMessage } from "@/lib/common/apiError";
import type { TenantUser } from "@/types";

interface NotificationPreferencesSectionProps {
  tenantUsers: TenantUser[];
}

const RECIPIENT_OPTIONS: Array<{ value: NotificationConfig["primaryRecipientType"]; label: string }> = [
  { value: "integration_creator", label: "Integration creator" },
  { value: "all_tenant_admins", label: "All tenant admins" },
  { value: "specific_user", label: "Specific user" }
];

const DELIVERY_STATUS = {
  delivered: "delivered",
  failed: "failed",
  pending: "pending",
  skipped: "skipped"
} as const;

type DeliveryStatus = keyof typeof DELIVERY_STATUS;

function deriveDeliveryStatus(event: NotificationLogEvent): DeliveryStatus {
  if (event.skippedReason) return "skipped";
  if (event.delivered) return "delivered";
  if (event.deliveryFailed) return "failed";
  return "pending";
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function formatEventType(eventType: string): string {
  return eventType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function NotificationPreferencesSection({ tenantUsers }: NotificationPreferencesSectionProps) {
  const [config, setConfig] = useState<NotificationConfig>({
    mailboxReauthEnabled: true,
    escalationEnabled: true,
    inAppEnabled: false,
    primaryRecipientType: "integration_creator",
    specificRecipientUserId: null
  });
  const [savedConfig, setSavedConfig] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [logExpanded, setLogExpanded] = useState(false);
  const [logData, setLogData] = useState<NotificationLogResponse | null>(null);
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [logPage, setLogPage] = useState(1);

  const dirty = JSON.stringify(config) !== savedConfig;

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const loaded = await fetchNotificationConfig();
      const normalized: NotificationConfig = {
        mailboxReauthEnabled: loaded.mailboxReauthEnabled ?? true,
        escalationEnabled: loaded.escalationEnabled ?? true,
        inAppEnabled: loaded.inAppEnabled ?? false,
        primaryRecipientType: loaded.primaryRecipientType ?? "integration_creator",
        specificRecipientUserId: loaded.specificRecipientUserId ?? null
      };
      setConfig(normalized);
      setSavedConfig(JSON.stringify(normalized));
    } catch (err) {
      setLoadError(getUserFacingErrorMessage(err, "Failed to load notification preferences."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleSave = useCallback(async () => {
    setSaveError(null);
    setSaveSuccess(false);
    setSaving(true);
    try {
      const updated = await saveNotificationConfig(config);
      const normalized: NotificationConfig = {
        mailboxReauthEnabled: updated.mailboxReauthEnabled ?? true,
        escalationEnabled: updated.escalationEnabled ?? true,
        inAppEnabled: updated.inAppEnabled ?? false,
        primaryRecipientType: updated.primaryRecipientType ?? "integration_creator",
        specificRecipientUserId: updated.specificRecipientUserId ?? null
      };
      setConfig(normalized);
      setSavedConfig(JSON.stringify(normalized));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(getUserFacingErrorMessage(err, "Failed to save notification preferences."));
    } finally {
      setSaving(false);
    }
  }, [config]);

  const loadLog = useCallback(async (page: number) => {
    setLogLoading(true);
    setLogError(null);
    try {
      const data = await fetchNotificationLog(page);
      setLogData(data);
      setLogPage(page);
    } catch (err) {
      setLogError(getUserFacingErrorMessage(err, "Failed to load notification log."));
    } finally {
      setLogLoading(false);
    }
  }, []);

  const handleToggleLog = useCallback(() => {
    const next = !logExpanded;
    setLogExpanded(next);
    if (next && !logData) {
      loadLog(1);
    }
  }, [logExpanded, logData, loadLog]);

  if (loading) {
    return (
      <div className="editor-card">
        <p className="skeleton-row">Loading notification preferences...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="editor-card">
        <p className="field-error">{loadError}</p>
        <button type="button" className="app-button app-button-secondary" onClick={loadConfig}>Retry</button>
      </div>
    );
  }

  const logTotalPages = logData ? Math.ceil(logData.total / logData.limit) : 0;

  return (
    <div className="editor-card">
      <div className="editor-header">
        <h3>Notification Preferences</h3>
      </div>

      <p className="sub">
        Control which notifications are sent and who receives them.
      </p>

      <div className="field-row">
        <label className="field">
          <span className="toggle-switch">
            <input
              type="checkbox"
              checked={config.mailboxReauthEnabled}
              onChange={() => setConfig((prev) => ({ ...prev, mailboxReauthEnabled: !prev.mailboxReauthEnabled }))}
              disabled={saving}
              aria-label="Mailbox reauth notifications"
            />
            <span className="toggle-track" />
          </span>
          Mailbox reauth notifications
        </label>

        <label className="field">
          <span className="toggle-switch">
            <input
              type="checkbox"
              checked={config.escalationEnabled}
              onChange={() => setConfig((prev) => ({ ...prev, escalationEnabled: !prev.escalationEnabled }))}
              disabled={saving}
              aria-label="Escalation notifications"
            />
            <span className="toggle-track" />
          </span>
          Escalation notifications
        </label>

        <label
          className="field field"
          title="Coming soon"
        >
          <span className="toggle-switch">
            <input
              type="checkbox"
              checked={false}
              disabled
              aria-label="In-app notifications (coming soon)"
            />
            <span className="toggle-track" />
          </span>
          In-app notifications (coming soon)
        </label>
      </div>

      <div className="panel">
        <label className="field-row">
          <span className="field">Primary notification recipient</span>
          <select
            value={config.primaryRecipientType}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                primaryRecipientType: e.target.value as NotificationConfig["primaryRecipientType"],
                specificRecipientUserId: e.target.value === "specific_user" ? prev.specificRecipientUserId : null
              }))
            }
            disabled={saving}
            aria-label="Primary notification recipient"
            className="input"
          >
            {RECIPIENT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        {config.primaryRecipientType === "specific_user" ? (
          <label className="field-row">
            <span className="field">Select user</span>
            <select
              value={config.specificRecipientUserId ?? ""}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, specificRecipientUserId: e.target.value || null }))
              }
              disabled={saving}
              aria-label="Specific user selector"
              className="input"
            >
              <option value="">-- Select a user --</option>
              {tenantUsers.map((user) => (
                <option key={user.userId} value={user.userId}>{user.email}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {saveError ? (
        <div className="alert warn" role="alert">{saveError}</div>
      ) : null}
      {saveSuccess ? (
        <div className="alert ok">Notification preferences saved.</div>
      ) : null}

      {dirty ? (
        <div className="tc-save-bar">
          <button type="button" className="app-button app-button-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      ) : null}

      <div className="">
        <button
          type="button"
          onClick={handleToggleLog}
          className="btn ghost"
          aria-expanded={logExpanded}
          aria-label="Toggle notification log"
        >
          Notification Log {logExpanded ? "▴" : "▾"}
        </button>

        {logExpanded ? (
          <div className="panel">
            {logLoading ? (
              <p className="skeleton-row">Loading notification log...</p>
            ) : logError ? (
              <div>
                <p className="field-error">{logError}</p>
                <button type="button" className="app-button app-button-secondary" onClick={() => loadLog(logPage)}>Retry</button>
              </div>
            ) : logData && logData.items.length === 0 ? (
              <p className="skeleton-row">No notification events recorded yet.</p>
            ) : logData ? (
              <>
                <div className="list-scroll" style={{ maxHeight: "300px" }}>
                  <table className="lbtable">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Event Type</th>
                        <th>Recipient</th>
                        <th>Status</th>
                        <th>Failure Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logData.items.map((event) => {
                        const status = deriveDeliveryStatus(event);
                        return (
                          <tr key={event._id}>
                            <td>{formatTimestamp(event.createdAt)}</td>
                            <td>{formatEventType(event.eventType)}</td>
                            <td>{event.recipient ?? "-"}</td>
                            <td>
                              <span
                                className={`notification-status-badge notification-status-badge--${status}`}
                                data-testid="status-badge"
                              >
                                {status}
                              </span>
                            </td>
                            <td className="muted-cell">
                              {event.failureReason ?? event.skippedReason ?? "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {logTotalPages > 1 ? (
                  <div className="pager">
                    <button
                      type="button"
                      className="app-button app-button-secondary"
                      disabled={logPage <= 1 || logLoading}
                      onClick={() => loadLog(logPage - 1)}
                    >
                      Previous
                    </button>
                    <span className="sub">
                      Page {logPage} of {logTotalPages}
                    </span>
                    <button
                      type="button"
                      className="app-button app-button-secondary"
                      disabled={logPage >= logTotalPages || logLoading}
                      onClick={() => loadLog(logPage + 1)}
                    >
                      Next
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
