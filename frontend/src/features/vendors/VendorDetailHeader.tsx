import { Badge, type BadgeTone } from "@/components/ds/Badge";
import { VENDOR_STATUS, type VendorDetail, type VendorStatus } from "@/types/vendor";

interface VendorDetailHeaderProps {
  vendor: VendorDetail;
  onBack: () => void;
  onMerge: () => void;
}

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

export function VendorDetailHeader({ vendor, onBack, onMerge }: VendorDetailHeaderProps) {
  return (
    <header className="vendor-detail-header" data-testid="vendor-detail-header">
      <div className="vendor-detail-header-row">
        <button
          type="button"
          className="app-button app-button-secondary"
          onClick={onBack}
          data-testid="vendor-detail-back"
        >
          Back to vendors
        </button>
        <button
          type="button"
          className="app-button app-button-secondary"
          onClick={onMerge}
          data-testid="vendor-detail-merge"
        >
          Merge vendor
        </button>
      </div>
      <div className="vendor-detail-header-titles">
        <h2 className="vendor-detail-name">{vendor.name}</h2>
        <span data-testid="vendor-detail-status">
          <Badge
            tone={STATUS_TONE[vendor.vendorStatus]}
            size="sm"
            icon={STATUS_ICON[vendor.vendorStatus]}
            title={STATUS_LABEL[vendor.vendorStatus]}
          >
            {STATUS_LABEL[vendor.vendorStatus]}
          </Badge>
        </span>
        {vendor.msme?.classification ? (
          <span data-testid="vendor-detail-msme">
            <Badge tone="accent" size="sm" icon="verified" title={`MSME: ${vendor.msme.classification}`}>
              MSME · {vendor.msme.classification}
            </Badge>
          </span>
        ) : null}
        {vendor.lowerDeductionCert ? (
          <span data-testid="vendor-detail-cert197-flag">
            <Badge tone="info" size="sm" icon="badge" title="Section 197 certificate on file">
              §197
            </Badge>
          </span>
        ) : null}
      </div>
      <dl className="vendor-detail-meta">
        <VendorMetaItem label="GSTIN" value={vendor.gstin} mono testId="vendor-detail-gstin" />
        <VendorMetaItem label="PAN" value={vendor.pan} mono testId="vendor-detail-pan" />
        <VendorMetaItem label="State" value={vendor.stateName} testId="vendor-detail-state" />
        <VendorMetaItem
          label="Tally ledger"
          value={vendor.tallyLedgerName}
          testId="vendor-detail-tally-ledger"
        />
      </dl>
    </header>
  );
}

interface VendorMetaItemProps {
  label: string;
  value: string | null;
  testId: string;
  mono?: boolean;
}

function VendorMetaItem({ label, value, testId, mono = false }: VendorMetaItemProps) {
  const ddClass = mono ? "lb-mono" : undefined;
  return (
    <div className="vendor-detail-meta-item">
      <dt>{label}</dt>
      <dd className={ddClass} data-testid={testId}>{value ?? "—"}</dd>
    </div>
  );
}
