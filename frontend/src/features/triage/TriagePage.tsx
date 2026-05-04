import { useCallback, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/components/common/EmptyState";
import { useClientOrgsAdminList, useTenantClientOrgs } from "@/hooks/useTenantClientOrgs";
import { useTriageQueue } from "@/hooks/useTriageQueue";
import {
  TRIAGE_QUEUE_QUERY_KEY,
  assignClientOrg,
  rejectInvoice,
  type TriageInvoice,
  type TriageListResponse
} from "@/api/triage";
import type { ClientOrganization } from "@/api/clientOrgs";
import type { ClientOrgOption } from "@/components/workspace/HierarchyBadges";
import { ClientOrgPicker } from "@/features/triage/ClientOrgPicker";
import { RejectDialog } from "@/features/triage/RejectDialog";
import { TriageRow } from "@/features/triage/TriageRow";
import type { TriageRejectPayload } from "@/features/triage/triageReasons";

interface AssignContext {
  invoiceIds: string[];
  customerGstinHints: string[];
}

interface RejectContext {
  invoiceIds: string[];
}

interface BulkOutcome {
  action: "assign" | "reject";
  okCount: number;
  totalCount: number;
  failedInvoiceNumbers: string[];
}

function gstinPrefixFor(gstin: string): string {
  return gstin.replace(/\s/g, "").slice(0, 6).toUpperCase();
}

function buildClientOrgPrefixMap(rows: ClientOrganization[] | undefined): Map<string, ClientOrgOption> {
  const map = new Map<string, ClientOrgOption>();
  if (!rows) return map;
  for (const row of rows) {
    if (!row._id || !row.companyName || !row.gstin) continue;
    const prefix = gstinPrefixFor(row.gstin);
    if (prefix.length < 4) continue;
    map.set(prefix, { id: row._id, companyName: row.companyName });
  }
  return map;
}

function suggestClientOrgs(
  clientOrgs: ClientOrgOption[] | undefined,
  hints: string[],
  fullClientOrgsByPrefix: Map<string, ClientOrgOption>
): ClientOrgOption[] {
  if (!clientOrgs || clientOrgs.length === 0 || hints.length === 0) return [];
  const matched = new Map<string, ClientOrgOption>();
  for (const hint of hints) {
    const prefix = gstinPrefixFor(hint);
    if (prefix.length < 4) continue;
    const candidate = fullClientOrgsByPrefix.get(prefix);
    if (candidate) matched.set(candidate.id, candidate);
  }
  return Array.from(matched.values());
}

function invoiceLabel(invoice: TriageInvoice | undefined): string {
  if (!invoice) return "Unknown";
  return invoice.invoiceNumber ?? invoice._id;
}

interface BulkAssignResult {
  ok: string[];
  failed: Array<{ invoiceId: string; error: unknown }>;
}

interface BulkRejectResult extends BulkAssignResult {}

async function runBulkAssign(invoiceIds: string[], clientOrgId: string): Promise<BulkAssignResult> {
  const ok: string[] = [];
  const failed: BulkAssignResult["failed"] = [];
  for (const invoiceId of invoiceIds) {
    try {
      await assignClientOrg(invoiceId, clientOrgId);
      ok.push(invoiceId);
    } catch (error) {
      failed.push({ invoiceId, error });
    }
  }
  return { ok, failed };
}

async function runBulkReject(invoiceIds: string[], payload: TriageRejectPayload): Promise<BulkRejectResult> {
  const ok: string[] = [];
  const failed: BulkRejectResult["failed"] = [];
  for (const invoiceId of invoiceIds) {
    try {
      await rejectInvoice(invoiceId, payload);
      ok.push(invoiceId);
    } catch (error) {
      failed.push({ invoiceId, error });
    }
  }
  return { ok, failed };
}

export function TriagePage() {
  const queryClient = useQueryClient();
  const queue = useTriageQueue();
  const clientOrgs = useTenantClientOrgs();
  const adminList = useClientOrgsAdminList();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignContext, setAssignContext] = useState<AssignContext | null>(null);
  const [rejectContext, setRejectContext] = useState<RejectContext | null>(null);
  const [pendingMutationIds, setPendingMutationIds] = useState<Set<string>>(new Set());
  const [bulkOutcome, setBulkOutcome] = useState<BulkOutcome | null>(null);

  const invoicesById = useMemo(() => {
    const map = new Map<string, TriageInvoice>();
    for (const invoice of queue.invoices) map.set(invoice._id, invoice);
    return map;
  }, [queue.invoices]);

  const fullClientOrgsByPrefix = useMemo(
    () => buildClientOrgPrefixMap(adminList.data),
    [adminList.data]
  );

  const removeFromCache = useCallback(
    (ids: string[]) => {
      queryClient.setQueryData<TriageListResponse>(TRIAGE_QUEUE_QUERY_KEY, (prev) => {
        if (!prev) return prev;
        const idSet = new Set(ids);
        const items = prev.items.filter((invoice) => !idSet.has(invoice._id));
        return { items, total: Math.max(0, prev.total - (prev.items.length - items.length)) };
      });
    },
    [queryClient]
  );

  const markPending = useCallback((ids: string[], pending: boolean) => {
    setPendingMutationIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (pending) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const assignMutation = useMutation({
    mutationFn: async (params: { invoiceIds: string[]; clientOrgId: string }) =>
      runBulkAssign(params.invoiceIds, params.clientOrgId)
  });

  const rejectMutation = useMutation({
    mutationFn: async (params: { invoiceIds: string[]; payload: TriageRejectPayload }) =>
      runBulkReject(params.invoiceIds, params.payload)
  });

  function clearSelection(removed: string[]) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of removed) next.delete(id);
      return next;
    });
  }

  function applyBulkResult(
    action: BulkOutcome["action"],
    requestedIds: string[],
    result: BulkAssignResult
  ) {
    if (result.ok.length > 0) removeFromCache(result.ok);
    clearSelection(result.ok);
    if (result.failed.length > 0) {
      const failedNumbers = result.failed.map((entry) =>
        invoiceLabel(invoicesById.get(entry.invoiceId))
      );
      setBulkOutcome({
        action,
        okCount: result.ok.length,
        totalCount: requestedIds.length,
        failedInvoiceNumbers: failedNumbers
      });
    } else {
      setBulkOutcome(null);
    }
  }

  function handleAssign(option: ClientOrgOption) {
    if (!assignContext) return;
    const ids = assignContext.invoiceIds;
    setAssignContext(null);
    markPending(ids, true);
    assignMutation.mutate(
      { invoiceIds: ids, clientOrgId: option.id },
      {
        onSuccess: (result) => {
          applyBulkResult("assign", ids, result);
        },
        onSettled: () => {
          markPending(ids, false);
          void queryClient.invalidateQueries({ queryKey: TRIAGE_QUEUE_QUERY_KEY });
        }
      }
    );
  }

  function handleReject(payload: TriageRejectPayload) {
    if (!rejectContext) return;
    const ids = rejectContext.invoiceIds;
    setRejectContext(null);
    markPending(ids, true);
    rejectMutation.mutate(
      { invoiceIds: ids, payload },
      {
        onSuccess: (result) => {
          applyBulkResult("reject", ids, result);
        },
        onSettled: () => {
          markPending(ids, false);
          void queryClient.invalidateQueries({ queryKey: TRIAGE_QUEUE_QUERY_KEY });
        }
      }
    );
  }

  function openAssign(invoiceIds: string[]) {
    const hints: string[] = [];
    for (const id of invoiceIds) {
      const invoice = invoicesById.get(id);
      if (invoice?.customerGstin) hints.push(invoice.customerGstin);
    }
    setAssignContext({ invoiceIds, customerGstinHints: hints });
  }

  function openReject(invoiceIds: string[]) {
    setRejectContext({ invoiceIds });
  }

  function toggleRow(invoiceId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(invoiceId)) next.delete(invoiceId);
      else next.add(invoiceId);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((prev) => {
      if (prev.size === queue.invoices.length) return new Set();
      return new Set(queue.invoices.map((invoice) => invoice._id));
    });
  }

  if (queue.isLoading) {
    return (
      <div className="triage-page" data-testid="triage-page-loading">
        <div className="page-header">
          <h1>Inbox Routing</h1>
          <span className="count">loading…</span>
        </div>
        <div className="triage-state" data-testid="triage-loading">
          Loading triage queue…
        </div>
      </div>
    );
  }

  if (queue.isError) {
    return (
      <div className="triage-page" data-testid="triage-page-error">
        <div className="page-header">
          <h1>Inbox Routing</h1>
        </div>
        <div className="triage-state" data-testid="triage-error">
          <EmptyState
            icon="error"
            heading="Couldn't load the triage queue"
            description="The server didn't respond. Try again."
            action={
              <button
                type="button"
                className="app-button app-button-secondary"
                onClick={() => void queue.refetch()}
                data-testid="triage-error-retry"
              >
                Retry
              </button>
            }
          />
        </div>
      </div>
    );
  }

  if (queue.invoices.length === 0) {
    return (
      <div className="triage-page" data-testid="triage-page-empty">
        <div className="page-header">
          <h1>Inbox Routing</h1>
          <span className="count">0 unrouted</span>
        </div>
        <div className="triage-state" data-testid="triage-empty">
          <EmptyState
            icon="inbox"
            heading="All caught up"
            description="No invoices waiting for triage."
          />
        </div>
      </div>
    );
  }

  const allSelected = selectedIds.size === queue.invoices.length;
  const someSelected = selectedIds.size > 0 && !allSelected;
  const selectedArray = queue.invoices
    .filter((invoice) => selectedIds.has(invoice._id))
    .map((invoice) => invoice._id);
  const bulkDisabled = selectedArray.length === 0;
  const suggestedForAssign = assignContext
    ? suggestClientOrgs(clientOrgs.clientOrgs, assignContext.customerGstinHints, fullClientOrgsByPrefix)
    : [];

  return (
    <div className="triage-page" data-testid="triage-page">
      <div className="page-header">
        <h1>Inbox Routing</h1>
        <span className="count">
          {queue.total} unrouted · {queue.total === 1 ? "invoice" : "invoices"} waiting for assignment
        </span>
      </div>

      <div className="triage-info-banner">
        <span className="material-symbols-outlined" aria-hidden="true">info</span>
        <span>
          These invoices arrived in the firm-wide mailbox but the system could not auto-route them
          to a client org. Pick the right destination — this is a routing decision, not an approval
          decision.
        </span>
      </div>

      {selectedIds.size > 0 ? (
        <div
          className="triage-bulk-bar"
          data-testid="triage-bulk-bar"
        >
          <span className="triage-bulk-count">{selectedIds.size} selected</span>
          <span className="triage-bulk-divider" aria-hidden="true" />
          <div className="triage-bulk-actions">
            <button
              type="button"
              className="app-button app-button-primary"
              disabled={bulkDisabled}
              onClick={() => openAssign(selectedArray)}
              data-testid="triage-bulk-assign"
            >
              Assign selected
            </button>
            <button
              type="button"
              className="app-button app-button-secondary"
              disabled={bulkDisabled}
              onClick={() => openReject(selectedArray)}
              data-testid="triage-bulk-reject"
            >
              Reject selected
            </button>
            <button
              type="button"
              className="app-button app-button-ghost"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear selection
            </button>
          </div>
        </div>
      ) : null}

      {bulkOutcome ? (
        <div
          className="triage-bulk-banner"
          role="status"
          aria-live="polite"
          data-testid="triage-bulk-outcome"
          data-action={bulkOutcome.action}
        >
          <p>
            {bulkOutcome.okCount} of {bulkOutcome.totalCount} invoice
            {bulkOutcome.totalCount === 1 ? "" : "s"}{" "}
            {bulkOutcome.action === "assign" ? "assigned" : "rejected"}.{" "}
            {bulkOutcome.failedInvoiceNumbers.length} failed:{" "}
            <span data-testid="triage-bulk-outcome-failed">
              {bulkOutcome.failedInvoiceNumbers.join(", ")}
            </span>
            .
          </p>
          <button
            type="button"
            className="app-button app-button-secondary"
            onClick={() => setBulkOutcome(null)}
            data-testid="triage-bulk-outcome-dismiss"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="table-wrap">
        <table className="lbtable triage-table" data-testid="triage-table">
          <thead>
            <tr>
              <th className="triage-th-select">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  aria-label="Select all triage invoices"
                  data-testid="triage-select-all"
                />
              </th>
              <th>Invoice #</th>
              <th>Vendor</th>
              <th>Customer</th>
              <th className="triage-th-amount">Amount</th>
              <th>Source mailbox</th>
              <th>Received</th>
              <th aria-label="Row actions" className="triage-th-actions" />
            </tr>
          </thead>
          <tbody>
            {queue.invoices.map((invoice) => (
              <TriageRow
                key={invoice._id}
                invoice={invoice}
                selected={selectedIds.has(invoice._id)}
                onToggleSelected={() => toggleRow(invoice._id)}
                onAssign={() => openAssign([invoice._id])}
                onReject={() => openReject([invoice._id])}
                isMutating={pendingMutationIds.has(invoice._id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <ClientOrgPicker
        open={assignContext !== null}
        onClose={() => setAssignContext(null)}
        onSelect={handleAssign}
        clientOrgs={clientOrgs.clientOrgs}
        isLoading={clientOrgs.isLoading}
        isError={clientOrgs.isError}
        onRetry={() => void clientOrgs.refetch()}
        title={
          assignContext && assignContext.invoiceIds.length > 1
            ? `Assign ${assignContext.invoiceIds.length} invoices to a client`
            : "Assign invoice to a client"
        }
        placeholder="Search clients by company name..."
        emptyHelpText="No clients yet — onboard one before triaging."
        testIdPrefix="triage-picker"
        suggested={suggestedForAssign}
      />
      <RejectDialog
        open={rejectContext !== null}
        invoiceCount={rejectContext?.invoiceIds.length ?? 0}
        isSubmitting={rejectMutation.isPending}
        onCancel={() => setRejectContext(null)}
        onConfirm={handleReject}
      />
    </div>
  );
}
