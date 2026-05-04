import {
  DataTable,
  DATATABLE_DENSITY,
  FetchOverlay,
  TABLE_QUERY_SORT_DIRECTION,
  type DataTableColumn,
  type DataTableSort,
  type TableQuerySort
} from "@/components/ds";
import { isInvoiceSelectable } from "@/lib/common/selection";
import type { Invoice } from "@/types";
import type { TableDensity } from "@/stores/userPrefsStore";
import { InvoiceListBulkActions } from "@/features/invoices/InvoiceListBulkActions";
import { InvoiceListEmptyState } from "@/features/invoices/InvoiceListEmptyState";
import { InvoiceListPagination } from "@/features/invoices/InvoiceListPagination";

interface PageHeaderMeta {
  totalCount: number;
  filteredCount: number;
  isLoading: boolean;
  hasActiveFilters: boolean;
}

function mapDataTableSortToTableQuerySort(sort: DataTableSort | null): TableQuerySort | undefined {
  if (!sort) return undefined;
  return {
    col: sort.id,
    dir:
      sort.direction === "desc"
        ? TABLE_QUERY_SORT_DIRECTION.desc
        : TABLE_QUERY_SORT_DIRECTION.asc,
    loading: false
  };
}

interface InvoiceListPanelProps {
  tableDensity: TableDensity;
  loading: boolean;
  invoices: Invoice[];
  filteredInvoices: Invoice[];
  hasActiveFilters: boolean;
  canUploadFiles: boolean;
  onClearAllFilters: () => void;
  onUploadClick: () => void;
  invoiceColumns: ReadonlyArray<DataTableColumn<Invoice>>;
  selectedRowKeys: ReadonlySet<string>;
  dataTableSort: DataTableSort | null;
  onSortChange: (next: DataTableSort | undefined) => void;
  onRowClick: (invoice: Invoice) => void;
  activeId: string | null;
  onSelectionChange: (next: ReadonlySet<string>) => void;
  selectedIds: ReadonlyArray<string>;
  selectedApprovableIds: ReadonlyArray<string>;
  selectedExportableIds: ReadonlyArray<string>;
  canApproveInvoices: boolean;
  canExportToTally: boolean;
  canDeleteInvoices: boolean;
  onApprove: () => void;
  onExport: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
  currentPage: number;
  pageSize: number;
  totalInvoices: number;
  onPageChange: (page: number) => void;
  onPageDelta: (delta: number) => void;
  onPageSizeChange: (size: number) => void;
  pageHeaderMeta?: PageHeaderMeta;
}

export function InvoiceListPanel({
  tableDensity,
  loading,
  invoices,
  filteredInvoices,
  hasActiveFilters,
  canUploadFiles,
  onClearAllFilters,
  onUploadClick,
  invoiceColumns,
  selectedRowKeys,
  dataTableSort,
  onSortChange,
  onRowClick,
  activeId,
  onSelectionChange,
  selectedIds,
  selectedApprovableIds,
  selectedExportableIds,
  canApproveInvoices,
  canExportToTally,
  canDeleteInvoices,
  onApprove,
  onExport,
  onDelete,
  onClearSelection,
  currentPage,
  pageSize,
  totalInvoices,
  onPageChange,
  onPageDelta,
  onPageSizeChange,
  pageHeaderMeta
}: InvoiceListPanelProps) {
  const meta = pageHeaderMeta;
  return (
    <section className="panel list-panel invoice-list-panel" data-density={tableDensity}>
      <div className="page-header invoice-list-page-header">
        <h1>Invoices</h1>
        <span className="count">
          {meta?.isLoading
            ? "loading..."
            : meta
              ? meta.hasActiveFilters
                ? `${meta.filteredCount} of ${meta.totalCount} match`
                : `${meta.totalCount} records`
              : loading
                ? "Loading..."
                : `${invoices.length} records`}
        </span>
      </div>

      {loading && invoices.length === 0 ? (
        <div className="invoice-list-skeleton">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton skeleton-row" />)}
        </div>
      ) : null}

      {!loading && invoices.length === 0 ? (
        <InvoiceListEmptyState
          hasActiveFilters={hasActiveFilters}
          canUploadFiles={canUploadFiles}
          onClearAllFilters={onClearAllFilters}
          onUploadClick={onUploadClick}
        />
      ) : null}

      {invoices.length > 0 || loading ? (
        <div className={`list-scroll inv-table-wrap${loading && invoices.length > 0 ? " list-scroll-loading is-loading" : ""}`}>
          {loading && invoices.length > 0 ? (
            <FetchOverlay
              isLoading
              sort={mapDataTableSortToTableQuerySort(dataTableSort)}
              kind="invoices"
            />
          ) : null}
          <DataTable<Invoice>
            columns={invoiceColumns}
            rows={filteredInvoices}
            getRowKey={(invoice) => invoice._id}
            density={tableDensity === "compact" ? DATATABLE_DENSITY.COMPACT : DATATABLE_DENSITY.COMFORTABLE}
            stickyHeader
            sortBy={dataTableSort}
            onSortChange={onSortChange}
            onRowClick={onRowClick}
            activeRowId={activeId ?? undefined}
            getRowClassName={(invoice) => (invoice.status === "EXPORTED" ? "row-exported" : undefined)}
            getRowAttributes={(invoice) => ({ "data-invoice-id": invoice._id })}
            selectable
            selectedRowIds={selectedRowKeys}
            onSelectionChange={onSelectionChange}
            isRowSelectable={(invoice) => isInvoiceSelectable(invoice)}
            caption="Invoices"
            testId="invoice-list-table"
          />
        </div>
      ) : null}
      <InvoiceListBulkActions
        selectedCount={selectedIds.length}
        selectedApprovableCount={selectedApprovableIds.length}
        selectedExportableCount={selectedExportableIds.length}
        canApproveInvoices={canApproveInvoices}
        canExportToTally={canExportToTally}
        canDeleteInvoices={canDeleteInvoices}
        onApprove={onApprove}
        onExport={onExport}
        onDelete={onDelete}
        onClearSelection={onClearSelection}
      />
      <InvoiceListPagination
        currentPage={currentPage}
        pageSize={pageSize}
        totalInvoices={totalInvoices}
        onPageChange={onPageChange}
        onPageDelta={onPageDelta}
        onPageSizeChange={onPageSizeChange}
      />
    </section>
  );
}
