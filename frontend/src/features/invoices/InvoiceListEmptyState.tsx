import { EmptyState } from "@/components/common/EmptyState";

interface InvoiceListEmptyStateProps {
  hasActiveFilters: boolean;
  canUploadFiles: boolean;
  onClearAllFilters: () => void;
  onUploadClick: () => void;
}

export function InvoiceListEmptyState({
  hasActiveFilters,
  canUploadFiles,
  onClearAllFilters,
  onUploadClick
}: InvoiceListEmptyStateProps) {
  return (
    <EmptyState
      icon={hasActiveFilters ? "filter_list_off" : "receipt_long"}
      heading={hasActiveFilters ? "No matching invoices" : "No invoices yet"}
      description={hasActiveFilters ? "Try adjusting your filters or date range." : "Upload invoice PDFs or connect a Gmail inbox to start processing."}
      action={hasActiveFilters
        ? <button type="button" className="btn ghost" onClick={onClearAllFilters}>Clear Filters</button>
        : (canUploadFiles ? <button type="button" className="btn primary" onClick={onUploadClick}>Upload Files</button> : undefined)}
    />
  );
}
