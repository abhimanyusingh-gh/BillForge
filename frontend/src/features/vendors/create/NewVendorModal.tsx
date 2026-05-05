import { useState } from "react";
import { useCreateVendor } from "@/features/vendors/create/useCreateVendor";
import type { VendorDetail } from "@/domain/vendor/vendor";

interface NewVendorModalProps {
  onClose: () => void;
  onCreated: (vendor: VendorDetail) => void;
}

const GSTIN_FORMAT = /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z]\d[A-Z\d]$/;
const PAN_FORMAT = /^[A-Z]{5}\d{4}[A-Z]$/;
const MIN_NAME_LENGTH = 3;

const MSME_OPTIONS = [
  { value: "", label: "Not registered" },
  { value: "micro", label: "Micro" },
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" }
] as const;

export function NewVendorModal({ onClose, onCreated }: NewVendorModalProps) {
  const { isSubmitting, error, existingVendor, submit, reset } = useCreateVendor();
  const [companyName, setCompanyName] = useState<string>("");
  const [gstin, setGstin] = useState<string>("");
  const [pan, setPan] = useState<string>("");
  const [legalName, setLegalName] = useState<string>("");
  const [stateName, setStateName] = useState<string>("");
  const [msmeCategory, setMsmeCategory] = useState<string>("");

  const trimmedName = companyName.trim();
  const nameOk = trimmedName.length >= MIN_NAME_LENGTH;
  const gstinOk = GSTIN_FORMAT.test(gstin);
  const panOk = pan === "" || PAN_FORMAT.test(pan);
  const ready = nameOk && gstinOk && panOk;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ready || isSubmitting) return;
    try {
      const created = await submit({
        companyName: trimmedName,
        gstin,
        legalName: legalName.trim() || undefined,
        stateName: stateName.trim() || undefined,
        msmeCategory: msmeCategory || undefined,
        panNumber: pan || undefined
      });
      if (created !== null) {
        onCreated(created);
      }
    } catch {
      // hook surfaces error via state
    }
  };

  const handleScrimClick = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleCancel = () => {
    reset();
    onClose();
  };

  return (
    <div className="scrim" role="presentation" onClick={handleScrimClick}>
      <form
        className="modal-card new-vendor-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-vendor-modal-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <header className="modal-head">
          <h2 id="new-vendor-modal-title">New vendor</h2>
          <button type="button" className="btn ghost" aria-label="Close" onClick={handleCancel}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        <div className="modal-body">
          <label className="field">
            <span>Vendor name</span>
            <input
              className="input"
              type="text"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Vendor legal name"
              autoFocus
              required
            />
            {!nameOk && companyName.length > 0 ? (
              <span className="field-error">Vendor name must be at least 3 characters.</span>
            ) : null}
          </label>
          <label className="field">
            <span>GSTIN</span>
            <input
              className="input mono"
              type="text"
              value={gstin}
              onChange={(event) => setGstin(event.target.value.toUpperCase())}
              placeholder="33AECPS1234C1Z5"
              maxLength={15}
              required
            />
            {gstin.length > 0 && !gstinOk ? (
              <span className="field-error">Format: 2-digit state + PAN + entity + Z + checksum.</span>
            ) : null}
          </label>
          <label className="field">
            <span>PAN (optional)</span>
            <input
              className="input mono"
              type="text"
              value={pan}
              onChange={(event) => setPan(event.target.value.toUpperCase())}
              placeholder="AECPS1234C"
              maxLength={10}
            />
            {pan.length > 0 && !panOk ? (
              <span className="field-error">Format: AAAAA9999A — 5 letters, 4 digits, 1 letter.</span>
            ) : null}
          </label>
          <div className="field-row new-vendor-row">
            <label className="field">
              <span>Legal name</span>
              <input
                className="input"
                type="text"
                value={legalName}
                onChange={(event) => setLegalName(event.target.value)}
                placeholder="As in Tally Party Ledger"
              />
            </label>
            <label className="field">
              <span>State</span>
              <input
                className="input"
                type="text"
                value={stateName}
                onChange={(event) => setStateName(event.target.value)}
                placeholder="Karnataka"
              />
            </label>
          </div>
          <label className="field">
            <span>MSME category</span>
            <select
              className="input"
              value={msmeCategory}
              onChange={(event) => setMsmeCategory(event.target.value)}
            >
              {MSME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {error !== null ? (
            <div className="alert" role="alert">
              {error}
              {existingVendor !== null ? (
                <>
                  {" "}
                  <span className="new-vendor-existing">
                    Existing vendor: <strong>{existingVendor.name}</strong>
                  </span>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
        <footer className="modal-foot">
          <button type="button" className="btn ghost" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={!ready || isSubmitting}>
            {isSubmitting ? "Creating…" : "Create vendor"}
          </button>
        </footer>
      </form>
    </div>
  );
}
