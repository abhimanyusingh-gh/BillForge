import { useEffect, useMemo, useState } from "react";

const STORAGE_PREFIX = "ledgerbuddy:url-migration-dismissed:";

interface UrlMigrationBannerProps {
  oldPath: string;
  newPath: string;
  onDismiss?: () => void;
}

function storageKey(oldPath: string, newPath: string): string {
  return `${STORAGE_PREFIX}${oldPath}->${newPath}`;
}

function readDismissed(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(key: string): void {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // intentionally silent — localStorage is a nice-to-have for persistence
  }
}

export function UrlMigrationBanner({ oldPath, newPath, onDismiss }: UrlMigrationBannerProps) {
  const key = useMemo(() => storageKey(oldPath, newPath), [oldPath, newPath]);
  const [dismissed, setDismissed] = useState(() => readDismissed(key));

  useEffect(() => {
    setDismissed(readDismissed(key));
  }, [key]);

  if (dismissed) {
    return null;
  }

  const handleDismiss = () => {
    writeDismissed(key);
    setDismissed(true);
    onDismiss?.();
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
