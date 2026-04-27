import { buildNested, buildTenantNested } from "@/api/urls/buildNested";

// Bank routes split across two scopes:
//  - Realm-scoped (mounted under `clientOrgRouter`): accounts, statements,
//    transactions, vendor-gstins, account-names. Use `buildNested`.
//  - Tenant-scoped (mounted under `tenantRouter`): the SSE subscriber for
//    parse-progress broadcasts (one feed per tenant, no clientOrgId filter).
//    Use `buildTenantNested`. The consumer constructs an absolute URL by
//    prepending `apiClient.defaults.baseURL` because EventSource bypasses the
//    axios interceptor — same shape as `subscribeIngestionSSE` (Sub-PR A).
export const bankUrls = {
  accountsList: (): string => buildNested("/bank/accounts"),
  accountsCreate: (): string => buildNested("/bank/accounts"),
  accountDelete: (id: string): string =>
    buildNested(`/bank/accounts/${encodeURIComponent(id)}`),
  accountRefresh: (id: string): string =>
    buildNested(`/bank/accounts/${encodeURIComponent(id)}/refresh`),
  statementsList: (): string => buildNested("/bank-statements"),
  statementUpload: (): string => buildNested("/bank-statements/upload"),
  statementMatches: (statementId: string): string =>
    buildNested(`/bank-statements/${encodeURIComponent(statementId)}/matches`),
  statementGstin: (statementId: string): string =>
    buildNested(`/bank-statements/${encodeURIComponent(statementId)}/gstin`),
  vendorGstins: (): string => buildNested("/bank-statements/vendor-gstins"),
  statementTransactions: (statementId: string): string =>
    buildNested(`/bank-statements/${encodeURIComponent(statementId)}/transactions`),
  statementReconcile: (statementId: string): string =>
    buildNested(`/bank-statements/${encodeURIComponent(statementId)}/reconcile`),
  transactionMatch: (transactionId: string): string =>
    buildNested(`/bank-statements/transactions/${encodeURIComponent(transactionId)}/match`),
  accountNames: (): string => buildNested("/bank-statements/account-names"),
  parseSse: (): string => buildTenantNested("/bank-statements/parse/sse")
};
