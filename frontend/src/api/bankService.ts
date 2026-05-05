import { ApiError, apiClient } from "@/api/client";
import { urls } from "@/api/urlBuilder";
import { appConfig } from "@/config/env";
import { useSessionStore } from "@/state/sessionStore";
import {
  BANK_STATEMENT_STATUS,
  type BankStatement,
  type BankStatementListPage,
  type BankStatementStatus,
  type BankStatementUploadResult
} from "@/domain/bank/statement";
import {
  BANK_TRANSACTION_MATCH_STATUS,
  type BankStatementMatchView,
  type BankTransaction,
  type BankTransactionInvoiceRef,
  type BankTransactionMatchStatus
} from "@/domain/bank/transaction";
import { BANK_ACCOUNT_STATUS, type BankAccount, type BankAccountStatus } from "@/domain/bank/bankAccount";
import {
  asBankAccountId,
  asBankStatementId,
  asClientOrgId,
  asInvoiceId,
  asTransactionId,
  type BankStatementId,
  type ClientOrgId,
  type InvoiceId,
  type TenantId,
  type TransactionId
} from "@/types/ids";

interface RawStatement {
  _id?: string;
  clientOrgId?: string;
  bankName?: string | null;
  accountNumberMasked?: string | null;
  fileName?: string | null;
  periodFrom?: string | null;
  periodTo?: string | null;
  createdAt?: string | null;
  transactionCount?: number;
  matchedCount?: number;
  unmatchedCount?: number;
  status?: string;
}

function toStatementStatus(raw: string | undefined, matched: number, unmatched: number): BankStatementStatus {
  if (raw === BANK_STATEMENT_STATUS.PARSING) return BANK_STATEMENT_STATUS.PARSING;
  if (matched > 0 && unmatched === 0) return BANK_STATEMENT_STATUS.RECONCILED;
  return BANK_STATEMENT_STATUS.ACTIVE;
}

function toStatement(raw: RawStatement): BankStatement | null {
  if (typeof raw._id !== "string" || raw._id.length === 0) return null;
  if (typeof raw.clientOrgId !== "string" || raw.clientOrgId.length === 0) return null;
  const matched = typeof raw.matchedCount === "number" ? raw.matchedCount : 0;
  const unmatched = typeof raw.unmatchedCount === "number" ? raw.unmatchedCount : 0;
  return {
    id: asBankStatementId(raw._id),
    clientOrgId: asClientOrgId(raw.clientOrgId),
    bankName: typeof raw.bankName === "string" ? raw.bankName : null,
    accountNumberMasked: typeof raw.accountNumberMasked === "string" ? raw.accountNumberMasked : null,
    fileName: typeof raw.fileName === "string" ? raw.fileName : null,
    periodFrom: typeof raw.periodFrom === "string" ? raw.periodFrom : null,
    periodTo: typeof raw.periodTo === "string" ? raw.periodTo : null,
    uploadedAt: typeof raw.createdAt === "string" ? raw.createdAt : null,
    transactionCount: typeof raw.transactionCount === "number" ? raw.transactionCount : 0,
    matchedCount: matched,
    unmatchedCount: unmatched,
    status: toStatementStatus(raw.status, matched, unmatched)
  };
}

interface RawTransaction {
  _id?: string;
  date?: string;
  description?: string;
  reference?: string | null;
  debitMinor?: number | null;
  creditMinor?: number | null;
  balanceMinor?: number | null;
  matchStatus?: string;
  matchConfidence?: number | null;
  matchedInvoiceId?: string | null;
  invoice?: {
    _id?: string;
    invoiceNumber?: string | null;
    vendorName?: string | null;
    totalAmountMinor?: number | null;
    invoiceDate?: string | null;
    status?: string;
  } | null;
}

function toMatchStatus(raw: string | undefined): BankTransactionMatchStatus {
  if (raw === BANK_TRANSACTION_MATCH_STATUS.SUGGESTED) return BANK_TRANSACTION_MATCH_STATUS.SUGGESTED;
  if (raw === BANK_TRANSACTION_MATCH_STATUS.MATCHED) return BANK_TRANSACTION_MATCH_STATUS.MATCHED;
  if (raw === BANK_TRANSACTION_MATCH_STATUS.MANUAL) return BANK_TRANSACTION_MATCH_STATUS.MANUAL;
  return BANK_TRANSACTION_MATCH_STATUS.UNMATCHED;
}

function toInvoiceRef(raw: NonNullable<RawTransaction["invoice"]>): BankTransactionInvoiceRef | null {
  if (typeof raw._id !== "string" || raw._id.length === 0) return null;
  return {
    id: asInvoiceId(raw._id),
    invoiceNumber: typeof raw.invoiceNumber === "string" ? raw.invoiceNumber : null,
    vendorName: typeof raw.vendorName === "string" ? raw.vendorName : null,
    totalAmountMinor: typeof raw.totalAmountMinor === "number" ? raw.totalAmountMinor : null,
    invoiceDate: typeof raw.invoiceDate === "string" ? raw.invoiceDate : null,
    status: typeof raw.status === "string" ? raw.status : "unknown"
  };
}

