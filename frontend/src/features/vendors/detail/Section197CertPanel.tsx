import { useState } from "react";
import { vendorService } from "@/api/vendorService";
import type { Section197Cert, VendorId } from "@/domain/vendor/vendor";
import { useSessionStore } from "@/state/sessionStore";

interface Section197CertPanelProps {
  vendorId: VendorId;
  cert: Section197Cert | null;
  onSaved: () => void;
}

interface CertFormState {
  certificateNumber: string;
  validFrom: string;
  validTo: string;
  maxAmountMinor: string;
  applicableRateBps: string;
}

function initialState(cert: Section197Cert | null): CertFormState {
  if (cert === null) {
    return { certificateNumber: "", validFrom: "", validTo: "", maxAmountMinor: "", applicableRateBps: "" };
  }
  return {
    certificateNumber: cert.certificateNumber,
    validFrom: cert.validFrom.slice(0, 10),
    validTo: cert.validTo.slice(0, 10),
    maxAmountMinor: String(cert.maxAmountMinor),
    applicableRateBps: String(cert.applicableRateBps)
  };
}

export function Section197CertPanel({ vendorId, cert, onSaved }: Section197CertPanelProps) {
  const tenantId = useSessionStore((state) => state.tenant?.id ?? null);
  const clientOrgId = useSessionStore((state) => state.currentClientOrgId);
  const [form, setForm] = useState<CertFormState>(() => initialState(cert));
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: keyof CertFormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (tenantId === null || clientOrgId === null) return;
    const max = Number(form.maxAmountMinor);
    const rate = Number(form.applicableRateBps);
    if (!Number.isInteger(max) || max < 0) {
      setError("Max amount must be a non-negative integer (paise).");
      return;
    }
    if (!Number.isInteger(rate) || rate < 0 || rate > 10000) {
      setError("Rate (bps) must be an integer between 0 and 10000.");
      return;
    }
    if (form.certificateNumber.trim().length === 0 || !form.validFrom || !form.validTo) {
      setError("Certificate number and dates are required.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await vendorService.setVendorSection197Cert(tenantId, clientOrgId, vendorId, {
        certificateNumber: form.certificateNumber.trim(),
        validFrom: form.validFrom,
        validTo: form.validTo,
        maxAmountMinor: max,
        applicableRateBps: rate
      });
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to save certificate.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="vendor-section" aria-labelledby={`cert-${vendorId}`}>
      <h3 id={`cert-${vendorId}`}>Section 197 certificate</h3>
      {cert !== null ? (
        <p className="vendor-section-sub">
          Active: {cert.certificateNumber} · {cert.validFrom.slice(0, 10)} → {cert.validTo.slice(0, 10)} · {cert.applicableRateBps} bps
        </p>
      ) : (
        <p className="vendor-section-sub">No certificate on file.</p>
      )}
      <form className="vendor-cert-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Certificate number</span>
          <input className="input" value={form.certificateNumber} onChange={update("certificateNumber")} />
        </label>
        <label className="field">
          <span>Valid from</span>
          <input className="input" type="date" value={form.validFrom} onChange={update("validFrom")} />
        </label>
        <label className="field">
          <span>Valid to</span>
          <input className="input" type="date" value={form.validTo} onChange={update("validTo")} />
        </label>
        <label className="field">
          <span>Max amount (paise)</span>
          <input className="input" inputMode="numeric" value={form.maxAmountMinor} onChange={update("maxAmountMinor")} />
        </label>
        <label className="field">
          <span>Rate (bps)</span>
          <input className="input" inputMode="numeric" value={form.applicableRateBps} onChange={update("applicableRateBps")} />
        </label>
        {error !== null ? <div className="alert" role="alert">{error}</div> : null}
        <button className="btn" type="submit" disabled={isSaving}>
          {isSaving ? "Saving…" : cert !== null ? "Update certificate" : "Save certificate"}
        </button>
      </form>
    </section>
  );
}
