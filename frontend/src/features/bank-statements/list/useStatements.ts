import { useCallback, useEffect, useState } from "react";
import { bankService } from "@/api/bankService";
import type { BankStatement, BankStatementListPage } from "@/domain/bank/statement";
import { useBankContext, type BankContext } from "@/features/bank-statements/internal";

interface StatementsState {
  items: BankStatement[];
  total: number;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

const EMPTY: BankStatement[] = [];

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useStatements(): StatementsState {
  const ctx = useBankContext();
  const [page, setPage] = useState<BankStatementListPage | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState<number>(0);

  useEffect(() => {
    if (ctx === null) return;
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    bankService
      .listStatements({ tenantId: ctx.tenantId, clientOrgId: ctx.clientOrgId, signal: controller.signal })
      .then((result) => {
        setPage(result);
        setIsLoading(false);
      })
      .catch((caught: unknown) => {
        if (isAbortError(caught)) return;
        setError(caught instanceof Error ? caught.message : "Failed to load statements.");
        setIsLoading(false);
      });
    return () => controller.abort();
  }, [ctx?.tenantId, ctx?.clientOrgId, reloadToken, ctxAsKey(ctx)]);

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  return {
    items: page?.items ?? EMPTY,
    total: page?.total ?? 0,
    isLoading,
    error,
    reload
  };
}

function ctxAsKey(ctx: BankContext | null): string {
  return ctx === null ? "" : `${ctx.tenantId}:${ctx.clientOrgId}`;
}
