import { useMemo, useState } from "react";
import {
  INVOICE_STATUS,
  type Invoice,
  type InvoiceId,
  type InvoiceStatus
} from "@/domain/invoice/invoice";
import { useInvoiceList } from "@/features/invoices/list/useInvoiceList";
import { useApproveInvoices } from "@/features/invoices/actions/useApproveInvoices";
import { formatDate, formatInr, INVOICE_STATUS_LABEL } from "@/features/invoices/format";

const STATUS_CHIPS: ReadonlyArray<{ id: InvoiceStatus | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: INVOICE_STATUS.NEEDS_REVIEW, label: INVOICE_STATUS_LABEL[INVOICE_STATUS.NEEDS_REVIEW] },
  { id: INVOICE_STATUS.AWAITING_APPROVAL, label: INVOICE_STATUS_LABEL[INVOICE_STATUS.AWAITING_APPROVAL] },
  { id: INVOICE_STATUS.APPROVED, label: INVOICE_STATUS_LABEL[INVOICE_STATUS.APPROVED] },
  { id: INVOICE_STATUS.EXPORTED, label: INVOICE_STATUS_LABEL[INVOICE_STATUS.EXPORTED] }
];

function navigateToDetail(id: InvoiceId): void {
  if (typeof window === "undefined") return;
  window.location.hash = `#/invoices/${id}`;
}

export function InvoiceListPage() {
  const list = useInvoiceList();
  const approve = useApproveInvoices(() => {
    setSelected(new Set());
    list.refresh();
  });
  const [selected, setSelected] = useState<Set<InvoiceId>>(new Set());

  const allSelected = useMemo(
    () => list.invoices.length > 0 && list.invoices.every((inv) => selected.has(inv.id)),
    [list.invoices, selected]
  );

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(list.invoices.map((inv) => inv.id)));
  };

  const toggleOne = (id: InvoiceId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onApproveSelected = async () => {
    if (selected.size === 0) return;
    await approve.approve(Array.from(selected));
  };

  return (
    <section className="invoice-list-page" aria-label="Invoices">
      <div className="page-header">
        <h1>Invoices</h1>
        <span className="count">
          {list.isLoading ? "loading…" : `${list.invoices.length} of ${list.total}`}
        </span>
        <div className="page-tools">
          <div className="inv-search">
            <span className="material-symbols-outlined">search</span>
            <input
              type="search"
              value={list.filters.search ?? ""}
              onChange={(event) => list.setSearch(event.target.value)}
              placeholder="Search vendor, invoice #, GSTIN…"
              aria-label="Search invoices"
            />
          </div>
        </div>
      </div>

      <div className="chips">
        {STATUS_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={`chip${list.filters.status === chip.id ? " active" : ""}`}
            onClick={() => list.setStatus(chip.id)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {list.error ? (
        <div role="alert" className="invoice-list-error">
          {list.error}
        </div>
      ) : null}

      {selected.size > 0 ? (
        <div className="invoice-bulk-bar" role="toolbar" aria-label="Bulk actions">
          <span className="invoice-bulk-bar-count">{selected.size} selected</span>
          <button
            type="button"
            className="invoice-bulk-bar-action"
            onClick={onApproveSelected}
            disabled={approve.isApproving}
          >
            {approve.isApproving ? "Approving…" : "Approve selected"}
          </button>
          <button
            type="button"
            className="invoice-bulk-bar-action invoice-bulk-bar-action-soft"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
          {approve.error ? <span className="invoice-bulk-bar-error">{approve.error}</span> : null}
        </div>
      ) : null}

      <div className="table-wrap inv-table-wrap">
        <table className="lbtable">
          <thead>
            <tr>
              <th className="invoice-cell-select">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allSelected}
                  onChange={toggleAll}
                />
              </th>
              <th>Status</th>
              <th>Vendor</th>
              <th>Invoice #</th>
              <th>Date</th>
              <th className="invoice-cell-num">Gross</th>
              <th className="invoice-cell-num">TDS</th>
              <th className="invoice-cell-num">Net</th>
            </tr>
          </thead>
          <tbody>
            {list.invoices.length === 0 && !list.isLoading ? (
              <tr>
                <td colSpan={8}>
                  <div className="inv-empty">No invoices match your filters.</div>
                </td>
              </tr>
            ) : null}
            {list.invoices.map((inv) => (
              <InvoiceRow
                key={inv.id}
                invoice={inv}
                isSelected={selected.has(inv.id)}
                onToggle={() => toggleOne(inv.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface InvoiceRowProps {
  invoice: Invoice;
  isSelected: boolean;
  onToggle: () => void;
}

function InvoiceRow({ invoice, isSelected, onToggle }: InvoiceRowProps) {
  return (
    <tr
      className={isSelected ? "invoice-row-selected" : undefined}
      onClick={() => navigateToDetail(invoice.id)}
    >
      <td
        className="invoice-cell-select"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          aria-label={`Select invoice ${invoice.invoiceNumber}`}
        />
      </td>
      <td>
        <span className={`spill s-${invoice.status}`}>
          <span className="dot" />
          {INVOICE_STATUS_LABEL[invoice.status].toUpperCase()}
        </span>
      </td>
      <td className="invoice-cell-vendor">{invoice.vendor}</td>
      <td className="mono-cell">{invoice.invoiceNumber}</td>
      <td className="mono-cell">{formatDate(invoice.invoiceDate)}</td>
      <td className="invoice-cell-num">{formatInr(invoice.totalAmount)}</td>
      <td className="invoice-cell-num invoice-cell-tds">{formatInr(invoice.tdsAmount)}</td>
      <td className="invoice-cell-num invoice-cell-net">{formatInr(invoice.netAmount)}</td>
    </tr>
  );
}
