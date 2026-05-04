import { useCallback, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Spinner } from "@/components/ds";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useTenantClientOrgs } from "@/hooks/useTenantClientOrgs";
import {
  MAILBOX_ASSIGNMENTS_QUERY_KEY,
  useMailboxAssignments
} from "@/hooks/useMailboxAssignments";
import {
  recentIngestionsQueryKey,
  useRecentIngestionCounts
} from "@/hooks/useRecentIngestions";
import { getUserFacingErrorMessage } from "@/lib/common/apiError";
import {
  createMailboxAssignment,
  deleteMailboxAssignment,
  updateMailboxAssignment,
  type MailboxAssignment
} from "@/api/mailboxAssignments";
import {
  MAILBOX_FORM_MODE,
  MailboxFormPanel,
  type MailboxFormMode,
  type MailboxFormValues
} from "@/features/admin/mailboxes/MailboxFormPanel";
import { MailboxesTable } from "@/features/admin/mailboxes/MailboxesTable";
import { RecentIngestionsDrawer } from "@/features/admin/mailboxes/RecentIngestionsDrawer";

const RECENT_INGESTIONS_WINDOW_DAYS = 30;

export const MAILBOXES_PAGE_VIEW = {
  Loading: "loading",
  Error: "error",
  Empty: "empty",
  Data: "data"
} as const;

type MailboxesPageView = typeof MAILBOXES_PAGE_VIEW[keyof typeof MAILBOXES_PAGE_VIEW];

interface FormState {
  open: boolean;
  mode: MailboxFormMode;
  target: MailboxAssignment | null;
  errorMessage: string | null;
}

const INITIAL_FORM_STATE: FormState = {
  open: false,
  mode: MAILBOX_FORM_MODE.Add,
  target: null,
  errorMessage: null
};

