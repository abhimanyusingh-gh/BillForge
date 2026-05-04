interface InvoiceListPaginationProps {
  currentPage: number;
  pageSize: number;
  totalInvoices: number;
  onPageChange: (page: number) => void;
  onPageDelta: (delta: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function InvoiceListPagination({
  currentPage,
  pageSize,
  totalInvoices,
  onPageChange,
  onPageDelta,
  onPageSizeChange
}: InvoiceListPaginationProps) {
  if (totalInvoices <= 0) return null;
  const totalPages = Math.max(1, Math.ceil(totalInvoices / pageSize));
  const lastPage = Math.ceil(totalInvoices / pageSize);
  return (
    <div className="pagination-bar">
      <div className="pagination-info">
        {Math.min((currentPage - 1) * pageSize + 1, totalInvoices)}–{Math.min(currentPage * pageSize, totalInvoices)} of {totalInvoices}
      </div>
      <div className="pagination-controls">
        <button type="button" className="app-button app-button-secondary app-button-sm" disabled={currentPage <= 1} onClick={() => onPageChange(1)}>First</button>
        <button type="button" className="app-button app-button-secondary app-button-sm" disabled={currentPage <= 1} onClick={() => onPageDelta(-1)}>Prev</button>
        <span className="pagination-page">Page {currentPage} of {totalPages}</span>
        <button type="button" className="app-button app-button-secondary app-button-sm" disabled={currentPage >= lastPage} onClick={() => onPageDelta(1)}>Next</button>
        <button type="button" className="app-button app-button-secondary app-button-sm" disabled={currentPage >= lastPage} onClick={() => onPageChange(lastPage)}>Last</button>
      </div>
      <div className="pagination-size">
        <span>Rows:</span>
        <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>
    </div>
  );
}
