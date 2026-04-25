import type { Model, Types } from "mongoose";
import { InvoiceModel } from "@/models/invoice/Invoice.js";
import { ExportBatchModel } from "@/models/invoice/ExportBatch.js";
import { ApprovalWorkflowModel } from "@/models/invoice/ApprovalWorkflow.js";
import { ExtractionLearningModel } from "@/models/invoice/ExtractionLearning.js";
import { ExtractionMappingModel } from "@/models/invoice/ExtractionMapping.js";
import { VendorTemplateModel } from "@/models/invoice/VendorTemplate.js";
import { VendorMasterModel } from "@/models/compliance/VendorMaster.js";
import { VendorGlMappingModel } from "@/models/compliance/VendorGlMapping.js";
import { GlCodeMasterModel } from "@/models/compliance/GlCodeMaster.js";
import { CostCenterMasterModel } from "@/models/compliance/CostCenterMaster.js";
import { VendorCostCenterMappingModel } from "@/models/compliance/VendorCostCenterMapping.js";
import { BankAccountModel } from "@/models/bank/BankAccount.js";
import { BankStatementModel } from "@/models/bank/BankStatement.js";
import { BankTransactionModel } from "@/models/bank/BankTransaction.js";
import { ClientComplianceConfigModel } from "@/models/integration/ClientComplianceConfig.js";
import { ClientNotificationConfigModel } from "@/models/integration/ClientNotificationConfig.js";
import { ClientTcsConfigModel } from "@/models/integration/ClientTcsConfig.js";
import { ClientExportConfigModel } from "@/models/integration/ClientExportConfig.js";
import { TenantMailboxAssignmentModel } from "@/models/integration/TenantMailboxAssignment.js";
import { TdsSectionMappingModel } from "@/models/compliance/TdsSectionMapping.js";

/**
 * Shape of a single accounting-leaf model whose rows reference a
 * `ClientOrganization`. The hard-delete dependency check at
 * `ClientOrgsAdminService.deleteOrArchive` iterates this registry and
 * counts dependents per model — every required-`clientOrgId` model in
 * the codebase MUST be listed here so deletes don't silently orphan
 * rows that would later violate `validateClientOrgTenantInvariant`.
 *
 * NON-REQUIRED `clientOrgId` MODELS (e.g. `TdsSectionMapping`) ALSO
 * belong in this registry whenever per-org override rows can exist —
 * `find({ clientOrgId: <oid> })` only matches concrete-id rows and
 * leaves the global-default (`clientOrgId: null`) rows untouched, so
 * the count + soft-archive flow is exactly right for those overrides.
 * Such entries are tracked in `NON_REQUIRED_REGISTERED_MODELS` below
 * and the drift test verifies that the schema's `clientOrgId` path
 * stays non-required (so we don't silently downgrade a hard contract).
 *
 * Drift is enforced by the registry test in
 * `clientOrgsAdminService.test.ts`, which dynamically loads every
 * model file under `backend/src/models/**` before introspecting
 * `mongoose.modelNames()` and fails when a schema declares
 * `clientOrgId` (or `clientOrgIds`) as required but is absent from
 * this registry.
 */
type ClientOrgDependentEntry = {
  /** Stable label exposed to FE via the linked-counts breakdown. */
  label: string;
  /** Mongoose model whose rows are scoped by `tenantId` + `clientOrgId`. */
  model: Model<unknown>;
  /**
   * Build the counter filter. Most leaves use `{ tenantId, clientOrgId }`,
   * but `TenantMailboxAssignment` stores the reference under the
   * `clientOrgIds[]` array (post-#159 multi-candidate shape).
   */
  buildFilter: (input: { tenantId: string; clientOrgId: Types.ObjectId }) => Record<string, unknown>;
};

const tenantAndClientOrgId = (input: { tenantId: string; clientOrgId: Types.ObjectId }) => ({
  tenantId: input.tenantId,
  clientOrgId: input.clientOrgId
});