export function MailboxesPage() {
  const query = useMailboxAssignments();
  const queryClient = useQueryClient();
  const tenantClientOrgs = useTenantClientOrgs();

  const [formState, setFormState] = useState<FormState>(INITIAL_FORM_STATE);
  const [deleteTarget, setDeleteTarget] = useState<MailboxAssignment | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [drawerTarget, setDrawerTarget] = useState<MailboxAssignment | null>(null);

  const invalidateList = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: MAILBOX_ASSIGNMENTS_QUERY_KEY });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: createMailboxAssignment,
    onSuccess: () => {
      invalidateList();
      setFormState(INITIAL_FORM_STATE);
    },
    onError: (error: unknown) => {
      setFormState((current) => ({
        ...current,
        errorMessage: getUserFacingErrorMessage(error, "Failed to create the mailbox assignment.")
      }));
    }
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; values: MailboxFormValues }) =>
      updateMailboxAssignment(input.id, { clientOrgIds: input.values.clientOrgIds }),
    onSuccess: () => {
      invalidateList();
      setFormState(INITIAL_FORM_STATE);
    },
    onError: (error: unknown) => {
      setFormState((current) => ({
        ...current,
        errorMessage: getUserFacingErrorMessage(error, "Failed to update the mailbox assignment.")
      }));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMailboxAssignment,
    onSuccess: () => {
      invalidateList();
      setDeleteTarget(null);
      setDeleteError(null);
    },
    onError: (error: unknown) => {
      setDeleteError(
        getUserFacingErrorMessage(error, "Failed to delete the mailbox assignment.")
      );
    }
  });

  const view: MailboxesPageView = (() => {
    if (query.status === "pending") return MAILBOXES_PAGE_VIEW.Loading;
    if (query.status === "error") return MAILBOXES_PAGE_VIEW.Error;
    if ((query.data ?? []).length === 0) return MAILBOXES_PAGE_VIEW.Empty;
    return MAILBOXES_PAGE_VIEW.Data;
  })();

  const items = query.data ?? [];

  const assignmentIds = useMemo(
    () => items.map((a) => a._id),
    [items]
  );
  const { countsById: ingestionCounts } = useRecentIngestionCounts({
    assignmentIds,
    days: RECENT_INGESTIONS_WINDOW_DAYS
  });

  const retryIngestionCount = useCallback(
    (assignmentId: string) => {
      void queryClient.invalidateQueries({
        queryKey: recentIngestionsQueryKey(assignmentId, RECENT_INGESTIONS_WINDOW_DAYS, 1)
      });
    },
    [queryClient]
  );

  const openAddForm = useCallback(() => {
    setFormState({ open: true, mode: MAILBOX_FORM_MODE.Add, target: null, errorMessage: null });
  }, []);

  const openEditForm = useCallback((target: MailboxAssignment) => {
    setFormState({ open: true, mode: MAILBOX_FORM_MODE.Edit, target, errorMessage: null });
  }, []);

  const handleSubmit = useCallback(
    async (values: MailboxFormValues) => {
      if (formState.mode === MAILBOX_FORM_MODE.Edit && formState.target) {
        await updateMutation.mutateAsync({ id: formState.target._id, values });
        return;
      }
      await createMutation.mutateAsync({
        integrationId: values.integrationId,
        clientOrgIds: values.clientOrgIds
      });
    },
    [createMutation, updateMutation, formState]
  );

  const submitting = createMutation.isPending || updateMutation.isPending;

  const totalIngested = useMemo(() => {
    let sum = 0;
    for (const id of assignmentIds) {
      const count = ingestionCounts[id];
      if (typeof count === "number") sum += count;
    }
    return sum;
  }, [assignmentIds, ingestionCounts]);

  return (
    <section
      className="mailboxes-r10"
      data-testid="mailboxes-page"
      data-view={view}
      aria-busy={view === MAILBOXES_PAGE_VIEW.Loading || undefined}
    >
      <div className="page-header">
        <h1>Mailboxes</h1>
        <span className="count">
          {view === MAILBOXES_PAGE_VIEW.Data
            ? `${items.length} connected · ${totalIngested} ingested (30d)`
            : view === MAILBOXES_PAGE_VIEW.Loading
              ? "loading…"
              : "0 connected"}
        </span>
        {view === MAILBOXES_PAGE_VIEW.Data ? (
          <div className="page-tools">
            <Button onClick={openAddForm} icon="add" data-testid="mailboxes-add-button">
              Add mailbox assignment
            </Button>
          </div>
        ) : null}
      </div>

      {view === MAILBOXES_PAGE_VIEW.Loading ? (
        <div
          className="mailboxes-r10-state"
          data-testid="mailboxes-loading"
          role="status"
          aria-live="polite"
        >
          <Spinner />
          <p>Loading mailbox assignments…</p>
        </div>
      ) : null}

      {view === MAILBOXES_PAGE_VIEW.Error ? (
        <div
          className="mailboxes-r10-state mailboxes-r10-state-error"
          data-testid="mailboxes-error"
          role="alert"
        >
          <p>{getUserFacingErrorMessage(query.error, "Couldn't load mailbox assignments.")}</p>
          <Button onClick={() => void query.refetch()} variant="secondary">
            Retry
          </Button>
        </div>
      ) : null}

      {view === MAILBOXES_PAGE_VIEW.Empty ? (
        <div className="mailboxes-r10-state" data-testid="mailboxes-empty">
          <h2>No mailboxes connected yet</h2>
          <p>
            Connect a Gmail mailbox in Settings &gt; Integrations, then map it
            to one or more Client Organizations to start polling invoices.
          </p>
          <Button onClick={openAddForm} icon="add" data-testid="mailboxes-empty-cta">
            Add mailbox assignment
          </Button>
        </div>
      ) : null}

      {view === MAILBOXES_PAGE_VIEW.Data ? (
        <MailboxesTable
          items={items}
          clientOrgs={tenantClientOrgs.clientOrgs}
          ingestionCounts={ingestionCounts}
          onEdit={openEditForm}
          onDelete={(target) => {
            setDeleteError(null);
            setDeleteTarget(target);
          }}
          onViewRecent={(target) => setDrawerTarget(target)}
          onRetryCount={retryIngestionCount}
        />
      ) : null}

      <RecentIngestionsDrawer
        open={drawerTarget !== null}
        assignmentId={drawerTarget?._id ?? null}
        mailboxEmail={drawerTarget?.email ?? null}
        clientOrgs={tenantClientOrgs.clientOrgs}
        onClose={() => setDrawerTarget(null)}
      />

      <MailboxFormPanel
        open={formState.open}
        mode={formState.mode}
        initial={formState.target}
        clientOrgs={tenantClientOrgs.clientOrgs}
        clientOrgsLoading={tenantClientOrgs.isLoading}
        clientOrgsError={tenantClientOrgs.isError}
        onClientOrgsRetry={() => void tenantClientOrgs.refetch()}
        submitting={submitting}
        errorMessage={formState.errorMessage}
        onSubmit={handleSubmit}
        onClose={() => setFormState(INITIAL_FORM_STATE)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete mailbox assignment?"
        message={
          deleteError ??
          `Removing the mapping for "${deleteTarget?.email ?? "(unknown mailbox)"}" stops new invoices from auto-routing to its current client organizations. Existing invoices stay assigned.`
        }
        confirmLabel={deleteMutation.isPending ? "Deleting…" : "Delete"}
        destructive
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget._id);
          }
        }}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
      />
    </section>
  );
}
