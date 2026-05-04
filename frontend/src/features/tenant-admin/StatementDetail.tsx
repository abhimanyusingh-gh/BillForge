import { useCallback, useEffect, useMemo, useState } from "react";
import type { BankStatementSummary, BankTransactionEntry, ReconciliationMatchItem, Invoice } from "@/types";
import {
  fetchBankTransactions,
  fetchStatementMatches,
  matchTransactionToInvoice,
  reconcileStatement,
  unmatchTransaction
} from "@/api/bank";
import type { BankTransactionFilterParams } from "@/api/bank";
import { apiClient } from "@/api/client";
import { invoiceUrls } from "@/api/urls/invoiceUrls";

const FILTER_OPTIONS = ["all", "unmatched", "suggested", "matched"] as const;
type FilterOption = (typeof FILTER_OPTIONS)[number];

interface StatementDetailProps {
  statement: BankStatementSummary;
  onClose: () => void;
  onChanged?: () => void;
}

function fmtMinor(amount: number | null | undefined): string {
  if (amount == null) return "-";
  return (amount / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StateChip({ status, confidence }: { status: BankTransactionEntry["matchStatus"]; confidence: number | null }) {
  if (status === "matched" || status === "manual") {
    return <span className="spill s-approved"><span className="dot" />MATCHED</span>;
  }
  if (status === "suggested") {
    const pct = confidence != null ? Math.round(confidence) : 0;
    return <span className="spill s-parsed"><span className="dot" />MATCH {pct}%</span>;
  }
  return <span className="spill s-needs_review"><span className="dot" />UNMATCHED</span>;
}

function TxnAmount({ debit, credit }: { debit: number | null; credit: number | null }) {
  if (debit && debit > 0) {
    return <span className="statement-detail-amount-debit">− {fmtMinor(debit)}</span>;
  }
  if (credit && credit > 0) {
    return <span className="statement-detail-amount-credit">+ {fmtMinor(credit)}</span>;
  }
  return <span className="muted">-</span>;
}

export function StatementDetail({ statement, onClose, onChanged }: StatementDetailProps) {
  const [txns, setTxns] = useState<BankTransactionEntry[]>([]);
  const [matchMap, setMatchMap] = useState<Map<string, ReconciliationMatchItem>>(new Map());
  const [summary, setSummary] = useState<{ matched: number; suggested: number; unmatched: number; totalTransactions: number } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterOption>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [candidates, setCandidates] = useState<Invoice[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);

  const buildParams = useCallback((): BankTransactionFilterParams => {
    const params: BankTransactionFilterParams = { page, limit: pageSize };
    if (filter !== "all") params.matchStatus = filter;
    if (search) params.search = search;
    return params;
  }, [page, pageSize, filter, search]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [txnResult, matchResult] = await Promise.all([
        fetchBankTransactions(statement._id, buildParams()),
        fetchStatementMatches(statement._id)
      ]);
      setTxns(txnResult.items);
      setTotal(txnResult.total);
      const map = new Map<string, ReconciliationMatchItem>();
      for (const item of matchResult.items) map.set(String(item._id), item);
      setMatchMap(map);
      setSummary(matchResult.summary);
      if (txnResult.items.length > 0) {
        const stillActive = txnResult.items.find((t) => t._id === activeId);
        if (!stillActive) setActiveId(txnResult.items.find((t) => t.matchStatus !== "matched" && t.matchStatus !== "manual")?._id ?? txnResult.items[0]._id);
      } else {
        setActiveId(null);
      }
    } catch {
      setError("Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  }, [statement._id, buildParams, activeId]);

  useEffect(() => {
    void reload();
  }, [statement._id, page, filter, search]);

  const active = useMemo(() => txns.find((t) => t._id === activeId) ?? null, [txns, activeId]);
  const activeMatch = active ? matchMap.get(String(active._id)) ?? null : null;
  const activeAmountMinor = active ? (active.debitMinor ?? 0) + (active.creditMinor ?? 0) : 0;

  useEffect(() => {
    if (!active) { setCandidates([]); return; }
    const ctrl = new AbortController();
    setCandidatesLoading(true);
    const params: Record<string, unknown> = { limit: 6, page: 1 };
    if (statement.gstin) params.gstin = statement.gstin;
    if (active.reference) params.search = active.reference;
    apiClient.get<{ items: Invoice[] }>(invoiceUrls.list(), { params, signal: ctrl.signal })
      .then((resp) => setCandidates(resp.data.items))
      .catch(() => setCandidates([]))
      .finally(() => setCandidatesLoading(false));
    return () => ctrl.abort();
  }, [active?._id, statement.gstin]);

  const handleConfirm = useCallback(async (txn: BankTransactionEntry, invoiceId: string) => {
    try {
      await matchTransactionToInvoice(txn._id, invoiceId);
      await reload();
      onChanged?.();
    } catch {
      setError("Failed to match transaction.");
    }
  }, [reload, onChanged]);

  const handleClearMatch = useCallback(async (txn: BankTransactionEntry) => {
    try {
      await unmatchTransaction(txn._id);
      await reload();
      onChanged?.();
    } catch {
      setError("Failed to unmatch.");
    }
  }, [reload, onChanged]);

  const handleAutoMatch = useCallback(async () => {
    setReconciling(true);
    try {
      await reconcileStatement(statement._id);
      await reload();
      onChanged?.();
    } catch {
      setError("Auto-match failed.");
    } finally {
      setReconciling(false);
    }
  }, [statement._id, reload, onChanged]);

  const counts = summary ?? { matched: 0, suggested: 0, unmatched: 0, totalTransactions: total };
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="scrim" onClick={onClose}>
      <div className="statement-detail-shell" onClick={(e) => e.stopPropagation()}>
        <div className="statement-detail-header">
          <button type="button" className="statement-detail-back" onClick={onClose}>
            <span className="material-symbols-outlined statement-detail-back-icon">arrow_back</span>
            Back
          </button>
          <div className="statement-detail-breadcrumb">
            <button type="button" className="statement-detail-crumb-link" onClick={onClose}>Bank Statements</button>
            <span className="material-symbols-outlined statement-detail-crumb-sep">chevron_right</span>
            <span className="lb-mono statement-detail-crumb-file">{statement.fileName}</span>
          </div>
          <span className="statement-detail-meta">
            {statement.bankName ?? "Account"}{statement.accountNumberMasked ? ` ${statement.accountNumberMasked}` : ""} · {statement.periodFrom ?? "-"} to {statement.periodTo ?? "-"} · {counts.totalTransactions} transactions
          </span>
          <div className="statement-detail-header-actions">
            <button type="button" className="app-button app-button-secondary app-button-sm" disabled={reconciling} onClick={() => void handleAutoMatch()}>
              <span className="material-symbols-outlined statement-detail-icon-inline">auto_awesome</span>
              {reconciling ? "Auto-matching..." : "Auto-match all"}
            </button>
          </div>
        </div>

        <div className="statement-detail-toolbar">
          <div className="statement-detail-search">
            <span className="material-symbols-outlined statement-detail-search-icon">search</span>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search description, reference..."
              className="statement-detail-search-input"
            />
          </div>
          <div className="statement-detail-chips">
            {FILTER_OPTIONS.map((id) => {
              const count = id === "all" ? counts.totalTransactions
                : id === "matched" ? counts.matched
                : id === "suggested" ? counts.suggested
                : counts.unmatched;
              const label = id.charAt(0).toUpperCase() + id.slice(1);
              return (
                <button
                  key={id}
                  type="button"
                  className={`statement-detail-chip${filter === id ? " statement-detail-chip-active" : ""}`}
                  onClick={() => { setFilter(id); setPage(1); }}
                >
                  {label}<span className="statement-detail-chip-count">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="statement-detail-body">
          <div className="statement-detail-list">
            {loading ? (
              <div className="statement-detail-loading"><span className="muted">Loading transactions...</span></div>
            ) : error ? (
              <div className="statement-detail-error">{error}</div>
            ) : txns.length === 0 ? (
              <div className="statement-detail-empty"><span className="muted">No transactions match these filters.</span></div>
            ) : (
              <table className="lbtable statement-detail-table">
                <thead>
                  <tr>
                    <th className="statement-detail-col-date">Date</th>
                    <th>Description</th>
                    <th className="statement-detail-col-ref">Reference</th>
                    <th className="num-cell statement-detail-col-amt">Amount</th>
                    <th className="num-cell statement-detail-col-bal">Balance</th>
                    <th className="statement-detail-col-match">Matched / suggested</th>
                    <th className="statement-detail-col-state">State</th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map((t) => {
                    const isActive = activeId === t._id;
                    const detail = matchMap.get(String(t._id));
                    return (
                      <tr key={t._id} className={isActive ? "statement-detail-row-active" : undefined} onClick={() => setActiveId(t._id)}>
                        <td className="mono-cell statement-detail-cell-date">{t.date}</td>
                        <td className="statement-detail-cell-desc">{t.description}</td>
                        <td className="mono-cell statement-detail-cell-ref">{t.reference ?? "-"}</td>
                        <td className="num-cell"><TxnAmount debit={t.debitMinor} credit={t.creditMinor} /></td>
                        <td className="num-cell statement-detail-cell-bal">{fmtMinor(t.balanceMinor)}</td>
                        <td>
                          {detail?.invoice ? (
                            <div className="statement-detail-match-cell">
                              <span className="statement-detail-match-no">{detail.invoice.invoiceNumber ?? "-"}</span>
                              <span className="statement-detail-match-vendor">{detail.invoice.vendorName ?? ""}</span>
                            </div>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td><StateChip status={t.matchStatus} confidence={t.matchConfidence} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {total > pageSize && (
              <div className="pagination-bar statement-detail-pagination">
                <div className="pagination-info">Page {page} of {totalPages}</div>
                <div className="pagination-controls">
                  <button type="button" className="app-button app-button-secondary app-button-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
                  <button type="button" className="app-button app-button-secondary app-button-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
                </div>
              </div>
            )}
          </div>

          <aside className="statement-detail-panel">
            {active ? (
              <div className="statement-detail-panel-stack">
                <div>
                  <div className="statement-detail-panel-label">Selected transaction</div>
                  <div className="statement-detail-selected-card">
                    <div className="statement-detail-selected-meta">
                      <span className="statement-detail-selected-ref">{active.date} · {active.reference ?? "-"}</span>
                      <TxnAmount debit={active.debitMinor} credit={active.creditMinor} />
                    </div>
                    <div className="statement-detail-selected-desc">{active.description}</div>
                  </div>
                </div>

                <div>
                  <div className="statement-detail-panel-label-row">
                    <span className="statement-detail-panel-label">Match to invoice</span>
                    {active.matchedInvoiceId ? (
                      <button type="button" className="statement-detail-clear-btn" onClick={() => void handleClearMatch(active)}>Clear match</button>
                    ) : null}
                  </div>

                  {candidatesLoading ? (
                    <div className="muted statement-detail-cands-loading">Loading candidates...</div>
                  ) : candidates.length === 0 ? (
                    <div className="muted statement-detail-cands-empty">No close matches by amount or vendor.</div>
                  ) : (
                    <div className="statement-detail-cands">
                      {candidates.map((inv) => {
                        const on = active.matchedInvoiceId === inv._id;
                        const invAmt = inv.parsed?.totalAmountMinor ?? null;
                        const matchesAmount = invAmt != null && invAmt === activeAmountMinor;
                        return (
                          <button
                            key={inv._id}
                            type="button"
                            className={`statement-detail-cand${on ? " statement-detail-cand-on" : ""}`}
                            onClick={() => void handleConfirm(active, inv._id)}
                          >
                            <span className={`statement-detail-cand-radio${on ? " statement-detail-cand-radio-on" : ""}`} />
                            <div className="statement-detail-cand-body">
                              <div className="statement-detail-cand-no">{inv.parsed?.invoiceNumber ?? "-"}</div>
                              <div className="statement-detail-cand-vendor">{inv.parsed?.vendorName ?? "Unknown vendor"}{inv.parsed?.invoiceDate ? ` · ${inv.parsed.invoiceDate}` : ""}</div>
                            </div>
                            <div className="statement-detail-cand-amt-wrap">
                              <div className={`statement-detail-cand-amt${matchesAmount ? " statement-detail-cand-amt-match" : ""}`}>{fmtMinor(invAmt)}</div>
                              <div className="statement-detail-cand-status">{inv.status.toUpperCase()}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {activeMatch?.invoice ? (
                  <div className="statement-detail-expected">
                    <div className="statement-detail-panel-label">Expected vs actual</div>
                    <div className="statement-detail-expected-row">
                      <span>Invoice {activeMatch.invoice.invoiceNumber ?? "-"}</span>
                      <span className="statement-detail-expected-amt">{fmtMinor(activeMatch.invoice.totalAmountMinor)}</span>
                    </div>
                    <div className="statement-detail-expected-row">
                      <span>Bank debit</span>
                      <span className="statement-detail-expected-amt">{fmtMinor(activeAmountMinor)}</span>
                    </div>
                    {activeMatch.invoice.totalAmountMinor != null ? (
                      <div className={`statement-detail-expected-diff${activeMatch.invoice.totalAmountMinor === activeAmountMinor ? " diff-pos" : " diff-neg"}`}>
                        {activeMatch.invoice.totalAmountMinor === activeAmountMinor
                          ? "✓ matches expected debit (TDS-adjusted via parsed total)"
                          : `± ${fmtMinor(Math.abs((activeMatch.invoice.totalAmountMinor ?? 0) - activeAmountMinor))} variance`}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="muted statement-detail-panel-empty">Select a transaction to match.</div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
