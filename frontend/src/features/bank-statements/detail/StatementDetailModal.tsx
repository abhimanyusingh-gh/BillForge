import { useCallback, useEffect, useMemo, useState } from "react";
import { bankService } from "@/api/bankService";
import {
  BANK_TRANSACTION_MATCH_STATUS,
  type BankStatementMatchView,
  type BankTransaction
} from "@/domain/bank/transaction";
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

const FILTER = {
  ALL: "all",
  UNMATCHED: "unmatched",
  SUGGESTED: "suggested",
  MATCHED: "matched"
} as const;

type Filter = (typeof FILTER)[keyof typeof FILTER];

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

function txnInFilter(txn: BankTransaction, filter: Filter): boolean {
  if (filter === FILTER.ALL) return true;
  if (filter === FILTER.MATCHED) {
    return (
      txn.matchStatus === BANK_TRANSACTION_MATCH_STATUS.MATCHED ||
      txn.matchStatus === BANK_TRANSACTION_MATCH_STATUS.MANUAL
    );
  }
  if (filter === FILTER.SUGGESTED) {
    return txn.matchStatus === BANK_TRANSACTION_MATCH_STATUS.SUGGESTED;
  }
  return txn.matchStatus === BANK_TRANSACTION_MATCH_STATUS.UNMATCHED;
}

function txnInSearch(txn: BankTransaction, search: string): boolean {
  if (search.length === 0) return true;
  const q = search.toLowerCase();
  if (txn.description.toLowerCase().includes(q)) return true;
  if (txn.reference !== null && txn.reference.toLowerCase().includes(q)) return true;
  return false;
}

interface StatementDetailModalProps {
  statementId: BankStatementId;
  onClose: () => void;
  onChanged: () => void;
}

export function StatementDetailModal({ statementId, onClose, onChanged }: StatementDetailModalProps) {
  const { view, isLoading, error, reload } = useStatementDetail(statementId);
  const [activeId, setActiveId] = useState<TransactionId | null>(null);
  const [filter, setFilter] = useState<Filter>(FILTER.ALL);
  const [search, setSearch] = useState<string>("");
  const { status: reconStatus, error: reconError, reconcile } = useReconcileStatement(() => {
    reload();
    onChanged();
  });

  const transactions = view?.items ?? [];
  const summary = view?.summary;

  const filtered = useMemo(
    () => transactions.filter((t) => txnInFilter(t, filter) && txnInSearch(t, search)),
    [transactions, filter, search]
  );

  const activeTxn = useMemo(() => {
    if (activeId === null) return filtered[0] ?? transactions[0] ?? null;
    return transactions.find((t) => t.id === activeId) ?? null;
  }, [transactions, filtered, activeId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const counts = useMemo(() => {
    const matched = transactions.filter(
      (t) =>
        t.matchStatus === BANK_TRANSACTION_MATCH_STATUS.MATCHED ||
        t.matchStatus === BANK_TRANSACTION_MATCH_STATUS.MANUAL
    ).length;
    const suggested = transactions.filter(
      (t) => t.matchStatus === BANK_TRANSACTION_MATCH_STATUS.SUGGESTED
    ).length;
    const unmatched = transactions.filter(
      (t) => t.matchStatus === BANK_TRANSACTION_MATCH_STATUS.UNMATCHED
    ).length;
    return { all: transactions.length, matched, suggested, unmatched };
  }, [transactions]);

  return (
    <div
      className="bs-detail-scrim"
      role="dialog"
      aria-modal="true"
      aria-label="Statement detail"
      onClick={onClose}
    >
      <div className="bs-detail" onClick={(e) => e.stopPropagation()}>
        <header className="bs-detail__header">
          <button type="button" className="bs-detail__back" onClick={onClose}>
            <span className="material-symbols-outlined bs-detail__back-icon" aria-hidden>
              arrow_back
            </span>
            Back
          </button>
          <nav className="bs-detail__crumb" aria-label="Breadcrumb">
            <button type="button" className="bs-detail__crumb-link" onClick={onClose}>
              Bank Statements
            </button>
            <span className="material-symbols-outlined bs-detail__crumb-sep" aria-hidden>
              chevron_right
            </span>
            <span className="lb-mono bs-detail__crumb-current">Statement detail</span>
          </nav>
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
            {reconStatus === RECON_STATUS.PENDING ? "Auto-matching…" : "Auto-match all"}
          </button>
        </header>

        <div className="bs-detail__toolbar">
          <label className="bs-detail__search">
            <span className="material-symbols-outlined bs-detail__search-icon" aria-hidden>
              search
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search description, UTR…"
              aria-label="Search transactions"
            />
          </label>
          <div className="bs-detail__chips" role="tablist" aria-label="Filter transactions">
            {[
              { id: FILTER.ALL, label: "All", count: counts.all },
              { id: FILTER.UNMATCHED, label: "Unmatched", count: counts.unmatched },
              { id: FILTER.SUGGESTED, label: "Suggested", count: counts.suggested },
              { id: FILTER.MATCHED, label: "Matched", count: counts.matched }
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={filter === c.id}
                className={`bs-chip${filter === c.id ? " is-active" : ""}`}
                onClick={() => setFilter(c.id)}
              >
                {c.label}
                <span className="bs-chip__count">{c.count}</span>
              </button>
            ))}
          </div>
        </div>

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
                transactions={filtered}
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
