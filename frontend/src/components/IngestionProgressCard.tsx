import type { IngestionJobStatus } from "../types";

interface IngestionProgressCardProps {
  status: IngestionJobStatus | null;
  progressPercent: number;
  successfulFiles: number;
  fading?: boolean;
}

export function IngestionProgressCard({ status, progressPercent, successfulFiles, fading }: IngestionProgressCardProps) {
  if (!status || status.state === "idle") {
    return null;
  }

  const cardClassName = status.running
    ? "ingestion-progress-running"
    : status.state === "failed"
      ? "ingestion-progress-failed"
      : status.state === "paused"
        ? "ingestion-progress-running"
        : "ingestion-progress-complete";

  return (
    <div className={`ingestion-progress ${cardClassName}${fading ? " ingestion-progress-fading" : ""}`} role="status" aria-live="polite">
      <div className="ingestion-progress-head">
        {status.running ? <span className="ingestion-spinner" aria-hidden="true" /> : null}
        <strong>
          {status.running ? "Ingestion in progress" : status.state === "paused" ? "Ingestion paused" : status.state === "failed" ? "Ingestion failed" : "Ingestion completed"}
        </strong>
        <span>
          {status.processedFiles}/{status.totalFiles > 0 ? status.totalFiles : "?"} processed
        </span>
      </div>

      <div className="ingestion-progress-track">
        <div className="ingestion-progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>

      <p className="muted ingestion-progress-meta">
        Successful {successfulFiles} | New {status.newInvoices} | Duplicates {status.duplicates} | Failures{" "}
        {status.failures}
      </p>

      {status.state === "failed" && status.error ? <p className="error ingestion-progress-error">{status.error}</p> : null}
    </div>
  );
}
