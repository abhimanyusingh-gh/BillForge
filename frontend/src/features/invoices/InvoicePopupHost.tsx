import { invoiceUrls } from "@/api/urls/invoiceUrls";
import { InvoicePopup } from "@/components/invoice/InvoicePopup";
import type { Invoice } from "@/types";
import type { ComponentProps } from "react";

type InvoicePopupProps = ComponentProps<typeof InvoicePopup>;

interface InvoicePopupHostProps {
  popupInvoice: Invoice | null;
  popupInvoiceDetailLoading: boolean;
  tenantMode?: "test" | "live";
  popupRef: React.RefObject<HTMLElement>;
  sectionExpanded: Record<string, boolean>;
  setSection: (key: string, value: boolean | ((prev: boolean) => boolean)) => void;
  popupCropUrlByField: InvoicePopupProps["popupCropUrlByField"];
  popupExtractedRows: InvoicePopupProps["popupExtractedRows"];
  popupTallyMappings: InvoicePopupProps["popupTallyMappings"];
  setPopupInvoiceId: (id: string | null) => void;
  onSaveField: (invoice: Invoice, fieldKey: string, value: string, refreshDetail: () => Promise<void>) => Promise<void>;
  refreshPopupInvoiceDetail: () => Promise<void>;
}

export function InvoicePopupHost({
  popupInvoice,
  popupInvoiceDetailLoading,
  tenantMode,
  popupRef,
  sectionExpanded,
  setSection,
  popupCropUrlByField,
  popupExtractedRows,
  popupTallyMappings,
  setPopupInvoiceId,
  onSaveField,
  refreshPopupInvoiceDetail
}: InvoicePopupHostProps) {
  if (!popupInvoice) return null;
  return (
    <InvoicePopup
      invoice={popupInvoice}
      loading={popupInvoiceDetailLoading}
      tenantMode={tenantMode}
      popupRef={popupRef}
      popupSourcePreviewExpanded={!!sectionExpanded.popupSourcePreview}
      setPopupSourcePreviewExpanded={(v) => setSection("popupSourcePreview", v)}
      popupExtractedFieldsExpanded={sectionExpanded.popupExtractedFields !== false}
      setPopupExtractedFieldsExpanded={(v) => setSection("popupExtractedFields", v)}
      popupLineItemsExpanded={!!sectionExpanded.popupLineItems}
      setPopupLineItemsExpanded={(v) => setSection("popupLineItems", v)}
      popupRawOcrExpanded={!!sectionExpanded.popupRawOcr}
      setPopupRawOcrExpanded={(v) => setSection("popupRawOcr", v)}
      popupMappingExpanded={!!sectionExpanded.popupMapping}
      setPopupMappingExpanded={(v) => setSection("popupMapping", v)}
      popupCropUrlByField={popupCropUrlByField}
      popupExtractedRows={popupExtractedRows}
      popupTallyMappings={popupTallyMappings}
      onClose={() => setPopupInvoiceId(null)}
      onSaveField={(fieldKey, value, refreshDetail) => onSaveField(popupInvoice, fieldKey, value, refreshDetail)}
      refreshPopupInvoiceDetail={refreshPopupInvoiceDetail}
      resolvePreviewUrl={(page) => invoiceUrls.preview(popupInvoice._id, page)}
    />
  );
}
