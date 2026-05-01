import { useCallback, useEffect, useState } from "react";
import { TDS_QUARTER, type TdsQuarter } from "@/api/reports";
import { determineFY, isValidFY } from "@/features/reports/fiscalYear";

const TDS_DASHBOARD_HASH_PATH = "#/reports/tds";

interface TdsDashboardHashState {
  fy: string;
  quarter: TdsQuarter | null;
  vendorFingerprint: string | null;
}

const QUARTER_VALUES = Object.values(TDS_QUARTER) as TdsQuarter[];

function isQuarter(value: string): value is TdsQuarter {
  return (QUARTER_VALUES as string[]).includes(value);
}

function readHashState(currentFy: string): TdsDashboardHashState {
  if (typeof window === "undefined") {
    return { fy: currentFy, quarter: null, vendorFingerprint: null };
  }
  const raw = window.location.hash;
  if (!raw.startsWith(TDS_DASHBOARD_HASH_PATH)) {
    return { fy: currentFy, quarter: null, vendorFingerprint: null };
  }
  const queryStart = raw.indexOf("?");
  if (queryStart < 0) {
    return { fy: currentFy, quarter: null, vendorFingerprint: null };
  }
  const params = new URLSearchParams(raw.slice(queryStart + 1));
  const fyParam = params.get("fy");
  const quarterParam = params.get("quarter");
  const vendorParam = params.get("vendor");
  return {
    fy: fyParam && isValidFY(fyParam) ? fyParam : currentFy,
    quarter: quarterParam && isQuarter(quarterParam) ? quarterParam : null,
    vendorFingerprint: vendorParam && vendorParam.trim().length > 0 ? vendorParam : null
  };
}

function writeHashState(state: TdsDashboardHashState): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();
  params.set("fy", state.fy);
  if (state.quarter) params.set("quarter", state.quarter);
  if (state.vendorFingerprint) params.set("vendor", state.vendorFingerprint);
  const next = `${TDS_DASHBOARD_HASH_PATH}?${params.toString()}`;
  if (window.location.hash !== next) {
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}${next}`);
  }
}

interface UseTdsDashboardHashStateResult {
  state: TdsDashboardHashState;
  setFy: (fy: string) => void;
  setQuarter: (quarter: TdsQuarter | null) => void;
  setVendor: (vendorFingerprint: string | null) => void;
}

export function useTdsDashboardHashState(): UseTdsDashboardHashStateResult {
  const currentFy = determineFY(new Date());
  const [state, setState] = useState<TdsDashboardHashState>(() => readHashState(currentFy));

  useEffect(() => {
    writeHashState(state);
  }, [state]);

  useEffect(() => {
    const handler = () => {
      const next = readHashState(currentFy);
      setState((prev) => {
        if (prev.fy === next.fy && prev.quarter === next.quarter && prev.vendorFingerprint === next.vendorFingerprint) {
          return prev;
        }
        return next;
      });
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, [currentFy]);

  const setFy = useCallback((fy: string) => {
    setState((prev) => ({ ...prev, fy }));
  }, []);

  const setQuarter = useCallback((quarter: TdsQuarter | null) => {
    setState((prev) => ({ ...prev, quarter }));
  }, []);

  const setVendor = useCallback((vendorFingerprint: string | null) => {
    setState((prev) => ({ ...prev, vendorFingerprint }));
  }, []);

  return { state, setFy, setQuarter, setVendor };
}
