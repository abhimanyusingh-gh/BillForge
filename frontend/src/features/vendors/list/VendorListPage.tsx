import { useEffect, useMemo, useRef, useState } from "react";
import { useVendorList } from "@/features/vendors/list/useVendorList";
import { NewVendorModal } from "@/features/vendors/create/NewVendorModal";
import {
  TALLY_STATE,
  deriveTallyState,
  type TallyState,
  type VendorDetail,
  type VendorSummary
} from "@/domain/vendor/vendor";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatVendorDate(iso: string | null): string {
  if (iso === null || iso.length === 0) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${day}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}

function tallyLabel(state: TallyState): string {
  if (state === TALLY_STATE.SYNCED) return "SYNCED";
  if (state === TALLY_STATE.DRIFT) return "DRIFT";
  if (state === TALLY_STATE.PENDING) return "PENDING";
  return "NOT IN TALLY";
}

function tallySpillClass(state: TallyState): string {
  if (state === TALLY_STATE.SYNCED) return "spill s-approved";
  if (state === TALLY_STATE.DRIFT) return "spill s-parsed";
  if (state === TALLY_STATE.PENDING) return "spill s-pending";
  return "spill s-needs_review";
}

function navigateToVendor(id: string): void {
  if (typeof window === "undefined") return;
  window.location.hash = `#/vendors/${id}`;
}

export function VendorListPage() {
  const { page, filters, isLoading, error, setFilters, refetch } = useVendorList();
  const [searchInput, setSearchInput] = useState<string>("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const items: VendorSummary[] = useMemo(() => page?.items ?? [], [page]);
  const total = page?.total ?? 0;
  const activeVendor = useMemo<VendorSummary | null>(() => {
    if (items.length === 0) return null;
    return items.find((v) => v.id === activeId) ?? items[0];
  }, [items, activeId]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName ?? "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = searchInput.trim();
    const next = { ...filters };
    if (trimmed.length === 0) {
      delete next.search;
    } else {
      next.search = trimmed;
    }
    setFilters(next);
  };

  const handleVendorCreated = (vendor: VendorDetail) => {
    setShowCreateModal(false);
    refetch();
    navigateToVendor(vendor.id);
  };

  return (
    <section className="vendor-page" aria-labelledby="vendor-page-heading">
      <header className="page-header">
        <h1 id="vendor-page-heading">Vendors</h1>
        <span className="count">{total} active</span>
        <div className="page-tools">
          <button
            type="button"
            className="btn primary vendor-create-btn"
            onClick={() => setShowCreateModal(true)}
          >
            + New vendor
          </button>
        </div>
      </header>

      <div className="vendor-grid">
        <div>
          <form className="vendor-toolbar" onSubmit={handleSearchSubmit} role="search">
            <span className="material-symbols-outlined vendor-toolbar-icon">search</span>
            <input
              ref={searchRef}
              className="vendor-toolbar-input"
              type="search"
              placeholder="Search vendor, PAN, section…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              aria-label="Search vendors"
            />
            <span className="vendor-toolbar-kbd" aria-hidden="true">/</span>
            <span className="vendor-toolbar-chip" aria-label="Date range filter">
              <span className="material-symbols-outlined">event</span>
              FY 25-26
            </span>
          </form>

          {error !== null ? (
            <div className="alert" role="alert">{error}</div>
          ) : null}

          <div className="table-wrap">
            <table className="lbtable" aria-busy={isLoading}>
              <thead>
                <tr>
                  <th scope="col">Vendor</th>
                  <th scope="col" className="vendor-col-pan">PAN</th>
                  <th scope="col" className="vendor-col-section">Section</th>
                  <th scope="col" className="num-col">FY 25-26 TDS</th>
                  <th scope="col" className="vendor-col-tally">Tally</th>
                  <th scope="col" className="num-col">Bills</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !isLoading ? (
                  <tr>
                    <td colSpan={6} className="vendor-empty">
                      {error === null ? "No vendors yet — they auto-create as invoices arrive." : "—"}
                    </td>
                  </tr>
                ) : (
                  items.map((vendor) => {
                    const tally = deriveTallyState(vendor);
                    const isActive = activeVendor?.id === vendor.id;
                    return (
                      <tr
                        key={vendor.id}
                        className={isActive ? "vendor-row row-active" : "vendor-row"}
                        onClick={() => setActiveId(vendor.id)}
                        onDoubleClick={() => navigateToVendor(vendor.id)}
                        tabIndex={0}
                        role="button"
                        aria-label={`Select vendor ${vendor.name}`}
                        aria-current={isActive ? "true" : undefined}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            navigateToVendor(vendor.id);
                          } else if (event.key === " ") {
                            event.preventDefault();
                            setActiveId(vendor.id);
                          }
                        }}
                      >
                        <td className="vendor-name-cell">
                          <span className="vendor-name">{vendor.name}</span>
                          {vendor.msme !== null ? (
                            <span className="vendor-msme-inline">MSME</span>
                          ) : null}
                        </td>
                        <td className="mono-cell">{vendor.pan ?? "—"}</td>
                        <td className="mono-cell vendor-section-cell">{vendor.defaultTdsSection ?? "—"}</td>
                        <td className="num-cell">—</td>
                        <td>
                          <span className={tallySpillClass(tally)}>
                            <span className="dot" />
                            {tallyLabel(tally)}
                          </span>
                        </td>
                        <td className="num-cell">{vendor.invoiceCount}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="vendor-side-pane" aria-label="Selected vendor preview">
          {activeVendor !== null ? <VendorPreviewPane vendor={activeVendor} /> : null}
        </aside>
      </div>

      {showCreateModal ? (
        <NewVendorModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleVendorCreated}
        />
      ) : null}
    </section>
  );
}

interface VendorPreviewPaneProps {
  vendor: VendorSummary;
}

function VendorPreviewPane({ vendor }: VendorPreviewPaneProps) {
  const tally = deriveTallyState(vendor);
  const sectionCode = vendor.defaultTdsSection ?? "194C";
  return (
    <div className="vendor-side-card">
      <div className="vendor-side-head">
        <h2>{vendor.name}</h2>
        <div className="vendor-side-sub">
          PAN <span className="mono-cell">{vendor.pan ?? "—"}</span> · GSTIN{" "}
          <span className="mono-cell">{vendor.gstin ?? "—"}</span>
        </div>
      </div>
      <dl className="kvgrid">
        <div className="kv">
          <dt>Default section</dt>
          <dd className="vendor-section-cell">{sectionCode}</dd>
        </div>
        <div className="kv">
          <dt>Bills (FY)</dt>
          <dd>{vendor.invoiceCount}</dd>
        </div>
        <div className="kv">
          <dt>Last invoice</dt>
          <dd>{formatVendorDate(vendor.lastInvoiceDate)}</dd>
        </div>
        <div className="kv">
          <dt>MSME</dt>
          <dd>{vendor.msme !== null ? `Yes · ${vendor.msme.agreedPaymentDays ?? 45}-day` : "No"}</dd>
        </div>
        <div className="kv">
          <dt>Tally</dt>
          <dd>
            <span className={tallySpillClass(tally)}>
              <span className="dot" />
              {tallyLabel(tally)}
            </span>
          </dd>
        </div>
      </dl>
      <div className="vendor-side-foot">
        <button
          type="button"
          className="btn primary"
          onClick={() => navigateToVendor(vendor.id)}
        >
          Open full vendor
        </button>
      </div>
    </div>
  );
}
