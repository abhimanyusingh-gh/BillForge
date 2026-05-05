import type { BankStatementId, TransactionId } from "@/types/ids";
import type { ClientOrgId, TenantId } from "@/types/ids";

interface QueryBag {
  readonly [key: string]: string | number | boolean | undefined;
}

function serializeQuery(query?: QueryBag): string {
  if (!query) return "";
  const parts: string[] = [];
  for (const key of Object.keys(query)) {
    const value = query[key];
    if (value === undefined) continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length === 0 ? "" : `?${parts.join("&")}`;
}

interface AuthUrls {
  login: () => string;
  refresh: () => string;
  changePassword: () => string;
}

interface SessionUrls {
  current: () => string;
}

interface TenantAdminClientOrgUrls {
  list: (query?: { includeArchived?: boolean }) => string;
}

interface TenantAdminUrls {
  clientOrgs: TenantAdminClientOrgUrls;
}

interface TenantInvoiceUrls {
  triage: (query?: { pageSize?: number; cursor?: string }) => string;
}

type BankStatementListQuery = QueryBag & {
  page?: number;
  limit?: number;
  accountName?: string;
  periodFrom?: string;
  periodTo?: string;
};

type BankTransactionListQuery = QueryBag & {
  page?: number;
  limit?: number;
  matchStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
};

interface BankStatementUrls {
  list: (query?: BankStatementListQuery) => string;
  upload: () => string;
  uploadCsv: () => string;
  accountNames: () => string;
  vendorGstins: () => string;
  matches: (statementId: BankStatementId) => string;
  transactions: (statementId: BankStatementId, query?: BankTransactionListQuery) => string;
  reconcile: (statementId: BankStatementId) => string;
  setGstin: (statementId: BankStatementId) => string;
  matchTransaction: (txnId: TransactionId) => string;
  unmatchTransaction: (txnId: TransactionId) => string;
}

interface BankAccountUrls {
  list: () => string;
  create: () => string;
  remove: (id: string) => string;
  refresh: (id: string) => string;
}

interface ClientOrgInvoiceUrls {
  actionRequired: (query?: { pageSize?: number; cursor?: string }) => string;
}

interface ClientOrgUrls {
  invoices: ClientOrgInvoiceUrls;
  bankStatements: BankStatementUrls;
  bankAccounts: BankAccountUrls;
}

interface TenantUrls {
  admin: TenantAdminUrls;
  invoices: TenantInvoiceUrls;
  clientOrg: (clientOrgId: ClientOrgId) => ClientOrgUrls;
  bankStatementsParseSse: () => string;
}

interface UrlBuilder {
  auth: AuthUrls;
  session: SessionUrls;
  tenant: (tenantId: TenantId) => TenantUrls;
}

function build(): UrlBuilder {
  return {
    auth: {
      login: () => "/api/auth/token",
      refresh: () => "/api/auth/refresh",
      changePassword: () => "/api/auth/change-password"
    },
    session: {
      current: () => "/api/session"
    },
    tenant: (tenantId: TenantId): TenantUrls => {
      const tenantBase = `/api/tenants/${tenantId}`;
      return {
        admin: {
          clientOrgs: {
            list: (query) => `${tenantBase}/admin/client-orgs${serializeQuery(query)}`
          }
        },
        invoices: {
          triage: (query) => `${tenantBase}/invoices/triage${serializeQuery(query)}`
        },
        bankStatementsParseSse: () => `${tenantBase}/bank-statements/parse/sse`,
        clientOrg: (clientOrgId: ClientOrgId): ClientOrgUrls => {
          const clientOrgBase = `${tenantBase}/clientOrgs/${clientOrgId}`;
          const stmtBase = `${clientOrgBase}/bank-statements`;
          return {
            invoices: {
              actionRequired: (query) =>
                `${clientOrgBase}/invoices/action-required${serializeQuery(query)}`
            },
            bankStatements: {
              list: (query) => `${stmtBase}${serializeQuery(query)}`,
              upload: () => `${stmtBase}/upload`,
              uploadCsv: () => `${stmtBase}/upload-csv`,
              accountNames: () => `${stmtBase}/account-names`,
              vendorGstins: () => `${stmtBase}/vendor-gstins`,
              matches: (statementId) => `${stmtBase}/${statementId}/matches`,
              transactions: (statementId, query) =>
                `${stmtBase}/${statementId}/transactions${serializeQuery(query)}`,
              reconcile: (statementId) => `${stmtBase}/${statementId}/reconcile`,
              setGstin: (statementId) => `${stmtBase}/${statementId}/gstin`,
              matchTransaction: (txnId) => `${stmtBase}/transactions/${txnId}/match`,
              unmatchTransaction: (txnId) => `${stmtBase}/transactions/${txnId}/match`
            },
            bankAccounts: {
              list: () => `${clientOrgBase}/bank/accounts`,
              create: () => `${clientOrgBase}/bank/accounts`,
              remove: (id) => `${clientOrgBase}/bank/accounts/${id}`,
              refresh: (id) => `${clientOrgBase}/bank/accounts/${id}/refresh`
            }
          };
        }
      };
    }
  };
}

export const urls: UrlBuilder = build();
