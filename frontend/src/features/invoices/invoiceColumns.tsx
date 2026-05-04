import type { ReactNode } from "react";
import type { Invoice } from "@/types";
import {
  Combobox,
  DATATABLE_ALIGN,
  type ComboboxOption,
  type DataTableColumn
} from "@/components/ds";
import { ConfidenceBadge } from "@/components/invoice/ConfidenceBadge";
import { ActionHintBadge } from "@/components/invoice/ActionHintBadge";
import { RiskDot, RISK_SEVERITY, type RiskSeverity } from "@/components/compliance/RiskDot";
import { formatMinorAmountWithCurrency } from "@/lib/common/currency";
import { getAvailableRowActions } from "@/lib/common/selection";
import { STATUS_LABELS } from "@/lib/invoice/invoiceView";

const INVOICE_COLUMN_ID = {
  FILE: "file",
  VENDOR: "vendor",
  INVOICE_NUMBER: "invoiceNumber",
  INVOICE_DATE: "invoiceDate",
  TOTAL: "total",
  TAX: "tax",
  GL_CODE: "glCode",
  TDS: "tds",
  SIGNALS: "signals",
  CONFIDENCE: "confidence",
  STATUS: "status",
  APPROVED_BY: "approvedBy",
  RECEIVED: "received",
  ACTIONS: "actions"
} as const;

const STATUS_ICONS: Record<string, string> = {
  PENDING: "hourglass_empty",
  PARSED: "task_alt",
  NEEDS_REVIEW: "flag",
  AWAITING_APPROVAL: "pending_actions",
  FAILED_OCR: "error",
  FAILED_PARSE: "error",
  APPROVED: "check_circle",
  EXPORTED: "cloud_done"
};

const GL_CODE_OPTION_KEY = (value: string): string => value;

function CellShield({ children }: { children: ReactNode }) {
  return (
    <div onClick={(event) => event.stopPropagation()}>
      {children}
    </div>
  );
}

function formatTaxSummary(invoice: { parsed?: { gst?: { cgstMinor?: number; sgstMinor?: number; igstMinor?: number; totalTaxMinor?: number }; currency?: string } }): string {
  const gst = invoice.parsed?.gst;
  if (!gst) return "-";
  const cur = invoice.parsed?.currency;
  if (gst.totalTaxMinor) return formatMinorAmountWithCurrency(gst.totalTaxMinor, cur);
  const sum = (gst.cgstMinor ?? 0) + (gst.sgstMinor ?? 0) + (gst.igstMinor ?? 0);
  return sum > 0 ? formatMinorAmountWithCurrency(sum, cur) : "-";
}

