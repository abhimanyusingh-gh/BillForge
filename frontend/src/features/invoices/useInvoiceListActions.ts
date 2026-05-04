import { useState } from "react";
import {
  approveInvoices,
  approveWorkflowStep,
  deleteInvoices,
  downloadTallyXmlFile,
  generateTallyXmlFile,
  pauseIngestion,
  rejectWorkflowStep,
  retryInvoices,
  runIngestion,
  updateInvoiceComplianceOverride
} from "@/api";
import { getUserFacingErrorMessage } from "@/lib/common/apiError";
import type { IngestionJobStatus, Invoice } from "@/types";

interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  destructive: boolean;
  onConfirm: () => void;
}

interface PendingExport {
  ids: string[];
  mode: "single" | "bulk";
}

interface UseInvoiceListActionsArgs {
  userEmail: string;
  canApproveInvoices: boolean;
  canDeleteInvoices: boolean;
  canRetryInvoices: boolean;
  canExportToTally: boolean;
  canStartIngestion: boolean;
  selectedIds: ReadonlyArray<string>;
  selectedApprovableIds: ReadonlyArray<string>;
  selectedExportableIds: ReadonlyArray<string>;
  selectedRetryableIds: ReadonlyArray<string>;
  selectedNonExportableCount: number;
  loadInvoices: () => Promise<void>;
  clearSelection: () => void;
  removeFromSelection: (ids: string[]) => void;
  ingestionStatus: IngestionJobStatus | null;
  setIngestionStatus: (status: IngestionJobStatus | null) => void;
  setIngestingIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  activeInvoice: Invoice | null;
  refreshActiveInvoiceDetail: () => Promise<void>;
  activeId: string | null;
  setError: (msg: string | null) => void;
  setGlCodeEditingInvoiceId: (id: string | null) => void;
  addToast: (type: "success" | "error" | "info", message: string) => void;
}

interface UseInvoiceListActionsResult {
  confirmDialog: ConfirmDialogState | null;
  setConfirmDialog: React.Dispatch<React.SetStateAction<ConfirmDialogState | null>>;
  actionLoading: string | null;
  pendingExport: PendingExport | null;
  setPendingExport: React.Dispatch<React.SetStateAction<PendingExport | null>>;
  preExportModalOpen: boolean;
  setPreExportModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleApprove: () => void;
  handleDelete: () => void;
  handleApproveSingle: (invoiceId: string) => Promise<boolean>;
  handleExportSingle: (invoiceId: string) => Promise<boolean>;
  handleWorkflowApproveSingle: (invoiceId: string) => Promise<void>;
  handleWorkflowRejectSingle: (invoiceId: string) => void;
  handleRetrySingle: (invoiceId: string) => Promise<void>;
  handleDeleteSingle: (invoiceId: string, fileName: string) => void;
  handleRetry: () => Promise<void>;
  handleExport: () => void;
  executeExport: () => Promise<void>;
  handleIngest: () => Promise<void>;
  handlePauseIngestion: () => Promise<void>;
  handleTableGlCodeSelect: (invoiceId: string, glCode: string, glName: string) => Promise<void>;
  handleTableGlCodeClear: (invoiceId: string) => Promise<void>;
}

