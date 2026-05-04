import { useCallback, useEffect, useRef, useState } from "react";
import { fetchIngestionStatus, subscribeIngestionSSE } from "@/api";
import type { IngestionJobStatus } from "@/types";

interface UseInvoiceListIngestionArgs {
  loadInvoices: () => Promise<void>;
  onGmailStatusRefresh: () => void;
  setError: (message: string | null) => void;
  addToast: (type: "success" | "error" | "info", message: string) => void;
}

interface UseInvoiceListIngestionResult {
  ingestionStatus: IngestionJobStatus | null;
  setIngestionStatus: React.Dispatch<React.SetStateAction<IngestionJobStatus | null>>;
  ingestionFading: boolean;
  refreshIngestionStatus: () => Promise<void>;
  ingestionProgressPercent: number;
  ingestionSuccessfulFiles: number;
}

export function useInvoiceListIngestion({
  loadInvoices,
  onGmailStatusRefresh,
  setError,
  addToast
}: UseInvoiceListIngestionArgs): UseInvoiceListIngestionResult {
  const [ingestionStatus, setIngestionStatus] = useState<IngestionJobStatus | null>(null);
  const [ingestionFading, setIngestionFading] = useState(false);
  const ingestionWasRunningRef = useRef(false);
  const sseLoadPendingRef = useRef(false);
  const sseLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshIngestionStatus = useCallback(async () => {
    try {
      const status = await fetchIngestionStatus();
      setIngestionStatus(status);
    } catch {
    }
  }, []);

  useEffect(() => {
    if (!ingestionStatus?.running) {
      return undefined;
    }

    const unsub = subscribeIngestionSSE(
      (status) => {
        if (status.systemAlert) {
          addToast("error", status.systemAlert);
        }
        setIngestionStatus(status);
        if (!sseLoadTimerRef.current) {
          void loadInvoices();
          sseLoadTimerRef.current = setTimeout(() => {
            sseLoadTimerRef.current = null;
            if (sseLoadPendingRef.current) {
              sseLoadPendingRef.current = false;
              void loadInvoices();
            }
          }, 2000);
        } else {
          sseLoadPendingRef.current = true;
        }
      },
      () => {
        void refreshIngestionStatus();
        void loadInvoices();
      }
    );

    return () => {
      unsub();
      if (sseLoadTimerRef.current) {
        clearTimeout(sseLoadTimerRef.current);
        sseLoadTimerRef.current = null;
      }
    };
  }, [ingestionStatus?.running]);

  useEffect(() => {
    if (!ingestionStatus?.running) {
      return undefined;
    }
    const poller = window.setInterval(() => {
      void refreshIngestionStatus();
      void loadInvoices();
    }, 3000);
    return () => window.clearInterval(poller);
  }, [ingestionStatus?.running]);

  useEffect(() => {
    const isRunning = ingestionStatus?.running === true;
    if (ingestionWasRunningRef.current && !isRunning) {
      if (ingestionStatus?.state === "failed") {
        setError(ingestionStatus.error ? `Ingestion failed: ${ingestionStatus.error}` : "Ingestion failed.");
      }
      void loadInvoices();
      onGmailStatusRefresh();
    }
    ingestionWasRunningRef.current = isRunning;
  }, [ingestionStatus?.running, ingestionStatus?.state, ingestionStatus?.error]);

  useEffect(() => {
    if (ingestionStatus?.state !== "completed") {
      setIngestionFading(false);
      return;
    }
    const fadeTimer = setTimeout(() => setIngestionFading(true), 5000);
    const hideTimer = setTimeout(() => setIngestionStatus(null), 7000);
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer); };
  }, [ingestionStatus?.state]);

  const ingestionProgressPercent = !ingestionStatus || ingestionStatus.totalFiles <= 0
    ? 0
    : Math.min(100, Math.round((ingestionStatus.processedFiles / ingestionStatus.totalFiles) * 100));

  const ingestionSuccessfulFiles = !ingestionStatus
    ? 0
    : Math.max(0, ingestionStatus.processedFiles - ingestionStatus.failures);

  return {
    ingestionStatus,
    setIngestionStatus,
    ingestionFading,
    refreshIngestionStatus,
    ingestionProgressPercent,
    ingestionSuccessfulFiles
  };
}
