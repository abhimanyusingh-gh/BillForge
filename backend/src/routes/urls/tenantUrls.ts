export const TENANT_URL_PATHS = {
  onboardingComplete: "/onboarding/complete",
  inviteAccept: "/tenant/invites/accept",
  adminMailboxesList: "/admin/mailboxes",
  adminMailboxAssign: "/admin/mailboxes/:id/assign",
  adminMailboxUnassign: "/admin/mailboxes/:id/assign/:userId",
  adminMailboxDelete: "/admin/mailboxes/:id",
  adminUsers: "/admin/users",
  adminUsersInvite: "/admin/users/invite",
  adminUserRole: "/admin/users/:userId/role",
  adminUserEnabled: "/admin/users/:userId/enabled",
  adminUserById: "/admin/users/:userId",
  adminUserViewerScope: "/admin/users/:userId/viewer-scope"
} as const;
