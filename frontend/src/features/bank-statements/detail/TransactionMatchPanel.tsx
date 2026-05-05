import { BANK_TRANSACTION_MATCH_STATUS, type BankTransaction } from "@/domain/bank/transaction";
import { formatDate, formatInr } from "@/features/bank-statements/internal";
import { useUnmatchTransaction } from "@/features/bank-statements/match/useMatchTransaction";

interface TransactionMatchPanelProps {
  transaction: BankTransaction | null;
  onChanged: () => void;
}

export function TransactionMatchPanel({ transaction, onChanged }: TransactionMatchPanelProps) {
  const { status: unmatchStatus, error: unmatchError, unmatch } = useUnmatchTransaction(onChanged);

  if (transaction === null) {
    return (
      <aside className="bs-detail__panel" aria-label="Match panel">
        <div className="bs-detail__panel-empty">Select a transaction to see match details.</div>
      </aside>
    );
  }

  const isMatched =
    transaction.matchStatus === BANK_TRANSACTION_MATCH_STATUS.MATCHED ||
    transaction.matchStatus === BANK_TRANSACTION_MATCH_STATUS.MANUAL;

  return (
    <aside className="bs-detail__panel" aria-label="Match panel">
      <header className="bs-detail__panel-header">
        <h3>Transaction</h3>
        <div className="bs-detail__panel-meta mono-cell muted">{formatDate(transaction.date)}</div>
      </header>

      <dl className="bs-detail__panel-body">
        <div>
          <dt>Description</dt>
          <dd>{transaction.description}</dd>
        </div>
        {transaction.reference !== null ? (
          <div>
            <dt>Reference</dt>
            <dd className="mono-cell">{transaction.reference}</dd>
          </div>
        ) : null}
        <div>
          <dt>Debit</dt>
          <dd className="mono-cell">{transaction.debitMinor ? formatInr(transaction.debitMinor) : "—"}</dd>
        </div>
        <div>
          <dt>Credit</dt>
          <dd className="mono-cell">{transaction.creditMinor ? formatInr(transaction.creditMinor) : "—"}</dd>
        </div>
      </dl>

      {transaction.invoice !== null ? (
        <section className="bs-detail__matched" aria-label="Matched invoice">
          <h4>Matched invoice</h4>
          <div className="bs-detail__invoice-row">
            <div className="bs-detail__invoice-num mono-cell">
              {transaction.invoice.invoiceNumber ?? "—"}
            </div>
            <div className="bs-detail__invoice-vendor">{transaction.invoice.vendorName ?? "—"}</div>
            <div className="bs-detail__invoice-amount mono-cell">
              {formatInr(transaction.invoice.totalAmountMinor)}
            </div>
          </div>
          {isMatched ? (
            <button
              type="button"
              className="bs-detail__unmatch"
              onClick={() => void unmatch(transaction.id)}
              disabled={unmatchStatus === "pending"}
            >
              {unmatchStatus === "pending" ? "Unmatching…" : "Unmatch"}
            </button>
          ) : null}
          {unmatchError !== null ? (
            <div className="bs-detail__panel-error" role="alert">
              {unmatchError}
            </div>
          ) : null}
        </section>
      ) : (
        <section className="bs-detail__matched" aria-label="No match">
          <p className="bs-detail__panel-hint">
            No invoice matched yet. Run reconciliation, or match manually from the invoice list.
          </p>
        </section>
      )}
    </aside>
  );
}
