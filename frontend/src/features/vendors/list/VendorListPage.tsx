import { useMemo, useState } from "react";
import { useVendorList } from "@/features/vendors/list/useVendorList";
import { VENDOR_STATUS_VALUES, type VendorStatus, type VendorSummary } from "@/domain/vendor/vendor";

const ALL_STATUS_OPTION = "all";

function formatStatus(status: VendorStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusSpillClass(status: VendorStatus): string {
  if (status === "active") return "spill s-approved";
  if (status === "inactive") return "spill s-pending";
  if (status === "blocked") return "spill s-needs_review";
  return "spill s-parsed";
}

function navigateToVendor(id: string): void {
  if (typeof window === "undefined") return;
  window.location.hash = `#/vendors/${id}`;
}

export function VendorListPage() {
  const { page, filters, isLoading, error, setFilters } = useVendorList();
  const [search, setSearch] = useState<string>("");

  const items: VendorSummary[] = useMemo(() => page?.items ?? [], [page]);
  const total = page?.total ?? 0;

  const withoutKey = (key: keyof typeof filters) => {
    const next = { ...filters };
    delete next[key];
    return next;
  };

  const handleStatusChange = (next: string) => {
    if (next === ALL_STATUS_OPTION) {
      setFilters(withoutKey("status"));
      return;
    }
    setFilters({ ...filters, status: next as VendorStatus });
  };

  const handleMsmeToggle = (next: boolean) => {
    if (!next) {
      setFilters(withoutKey("hasMsme"));
      return;
    }
    setFilters({ ...filters, hasMsme: true });
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = search.trim();
    if (trimmed.length === 0) {
      setFilters(withoutKey("search"));
    } else {
      setFilters({ ...filters, search: trimmed });
    }
  };

  return (
    <section className="vendor-page" aria-labelledby="vendor-page-heading">
      <header className="page-header">
        <h1 id="vendor-page-heading">Vendors</h1>
        <span className="count">{total} total</span>
      </header>

      <form className="vendor-filters" onSubmit={handleSearchSubmit} role="search">
        <label className="vendor-filter-field">
          <span>Search</span>
          <input
            className="input"
            type="search"
            placeholder="Vendor name…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search vendors"
          />
        </label>
        <label className="vendor-filter-field">
          <span>Status</span>
          <select
            className="input"
            value={filters.status ?? ALL_STATUS_OPTION}
            onChange={(event) => handleStatusChange(event.target.value)}
            aria-label="Filter vendors by status"
          >
            <option value={ALL_STATUS_OPTION}>All</option>
            {VENDOR_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {formatStatus(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="vendor-filter-checkrow">
          <input
            type="checkbox"
            checked={filters.hasMsme === true}
            onChange={(event) => handleMsmeToggle(event.target.checked)}
          />
          <span>MSME only</span>
        </label>
        <button className="btn btn-secondary" type="submit">Apply</button>
      </form>

      {error !== null ? (
        <div className="alert" role="alert">{error}</div>
      ) : null}

      <div className="table-wrap">
        <table className="lbtable" aria-busy={isLoading}>
          <thead>
            <tr>
              <th scope="col">Vendor</th>
              <th scope="col">PAN</th>
              <th scope="col">GSTIN</th>
              <th scope="col">Status</th>
              <th scope="col">MSME</th>
              <th scope="col" className="num-col">Bills</th>
              <th scope="col">Last invoice</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={7} className="vendor-empty">
                  {error === null ? "No vendors yet — they auto-create as invoices arrive." : "—"}
                </td>
              </tr>
            ) : (
              items.map((vendor) => (
                <tr
                  key={vendor.id}
                  className="vendor-row"
                  onClick={() => navigateToVendor(vendor.id)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open vendor ${vendor.name}`}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigateToVendor(vendor.id);
                    }
                  }}
                >
                  <td className="vendor-name">{vendor.name}</td>
                  <td className="mono-cell">{vendor.pan ?? "—"}</td>
                  <td className="mono-cell">{vendor.gstin ?? "—"}</td>
                  <td>
                    <span className={statusSpillClass(vendor.vendorStatus)}>
                      <span className="dot" />
                      {formatStatus(vendor.vendorStatus).toUpperCase()}
                    </span>
                  </td>
                  <td>{vendor.msme !== null ? <span className="vendor-pill vendor-pill-msme">MSME</span> : "—"}</td>
                  <td className="num-cell">{vendor.invoiceCount}</td>
                  <td>{vendor.lastInvoiceDate ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
