import type { Types } from "mongoose";
import { ClientComplianceConfigModel, type ClientComplianceConfigFields } from "@/models/integration/ClientComplianceConfig.js";
import type { UUID } from "@/types/uuid.js";

export async function resolveTenantComplianceConfig(
  tenantId: UUID,
  clientOrgId: Types.ObjectId
): Promise<ClientComplianceConfigFields | null> {
  try {
    const doc = await ClientComplianceConfigModel.findOne({ tenantId, clientOrgId }).lean();
    if (!doc) return null;
    return doc as unknown as ClientComplianceConfigFields;
  } catch {
    return null;
  }
}

interface FreemailConfig {
  additionalFreemailDomains?: string[];
}

export async function resolveFreemailConfig(
  tenantId: string,
  clientOrgId: Types.ObjectId
): Promise<FreemailConfig | null> {
  const doc = await ClientComplianceConfigModel.findOne({ tenantId, clientOrgId })
    .select({ additionalFreemailDomains: 1 })
    .lean();
  if (!doc) return null;
  return doc as unknown as FreemailConfig;
}

interface LearningModeConfig {
  learningMode?: "active" | "assistive";
}

export async function resolveLearningModeConfig(
  tenantId: string,
  clientOrgId: Types.ObjectId
): Promise<LearningModeConfig | null> {
  const doc = await ClientComplianceConfigModel.findOne({ tenantId, clientOrgId })
    .select({ learningMode: 1 })
    .lean();
  if (!doc) return null;
  return doc as unknown as LearningModeConfig;
}

interface DefaultCurrencyConfig {
  defaultCurrency?: string;
}

export async function resolveDefaultCurrencyConfig(
  tenantId: string,
  clientOrgId: Types.ObjectId | undefined
): Promise<DefaultCurrencyConfig | null> {
  if (!clientOrgId) return null;
  const doc = await ClientComplianceConfigModel.findOne({ tenantId, clientOrgId })
    .select({ defaultCurrency: 1 })
    .lean();
  if (!doc) return null;
  return doc as unknown as DefaultCurrencyConfig;
}

interface TdsRatesConfig {
  tdsRates?: ClientComplianceConfigFields["tdsRates"];
}

export async function resolveTdsRatesConfig(
  tenantId: string,
  clientOrgId: Types.ObjectId
): Promise<TdsRatesConfig | null> {
  const doc = await ClientComplianceConfigModel.findOne({ tenantId, clientOrgId })
    .select({ tdsRates: 1 })
    .lean();
  if (!doc) return null;
  return doc as unknown as TdsRatesConfig;
}

interface ApprovalLimitConfig {
  approvalLimitOverrides?: Record<string, number>;
}

export async function resolveApprovalLimitConfig(
  tenantId: string,
  clientOrgId: Types.ObjectId
): Promise<ApprovalLimitConfig | null> {
  const doc = await ClientComplianceConfigModel.findOne({ tenantId, clientOrgId })
    .select({ approvalLimitOverrides: 1 })
    .lean();
  if (!doc) return null;
  return doc as unknown as ApprovalLimitConfig;
}
