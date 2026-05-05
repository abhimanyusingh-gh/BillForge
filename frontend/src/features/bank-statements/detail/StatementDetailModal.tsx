import { useCallback, useEffect, useMemo, useState } from "react";
import { bankService } from "@/api/bankService";
import type { BankStatementMatchView } from "@/domain/bank/transaction";
import { useBankContext } from "@/features/bank-statements/internal";
import { TransactionTable } from "@/features/bank-statements/detail/TransactionTable";
import { TransactionMatchPanel } from "@/features/bank-statements/detail/TransactionMatchPanel";
import type { BankStatementId, TransactionId } from "@/types/ids";

const RECON_STATUS = {
  IDLE: "idle",
  PENDING: "pending",
  SUCCESS: "success",
  ERROR: "error"
} as const;

type ReconStatus = (typeof RECON_STATUS)[keyof typeof RECON_STATUS];

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

interface StatementDetailState {
  view: BankStatementMatchView | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

function useStatementDetail(statementId: BankStatementId | null): StatementDetailState {
  const ctx = useBankContext();
  const [view, setView] = useState<BankStatementMatchView | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState<number>(0);

  useEffect(() => {
    if (ctx === null || statementId === null) {
      setView(null);
      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    bankService
      .getStatementMatches({
        tenantId: ctx.tenantId,
        clientOrgId: ctx.clientOrgId,
        statementId,
        signal: controller.signal
      })
      .then((result) => {
        setView(result);
        setIsLoading(false);
      })
      .catch((caught: unknown) => {
        if (isAbortError(caught)) return;
        setError(caught instanceof Error ? caught.message : "Failed to load transactions.");
        setIsLoading(false);
      });
    return () => controller.abort();
  }, [ctx?.tenantId, ctx?.clientOrgId, statementId, reloadToken]);

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  return { view, isLoading, error, reload };
}

interface ReconHookState {
  status: ReconStatus;
  error: string | null;
  reconcile: (statementId: BankStatementId) => Promise<boolean>;
}

function useReconcileStatement(onSuccess?: () => void): ReconHookState {
  const ctx = useBankContext();
  const [status, setStatus] = useState<ReconStatus>(RECON_STATUS.IDLE);
  const [error, setError] = useState<string | null>(null);

  const reconcile = useCallback(
    async (statementId: BankStatementId): Promise<boolean> => {
      if (ctx === null) {
        setError("No active client org.");
        setStatus(RECON_STATUS.ERROR);
        return false;
      }
      setStatus(RECON_STATUS.PENDING);
      setError(null);
      try {
        await bankService.reconcileStatement({
          tenantId: ctx.tenantId,
          clientOrgId: ctx.clientOrgId,
          statementId
        });
        setStatus(RECON_STATUS.SUCCESS);
        if (onSuccess) onSuccess();
        return true;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Reconcile failed.");
        setStatus(RECON_STATUS.ERROR);
        return false;
      }
    },
    [ctx?.tenantId, ctx?.clientOrgId, onSuccess]
  );

  return { status, error, reconcile };
}

interface StatementDetailModalProps {
  statementId: BankStatementId;
  onClose: () => void;
  onChanged: () => void;
}

export function StatementDetailModal({ statementId, onClose, onChanged }: StatementDetailModalProps) {
  const { view, isLoading, error, reload } = useStatementDetail(statementId);
  const [activeId, setActiveId] = useState<TransactionId | null>(null);
  const { status: reconStatus, error: reconError, reconcile } = useReconcileStatement(() => {
    reload();
    onChanged();
  });

  const transactions = view?.items ?? [];
  const summary = view?.summary;

  const activeTxn = useMemo(() => {
    if (activeId === null) return transactions[0] ?? null;
    return transactions.find((t) => t.id === activeId) ?? null;
  }, [transactions, activeId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="bs-detail-scrim" role="dialog" aria-modal="true" aria-label="Statement detail">
      <div className="bs-detail" onClick={(e) => e.stopPropagation()}>
        <header className="bs-detail__header">
          <button type="button" className="bs-detail__back" onClick={onClose}>
            <span className="material-symbols-outlined" aria-hidden>
              arrow_back
            </span>
            Back
          </button>
          <div className="bs-detail__title">Bank statement</div>
          {summary ? (
            <div className="bs-detail__summary">
              <span>{summary.totalTransactions} txns</span>
              <span className="bs-detail__sep">·</span>
              <span>{summary.matched} matched</span>
              <span className="bs-detail__sep">·</span>
              <span>{summary.suggested} suggested</span>
              <span className="bs-detail__sep">·</span>
              <span>{summary.unmatched} unmatched</span>
            </div>
          ) : null}
          <button
            type="button"
            className="bs-detail__recon"
            onClick={() => void reconcile(statementId)}
            disabled={reconStatus === RECON_STATUS.PENDING}
          >
            {reconStatus === RECON_STATUS.PENDING ? "Reconciling…" : "Reconcile"}
          </button>
        </header>

        {error !== null ? (
          <div className="bs-detail__error" role="alert">
            {error}
          </div>
        ) : null}
        {reconError !== null ? (
          <div className="bs-detail__error" role="alert">
            {reconError}
          </div>
        ) : null}

        <div className="bs-detail__body">
          <div className="bs-detail__txn-pane">
            {isLoading && transactions.length === 0 ? (
              <div className="bs-detail__loading">Loading transactions…</div>
            ) : (
              <TransactionTable
                transactions={transactions}
                activeId={activeTxn?.id ?? null}
                onSelect={setActiveId}
              />
            )}
          </div>
          <TransactionMatchPanel
            transaction={activeTxn}
            onChanged={() => {
              reload();
              onChanged();
            }}
          />
        </div>
      </div>
    </div>
  );
}
