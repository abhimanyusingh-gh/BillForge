export const TENANT_URL_PATHS = {
  onboardingComplete: "/onboarding/complete",
  inviteAccept: "/tenant/invites/accept",
  adminMailboxesList: "/admin/mailboxes",
  adminMailboxAssign: "/admin/mailboxes/:id/assign",
  adminMailboxUnassign: "/admin/mailboxes/:id/assign/:userId",
  adminMailboxDelete: "/admin/mailboxes/:id"
} as const;
