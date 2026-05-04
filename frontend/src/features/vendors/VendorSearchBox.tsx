import { useEffect, useState } from "react";

interface VendorSearchBoxProps {
  value: string;
  onChange: (next: string) => void;
  debounceMs?: number;
}

const DEFAULT_DEBOUNCE_MS = 250;

export function VendorSearchBox({ value, onChange, debounceMs = DEFAULT_DEBOUNCE_MS }: VendorSearchBoxProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (draft === value) return;
    const handle = window.setTimeout(() => onChange(draft), debounceMs);
    return () => window.clearTimeout(handle);
  }, [draft, debounceMs, onChange, value]);

  return (
    <label className="input-with-icon">
      <span className="sr-only">Search</span>
      <span className="lead-icon material-symbols-outlined" aria-hidden="true">
        search
      </span>
      <input
        type="search"
        className="input"
        placeholder="Search by name, GSTIN, PAN..."
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        data-testid="vendors-search-input"
        aria-label="Search vendors by name, GSTIN, or PAN"
      />
    </label>
  );
}
