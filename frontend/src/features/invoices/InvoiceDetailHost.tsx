import type { MouseEvent } from "react";
import { updateInvoiceComplianceOverride } from "@/api";
import { invoiceUrls } from "@/api/urls/invoiceUrls";
import { InvoiceDetailPanel } from "@/components/invoice/InvoiceDetailPanel";
import { getExtractedFieldRows } from "@/lib/invoice/extractedFields";
import type { GlCode, Invoice, TdsRate } from "@/types";
import type { ComponentProps } from "react";

type ActiveCropUrlByField = ComponentProps<typeof InvoiceDetailPanel>["activeCropUrlByField"];

interface InvoiceDetailHostProps {
  detailsPanelVisible: boolean;
  onCloseDetailsPanel: () => void;
  onDividerMouseDown: (e: MouseEvent) => void;
  activeInvoice: Invoice | null;
  activeInvoiceDetailLoading: boolean;
  tenantGlCodes: GlCode[];
  tenantTdsRates: TdsRate[];
  activeCropUrlByField: ActiveCropUrlByField;
  sectionExpanded: Record<string, boolean>;
  setSection: (key: string, value: boolean | ((prev: boolean) => boolean)) => void;
  isRiskSignalsExpanded: (id: string) => boolean;
  toggleRiskSignalsExpanded: (id: string) => void;
  onWorkflowApproveSingle: (invoiceId: string) => void;
  onWorkflowRejectSingle: (invoiceId: string) => void;
  onSaveField: (invoice: Invoice, fieldKey: string, value: string, refreshDetail: () => Promise<void>) => Promise<void>;
  refreshActiveInvoiceDetail: () => Promise<void>;
  loadInvoices: () => Promise<void>;
  addToast: (type: "success" | "error" | "info", message: string) => void;
}

export function InvoiceDetailHost({
  detailsPanelVisible,
  onCloseDetailsPanel,
  onDividerMouseDown,
  activeInvoice,
  activeInvoiceDetailLoading,
  tenantGlCodes,
  tenantTdsRates,
  activeCropUrlByField,
  sectionExpanded,
  setSection,
  isRiskSignalsExpanded,
  toggleRiskSignalsExpanded,
  onWorkflowApproveSingle,
  onWorkflowRejectSingle,
  onSaveField,
  refreshActiveInvoiceDetail,
  loadInvoices,
  addToast
}: InvoiceDetailHostProps) {
  if (!detailsPanelVisible) return null;
  return (
    <>
      <div className="panel-divider" onMouseDown={onDividerMouseDown} />
      {activeInvoice ? (
        <InvoiceDetailPanel
          invoice={activeInvoice}
          loading={activeInvoiceDetailLoading}
          tenantGlCodes={tenantGlCodes}
          tenantTdsRates={tenantTdsRates}
          activeCropUrlByField={activeCropUrlByField}
          resolvePreviewUrl={(page) => invoiceUrls.preview(activeInvoice._id, page)}
          activeSourcePreviewExpanded={!!sectionExpanded.activeSourcePreview}
          setActiveSourcePreviewExpanded={(v) => setSection("activeSourcePreview", v)}
          activeExtractedFieldsExpanded={sectionExpanded.activeExtractedFields !== false}
          setActiveExtractedFieldsExpanded={(v) => setSection("activeExtractedFields", v)}
          activeLineItemsExpanded={!!sectionExpanded.activeLineItems}
          setActiveLineItemsExpanded={(v) => setSection("activeLineItems", v)}
          vendorDetailsExpanded={!!sectionExpanded.activeVendorDetails}
          setVendorDetailsExpanded={(v) => setSection("activeVendorDetails", v)}
          customerDetailsExpanded={!!sectionExpanded.activeCustomerDetails}
          setCustomerDetailsExpanded={(v) => setSection("activeCustomerDetails", v)}
          onWorkflowApproveSingle={onWorkflowApproveSingle}
          onWorkflowRejectSingle={onWorkflowRejectSingle}
          onSaveField={(fieldKey, value, refreshDetail) => onSaveField(activeInvoice, fieldKey, value, refreshDetail)}
          refreshActiveInvoiceDetail={refreshActiveInvoiceDetail}
          onClose={onCloseDetailsPanel}
          extractedRows={getExtractedFieldRows(activeInvoice)}
          onOverrideGlCode={async (glCode, glName) => {
            if (!glCode) {
              try {
                await updateInvoiceComplianceOverride(activeInvoice._id, { glCode: "" } as Record<string, unknown>);
                await refreshActiveInvoiceDetail();
                await loadInvoices();
                addToast("success", "GL code cleared.");
              } catch {
                addToast("error", "Failed to clear GL code.");
              }
              return;
            }
            try {
              await updateInvoiceComplianceOverride(activeInvoice._id, { glCode, glName } as Record<string, unknown>);
              await refreshActiveInvoiceDetail();
              await loadInvoices();
              addToast("success", "GL code updated and compliance recalculated.");
            } catch {
              addToast("error", "Failed to update GL code.");
            }
          }}
          onOverrideTdsSection={async (section) => {
            try {
              await updateInvoiceComplianceOverride(activeInvoice._id, { tdsSection: section } as Record<string, unknown>);
              await refreshActiveInvoiceDetail();
              addToast("success", "TDS section updated.");
            } catch {
              addToast("error", "Failed to update TDS section.");
            }
          }}
          onDismissRiskSignal={async (signalCode) => {
            try {
              await updateInvoiceComplianceOverride(activeInvoice._id, { dismissRiskSignal: signalCode } as Record<string, unknown>);
              await refreshActiveInvoiceDetail();
              addToast("info", "Signal dismissed.");
            } catch {
              addToast("error", "Failed to dismiss signal.");
            }
          }}
          riskSignalsExpanded={isRiskSignalsExpanded(activeInvoice._id)}
          onToggleRiskSignalsExpanded={() => toggleRiskSignalsExpanded(activeInvoice._id)}
        />
      ) : (
        <section className="panel detail-panel invoice-detail-panel">
          <div className="panel-title">
            <h2>Invoice Details</h2>
            <button
              type="button"
              className="collapse-button"
              onClick={onCloseDetailsPanel}
              aria-label="Close details panel"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <p className="muted invoice-detail-empty">Select an invoice to inspect details.</p>
        </section>
      )}
    </>
  );
}
