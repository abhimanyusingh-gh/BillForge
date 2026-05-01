import { SlideOverPanel } from "@/components/ds/SlideOverPanel";
import { Badge, BADGE_SIZE } from "@/components/ds/Badge";
import { formatMinorAmountWithCurrency } from "@/lib/common/currency";
import type { ActionQueueGroup, ActionQueueItem } from "@/lib/invoice/actionRequired";
import { useActionRequiredQueue } from "@/hooks/useActionRequiredQueue";

export const ACTION_PANEL_VIEW = {
  Loading: "Loading",
  Error: "Error",
  Empty: "Empty",
  Data: "Data"
} as const;

type ActionPanelView = (typeof ACTION_PANEL_VIEW)[keyof typeof ACTION_PANEL_VIEW];

interface ActionRequiredPanelProps {
  open: boolean;
  onClose: () => void;
  onSelectInvoice?: (invoiceId: string) => void;
  panelId?: string;
}

function resolveView(args: {
  isLoading: boolean;
  isError: boolean;
  groupCount: number;
}): ActionPanelView {
  if (args.isLoading) return ACTION_PANEL_VIEW.Loading;
  if (args.isError) return ACTION_PANEL_VIEW.Error;
  if (args.groupCount === 0) return ACTION_PANEL_VIEW.Empty;
  return ACTION_PANEL_VIEW.Data;
}

function SkeletonRow() {
  return <div aria-hidden="true" className="action-panel-skeleton-row" />;
}

function LoadingState() {
  return (
    <div data-testid="action-panel-loading" aria-busy="true" aria-live="polite">
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </div>
  );
}

function EmptyState() {
  return (
    <div data-testid="action-panel-empty" className="action-panel-empty">
      <span
        className="material-symbols-outlined action-panel-empty-icon"
        aria-hidden="true"
      >
        task_alt
      </span>
      <p className="action-panel-empty-title">You&rsquo;re all caught up</p>
      <p className="action-panel-empty-body">
        No invoices need your attention right now.
      </p>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div data-testid="action-panel-error" role="alert" className="action-panel-error">
      <p className="action-panel-error-title">Couldn&rsquo;t load action items.</p>
      <button type="button" onClick={onRetry} className="action-panel-error-retry">
        Retry
      </button>
    </div>
  );
}

function QueueItemRow({ item, onSelect }: { item: ActionQueueItem; onSelect: (id: string) => void }) {
  const amount =
    item.totalAmountMinor !== null && item.currency
      ? formatMinorAmountWithCurrency(item.totalAmountMinor, item.currency)
      : null;
  return (
    <button
      type="button"
      data-testid="action-panel-item"
      data-invoice-id={item.invoiceId}
      onClick={() => onSelect(item.invoiceId)}
      className="action-panel-item"
    >
      <span className="action-panel-item-vendor">
        {item.vendorName || "Unknown vendor"}
      </span>
      <span className="action-panel-item-meta">
        <span className="action-panel-item-number">{item.invoiceNumber || "—"}</span>
        {amount ? <span className="action-panel-item-amount">{amount}</span> : null}
      </span>
    </button>
  );
}

function QueueGroup({
  group,
  onSelect
}: {
  group: ActionQueueGroup;
  onSelect: (invoiceId: string) => void;
}) {
  return (
    <section
      data-testid="action-panel-group"
      data-reason={group.reason}
      className="action-panel-group"
    >
      <header className="action-panel-group-header">
        <h3 className="action-panel-group-title">{group.label}</h3>
        <Badge tone={group.tone} size={BADGE_SIZE.sm}>
          {group.items.length}
        </Badge>
      </header>
      {group.items.map((item) => (
        <QueueItemRow key={item.invoiceId} item={item} onSelect={onSelect} />
      ))}
    </section>
  );
}

function TruncationFooter({ scanned, total }: { scanned: number; total: number }) {
  return (
    <p className="action-panel-truncation" data-testid="action-panel-truncation">
      Showing first {scanned} of {total} action-required invoices. More will
      surface when this queue is cleared.
    </p>
  );
}

export function ActionRequiredPanel({ open, onClose, onSelectInvoice, panelId }: ActionRequiredPanelProps) {
  const { groups, isLoading, isError, refetch, scannedCount, totalAvailable } = useActionRequiredQueue();
  const view = resolveView({ isLoading, isError, groupCount: groups.length });
  const truncated = view === ACTION_PANEL_VIEW.Data && totalAvailable > scannedCount;

  return (
    <SlideOverPanel open={open} onClose={onClose} title="Action required" width="lg" id={panelId}>
      <div data-testid="action-panel-body" data-view={view}>
        {view === ACTION_PANEL_VIEW.Loading ? <LoadingState /> : null}
        {view === ACTION_PANEL_VIEW.Error ? <ErrorState onRetry={() => void refetch()} /> : null}
        {view === ACTION_PANEL_VIEW.Empty ? <EmptyState /> : null}
        {view === ACTION_PANEL_VIEW.Data
          ? groups.map((group) => (
              <QueueGroup
                key={group.reason}
                group={group}
                onSelect={(invoiceId) => {
                  onSelectInvoice?.(invoiceId);
                  onClose();
                }}
              />
            ))
          : null}
        {truncated ? <TruncationFooter scanned={scannedCount} total={totalAvailable} /> : null}
      </div>
    </SlideOverPanel>
  );
}
