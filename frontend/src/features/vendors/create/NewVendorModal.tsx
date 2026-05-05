import { useState } from "react";
import { useCreateVendor } from "@/features/vendors/create/useCreateVendor";
import { TDS_SECTION_OPTIONS, type VendorDetail } from "@/domain/vendor/vendor";

interface NewVendorModalProps {
  onClose: () => void;
  onCreated: (vendor: VendorDetail) => void;
}

const GSTIN_FORMAT = /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z]\d[A-Z\d]$/;
const PAN_FORMAT = /^[A-Z]{5}\d{4}[A-Z]$/;
const MIN_NAME_LENGTH = 3;
const DEFAULT_SECTION = "194C";
const MSME_DEFAULT_CLASSIFICATION = "small";

export function NewVendorModal({ onClose, onCreated }: NewVendorModalProps) {
  const { isSubmitting, error, existingVendor, submit, reset } = useCreateVendor();
  const [pan, setPan] = useState<string>("");
  const [gstin, setGstin] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");
  const [defaultTdsSection, setDefaultTdsSection] = useState<string>(DEFAULT_SECTION);
  const [isMsme, setIsMsme] = useState<boolean>(false);

  const trimmedName = companyName.trim();
  const nameOk = trimmedName.length >= MIN_NAME_LENGTH;
  const panOk = PAN_FORMAT.test(pan);
  const gstinOk = gstin === "" || GSTIN_FORMAT.test(gstin);
  const ready = panOk && nameOk && gstinOk;

  const subtitle = trimmedName.length > 0 ? `${trimmedName} · vendor master` : "Vendor master";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ready || isSubmitting) return;
    try {
      const created = await submit({
        companyName: trimmedName,
        gstin,
        panNumber: pan,
        defaultTdsSection,
        msmeCategory: isMsme ? MSME_DEFAULT_CLASSIFICATION : undefined
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

  const panHint = pan.length > 0 && !panOk
    ? "Format: AAAAA9999A — 5 letters, 4 digits, 1 letter"
    : "Required · drives TDS section defaults";

  const gstinHint = gstin.length > 0 && !gstinOk
    ? "Format: 2-digit state + PAN + entity code + Z + checksum"
    : "Optional · we'll cross-check the embedded PAN";

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
        <header className="modal-head new-vendor-head">
          <div>
            <h2 id="new-vendor-modal-title">New vendor</h2>
            <div className="new-vendor-subtitle">{subtitle}</div>
          </div>
          <button type="button" className="iconbtn" aria-label="Close" onClick={handleCancel}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="modal-body new-vendor-body">
          <div className="field new-vendor-field">
            <span className="field-cap">PAN</span>
            <input
              className={pan.length > 0 && !panOk ? "input mono error" : "input mono"}
              type="text"
              value={pan}
              onChange={(event) => setPan(event.target.value.toUpperCase())}
              placeholder="AECPS1234C"
              maxLength={10}
              autoFocus
              required
              aria-label="PAN"
            />
            <span className="field-cap-hint">{panHint}</span>
          </div>

          <div className="field new-vendor-field">
            <span className="field-cap">GSTIN</span>
            <input
              className={gstin.length > 0 && !gstinOk ? "input mono error" : "input mono"}
              type="text"
              value={gstin}
              onChange={(event) => setGstin(event.target.value.toUpperCase())}
              placeholder="33AECPS1234C1Z5"
              maxLength={15}
              aria-label="GSTIN"
            />
            <span className="field-cap-hint">{gstinHint}</span>
          </div>

          <div className="field new-vendor-field">
            <span className="field-cap">Vendor name</span>
            <input
              className="input"
              type="text"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Vendor legal name"
              required
              aria-label="Vendor name"
            />
            <span className="field-cap-hint">As it should appear in Tally Party Ledger</span>
          </div>

          <div className="new-vendor-row">
            <div className="field new-vendor-field">
              <span className="field-cap">Default TDS section</span>
              <select
                className="input"
                value={defaultTdsSection}
                onChange={(event) => setDefaultTdsSection(event.target.value)}
                aria-label="Default TDS section"
              >
                {TDS_SECTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field new-vendor-field new-vendor-msme-field">
              <span className="field-cap">MSME</span>
              <label className="new-vendor-msme-check">
                <input
                  type="checkbox"
                  checked={isMsme}
                  onChange={(event) => setIsMsme(event.target.checked)}
                />
                <span>Registered MSME · 45-day clock</span>
              </label>
            </div>
          </div>

          <div className="new-vendor-info">
            <span className="material-symbols-outlined new-vendor-info-icon">info</span>
            Bank details, address and TDS lower-deduction certificates can be added later from the vendor&apos;s detail panel.
          </div>

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
