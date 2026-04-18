import { Schema, model, type InferSchemaType } from "mongoose";
import { MailboxProviders } from "@/types/mailbox.js";

const mailboxNotificationEventSchema = new Schema(
  {
    userId: { type: String, required: true },
    provider: { type: String, enum: MailboxProviders, required: true },
    emailAddress: { type: String, required: true },
    eventType: { type: String, required: true },
    reason: { type: String, required: true },
    delivered: { type: Boolean, required: true, default: false },
    retryCount: { type: Number, required: true, default: 0 },
    deliveryFailed: { type: Boolean, required: true, default: false },
    failureReason: { type: String, default: null },
    skippedReason: { type: String, default: null },
    recipient: { type: String, default: null },
    ccRecipients: { type: [String], default: [] }
  },
  {
    timestamps: true
  }
);

mailboxNotificationEventSchema.index({ userId: 1, provider: 1, eventType: 1, createdAt: -1 });
mailboxNotificationEventSchema.index({ delivered: 1, deliveryFailed: 1, createdAt: -1 });

type MailboxNotificationEvent = InferSchemaType<typeof mailboxNotificationEventSchema>;

export const MailboxNotificationEventModel = model<MailboxNotificationEvent>(
  "MailboxNotificationEvent",
  mailboxNotificationEventSchema
);
