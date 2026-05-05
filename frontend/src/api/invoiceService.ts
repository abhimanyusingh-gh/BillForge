import { apiClient } from "@/api/client";
import { urls } from "@/api/urlBuilder";
import {
  asInvoiceId,
  INVOICE_STATUS,
  type Invoice,
  type InvoiceId,
  type InvoiceListFilters,
  type InvoiceListResponse,
  type InvoiceParsedFields,
  type InvoiceRiskSignal,
  type InvoiceStatus,
  type InvoiceTimelineEntry
} from "@/domain/invoice/invoice";
import type { ClientOrgId, TenantId } from "@/types/ids";

interface RawParsed {
  vendor?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  vendorGstin?: string | null;
  vendorPan?: string | null;
  hsn?: string | null;
  irn?: string | null;
  totalAmount?: number | null;
  taxAmount?: number | null;
  netAmount?: number | null;
}

interface RawCompliance {
  glCode?: { code?: string | null; name?: string | null } | null;
  tds?: { section?: string | null; amount?: number | null } | null;
  tcs?: { amount?: number | null } | null;
  riskSignals?: Array<{
    code?: string;
    severity?: string;
    message?: string;
    status?: string;
  }>;
}

interface RawWorkflowState {
  currentStep?: number | null;
  totalSteps?: number | null;
}

interface RawTimelineEntry {
  step?: string;
  occurredAt?: string | null;
  actor?: string | null;
  state?: string;
}

interface RawInvoice {
  _id?: string;
  status?: string;
  vendor?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  receivedAt?: string | null;
  total?: number | null;
  tdsAmount?: number | null;
  netAmount?: number | null;
  confidence?: number | null;
  fileName?: string | null;
  parsed?: RawParsed;
  compliance?: RawCompliance;
  workflowState?: RawWorkflowState;
  timeline?: RawTimelineEntry[];
  costCenter?: string | null;
}

interface RawListResponse {
  items?: RawInvoice[];
  total?: number;
  page?: number;
  limit?: number;
}

const STATUS_VALUES = new Set<string>(Object.values(INVOICE_STATUS));

function toStatus(raw: string | undefined): InvoiceStatus {
  if (raw && STATUS_VALUES.has(raw)) return raw as InvoiceStatus;
  return INVOICE_STATUS.PENDING;
}

function toRiskSeverity(raw: string | undefined): "critical" | "warning" | "info" {
  if (raw === "critical" || raw === "warning" || raw === "info") return raw;
  return "info";
}

function toTimelineState(raw: string | undefined): "done" | "current" | "pending" {
  if (raw === "done" || raw === "current" || raw === "pending") return raw;
  return "pending";
}

function toParsed(raw: RawInvoice): InvoiceParsedFields {
  const p = raw.parsed ?? {};
  const c = raw.compliance ?? {};
  return {
    vendor: p.vendor ?? raw.vendor ?? null,
    invoiceNumber: p.invoiceNumber ?? raw.invoiceNumber ?? null,
    invoiceDate: p.invoiceDate ?? raw.invoiceDate ?? null,
    gstin: p.vendorGstin ?? null,
    pan: p.vendorPan ?? null,
    hsn: p.hsn ?? null,
    irn: p.irn ?? null,
    totalAmount: p.totalAmount ?? raw.total ?? null,
    taxAmount: p.taxAmount ?? null,
    netAmount: p.netAmount ?? raw.netAmount ?? null,
    tdsSection: c.tds?.section ?? null,
    tdsAmount: c.tds?.amount ?? raw.tdsAmount ?? null,
    tcsAmount: c.tcs?.amount ?? null,
    glCode: c.glCode?.code ?? null,
    glName: c.glCode?.name ?? null,
    costCenter: raw.costCenter ?? null
  };
}

function toRiskSignals(raw: RawInvoice): InvoiceRiskSignal[] {
  const signals = raw.compliance?.riskSignals ?? [];
  return signals.map((s) => ({
    code: typeof s.code === "string" ? s.code : "",
    severity: toRiskSeverity(s.severity),
    message: typeof s.message === "string" ? s.message : "",
    status: typeof s.status === "string" ? s.status : "open"
  }));
}

function toTimeline(raw: RawInvoice): InvoiceTimelineEntry[] {
  const entries = raw.timeline ?? [];
  return entries.map((e) => ({
    step: typeof e.step === "string" ? e.step : "",
    occurredAt: e.occurredAt ?? null,
    actor: e.actor ?? null,
    state: toTimelineState(e.state)
  }));
}

function toInvoice(raw: RawInvoice): Invoice | null {
  if (typeof raw._id !== "string" || raw._id.length === 0) return null;
  return {
    id: asInvoiceId(raw._id),
    status: toStatus(raw.status),
    vendor: raw.vendor ?? raw.parsed?.vendor ?? "Unknown vendor",
    invoiceNumber: raw.invoiceNumber ?? raw.parsed?.invoiceNumber ?? "—",
    invoiceDate: raw.invoiceDate ?? raw.parsed?.invoiceDate ?? null,
    receivedAt: raw.receivedAt ?? null,
    totalAmount: raw.total ?? raw.parsed?.totalAmount ?? null,
    tdsAmount: raw.tdsAmount ?? raw.compliance?.tds?.amount ?? null,
    netAmount: raw.netAmount ?? raw.parsed?.netAmount ?? null,
    confidence: typeof raw.confidence === "number" ? raw.confidence : null,
    fileName: raw.fileName ?? null,
    parsed: toParsed(raw),
    riskSignals: toRiskSignals(raw),
    timeline: toTimeline(raw),
    workflowStep: raw.workflowState?.currentStep ?? null,
    workflowTotalSteps: raw.workflowState?.totalSteps ?? null
  };
}

