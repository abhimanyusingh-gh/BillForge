import { useMemo, useState } from "react";
import {
  ACTION_REASON,
  type ActionQueueGroup,
  type ActionQueueItem,
  type ActionReason
} from "@/lib/invoice/actionRequired";
import { useActionRequiredQueue } from "@/hooks/useActionRequiredQueue";
import { formatMinorAmountWithCurrency } from "@/lib/common/currency";

export const ACTION_PAGE_VIEW = {
  Loading: "Loading",
  Error: "Error",
  Empty: "Empty",
  Data: "Data"
} as const;

type ActionPageView = (typeof ACTION_PAGE_VIEW)[keyof typeof ACTION_PAGE_VIEW];

const FILTER_ALL = "all" as const;

type ChipFilter = typeof FILTER_ALL | ActionReason;

interface FlatRow extends ActionQueueItem {
  reasonLabel: string;
  reasonTone: "critical" | "warning" | "info";
  ageDays: number;
}

interface ActionRequiredPageProps {
  onSelectInvoice?: (invoiceId: string) => void;
}

const REASON_TONE: Record<ActionReason, FlatRow["reasonTone"]> = {
  [ACTION_REASON.FailedOcr]: "critical",
  [ACTION_REASON.CriticalRisk]: "critical",
  [ACTION_REASON.ExportFailed]: "critical",
  [ACTION_REASON.MissingGstin]: "warning",
  [ACTION_REASON.NeedsReview]: "warning",
  [ACTION_REASON.AwaitingApproval]: "info"
};

const REASON_HINT: Record<ActionReason, string> = {
  [ACTION_REASON.FailedOcr]: "OCR failed — re-upload PDF",
  [ACTION_REASON.CriticalRisk]: "Critical risk signal — review",
  [ACTION_REASON.ExportFailed]: "Export to Tally failed",
  [ACTION_REASON.MissingGstin]: "Missing customer GSTIN",
  [ACTION_REASON.NeedsReview]: "Needs review — verify fields",
  [ACTION_REASON.AwaitingApproval]: "Awaiting your approval"
};

function diffDays(receivedAt: string): number {
  const ms = Date.now() - new Date(receivedAt).getTime();
  if (Number.isNaN(ms) || ms < 0) return 0;
  return Math.floor(ms / 86_400_000);
}

function flatten(groups: ActionQueueGroup[]): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const group of groups) {
    for (const item of group.items) {
      rows.push({
        ...item,
        reasonLabel: group.label,
        reasonTone: REASON_TONE[group.reason],
        ageDays: diffDays(item.receivedAt)
      });
    }
  }
  rows.sort((a, b) => b.ageDays - a.ageDays);
  return rows;
}

function resolveView(args: {
  isLoading: boolean;
  isError: boolean;
  rowCount: number;
}): ActionPageView {
  if (args.isLoading) return ACTION_PAGE_VIEW.Loading;
  if (args.isError) return ACTION_PAGE_VIEW.Error;
  if (args.rowCount === 0) return ACTION_PAGE_VIEW.Empty;
  return ACTION_PAGE_VIEW.Data;
}

function formatAmount(item: ActionQueueItem): string {
  if (item.totalAmountMinor === null || !item.currency) return "—";
  return formatMinorAmountWithCurrency(item.totalAmountMinor, item.currency);
}

