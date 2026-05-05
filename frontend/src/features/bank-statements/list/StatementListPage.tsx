import { useEffect, useRef, useState, type DragEvent } from "react";
import { bankService } from "@/api/bankService";
import { useStatements } from "@/features/bank-statements/list/useStatements";
import { StatementUploadDropzone } from "@/features/bank-statements/upload/StatementUploadDropzone";
import { StatementDetailModal } from "@/features/bank-statements/detail/StatementDetailModal";
import { formatDate, formatInr, formatPeriod, useBankContext } from "@/features/bank-statements/internal";
import { BANK_STATEMENT_STATUS, type BankStatement } from "@/domain/bank/statement";
import { type BankAccount } from "@/domain/bank/bankAccount";
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

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function useAccountsSummary(): BankAccount[] {
  const ctx = useBankContext();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);

  useEffect(() => {
    if (ctx === null) return;
    const controller = new AbortController();
    const result = bankService.listBankAccounts({
      tenantId: ctx.tenantId,
      clientOrgId: ctx.clientOrgId,
      signal: controller.signal
    });
    Promise.resolve(result)
      .then((accs) => setAccounts(Array.isArray(accs) ? accs : []))
      .catch((caught: unknown) => {
        if (isAbortError(caught)) return;
        setAccounts([]);
      });
    return () => controller.abort();
  }, [ctx?.tenantId, ctx?.clientOrgId]);

  return accounts;
}

export function StatementListPage() {
  const { items, total, isLoading, error, reload } = useStatements();
  const accounts = useAccountsSummary();
  const [openId, setOpenId] = useState<BankStatementId | null>(null);
  const [isVeilDrag, setIsVeilDrag] = useState<boolean>(false);
  const browseRef = useRef<HTMLButtonElement | null>(null);

  function onPageDragOver(event: DragEvent<HTMLElement>) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    setIsVeilDrag(true);
  }
  function onPageDragLeave(event: DragEvent<HTMLElement>) {
    if (event.currentTarget === event.target) setIsVeilDrag(false);
  }
  function onPageDrop() {
    setIsVeilDrag(false);
  }

  return (
    <section
      className="bs-list-page"
      aria-labelledby="bs-list-heading"
      onDragOver={onPageDragOver}
      onDragLeave={onPageDragLeave}
      onDrop={onPageDrop}
    >
      <header className="page-header">
        <h1 id="bs-list-heading">Bank Statements</h1>
        <span className="count">
          {accounts.length} {accounts.length === 1 ? "account" : "accounts"} · {total}{" "}
          {total === 1 ? "statement" : "statements"}
        </span>
        <div className="page-tools">
          <button
            type="button"
            className="bs-cta-secondary"
            onClick={() => browseRef.current?.click()}
          >
            + Upload statement
          </button>
        </div>
      </header>

      {accounts.length > 0 ? (
        <div className="bs-account-grid">
          {accounts.map((account) => (
            <article key={account.id} className="bs-account-card panel">
              <span className="bs-account-card__icon material-symbols-outlined" aria-hidden>
                account_balance
              </span>
              <div className="bs-account-card__body">
                <div className="bs-account-card__name">
                  {account.displayName}
                  {account.maskedAccNumber ? (
                    <span className="bs-account-card__tail mono-cell">{` ${account.maskedAccNumber}`}</span>
                  ) : null}
                </div>
                <div className="bs-account-card__meta">
                  {account.bankName}
                  {account.balanceFetchedAt ? ` · as of ${formatDate(account.balanceFetchedAt)}` : ""}
                </div>
              </div>
              <div className="bs-account-card__amount lb-mono">{formatInr(account.balanceMinor)}</div>
            </article>
          ))}
        </div>
      ) : null}

      <StatementUploadDropzone onUploaded={reload} browseRef={browseRef} />

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
                const fillVariant =
                  statement.unmatchedCount > 0 ? "bs-recon-bar__fill--warn" : "bs-recon-bar__fill--ok";
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
                        <div
                          className={`bs-recon-bar__fill bs-recon-bar__fill--d${reconDecile(ratio)} ${fillVariant}`}
                        />
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

      {isVeilDrag ? (
        <div className="bs-drag-veil" aria-hidden>
          <div className="bs-drag-veil__inner">
            <span className="material-symbols-outlined bs-drag-veil__icon" aria-hidden>
              cloud_upload
            </span>
            <div className="bs-drag-veil__title">Drop bank statements anywhere</div>
            <div className="bs-drag-veil__hint">
              PDF, CSV, OFX, MT940 · auto-detected · matched against open invoices.
            </div>
          </div>
        </div>
      ) : null}

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