export function useInvoiceListActions(args: UseInvoiceListActionsArgs): UseInvoiceListActionsResult {
  const {
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
  } = args;

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [preExportModalOpen, setPreExportModalOpen] = useState(false);
  const [pendingExport, setPendingExport] = useState<PendingExport | null>(null);

  function handleApprove() {
    if (!canApproveInvoices) {
      addToast("error", "You do not have permission to approve invoices.");
      return;
    }
    if (selectedApprovableIds.length === 0) {
      addToast("error", "Select at least one invoice to approve.");
      return;
    }
    const count = selectedApprovableIds.length;
    setConfirmDialog({
      title: "Approve Invoices",
      message: `Approve ${count} invoice${count === 1 ? "" : "s"}? This action is recorded in the audit trail.`,
      confirmLabel: `Approve ${count}`,
      destructive: false,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          setActionLoading("approve");
          const response = await approveInvoices([...selectedApprovableIds], userEmail);
          if (response.modifiedCount === 0) {
            addToast("info", "No eligible invoices found for approval.");
          } else {
            addToast("success", `${response.modifiedCount} invoice(s) approved.`);
          }
          await loadInvoices();
        } catch (approveError) {
          addToast("error", getUserFacingErrorMessage(approveError, "Approval failed."));
        } finally {
          setActionLoading(null);
        }
      }
    });
  }

  function handleDelete() {
    if (!canDeleteInvoices) {
      addToast("error", "You do not have permission to delete invoices.");
      return;
    }
    if (selectedIds.length === 0) return;
    setConfirmDialog({
      title: "Delete Invoices",
      message: `Delete ${selectedIds.length} invoice${selectedIds.length === 1 ? "" : "s"}? This cannot be undone.`,
      confirmLabel: `Delete ${selectedIds.length} invoice${selectedIds.length === 1 ? "" : "s"}`,
      destructive: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          setActionLoading("delete");
          const response = await deleteInvoices([...selectedIds]);
          if (response.deletedCount === 0) {
            addToast("info", "No invoices were eligible for deletion.");
          } else {
            addToast("success", `${response.deletedCount} invoice(s) deleted.`);
          }
          clearSelection();
          await loadInvoices();
        } catch (deleteError) {
          addToast("error", getUserFacingErrorMessage(deleteError, "Deletion failed."));
        } finally {
          setActionLoading(null);
        }
      }
    });
  }

  async function handleApproveSingle(invoiceId: string): Promise<boolean> {
    if (!canApproveInvoices) {
      addToast("error", "You do not have permission to approve invoices.");
      return false;
    }
    try {
      const response = await approveInvoices([invoiceId], userEmail);
      if (response.modifiedCount === 0) {
        addToast("info", "Invoice was not eligible for approval.");
        await loadInvoices();
        return false;
      }
      await loadInvoices();
      return true;
    } catch (approveError) {
      addToast("error", getUserFacingErrorMessage(approveError, "Approval failed."));
      return false;
    }
  }

  async function exportInvoices(ids: string[], mode: "single" | "bulk"): Promise<boolean> {
    try {
      setActionLoading("export");
      const fileResult = await generateTallyXmlFile(ids);
      if (!fileResult.batchId) {
        const msg = mode === "single"
          ? "Export failed — invoice may have invalid amounts or is already exported."
          : "Export failed — invoices may have invalid amounts or are already exported.";
        addToast("error", msg);
        if (mode === "bulk") clearSelection();
        await loadInvoices();
        return false;
      }
      const blob = await downloadTallyXmlFile(fileResult.batchId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileResult.filename ?? "tally-import.xml";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      if (mode === "bulk") {
        const exportedIds = ids.filter(
          (id) => !fileResult.skippedItems.some((item) => item.invoiceId === id)
        );
        removeFromSelection(exportedIds);
      }
      addToast("success", `${fileResult.includedCount} invoice(s) exported. XML file downloaded.`);
      await loadInvoices();
      if (mode === "bulk" && fileResult.skippedCount > 0) {
        addToast("info", `${fileResult.skippedCount} invoice(s) skipped (already exported or missing fields).`);
      }
      return true;
    } catch (downloadError) {
      addToast("error", getUserFacingErrorMessage(downloadError, "Export failed."));
      await loadInvoices();
      return false;
    } finally {
      setActionLoading(null);
    }
  }

  async function handleExportSingle(invoiceId: string): Promise<boolean> {
    if (!canExportToTally) {
      addToast("error", "You do not have permission to export invoices.");
      return false;
    }
    setPendingExport({ ids: [invoiceId], mode: "single" });
    setPreExportModalOpen(true);
    return true;
  }

  async function handleWorkflowApproveSingle(invoiceId: string) {
    if (!canApproveInvoices) {
      addToast("error", "You do not have permission to approve invoices.");
      return;
    }
    try {
      await approveWorkflowStep(invoiceId);
      addToast("success", "Workflow step approved.");
      await loadInvoices();
      if (activeInvoice?._id === invoiceId) {
        await refreshActiveInvoiceDetail();
      }
    } catch (approveError) {
      addToast("error", getUserFacingErrorMessage(approveError, "Workflow approval failed."));
    }
  }

  function handleWorkflowRejectSingle(invoiceId: string) {
    if (!canApproveInvoices) {
      addToast("error", "You do not have permission to reject workflow steps.");
      return;
    }
    setConfirmDialog({
      title: "Reject Approval Step",
      message: "Reject the current workflow step and return the invoice to Needs Review?",
      confirmLabel: "Reject Step",
      destructive: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await rejectWorkflowStep(invoiceId, "Rejected from UI workflow action");
          addToast("info", "Workflow step rejected.");
          await loadInvoices();
          if (activeInvoice?._id === invoiceId) {
            await refreshActiveInvoiceDetail();
          }
        } catch (rejectError) {
          addToast("error", getUserFacingErrorMessage(rejectError, "Workflow rejection failed."));
        }
      }
    });
  }

  async function handleRetrySingle(invoiceId: string) {
    if (!canRetryInvoices) {
      addToast("error", "You do not have permission to retry invoices.");
      return;
    }
    setIngestingIds((prev) => new Set(prev).add(invoiceId));
    try {
      const response = await retryInvoices([invoiceId]);
      if (response.modifiedCount === 0) {
        addToast("info", "Invoice was not eligible for retry.");
        setIngestingIds((prev) => { const next = new Set(prev); next.delete(invoiceId); return next; });
        return;
      }
      if (ingestionStatus?.running) return;
      const status = await runIngestion();
      setIngestionStatus(status);
      if (!status.running) {
        setIngestingIds((prev) => { const next = new Set(prev); next.delete(invoiceId); return next; });
        await loadInvoices();
      }
    } catch (retryError) {
      addToast("error", getUserFacingErrorMessage(retryError, "Retry failed."));
      setIngestingIds((prev) => { const next = new Set(prev); next.delete(invoiceId); return next; });
    }
  }

  function handleDeleteSingle(invoiceId: string, fileName: string) {
    if (!canDeleteInvoices) {
      addToast("error", "You do not have permission to delete invoices.");
      return;
    }
    setConfirmDialog({
      title: "Delete Invoice",
      message: `Delete "${fileName}"? This cannot be undone.`,
      confirmLabel: "Delete invoice",
      destructive: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const response = await deleteInvoices([invoiceId]);
          if (response.deletedCount === 0) {
            addToast("info", "Invoice could not be deleted.");
          } else {
            addToast("success", `"${fileName}" deleted.`);
          }
          removeFromSelection([invoiceId]);
          await loadInvoices();
        } catch (deleteError) {
          addToast("error", getUserFacingErrorMessage(deleteError, "Deletion failed."));
        }
      }
    });
  }

  async function handleRetry() {
    if (!canRetryInvoices) {
      addToast("error", "You do not have permission to retry invoices.");
      return;
    }
    if (selectedRetryableIds.length === 0) {
      addToast("error", "Select at least one invoice to retry.");
      return;
    }
    try {
      setError(null);
      const response = await retryInvoices([...selectedRetryableIds]);
      if (response.modifiedCount === 0) {
        addToast("info", "No invoices were eligible for retry.");
      }
      clearSelection();
      await loadInvoices();
    } catch (retryError) {
      addToast("error", getUserFacingErrorMessage(retryError, "Retry failed."));
    }
  }

  function handleExport() {
    if (!canExportToTally) {
      addToast("error", "You do not have permission to export invoices.");
      return;
    }
    if (selectedExportableIds.length === 0) {
      addToast("error", "Select at least one approved invoice to export.");
      return;
    }
    if (selectedNonExportableCount > 0) {
      addToast("error", "Deselect non-approved invoices before exporting.");
      return;
    }
    setPendingExport({ ids: [...selectedExportableIds], mode: "bulk" });
    setPreExportModalOpen(true);
  }

  async function executeExport() {
    const pending = pendingExport;
    if (!pending || pending.ids.length === 0) return;
    await exportInvoices(pending.ids, pending.mode);
  }

  async function handleIngest() {
    if (!canStartIngestion) {
      addToast("error", "You do not have permission to run ingestion.");
      return;
    }
    try {
      setError(null);
      const status = await runIngestion();
      setIngestionStatus(status);
    } catch (ingestError) {
      addToast("error", getUserFacingErrorMessage(ingestError, "Ingestion run failed."));
    }
  }

  async function handlePauseIngestion() {
    if (!canStartIngestion) {
      addToast("error", "You do not have permission to manage ingestion.");
      return;
    }
    try {
      setError(null);
      const status = await pauseIngestion();
      setIngestionStatus(status);
    } catch (pauseError) {
      addToast("error", getUserFacingErrorMessage(pauseError, "Failed to pause ingestion."));
    }
  }

  async function handleTableGlCodeSelect(invoiceId: string, glCode: string, glName: string) {
    setGlCodeEditingInvoiceId(null);
    try {
      await updateInvoiceComplianceOverride(invoiceId, { glCode, glName } as Record<string, unknown>);
      await loadInvoices();
      if (activeId === invoiceId) {
        await refreshActiveInvoiceDetail();
      }
      addToast("success", "GL code updated and compliance recalculated.");
    } catch {
      addToast("error", "Failed to update GL code.");
    }
  }

  async function handleTableGlCodeClear(invoiceId: string) {
    setGlCodeEditingInvoiceId(null);
    try {
      await updateInvoiceComplianceOverride(invoiceId, { glCode: "" } as Record<string, unknown>);
      await loadInvoices();
      if (activeId === invoiceId) {
        await refreshActiveInvoiceDetail();
      }
      addToast("success", "GL code cleared.");
    } catch {
      addToast("error", "Failed to clear GL code.");
    }
  }

  return {
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
  };
}
