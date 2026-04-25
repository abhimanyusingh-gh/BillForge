import { Schema, model, type InferSchemaType, Types } from "mongoose";

/**
 * Sentinel values for `TenantMailboxAssignment.assignedTo`. The field is
 * a free-form string (legacy: holds either a tenant userId or the `ALL`
 * sentinel meaning "fan out to every tenant admin"). Hoisted into a
 * named constant so the magic string lives in exactly one place.
 */
export const MAILBOX_ASSIGNED_TO = {
  ALL: "all"
} as const;
export type MailboxAssignedToSentinel = (typeof MAILBOX_ASSIGNED_TO)[keyof typeof MAILBOX_ASSIGNED_TO];

const tenantMailboxAssignmentSchema = new Schema(
  {
    tenantId: { type: String, required: true },
    integrationId: { type: Types.ObjectId, required: true, ref: "TenantIntegration" },
    assignedTo: { type: String, required: true },
    /**
     * Candidate client-orgs for invoices polled from this mailbox (#159).
     * A CA firm mailbox (`invoices@cafirm.com`) typically carries
     * multiple clients CC-ing their invoices — the poller resolves a
     * per-invoice `clientOrgId` via GSTIN match → single-candidate
     * fallback → triage queue. This array is the allowlist the resolver
     * consults. `minLength: 1` enforces "assignments must carry at
     * least one candidate" — an empty mailbox has no purpose.
     * Ownership rule: every element must belong to the assignment's
     * `tenantId` (checked at assignment-creation time).
     */
    clientOrgIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "ClientOrganization" }],
      required: true,
      validate: {
        validator: (value: Types.ObjectId[]) => Array.isArray(value) && value.length >= 1,
        message: "TenantMailboxAssignment.clientOrgIds must contain at least one ClientOrganization reference."
      }
    }
  },
  {
    timestamps: true
  }
);

tenantMailboxAssignmentSchema.index({ tenantId: 1, integrationId: 1, assignedTo: 1 }, { unique: true });
// Multikey index supporting the poller's per-invoice candidate lookup
// (`$in` over the array) plus tenant-scoped admin queries.
tenantMailboxAssignmentSchema.index({ tenantId: 1, clientOrgIds: 1 });

type TenantMailboxAssignment = InferSchemaType<typeof tenantMailboxAssignmentSchema>;

export const TenantMailboxAssignmentModel = model<TenantMailboxAssignment>("TenantMailboxAssignment", tenantMailboxAssignmentSchema);
