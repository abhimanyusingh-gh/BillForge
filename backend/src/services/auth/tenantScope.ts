/**
 * Tenant → ClientOrganization scope resolution helpers.
 *
 * Post hierarchy-pivot (issues #155/#156), accounting-leaf models
 * (Invoice, VendorMaster, ExportBatch, …) no longer carry `tenantId`
 * directly — they reference `clientOrgId` which in turn points at a
 * `ClientOrganization` that is tenant-scoped via its own `tenantId`.
 *
 * Query call-sites must therefore resolve the set of client-org ids
 * owned by the caller's tenant before filtering accounting leaves.
 * Ingestion paths must likewise verify that a caller-supplied
 * `clientOrgId` is owned by the caller's tenant before accepting it.
 *
 * These two helpers are the single source of truth for that scope
 * resolution. Every accounting-leaf query and every ingestion ownership
 * check must go through here — do NOT inline `ClientOrganizationModel.find`
 * at call-sites.
 */

import type { Types } from "mongoose";
import { ClientOrganizationModel } from "@/models/integration/ClientOrganization.js";

/**
 * Return the ObjectIds of every ClientOrganization owned by `tenantId`.
 *
 * Use at list/query call-sites:
 * ```ts
 * const clientOrgIds = await findClientOrgIdsForTenant(tenantId);
 * await InvoiceModel.find({ clientOrgId: { $in: clientOrgIds }, ...rest });
 * ```
 *
 * An empty array is a valid result (tenant with no client-orgs yet) —
 * callers must pass it straight to `$in` rather than shortcut around it.
 */
export async function findClientOrgIdsForTenant(
  tenantId: string
): Promise<Types.ObjectId[]> {
  const docs = await ClientOrganizationModel.find({ tenantId })
    .select("_id")
    .lean();
  return docs.map((d) => d._id);
}

/**
 * Ownership re-check: return `clientOrgId` only if it belongs to
 * `tenantId`, else `null`.
 *
 * Use at ingestion entry points and batch-upload item loops — never
 * trust a caller-supplied `clientOrgId` without re-checking ownership.
 * Returning the ObjectId (rather than a boolean) lets the caller drop
 * it straight onto the accounting-leaf document being created.
 */
export async function findClientOrgIdByIdForTenant(
  clientOrgId: string,
  tenantId: string
): Promise<Types.ObjectId | null> {
  const doc = await ClientOrganizationModel.findOne({
    _id: clientOrgId,
    tenantId
  })
    .select("_id")
    .lean();
  return doc?._id ?? null;
}
