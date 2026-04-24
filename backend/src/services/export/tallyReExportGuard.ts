import { createHash } from "node:crypto";
import { InvoiceModel } from "@/models/invoice/Invoice.js";
import { TenantTallyCompanyModel } from "@/models/integration/TenantTallyCompany.js";
import { TALLY_ACTION, type TallyAction } from "@/services/export/tallyExporter/xml.js";

interface VoucherGuidInputs {
  tenantId: string;
  invoiceId: string;
  exportVersion: number;
}

export interface ReExportDecision {
  guid: string;
  action: TallyAction;
  nextExportVersion: number;
  buyerStateName: string | null;
}

export class F12OverwriteNotVerifiedError extends Error {
  readonly code = "TALLY_F12_OVERWRITE_NOT_VERIFIED";
  constructor(tenantId: string) {
    super(
      `Tally F12 "Overwrite voucher when voucher with same GUID exists" is not verified for tenant ${tenantId}. ` +
      "Re-export requires ACTION=\"Alter\"; complete the Tally onboarding F12 check before retrying."
    );
  }
}

export function computeVoucherGuid(inputs: VoucherGuidInputs): string {
  const payload = `${inputs.tenantId}:${inputs.invoiceId}:${inputs.exportVersion}`;
  return createHash("sha256").update(payload).digest("hex");
}

export async function resolveReExportDecision(params: {
  tenantId: string;
  invoiceId: string;
  currentExportVersion: number;
}): Promise<ReExportDecision> {
  const { tenantId, invoiceId, currentExportVersion } = params;
  const nextExportVersion = currentExportVersion + 1;
  const action: TallyAction = currentExportVersion === 0 ? TALLY_ACTION.CREATE : TALLY_ACTION.ALTER;

  const company = await TenantTallyCompanyModel.findOne({ tenantId }).lean();

  if (action === TALLY_ACTION.ALTER && !company?.f12OverwriteByGuidVerified) {
    throw new F12OverwriteNotVerifiedError(tenantId);
  }

  return {
    guid: computeVoucherGuid({ tenantId, invoiceId, exportVersion: nextExportVersion }),
    action,
    nextExportVersion,
    buyerStateName: company?.stateName ?? null
  };
}

export async function commitExportVersionBump(params: {
  invoiceId: string;
  nextExportVersion: number;
}): Promise<void> {
  await InvoiceModel.updateOne(
    { _id: params.invoiceId },
    { $set: { exportVersion: params.nextExportVersion } }
  );
}
