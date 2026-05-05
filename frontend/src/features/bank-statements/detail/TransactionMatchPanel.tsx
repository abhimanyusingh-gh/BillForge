import { BANK_TRANSACTION_MATCH_STATUS, type BankTransaction } from "@/domain/bank/transaction";
import { formatDate, formatInr } from "@/features/bank-statements/internal";
import { useUnmatchTransaction } from "@/features/bank-statements/match/useMatchTransaction";

interface TransactionMatchPanelProps {
  transaction: BankTransaction | null;
  onChanged: () => void;
}

function txnAmount(transaction: BankTransaction): { isDebit: boolean; value: number } {
  const debit = transaction.debitMinor ?? 0;
  const credit = transaction.creditMinor ?? 0;
  if (debit > 0) return { isDebit: true, value: debit };
  return { isDebit: false, value: credit };
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
  const { isDebit, value } = txnAmount(transaction);
  const invoice = transaction.invoice;
  const expected = invoice?.totalAmountMinor ?? null;
  const variance = expected !== null ? value - expected : null;

  return (
    <aside className="bs-detail__panel" aria-label="Match panel">
      <section className="bs-detail__sel">
        <div className="bs-detail__caplabel">Selected transaction</div>
        <div className="bs-detail__sel-card">
          <div className="bs-detail__sel-row">
            <span className="lb-mono bs-detail__sel-meta">
              {formatDate(transaction.date)}
              {transaction.reference !== null ? ` · ${transaction.reference}` : ""}
            </span>
            <span
              className={`lb-mono bs-detail__sel-amount ${
                isDebit ? "bs-detail__amt-debit" : "bs-detail__amt-credit"
              }`}
            >
              {isDebit ? "− " : "+ "}
              {formatInr(value)}
            </span>
          </div>
          <div className="bs-detail__sel-desc">{transaction.description}</div>
        </div>
      </section>

      {invoice !== null ? (
        <section className="bs-detail__matched" aria-label="Matched invoice">
          <div className="bs-detail__caplabel">Match to invoice</div>
          <div className="bs-detail__candidate is-active">
            <div className="bs-detail__candidate-radio" aria-hidden />
            <div className="bs-detail__candidate-body">
              <div className="bs-detail__candidate-num lb-mono">
                {invoice.invoiceNumber ?? "—"}
              </div>
              <div className="bs-detail__candidate-vendor">
                {invoice.vendorName ?? "—"}
                {invoice.invoiceDate ? ` · ${formatDate(invoice.invoiceDate)}` : ""}
              </div>
            </div>
            <div className="bs-detail__candidate-amount lb-mono">
              {formatInr(invoice.totalAmountMinor)}
            </div>
          </div>

          <div className="bs-detail__diff">
            <div className="bs-detail__diff-row">
              <span>Expected</span>
              <span className="lb-mono">{formatInr(expected)}</span>
            </div>
            <div className="bs-detail__diff-row">
              <span>Bank {isDebit ? "debit" : "credit"}</span>
              <span className={`lb-mono ${isDebit ? "bs-detail__amt-debit" : "bs-detail__amt-credit"}`}>
                {isDebit ? "− " : "+ "}
                {formatInr(value)}
              </span>
            </div>
            <div
              className={`bs-detail__diff-final ${
                variance === 0 ? "is-pos" : "is-neg"
              }`}
            >
              {variance === 0
                ? "✓ matches expected"
                : `± ${formatInr(Math.abs(variance ?? 0))} variance`}
            </div>
          </div>

          {isMatched ? (
            <button
              type="button"
              className="bs-detail__unmatch"
              onClick={() => void unmatch(transaction.id)}
              disabled={unmatchStatus === "pending"}
            >
              {unmatchStatus === "pending" ? "Unmatching…" : "Clear match"}
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
          <div className="bs-detail__caplabel">Match to invoice</div>
          <p className="bs-detail__panel-hint">
            No invoice matched yet. Run auto-match, or match manually from the invoice list.
          </p>
        </section>
      )}
    </aside>
  );
}
