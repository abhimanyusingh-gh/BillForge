import { useEffect, useMemo, useState } from "react";

const STORAGE_PREFIX = "ledgerbuddy:url-migration-dismissed:";
const DISMISSAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface UrlMigrationBannerProps {
  oldPath: string;
  newPath: string;
}

interface DismissalRecord {
  dismissed: boolean;
  timestamp: number;
}

function storageKey(oldPath: string, newPath: string): string {
  return `${STORAGE_PREFIX}${oldPath}->${newPath}`;
}

export function readDismissal(key: string, now: number = Date.now()): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return false;
    }
    const record = JSON.parse(raw) as Partial<DismissalRecord>;
    if (!record || record.dismissed !== true || typeof record.timestamp !== "number") {
      return false;
    }
    if (now - record.timestamp > DISMISSAL_TTL_MS) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* noop */
      }
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function writeDismissal(key: string, now: number = Date.now()): void {
  try {
    const record: DismissalRecord = { dismissed: true, timestamp: now };
    window.localStorage.setItem(key, JSON.stringify(record));
  } catch {
    /* noop */
  }
}

export function UrlMigrationBanner({ oldPath, newPath }: UrlMigrationBannerProps) {
  const key = useMemo(() => storageKey(oldPath, newPath), [oldPath, newPath]);
  const [dismissed, setDismissed] = useState(() => readDismissal(key));

  useEffect(() => {
    setDismissed(readDismissal(key));
  }, [key]);

  if (dismissed) {
    return null;
  }

  const handleDismiss = () => {
    writeDismissal(key);
    setDismissed(true);
    requestAnimationFrame(() => {
      document.getElementById("main-content")?.focus();
    });
  };

  return (
    <div className="url-migration-banner" role="status" aria-live="polite">
      <span className="material-symbols-outlined url-migration-banner-icon" aria-hidden="true">
        info
      </span>
      <p className="url-migration-banner-text">
        This page has moved to <code>{newPath}</code>. Your bookmark has been updated.
      </p>
      <button
        type="button"
        className="app-button app-button-secondary url-migration-banner-dismiss"
        onClick={handleDismiss}
        aria-label="Dismiss URL migration notice"
      >
        Dismiss
      </button>
    </div>
  );
}
