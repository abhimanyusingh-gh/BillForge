import { Badge, type BadgeTone } from "@/components/ds/Badge";
import { VENDOR_STATUS, type VendorListItemSummary, type VendorStatus } from "@/types/vendor";

const STATUS_TONE: Record<VendorStatus, BadgeTone> = {
  [VENDOR_STATUS.ACTIVE]: "success",
  [VENDOR_STATUS.INACTIVE]: "neutral",
  [VENDOR_STATUS.BLOCKED]: "danger",
  [VENDOR_STATUS.MERGED]: "info"
};

const STATUS_ICON: Record<VendorStatus, string> = {
  [VENDOR_STATUS.ACTIVE]: "check_circle",
  [VENDOR_STATUS.INACTIVE]: "pause_circle",
  [VENDOR_STATUS.BLOCKED]: "block",
  [VENDOR_STATUS.MERGED]: "merge"
};

const STATUS_LABEL: Record<VendorStatus, string> = {
  [VENDOR_STATUS.ACTIVE]: "Active",
  [VENDOR_STATUS.INACTIVE]: "Inactive",
  [VENDOR_STATUS.BLOCKED]: "Blocked",
  [VENDOR_STATUS.MERGED]: "Merged"
};

function VendorStatusBadge({ status }: { status: VendorStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} size="sm" icon={STATUS_ICON[status]} title={STATUS_LABEL[status]}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

interface VendorRowProps {
  vendor: VendorListItemSummary;
  onView: (vendor: VendorListItemSummary) => void;
  onMerge: (vendor: VendorListItemSummary) => void;
}

const RUPEE = "₹";

function formatRupeesMinor(minor: number | null): string {
  if (minor === null || !Number.isFinite(minor)) return "—";
  const rupees = minor / 100;
  return `${RUPEE}${rupees.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "2-digit" });
}

export function VendorRow({ vendor, onView, onMerge }: VendorRowProps) {
  return (
    <div className="vendor" data-testid="vendors-row" data-vendor-id={vendor._id}>
      <div className="vendor-cell vendor-cell-name">
        <span className="vendor-name-row">
          <span className="vendor-name">{vendor.name}</span>
          {vendor.msme ? (
            <span
              className="spill s-pending"
              title={`MSME: ${vendor.msme.classification}`}
              data-testid="vendors-row-msme"
            >
              MSME
            </span>
          ) : null}
        </span>
        <span className="lb-caption">
          {vendor.gstin ? (
            <span className="mono-cell">GSTIN {vendor.gstin}</span>
          ) : null}
          {vendor.pan ? (
            <span className="mono-cell">PAN {vendor.pan}</span>
          ) : null}
        </span>
      </div>
      <div className="vendor-cell vendor-cell-status">
        <VendorStatusBadge status={vendor.vendorStatus} />
        {vendor.section197Cert ? (
          <Badge tone="info" size="sm" icon="badge" title="Section 197 certificate on file">
            §197
          </Badge>
        ) : null}
      </div>
      <div className="vendor-cell num-cell">{formatDate(vendor.lastInvoiceDate)}</div>
      <div className="vendor-cell num-cell">{formatRupeesMinor(vendor.fytdSpendMinor)}</div>
      <div className="vendor-cell num-cell">{formatRupeesMinor(vendor.fytdTdsMinor)}</div>
      <div className="vendor-cell vendor-cell-actions">
        <button
          type="button"
          className="btn ghost"
          onClick={() => onView(vendor)}
          data-testid="vendors-row-view"
        >
          View
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => onMerge(vendor)}
          data-testid="vendors-row-merge"
        >
          Merge
        </button>
      </div>
    </div>
  );
}
