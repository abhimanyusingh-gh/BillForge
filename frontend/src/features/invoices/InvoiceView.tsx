import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { runIngestion } from "@/api";
import { invoiceUrls } from "@/api/urls/invoiceUrls";
import type { Invoice, TenantUser, UserCapabilities } from "@/types";
import { IngestionProgressCard } from "@/components/invoice/IngestionProgressCard";
import { getExtractedFieldRows } from "@/lib/invoice/extractedFields";
import { getInvoiceSourceHighlights } from "@/lib/invoice/sourceHighlights";
import {
  isInvoiceApprovable,
  isInvoiceExportable,
  isInvoiceRetryable
} from "@/lib/common/selection";
import { getInvoiceTallyMappings } from "@/lib/invoice/tallyMapping";
import { fetchGlCodes, fetchTdsRates } from "@/api";
import type { GlCode, TdsRate } from "@/types";
import { buildFieldCropSourceMap } from "@/lib/invoice/invoiceView";
import { useInvoiceDetail } from "@/hooks/useInvoiceDetail";
import { useInvoiceTableState } from "@/hooks/useInvoiceTableState";
import { useUserPrefsStore, type TableDensity } from "@/stores/userPrefsStore";
import { useInvoiceFilters, DATE_VALIDATION_ERROR } from "@/hooks/useInvoiceFilters";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { KeyboardShortcutsOverlay } from "@/components/common/KeyboardShortcutsOverlay";
import { InvoiceToolbar } from "@/components/invoice/InvoiceToolbar";
import { type ComboboxOption } from "@/components/ds";
import { PreExportValidationPanel } from "@/features/invoices/PreExportValidationPanel";
import { useInvoiceListPanelDivider } from "@/features/invoices/useInvoiceListPanelDivider";
import { useInvoiceListUploads } from "@/features/invoices/useInvoiceListUploads";
import { useInvoiceListIngestion } from "@/features/invoices/useInvoiceListIngestion";
import { useInvoiceListActions } from "@/features/invoices/useInvoiceListActions";
import { InvoiceDetailHost } from "@/features/invoices/InvoiceDetailHost";
import { InvoiceListPanel } from "@/features/invoices/InvoiceListPanel";
import { useInvoiceFieldEditing } from "@/features/invoices/useInvoiceFieldEditing";
import { useInvoiceSectionExpansion } from "@/features/invoices/useInvoiceSectionExpansion";
import { useInvoiceListShortcuts } from "@/features/invoices/useInvoiceListShortcuts";
import { useInvoiceListTableBindings } from "@/features/invoices/useInvoiceListTableBindings";
import { InvoicePopupHost } from "@/features/invoices/InvoicePopupHost";
import { useInvoiceListLoader } from "@/features/invoices/useInvoiceListLoader";

function selectNewerInvoice(detail: Invoice | null, summary: Invoice | null): Invoice | null {
  if (!summary) return detail;
  if (!detail || detail._id !== summary._id) return summary;
  const dt = Date.parse(detail.updatedAt);
  const st = Date.parse(summary.updatedAt);
  return Number.isFinite(dt) && dt >= st ? detail : summary;
}

interface InvoiceViewProps {
  tenantId: string;
  userId: string;
  userEmail: string;
  canViewAllInvoices: boolean;
  capabilities?: Partial<UserCapabilities>;
  requiresTenantSetup: boolean;
  tenantMode?: "test" | "live";
  tenantUsers?: TenantUser[];
  onGmailStatusRefresh: () => void;
  onNavCountsChange: (counts: { total: number; approved: number; pending: number; failed: number }) => void;
  onSessionExpired: () => void;
  addToast: (type: "success" | "error" | "info", message: string) => void;
}

