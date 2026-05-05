import { useEffect, useMemo, useState } from "react";
import { vendorService } from "@/api/vendorService";
import { useMergeVendors } from "@/features/vendors/merge/useMergeVendors";
import type { VendorId, VendorSummary } from "@/domain/vendor/vendor";
import { useSessionStore } from "@/state/sessionStore";

interface VendorMergeDialogProps {
  targetVendorId: VendorId;
  targetVendorName: string;
  onClose: () => void;
  onMerged: () => void;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function VendorMergeDialog({ targetVendorId, targetVendorName, onClose, onMerged }: VendorMergeDialogProps) {
  const tenantId = useSessionStore((state) => state.tenant?.id ?? null);
  const clientOrgId = useSessionStore((state) => state.currentClientOrgId);
  const [candidates, setCandidates] = useState<VendorSummary[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<VendorId | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { isMerging, error, merge } = useMergeVendors();

  useEffect(() => {
    if (tenantId === null || clientOrgId === null) return;
    let cancelled = false;
    const controller = new AbortController();
    vendorService
      .listVendors(tenantId, clientOrgId, { limit: 100 }, controller.signal)
      .then((page) => {
        if (cancelled) return;
        setCandidates(page.items.filter((item) => item.id !== targetVendorId));
      })
      .catch((caught: unknown) => {
        if (cancelled || isAbortError(caught)) return;
        setLoadError(caught instanceof Error ? caught.message : "Failed to load vendors.");
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [tenantId, clientOrgId, targetVendorId]);

  const sourceLabel = useMemo(() => {
    if (selectedSourceId === null) return "—";
    const match = candidates.find((c) => c.id === selectedSourceId);
    return match ? match.name : "—";
  }, [selectedSourceId, candidates]);

  const handleConfirm = async () => {
    if (selectedSourceId === null) return;
    try {
      await merge(targetVendorId, selectedSourceId);
      onMerged();
    } catch {
      // error already surfaced via hook state
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal vendor-merge-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="merge-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="merge-dialog-title">Merge vendor into {targetVendorName}</h2>
        <p className="vendor-section-sub">
          Choose a source vendor. Its ledgers and invoices will be repointed to {targetVendorName}.
        </p>
        {loadError !== null ? <div className="alert" role="alert">{loadError}</div> : null}
        <label className="field">
          <span>Source vendor</span>
          <select
            className="input"
            value={selectedSourceId ?? ""}
            onChange={(event) => {
              const next = event.target.value;
              setSelectedSourceId(next.length === 0 ? null : (next as VendorId));
            }}
          >
            <option value="">Select…</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name} {candidate.gstin ? `· ${candidate.gstin}` : ""}
              </option>
            ))}
          </select>
        </label>
        <p className="vendor-section-sub">
          Source: <strong>{sourceLabel}</strong> → Target: <strong>{targetVendorName}</strong>
        </p>
        {error !== null ? <div className="alert" role="alert">{error}</div> : null}
        <div className="modal-actions">
          <button className="btn btn-secondary" type="button" onClick={onClose} disabled={isMerging}>Cancel</button>
          <button
            className="btn"
            type="button"
            onClick={handleConfirm}
            disabled={isMerging || selectedSourceId === null}
          >
            {isMerging ? "Merging…" : "Confirm merge"}
          </button>
        </div>
      </div>
    </div>
  );
}