function toTransaction(raw: RawTransaction): BankTransaction | null {
  if (typeof raw._id !== "string" || raw._id.length === 0) return null;
  return {
    id: asTransactionId(raw._id),
    date: typeof raw.date === "string" ? raw.date : "",
    description: typeof raw.description === "string" ? raw.description : "",
    reference: typeof raw.reference === "string" ? raw.reference : null,
    debitMinor: typeof raw.debitMinor === "number" ? raw.debitMinor : null,
    creditMinor: typeof raw.creditMinor === "number" ? raw.creditMinor : null,
    balanceMinor: typeof raw.balanceMinor === "number" ? raw.balanceMinor : null,
    matchStatus: toMatchStatus(raw.matchStatus),
    matchConfidence: typeof raw.matchConfidence === "number" ? raw.matchConfidence : null,
    matchedInvoiceId:
      typeof raw.matchedInvoiceId === "string" && raw.matchedInvoiceId.length > 0
        ? asInvoiceId(raw.matchedInvoiceId)
        : null,
    invoice: raw.invoice ? toInvoiceRef(raw.invoice) : null
  };
}

interface RawBankAccount {
  _id?: string;
  clientOrgId?: string;
  status?: string;
  displayName?: string;
  bankName?: string;
  accountNumber?: string;
  maskedAccNumber?: string | null;
  ifsc?: string;
  balanceMinor?: number | null;
  currency?: string | null;
  balanceFetchedAt?: string | null;
  lastErrorReason?: string | null;
}

function toBankAccountStatus(raw: string | undefined): BankAccountStatus {
  if (raw === BANK_ACCOUNT_STATUS.ACTIVE) return BANK_ACCOUNT_STATUS.ACTIVE;
  if (raw === BANK_ACCOUNT_STATUS.REVOKED) return BANK_ACCOUNT_STATUS.REVOKED;
  if (raw === BANK_ACCOUNT_STATUS.ERROR) return BANK_ACCOUNT_STATUS.ERROR;
  return BANK_ACCOUNT_STATUS.PENDING_CONSENT;
}

function toBankAccount(raw: RawBankAccount): BankAccount | null {
  if (typeof raw._id !== "string" || raw._id.length === 0) return null;
  if (typeof raw.clientOrgId !== "string" || raw.clientOrgId.length === 0) return null;
  return {
    id: asBankAccountId(raw._id),
    clientOrgId: asClientOrgId(raw.clientOrgId),
    status: toBankAccountStatus(raw.status),
    displayName: typeof raw.displayName === "string" ? raw.displayName : "",
    bankName: typeof raw.bankName === "string" ? raw.bankName : "",
    accountNumber: typeof raw.accountNumber === "string" ? raw.accountNumber : "",
    maskedAccNumber: typeof raw.maskedAccNumber === "string" ? raw.maskedAccNumber : null,
    ifsc: typeof raw.ifsc === "string" ? raw.ifsc : "",
    balanceMinor: typeof raw.balanceMinor === "number" ? raw.balanceMinor : null,
    currency: typeof raw.currency === "string" ? raw.currency : null,
    balanceFetchedAt: typeof raw.balanceFetchedAt === "string" ? raw.balanceFetchedAt : null,
    lastErrorReason: typeof raw.lastErrorReason === "string" ? raw.lastErrorReason : null
  };
}

interface ListContext {
  tenantId: TenantId;
  clientOrgId: ClientOrgId;
}

interface ListStatementsArgs extends ListContext {
  page?: number;
  limit?: number;
  signal?: AbortSignal;
}

async function listStatements({
  tenantId,
  clientOrgId,
  page,
  limit,
  signal
}: ListStatementsArgs): Promise<BankStatementListPage> {
  const response = await apiClient.get<{
    items?: RawStatement[];
    total?: number;
    page?: number;
    limit?: number;
  }>(
    urls.tenant(tenantId).clientOrg(clientOrgId).bankStatements.list({ page, limit }),
    { signal }
  );
  const rawItems = Array.isArray(response?.items) ? response.items : [];
  const items = rawItems.flatMap((item) => {
    const mapped = toStatement(item);
    return mapped ? [mapped] : [];
  });
  return {
    items,
    total: typeof response?.total === "number" ? response.total : items.length,
    page: typeof response?.page === "number" ? response.page : 1,
    limit: typeof response?.limit === "number" ? response.limit : items.length
  };
}

interface StatementDetailArgs extends ListContext {
  statementId: BankStatementId;
  signal?: AbortSignal;
}

