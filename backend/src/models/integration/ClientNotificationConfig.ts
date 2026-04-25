import { Schema, model, type InferSchemaType } from "mongoose";
import { validateClientOrgTenantInvariant } from "@/services/auth/tenantScope.js";

const NOTIFICATION_RECIPIENT_TYPES = ["integration_creator", "all_tenant_admins", "specific_user"] as const;

const clientNotificationConfigSchema = new Schema(
  {
    tenantId: { type: String, required: true },
    clientOrgId: { type: Schema.Types.ObjectId, ref: "ClientOrganization", required: true },
    mailboxReauthEnabled: { type: Boolean, required: true, default: true },
    escalationEnabled: { type: Boolean, required: true, default: true },
    inAppEnabled: { type: Boolean, required: true, default: false },
    primaryRecipientType: {
      type: String,
      enum: NOTIFICATION_RECIPIENT_TYPES,
      required: true,
      default: "integration_creator"
    },
    specificRecipientUserId: { type: String, default: null },
    updatedBy: { type: String, default: null }
  },
  {
    timestamps: true
  }
);

clientNotificationConfigSchema.index({ tenantId: 1, clientOrgId: 1 }, { unique: true });

clientNotificationConfigSchema.pre("save", async function () {
  await validateClientOrgTenantInvariant(this.tenantId, this.clientOrgId);
});

type ClientNotificationConfig = InferSchemaType<typeof clientNotificationConfigSchema>;

const ClientNotificationConfigModel = model<ClientNotificationConfig>(
  "ClientNotificationConfig",
  clientNotificationConfigSchema
);

export { ClientNotificationConfigModel, NOTIFICATION_RECIPIENT_TYPES };
