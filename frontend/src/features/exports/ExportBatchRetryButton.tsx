import { useState } from "react";
import { retryExportFailures } from "@/api";
import { normalizeApiError } from "@/lib/common/apiError";

interface ExportBatchRetryButtonProps {
  batchId: string;
  onRetried: () => void;
  onError: (message: string) => void;
}

export function ExportBatchRetryButton({ batchId, onRetried, onError }: ExportBatchRetryButtonProps) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      await retryExportFailures(batchId);
      onRetried();
    } catch (error) {
      onError(normalizeApiError(error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="app-button app-button-secondary app-button-sm export-history-retry-btn"
      disabled={busy}
      onClick={() => void handleClick()}
    >
      <span className="material-symbols-outlined" aria-hidden="true">
        {busy ? "progress_activity" : "refresh"}
      </span>
      {busy ? "Retrying..." : "Retry failures"}
    </button>
  );
}
