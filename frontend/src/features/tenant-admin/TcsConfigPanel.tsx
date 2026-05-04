import { useCallback, useEffect, useState } from "react";
import { fetchTcsConfig, fetchTcsHistory, updateTcsConfig, updateTcsModifyRoles } from "@/api/tcsConfig";
import type { TcsConfig, TcsRateChange } from "@/types";
import { TENANT_ROLE_OPTIONS } from "@/types";
import { getUserFacingErrorMessage } from "@/lib/common/apiError";

const ALL_MODIFIABLE_ROLES = [...new Set(["TENANT_ADMIN", ...TENANT_ROLE_OPTIONS.map((o) => o.value)])];

function formatDate(isoString: string): string {
  if (!isoString) return "-";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return d.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(isoString: string): string {
  if (!isoString) return "-";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return d.toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

interface TcsConfigPanelProps {
  canConfigureCompliance: boolean;
}

export function TcsConfigPanel({ canConfigureCompliance }: TcsConfigPanelProps) {
  const [config, setConfig] = useState<TcsConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [rateInput, setRateInput] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [reason, setReason] = useState("");

  const [savedEnabled, setSavedEnabled] = useState(false);
  const [savedRateInput, setSavedRateInput] = useState("");
  const [savedEffectiveFrom, setSavedEffectiveFrom] = useState("");

  const [history, setHistory] = useState<TcsRateChange[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLimit] = useState(20);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [selectedModifyRoles, setSelectedModifyRoles] = useState<string[]>([]);
  const [savedModifyRoles, setSavedModifyRoles] = useState<string[]>([]);
  const [rolesSaving, setRolesSaving] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [rolesSuccess, setRolesSuccess] = useState(false);

  const dirty = enabled !== savedEnabled || rateInput !== savedRateInput || effectiveFrom !== savedEffectiveFrom;
  const rolesDirty = selectedModifyRoles.length !== savedModifyRoles.length || [...selectedModifyRoles].sort().join(",") !== [...savedModifyRoles].sort().join(",");

  const loadConfig = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await fetchTcsConfig();
      setConfig(data);
      setRateInput(String(data.ratePercent));
      setEffectiveFrom(data.effectiveFrom ?? "");
      setEnabled(data.enabled);
      const loadedRoles = data.tcsModifyRoles ?? [];
      setSelectedModifyRoles(loadedRoles);
      setSavedModifyRoles(loadedRoles);
      setSavedEnabled(data.enabled);
      setSavedRateInput(String(data.ratePercent));
      setSavedEffectiveFrom(data.effectiveFrom ?? "");
    } catch (err) {
      setLoadError(getUserFacingErrorMessage(err, "Failed to load TCS configuration."));
    }
  }, []);

  const loadHistory = useCallback(async (page: number) => {
    setHistoryLoading(true);
    try {
      const result = await fetchTcsHistory(page);
      setHistory(result.items);
      setHistoryTotal(result.total);
    } catch {
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    loadHistory(historyPage);
  }, [loadHistory, historyPage]);

  const handleSave = useCallback(async () => {
    setSaveError(null);
    setSaveSuccess(false);
    const rate = parseFloat(rateInput);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      setSaveError("Rate must be a number between 0 and 100.");
      return;
    }
    if (!effectiveFrom || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
      setSaveError("Effective from must be a valid date.");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateTcsConfig({ ratePercent: rate, effectiveFrom, enabled, reason: reason.trim() || undefined });
      setConfig(updated);
      setRateInput(String(updated.ratePercent));
      setEffectiveFrom(updated.effectiveFrom);
      setEnabled(updated.enabled);
      setReason("");
      setSavedEnabled(updated.enabled);
      setSavedRateInput(String(updated.ratePercent));
      setSavedEffectiveFrom(updated.effectiveFrom);
      setSaveSuccess(true);
      await loadHistory(1);
      setHistoryPage(1);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(getUserFacingErrorMessage(err, "Failed to save TCS configuration."));
    } finally {
      setSaving(false);
    }
  }, [rateInput, effectiveFrom, enabled, reason, loadHistory]);

  const handleSaveRoles = useCallback(async () => {
    setRolesError(null);
    setRolesSuccess(false);
    setRolesSaving(true);
    try {
      const updated = await updateTcsModifyRoles(selectedModifyRoles);
      setConfig(updated);
      const updatedRoles = updated.tcsModifyRoles ?? [];
      setSelectedModifyRoles(updatedRoles);
      setSavedModifyRoles(updatedRoles);
      setRolesSuccess(true);
      setTimeout(() => setRolesSuccess(false), 3000);
    } catch (err) {
      setRolesError(getUserFacingErrorMessage(err, "Failed to save access roles."));
    } finally {
      setRolesSaving(false);
    }
  }, [selectedModifyRoles]);

  const toggleRole = useCallback((role: string) => {
    setSelectedModifyRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }, []);

  if (loadError) {
    return (
      <div className="editor-card tenant-config-section-spacer">
        <p className="tenant-config-error-text">{loadError}</p>
        <button type="button" className="app-button app-button-secondary" onClick={loadConfig}>
          Retry
        </button>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(historyTotal / historyLimit));

  return (
    <>
      <div className="editor-card tenant-config-section-spacer">
        <div className="editor-header">
          <h3>TCS Configuration</h3>
        </div>

        <div className="tenant-config-toggle-row">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={saving}
            />
            <span className="toggle-track" />
          </label>
          <span className="tenant-config-toggle-label">TCS Enabled</span>
        </div>

        {enabled ? (
          <>
            <div className="tenant-config-field-grid">
              <label className="tenant-config-field">
                TCS Rate (%)
                <div className="tenant-config-field-row">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={rateInput}
                    onChange={(e) => setRateInput(e.target.value)}
                    disabled={saving}
                    className="tenant-config-field-input-narrow"
                  />
                  <span className="tenant-config-field-suffix">%</span>
                </div>
              </label>

              <label className="tenant-config-field">
                Effective From
                <input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  disabled={saving}
                  className="tenant-config-field-input-medium"
                />
              </label>
            </div>

            <label className="tenant-config-field tenant-config-field-spacer">
              Reason for change (optional)
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={saving}
                rows={2}
                placeholder="e.g. Finance Act 2025 amendment"
                className="tenant-config-textarea"
              />
            </label>
          </>
        ) : null}

        {config?.updatedBy ? (
          <p className="tenant-config-meta">
            Last updated by {config.updatedBy} on {formatDateTime(config.updatedAt)}
          </p>
        ) : null}

        {saveError ? (
          <p className="tenant-config-status-error">{saveError}</p>
        ) : null}
        {saveSuccess ? (
          <p className="tenant-config-status-success">TCS configuration saved.</p>
        ) : null}

        {dirty ? (
          <div className="tenant-config-save-bar">
            <button
              type="button"
              className="app-button app-button-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save TCS Config"}
            </button>
          </div>
        ) : null}
      </div>

      {canConfigureCompliance ? (
        <div className="editor-card tenant-config-section-spacer">
          <div className="editor-header">
            <h3>TCS Modify Access</h3>
          </div>
          <p className="tenant-config-section-hint">
            Select which roles are permitted to change the TCS rate and effective date.
          </p>
          <div className="tenant-config-checkbox-list">
            {ALL_MODIFIABLE_ROLES.map((role) => {
              const label = role === "TENANT_ADMIN"
                ? "Tenant Admin"
                : TENANT_ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role;
              return (
                <label key={role} className="tenant-config-checkbox-row">
                  <input
                    type="checkbox"
                    checked={selectedModifyRoles.includes(role)}
                    onChange={() => toggleRole(role)}
                    disabled={rolesSaving}
                  />
                  {label}
                </label>
              );
            })}
          </div>

          {rolesError ? (
            <p className="tenant-config-status-error">{rolesError}</p>
          ) : null}
          {rolesSuccess ? (
            <p className="tenant-config-status-success">Access roles saved.</p>
          ) : null}

          {rolesDirty ? (
            <div className="tenant-config-actions-row">
              <button
                type="button"
                className="app-button app-button-primary"
                onClick={handleSaveRoles}
                disabled={rolesSaving}
              >
                {rolesSaving ? "Saving…" : "Save Access Roles"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="editor-card tenant-config-section-spacer">
        <div className="editor-header">
          <h3>Rate Change History</h3>
        </div>

        {historyLoading ? (
          <p className="tenant-config-loading">Loading…</p>
        ) : history.length === 0 ? (
          <p className="tenant-config-loading">No rate changes recorded yet.</p>
        ) : (
          <div className="list-scroll tenant-config-field-spacer">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Previous Rate</th>
                  <th>New Rate</th>
                  <th>Effective From</th>
                  <th>Changed By</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry, idx) => (
                  <tr key={idx}>
                    <td className="tcs-config-history-cell-nowrap">{formatDateTime(entry.changedAt)}</td>
                    <td>{entry.previousRate}%</td>
                    <td>{entry.newRate}%</td>
                    <td className="tcs-config-history-cell-nowrap">{formatDate(entry.effectiveFrom)}</td>
                    <td>{entry.changedByName || entry.changedBy}</td>
                    <td className="tcs-config-history-reason">{entry.reason ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <div className="tcs-config-history-pager">
            <button
              type="button"
              className="app-button app-button-secondary app-button-sm"
              onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
              disabled={historyPage === 1 || historyLoading}
            >
              Previous
            </button>
            <span>Page {historyPage} of {totalPages}</span>
            <button
              type="button"
              className="app-button app-button-secondary app-button-sm"
              onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
              disabled={historyPage === totalPages || historyLoading}
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
