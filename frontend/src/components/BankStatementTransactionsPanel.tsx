import { useState, useEffect, useCallback } from "react";
import type { BankTransactionEntry } from "../types";
import { fetchBankTransactions, reconcileStatement, matchTransactionToInvoice, unmatchTransaction } from "../api/bank";

interface BankStatementTransactionsPanelProps {
  statementId: string;
  onClose: () => void;
}

function fmtMinor(amount: number | null, color?: string): JSX.Element | null {
  if (amount == null) return null;
  const formatted = (amount / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <span style={{ color }}>{formatted}</span>;
}

function MatchStatusBadge({ status }: { status: BankTransactionEntry["matchStatus"] }) {
  if (status === "matched") {
    return <span className="bank-status-badge bank-status-active">Matched</span>;
  }
  if (status === "suggested") {
    return <span className="bank-status-badge bank-status-pending">Suggested</span>;
  }
  if (status === "manual") {
    return <span className="bank-status-badge" style={{ background: "#dbeafe", color: "#1e40af" }}>Manual</span>;
  }
  return <span className="bank-status-badge" style={{ background: "#f1f5f9", color: "#475569" }}>Unmatched</span>;
}

export function BankStatementTransactionsPanel({ statementId, onClose }: BankStatementTransactionsPanelProps) {
  const [transactions, setTransactions] = useState<BankTransactionEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: { page: number; limit: number; status?: string } = { page, limit };
      if (statusFilter) params.status = statusFilter;
      const result = await fetchBankTransactions(statementId, params);
      setTransactions(result.items);
      setTotal(result.total);
    } catch {
      setError("Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  }, [statementId, page, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleReconcile() {
    setReconciling(true);
    setError(null);
    try {
      await reconcileStatement(statementId);
      await load();
    } catch {
      setError("Reconciliation failed.");
    } finally {
      setReconciling(false);
    }
  }

  async function handleConfirm(txn: BankTransactionEntry) {
    if (!txn.matchedInvoiceId) return;
    try {
      await matchTransactionToInvoice(txn._id, txn.matchedInvoiceId);
      await load();
    } catch {
      setError("Failed to confirm match.");
    }
  }

  async function handleUnmatch(txnId: string) {
    try {
      await unmatchTransaction(txnId);
      await load();
    } catch {
      setError("Failed to unmatch transaction.");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="editor-card" style={{ marginTop: "1rem" }}>
      <div className="editor-header" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        <h3 style={{ margin: 0 }}>Transactions</h3>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginLeft: "auto" }}>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            style={{ fontSize: "0.82rem" }}
          >
            <option value="">All statuses</option>
            <option value="unmatched">Unmatched</option>
            <option value="suggested">Suggested</option>
            <option value="matched">Matched</option>
            <option value="manual">Manual</option>
          </select>
          <button
            type="button"
            className="app-button app-button-secondary"
            style={{ fontSize: "0.8rem", padding: "0.25rem 0.75rem" }}
            onClick={() => void handleReconcile()}
            disabled={reconciling}
          >
            {reconciling ? "Reconciling…" : "Re-reconcile"}
          </button>
          <button
            type="button"
            className="collapse-button"
            onClick={onClose}
            aria-label="Close transactions panel"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>

      {error ? (
        <p style={{ color: "var(--warn, #991b1b)", fontSize: "0.85rem", margin: "0.5rem 0" }}>{error}</p>
      ) : null}

      {loading ? (
        <p className="muted" style={{ padding: "1rem 0" }}>Loading…</p>
      ) : transactions.length === 0 ? (
        <p className="muted" style={{ padding: "1rem 0" }}>No transactions found.</p>
      ) : (
        <>
          <div className="table-card" style={{ marginTop: "0.75rem", overflowX: "auto" }}>
            <table className="line-items-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Reference</th>
                  <th style={{ textAlign: "right" }}>Debit</th>
                  <th style={{ textAlign: "right" }}>Credit</th>
                  <th style={{ textAlign: "right" }}>Balance</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => (
                  <tr key={txn._id}>
                    <td style={{ whiteSpace: "nowrap" }}>{txn.date}</td>
                    <td><div className="table-cell-scroll">{txn.description}</div></td>
                    <td><div className="table-cell-scroll">{txn.reference ?? "-"}</div></td>
                    <td style={{ textAlign: "right" }}>{fmtMinor(txn.debitMinor, "#991b1b")}</td>
                    <td style={{ textAlign: "right" }}>{fmtMinor(txn.creditMinor, "#166534")}</td>
                    <td style={{ textAlign: "right" }}>{fmtMinor(txn.balanceMinor)}</td>
                    <td><MatchStatusBadge status={txn.matchStatus} /></td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {txn.matchStatus === "suggested" ? (
                        <div style={{ display: "flex", gap: "0.35rem" }}>
                          <button
                            type="button"
                            className="app-button app-button-primary"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                            onClick={() => void handleConfirm(txn)}
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            className="app-button app-button-secondary"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                            onClick={() => void handleUnmatch(txn._id)}
                          >
                            Reject
                          </button>
                        </div>
                      ) : txn.matchStatus === "matched" || txn.matchStatus === "manual" ? (
                        <button
                          type="button"
                          className="app-button app-button-secondary"
                          style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                          onClick={() => void handleUnmatch(txn._id)}
                        >
                          Unmatch
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", justifyContent: "flex-end", marginTop: "0.75rem", fontSize: "0.82rem" }}>
              <button
                type="button"
                className="app-button app-button-secondary"
                style={{ fontSize: "0.78rem", padding: "0.2rem 0.6rem" }}
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </button>
              <span className="muted">Page {page} of {totalPages}</span>
              <button
                type="button"
                className="app-button app-button-secondary"
                style={{ fontSize: "0.78rem", padding: "0.2rem 0.6rem" }}
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
