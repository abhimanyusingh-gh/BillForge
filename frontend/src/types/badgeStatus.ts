import type { InvoiceStatus } from "@/types";

export const BADGE_STATUS = {
  PENDING: "PENDING",
  PARSED: "PARSED",
  NEEDS_REVIEW: "NEEDS_REVIEW",
  AWAITING_APPROVAL: "AWAITING_APPROVAL",
  APPROVED: "APPROVED",
  EXPORTED: "EXPORTED",
  FAILED_OCR: "FAILED_OCR",
  FAILED_PARSE: "FAILED_PARSE"
} as const satisfies Record<InvoiceStatus, InvoiceStatus>;

export type BadgeStatus = (typeof BADGE_STATUS)[keyof typeof BADGE_STATUS];

export const BADGE_STATUS_LABEL: Record<BadgeStatus, string> = {
  [BADGE_STATUS.PENDING]: "Pending",
  [BADGE_STATUS.PARSED]: "Parsed",
  [BADGE_STATUS.NEEDS_REVIEW]: "Needs review",
  [BADGE_STATUS.AWAITING_APPROVAL]: "Awaiting approval",
  [BADGE_STATUS.APPROVED]: "Approved",
  [BADGE_STATUS.EXPORTED]: "Exported",
  [BADGE_STATUS.FAILED_OCR]: "Failed OCR",
  [BADGE_STATUS.FAILED_PARSE]: "Failed parse"
};