export function InvoiceView({
  userId,
  userEmail,
  canViewAllInvoices,
  capabilities = {},
  requiresTenantSetup,
  tenantMode,
  tenantUsers,
  onGmailStatusRefresh,
  onNavCountsChange,
  onSessionExpired,
  addToast
}: InvoiceViewProps) {
  const {
    searchQuery,
    setSearchQuery,
    debouncedSearch,
    statusFilter,
    setStatusFilter,
    invoiceDateFrom,
    setInvoiceDateFrom,
    invoiceDateTo,
    setInvoiceDateTo,
    approvedByFilter,
    setApprovedByFilter,
    hasActiveFilters,
    clearAllFilters,
    validateDateRange
  } = useInvoiceFilters();
  const {
    currentPage,
    pageSize,
    totalInvoices,
    setCurrentPage,
    setPageSize,
    setTotalInvoices,
    sortColumn,
    sortDirection,
    setSortColumn,
    setSortDirection,
    selectedIds,
    toggleSelection,
    clearSelection,
    removeFromSelection,
    reconcileWithLoaded,
    isRiskSignalsExpanded,
    toggleRiskSignalsExpanded
  } = useInvoiceTableState();

  const [ingestingIds, setIngestingIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [popupInvoiceId, setPopupInvoiceId] = useState<string | null>(null);
  const [detailsPanelVisible, setDetailsPanelVisible] = useState(false);
  const persistedPanelSplit = useUserPrefsStore((state) => state.invoiceView.panelSplitPercent);
  const persistedTableDensity = useUserPrefsStore((state) => state.invoiceView.tableDensity);
  const setInvoiceViewPref = useUserPrefsStore((state) => state.setInvoiceView);
  const [listPanelPercent, setListPanelPercent] = useState(() => persistedPanelSplit);
  const contentRef = useRef<HTMLElement>(null);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const tableDensity: TableDensity = persistedTableDensity;
  const setTableDensity = useCallback(
    (density: TableDensity) => setInvoiceViewPref({ tableDensity: density }),
    [setInvoiceViewPref]
  );
  const [tenantGlCodes, setTenantGlCodes] = useState<GlCode[]>([]);
  const [tenantTdsRates, setTenantTdsRates] = useState<TdsRate[]>([]);
  const tenantGlComboOptions = useMemo<ReadonlyArray<ComboboxOption<string>>>(
    () =>
      tenantGlCodes
        .filter((g) => g.isActive)
        .map((g) => ({ value: g.code, label: g.name, description: g.code })),
    [tenantGlCodes]
  );
  const { sectionExpanded, setSection, popupRef } = useInvoiceSectionExpansion({
    popupInvoiceId,
    activeId,
    setPopupInvoiceId
  });
  const canApproveInvoices = capabilities.canApproveInvoices === true;
  const canEditInvoiceFields = capabilities.canEditInvoiceFields === true;
  const canDeleteInvoices = capabilities.canDeleteInvoices === true;
  const canRetryInvoices = capabilities.canRetryInvoices === true;
  const canUploadFiles = capabilities.canUploadFiles === true;
  const canStartIngestion = capabilities.canStartIngestion === true;
  const canExportToTally = capabilities.canExportToTally === true;

  const handleDividerMouseDown = useInvoiceListPanelDivider({
    contentRef,
    listPanelPercent,
    setListPanelPercent,
    persistPercent: (value) => setInvoiceViewPref({ panelSplitPercent: value })
  });

  const {
    detail: activeInvoiceDetail,
    loading: activeInvoiceDetailLoading,
    refresh: refreshActiveInvoiceDetail
  } = useInvoiceDetail(activeId);
  const {
    detail: popupInvoiceDetail,
    loading: popupInvoiceDetailLoading,
    refresh: refreshPopupInvoiceDetail
  } = useInvoiceDetail(popupInvoiceId);

  const {
    invoices,
    loading,
    error,
    setError,
    allStatusCounts,
    loadInvoices
  } = useInvoiceListLoader({
    statusFilter,
    invoiceDateFrom,
    invoiceDateTo,
    approvedByFilter,
    currentPage,
    pageSize,
    sortColumn,
    sortDirection,
    setTotalInvoices,
    reconcileWithLoaded,
    activeId,
    popupInvoiceId,
    setActiveId,
    setPopupInvoiceId,
    refreshActiveInvoiceDetail,
    refreshPopupInvoiceDetail,
    onNavCountsChange,
    onSessionExpired
  });

  const {
    ingestionStatus,
    setIngestionStatus,
    ingestionFading,
    refreshIngestionStatus,
    ingestionProgressPercent,
    ingestionSuccessfulFiles
  } = useInvoiceListIngestion({
    loadInvoices,
    onGmailStatusRefresh,
    setError,
    addToast
  });

  const {
    uploadInputRef,
    uploadDragActive,
    uploadProgress,
    handleUpload,
    handleUploadDrop,
    handleUploadDragEnter,
    handleUploadDragOver,
    handleUploadDragLeave
  } = useInvoiceListUploads({
    canUploadFiles,
    loadInvoices,
    setIngestionStatus,
    setError,
    addToast
  });

  const prevFiltersRef = useRef({ statusFilter, invoiceDateFrom, invoiceDateTo, pageSize, approvedByFilter, sortColumn, sortDirection });
  useEffect(() => {
    const prev = prevFiltersRef.current;
    const filtersChanged = prev.statusFilter !== statusFilter || prev.invoiceDateFrom !== invoiceDateFrom || prev.invoiceDateTo !== invoiceDateTo || prev.pageSize !== pageSize || prev.approvedByFilter !== approvedByFilter;
    prevFiltersRef.current = { statusFilter, invoiceDateFrom, invoiceDateTo, pageSize, approvedByFilter, sortColumn, sortDirection };
    const dateError = validateDateRange();
    if (dateError === DATE_VALIDATION_ERROR.START_AFTER_END) {
      addToast("error", "Start date must be before end date");
      return;
    }
    if (dateError === DATE_VALIDATION_ERROR.END_TOO_FAR) {
      addToast("error", "End date cannot be more than one year from today");
      return;
    }
    if (filtersChanged && currentPage !== 1) {
      setCurrentPage(1);
      return;
    }
    void loadInvoices();
  }, [statusFilter, invoiceDateFrom, invoiceDateTo, currentPage, pageSize, approvedByFilter, sortColumn, sortDirection]);

  useEffect(() => {
    void refreshIngestionStatus();
    fetchGlCodes().then(r => setTenantGlCodes(r.items)).catch(() => {});
    fetchTdsRates().then(r => setTenantTdsRates(r)).catch(() => {});
  }, []);

  useEffect(() => {
    if (ingestingIds.size === 0) return;
    const stillIngesting = new Set<string>();
    for (const id of ingestingIds) {
      const inv = invoices.find((i) => i._id === id);
      if (inv && inv.status === "PENDING") stillIngesting.add(id);
    }
    if (stillIngesting.size < ingestingIds.size) {
      setIngestingIds(stillIngesting);
      if (stillIngesting.size > 0 && !ingestionStatus?.running) {
        void runIngestion().then((s) => setIngestionStatus(s)).catch(() => { addToast("error", "Ingestion retry failed."); });
      }
    }
  }, [invoices]);

  const activeInvoiceSummary = useMemo(
    () => invoices.find((invoice) => invoice._id === activeId) ?? null,
    [activeId, invoices]
  );
  const activeInvoice = useMemo(
    () => selectNewerInvoice(activeInvoiceDetail, activeInvoiceSummary),
    [activeInvoiceDetail, activeInvoiceSummary]
  );

  const popupInvoiceSummary = useMemo(
    () => invoices.find((invoice) => invoice._id === popupInvoiceId) ?? null,
    [invoices, popupInvoiceId]
  );
  const popupInvoice = useMemo(
    () => selectNewerInvoice(popupInvoiceDetail, popupInvoiceSummary),
    [popupInvoiceDetail, popupInvoiceSummary]
  );

  const popupExtractedRows = useMemo(
    () => (popupInvoice ? getExtractedFieldRows(popupInvoice) : []),
    [popupInvoice]
  );

  const popupTallyMappings = useMemo(
    () => (popupInvoice ? getInvoiceTallyMappings(popupInvoice) : []),
    [popupInvoice]
  );

  const activeCropUrlByField = useMemo(() => {
    if (!activeInvoice) return {};
    return buildFieldCropSourceMap(activeInvoice._id, getInvoiceSourceHighlights(activeInvoice), invoiceUrls.preview);
  }, [activeInvoice]);

  const popupCropUrlByField = useMemo(() => {
    if (!popupInvoice) return {};
    return buildFieldCropSourceMap(popupInvoice._id, getInvoiceSourceHighlights(popupInvoice), invoiceUrls.preview);
  }, [popupInvoice]);

  const selectedInvoices = useMemo(() => {
    if (selectedIds.length === 0 || invoices.length === 0) {
      return [];
    }
    const selectedIdSet = new Set(selectedIds);
    return invoices.filter((invoice) => selectedIdSet.has(invoice._id));
  }, [invoices, selectedIds]);

  const selectedApprovableIds = useMemo(
    () => selectedInvoices.filter((invoice) => isInvoiceApprovable(invoice)).map((invoice) => invoice._id),
    [selectedInvoices]
  );

  const selectedExportableInvoices = useMemo(
    () => selectedInvoices.filter((invoice) => isInvoiceExportable(invoice)),
    [selectedInvoices]
  );

  const selectedExportableIds = useMemo(
    () => selectedExportableInvoices.map((invoice) => invoice._id),
    [selectedExportableInvoices]
  );

  const selectedRetryableIds = useMemo(
    () => selectedInvoices.filter((invoice) => isInvoiceRetryable(invoice)).map((invoice) => invoice._id),
    [selectedInvoices]
  );

  const selectedNonExportableCount = useMemo(
    () => selectedInvoices.filter((invoice) => !isInvoiceExportable(invoice)).length,
    [selectedInvoices]
  );

  const filteredInvoices = useMemo(() => {
    if (!debouncedSearch.trim()) {
      return invoices;
    }
    const q = debouncedSearch.trim().toLowerCase();
    return invoices.filter(
      (invoice) =>
        invoice.attachmentName.toLowerCase().includes(q) ||
        (invoice.parsed?.vendorName ?? "").toLowerCase().includes(q) ||
        (invoice.parsed?.invoiceNumber ?? "").toLowerCase().includes(q)
    );
  }, [invoices, debouncedSearch]);

  const contentClassName = detailsPanelVisible ? "content" : "content content-list-expanded";

  const contentStyle = useMemo(() => {
    if (!detailsPanelVisible) return undefined;
    return { gridTemplateColumns: `${listPanelPercent}% 6px 1fr` };
  }, [detailsPanelVisible, listPanelPercent]);

  const [shortcutAnnouncement, setShortcutAnnouncement] = useState("");
  const announceShortcut = useCallback((message: string) => {
    setShortcutAnnouncement("");
    requestAnimationFrame(() => setShortcutAnnouncement(message));
  }, []);

  const {
    editingListCell,
    setEditingListCell,
    editListValue,
    setEditListValue,
    glCodeEditingInvoiceId,
    setGlCodeEditingInvoiceId,
    handleSaveField,
    handleSaveListCell
  } = useInvoiceFieldEditing({
    canEditInvoiceFields,
    loadInvoices,
    refreshActiveInvoiceDetail,
    activeId,
    addToast
  });

  const {
    confirmDialog,
    setConfirmDialog,
    actionLoading,
    pendingExport,
    setPendingExport,
    preExportModalOpen,
    setPreExportModalOpen,
    handleApprove,
    handleDelete,
    handleApproveSingle,
    handleExportSingle,
    handleWorkflowApproveSingle,
    handleWorkflowRejectSingle,
    handleRetrySingle,
    handleDeleteSingle,
    handleRetry,
    handleExport,
    executeExport,
    handleIngest,
    handlePauseIngestion,
    handleTableGlCodeSelect,
    handleTableGlCodeClear
  } = useInvoiceListActions({
    userEmail,
    canApproveInvoices,
    canDeleteInvoices,
    canRetryInvoices,
    canExportToTally,
    canStartIngestion,
    selectedIds,
    selectedApprovableIds,
    selectedExportableIds,
    selectedRetryableIds,
    selectedNonExportableCount,
    loadInvoices,
    clearSelection,
    removeFromSelection,
    ingestionStatus,
    setIngestionStatus,
    setIngestingIds,
    activeInvoice,
    refreshActiveInvoiceDetail,
    activeId,
    setError,
    setGlCodeEditingInvoiceId,
    addToast
  });

  useInvoiceListShortcuts({
    popupInvoiceId,
    confirmDialogOpen: confirmDialog !== null,
    showShortcutsHelp,
    filteredInvoices,
    activeId,
    selectedIds,
    detailsPanelVisible,
    canApproveInvoices,
    canExportToTally,
    setActiveId,
    setDetailsPanelVisible,
    setPopupInvoiceId,
    setShowShortcutsHelp,
    clearSelection,
    isRiskSignalsExpanded,
    toggleRiskSignalsExpanded,
    handleApproveSingle,
    handleExportSingle,
    announceShortcut
  });

  const {
    selectedRowKeys,
    dataTableSort,
    handleDataTableSortChange,
    handleSelectionChange,
    invoiceColumns
  } = useInvoiceListTableBindings({
    selectedIds,
    sortColumn,
    sortDirection,
    setSortColumn,
    setSortDirection,
    filteredInvoices,
    toggleSelection,
    removeFromSelection,
    editingListCell,
    editListValue,
    setEditListValue,
    setEditingListCell,
    handleSaveListCell,
    setPopupInvoiceId,
    glCodeEditingInvoiceId,
    setGlCodeEditingInvoiceId,
    tenantGlComboOptions,
    handleTableGlCodeSelect,
    handleTableGlCodeClear,
    ingestingIds,
    canApproveInvoices,
    canRetryInvoices,
    canDeleteInvoices,
    handleApproveSingle,
    handleRetrySingle,
    handleDeleteSingle
  });

  return (
    <>
      <InvoiceToolbar
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        invoiceDateFrom={invoiceDateFrom}
        onInvoiceDateFromChange={setInvoiceDateFrom}
        invoiceDateTo={invoiceDateTo}
        onInvoiceDateToChange={setInvoiceDateTo}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        allStatusCounts={allStatusCounts}
        hasActiveFilters={hasActiveFilters}
        onClearAllFilters={clearAllFilters}
        canViewAllInvoices={canViewAllInvoices}
        tenantUsers={tenantUsers}
        approvedByFilter={approvedByFilter}
        onApprovedByFilterChange={setApprovedByFilter}
        canApproveInvoices={canApproveInvoices}
        canDeleteInvoices={canDeleteInvoices}
        canRetryInvoices={canRetryInvoices}
        canUploadFiles={canUploadFiles}
        canStartIngestion={canStartIngestion}
        requiresTenantSetup={requiresTenantSetup}
        selectedApprovableCount={selectedApprovableIds.length}
        selectedDeleteCount={selectedIds.length}
        selectedRetryableCount={selectedRetryableIds.length}
        actionLoading={actionLoading}
        ingestionStatus={ingestionStatus}
        detailsPanelVisible={detailsPanelVisible}
        onToggleDetailsPanel={() => setDetailsPanelVisible((currentValue) => !currentValue)}
        tableDensity={tableDensity}
        onTableDensityChange={(density) => {
          setTableDensity(density);
        }}
        uploadInputRef={uploadInputRef}
        onUploadButtonClick={() => uploadInputRef.current?.click()}
        onUploadFileChange={(e) => void handleUpload(e)}
        uploadDragActive={uploadDragActive}
        onUploadDragEnter={handleUploadDragEnter}
        onUploadDragOver={handleUploadDragOver}
        onUploadDragLeave={handleUploadDragLeave}
        onUploadDrop={(event) => void handleUploadDrop(event)}
        onApprove={() => void handleApprove()}
        onDelete={handleDelete}
        onRetry={() => void handleRetry()}
        onIngest={() => void handleIngest()}
        onPauseIngestion={() => void handlePauseIngestion()}
      />
      <IngestionProgressCard
        status={ingestionStatus}
        progressPercent={ingestionProgressPercent}
        successfulFiles={ingestionSuccessfulFiles}
        fading={ingestionFading}
        label="Invoice Ingestion"
        uploadProgress={uploadProgress}
      />
      {error ? <p className="error">{error}</p> : null}
      <main ref={contentRef} className={contentClassName} style={contentStyle}>
        <>
          <InvoiceListPanel
            tableDensity={tableDensity}
            loading={loading}
            invoices={invoices}
            filteredInvoices={filteredInvoices}
            hasActiveFilters={hasActiveFilters}
            canUploadFiles={canUploadFiles}
            onClearAllFilters={clearAllFilters}
            onUploadClick={() => uploadInputRef.current?.click()}
            invoiceColumns={invoiceColumns}
            selectedRowKeys={selectedRowKeys}
            dataTableSort={dataTableSort}
            onSortChange={handleDataTableSortChange}
            onRowClick={(invoice) => { setActiveId(invoice._id); setDetailsPanelVisible(true); }}
            activeId={activeId}
            onSelectionChange={handleSelectionChange}
            selectedIds={selectedIds}
            selectedApprovableIds={selectedApprovableIds}
            selectedExportableIds={selectedExportableIds}
            canApproveInvoices={canApproveInvoices}
            canExportToTally={canExportToTally}
            canDeleteInvoices={canDeleteInvoices}
            onApprove={() => void handleApprove()}
            onExport={() => void handleExport()}
            onDelete={handleDelete}
            onClearSelection={clearSelection}
            currentPage={currentPage}
            pageSize={pageSize}
            totalInvoices={totalInvoices}
            onPageChange={setCurrentPage}
            onPageDelta={(delta) => setCurrentPage((p) => p + delta)}
            onPageSizeChange={setPageSize}
          />

          <InvoiceDetailHost
            detailsPanelVisible={detailsPanelVisible}
            onCloseDetailsPanel={() => setDetailsPanelVisible(false)}
            onDividerMouseDown={handleDividerMouseDown}
            activeInvoice={activeInvoice}
            activeInvoiceDetailLoading={activeInvoiceDetailLoading}
            tenantGlCodes={tenantGlCodes}
            tenantTdsRates={tenantTdsRates}
            activeCropUrlByField={activeCropUrlByField}
            sectionExpanded={sectionExpanded}
            setSection={setSection}
            isRiskSignalsExpanded={isRiskSignalsExpanded}
            toggleRiskSignalsExpanded={toggleRiskSignalsExpanded}
            onWorkflowApproveSingle={(invoiceId) => void handleWorkflowApproveSingle(invoiceId)}
            onWorkflowRejectSingle={(invoiceId) => void handleWorkflowRejectSingle(invoiceId)}
            onSaveField={handleSaveField}
            refreshActiveInvoiceDetail={refreshActiveInvoiceDetail}
            loadInvoices={loadInvoices}
            addToast={addToast}
          />
        </>
      </main>

      <ConfirmDialog
        open={confirmDialog !== null}
        title={confirmDialog?.title ?? ""}
        message={confirmDialog?.message ?? ""}
        confirmLabel={confirmDialog?.confirmLabel ?? "Confirm"}
        destructive={confirmDialog?.destructive ?? false}
        onConfirm={() => confirmDialog?.onConfirm()}
        onCancel={() => setConfirmDialog(null)}
      />
      <KeyboardShortcutsOverlay open={showShortcutsHelp} onClose={() => setShowShortcutsHelp(false)} />
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="shortcut-announcer">
        {shortcutAnnouncement}
      </div>

      <InvoicePopupHost
        popupInvoice={popupInvoice}
        popupInvoiceDetailLoading={popupInvoiceDetailLoading}
        tenantMode={tenantMode}
        popupRef={popupRef}
        sectionExpanded={sectionExpanded}
        setSection={setSection}
        popupCropUrlByField={popupCropUrlByField}
        popupExtractedRows={popupExtractedRows}
        popupTallyMappings={popupTallyMappings}
        setPopupInvoiceId={setPopupInvoiceId}
        onSaveField={handleSaveField}
        refreshPopupInvoiceDetail={refreshPopupInvoiceDetail}
      />
      <PreExportValidationPanel
        open={preExportModalOpen}
        invoices={
          pendingExport
            ? invoices.filter((invoice) => pendingExport.ids.includes(invoice._id) && isInvoiceExportable(invoice))
            : []
        }
        onCancel={() => {
          setPreExportModalOpen(false);
          setPendingExport(null);
        }}
        onConfirm={() => {
          setPreExportModalOpen(false);
          void executeExport().finally(() => setPendingExport(null));
        }}
        onSelectInvoice={(invoiceId) => {
          window.location.search = `?invoiceDetail=${encodeURIComponent(invoiceId)}`;
        }}
      />
    </>
  );
}