function buildListQuery(filters: InvoiceListFilters | undefined): {
  page?: number;
  limit?: number;
  status?: string;
  from?: string;
  to?: string;
  sortBy?: string;
  sortDir?: string;
} {
  if (!filters) return {};
  const query: Record<string, string | number | undefined> = {
    page: filters.page,
    limit: filters.limit,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
    from: filters.fromDate,
    to: filters.toDate
  };
  if (filters.status && filters.status !== "all") query.status = filters.status;
  return query as ReturnType<typeof buildListQuery>;
}

async function listInvoices(
  tenantId: TenantId,
  clientOrgId: ClientOrgId,
  filters?: InvoiceListFilters,
  signal?: AbortSignal
): Promise<InvoiceListResponse> {
  const response = await apiClient.get<RawListResponse>(
    urls.tenant(tenantId).clientOrg(clientOrgId).invoices.list(buildListQuery(filters)),
    { signal }
  );
  const rawItems = Array.isArray(response?.items) ? response.items : [];
  const items = rawItems.flatMap((raw) => {
    const mapped = toInvoice(raw);
    return mapped ? [mapped] : [];
  });
  return {
    items,
    total: typeof response?.total === "number" ? response.total : items.length,
    page: typeof response?.page === "number" ? response.page : 1,
    limit: typeof response?.limit === "number" ? response.limit : items.length
  };
}

async function getInvoice(
  tenantId: TenantId,
  clientOrgId: ClientOrgId,
  invoiceId: InvoiceId,
  signal?: AbortSignal
): Promise<Invoice | null> {
  const raw = await apiClient.get<RawInvoice>(
    urls.tenant(tenantId).clientOrg(clientOrgId).invoices.byId(invoiceId),
    { signal }
  );
  return raw ? toInvoice(raw) : null;
}

export interface UpdateInvoicePayload {
  parsed?: Partial<InvoiceParsedFields>;
  glCode?: string;
  glName?: string;
  tdsSection?: string;
  attachmentName?: string;
  vendorBankVerified?: boolean;
  dismissRiskSignal?: string;
}

async function updateInvoice(
  tenantId: TenantId,
  clientOrgId: ClientOrgId,
  invoiceId: InvoiceId,
  payload: UpdateInvoicePayload
): Promise<Invoice | null> {
  const raw = await apiClient.patch<RawInvoice>(
    urls.tenant(tenantId).clientOrg(clientOrgId).invoices.edit(invoiceId),
    payload
  );
  return raw ? toInvoice(raw) : null;
}

async function approveInvoices(
  tenantId: TenantId,
  clientOrgId: ClientOrgId,
  ids: InvoiceId[]
): Promise<{ modifiedCount: number }> {
  return apiClient.post<{ modifiedCount: number }>(
    urls.tenant(tenantId).clientOrg(clientOrgId).invoices.approveBulk(),
    { ids }
  );
}

async function retryInvoices(
  tenantId: TenantId,
  clientOrgId: ClientOrgId,
  ids: InvoiceId[]
): Promise<{ modifiedCount: number }> {
  return apiClient.post<{ modifiedCount: number }>(
    urls.tenant(tenantId).clientOrg(clientOrgId).invoices.retry(),
    { ids }
  );
}

async function deleteInvoices(
  tenantId: TenantId,
  clientOrgId: ClientOrgId,
  ids: InvoiceId[]
): Promise<{ deletedCount: number }> {
  return apiClient.post<{ deletedCount: number }>(
    urls.tenant(tenantId).clientOrg(clientOrgId).invoices.bulkDelete(),
    { ids }
  );
}

async function workflowApprove(
  tenantId: TenantId,
  clientOrgId: ClientOrgId,
  invoiceId: InvoiceId,
  comment?: string
): Promise<void> {
  await apiClient.post(
    urls.tenant(tenantId).clientOrg(clientOrgId).invoices.workflowApprove(invoiceId),
    comment ? { comment } : {}
  );
}

async function workflowReject(
  tenantId: TenantId,
  clientOrgId: ClientOrgId,
  invoiceId: InvoiceId,
  reason: string
): Promise<void> {
  await apiClient.post(
    urls.tenant(tenantId).clientOrg(clientOrgId).invoices.workflowReject(invoiceId),
    { reason }
  );
}

async function retriggerCompliance(
  tenantId: TenantId,
  clientOrgId: ClientOrgId,
  invoiceId: InvoiceId,
  glCode: string,
  glName: string
): Promise<void> {
  await apiClient.post(
    urls.tenant(tenantId).clientOrg(clientOrgId).invoices.retriggerCompliance(invoiceId),
    { glCode, glName }
  );
}

function previewUrl(
  tenantId: TenantId,
  clientOrgId: ClientOrgId,
  invoiceId: InvoiceId,
  page?: number
): string {
  return urls.tenant(tenantId).clientOrg(clientOrgId).invoices.preview(invoiceId, page ? { page } : undefined);
}

export const invoiceService = {
  listInvoices,
  getInvoice,
  updateInvoice,
  approveInvoices,
  retryInvoices,
  deleteInvoices,
  workflowApprove,
  workflowReject,
  retriggerCompliance,
  previewUrl
};
