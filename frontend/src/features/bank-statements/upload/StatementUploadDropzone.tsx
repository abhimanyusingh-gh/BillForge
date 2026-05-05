import { useCallback, useRef, useState, type DragEvent } from "react";
import { bankService } from "@/api/bankService";
import type { BankStatementUploadResult } from "@/domain/bank/statement";
import { useBankContext } from "@/features/bank-statements/internal";

const ACCEPTED_TYPES = ".pdf,.csv,.ofx,.xlsx,.xls,.png,.jpg,.jpeg";

const UPLOAD_STATUS = {
  IDLE: "idle",
  UPLOADING: "uploading",
  SUCCESS: "success",
  ERROR: "error"
} as const;

type UploadStatus = (typeof UPLOAD_STATUS)[keyof typeof UPLOAD_STATUS];

interface UploadHookState {
  status: UploadStatus;
  error: string | null;
  result: BankStatementUploadResult | null;
  upload: (file: File) => Promise<BankStatementUploadResult | null>;
  reset: () => void;
}

function useUploadStatement(onSuccess?: () => void): UploadHookState {
  const ctx = useBankContext();
  const [status, setStatus] = useState<UploadStatus>(UPLOAD_STATUS.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BankStatementUploadResult | null>(null);

  const upload = useCallback(
    async (file: File): Promise<BankStatementUploadResult | null> => {
      if (ctx === null) {
        setError("No active client org.");
        setStatus(UPLOAD_STATUS.ERROR);
        return null;
      }
      setStatus(UPLOAD_STATUS.UPLOADING);
      setError(null);
      try {
        const uploaded = await bankService.uploadStatement({
          tenantId: ctx.tenantId,
          clientOrgId: ctx.clientOrgId,
          file
        });
        setResult(uploaded);
        setStatus(UPLOAD_STATUS.SUCCESS);
        if (onSuccess) onSuccess();
        return uploaded;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Upload failed.");
        setStatus(UPLOAD_STATUS.ERROR);
        return null;
      }
    },
    [ctx?.tenantId, ctx?.clientOrgId, onSuccess]
  );

  const reset = useCallback(() => {
    setStatus(UPLOAD_STATUS.IDLE);
    setError(null);
    setResult(null);
  }, []);

  return { status, error, result, upload, reset };
}

interface StatementUploadDropzoneProps {
  onUploaded: () => void;
}

export function StatementUploadDropzone({ onUploaded }: StatementUploadDropzoneProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const { status, error, upload, reset } = useUploadStatement(onUploaded);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      await upload(file);
    },
    [upload]
  );

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void handleFiles(event.dataTransfer.files);
  };
  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);

  const isUploading = status === UPLOAD_STATUS.UPLOADING;

  return (
    <div
      className={`bs-dropzone${isDragging ? " is-dragging" : ""}${isUploading ? " is-uploading" : ""}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      data-testid="statement-dropzone"
    >
      <span className="bs-dropzone__icon material-symbols-outlined" aria-hidden>
        upload_file
      </span>
      <div className="bs-dropzone__copy">
        <div className="bs-dropzone__title">Drop statement files here</div>
        <div className="bs-dropzone__hint">PDF, CSV, OFX — auto-detected</div>
      </div>
      <button
        type="button"
        className="bs-dropzone__browse"
        onClick={() => fileRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? "Uploading…" : "Browse files"}
      </button>
      <input
        ref={fileRef}
        className="bs-dropzone__input"
        type="file"
        accept={ACCEPTED_TYPES}
        aria-label="Upload bank statement"
        onChange={(event) => void handleFiles(event.target.files)}
      />
      {status === UPLOAD_STATUS.SUCCESS ? (
        <div className="bs-dropzone__status is-success" role="status">
          Statement parsed.{" "}
          <button type="button" className="bs-dropzone__reset" onClick={reset}>
            Upload another
          </button>
        </div>
      ) : null}
      {status === UPLOAD_STATUS.ERROR && error !== null ? (
        <div className="bs-dropzone__status is-error" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}
