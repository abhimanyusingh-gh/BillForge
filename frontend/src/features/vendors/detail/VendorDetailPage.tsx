import { useEffect, useState } from "react";
import { Section197CertPanel } from "@/features/vendors/detail/Section197CertPanel";
import { useEditVendor } from "@/features/vendors/detail/useEditVendor";
import { useVendor } from "@/features/vendors/detail/useVendor";
import { VendorMergeDialog } from "@/features/vendors/merge/VendorMergeDialog";
import {
  asVendorId,
  VENDOR_STATUS_VALUES,
  type VendorDetail,
  type VendorEditableFields,
  type VendorId,
  type VendorStatus
} from "@/domain/vendor/vendor";

interface VendorDetailPageProps {
  vendorId: VendorId;
}

interface EditFormState {
  name: string;
  pan: string;
  gstin: string;
  defaultGlCode: string;
  defaultTdsSection: string;
  vendorStatus: VendorStatus;
}

function toForm(vendor: VendorDetail): EditFormState {
  return {
    name: vendor.name,
    pan: vendor.pan ?? "",
    gstin: vendor.gstin ?? "",
    defaultGlCode: vendor.defaultGlCode ?? "",
    defaultTdsSection: vendor.defaultTdsSection ?? "",
    vendorStatus: vendor.vendorStatus
  };
}

function toEditableFields(form: EditFormState): VendorEditableFields {
  return {
    name: form.name,
    pan: form.pan.trim().length === 0 ? null : form.pan.trim(),
    gstin: form.gstin.trim().length === 0 ? null : form.gstin.trim(),
    defaultGlCode: form.defaultGlCode.trim().length === 0 ? null : form.defaultGlCode.trim(),
    defaultTdsSection: form.defaultTdsSection.trim().length === 0 ? null : form.defaultTdsSection.trim(),
    vendorStatus: form.vendorStatus
  };
}

function backToList(): void {
  if (typeof window === "undefined") return;
  window.location.hash = "#/vendors";
}

export function VendorDetailPage({ vendorId }: VendorDetailPageProps) {
  const { vendor, isLoading, error, refetch } = useVendor(vendorId);
  const { isSaving, error: editError, edit } = useEditVendor();
  const [form, setForm] = useState<EditFormState | null>(null);
  const [mergeOpen, setMergeOpen] = useState<boolean>(false);

  useEffect(() => {
    if (vendor !== null) setForm(toForm(vendor));
  }, [vendor]);

  if (isLoading && vendor === null) {
    return <p className="vendor-empty" role="status">Loading vendor…</p>;
  }
  if (error !== null) {
    return (
      <section className="vendor-page">
        <button className="btn btn-secondary" type="button" onClick={backToList}>← Back to vendors</button>
        <div className="alert" role="alert">{error}</div>
      </section>
    );
  }
  if (vendor === null || form === null) return null;

  const update = (key: keyof EditFormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => (prev === null ? prev : { ...prev, [key]: event.target.value }));
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form === null) return;
    await edit(vendor.id, toEditableFields(form));
    refetch();
  };

  return (
    <section className="vendor-page" aria-labelledby="vendor-detail-heading">
      <header className="page-header">
        <button className="btn btn-secondary" type="button" onClick={backToList}>← Back</button>
        <h1 id="vendor-detail-heading">{vendor.name}</h1>
        <span className="count">{vendor.invoiceCount} invoices</span>
        <div className="page-tools">
          <button className="btn btn-secondary" type="button" onClick={() => setMergeOpen(true)}>
            Merge…
          </button>
        </div>
      </header>

      <div className="vendor-detail-grid">
        <section className="vendor-section" aria-labelledby="vendor-info-heading">
          <h3 id="vendor-info-heading">Vendor information</h3>
          <dl className="kvgrid">
            <div className="kv"><dt>PAN</dt><dd className="mono-cell">{vendor.pan ?? "—"}</dd></div>
            <div className="kv"><dt>GSTIN</dt><dd className="mono-cell">{vendor.gstin ?? "—"}</dd></div>
            <div className="kv"><dt>Default GL code</dt><dd>{vendor.defaultGlCode ?? "—"}</dd></div>
            <div className="kv"><dt>Default TDS section</dt><dd>{vendor.defaultTdsSection ?? "—"}</dd></div>
            <div className="kv"><dt>Tally ledger</dt><dd>{vendor.tallyLedgerName ?? "—"}</dd></div>
            <div className="kv"><dt>State</dt><dd>{vendor.stateName ?? "—"}</dd></div>
            <div className="kv"><dt>MSME</dt><dd>{vendor.msme !== null ? `${vendor.msme.classification} · ${vendor.msme.agreedPaymentDays ?? 45} days` : "—"}</dd></div>
            <div className="kv"><dt>Last invoice</dt><dd>{vendor.lastInvoiceDate ?? "—"}</dd></div>
          </dl>
        </section>

        <section className="vendor-section" aria-labelledby="vendor-edit-heading">
          <h3 id="vendor-edit-heading">Edit</h3>
          <form className="vendor-edit-form" onSubmit={handleSave}>
            <label className="field">
              <span>Name</span>
              <input className="input" value={form.name} onChange={update("name")} aria-label="Vendor name" />
            </label>
            <label className="field">
              <span>PAN</span>
              <input className="input" value={form.pan} onChange={update("pan")} aria-label="PAN" />
            </label>
            <label className="field">
              <span>GSTIN</span>
              <input className="input" value={form.gstin} onChange={update("gstin")} aria-label="GSTIN" />
            </label>
            <label className="field">
              <span>Default GL code</span>
              <input className="input" value={form.defaultGlCode} onChange={update("defaultGlCode")} aria-label="Default GL code" />
            </label>
            <label className="field">
              <span>Default TDS section</span>
              <input className="input" value={form.defaultTdsSection} onChange={update("defaultTdsSection")} aria-label="Default TDS section" />
            </label>
            <label className="field">
              <span>Status</span>
              <select className="input" value={form.vendorStatus} onChange={update("vendorStatus")} aria-label="Vendor status">
                {VENDOR_STATUS_VALUES.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
            {editError !== null ? <div className="alert" role="alert">{editError}</div> : null}
            <button className="btn" type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save changes"}</button>
          </form>
        </section>

        <Section197CertPanel vendorId={vendor.id} cert={vendor.section197Cert} onSaved={refetch} />
      </div>

      {mergeOpen ? (
        <VendorMergeDialog
          targetVendorId={vendor.id}
          targetVendorName={vendor.name}
          onClose={() => setMergeOpen(false)}
          onMerged={() => {
            setMergeOpen(false);
            refetch();
          }}
        />
      ) : null}
    </section>
  );
}

export function parseVendorIdFromRoute(route: string): VendorId | null {
  const match = /^\/vendors\/([^/]+)$/.exec(route);
  if (match === null) return null;
  return asVendorId(match[1]);
}
