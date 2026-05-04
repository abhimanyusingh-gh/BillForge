import { useMemo } from "react";
import { Badge, Button, Spinner } from "@/components/ds";
import { SlideOverPanel } from "@/components/ds/SlideOverPanel";
import { useRecentIngestions } from "@/hooks/useRecentIngestions";
import { getUserFacingErrorMessage } from "@/lib/common/apiError";
import { getInvoiceStatusPresentation } from "@/features/admin/mailboxes/recentIngestionStatus";
import { BADGE_STATUS, type BadgeStatus } from "@/types/badgeStatus";
import type { ClientOrgOption } from "@/components/workspace/HierarchyBadges";
import type { MailboxRecentIngestionItem } from "@/api/mailboxAssignments";

export const RECENT_INGESTIONS_DRAWER_VIEW = {
  Loading: "loading",
  Error: "error",
  Empty: "empty",
  Data: "data"
} as const;

type RecentIngestionsDrawerView =
  typeof RECENT_INGESTIONS_DRAWER_VIEW[keyof typeof RECENT_INGESTIONS_DRAWER_VIEW];

const DAYS = 30;
const LIMIT = 50;

interface RecentIngestionsDrawerProps {
  open: boolean;
  assignmentId: string | null;
  mailboxEmail: string | null;
  clientOrgs: ClientOrgOption[] | undefined;
  onClose: () => void;
}

export function RecentIngestionsDrawer({
  open,
  assignmentId,
  mailboxEmail,
  clientOrgs,
  onClose
}: RecentIngestionsDrawerProps) {
  const query = useRecentIngestions({
    assignmentId: assignmentId ?? "",
    days: DAYS,
    limit: LIMIT,
    enabled: open && assignmentId !== null
  });

  const orgsById = useMemo(() => {
    const map = new Map<string, ClientOrgOption>();
    for (const org of clientOrgs ?? []) {
      map.set(org.id, org);
    }
    return map;
  }, [clientOrgs]);

  const view: RecentIngestionsDrawerView = (() => {
    if (query.isPending) return RECENT_INGESTIONS_DRAWER_VIEW.Loading;
    if (query.isError) return RECENT_INGESTIONS_DRAWER_VIEW.Error;
    if ((query.data?.items ?? []).length === 0) return RECENT_INGESTIONS_DRAWER_VIEW.Empty;
    return RECENT_INGESTIONS_DRAWER_VIEW.Data;
  })();

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const truncatedAt = query.data?.truncatedAt ?? LIMIT;
  const showTruncationBanner = total > items.length;

  return (
    <SlideOverPanel
      open={open}
      onClose={onClose}
      title="Recent ingestions (last 30 days)"
      width="lg"
      id="recent-ingestions-drawer"
    >
      <div
        className="mailboxes-r10-drawer"
        data-testid="recent-ingestions-drawer"
        data-view={view}
      >
        <p className="mailboxes-r10-drawer-subtitle">
          {mailboxEmail ?? "(unknown mailbox)"}
        </p>

        {view === RECENT_INGESTIONS_DRAWER_VIEW.Loading ? (
          <div
            className="mailboxes-r10-drawer-state"
            data-testid="recent-ingestions-loading"
            role="status"
            aria-live="polite"
          >
            <Spinner />
            <p>Loading recent ingestions…</p>
          </div>
        ) : null}

        {view === RECENT_INGESTIONS_DRAWER_VIEW.Error ? (
          <div
            className="mailboxes-r10-drawer-state mailboxes-r10-drawer-state-error"
            data-testid="recent-ingestions-error"
            role="alert"
          >
            <p>{getUserFacingErrorMessage(query.error, "Couldn't load recent ingestions.")}</p>
            <Button onClick={() => void query.refetch()} variant="secondary">
              Retry
            </Button>
          </div>
        ) : null}

        {view === RECENT_INGESTIONS_DRAWER_VIEW.Empty ? (
          <div
            className="mailboxes-r10-drawer-state"
            data-testid="recent-ingestions-empty"
          >
            <p>No ingestions in the last 30 days.</p>
          </div>
        ) : null}

        {view === RECENT_INGESTIONS_DRAWER_VIEW.Data ? (
          <>
            {showTruncationBanner ? (
              <p
                className="mailboxes-r10-drawer-truncation"
                data-testid="recent-ingestions-truncation"
              >
                Showing first {Math.min(items.length, truncatedAt)} of {total}.
              </p>
            ) : (
              <p
                className="mailboxes-r10-drawer-summary"
                data-testid="recent-ingestions-summary"
              >
                {total} ingestion{total === 1 ? "" : "s"} in the last 30 days.
              </p>
            )}
            <ul
              className="mailboxes-r10-drawer-list"
              data-testid="recent-ingestions-list"
            >
              {items.map((item) => (
                <RecentIngestionRow
                  key={item._id}
                  item={item}
                  clientOrgName={
                    item.clientOrgId ? orgsById.get(item.clientOrgId)?.companyName ?? null : null
                  }
                />
              ))}
            </ul>
          </>
        ) : null}

        <p
          className="mailboxes-r10-drawer-footnote"
          data-testid="recent-ingestions-footnote"
        >
          Counts may overlap if the same client organization is mapped to multiple mailboxes (#181).
        </p>
      </div>
    </SlideOverPanel>
  );
}

function RecentIngestionRow({
  item,
  clientOrgName
}: {
  item: MailboxRecentIngestionItem;
  clientOrgName: string | null;
}) {
  const ingestedAt = item.createdAt ?? item.receivedAt;
  const ingestedAtLabel = ingestedAt ? formatDateTime(ingestedAt) : "—";
  const headline =
    item.invoiceNumber ?? item.attachmentName ?? `Invoice ${item._id.slice(-6)}`;
  const vendorLabel = item.vendorName ?? "Unknown vendor";
  return (
    <li
      className="mailboxes-r10-drawer-row"
      data-testid={`recent-ingestions-row-${item._id}`}
    >
      <div className="mailboxes-r10-drawer-row-main">
        <strong>{headline}</strong>
        <span className="mailboxes-r10-drawer-row-vendor">{vendorLabel}</span>
      </div>
      <div className="mailboxes-r10-drawer-row-meta">
        {item.status ? <StatusBadge status={item.status} /> : null}
        {clientOrgName ? <span>{clientOrgName}</span> : null}
        <time
          className="mailboxes-r10-drawer-row-time"
          dateTime={ingestedAt ?? undefined}
        >
          {ingestedAtLabel}
        </time>
      </div>
    </li>
  );
}

function isCanonicalStatus(value: string): value is BadgeStatus {
  return value in BADGE_STATUS;
}

function StatusBadge({ status }: { status: string }) {
  const { label, tone } = getInvoiceStatusPresentation(status);
  if (isCanonicalStatus(status)) {
    return (
      <Badge status={status} size="sm" showStatusDot={false}>
        {label}
      </Badge>
    );
  }
  return (
    <Badge tone={tone} size="sm">
      {label}
    </Badge>
  );
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
