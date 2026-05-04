import { useMemo } from "react";
import { Badge, Button } from "@/components/ds";
import type { MailboxAssignment } from "@/api/mailboxAssignments";
import type { ClientOrgOption } from "@/components/workspace/HierarchyBadges";

const VISIBLE_CHIP_LIMIT = 3;

const MAILBOX_STATUS_TONE = {
  CONNECTED: "ok",
  AUTH_FAILED: "fail",
  TOKEN_EXPIRING: "warn"
} as const;

interface MailboxesTableProps {
  items: MailboxAssignment[];
  clientOrgs: ClientOrgOption[] | undefined;
  ingestionCounts: Record<string, number | null | undefined>;
  onEdit: (assignment: MailboxAssignment) => void;
  onDelete: (assignment: MailboxAssignment) => void;
  onViewRecent?: (assignment: MailboxAssignment) => void;
  onRetryCount?: (assignmentId: string) => void;
}

interface ClientOrgChipsResult {
  visible: { id: string; label: string }[];
  overflow: number;
  hiddenLabels: string[];
}

function clientOrgChips(
  ids: string[],
  orgsById: Map<string, ClientOrgOption>
): ClientOrgChipsResult {
  const labelled = ids.map((id) => ({ id, label: orgsById.get(id)?.companyName ?? id }));
  if (labelled.length <= VISIBLE_CHIP_LIMIT) {
    return { visible: labelled, overflow: 0, hiddenLabels: [] };
  }
  const hidden = labelled.slice(VISIBLE_CHIP_LIMIT);
  return {
    visible: labelled.slice(0, VISIBLE_CHIP_LIMIT),
    overflow: hidden.length,
    hiddenLabels: hidden.map((chip) => chip.label)
  };
}

function statusTone(status: string | null | undefined): "ok" | "warn" | "fail" {
  if (!status) return "ok";
  const tone = (MAILBOX_STATUS_TONE as Record<string, "ok" | "warn" | "fail">)[status];
  return tone ?? "ok";
}

export function MailboxesTable({
  items,
  clientOrgs,
  ingestionCounts,
  onEdit,
  onDelete,
  onViewRecent,
  onRetryCount
}: MailboxesTableProps) {
  const orgsById = useMemo(() => {
    const map = new Map<string, ClientOrgOption>();
    for (const org of clientOrgs ?? []) {
      map.set(org.id, org);
    }
    return map;
  }, [clientOrgs]);

  const sorted = useMemo(() => {
    return items.slice().sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
  }, [items]);

  return (
    <div
      className="mailboxes-r10-cards"
      data-testid="mailboxes-table"
      role="list"
      aria-label="Mailbox assignments"
    >
      {sorted.map((item) => {
        const { visible, overflow, hiddenLabels } = clientOrgChips(item.clientOrgIds, orgsById);
        const ingestionCount = ingestionCounts[item._id];
        const tone = statusTone(item.status);
        return (
          <div
            key={item._id}
            className="mailboxes-r10-card"
            data-testid="mailboxes-table-row"
            role="listitem"
          >
            <div className="mailboxes-r10-card-head">
              <span
                className="mailboxes-r10-card-icon"
                data-tone={tone}
                aria-hidden="true"
              >
                <span className="material-symbols-outlined">mail</span>
              </span>
              <div className="mailboxes-r10-card-body">
                <div className="mailboxes-r10-card-addr mono-cell">
                  {item.email ?? "(unknown mailbox)"}
                </div>
                <div className="mailboxes-r10-card-meta">
                  {visible.length} client org{visible.length === 1 ? "" : "s"}
                  {overflow > 0 ? ` · +${overflow} more` : ""}
                </div>
              </div>
            </div>

            <div
              className="mailboxes-r10-card-orgs"
              data-testid={`mailboxes-table-chips-${item._id}`}
            >
              {visible.map((chip) => (
                <Badge key={chip.id} tone="neutral" size="sm">
                  {chip.label}
                </Badge>
              ))}
              {overflow > 0 ? (
                <span
                  data-testid={`mailboxes-table-chips-overflow-${item._id}`}
                  title={hiddenLabels.join(", ")}
                >
                  <Badge tone="info" size="sm">
                    +{overflow} more
                  </Badge>
                </span>
              ) : null}
            </div>

            <div className="mailboxes-r10-card-stats">
              <span>
                Ingested (30d){" "}
                <CountCell
                  assignmentId={item._id}
                  count={ingestionCount}
                  onViewRecent={onViewRecent ? () => onViewRecent(item) : undefined}
                  onRetryCount={onRetryCount}
                />
              </span>
              <span
                className="mailboxes-r10-card-stats-status"
                data-tone={tone}
              >
                {tone === "ok" ? "● ok" : tone === "warn" ? "● token expiring" : "● auth failed"}
              </span>
            </div>

            <div className="mailboxes-r10-card-actions">
              {onViewRecent ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onViewRecent(item)}
                  data-testid={`mailboxes-table-view-recent-${item._id}`}
                >
                  View recent
                </Button>
              ) : null}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onEdit(item)}
                data-testid={`mailboxes-table-edit-${item._id}`}
              >
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onDelete(item)}
                data-testid={`mailboxes-table-delete-${item._id}`}
              >
                Delete
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface CountCellProps {
  assignmentId: string;
  count: number | null | undefined;
  onViewRecent?: () => void;
  onRetryCount?: (id: string) => void;
}

function CountCell({ assignmentId, count, onViewRecent, onRetryCount }: CountCellProps) {
  if (typeof count === "number") {
    if (onViewRecent) {
      return (
        <button
          type="button"
          className="mailboxes-r10-card-count-link"
          onClick={onViewRecent}
          data-testid={`mailboxes-table-count-${assignmentId}`}
        >
          {count}
        </button>
      );
    }
    return (
      <b className="lb-num" data-testid={`mailboxes-table-count-${assignmentId}`}>
        {count}
      </b>
    );
  }
  if (count === null) {
    if (onRetryCount) {
      return (
        <button
          type="button"
          className="mailboxes-r10-card-count-link"
          title="Failed to load count — click to retry"
          onClick={() => onRetryCount(assignmentId)}
          data-testid={`mailboxes-table-count-error-${assignmentId}`}
        >
          ?
        </button>
      );
    }
    return (
      <span
        title="Failed to load count"
        data-testid={`mailboxes-table-count-error-${assignmentId}`}
      >
        ?
      </span>
    );
  }
  return (
    <span aria-hidden="true" data-testid={`mailboxes-table-count-pending-${assignmentId}`}>
      —
    </span>
  );
}
