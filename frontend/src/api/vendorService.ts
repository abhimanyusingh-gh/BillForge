import { ApiError, apiClient } from "@/api/client";
import { urls } from "@/api/urlBuilder";
import {
  asVendorId,
  type Section197Cert,
  type VendorDetail,
  type VendorEditableFields,
  type VendorId,
  type VendorListFilters,
  type VendorListPage,
  type VendorMsmeSummary,
  type VendorStatus,
  type VendorSummary
} from "@/domain/vendor/vendor";
import type { ClientOrgId, TenantId } from "@/types/ids";

interface RawMsme {
  classification?: string | null;
  agreedPaymentDays?: number | null;
}

interface RawVendorSummary {
  _id?: string;
  name?: string | null;
  pan?: string | null;
  gstin?: string | null;
  defaultGlCode?: string | null;
  defaultTdsSection?: string | null;
  invoiceCount?: number | null;
  lastInvoiceDate?: string | null;
  vendorStatus?: string | null;
  msme?: RawMsme | null;
}

interface RawListResponse {
  items?: RawVendorSummary[];
  page?: number;
  limit?: number;
  total?: number;
}

interface RawSection197Cert {
  certificateNumber?: string;
  validFrom?: string;
  validTo?: string;
  maxAmountMinor?: number;
  applicableRateBps?: number;
}

interface RawVendorDetail extends RawVendorSummary {
  defaultCostCenter?: string | null;
  tallyLedgerName?: string | null;
  tallyLedgerGroup?: string | null;
  deducteeType?: string | null;
  stateCode?: string | null;
  stateName?: string | null;
  section197Cert?: RawSection197Cert | null;
}

export interface CreateVendorInput {
  companyName: string;
  gstin: string;
  legalName?: string;
  stateName?: string;
  msmeCategory?: string;
  panNumber?: string;
}

interface RawCreateResponse {
  vendor?: RawVendorDetail;
}

interface RawDuplicateBody {
  message?: string;
  vendor?: RawVendorDetail;
}

export class DuplicateVendorError extends Error {
  readonly existingVendor: VendorDetail | null;

  constructor(message: string, existingVendor: VendorDetail | null) {
    super(message);
    this.name = "DuplicateVendorError";
    this.existingVendor = existingVendor;
  }
}

interface MergeRequest {
  sourceVendorId: VendorId;
}

interface MergeResponse {
  targetVendorId: string;
  sourceVendorId: string;
  ledgersConsolidated: number;
  invoicesRepointed: number;
}

function toMsme(raw: RawMsme | null | undefined): VendorMsmeSummary | null {
  if (!raw || typeof raw.classification !== "string") return null;
  if (raw.classification !== "micro" && raw.classification !== "small" && raw.classification !== "medium") return null;
  return {
    classification: raw.classification,
    agreedPaymentDays: typeof raw.agreedPaymentDays === "number" ? raw.agreedPaymentDays : null
  };
}

function toStatus(raw: string | null | undefined): VendorStatus {
  if (raw === "active" || raw === "inactive" || raw === "blocked" || raw === "merged") return raw;
  return "active";
}

function toSummary(raw: RawVendorSummary): VendorSummary | null {
  if (typeof raw._id !== "string" || raw._id.length === 0) return null;
  return {
    id: asVendorId(raw._id),
    name: typeof raw.name === "string" && raw.name.length > 0 ? raw.name : "(unnamed vendor)",
    pan: typeof raw.pan === "string" && raw.pan.length > 0 ? raw.pan : null,
    gstin: typeof raw.gstin === "string" && raw.gstin.length > 0 ? raw.gstin : null,
    defaultGlCode: typeof raw.defaultGlCode === "string" ? raw.defaultGlCode : null,
    defaultTdsSection: typeof raw.defaultTdsSection === "string" ? raw.defaultTdsSection : null,
    invoiceCount: typeof raw.invoiceCount === "number" ? raw.invoiceCount : 0,
    lastInvoiceDate: typeof raw.lastInvoiceDate === "string" ? raw.lastInvoiceDate : null,
    vendorStatus: toStatus(raw.vendorStatus),
    msme: toMsme(raw.msme)
  };
}

function toCert(raw: RawSection197Cert | null | undefined): Section197Cert | null {
  if (!raw || typeof raw.certificateNumber !== "string" || raw.certificateNumber.length === 0) return null;
  if (typeof raw.validFrom !== "string" || typeof raw.validTo !== "string") return null;
  if (typeof raw.maxAmountMinor !== "number" || typeof raw.applicableRateBps !== "number") return null;
  return {
    certificateNumber: raw.certificateNumber,
    validFrom: raw.validFrom,
    validTo: raw.validTo,
    maxAmountMinor: raw.maxAmountMinor,
    applicableRateBps: raw.applicableRateBps
  };
}

