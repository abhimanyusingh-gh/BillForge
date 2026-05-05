import type { BankStatementId, ClientOrgId } from "@/types/ids";

export const BANK_STATEMENT_STATUS = {
  PARSING: "parsing",
  ACTIVE: "active",
  RECONCILED: "matched"
} as const;

export type BankStatementStatus =
  (typeof BANK_STATEMENT_STATUS)[keyof typeof BANK_STATEMENT_STATUS];

export interface BankStatement {
  id: BankStatementId;
  clientOrgId: ClientOrgId;
  bankName: string | null;
  accountNumberMasked: string | null;
  fileName: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  uploadedAt: string | null;
  transactionCount: number;
  matchedCount: number;
  unmatchedCount: number;
  status: BankStatementStatus;
}

export interface BankStatementListPage {
  items: BankStatement[];
  total: number;
  page: number;
  limit: number;
}

export interface BankStatementUploadResult {
  statementId: BankStatementId;
  transactionCount: number;
  duplicatesSkipped: number;
  warnings?: string[];
}
