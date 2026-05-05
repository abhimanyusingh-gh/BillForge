import type { BankAccountId, ClientOrgId } from "@/types/ids";

export const BANK_ACCOUNT_STATUS = {
  PENDING_CONSENT: "PENDING_CONSENT",
  ACTIVE: "ACTIVE",
  REVOKED: "REVOKED",
  ERROR: "ERROR"
} as const;

export type BankAccountStatus =
  (typeof BANK_ACCOUNT_STATUS)[keyof typeof BANK_ACCOUNT_STATUS];

export interface BankAccount {
  id: BankAccountId;
  clientOrgId: ClientOrgId;
  status: BankAccountStatus;
  displayName: string;
  bankName: string;
  accountNumber: string;
  maskedAccNumber: string | null;
  ifsc: string;
  balanceMinor: number | null;
  currency: string | null;
  balanceFetchedAt: string | null;
  lastErrorReason: string | null;
}
