interface InvoiceListBulkActionsProps {
  selectedCount: number;
  selectedApprovableCount: number;
  selectedExportableCount: number;
  canApproveInvoices: boolean;
  canExportToTally: boolean;
  canDeleteInvoices: boolean;
  onApprove: () => void;
  onExport: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
}

export function InvoiceListBulkActions({
  selectedCount,
  selectedApprovableCount,
  selectedExportableCount,
  canApproveInvoices,
  canExportToTally,
  canDeleteInvoices,
  onApprove,
  onExport,
  onDelete,
  onClearSelection
}: InvoiceListBulkActionsProps) {
  if (selectedCount <= 0) return null;
  if (!canApproveInvoices && !canExportToTally && !canDeleteInvoices) return null;
  return (
    <div className="bulk-action-bar">
      <span className="bulk-count">{selectedCount} selected</span>
      {canApproveInvoices ? (
        <button type="button" className="app-button app-button-primary app-button-sm" disabled={selectedApprovableCount === 0} onClick={onApprove}>
          Approve ({selectedApprovableCount})
        </button>
      ) : null}
      {canExportToTally ? (
        <button type="button" className="app-button app-button-sm app-button-violet" disabled={selectedExportableCount === 0} onClick={onExport}>
          Export ({selectedExportableCount})
        </button>
      ) : null}
      {canDeleteInvoices ? (
        <button type="button" className="app-button app-button-sm app-button-danger" onClick={onDelete}>
          Delete ({selectedCount})
        </button>
      ) : null}
      <button type="button" className="bulk-deselect" onClick={onClearSelection}>Deselect All</button>
    </div>
  );
}
