import { useMemo, useState } from "react";
import type { IngestionJobStatus } from "../types";

interface IngestionProgressCardProps {
  status: IngestionJobStatus | null;
  progressPercent: number;
  successfulFiles: number;
  fading?: boolean;
}

function formatElapsed(startedAt?: string): string {
  if (!startedAt) return "";
  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export function IngestionProgressCard({ status, progressPercent, successfulFiles, fading }: IngestionProgressCardProps) {
  const [expanded, setExpanded] = useState(true);

  if (!status || status.state === "idle") {
    return null;
  }

  const isRunning = status.running;
  const isFailed = status.state === "failed";
  const isPaused = status.state === "paused";
  const isComplete = !isRunning && !isFailed && !isPaused;

  const cardClassName = isRunning || isPaused
    ? "ingestion-progress-running"
    : isFailed
      ? "ingestion-progress-failed"
      : "ingestion-progress-complete";

  const headline = useMemo(() => {
    if (isRunning) {
      return status.totalFiles > 0
        ? `Processing ${status.processedFiles}/${status.totalFiles}`
        : "Ingestion in progress";
    }
    if (isPaused) return "Paused";
    if (isFailed) return "Failed";
    return `Done \u2014 ${status.newInvoices} new`;
  }, [isRunning, isPaused, isFailed, status.totalFiles, status.processedFiles, status.newInvoices]);

  const elapsed = formatElapsed(status.startedAt);
  const icon = isRunning ? "sync" : isFailed ? "error" : isPaused ? "pause_circle" : "check_circle";

  return (
    <div className={`ingestion-overlay ${cardClassName}${fading ? " ingestion-progress-fading" : ""}`} role="status" aria-live="polite">
      <button type="button" className="ingestion-overlay-toggle" onClick={() => setExpanded((v) => !v)}>
        {isRunning ? <span className="ingestion-spinner" aria-hidden="true" /> : <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>{icon}</span>}
        <span className="ingestion-overlay-headline">{headline}</span>
        {elapsed && isRunning ? <span className="ingestion-overlay-elapsed">{elapsed}</span> : null}
        <span className="material-symbols-outlined" style={{ fontSize: "1rem", marginLeft: "auto" }}>{expanded ? "expand_more" : "expand_less"}</span>
      </button>

      {expanded ? (
        <div className="ingestion-overlay-body">
          <div className="ingestion-progress-track">
            <div className={`ingestion-progress-fill${isRunning ? " ingestion-progress-fill-shimmer" : ""}`} style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="muted ingestion-progress-meta">
            Successful {successfulFiles} | New {status.newInvoices} | Duplicates {status.duplicates} | Failures {status.failures}
          </p>
          {isFailed && status.error ? (
            <p className="error ingestion-progress-error">{status.error}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
