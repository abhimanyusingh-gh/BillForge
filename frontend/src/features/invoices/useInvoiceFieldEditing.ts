import { useState } from "react";
import { renameInvoiceAttachment, updateInvoiceParsedFields } from "@/api";
import { getUserFacingErrorMessage } from "@/lib/common/apiError";
import type { Invoice } from "@/types";

const GST_AMOUNT_FIELDS = ["subtotalMinor", "cgstMinor", "sgstMinor", "igstMinor", "cessMinor", "totalTaxMinor"] as const;

interface EditingListCell {
  invoiceId: string;
  field: string;
}

interface UseInvoiceFieldEditingArgs {
  canEditInvoiceFields: boolean;
  loadInvoices: () => Promise<void>;
  refreshActiveInvoiceDetail: () => Promise<void>;
  activeId: string | null;
  addToast: (type: "success" | "error" | "info", message: string) => void;
}

interface UseInvoiceFieldEditingResult {
  editingListCell: EditingListCell | null;
  setEditingListCell: React.Dispatch<React.SetStateAction<EditingListCell | null>>;
  editListValue: string;
  setEditListValue: React.Dispatch<React.SetStateAction<string>>;
  glCodeEditingInvoiceId: string | null;
  setGlCodeEditingInvoiceId: React.Dispatch<React.SetStateAction<string | null>>;
  handleSaveField: (invoice: Invoice | null, fieldKey: string, value: string, refreshDetail: () => Promise<void>) => Promise<void>;
  handleSaveListCell: () => Promise<void>;
}

export function useInvoiceFieldEditing({
  canEditInvoiceFields,
  loadInvoices,
  refreshActiveInvoiceDetail,
  activeId,
  addToast
}: UseInvoiceFieldEditingArgs): UseInvoiceFieldEditingResult {
  const [editingListCell, setEditingListCell] = useState<EditingListCell | null>(null);
  const [editListValue, setEditListValue] = useState("");
  const [glCodeEditingInvoiceId, setGlCodeEditingInvoiceId] = useState<string | null>(null);

  async function handleSaveField(
    invoice: Invoice | null,
    fieldKey: string,
    value: string,
    refreshDetail: () => Promise<void>
  ) {
    if (!canEditInvoiceFields) {
      addToast("error", "You do not have permission to edit invoice fields.");
      return;
    }
    if (!invoice) return;
    const trimmed = value.trim();
    const parsed: Record<string, unknown> = {};
    if (fieldKey === "totalAmountMinor") {
      parsed.totalAmountMajor = trimmed || null;
    } else if (fieldKey === "currency") {
      parsed.currency = trimmed ? trimmed.toUpperCase() : null;
    } else if (fieldKey.startsWith("gst.")) {
      const gstKey = fieldKey.slice(4);
      const existingGst = invoice.parsed?.gst ?? {};
      if (GST_AMOUNT_FIELDS.includes(gstKey as (typeof GST_AMOUNT_FIELDS)[number])) {
        const major = parseFloat((trimmed || "0").replace(/,/g, ""));
        const minor = Number.isFinite(major) && major > 0 ? Math.round(major * 100) : null;
        parsed.gst = { ...existingGst, [gstKey]: minor };
      } else {
        parsed.gst = { ...existingGst, [gstKey]: trimmed || null };
      }
    } else {
      parsed[fieldKey] = trimmed || null;
    }
    try {
      await updateInvoiceParsedFields(invoice._id, { parsed: parsed as Parameters<typeof updateInvoiceParsedFields>[1]["parsed"], updatedBy: "ui-user" });
      await loadInvoices();
      await refreshDetail();
    } catch (saveError) {
      addToast("error", getUserFacingErrorMessage(saveError, "Failed to save field."));
    }
  }

  async function handleSaveListCell() {
    if (!canEditInvoiceFields) {
      addToast("error", "You do not have permission to edit invoice fields.");
      return;
    }
    if (!editingListCell) return;
    const { invoiceId, field } = editingListCell;
    const trimmed = editListValue.trim();
    try {
      if (field === "attachmentName") {
        if (trimmed) await renameInvoiceAttachment(invoiceId, trimmed);
      } else {
        const parsed: Record<string, string | null> = {};
        if (field === "totalAmountMinor") {
          parsed.totalAmountMajor = trimmed || null;
        } else {
          parsed[field] = trimmed || null;
        }
        await updateInvoiceParsedFields(invoiceId, { parsed, updatedBy: "ui-user" });
      }
      setEditingListCell(null);
      await loadInvoices();
      if (activeId === invoiceId) {
        await refreshActiveInvoiceDetail();
      }
    } catch (saveError) {
      addToast("error", getUserFacingErrorMessage(saveError, "Failed to save field."));
    }
  }

  return {
    editingListCell,
    setEditingListCell,
    editListValue,
    setEditListValue,
    glCodeEditingInvoiceId,
    setGlCodeEditingInvoiceId,
    handleSaveField,
    handleSaveListCell
  };
}
