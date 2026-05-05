export type VendorId = string & { readonly __brand: "VendorId" };

export function asVendorId(value: string): VendorId {
  return value as VendorId;
}

export const VENDOR_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  BLOCKED: "blocked",
  MERGED: "merged"
} as const;

export type VendorStatus = (typeof VENDOR_STATUS)[keyof typeof VENDOR_STATUS];

export const VENDOR_STATUS_VALUES: readonly VendorStatus[] = Object.values(VENDOR_STATUS);

export const MSME_CLASSIFICATION = {
  MICRO: "micro",
  SMALL: "small",
  MEDIUM: "medium"
} as const;

export type MsmeClassification = (typeof MSME_CLASSIFICATION)[keyof typeof MSME_CLASSIFICATION];

export interface VendorMsmeSummary {
  classification: MsmeClassification;
  agreedPaymentDays: number | null;
}

export const TALLY_STATE = {
  SYNCED: "synced",
  DRIFT: "drift",
  PENDING: "pending",
  NOT_IN_TALLY: "not_in_tally"
} as const;

export type TallyState = (typeof TALLY_STATE)[keyof typeof TALLY_STATE];

export const TDS_SECTION_OPTIONS: ReadonlyArray<{ readonly value: string; readonly label: string }> = [
  { value: "194C", label: "194C — Contractor (1% / 2%)" },
  { value: "194J", label: "194J — Professional (10%)" },
  { value: "194Q", label: "194Q — Goods purchase (0.1%)" },
  { value: "194I", label: "194I — Rent (10%)" },
  { value: "206AA", label: "206AA — No PAN (20%)" }
];

export interface VendorSummary {
  id: VendorId;
  name: string;
  pan: string | null;
  gstin: string | null;
  defaultGlCode: string | null;
  defaultTdsSection: string | null;
  invoiceCount: number;
  lastInvoiceDate: string | null;
  vendorStatus: VendorStatus;
  tallyLedgerName: string | null;
  tallyLedgerGuid: string | null;
  msme: VendorMsmeSummary | null;
}

export function deriveTallyState(summary: Pick<VendorSummary, "tallyLedgerGuid" | "tallyLedgerName">): TallyState {
  if (summary.tallyLedgerGuid !== null && summary.tallyLedgerGuid.length > 0) return TALLY_STATE.SYNCED;
  if (summary.tallyLedgerName !== null && summary.tallyLedgerName.length > 0) return TALLY_STATE.PENDING;
  return TALLY_STATE.NOT_IN_TALLY;
}

export interface Section197Cert {
  certificateNumber: string;
  validFrom: string;
  validTo: string;
  maxAmountMinor: number;
  applicableRateBps: number;
}

export interface VendorDetail extends VendorSummary {
  defaultCostCenter: string | null;
  tallyLedgerGroup: string | null;
  deducteeType: string | null;
  stateCode: string | null;
  stateName: string | null;
  section197Cert: Section197Cert | null;
}

export interface VendorEditableFields {
  name?: string;
  pan?: string | null;
  gstin?: string | null;
  defaultGlCode?: string | null;
  defaultCostCenter?: string | null;
  defaultTdsSection?: string | null;
  tallyLedgerName?: string | null;
  tallyLedgerGroup?: string;
  vendorStatus?: VendorStatus;
  deducteeType?: string | null;
  stateCode?: string | null;
  stateName?: string | null;
}

export interface VendorListPage {
  items: VendorSummary[];
  page: number;
  limit: number;
  total: number;
}

export interface VendorListFilters {
  search?: string;
  hasPan?: boolean;
  hasMsme?: boolean;
  status?: VendorStatus;
  page?: number;
  limit?: number;
}
