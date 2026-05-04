import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  registerUploadedKeys,
  requestPresignedUrls,
  runIngestion,
  uploadInvoiceFiles
} from "@/api";
import { getUserFacingErrorMessage } from "@/lib/common/apiError";
import type { IngestionJobStatus } from "@/types";

const UPLOAD_MAX_FILES = 50;
const UPLOAD_MAX_FILE_SIZE = 20 * 1024 * 1024;
const UPLOAD_ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"] as const;

interface UseInvoiceListUploadsArgs {
  canUploadFiles: boolean;
  loadInvoices: () => Promise<void>;
  setIngestionStatus: (status: IngestionJobStatus | null) => void;
  setError: (message: string | null) => void;
  addToast: (type: "success" | "error" | "info", message: string) => void;
}

interface UseInvoiceListUploadsResult {
  uploadInputRef: React.RefObject<HTMLInputElement>;
  uploadDragActive: boolean;
  uploadProgress: Map<string, number>;
  handleUpload: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleUploadDrop: (event: DragEvent<HTMLDivElement>) => Promise<void>;
  handleUploadDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  handleUploadDragOver: (event: DragEvent<HTMLDivElement>) => void;
  handleUploadDragLeave: (event: DragEvent<HTMLDivElement>) => void;
}

export function useInvoiceListUploads({
  canUploadFiles,
  loadInvoices,
  setIngestionStatus,
  setError,
  addToast
}: UseInvoiceListUploadsArgs): UseInvoiceListUploadsResult {
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [uploadDragActive, setUploadDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Map<string, number>>(new Map());

  const uploadFiles = useCallback(async (files: File[]) => {
    if (!canUploadFiles) {
      addToast("error", "You do not have permission to upload files.");
      return;
    }
    if (files.length === 0) return;

    if (files.length > UPLOAD_MAX_FILES) {
      addToast("error", "Maximum 50 files per upload");
      return;
    }

    for (const file of files) {
      if (file.size > UPLOAD_MAX_FILE_SIZE) {
        addToast("error", `File ${file.name} exceeds the 20 MB limit`);
        return;
      }
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (!UPLOAD_ALLOWED_EXTENSIONS.includes(ext as (typeof UPLOAD_ALLOWED_EXTENSIONS)[number])) {
        addToast("error", `File ${file.name} has an unsupported format. Supported: PDF, JPG, PNG, WEBP`);
        return;
      }
    }

    try {
      setError(null);

      const fileMeta = files.map((f) => ({
        name: f.name,
        contentType: f.type || "application/octet-stream",
        sizeBytes: f.size
      }));

      let presignResponse: Awaited<ReturnType<typeof requestPresignedUrls>> | null = null;
      try {
        presignResponse = await requestPresignedUrls(fileMeta);
      } catch {
        presignResponse = null;
      }

      if (presignResponse && presignResponse.uploads.length === files.length) {
        const progressMap = new Map<string, number>();
        for (const file of files) progressMap.set(file.name, 0);
        setUploadProgress(new Map(progressMap));

        const uploadPromises = presignResponse.uploads.map((entry, idx) => {
          const file = files[idx];
          return new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", entry.uploadUrl);
            xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                progressMap.set(file.name, Math.round((event.loaded / event.total) * 100));
                setUploadProgress(new Map(progressMap));
              }
            };
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                progressMap.set(file.name, 100);
                setUploadProgress(new Map(progressMap));
                resolve();
              } else {
                reject(new Error(`Upload failed for ${file.name}: ${xhr.status}`));
              }
            };
            xhr.onerror = () => reject(new Error(`Upload failed for ${file.name}`));
            xhr.send(file);
          });
        });

        await Promise.all(uploadPromises);

        const keys = presignResponse.uploads.map((entry) => entry.key);
        await registerUploadedKeys(keys);
        setUploadProgress(new Map());
      } else {
        await uploadInvoiceFiles(files);
      }

      await loadInvoices();
      const status = await runIngestion();
      setIngestionStatus(status);
    } catch (uploadError) {
      setUploadProgress(new Map());
      addToast("error", getUserFacingErrorMessage(uploadError, "File upload failed."));
    }
  }, [canUploadFiles, loadInvoices, setIngestionStatus, setError, addToast]);

  const handleUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    try {
      await uploadFiles(files ? Array.from(files) : []);
    } finally {
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  }, [uploadFiles]);

  const handleUploadDrop = useCallback(async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setUploadDragActive(false);
    await uploadFiles(Array.from(event.dataTransfer.files ?? []));
  }, [uploadFiles]);

  const handleUploadDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setUploadDragActive(true);
  }, []);

  const handleUploadDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setUploadDragActive(true);
  }, []);

  const handleUploadDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.currentTarget === event.target) setUploadDragActive(false);
  }, []);

  return {
    uploadInputRef,
    uploadDragActive,
    uploadProgress,
    handleUpload,
    handleUploadDrop,
    handleUploadDragEnter,
    handleUploadDragOver,
    handleUploadDragLeave
  };
}
