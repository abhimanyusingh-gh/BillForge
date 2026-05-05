import { useCallback, useState } from "react";
import { bankService } from "@/api/bankService";
import { useBankContext } from "@/features/bank-statements/internal";
import type { InvoiceId, TransactionId } from "@/types/ids";

export const MATCH_STATUS = {
  IDLE: "idle",
  PENDING: "pending",
  SUCCESS: "success",
  ERROR: "error"
} as const;

type MatchActionStatus = (typeof MATCH_STATUS)[keyof typeof MATCH_STATUS];

interface MatchHookState {
  status: MatchActionStatus;
  error: string | null;
  match: (txnId: TransactionId, invoiceId: InvoiceId) => Promise<boolean>;
}

interface UnmatchHookState {
  status: MatchActionStatus;
  error: string | null;
  unmatch: (txnId: TransactionId) => Promise<boolean>;
}

export function useUnmatchTransaction(onSuccess?: () => void): UnmatchHookState {
  const ctx = useBankContext();
  const [status, setStatus] = useState<MatchActionStatus>(MATCH_STATUS.IDLE);
  const [error, setError] = useState<string | null>(null);

  const unmatch = useCallback(
    async (txnId: TransactionId): Promise<boolean> => {
      if (ctx === null) {
        setError("No active client org.");
        setStatus(MATCH_STATUS.ERROR);
        return false;
      }
      setStatus(MATCH_STATUS.PENDING);
      setError(null);
      try {
        await bankService.unmatchTransaction({
          tenantId: ctx.tenantId,
          clientOrgId: ctx.clientOrgId,
          txnId
        });
        setStatus(MATCH_STATUS.SUCCESS);
        if (onSuccess) onSuccess();
        return true;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unmatch failed.");
        setStatus(MATCH_STATUS.ERROR);
        return false;
      }
    },
    [ctx?.tenantId, ctx?.clientOrgId, onSuccess]
  );

  return { status, error, unmatch };
}

export function useMatchTransaction(onSuccess?: () => void): MatchHookState {
  const ctx = useBankContext();
  const [status, setStatus] = useState<MatchActionStatus>(MATCH_STATUS.IDLE);
  const [error, setError] = useState<string | null>(null);

  const match = useCallback(
    async (txnId: TransactionId, invoiceId: InvoiceId): Promise<boolean> => {
      if (ctx === null) {
        setError("No active client org.");
        setStatus(MATCH_STATUS.ERROR);
        return false;
      }
      setStatus(MATCH_STATUS.PENDING);
      setError(null);
      try {
        await bankService.matchTransaction({
          tenantId: ctx.tenantId,
          clientOrgId: ctx.clientOrgId,
          txnId,
          invoiceId
        });
        setStatus(MATCH_STATUS.SUCCESS);
        if (onSuccess) onSuccess();
        return true;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Match failed.");
        setStatus(MATCH_STATUS.ERROR);
        return false;
      }
    },
    [ctx?.tenantId, ctx?.clientOrgId, onSuccess]
  );

  return { status, error, match };
}