export const CLIENT_ORG_DEPENDENT_MODELS: ReadonlyArray<ClientOrgDependentEntry> = [
  { label: "invoices", model: InvoiceModel as unknown as Model<unknown>, buildFilter: tenantAndClientOrgId },
  { label: "exportBatches", model: ExportBatchModel as unknown as Model<unknown>, buildFilter: tenantAndClientOrgId },
  { label: "approvalWorkflows", model: ApprovalWorkflowModel as unknown as Model<unknown>, buildFilter: tenantAndClientOrgId },
  { label: "extractionLearnings", model: ExtractionLearningModel as unknown as Model<unknown>, buildFilter: tenantAndClientOrgId },
  { label: "extractionMappings", model: ExtractionMappingModel as unknown as Model<unknown>, buildFilter: tenantAndClientOrgId },
  { label: "vendorTemplates", model: VendorTemplateModel as unknown as Model<unknown>, buildFilter: tenantAndClientOrgId },
  { label: "vendors", model: VendorMasterModel as unknown as Model<unknown>, buildFilter: tenantAndClientOrgId },
  { label: "vendorGlMappings", model: VendorGlMappingModel as unknown as Model<unknown>, buildFilter: tenantAndClientOrgId },
  { label: "glCodes", model: GlCodeMasterModel as unknown as Model<unknown>, buildFilter: tenantAndClientOrgId },
  { label: "costCenters", model: CostCenterMasterModel as unknown as Model<unknown>, buildFilter: tenantAndClientOrgId },
  { label: "vendorCostCenterMappings", model: VendorCostCenterMappingModel as unknown as Model<unknown>, buildFilter: tenantAndClientOrgId },
  { label: "bankAccounts", model: BankAccountModel as unknown as Model<unknown>, buildFilter: tenantAndClientOrgId },
  { label: "bankStatements", model: BankStatementModel as unknown as Model<unknown>, buildFilter: tenantAndClientOrgId },
  { label: "bankTransactions", model: BankTransactionModel as unknown as Model<unknown>, buildFilter: tenantAndClientOrgId },
  { label: "complianceConfigs", model: ClientComplianceConfigModel as unknown as Model<unknown>, buildFilter: tenantAndClientOrgId },
  { label: "notificationConfigs", model: ClientNotificationConfigModel as unknown as Model<unknown>, buildFilter: tenantAndClientOrgId },
  { label: "tcsConfigs", model: ClientTcsConfigModel as unknown as Model<unknown>, buildFilter: tenantAndClientOrgId },
  { label: "exportConfigs", model: ClientExportConfigModel as unknown as Model<unknown>, buildFilter: tenantAndClientOrgId },
  {
    label: "mailboxAssignments",
    model: TenantMailboxAssignmentModel as unknown as Model<unknown>,
    buildFilter: ({ tenantId, clientOrgId }) => ({ tenantId, clientOrgIds: clientOrgId })
  },
  {
    label: "tdsSectionMappings",
    model: TdsSectionMappingModel as unknown as Model<unknown>,
    buildFilter: tenantAndClientOrgId
  }
] as const;

/**
 * Models registered above whose `clientOrgId` (or `clientOrgIds`) path
 * is intentionally NON-required. Listed explicitly so the drift test
 * can assert the schema didn't silently flip to required without us
 * noticing — and so a reviewer sees "yes, this is on purpose."
 */
export const NON_REQUIRED_REGISTERED_MODELS: ReadonlyArray<string> = [
  TdsSectionMappingModel.modelName
] as const;

type ClientOrgDependentLabel = (typeof CLIENT_ORG_DEPENDENT_MODELS)[number]["label"];

type ClientOrgLinkedCounts = Record<ClientOrgDependentLabel, number>;

/**
 * Run one tenant-scoped count per registered dependent. Returns the
 * per-label breakdown plus the summed total — caller decides between
 * hard-delete (total === 0) and soft-archive (total > 0).
 */
export async function countClientOrgDependents(input: {
  tenantId: string;
  clientOrgId: Types.ObjectId;
}): Promise<{ counts: ClientOrgLinkedCounts; total: number }> {
  const counts = await Promise.all(
    CLIENT_ORG_DEPENDENT_MODELS.map((entry) =>
      entry.model.countDocuments(entry.buildFilter(input))
    )
  );
  const breakdown = CLIENT_ORG_DEPENDENT_MODELS.reduce<ClientOrgLinkedCounts>(
    (acc, entry, index) => {
      acc[entry.label] = counts[index] ?? 0;
      return acc;
    },
    {} as ClientOrgLinkedCounts
  );
  const total = counts.reduce((sum, n) => sum + n, 0);
  return { counts: breakdown, total };
}