function formatDate(receivedAt: string): string {
  const d = new Date(receivedAt);
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-US", { month: "short" });
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

const PRIMARY_CHIPS: ReadonlyArray<{ id: ChipFilter; label: string }> = [
  { id: FILTER_ALL, label: "All" },
  { id: ACTION_REASON.NeedsReview, label: "Needs review" },
  { id: ACTION_REASON.AwaitingApproval, label: "Awaiting" },
  { id: ACTION_REASON.FailedOcr, label: "OCR failed" },
  { id: ACTION_REASON.MissingGstin, label: "Missing GSTIN" },
  { id: ACTION_REASON.ExportFailed, label: "Export failed" },
  { id: ACTION_REASON.CriticalRisk, label: "Critical risk" }
];

function ActionRequiredTable({
  rows,
  onSelectInvoice
}: {
  rows: FlatRow[];
  onSelectInvoice?: (invoiceId: string) => void;
}) {
  return (
    <div className="table-wrap">
      <table className="lbtable action-page-table">
        <thead>
          <tr>
            <th className="action-page-col-dot" aria-label="Severity"></th>
            <th className="action-page-col-reason">Reason</th>
            <th>Vendor</th>
            <th className="action-page-col-number">Invoice #</th>
            <th className="action-page-col-date">Date</th>
            <th>Hint</th>
            <th className="action-page-col-age">Age</th>
            <th className="action-page-col-amount">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.invoiceId}
              data-testid="action-page-row"
              data-invoice-id={row.invoiceId}
              data-reason={row.reason}
              onClick={() => onSelectInvoice?.(row.invoiceId)}
            >
              <td>
                <span className={`cdot ${row.reasonTone}`} aria-hidden="true" />
              </td>
              <td>
                <span className="action-page-reason-label">{row.reasonLabel}</span>
              </td>
              <td className="action-page-vendor-cell">{row.vendorName ?? "Unknown vendor"}</td>
              <td className="mono-cell">{row.invoiceNumber ?? "—"}</td>
              <td className="mono-cell">{formatDate(row.receivedAt)}</td>
              <td className="action-page-hint-cell">{REASON_HINT[row.reason]}</td>
              <td className="num-cell action-page-age-cell" data-stale={row.ageDays > 5 ? "true" : undefined}>
                {row.ageDays}d
              </td>
              <td className="num-cell">{formatAmount(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LoadingState() {
  return (
    <div data-testid="action-page-loading" aria-busy="true" aria-live="polite" className="action-page-loading">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} aria-hidden="true" className="action-page-skeleton-row" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div data-testid="action-page-empty" className="action-page-empty">
      <span className="material-symbols-outlined action-page-empty-icon" aria-hidden="true">
        task_alt
      </span>
      <p className="action-page-empty-title">You&rsquo;re all caught up</p>
      <p className="action-page-empty-body">No invoices need your attention right now.</p>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div data-testid="action-page-error" role="alert" className="action-page-error">
      <p className="action-page-error-title">Couldn&rsquo;t load action items.</p>
      <button type="button" onClick={onRetry} className="app-button app-button-secondary">
        Retry
      </button>
    </div>
  );
}

export function ActionRequiredPage({ onSelectInvoice }: ActionRequiredPageProps) {
  const { groups, isLoading, isError, refetch, scannedCount, totalAvailable } = useActionRequiredQueue();
  const [chip, setChip] = useState<ChipFilter>(FILTER_ALL);

  const allRows = useMemo(() => flatten(groups), [groups]);
  const counts = useMemo(() => {
    const map: Record<string, number> = { [FILTER_ALL]: allRows.length };
    for (const row of allRows) {
      map[row.reason] = (map[row.reason] ?? 0) + 1;
    }
    return map;
  }, [allRows]);

  const filteredRows = useMemo(() => {
    if (chip === FILTER_ALL) return allRows;
    return allRows.filter((r) => r.reason === chip);
  }, [allRows, chip]);

  const view = resolveView({ isLoading, isError, rowCount: filteredRows.length });
  const truncated = view === ACTION_PAGE_VIEW.Data && totalAvailable > scannedCount;

  return (
    <div className="action-page">
      <div className="page-header">
        <h1>Action Required</h1>
        <span className="count">{allRows.length} invoices</span>
      </div>

      <div className="action-page-chips" role="group" aria-label="Filter by reason">
        {PRIMARY_CHIPS.map((c) => {
          const active = chip === c.id;
          const count = counts[c.id] ?? 0;
          if (c.id !== FILTER_ALL && count === 0 && !active) return null;
          return (
            <button
              key={c.id}
              type="button"
              className={active ? "tq-chip active" : "tq-chip"}
              aria-pressed={active}
              data-chip-id={c.id}
              onClick={() => setChip(c.id)}
            >
              {c.label}
              <span className="num">{count}</span>
            </button>
          );
        })}
      </div>

      <div data-testid="action-page-body" data-view={view}>
        {view === ACTION_PAGE_VIEW.Loading ? <LoadingState /> : null}
        {view === ACTION_PAGE_VIEW.Error ? <ErrorState onRetry={() => void refetch()} /> : null}
        {view === ACTION_PAGE_VIEW.Empty ? <EmptyState /> : null}
        {view === ACTION_PAGE_VIEW.Data ? (
          <ActionRequiredTable rows={filteredRows} onSelectInvoice={onSelectInvoice} />
        ) : null}
      </div>

      {truncated ? (
        <p className="action-page-truncation" data-testid="action-page-truncation">
          Showing first {scannedCount} of {totalAvailable} invoices. More will surface as this queue is cleared.
        </p>
      ) : null}
    </div>
  );
}
