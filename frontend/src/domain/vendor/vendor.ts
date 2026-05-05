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
  msme: VendorMsmeSummary | null;
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
  tallyLedgerName: string | null;
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
