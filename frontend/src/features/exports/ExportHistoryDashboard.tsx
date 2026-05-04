import { useEffect, useMemo, useState } from "react";
import { fetchExportHistory, downloadTallyXmlFile } from "@/api";
import { EXPORT_BATCH_ITEM_STATUS, type ExportBatchSummary } from "@/types";
import { EmptyState } from "@/components/common/EmptyState";
import { ExportBatchItemsList } from "@/features/exports/ExportBatchItemsList";
import { ExportBatchRetryButton } from "@/features/exports/ExportBatchRetryButton";
import {
  DataTable,
  DATATABLE_DENSITY,
  DATATABLE_SORT_DIRECTION,
  type DataTableColumn,
  type DataTableSort
} from "@/components/ds";
import {
  useUserPrefsStore,
  EXPORT_SORT_KEY,
  SORT_DIRECTION,
  type ExportSortKey
} from "@/stores/userPrefsStore";

const EXPORT_COLUMN_ID = {
  EXPAND: "expand",
  DATE: "date",
  TOTAL: "total",
  SUCCESS: "success",
  FAILED: "failed",
  REQUESTED_BY: "requestedBy",
  ACTIONS: "actions"
} as const;

interface ExportHistoryDashboardProps {
  addToast?: (type: "success" | "error" | "info", message: string, duration?: number) => void;
}

