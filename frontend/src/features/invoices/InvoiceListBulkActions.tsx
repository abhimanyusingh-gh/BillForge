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
    <div className="page-tools">
      <span className="sub">{selectedCount} selected</span>
      {canApproveInvoices ? (
        <button type="button" className="btn primary" disabled={selectedApprovableCount === 0} onClick={onApprove}>
          Approve ({selectedApprovableCount})
        </button>
      ) : null}
      {canExportToTally ? (
        <button type="button" className="btn primary" disabled={selectedExportableCount === 0} onClick={onExport}>
          Export ({selectedExportableCount})
        </button>
      ) : null}
      {canDeleteInvoices ? (
        <button type="button" className="btn danger" onClick={onDelete}>
          Delete ({selectedCount})
        </button>
      ) : null}
      <button type="button" className="btn ghost" onClick={onClearSelection}>Deselect All</button>
    </div>
  );
}
