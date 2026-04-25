import { useCallback, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/components/common/EmptyState";
import { useTenantClientOrgs } from "@/hooks/useTenantClientOrgs";
import { useTriageQueue } from "@/hooks/useTriageQueue";
import {
  TRIAGE_QUEUE_QUERY_KEY,
  assignClientOrg,
  rejectInvoice,
  type TriageInvoice,
  type TriageListResponse
} from "@/api/triage";
import type { ClientOrgOption } from "@/components/workspace/HierarchyBadges";
import { ClientOrgPicker } from "@/features/triage/ClientOrgPicker";
import { RejectDialog } from "@/features/triage/RejectDialog";
import { TriageRow } from "@/features/triage/TriageRow";

interface AssignContext {
  invoiceIds: string[];
  customerGstinHints: string[];
}

interface RejectContext {
  invoiceIds: string[];
}

function gstinPrefixFor(gstin: string): string {
  return gstin.replace(/\s/g, "").slice(0, 6).toUpperCase();
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

export function TriagePage() {
  const queryClient = useQueryClient();
  const queue = useTriageQueue();
  const clientOrgs = useTenantClientOrgs();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignContext, setAssignContext] = useState<AssignContext | null>(null);
  const [rejectContext, setRejectContext] = useState<RejectContext | null>(null);
  const [pendingMutationIds, setPendingMutationIds] = useState<Set<string>>(new Set());

  const invoicesById = useMemo(() => {
    const map = new Map<string, TriageInvoice>();
    for (const invoice of queue.invoices) map.set(invoice._id, invoice);
    return map;
  }, [queue.invoices]);

  // For the GSTIN heuristic the picker needs the full clientOrg gstin, not just
  // the thin {id, companyName} option. We build a lookup keyed by the first 6
  // chars of the gstin (state code + first 4 PAN chars) — this is the same
  // proxy the BE resolveClientOrg uses for partial matches.
  const fullClientOrgsByPrefix = useMemo(() => {
    const map = new Map<string, ClientOrgOption>();
    const data = queryClient.getQueryData<unknown>(["tenantClientOrgs"]);
    if (!Array.isArray(data)) return map;
    for (const row of data as Array<{ _id?: string; companyName?: string; gstin?: string }>) {
      if (!row._id || !row.companyName || !row.gstin) continue;
      const prefix = gstinPrefixFor(row.gstin);
      if (prefix.length < 4) continue;
      map.set(prefix, { id: row._id, companyName: row.companyName });
    }
    return map;
  }, [queryClient, clientOrgs.clientOrgs]);

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

  const restoreSnapshot = useCallback(
    (snapshot: TriageListResponse | undefined) => {
      if (snapshot) queryClient.setQueryData(TRIAGE_QUEUE_QUERY_KEY, snapshot);
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
    mutationFn: async (params: { invoiceIds: string[]; clientOrgId: string }) => {
      for (const invoiceId of params.invoiceIds) {
        await assignClientOrg(invoiceId, params.clientOrgId);
      }
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async (params: { invoiceIds: string[]; reason: string }) => {
      for (const invoiceId of params.invoiceIds) {
        await rejectInvoice(invoiceId, params.reason);
      }
    }
  });

  function clearSelection(removed: string[]) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of removed) next.delete(id);
      return next;
    });
  }

  function handleAssign(option: ClientOrgOption) {
    if (!assignContext) return;
    const ids = assignContext.invoiceIds;
    setAssignContext(null);
    const snapshot = queryClient.getQueryData<TriageListResponse>(TRIAGE_QUEUE_QUERY_KEY);
    removeFromCache(ids);
    markPending(ids, true);
    assignMutation.mutate(
      { invoiceIds: ids, clientOrgId: option.id },
      {
        onError: () => {
          restoreSnapshot(snapshot);
        },
        onSuccess: () => {
          clearSelection(ids);
        },
        onSettled: () => {
          markPending(ids, false);
          void queryClient.invalidateQueries({ queryKey: TRIAGE_QUEUE_QUERY_KEY });
        }
      }
    );
  }

  function handleReject(reason: string) {
    if (!rejectContext) return;
    const ids = rejectContext.invoiceIds;
    setRejectContext(null);
    const snapshot = queryClient.getQueryData<TriageListResponse>(TRIAGE_QUEUE_QUERY_KEY);
    removeFromCache(ids);
    markPending(ids, true);
    rejectMutation.mutate(
      { invoiceIds: ids, reason },
      {
        onError: () => {
          restoreSnapshot(snapshot);
        },
        onSuccess: () => {
          clearSelection(ids);
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
      <section className="panel triage-panel" data-testid="triage-loading">
        <p>Loading triage queue...</p>
      </section>
    );
  }

  if (queue.isError) {
    return (
      <section className="panel triage-panel" data-testid="triage-error">
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
      </section>
    );
  }

  if (queue.invoices.length === 0) {
    return (
      <section className="panel triage-panel" data-testid="triage-empty">
        <EmptyState
          icon="inbox"
          heading="All caught up"
          description="No invoices waiting for triage."
        />
      </section>
    );
  }

  const allSelected = selectedIds.size === queue.invoices.length;
  const selectedArray = queue.invoices
    .filter((invoice) => selectedIds.has(invoice._id))
    .map((invoice) => invoice._id);
  const bulkDisabled = selectedArray.length === 0;
  const suggestedForAssign = assignContext
    ? suggestClientOrgs(clientOrgs.clientOrgs, assignContext.customerGstinHints, fullClientOrgsByPrefix)
    : [];

  return (
    <section className="panel triage-panel" data-testid="triage-page">
      <header className="triage-header">
        <div>
          <h2>Triage Queue</h2>
          <p className="triage-subhead">
            {queue.total} invoice{queue.total === 1 ? "" : "s"} waiting for a client assignment.
          </p>
        </div>
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
        </div>
      </header>
      <table className="triage-table" data-testid="triage-table">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Select all triage invoices"
                data-testid="triage-select-all"
              />
            </th>
            <th>Invoice #</th>
            <th>Vendor</th>
            <th>Customer</th>
            <th>Amount</th>
            <th>Source mailbox</th>
            <th>Received</th>
            <th aria-label="Row actions" />
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
    </section>
  );
}