function formatName(value?: string): string {
  if (!value) return "-";
  const at = value.indexOf("@");
  if (at <= 0) return value;
  return value.slice(0, at).replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function sortKeyToColumnId(key: ExportSortKey): string {
  switch (key) {
    case EXPORT_SORT_KEY.DATE: return EXPORT_COLUMN_ID.DATE;
    case EXPORT_SORT_KEY.TOTAL: return EXPORT_COLUMN_ID.TOTAL;
    case EXPORT_SORT_KEY.SUCCESS: return EXPORT_COLUMN_ID.SUCCESS;
    case EXPORT_SORT_KEY.FAILED: return EXPORT_COLUMN_ID.FAILED;
    case EXPORT_SORT_KEY.REQUESTED_BY: return EXPORT_COLUMN_ID.REQUESTED_BY;
    default: return EXPORT_COLUMN_ID.DATE;
  }
}

function columnIdToSortKey(id: string): ExportSortKey {
  switch (id) {
    case EXPORT_COLUMN_ID.TOTAL: return EXPORT_SORT_KEY.TOTAL;
    case EXPORT_COLUMN_ID.SUCCESS: return EXPORT_SORT_KEY.SUCCESS;
    case EXPORT_COLUMN_ID.FAILED: return EXPORT_SORT_KEY.FAILED;
    case EXPORT_COLUMN_ID.REQUESTED_BY: return EXPORT_SORT_KEY.REQUESTED_BY;
    case EXPORT_COLUMN_ID.DATE:
    default: return EXPORT_SORT_KEY.DATE;
  }
}

export function ExportHistoryDashboard({ addToast }: ExportHistoryDashboardProps = {}) {
  const [items, setItems] = useState<ExportBatchSummary[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

  const pageSize = useUserPrefsStore((state) => state.exportHistory.pageSize);
  const dateFrom = useUserPrefsStore((state) => state.exportHistory.dateFrom);
  const dateTo = useUserPrefsStore((state) => state.exportHistory.dateTo);
  const sortKey = useUserPrefsStore((state) => state.exportHistory.sortKey);
  const sortDir = useUserPrefsStore((state) => state.exportHistory.sortDirection);
  const setExportHistory = useUserPrefsStore((state) => state.setExportHistory);

  useEffect(() => { void loadHistory(); }, [page, pageSize]);

  async function loadHistory() {
    setLoading(true);
    try {
      const result = await fetchExportHistory(page, pageSize);
      setItems(result.items);
      setTotal(result.total);
    } catch { setItems([]); } finally { setLoading(false); }
  }

  async function handleDownload(batchId: string) {
    try {
      const blob = await downloadTallyXmlFile(batchId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `tally-export-${batchId}.xml`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
  }

  function toggleExpand(batchId: string) {
    setExpandedBatchId((current) => (current === batchId ? null : batchId));
  }

  async function handleRetried() {
    addToast?.("success", "Retry submitted. Refreshing batch...");
    await loadHistory();
  }

  function handleRetryError(message: string) {
    addToast?.("error", message);
  }

  let displayed = items;
  if (dateFrom) { const from = new Date(dateFrom); displayed = displayed.filter((b) => new Date(b.createdAt) >= from); }
  if (dateTo) { const to = new Date(dateTo); to.setHours(23, 59, 59, 999); displayed = displayed.filter((b) => new Date(b.createdAt) <= to); }

  const dir: number = sortDir === SORT_DIRECTION.ASC ? 1 : -1;
  displayed = [...displayed].sort((a, b) => {
    switch (sortKey) {
      case EXPORT_SORT_KEY.DATE: return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
      case EXPORT_SORT_KEY.TOTAL: return (a.total - b.total) * dir;
      case EXPORT_SORT_KEY.SUCCESS: return (a.successCount - b.successCount) * dir;
      case EXPORT_SORT_KEY.FAILED: return (a.failureCount - b.failureCount) * dir;
      case EXPORT_SORT_KEY.REQUESTED_BY: return a.requestedBy.localeCompare(b.requestedBy) * dir;
      default: return 0;
    }
  });

  const totalPages = Math.ceil(total / pageSize);
  const hasFilters = dateFrom !== "" || dateTo !== "";
  const expandedBatch = expandedBatchId
    ? displayed.find((b) => b.batchId === expandedBatchId) ?? null
    : null;

  const setDateFrom = (value: string) => setExportHistory({ dateFrom: value });
  const setDateTo = (value: string) => setExportHistory({ dateTo: value });
  const setPageSize = (value: number) => setExportHistory({ pageSize: value });

  const dataTableSort: DataTableSort = {
    id: sortKeyToColumnId(sortKey),
    direction:
      sortDir === SORT_DIRECTION.ASC
        ? DATATABLE_SORT_DIRECTION.ASC
        : DATATABLE_SORT_DIRECTION.DESC
  };

  function handleSortChange(next: DataTableSort | undefined) {
    if (!next) return;
    setExportHistory({
      sortKey: columnIdToSortKey(next.id),
      sortDirection:
        next.direction === DATATABLE_SORT_DIRECTION.ASC ? SORT_DIRECTION.ASC : SORT_DIRECTION.DESC
    });
  }

  const columns = useMemo<ReadonlyArray<DataTableColumn<ExportBatchSummary>>>(() => [
    {
      id: EXPORT_COLUMN_ID.EXPAND,
      header: "",
      width: "2.75rem",
      render: (batch) => {
        const expanded = expandedBatchId === batch.batchId;
        return (
          <button
            type="button"
            className="app-button app-button-secondary app-button-sm export-history-expand-btn"
            onClick={(event) => { event.stopPropagation(); toggleExpand(batch.batchId); }}
            aria-expanded={expanded}
            aria-label={expanded ? "Hide batch items" : "Show batch items"}
          >
            <span className="material-symbols-outlined">
              {expanded ? "expand_less" : "expand_more"}
            </span>
          </button>
        );
      }
    },
    {
      id: EXPORT_COLUMN_ID.DATE,
      header: "Date",
      sortable: true,
      render: (batch) => <span className="export-history-date">{new Date(batch.createdAt).toLocaleString()}</span>
    },
    {
      id: EXPORT_COLUMN_ID.TOTAL,
      header: "Total",
      sortable: true,
      align: "right",
      width: "5rem",
      render: (batch) => <span className="lb-num">{batch.total}</span>
    },
    {
      id: EXPORT_COLUMN_ID.SUCCESS,
      header: "Success",
      sortable: true,
      align: "right",
      width: "5.5rem",
      render: (batch) => <span className="lb-num export-history-success-count">{batch.successCount}</span>
    },
    {
      id: EXPORT_COLUMN_ID.FAILED,
      header: "Failed",
      sortable: true,
      align: "right",
      width: "5rem",
      render: (batch) => (
        <span className={"lb-num " + (batch.failureCount > 0 ? "export-history-fail-count" : "")}>
          {batch.failureCount}
        </span>
      )
    },
    {
      id: EXPORT_COLUMN_ID.REQUESTED_BY,
      header: "Requested by",
      sortable: true,
      render: (batch) => <span title={batch.requestedBy}>{formatName(batch.requestedBy)}</span>
    },
    {
      id: EXPORT_COLUMN_ID.ACTIONS,
      header: "Actions",
      width: "13rem",
      render: (batch) => {
        const failureItems = (batch.items ?? []).filter((it) => it.status === EXPORT_BATCH_ITEM_STATUS.FAILURE);
        const canRetry = failureItems.length > 0;
        return (
          <div className="export-history-actions" onClick={(event) => event.stopPropagation()}>
            {batch.hasFile ? (
              <button type="button" className="app-button app-button-secondary app-button-sm" onClick={() => void handleDownload(batch.batchId)}>
                <span className="material-symbols-outlined">download</span> XML
              </button>
            ) : null}
            {canRetry ? (
              <ExportBatchRetryButton
                batchId={batch.batchId}
                onRetried={() => void handleRetried()}
                onError={handleRetryError}
              />
            ) : null}
            {!batch.hasFile && !canRetry ? <span className="export-history-actions-empty">—</span> : null}
          </div>
        );
      }
    }
  ], [expandedBatchId]);

  return (
    <section className="export-history-page" data-testid="export-history-page">
      <header className="export-history-page-header">
        <div className="export-history-page-titles">
          <h2>Export History</h2>
          <span className="export-history-records-count">
            <span className="lb-num">{total}</span> {total === 1 ? "record" : "records"}
          </span>
        </div>
        <p className="export-history-page-subtitle">
          Tally export batches with per-invoice status, retry, and XML download.
        </p>
      </header>

      <div className="export-history-toolbar">
        <input
          type="date"
          className="toolbar-date-input"
          value={dateFrom}
          max={dateTo || undefined}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          title="From date"
          aria-label="From date"
        />
        <span className="export-history-toolbar-sep">to</span>
        <input
          type="date"
          className="toolbar-date-input"
          value={dateTo}
          min={dateFrom || undefined}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          title="To date"
          aria-label="To date"
        />
        {hasFilters ? (
          <button type="button" className="clear-filters-pill" onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }}>
            <span className="material-symbols-outlined">close</span> Clear
          </button>
        ) : null}
      </div>

      <section className="export-history-section">
        {!loading && displayed.length === 0 ? (
          <EmptyState
            icon={hasFilters ? "filter_list_off" : "cloud_done"}
            heading={hasFilters ? "No exports in this range" : "No exports yet"}
            description={hasFilters ? "Try adjusting the date range." : "Approve invoices and export them to Tally to see history here."}
            action={hasFilters ? <button type="button" className="app-button app-button-secondary" onClick={() => { setDateFrom(""); setDateTo(""); }}>Clear Filters</button> : undefined}
          />
        ) : (
          <DataTable<ExportBatchSummary>
            columns={columns}
            rows={displayed}
            getRowKey={(row) => row.batchId}
            density={DATATABLE_DENSITY.COMPACT}
            stickyHeader
            sortBy={dataTableSort}
            onSortChange={handleSortChange}
            loading={loading}
            activeRowId={expandedBatchId ?? undefined}
            getRowClassName={(row) => row.failureCount > 0 ? "export-history-row-failed" : undefined}
            getRowAttributes={(row) => ({ "data-batch-id": row.batchId })}
            caption="Tally export history"
            testId="export-history-data-table"
          />
        )}

        {expandedBatch ? (
          <section className="export-history-batch-panel" data-testid="export-history-batch-panel">
            <header className="export-history-batch-panel-head">
              <div>
                <h3>Batch {expandedBatch.batchId}</h3>
                <p className="export-history-batch-panel-meta">
                  {new Date(expandedBatch.createdAt).toLocaleString()} ·{" "}
                  <span className="lb-num">{expandedBatch.total}</span> invoices ·{" "}
                  <span className="export-history-success-count lb-num">{expandedBatch.successCount}</span> success ·{" "}
                  <span className={(expandedBatch.failureCount > 0 ? "export-history-fail-count " : "") + "lb-num"}>{expandedBatch.failureCount}</span> failed
                </p>
              </div>
              <button
                type="button"
                className="app-button app-button-secondary app-button-sm"
                onClick={() => setExpandedBatchId(null)}
                aria-label="Close batch detail"
              >
                <span className="material-symbols-outlined">close</span> Close
              </button>
            </header>
            <ExportBatchItemsList items={expandedBatch.items ?? []} />
          </section>
        ) : null}

        {displayed.length > 0 ? (
          <div className="pagination-bar">
            <div className="pagination-info">
              {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total}
            </div>
            <div className="pagination">
              <button type="button" className="app-button app-button-secondary app-button-sm" disabled={page <= 1} onClick={() => setPage(1)}>First</button>
              <button type="button" className="app-button app-button-secondary app-button-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
              <button type="button" className="app-button app-button-secondary app-button-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
              <button type="button" className="app-button app-button-secondary app-button-sm" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>Last</button>
            </div>
            <div className="pagination-size">
              <span>Rows:</span>
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        ) : null}
      </section>
    </section>
  );
}
