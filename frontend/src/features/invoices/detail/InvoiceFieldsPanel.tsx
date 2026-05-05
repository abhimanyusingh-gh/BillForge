import { useEffect, useState } from "react";
import type { Invoice, InvoiceParsedFields } from "@/domain/invoice/invoice";
import { useEditInvoice } from "@/features/invoices/edit/useEditInvoice";
import { formatInr } from "@/features/invoices/format";

interface InvoiceFieldsPanelProps {
  invoice: Invoice;
  onSaved: () => void;
}

interface DraftFields {
  vendor: string;
  invoiceNumber: string;
  invoiceDate: string;
  gstin: string;
  pan: string;
  hsn: string;
  irn: string;
  glCode: string;
  glName: string;
  tdsSection: string;
}

function toDraft(parsed: InvoiceParsedFields): DraftFields {
  return {
    vendor: parsed.vendor ?? "",
    invoiceNumber: parsed.invoiceNumber ?? "",
    invoiceDate: parsed.invoiceDate ?? "",
    gstin: parsed.gstin ?? "",
    pan: parsed.pan ?? "",
    hsn: parsed.hsn ?? "",
    irn: parsed.irn ?? "",
    glCode: parsed.glCode ?? "",
    glName: parsed.glName ?? "",
    tdsSection: parsed.tdsSection ?? ""
  };
}

const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[A-Z\d]{1}[A-Z\d]{1}$/i;
const PAN_PATTERN = /^[A-Z]{5}\d{4}[A-Z]$/i;

function validate(draft: DraftFields): Record<keyof DraftFields, string | null> {
  return {
    vendor: draft.vendor.trim().length === 0 ? "Required" : null,
    invoiceNumber: draft.invoiceNumber.trim().length === 0 ? "Required" : null,
    invoiceDate: null,
    gstin: draft.gstin && !GSTIN_PATTERN.test(draft.gstin) ? "Invalid GSTIN" : null,
    pan: draft.pan && !PAN_PATTERN.test(draft.pan) ? "Invalid PAN" : null,
    hsn: null,
    irn: null,
    glCode: null,
    glName: null,
    tdsSection: null
  };
}

export function InvoiceFieldsPanel({ invoice, onSaved }: InvoiceFieldsPanelProps) {
  const [draft, setDraft] = useState<DraftFields>(() => toDraft(invoice.parsed));
  const edit = useEditInvoice(onSaved);

  useEffect(() => {
    setDraft(toDraft(invoice.parsed));
  }, [invoice.id, invoice.parsed]);

  const errors = validate(draft);
  const hasErrors = Object.values(errors).some((message) => message !== null);

  const onChange = (key: keyof DraftFields, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const onSave = async () => {
    if (hasErrors) return;
    await edit.save(invoice.id, {
      parsed: {
        vendor: draft.vendor || null,
        invoiceNumber: draft.invoiceNumber || null,
        invoiceDate: draft.invoiceDate || null,
        gstin: draft.gstin ? draft.gstin.toUpperCase() : null,
        pan: draft.pan ? draft.pan.toUpperCase() : null,
        hsn: draft.hsn || null,
        irn: draft.irn || null
      },
      glCode: draft.glCode || undefined,
      glName: draft.glName || undefined,
      tdsSection: draft.tdsSection || undefined
    });
  };

  return (
    <section className="invoice-fields-panel" aria-label="Extracted fields">
      <header className="invoice-section-header">
        <h3>Extracted fields</h3>
        <span className="lb-caption">Edit and save · changes persisted via PATCH</span>
      </header>

      <div className="invoice-fields-grid">
        <FieldRow label="Vendor">
          <input
            type="text"
            value={draft.vendor}
            onChange={(event) => onChange("vendor", event.target.value)}
            aria-invalid={errors.vendor !== null}
            aria-label="Vendor"
          />
          {errors.vendor ? <span className="invoice-field-error">{errors.vendor}</span> : null}
        </FieldRow>
        <FieldRow label="Invoice #">
          <input
            type="text"
            value={draft.invoiceNumber}
            onChange={(event) => onChange("invoiceNumber", event.target.value)}
            aria-invalid={errors.invoiceNumber !== null}
            aria-label="Invoice number"
          />
        </FieldRow>
        <FieldRow label="Invoice date">
          <input
            type="text"
            value={draft.invoiceDate}
            onChange={(event) => onChange("invoiceDate", event.target.value)}
            aria-label="Invoice date"
          />
        </FieldRow>
        <FieldRow label="Vendor GSTIN">
          <input
            type="text"
            value={draft.gstin}
            onChange={(event) => onChange("gstin", event.target.value.toUpperCase())}
            aria-invalid={errors.gstin !== null}
            aria-label="Vendor GSTIN"
            className="mono-cell"
          />
          {errors.gstin ? <span className="invoice-field-error">{errors.gstin}</span> : null}
        </FieldRow>
        <FieldRow label="Vendor PAN">
          <input
            type="text"
            value={draft.pan}
            onChange={(event) => onChange("pan", event.target.value.toUpperCase())}
            aria-invalid={errors.pan !== null}
            aria-label="Vendor PAN"
            className="mono-cell"
          />
        </FieldRow>
        <FieldRow label="HSN/SAC">
          <input
            type="text"
            value={draft.hsn}
            onChange={(event) => onChange("hsn", event.target.value)}
            aria-label="HSN or SAC"
          />
        </FieldRow>
        <FieldRow label="IRN">
          <input
            type="text"
            value={draft.irn}
            onChange={(event) => onChange("irn", event.target.value)}
            aria-label="IRN"
          />
        </FieldRow>
        <FieldRow label="GL code">
          <input
            type="text"
            value={draft.glCode}
            onChange={(event) => onChange("glCode", event.target.value)}
            aria-label="GL code"
          />
        </FieldRow>
        <FieldRow label="GL name">
          <input
            type="text"
            value={draft.glName}
            onChange={(event) => onChange("glName", event.target.value)}
            aria-label="GL name"
          />
        </FieldRow>
        <FieldRow label="TDS section">
          <input
            type="text"
            value={draft.tdsSection}
            onChange={(event) => onChange("tdsSection", event.target.value)}
            aria-label="TDS section"
          />
        </FieldRow>
      </div>

      <div className="invoice-fields-totals">
        <div>
          <span>Gross</span>
          <strong>{formatInr(invoice.totalAmount)}</strong>
        </div>
        <div>
          <span>TDS</span>
          <strong className="invoice-amount-deduct">− {formatInr(invoice.tdsAmount)}</strong>
        </div>
        <div>
          <span>Net payable</span>
          <strong className="invoice-amount-net">{formatInr(invoice.netAmount)}</strong>
        </div>
      </div>

      <footer className="invoice-fields-footer">
        {edit.error ? <span className="invoice-field-error">{edit.error}</span> : null}
        <button
          type="button"
          className="btn-primary"
          onClick={onSave}
          disabled={hasErrors || edit.isSaving}
        >
          {edit.isSaving ? "Saving…" : "Save changes"}
        </button>
      </footer>
    </section>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="invoice-field-row">
      <span className="invoice-field-label">{label}</span>
      <span className="invoice-field-input">{children}</span>
    </label>
  );
}
