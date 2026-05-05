export type UserId = string & { readonly __brand: "UserId" };
export type TenantId = string & { readonly __brand: "TenantId" };
export type ClientOrgId = string & { readonly __brand: "ClientOrgId" };
export type BankStatementId = string & { readonly __brand: "BankStatementId" };
export type TransactionId = string & { readonly __brand: "TransactionId" };
export type InvoiceId = string & { readonly __brand: "InvoiceId" };
export type BankAccountId = string & { readonly __brand: "BankAccountId" };

export function asUserId(value: string): UserId {
  return value as UserId;
}

export function asTenantId(value: string): TenantId {
  return value as TenantId;
}

export function asClientOrgId(value: string): ClientOrgId {
  return value as ClientOrgId;
}

export function asBankStatementId(value: string): BankStatementId {
  return value as BankStatementId;
}

export function asTransactionId(value: string): TransactionId {
  return value as TransactionId;
}

export function asInvoiceId(value: string): InvoiceId {
  return value as InvoiceId;
}

export function asBankAccountId(value: string): BankAccountId {
  return value as BankAccountId;
}
