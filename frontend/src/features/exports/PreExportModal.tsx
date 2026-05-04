import { useEffect } from "react";

export const PRE_EXPORT_CHECK_STATE = {
  PASS: "pass",
  WARN: "warn",
  FAIL: "fail"
} as const;

export type PreExportCheckState = (typeof PRE_EXPORT_CHECK_STATE)[keyof typeof PRE_EXPORT_CHECK_STATE];

export interface PreExportCheck {
  state: PreExportCheckState;
  label: string;
  detail: string;
}

interface PreExportModalProps {
  open: boolean;
  onClose: () => void;
  invoiceCount?: number;
  netLabel?: string;
  companyLabel?: string;
  checks?: PreExportCheck[];
  onProceed?: () => void;
}

const ICON_FOR_STATE: Record<PreExportCheckState, string> = {
  [PRE_EXPORT_CHECK_STATE.PASS]: "check",
  [PRE_EXPORT_CHECK_STATE.WARN]: "warning",
  [PRE_EXPORT_CHECK_STATE.FAIL]: "close"
};

export function PreExportModal({
  open,
  onClose,
  invoiceCount = 0,
  netLabel = "—",
  companyLabel = "—",
  checks = [],
  onProceed
}: PreExportModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const ready = checks.filter((c) => c.state === PRE_EXPORT_CHECK_STATE.PASS).length;
  const warn = checks.filter((c) => c.state === PRE_EXPORT_CHECK_STATE.WARN).length;
  const blocker = checks.filter((c) => c.state === PRE_EXPORT_CHECK_STATE.FAIL).length;
  const blocked = blocker > 0;

  return (
    <div className="scrim" onClick={onClose} role="presentation">
      <div className="modal-card" onClick={(e) => e.stopPropagation()} data-testid="pre-export-modal">
        <div className="modal-head">
          <div>
            <h2>Pre-export validation</h2>
            <div className="pre-export-modal-subtitle">
              {invoiceCount} invoices &middot; {netLabel} net &middot; {companyLabel}
            </div>
          </div>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="modal-body">
          <div className="pre-export-summary">
            <div className="pre-export-summary-tile" data-tone="ready">
              <div className="pre-export-summary-tile-num lb-mono">{ready}</div>
              <div className="pre-export-summary-tile-lbl">Ready</div>
            </div>
            <div className="pre-export-summary-tile" data-tone="warning">
              <div className="pre-export-summary-tile-num lb-mono">{warn}</div>
              <div className="pre-export-summary-tile-lbl">Warnings</div>
            </div>
            <div className="pre-export-summary-tile" data-tone="blocker">
              <div className="pre-export-summary-tile-num lb-mono">{blocker}</div>
              <div className="pre-export-summary-tile-lbl">Blockers</div>
            </div>
          </div>
          {checks.length === 0 ? (
            <p className="tds-placeholder-desc">
              Pre-flight checks (GL mapping, vendor master, AlterID freshness, voucher GUIDs, F12)
              will populate here once the BE pre-export endpoint lands (issue #428).
            </p>
          ) : (
            <ul className="pre-export-check-list">
              {checks.map((c, i) => (
                <li
                  key={`${c.label}-${i}`}
                  className="pre-export-check-row"
                  data-state={c.state}
                >
                  <span className="pre-export-check-icon">
                    <span className="material-symbols-outlined">{ICON_FOR_STATE[c.state]}</span>
                  </span>
                  <div>
                    <div className="pre-export-check-label">{c.label}</div>
                    <div className="pre-export-check-detail">{c.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="app-button app-button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="app-button app-button-primary"
            onClick={onProceed}
            disabled={blocked || !onProceed}
            aria-disabled={blocked || !onProceed}
          >
            {blocked ? `Export blocked (${blocker})` : `Export ${invoiceCount}`}
          </button>
        </div>
      </div>
    </div>
  );
}
