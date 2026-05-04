import { VENDOR_PAGE_SIZES, type VendorPageSize } from "@/types/vendor";

interface VendorPaginationBarProps {
  page: number;
  pageSize: VendorPageSize;
  total: number;
  onPageChange: (next: number) => void;
  onPageSizeChange: (next: VendorPageSize) => void;
}

export function VendorPaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange
}: VendorPaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : Math.min((page - 1) * pageSize + 1, total);
  const rangeEnd = Math.min(page * pageSize, total);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="pagination-bar" data-testid="vendors-pagination">
      <div className="pagination-info">
        {rangeStart}–{rangeEnd} of {total}
      </div>
      <div className="pager">
        <button
          type="button"
          className="pager-page"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          data-testid="vendors-pagination-prev"
        >
          Previous
        </button>
        <span className="pager-page active" aria-current="page">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="pager-page"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          data-testid="vendors-pagination-next"
        >
          Next
        </button>
      </div>
      <label className="pagination-size">
        <span>Rows per page</span>
        <select
          className="input"
          value={pageSize}
          data-testid="vendors-pagination-size"
          onChange={(e) => onPageSizeChange(Number(e.target.value) as VendorPageSize)}
        >
          {VENDOR_PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
