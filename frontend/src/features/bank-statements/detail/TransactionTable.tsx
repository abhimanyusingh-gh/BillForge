import { BANK_TRANSACTION_MATCH_STATUS, type BankTransaction } from "@/domain/bank/transaction";
import { formatDate, formatInr } from "@/features/bank-statements/internal";
import type { TransactionId } from "@/types/ids";

interface TransactionTableProps {
  transactions: BankTransaction[];
  activeId: TransactionId | null;
  onSelect: (txnId: TransactionId) => void;
}

function chipFor(txn: BankTransaction): { label: string; cls: string } {
  switch (txn.matchStatus) {
    case BANK_TRANSACTION_MATCH_STATUS.MATCHED:
    case BANK_TRANSACTION_MATCH_STATUS.MANUAL:
      return { label: "MATCHED", cls: "s-approved" };
    case BANK_TRANSACTION_MATCH_STATUS.SUGGESTED: {
      const conf = txn.matchConfidence === null ? 0 : Math.round(txn.matchConfidence * 100);
      return { label: `MATCH ${conf}%`, cls: "s-parsed" };
    }
    default:
      return { label: "UNMATCHED", cls: "s-needs_review" };
  }
}

export function TransactionTable({ transactions, activeId, onSelect }: TransactionTableProps) {
  if (transactions.length === 0) {
    return <div className="bs-detail__empty">No transactions on this statement.</div>;
  }
  return (
    <table className="lbtable bs-detail__txn-table">
      <thead>
        <tr>
          <th className="bs-detail__col-date">Date</th>
          <th>Description</th>
          <th className="bs-detail__col-ref">Reference</th>
          <th className="num-cell bs-detail__col-amount">Amount</th>
          <th className="num-cell bs-detail__col-balance">Balance</th>
          <th className="bs-detail__col-match">Matched / suggested</th>
          <th className="bs-detail__col-state">State</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((txn) => {
          const chip = chipFor(txn);
          const isActive = activeId === txn.id;
          const isDebit = txn.debitMinor !== null && txn.debitMinor > 0;
          const amountValue = isDebit ? txn.debitMinor : txn.creditMinor;
          return (
            <tr
              key={txn.id}
              className={isActive ? "row-active" : ""}
              onClick={() => onSelect(txn.id)}
              aria-current={isActive ? "true" : undefined}
            >
              <td className="mono-cell muted">{formatDate(txn.date)}</td>
              <td className="bs-detail__desc">
                <div className="bs-detail__desc-line">{txn.description}</div>
              </td>
              <td className="mono-cell bs-detail__ref-cell">{txn.reference ?? "—"}</td>
              <td className={`num-cell ${isDebit ? "bs-detail__amt-debit" : "bs-detail__amt-credit"}`}>
                {amountValue !== null && amountValue > 0
                  ? `${isDebit ? "− " : "+ "}${formatInr(amountValue)}`
                  : "—"}
              </td>
              <td className="num-cell muted">
                {txn.balanceMinor !== null ? formatInr(txn.balanceMinor) : "—"}
              </td>
              <td>
                {txn.invoice !== null ? (
                  <div className="bs-detail__match-cell">
                    <span className="bs-detail__match-num lb-mono">
                      {txn.invoice.invoiceNumber ?? "—"}
                    </span>
                    <span className="bs-detail__match-vendor">
                      {txn.invoice.vendorName ?? "—"}
                    </span>
                  </div>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
              <td>
                <span className={`spill ${chip.cls}`}>
                  <span className="dot" />
                  {chip.label}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
