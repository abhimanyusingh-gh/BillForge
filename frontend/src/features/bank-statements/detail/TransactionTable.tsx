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
    return (
      <div className="bs-detail__empty">No transactions on this statement.</div>
    );
  }
  return (
    <table className="lbtable bs-detail__txn-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th className="num-cell">Debit</th>
          <th className="num-cell">Credit</th>
          <th>Match</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((txn) => {
          const chip = chipFor(txn);
          const isActive = activeId === txn.id;
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
                {txn.reference !== null ? (
                  <div className="bs-detail__ref mono-cell muted">{txn.reference}</div>
                ) : null}
              </td>
              <td className="num-cell debit">{txn.debitMinor ? formatInr(txn.debitMinor) : ""}</td>
              <td className="num-cell credit">{txn.creditMinor ? formatInr(txn.creditMinor) : ""}</td>
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
