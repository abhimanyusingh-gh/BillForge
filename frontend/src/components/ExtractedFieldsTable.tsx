import { useState } from "react";
import type { ExtractedFieldRow } from "../extractedFields";
import { formatOcrConfidenceLabel } from "../extractedFields";
import { getConfidenceTone } from "../confidence";

interface ExtractedFieldsTableProps {
  rows: ExtractedFieldRow[];
  cropUrlByField?: Partial<Record<ExtractedFieldRow["fieldKey"], string>>;
  editable?: boolean;
  onSaveField?: (fieldKey: string, value: string) => Promise<void>;
}

interface CropPreviewState {
  label: string;
  url: string;
}

export function ExtractedFieldsTable({ rows, cropUrlByField, editable, onSaveField }: ExtractedFieldsTableProps) {
  const [cropPreview, setCropPreview] = useState<CropPreviewState | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  function startEditing(row: ExtractedFieldRow) {
    if (!editable || row.fieldKey === "notes") return;
    setEditingField(row.fieldKey);
    setEditValue(row.rawValue ?? row.value === "-" ? "" : row.rawValue ?? row.value);
  }

  async function confirmEdit() {
    if (!editingField || !onSaveField) return;
    try {
      setSaving(true);
      await onSaveField(editingField, editValue);
    } finally {
      setSaving(false);
      setEditingField(null);
      setEditValue("");
    }
  }

  function cancelEdit() {
    setEditingField(null);
    setEditValue("");
  }

  return (
    <>
      <table className="mapping-table extracted-table">
        <thead>
          <tr>
            <th>Detected Label</th>
            <th>Detected Value</th>
            <th>Source</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const cropUrl = cropUrlByField?.[row.fieldKey];
            const isEditing = editingField === row.fieldKey;
            const canEdit = editable && row.fieldKey !== "notes" && !!onSaveField;
            return (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>
                  {isEditing ? (
                    <div className="extracted-value-cell">
                      <input
                        className="extracted-value-input"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void confirmEdit();
                          if (e.key === "Escape") cancelEdit();
                        }}
                        disabled={saving}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="field-save-button"
                        aria-label={`Save ${row.label}`}
                        disabled={saving}
                        onClick={() => void confirmEdit()}
                      >
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <span
                      className="extracted-value-display"
                      data-editable={canEdit || undefined}
                      onClick={canEdit ? () => startEditing(row) : undefined}
                      role={canEdit ? "button" : undefined}
                      tabIndex={canEdit ? 0 : undefined}
                      onKeyDown={canEdit ? (e) => { if (e.key === "Enter") startEditing(row); } : undefined}
                    >
                      {row.value}
                    </span>
                  )}
                </td>
                <td>
                  {cropUrl ? (
                    <button
                      type="button"
                      className="field-crop-button"
                      aria-label={`Inspect extracted source crop for ${row.label}`}
                      title={`Inspect extracted source crop for ${row.label}`}
                      onClick={() => setCropPreview({ label: row.label, url: cropUrl })}
                    >
                      <svg
                        className="field-crop-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path
                          d="M2 12C4.4 7.8 8 5.5 12 5.5C16 5.5 19.6 7.8 22 12C19.6 16.2 16 18.5 12 18.5C8 18.5 4.4 16.2 2 12Z"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        />
                        <circle cx="12" cy="12" r="3.1" fill="currentColor" />
                      </svg>
                    </button>
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
                <td>
                  {row.confidence !== undefined ? (
                    <span className={`field-confidence-badge field-confidence-${getConfidenceTone(row.confidence > 1 ? row.confidence : row.confidence * 100)}`}>
                      {formatOcrConfidenceLabel(row.confidence)}
                    </span>
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {cropPreview ? (
        <div className="crop-preview-overlay" role="presentation" onClick={() => setCropPreview(null)}>
          <section
            className="crop-preview-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Cropped source for ${cropPreview.label}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="crop-preview-header">
              <h4>{cropPreview.label} Source Crop</h4>
              <button type="button" onClick={() => setCropPreview(null)}>
                Close
              </button>
            </div>
            <img src={cropPreview.url} alt={`Cropped source for ${cropPreview.label}`} loading="lazy" />
          </section>
        </div>
      ) : null}
    </>
  );
}
