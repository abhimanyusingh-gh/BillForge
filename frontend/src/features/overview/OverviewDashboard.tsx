import { useEffect, useMemo, useState } from "react";
import { fetchAnalyticsOverview } from "@/api";
import { AdminRealmSwitcher } from "@/features/admin/AdminRealmSwitcher";
import { useAdminClientOrgFilter } from "@/hooks/useAdminClientOrgFilter";
import type { AnalyticsOverview } from "@/types";
import { OverviewKpiTiles } from "@/features/overview/OverviewKpiTiles";
import { OverviewAttentionPanel } from "@/features/overview/OverviewAttentionPanel";
import {
  PRESETS,
  PresetKey,
  fmtInr,
  firstOfMonthStr,
  todayStr
} from "@/features/overview/OverviewDashboardUtils";

const APPROVAL_SCOPE = ["mine", "all"] as const;
type ApprovalScope = (typeof APPROVAL_SCOPE)[number];

const APPROVAL_SCOPE_LABEL: Record<ApprovalScope, string> = {
  mine: "My Approvals",
  all: "All Users"
};

const RECENT_ACTIVITY_PLACEHOLDER = [
  "Recent activity will populate once audit-log streaming is wired (see follow-up)."
];

interface OverviewDashboardProps {
  onNavigateActionRequired?: () => void;
  onNavigateExports?: () => void;
}

export function OverviewDashboard({ onNavigateActionRequired, onNavigateExports }: OverviewDashboardProps = {}) {
  const [from, setFrom] = useState(firstOfMonthStr());
  const [to, setTo] = useState(todayStr());
  const [activePreset, setActivePreset] = useState<PresetKey>("this-month");
  const [scope, setScope] = useState<ApprovalScope>("all");
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { clientOrgId } = useAdminClientOrgFilter();

  useEffect(() => {
    if (from && to && from > to) {
      setError("Start date must be before end date");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAnalyticsOverview(from, to, scope, clientOrgId)
      .then((current) => {
        if (!cancelled) setData(current);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load analytics.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, scope, clientOrgId]);

  function applyPreset(f: string, t: string, key: PresetKey) {
    setFrom(f);
    setTo(t);
    setActivePreset(key);
  }

  const kpis = data?.kpis;
  const totalApprovedAmountLabel = useMemo(
    () => (kpis ? fmtInr(kpis.approvedAmountMinor) : "—"),
    [kpis]
  );

  return (
    <div className="overview-dashboard-r4">
      <div className="page-header">
        <h1>Overview</h1>
        <span className="count">{loading ? "Refreshing…" : "live"}</span>
      </div>

      <div className="overview-r4-toolbar" role="group" aria-label="Date range and scope">
        <AdminRealmSwitcher />
        <input
          type="date"
          aria-label="From date"
          value={from}
          max={to}
          onChange={(e) => {
            setFrom(e.target.value);
            setActivePreset(null);
          }}
        />
        <span aria-hidden="true">{"–"}</span>
        <input
          type="date"
          aria-label="To date"
          value={to}
          min={from}
          onChange={(e) => {
            setTo(e.target.value);
            setActivePreset(null);
          }}
        />
        {PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            className="ds-pill"
            data-active={activePreset === preset.key ? "true" : undefined}
            aria-pressed={activePreset === preset.key}
            onClick={() => {
              const range = preset.range();
              applyPreset(range.from, range.to, preset.key);
            }}
          >
            {preset.label}
          </button>
        ))}
        <span className="overview-r4-toolbar-spacer" />
        <div className="ds-segmented-group" role="group" aria-label="Approval scope">
          {APPROVAL_SCOPE.map((item) => (
            <button
              key={item}
              type="button"
              className="ds-pill"
              data-active={scope === item ? "true" : undefined}
              aria-pressed={scope === item}
              onClick={() => setScope(item)}
            >
              {APPROVAL_SCOPE_LABEL[item]}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="error" role="alert">{error}</p> : null}

      <OverviewKpiTiles
        kpis={kpis ?? null}
        approvedAmountLabel={totalApprovedAmountLabel}
        onNavigateActionRequired={onNavigateActionRequired}
        onNavigateExports={onNavigateExports}
      />

      <div className="overview-grid-2">
        <OverviewAttentionPanel onNavigateActionRequired={onNavigateActionRequired} />

        <div className="overview-side-stack">
          <div className="section">
            <div className="stitle">
              <h3>Net payable · 14 days</h3>
              <span className="lb-caption">coming soon</span>
            </div>
            <div className="overview-coming-soon">
              <span className="material-symbols-outlined" aria-hidden="true">insights</span>
              Cashflow trend chart pending backend support.
            </div>
          </div>

          <div className="section">
            <div className="stitle">
              <h3>TDS deducted · MTD</h3>
              <span className="lb-caption">coming soon</span>
            </div>
            <div className="overview-coming-soon">
              <span className="material-symbols-outlined" aria-hidden="true">receipt</span>
              Per-section TDS breakdown pending backend support.
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="stitle">
          <h3>Recent activity</h3>
          <span className="lb-caption">coming soon</span>
        </div>
        <div className="overview-recent-grid">
          {RECENT_ACTIVITY_PLACEHOLDER.map((line) => (
            <div key={line} className="overview-recent-line">{line}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
