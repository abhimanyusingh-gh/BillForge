import { useCallback, useEffect, useState } from "react";
import { fetchApprovalLimits, saveApprovalLimits } from "@/api/admin";
import { getUserFacingErrorMessage } from "@/lib/common/apiError";
import { TENANT_ROLE_OPTIONS, type TenantRole } from "@/types";

interface LimitRow {
  role: TenantRole;
  label: string;
  approvalLimitMinor: number | null;
  unlimited: boolean;
}

function buildRows(limits: Record<string, { approvalLimitMinor: number | null }>): LimitRow[] {
  return TENANT_ROLE_OPTIONS.map(({ value, label }) => {
    const entry = limits[value];
    const limitMinor = entry?.approvalLimitMinor ?? null;
    return {
      role: value,
      label,
      approvalLimitMinor: limitMinor,
      unlimited: limitMinor === null,
    };
  });
}

function formatRupees(minor: number): string {
  const major = minor / 100;
  return major.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

interface ApprovalLimitsSectionProps {
  currentUserId: string;
  currentUserRole: string;
}

export function ApprovalLimitsSection({ currentUserId, currentUserRole }: ApprovalLimitsSectionProps) {
  const [rows, setRows] = useState<LimitRow[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const dirty = JSON.stringify(rows) !== savedSnapshot;

  const loadLimits = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchApprovalLimits();
      const built = buildRows(data.limits);
      setRows(built);
      setSavedSnapshot(JSON.stringify(built));
    } catch (err) {
      setLoadError(getUserFacingErrorMessage(err, "Failed to load approval limits."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLimits(); }, [loadLimits]);

  const handleUnlimitedToggle = useCallback((role: TenantRole) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.role !== role) return row;
        const nowUnlimited = !row.unlimited;
        return {
          ...row,
          unlimited: nowUnlimited,
          approvalLimitMinor: nowUnlimited ? null : 10000000,
        };
      })
    );
  }, []);

  const handleLimitChange = useCallback((role: TenantRole, raw: string) => {
    const parsed = parseFloat(raw);
    const majorClamped = isNaN(parsed) ? 0 : Math.max(0, parsed);
    const minor = Math.round(majorClamped * 100);
    setRows((prev) =>
      prev.map((row) => (row.role === role ? { ...row, approvalLimitMinor: minor } : row))
    );
  }, []);

  const handleSave = useCallback(async () => {
    setSaveError(null);
    setSaveSuccess(false);
    setSaving(true);
    try {
      const limitsPayload: Record<string, number | null> = {};
      for (const row of rows) {
        if (row.role === currentUserRole) continue;
        limitsPayload[row.role] = row.unlimited ? null : row.approvalLimitMinor;
      }
      await saveApprovalLimits(limitsPayload);
      setSavedSnapshot(JSON.stringify(rows));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(getUserFacingErrorMessage(err, "Failed to save approval limits."));
    } finally {
      setSaving(false);
    }
  }, [rows, currentUserRole]);

  if (loading) {
    return (
      <div className="editor-card" style={{ marginTop: "1.5rem" }}>
        <p style={{ fontSize: "0.875rem", color: "var(--ink-soft, #666)" }}>Loading approval limits...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="editor-card" style={{ marginTop: "1.5rem" }}>
        <p style={{ color: "var(--danger, #ef4444)", fontSize: "0.875rem" }} role="alert">{loadError}</p>
        <button type="button" className="app-button app-button-secondary" onClick={loadLimits}>Retry</button>
      </div>
    );
  }

  return (
    <div className="editor-card" style={{ marginTop: "1.5rem" }}>
      <div className="editor-header">
        <h3>Approval Limits</h3>
      </div>

      <p style={{ fontSize: "0.8rem", color: "var(--ink-soft, #666)", marginTop: "0.5rem", marginBottom: "1rem" }}>
        Set the maximum invoice amount each role can approve. Unlimited means no cap.
      </p>

      <div className="list-scroll" style={{ maxHeight: "280px" }}>
        <table>
          <thead>
            <tr>
              <th>Role</th>
              <th>Limit ({"\u20B9"})</th>
              <th>Unlimited</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isCurrentUserRole = row.role === currentUserRole;
              return (
                <tr key={row.role}>
                  <td style={{ fontSize: "0.85rem" }}>{row.label}</td>
                  <td>
                    {isCurrentUserRole ? (
                      <span
                        style={{ fontSize: "0.85rem", color: "var(--ink-soft, #666)" }}
                        title="You cannot modify your own approval limit"
                      >
                        {row.unlimited ? "Unlimited" : `\u20B9 ${formatRupees(row.approvalLimitMinor!)}`}
                      </span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={row.unlimited ? "" : (row.approvalLimitMinor ?? 0) / 100}
                        onChange={(e) => handleLimitChange(row.role, e.target.value)}
                        disabled={row.unlimited || saving}
                        aria-label={`${row.label} approval limit`}
                        style={{ width: "7rem", fontSize: "0.82rem" }}
                      />
                    )}
                  </td>
                  <td>
                    {isCurrentUserRole ? (
                      <input
                        type="checkbox"
                        checked={row.unlimited}
                        disabled
                        title="You cannot modify your own approval limit"
                        aria-label={`${row.label} unlimited toggle`}
                      />
                    ) : (
                      <input
                        type="checkbox"
                        checked={row.unlimited}
                        onChange={() => handleUnlimitedToggle(row.role)}
                        disabled={saving}
                        aria-label={`${row.label} unlimited toggle`}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {saveError ? (
        <p style={{ color: "var(--warn, #f59e0b)", fontSize: "0.85rem", marginTop: "0.5rem" }} role="alert">{saveError}</p>
      ) : null}
      {saveSuccess ? (
        <p style={{ color: "var(--chart-emerald, #10b981)", fontSize: "0.85rem", marginTop: "0.5rem" }}>Approval limits saved.</p>
      ) : null}

      {dirty ? (
        <div style={{ marginTop: "1rem" }}>
          <button type="button" className="app-button app-button-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Limits"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
