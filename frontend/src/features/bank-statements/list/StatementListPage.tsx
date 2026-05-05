import { useState } from "react";
import { useStatements } from "@/features/bank-statements/list/useStatements";
import { StatementUploadDropzone } from "@/features/bank-statements/upload/StatementUploadDropzone";
import { StatementDetailModal } from "@/features/bank-statements/detail/StatementDetailModal";
import { formatDate, formatPeriod } from "@/features/bank-statements/internal";
import { BANK_STATEMENT_STATUS, type BankStatement } from "@/domain/bank/statement";
import type { BankStatementId } from "@/types/ids";

function reconDecile(ratio: number): number {
  if (ratio <= 0) return 0;
  if (ratio >= 100) return 10;
  return Math.min(10, Math.max(0, Math.round(ratio / 10)));
}

function statusChip(statement: BankStatement): { label: string; cls: string } {
  if (statement.status === BANK_STATEMENT_STATUS.PARSING) {
    return { label: "PARSING", cls: "s-parsed" };
  }
  if (statement.status === BANK_STATEMENT_STATUS.RECONCILED) {
    return { label: "RECONCILED", cls: "s-approved" };
  }
  return {
    label: statement.unmatchedCount > 0 ? `${statement.unmatchedCount} TO MATCH` : "ACTIVE",
    cls: "s-needs_review"
  };
}

export function StatementListPage() {
  const { items, total, isLoading, error, reload } = useStatements();
  const [openId, setOpenId] = useState<BankStatementId | null>(null);

  return (
    <section className="bs-list-page" aria-labelledby="bs-list-heading">
      <header className="page-header">
        <h1 id="bs-list-heading">Bank Statements</h1>
        <span className="count">
          {total} {total === 1 ? "statement" : "statements"}
        </span>
      </header>

      <StatementUploadDropzone onUploaded={reload} />

      {error !== null ? (
        <div className="bs-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="table-wrap bs-list-wrap">
        <table className="lbtable">
          <thead>
            <tr>
              <th>Account</th>
              <th>Period</th>
              <th>File</th>
              <th>Uploaded</th>
              <th className="num-cell">Lines</th>
              <th>Reconciliation</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && items.length === 0 ? (
              <tr>
                <td colSpan={7} className="bs-empty">
                  Loading statements…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="bs-empty">
                  No statements yet. Drop a file above to get started.
                </td>
              </tr>
            ) : (
              items.map((statement) => {
                const chip = statusChip(statement);
                const ratio =
                  statement.transactionCount > 0
                    ? Math.round((statement.matchedCount / statement.transactionCount) * 100)
                    : 0;
                return (
                  <tr
                    key={statement.id}
                    onClick={() => setOpenId(statement.id)}
                    aria-label={`Open statement ${statement.fileName ?? statement.id}`}
                  >
                    <td className="mono-cell">
                      {statement.bankName ?? "—"}
                      {statement.accountNumberMasked ? ` · ${statement.accountNumberMasked}` : ""}
                    </td>
                    <td>{formatPeriod(statement.periodFrom, statement.periodTo)}</td>
                    <td className="mono-cell bs-file">{statement.fileName ?? "—"}</td>
                    <td className="mono-cell muted">{formatDate(statement.uploadedAt)}</td>
                    <td className="num-cell">{statement.transactionCount || "—"}</td>
                    <td>
                      <div className="bs-recon-bar" aria-label={`${ratio}% matched`}>
                        <div className={`bs-recon-bar__fill bs-recon-bar__fill--d${reconDecile(ratio)}`} />
                        <div className="bs-recon-bar__legend">
                          {statement.matchedCount} matched · {statement.unmatchedCount} unmatched
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`spill ${chip.cls}`}>
                        <span className="dot" />
                        {chip.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {openId !== null ? (
        <StatementDetailModal
          statementId={openId}
          onClose={() => setOpenId(null)}
          onChanged={reload}
        />
      ) : null}
    </section>
  );
}
