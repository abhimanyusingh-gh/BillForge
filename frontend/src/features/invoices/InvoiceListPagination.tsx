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
    <div className="page-tools">
      <span className="sub">
        {Math.min((currentPage - 1) * pageSize + 1, totalInvoices)}–{Math.min(currentPage * pageSize, totalInvoices)} of {totalInvoices}
      </span>
      <div className="pager">
        <button type="button" className="pager-page" disabled={currentPage <= 1} onClick={() => onPageChange(1)}>First</button>
        <button type="button" className="pager-page" disabled={currentPage <= 1} onClick={() => onPageDelta(-1)}>Prev</button>
        <span className="pager-page active">Page {currentPage} of {totalPages}</span>
        <button type="button" className="pager-page" disabled={currentPage >= lastPage} onClick={() => onPageDelta(1)}>Next</button>
        <button type="button" className="pager-page" disabled={currentPage >= lastPage} onClick={() => onPageChange(lastPage)}>Last</button>
      </div>
      <span className="sub">Rows:</span>
      <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}>
        <option value={10}>10</option>
        <option value={20}>20</option>
        <option value={50}>50</option>
        <option value={100}>100</option>
      </select>
    </div>
  );
}
