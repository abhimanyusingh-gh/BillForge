import type { InvoiceId, TransactionId } from "@/types/ids";

export const BANK_TRANSACTION_MATCH_STATUS = {
  UNMATCHED: "unmatched",
  SUGGESTED: "suggested",
  MATCHED: "matched",
  MANUAL: "manual"
} as const;

export type BankTransactionMatchStatus =
  (typeof BANK_TRANSACTION_MATCH_STATUS)[keyof typeof BANK_TRANSACTION_MATCH_STATUS];

export interface BankTransactionInvoiceRef {
  id: InvoiceId;
  invoiceNumber: string | null;
  vendorName: string | null;
  totalAmountMinor: number | null;
  invoiceDate: string | null;
  status: string;
}

export interface BankTransaction {
  id: TransactionId;
  date: string;
  description: string;
  reference: string | null;
  debitMinor: number | null;
  creditMinor: number | null;
  balanceMinor: number | null;
  matchStatus: BankTransactionMatchStatus;
  matchConfidence: number | null;
  matchedInvoiceId: InvoiceId | null;
  invoice: BankTransactionInvoiceRef | null;
}

export interface BankStatementMatchSummary {
  totalTransactions: number;
  matched: number;
  suggested: number;
  unmatched: number;
}

export interface BankStatementMatchView {
  items: BankTransaction[];
  summary: BankStatementMatchSummary;
}
