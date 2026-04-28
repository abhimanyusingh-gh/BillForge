export const BANK_URL_PATHS = {
  accounts: "/bank/accounts",
  accountById: "/bank/accounts/:id",
  accountRefresh: "/bank/accounts/:id/refresh",
  statementsParseSse: "/bank-statements/parse/sse",
  statements: "/bank-statements",
  statementVendorGstins: "/bank-statements/vendor-gstins",
  statementAccountNames: "/bank-statements/account-names",
  statementMatches: "/bank-statements/:id/matches",
  statementTransactions: "/bank-statements/:id/transactions",
  statementUploadCsv: "/bank-statements/upload-csv",
  statementUpload: "/bank-statements/upload",
  statementGstin: "/bank-statements/:id/gstin",
  statementReconcile: "/bank-statements/:id/reconcile",
  statementTransactionMatch: "/bank-statements/transactions/:txnId/match"
} as const;