function toDetail(raw: RawVendorDetail): VendorDetail | null {
  const summary = toSummary(raw);
  if (summary === null) return null;
  return {
    ...summary,
    defaultCostCenter: typeof raw.defaultCostCenter === "string" ? raw.defaultCostCenter : null,
    tallyLedgerName: typeof raw.tallyLedgerName === "string" ? raw.tallyLedgerName : null,
    tallyLedgerGroup: typeof raw.tallyLedgerGroup === "string" ? raw.tallyLedgerGroup : null,
    deducteeType: typeof raw.deducteeType === "string" ? raw.deducteeType : null,
    stateCode: typeof raw.stateCode === "string" ? raw.stateCode : null,
    stateName: typeof raw.stateName === "string" ? raw.stateName : null,
    section197Cert: toCert(raw.section197Cert)
  };
}

function buildListQuery(filters?: VendorListFilters) {
  if (!filters) return undefined;
  const out: Record<string, string | number | boolean | undefined> = {};
  if (filters.search && filters.search.length > 0) out.search = filters.search;
  if (filters.hasPan !== undefined) out.hasPan = filters.hasPan;
  if (filters.hasMsme !== undefined) out.hasMsme = filters.hasMsme;
  if (filters.status) out.status = filters.status;
  if (filters.page) out.page = filters.page;
  if (filters.limit) out.limit = filters.limit;
  return out;
}

async function listVendors(
  tenantId: TenantId,
  clientOrgId: ClientOrgId,
  filters?: VendorListFilters,
  signal?: AbortSignal
): Promise<VendorListPage> {
  const url = urls.tenant(tenantId).clientOrg(clientOrgId).vendors.list(buildListQuery(filters));
  const response = await apiClient.get<RawListResponse>(url, { signal });
  const rawItems = Array.isArray(response?.items) ? response.items : [];
  const items = rawItems.flatMap((r) => {
    const mapped = toSummary(r);
    return mapped ? [mapped] : [];
  });
  return {
    items,
    page: typeof response?.page === "number" ? response.page : 1,
    limit: typeof response?.limit === "number" ? response.limit : items.length,
    total: typeof response?.total === "number" ? response.total : items.length
  };
}

async function getVendor(
  tenantId: TenantId,
  clientOrgId: ClientOrgId,
  vendorId: VendorId,
  signal?: AbortSignal
): Promise<VendorDetail | null> {
  const url = urls.tenant(tenantId).clientOrg(clientOrgId).vendors.byId(vendorId);
  const response = await apiClient.get<RawVendorDetail>(url, { signal });
  return toDetail(response);
}

async function editVendor(
  tenantId: TenantId,
  clientOrgId: ClientOrgId,
  vendorId: VendorId,
  fields: VendorEditableFields
): Promise<VendorDetail | null> {
  const url = urls.tenant(tenantId).clientOrg(clientOrgId).vendors.edit(vendorId);
  const response = await apiClient.patch<RawVendorDetail>(url, fields);
  return toDetail(response);
}

async function setVendorSection197Cert(
  tenantId: TenantId,
  clientOrgId: ClientOrgId,
  vendorId: VendorId,
  cert: Section197Cert
): Promise<VendorDetail | null> {
  const url = urls.tenant(tenantId).clientOrg(clientOrgId).vendors.cert(vendorId);
  const response = await apiClient.post<RawVendorDetail>(url, cert);
  return toDetail(response);
}

async function createVendor(
  tenantId: TenantId,
  clientOrgId: ClientOrgId,
  input: CreateVendorInput
): Promise<VendorDetail> {
  const url = urls.tenant(tenantId).clientOrg(clientOrgId).vendors.create();
  try {
    const response = await apiClient.post<RawCreateResponse>(url, input);
    const detail = response?.vendor ? toDetail(response.vendor) : null;
    if (detail === null) throw new Error("Vendor service returned no vendor payload.");
    return detail;
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 409) {
      const body = (caught.body ?? {}) as RawDuplicateBody;
      const existing = body.vendor ? toDetail(body.vendor) : null;
      throw new DuplicateVendorError(
        typeof body.message === "string" && body.message.length > 0
          ? body.message
          : "Vendor with this GSTIN already exists for this client.",
        existing
      );
    }
    throw caught;
  }
}

async function mergeVendors(
  tenantId: TenantId,
  clientOrgId: ClientOrgId,
  targetVendorId: VendorId,
  request: MergeRequest
): Promise<MergeResponse> {
  const url = urls.tenant(tenantId).clientOrg(clientOrgId).vendors.merge(targetVendorId);
  return apiClient.post<MergeResponse>(url, request);
}

export const vendorService = {
  listVendors,
  getVendor,
  editVendor,
  setVendorSection197Cert,
  mergeVendors,
  createVendor
};

export type { MergeResponse };