async function getStatementMatches({
  tenantId,
  clientOrgId,
  statementId,
  signal
}: StatementDetailArgs): Promise<BankStatementMatchView> {
  const response = await apiClient.get<{
    items?: RawTransaction[];
    summary?: { totalTransactions?: number; matched?: number; suggested?: number; unmatched?: number };
  }>(
    urls.tenant(tenantId).clientOrg(clientOrgId).bankStatements.matches(statementId),
    { signal }
  );
  const rawItems = Array.isArray(response?.items) ? response.items : [];
  const items = rawItems.flatMap((item) => {
    const mapped = toTransaction(item);
    return mapped ? [mapped] : [];
  });
  const summary = response?.summary ?? {};
  return {
    items,
    summary: {
      totalTransactions:
        typeof summary.totalTransactions === "number" ? summary.totalTransactions : items.length,
      matched: typeof summary.matched === "number" ? summary.matched : 0,
      suggested: typeof summary.suggested === "number" ? summary.suggested : 0,
      unmatched: typeof summary.unmatched === "number" ? summary.unmatched : 0
    }
  };
}

interface UploadStatementArgs extends ListContext {
  file: File;
  signal?: AbortSignal;
}

async function uploadStatement({ tenantId, clientOrgId, file, signal }: UploadStatementArgs): Promise<BankStatementUploadResult> {
  const form = new FormData();
  form.append("file", file);
  const path = urls.tenant(tenantId).clientOrg(clientOrgId).bankStatements.upload();
  const url = path.startsWith("http") ? path : `${appConfig.apiBaseUrl}${path}`;
  const token = useSessionStore.getState().accessToken;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Requested-With": "LedgerBuddy"
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, { method: "POST", headers, body: form, signal });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body && typeof (body as { message?: unknown }).message === "string"
        ? (body as { message: string }).message
        : `Upload failed (${response.status})`;
    throw new ApiError(response.status, message, body);
  }
  const parsed = (body ?? {}) as Record<string, unknown>;
  const id = typeof parsed.statementId === "string" ? parsed.statementId : "";
  if (id.length === 0) throw new ApiError(500, "Upload response missing statementId", parsed);
  return {
    statementId: asBankStatementId(id),
    transactionCount: typeof parsed.transactionCount === "number" ? parsed.transactionCount : 0,
    duplicatesSkipped: typeof parsed.duplicatesSkipped === "number" ? parsed.duplicatesSkipped : 0,
    warnings: Array.isArray(parsed.warnings)
      ? parsed.warnings.filter((w): w is string => typeof w === "string")
      : undefined
  };
}

interface MatchTransactionArgs extends ListContext {
  txnId: TransactionId;
  invoiceId: InvoiceId;
}

async function matchTransaction({ tenantId, clientOrgId, txnId, invoiceId }: MatchTransactionArgs): Promise<void> {
  await apiClient.post(
    urls.tenant(tenantId).clientOrg(clientOrgId).bankStatements.matchTransaction(txnId),
    { invoiceId }
  );
}

interface UnmatchTransactionArgs extends ListContext {
  txnId: TransactionId;
}

async function unmatchTransaction({ tenantId, clientOrgId, txnId }: UnmatchTransactionArgs): Promise<void> {
  await apiClient.delete(
    urls.tenant(tenantId).clientOrg(clientOrgId).bankStatements.unmatchTransaction(txnId)
  );
}

interface ReconcileArgs extends ListContext {
  statementId: BankStatementId;
}

interface ReconcileResult {
  matchedCount: number;
  suggestedCount: number;
  unmatchedCount: number;
}

async function reconcileStatement({ tenantId, clientOrgId, statementId }: ReconcileArgs): Promise<ReconcileResult> {
  const response = await apiClient.post<{
    matchedCount?: number;
    suggestedCount?: number;
    unmatchedCount?: number;
  }>(
    urls.tenant(tenantId).clientOrg(clientOrgId).bankStatements.reconcile(statementId),
    {}
  );
  return {
    matchedCount: typeof response?.matchedCount === "number" ? response.matchedCount : 0,
    suggestedCount: typeof response?.suggestedCount === "number" ? response.suggestedCount : 0,
    unmatchedCount: typeof response?.unmatchedCount === "number" ? response.unmatchedCount : 0
  };
}

async function listBankAccounts({
  tenantId,
  clientOrgId,
  signal
}: ListContext & { signal?: AbortSignal }): Promise<BankAccount[]> {
  const response = await apiClient.get<{ items?: RawBankAccount[] }>(
    urls.tenant(tenantId).clientOrg(clientOrgId).bankAccounts.list(),
    { signal }
  );
  const raw = Array.isArray(response?.items) ? response.items : [];
  return raw.flatMap((item) => {
    const mapped = toBankAccount(item);
    return mapped ? [mapped] : [];
  });
}

export const bankService = {
  listStatements,
  getStatementMatches,
  uploadStatement,
  matchTransaction,
  unmatchTransaction,
  reconcileStatement,
  listBankAccounts
};
