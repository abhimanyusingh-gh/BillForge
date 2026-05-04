import { useMemo } from "react";
import {
  ACTION_REASON,
  type ActionQueueGroup,
  type ActionQueueItem,
  type ActionReason
} from "@/lib/invoice/actionRequired";
import { useActionRequiredQueue } from "@/hooks/useActionRequiredQueue";

const SEVERITY_TONE: Record<ActionReason, "critical" | "warning" | "info"> = {
  [ACTION_REASON.FailedOcr]: "critical",
  [ACTION_REASON.CriticalRisk]: "critical",
  [ACTION_REASON.ExportFailed]: "critical",
  [ACTION_REASON.MissingGstin]: "warning",
  [ACTION_REASON.NeedsReview]: "warning",
  [ACTION_REASON.AwaitingApproval]: "info"
};

const REASON_ICON: Record<ActionReason, string> = {
  [ACTION_REASON.FailedOcr]: "report",
  [ACTION_REASON.CriticalRisk]: "priority_high",
  [ACTION_REASON.ExportFailed]: "cloud_off",
  [ACTION_REASON.MissingGstin]: "fingerprint",
  [ACTION_REASON.NeedsReview]: "rule",
  [ACTION_REASON.AwaitingApproval]: "hourglass_empty"
};

const REASON_HINT: Record<ActionReason, string> = {
  [ACTION_REASON.FailedOcr]: "OCR failed — re-upload PDF",
  [ACTION_REASON.CriticalRisk]: "Critical risk signal — review",
  [ACTION_REASON.ExportFailed]: "Export to Tally failed",
  [ACTION_REASON.MissingGstin]: "Missing customer GSTIN",
  [ACTION_REASON.NeedsReview]: "Needs review — verify fields",
  [ACTION_REASON.AwaitingApproval]: "Awaiting your approval"
};

const MAX_ROWS = 6;

interface FlatRow {
  invoiceId: string;
  reason: ActionReason;
  tone: "critical" | "warning" | "info";
  vendor: string;
  number: string;
  hint: string;
  receivedAt: string;
}

function ageDays(receivedAt: string): number {
  const ms = Date.now() - new Date(receivedAt).getTime();
  if (Number.isNaN(ms) || ms < 0) return 0;
  return Math.floor(ms / 86_400_000);
}

function flatten(groups: ActionQueueGroup[]): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const group of groups) {
    for (const item of group.items) {
      rows.push(toRow(item, group.reason));
    }
  }
  rows.sort(
    (a, b) =>
      severityWeight(b.tone) - severityWeight(a.tone) ||
      ageDays(b.receivedAt) - ageDays(a.receivedAt)
  );
  return rows.slice(0, MAX_ROWS);
}

function severityWeight(tone: FlatRow["tone"]): number {
  if (tone === "critical") return 3;
  if (tone === "warning") return 2;
  return 1;
}

function toRow(item: ActionQueueItem, reason: ActionReason): FlatRow {
  return {
    invoiceId: item.invoiceId,
    reason,
    tone: SEVERITY_TONE[reason],
    vendor: item.vendorName ?? "Unknown vendor",
    number: item.invoiceNumber ?? "—",
    hint: REASON_HINT[reason],
    receivedAt: item.receivedAt
  };
}

interface OverviewAttentionPanelProps {
  onNavigateActionRequired?: () => void;
}

export function OverviewAttentionPanel({ onNavigateActionRequired }: OverviewAttentionPanelProps) {
  const { groups, isLoading, isError, refetch } = useActionRequiredQueue();
  const rows = useMemo(() => flatten(groups), [groups]);

  return (
    <div className="section overview-attention-panel" data-testid="overview-attention-panel">
      <div className="stitle">
        <h3>What needs your attention</h3>
        <span className="lb-caption">{isLoading ? "loading…" : `${rows.length} of top ${MAX_ROWS}`}</span>
      </div>

      {isError ? (
        <div className="overview-coming-soon overview-attention-error" role="alert">
          Couldn&rsquo;t load action items.
          <button
            type="button"
            className="app-button app-button-secondary overview-attention-retry"
            onClick={() => void refetch()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {!isError && !isLoading && rows.length === 0 ? (
        <div className="overview-coming-soon">
          <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
          Nothing flagged in this scope.
        </div>
      ) : null}

      {rows.map((row) => (
        <button
          key={row.invoiceId}
          type="button"
          className={`risk-row ${row.tone}`}
          data-testid="overview-attention-row"
          data-reason={row.reason}
          onClick={onNavigateActionRequired}
        >
          <span className="icon">
            <span className="material-symbols-outlined" aria-hidden="true">{REASON_ICON[row.reason]}</span>
          </span>
          <div className="body">
            <div className="risk-code">{row.vendor} · {row.number}</div>
            <div className="risk-msg">{row.hint}</div>
          </div>
          <span className="lb-mono overview-attention-age">{ageDays(row.receivedAt)}d</span>
        </button>
      ))}

      {onNavigateActionRequired && rows.length > 0 ? (
        <div className="overview-attention-footer">
          <button type="button" className="app-button app-button-secondary" onClick={onNavigateActionRequired}>
            View all action items
          </button>
        </div>
      ) : null}
    </div>
  );
}
