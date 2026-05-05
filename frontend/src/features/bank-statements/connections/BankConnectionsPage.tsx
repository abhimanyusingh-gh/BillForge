import { useEffect, useState } from "react";
import { bankService } from "@/api/bankService";
import { BANK_ACCOUNT_STATUS, type BankAccount, type BankAccountStatus } from "@/domain/bank/bankAccount";
import { formatDate, formatInr, useBankContext } from "@/features/bank-statements/internal";

const EMPTY: BankAccount[] = [];

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

interface BankAccountsState {
  accounts: BankAccount[];
  isLoading: boolean;
  error: string | null;
}

function useBankAccounts(): BankAccountsState {
  const ctx = useBankContext();
  const [accounts, setAccounts] = useState<BankAccount[]>(EMPTY);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ctx === null) return;
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    bankService
      .listBankAccounts({ tenantId: ctx.tenantId, clientOrgId: ctx.clientOrgId, signal: controller.signal })
      .then((result) => {
        setAccounts(result);
        setIsLoading(false);
      })
      .catch((caught: unknown) => {
        if (isAbortError(caught)) return;
        setError(caught instanceof Error ? caught.message : "Failed to load bank accounts.");
        setIsLoading(false);
      });
    return () => controller.abort();
  }, [ctx?.tenantId, ctx?.clientOrgId]);

  return { accounts, isLoading, error };
}

function statusChip(status: BankAccountStatus): { label: string; cls: string } {
  switch (status) {
    case BANK_ACCOUNT_STATUS.ACTIVE:
      return { label: "ACTIVE", cls: "s-approved" };
    case BANK_ACCOUNT_STATUS.PENDING_CONSENT:
      return { label: "PENDING CONSENT", cls: "s-parsed" };
    case BANK_ACCOUNT_STATUS.REVOKED:
      return { label: "REVOKED", cls: "s-pending" };
    default:
      return { label: "ERROR", cls: "s-failed_parse" };
  }
}

export function BankConnectionsPage() {
  const { accounts, isLoading, error } = useBankAccounts();

  return (
    <section className="bs-connections-page" aria-labelledby="bs-conn-heading">
      <header className="page-header">
        <h1 id="bs-conn-heading">Bank Connections</h1>
        <span className="count">
          {accounts.length} {accounts.length === 1 ? "account" : "accounts"}
        </span>
      </header>

      {error !== null ? (
        <div className="bs-error" role="alert">
          {error}
        </div>
      ) : null}

      {isLoading && accounts.length === 0 ? (
        <div className="bs-empty">Loading bank accounts…</div>
      ) : accounts.length === 0 ? (
        <div className="bs-empty">No bank accounts connected yet.</div>
      ) : (
        <div className="bs-account-grid">
          {accounts.map((account) => {
            const chip = statusChip(account.status);
            return (
              <article key={account.id} className="bs-account-card panel">
                <span className="bs-account-card__icon material-symbols-outlined" aria-hidden>
                  account_balance
                </span>
                <div className="bs-account-card__body">
                  <div className="bs-account-card__name">
                    {account.displayName}
                    {account.maskedAccNumber ? (
                      <span className="bs-account-card__tail mono-cell">
                        {` ${account.maskedAccNumber}`}
                      </span>
                    ) : null}
                  </div>
                  <div className="bs-account-card__meta">
                    {account.bankName} · IFSC {account.ifsc || "—"}
                    {account.balanceFetchedAt
                      ? ` · as of ${formatDate(account.balanceFetchedAt)}`
                      : ""}
                  </div>
                  <div className="bs-account-card__chip">
                    <span className={`spill ${chip.cls}`}>
                      <span className="dot" />
                      {chip.label}
                    </span>
                  </div>
                </div>
                <div className="bs-account-card__amount lb-mono">
                  {formatInr(account.balanceMinor)}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
