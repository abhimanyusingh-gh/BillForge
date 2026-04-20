import type { Invoice } from "@/types";
import { CollapsibleSectionHeader } from "@/features/tenant-admin/CollapsibleSectionHeader";
import { isValidGstinFormat, isValidPanFormat, doesPanMatchGstin } from "@/lib/invoice/taxIdValidation";

interface VendorCustomerDetailsProps {
  invoice: Invoice;
  vendorDetailsExpanded: boolean;
  onToggleVendorDetails: () => void;
  customerDetailsExpanded: boolean;
  onToggleCustomerDetails: () => void;
  tenantGstin?: string | null;
}

function GstinBadge({ value }: { value: string | null | undefined }) {
  if (!value) return null;
  const valid = isValidGstinFormat(value);
  return (
    <span
      className={valid ? "tax-id-badge tax-id-valid" : "tax-id-badge tax-id-invalid"}
      title={valid ? "Valid GSTIN format" : "Invalid GSTIN format"}
    >
      {valid ? "Valid" : "Invalid format"}
    </span>
  );
}

function PanBadge({ pan, gstin }: { pan: string | null | undefined; gstin: string | null | undefined }) {
  if (!pan) return null;
  const formatValid = isValidPanFormat(pan);
  if (!formatValid) {
    return (
      <span className="tax-id-badge tax-id-invalid" title="Invalid PAN format">
        Invalid format
      </span>
    );
  }
  const crossChecked = doesPanMatchGstin(pan, gstin);
  return (
    <span
      className={crossChecked ? "tax-id-badge tax-id-cross-checked" : "tax-id-badge tax-id-valid"}
      title={crossChecked ? "PAN matches GSTIN (cross-checked)" : "Valid PAN format"}
    >
      {crossChecked ? "GSTIN cross-checked" : "Format valid"}
    </span>
  );
}

function NotExtractedLabel() {
  return <span className="muted" style={{ fontSize: "0.85rem" }}>Not extracted</span>;
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="vendor-customer-field">
      <span className="vendor-customer-field-label">{label}</span>
      <div className="vendor-customer-field-value">{children}</div>
    </div>
  );
}

export function VendorCustomerDetails({
  invoice,
  vendorDetailsExpanded,
  onToggleVendorDetails,
  customerDetailsExpanded,
  onToggleCustomerDetails,
  tenantGstin
}: VendorCustomerDetailsProps) {
  const parsed = invoice.parsed;
  const vendorName = parsed?.vendorName;
  const vendorAddress = parsed?.vendorAddress;
  const vendorGstin = parsed?.vendorGstin;
  const vendorPan = parsed?.vendorPan;

  const customerName = parsed?.customerName;
  const customerAddress = parsed?.customerAddress;
  const customerGstin = parsed?.customerGstin;

  const hasAnyVendorField = !!(vendorAddress || vendorGstin || vendorPan);
  const hasAnyCustomerField = !!(customerName || customerAddress || customerGstin);

  const customerGstinMatchesTenant = !!(
    tenantGstin &&
    customerGstin &&
    tenantGstin.trim().toUpperCase() === customerGstin.trim().toUpperCase()
  );

  return (
    <>
      <div className="vendor-customer-section">
        <CollapsibleSectionHeader
          label="Vendor Details"
          expanded={vendorDetailsExpanded}
          onToggle={onToggleVendorDetails}
        />
        {vendorDetailsExpanded && (
          <div className="vendor-customer-body">
            {vendorName && (
              <FieldRow label="Vendor Name">
                <span className="muted" style={{ fontSize: "0.85rem" }}>Shown in key fields above</span>
              </FieldRow>
            )}
            <FieldRow label="PAN">
              {vendorPan ? (
                <span className="vendor-customer-field-inline">
                  <span>{vendorPan}</span>
                  <PanBadge pan={vendorPan} gstin={vendorGstin} />
                </span>
              ) : (
                <NotExtractedLabel />
              )}
            </FieldRow>
            <FieldRow label="GSTIN">
              {vendorGstin ? (
                <span className="vendor-customer-field-inline">
                  <span>{vendorGstin}</span>
                  <GstinBadge value={vendorGstin} />
                </span>
              ) : (
                <NotExtractedLabel />
              )}
            </FieldRow>
            <FieldRow label="Address">
              {vendorAddress ? (
                <span style={{ whiteSpace: "pre-line", fontSize: "0.85rem" }}>{vendorAddress}</span>
              ) : (
                <NotExtractedLabel />
              )}
            </FieldRow>
            {!hasAnyVendorField && !vendorName && (
              <NotExtractedLabel />
            )}
          </div>
        )}
      </div>

      <div className="vendor-customer-section">
        <CollapsibleSectionHeader
          label="Customer Details"
          expanded={customerDetailsExpanded}
          onToggle={onToggleCustomerDetails}
        />
        {customerDetailsExpanded && (
          <div className="vendor-customer-body">
            <FieldRow label="Name">
              {customerName ? (
                <span style={{ fontSize: "0.85rem" }}>{customerName}</span>
              ) : (
                <NotExtractedLabel />
              )}
            </FieldRow>
            <FieldRow label="GSTIN">
              {customerGstin ? (
                <span className="vendor-customer-field-inline">
                  <span>{customerGstin}</span>
                  <GstinBadge value={customerGstin} />
                  {customerGstinMatchesTenant && (
                    <span className="tax-id-badge tax-id-tenant-match" title="Customer GSTIN matches your tenant GSTIN">
                      Matches tenant GSTIN
                    </span>
                  )}
                </span>
              ) : (
                <NotExtractedLabel />
              )}
            </FieldRow>
            <FieldRow label="Address">
              {customerAddress ? (
                <span style={{ whiteSpace: "pre-line", fontSize: "0.85rem" }}>{customerAddress}</span>
              ) : (
                <NotExtractedLabel />
              )}
            </FieldRow>
            {!hasAnyCustomerField && (
              <NotExtractedLabel />
            )}
          </div>
        )}
      </div>
    </>
  );
}