function formatApproverName(value?: string): string {
  if (!value) return "-";
  const atIdx = value.indexOf("@");
  if (atIdx <= 0) return value;
  return value.slice(0, atIdx).replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface InvoiceColumnsDeps {
  editingListCell: { invoiceId: string; field: string } | null;
  editListValue: string;
  setEditListValue: (value: string) => void;
  setEditingListCell: (value: { invoiceId: string; field: string } | null) => void;
  handleSaveListCell: () => Promise<void>;
  setPopupInvoiceId: (id: string | null) => void;
  glCodeEditingInvoiceId: string | null;
  setGlCodeEditingInvoiceId: (id: string | null) => void;
  tenantGlComboOptions: ReadonlyArray<ComboboxOption<string>>;
  handleTableGlCodeSelect: (invoiceId: string, glCode: string, glName: string) => Promise<void>;
  handleTableGlCodeClear: (invoiceId: string) => Promise<void>;
  ingestingIds: Set<string>;
  canApproveInvoices: boolean;
  canRetryInvoices: boolean;
  canDeleteInvoices: boolean;
  handleApproveSingle: (invoiceId: string) => Promise<boolean>;
  handleRetrySingle: (invoiceId: string) => Promise<void>;
  handleDeleteSingle: (invoiceId: string, fileName: string) => void;
}

export function buildInvoiceColumns(deps: InvoiceColumnsDeps): ReadonlyArray<DataTableColumn<Invoice>> {
  const {
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
  } = deps;

  return [
    {
      id: INVOICE_COLUMN_ID.FILE,
      header: "File",
      sortable: true,
      render: (invoice) => {
        const canEditCell = invoice.actions?.canEditFields === true;
        if (editingListCell?.invoiceId === invoice._id && editingListCell.field === "attachmentName") {
          return (
            <CellShield>
              <input className="input" value={editListValue} onChange={(e) => setEditListValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void handleSaveListCell(); if (e.key === "Escape") setEditingListCell(null); }} autoFocus />
              <button type="button" className="btn primary" aria-label="Save file name" onClick={() => void handleSaveListCell()}>&#10003;</button>
            </CellShield>
          );
        }
        return (
          <span>
            <button type="button" className="lb-caption" onClick={(event) => { event.stopPropagation(); setPopupInvoiceId(invoice._id); }}>{invoice.attachmentName}</button>
            {canEditCell ? (
              <button type="button" className="btn ghost" title="Rename" aria-label={`Rename file ${invoice.attachmentName}`} onClick={(event) => { event.stopPropagation(); setEditingListCell({ invoiceId: invoice._id, field: "attachmentName" }); setEditListValue(invoice.attachmentName); }}>
                <span className="material-symbols-outlined">edit</span>
              </button>
            ) : null}
          </span>
        );
      }
    },
    {
      id: INVOICE_COLUMN_ID.VENDOR,
      header: "Vendor",
      sortable: true,
      render: (invoice) => {
        const canEditCell = invoice.actions?.canEditFields === true;
        if (editingListCell?.invoiceId === invoice._id && editingListCell.field === "vendorName") {
          return (
            <CellShield>
              <input className="input" value={editListValue} onChange={(e) => setEditListValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void handleSaveListCell(); if (e.key === "Escape") setEditingListCell(null); }} autoFocus />
              <button type="button" className="btn primary" aria-label="Save vendor" onClick={() => void handleSaveListCell()}>&#10003;</button>
            </CellShield>
          );
        }
        return (
          <span className="mono-cell">
            <span className="mono-cell">{invoice.parsed?.vendorName ?? "-"}</span>
            {canEditCell ? (
              <button type="button" className="btn ghost" title="Edit vendor" aria-label={`Edit vendor on ${invoice.attachmentName}`} onClick={(event) => { event.stopPropagation(); setEditingListCell({ invoiceId: invoice._id, field: "vendorName" }); setEditListValue(invoice.parsed?.vendorName ?? ""); }}>
                <span className="material-symbols-outlined">edit</span>
              </button>
            ) : null}
          </span>
        );
      }
    },
    {
      id: INVOICE_COLUMN_ID.INVOICE_NUMBER,
      header: "Invoice #",
      sortable: true,
      render: (invoice) => {
        const canEditCell = invoice.actions?.canEditFields === true;
        if (editingListCell?.invoiceId === invoice._id && editingListCell.field === "invoiceNumber") {
          return (
            <CellShield>
              <input className="input" value={editListValue} onChange={(e) => setEditListValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void handleSaveListCell(); if (e.key === "Escape") setEditingListCell(null); }} autoFocus />
              <button type="button" className="btn primary" aria-label="Save invoice number" onClick={() => void handleSaveListCell()}>&#10003;</button>
            </CellShield>
          );
        }
        return (
          <span className="mono-cell">
            <span className="mono-cell">{invoice.parsed?.invoiceNumber ?? "-"}</span>
            {canEditCell ? (
              <button type="button" className="btn ghost" title="Edit invoice number" aria-label={`Edit invoice number on ${invoice.attachmentName}`} onClick={(event) => { event.stopPropagation(); setEditingListCell({ invoiceId: invoice._id, field: "invoiceNumber" }); setEditListValue(invoice.parsed?.invoiceNumber ?? ""); }}>
                <span className="material-symbols-outlined">edit</span>
              </button>
            ) : null}
          </span>
        );
      }
    },
    {
      id: INVOICE_COLUMN_ID.INVOICE_DATE,
      header: "Invoice Date",
      sortable: true,
      render: (invoice) => {
        const canEditCell = invoice.actions?.canEditFields === true;
        if (editingListCell?.invoiceId === invoice._id && editingListCell.field === "invoiceDate") {
          return (
            <CellShield>
              <input className="input" type="date" value={editListValue} onChange={(e) => setEditListValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void handleSaveListCell(); if (e.key === "Escape") setEditingListCell(null); }} autoFocus />
              <button type="button" className="btn primary" aria-label="Save invoice date" onClick={() => void handleSaveListCell()}>&#10003;</button>
            </CellShield>
          );
        }
        return (
          <span className="mono-cell">
            <span className="mono-cell">{invoice.parsed?.invoiceDate ?? "-"}</span>
            {canEditCell ? (
              <button type="button" className="btn ghost" title="Edit date" aria-label={`Edit invoice date on ${invoice.attachmentName}`} onClick={(event) => { event.stopPropagation(); setEditingListCell({ invoiceId: invoice._id, field: "invoiceDate" }); const raw = invoice.parsed?.invoiceDate ?? ""; const d = raw && !/^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(raw) : null; setEditListValue(d && !isNaN(d.getTime()) ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : raw); }}>
                <span className="material-symbols-outlined">edit</span>
              </button>
            ) : null}
          </span>
        );
      }
    },
    {
      id: INVOICE_COLUMN_ID.TOTAL,
      header: "Total",
      sortable: true,
      align: DATATABLE_ALIGN.RIGHT,
      render: (invoice) => {
        const canEditCell = invoice.actions?.canEditFields === true;
        const isRisk = invoice.compliance?.riskSignals?.some((s) => s.code === "TOTAL_AMOUNT_ABOVE_EXPECTED" && s.status === "open");
        if (editingListCell?.invoiceId === invoice._id && editingListCell.field === "totalAmountMinor") {
          return (
            <CellShield>
              <input className="input" value={editListValue} onChange={(e) => setEditListValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void handleSaveListCell(); if (e.key === "Escape") setEditingListCell(null); }} autoFocus />
              <button type="button" className="btn primary" aria-label="Save amount" onClick={() => void handleSaveListCell()}>&#10003;</button>
            </CellShield>
          );
        }
        return (
          <span className={`mono-cell${isRisk ? " value-risk" : ""}`}>
            <span className="mono-cell">{formatMinorAmountWithCurrency(invoice.parsed?.totalAmountMinor, invoice.parsed?.currency)}</span>
            {canEditCell ? (
              <button type="button" className="btn ghost" title="Edit amount" aria-label={`Edit amount on ${invoice.attachmentName}`} onClick={(event) => { event.stopPropagation(); setEditingListCell({ invoiceId: invoice._id, field: "totalAmountMinor" }); setEditListValue(invoice.parsed?.totalAmountMinor != null ? String(invoice.parsed.totalAmountMinor / 100) : ""); }}>
                <span className="material-symbols-outlined">edit</span>
              </button>
            ) : null}
          </span>
        );
      }
    },
    {
      id: INVOICE_COLUMN_ID.TAX,
      header: "Tax",
      sortable: true,
      align: DATATABLE_ALIGN.RIGHT,
      render: (invoice) => <span className="muted">{formatTaxSummary(invoice)}</span>
    },
    {
      id: INVOICE_COLUMN_ID.GL_CODE,
      header: "GL Code",
      sortable: true,
      render: (invoice) => (
        <CellShield>
          <span className="mono-cell">
            {glCodeEditingInvoiceId === invoice._id ? (
              <Combobox<string>
                options={tenantGlComboOptions}
                value={invoice.compliance?.glCode?.code ?? null}
                onChange={(code) => {
                  const match = tenantGlComboOptions.find((opt) => opt.value === code);
                  void handleTableGlCodeSelect(invoice._id, code, match?.label ?? "");
                }}
                onClear={() => void handleTableGlCodeClear(invoice._id)}
                optionKey={GL_CODE_OPTION_KEY}
                placeholder="Select GL code..."
                searchPlaceholder="Search GL codes..."
                emptyText="No matching GL codes"
                clearLabel="Clear GL code"
                autoOpen
                onOpenChange={(isOpen) => {
                  if (!isOpen) setGlCodeEditingInvoiceId(null);
                }}
              />
            ) : (
              <>
                <span title={invoice.compliance?.glCode?.code ?? ""}>
                  {invoice.complianceSummary?.glCode ?? invoice.compliance?.glCode?.name ?? ""}
                  {!invoice.complianceSummary?.glCode && !invoice.compliance?.glCode?.name ? <span className="muted">—</span> : null}
                </span>
                {invoice.actions?.canOverrideGlCode === true ? (
                  <button
                    type="button"
                    className="btn ghost"
                    title="Edit GL code"
                    aria-label={`Edit GL code on ${invoice.attachmentName}`}
                    onClick={() => setGlCodeEditingInvoiceId(invoice._id)}
                  >
                    <span className="material-symbols-outlined">edit</span>
                  </button>
                ) : null}
              </>
            )}
          </span>
        </CellShield>
      )
    },
    {
      id: INVOICE_COLUMN_ID.TDS,
      header: "TDS",
      sortable: true,
      render: (invoice) => (
        <span className="mono-cell">
          {invoice.complianceSummary?.tdsSection ?? invoice.compliance?.tds?.section
            ? <span>{invoice.complianceSummary?.tdsSection ?? invoice.compliance?.tds?.section} {invoice.compliance?.tds?.rate ? `${invoice.compliance.tds.rate / 100}%` : ""}</span>
            : <span className="muted">—</span>}
        </span>
      )
    },
    {
      id: INVOICE_COLUMN_ID.SIGNALS,
      header: "Signals",
      sortable: true,
      render: (invoice) => {
        const count = invoice.complianceSummary?.riskSignalCount ?? invoice.compliance?.riskSignals?.filter((s) => s.status === "open").length ?? 0;
        const rawMaxSev = invoice.complianceSummary?.riskSignalMaxSeverity ?? (invoice.compliance?.riskSignals?.length ? invoice.compliance.riskSignals.reduce((m, s) => s.severity === "critical" ? "critical" : s.severity === "warning" && m !== "critical" ? "warning" : m, "info" as string) : null);
        const severity: RiskSeverity = count === 0 || rawMaxSev == null
          ? RISK_SEVERITY.CLEAN
          : rawMaxSev === "critical" ? RISK_SEVERITY.CRITICAL
          : rawMaxSev === "warning" ? RISK_SEVERITY.WARNING
          : RISK_SEVERITY.INFO;
        return <RiskDot severity={severity} count={count} />;
      }
    },
    {
      id: INVOICE_COLUMN_ID.CONFIDENCE,
      header: "Score",
      sortable: true,
      render: (invoice) => <ConfidenceBadge score={invoice.confidenceScore ?? 0} tone={invoice.confidenceTone} />
    },
    {
      id: INVOICE_COLUMN_ID.STATUS,
      header: "Status",
      sortable: true,
      render: (invoice) => (
        <>
          {ingestingIds.has(invoice._id) ? (
            <span className="status status-reprocessing">Reprocessing</span>
          ) : (
            <span className={`status status-${invoice.status.toLowerCase()}`}>
              {STATUS_ICONS[invoice.status] ? <span className="material-symbols-outlined status-badge-icon">{STATUS_ICONS[invoice.status]}</span> : null}
              {invoice.status === "AWAITING_APPROVAL" && invoice.workflowState?.currentStep
                ? `Step ${invoice.workflowState.currentStep}`
                : (STATUS_LABELS[invoice.status] ?? invoice.status)}
            </span>
          )}
          {invoice.possibleDuplicate ? (
            <span className="material-symbols-outlined" title="Possible duplicate — another invoice has identical file contents">warning</span>
          ) : null}
        </>
      )
    },
    {
      id: INVOICE_COLUMN_ID.APPROVED_BY,
      header: "Approved By",
      sortable: true,
      render: (invoice) => (
        <span className="sub" title={invoice.approval?.email ?? invoice.approval?.approvedBy ?? ""}>
          {formatApproverName(invoice.approval?.email ?? invoice.approval?.approvedBy)}
        </span>
      )
    },
    {
      id: INVOICE_COLUMN_ID.RECEIVED,
      header: "Received",
      sortable: true,
      render: (invoice) => <span className="invoice-list-cell-mono">{new Date(invoice.receivedAt).toLocaleString()}</span>
    },
    {
      id: INVOICE_COLUMN_ID.ACTIONS,
      header: "",
      sortable: false,
      align: DATATABLE_ALIGN.RIGHT,
      render: (invoice) => {
        const actions = getAvailableRowActions(invoice).filter((action) => {
          if (action === "approve") return canApproveInvoices;
          if (action === "reingest") return canRetryInvoices;
          if (action === "delete") return canDeleteInvoices;
          return false;
        });
        const ingesting = ingestingIds.has(invoice._id);
        return (
          <CellShield>
            <div className="row-actions-cell">
              <ActionHintBadge invoice={invoice} />
              {actions.includes("approve") && !ingesting ? (
                <button type="button" className="row-action-button row-action-approve" title="Approve" aria-label={`Approve invoice ${invoice.attachmentName}`} onClick={() => void handleApproveSingle(invoice._id)}>
                  <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
                </button>
              ) : null}
              {actions.includes("reingest") && !ingesting ? (
                <button type="button" className="row-action-button row-action-retry" title="Reingest" aria-label={`Reingest invoice ${invoice.attachmentName}`} onClick={() => void handleRetrySingle(invoice._id)}>
                  <span className="material-symbols-outlined" aria-hidden="true">replay</span>
                </button>
              ) : null}
              {actions.includes("delete") && !ingesting ? (
                <button type="button" className="row-action-button" title="Delete" aria-label={`Delete invoice ${invoice.attachmentName}`} onClick={() => handleDeleteSingle(invoice._id, invoice.attachmentName)}>
                  <span className="material-symbols-outlined" aria-hidden="true">delete</span>
                </button>
              ) : null}
            </div>
          </CellShield>
        );
      }
    }
  ];
}
