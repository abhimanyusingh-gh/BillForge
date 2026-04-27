import { buildTenantNested } from "@/api/urls/buildNested";

// Mailbox + integration plumbing — all tenant-scoped routes mounted under
// `tenantAdminRouter` in `app.ts`:
//   - `/admin/mailboxes` (tenantAdmin router): list/assign/remove integration
//     mailboxes against tenant users.
//   - `/admin/integrations`, `/admin/mailbox-assignments` (mailboxAssignments
//     router): assign integrations to client-orgs.
//   - `/integrations/gmail`, `/integrations/gmail/connect-url` (gmailConnection
//     router): OAuth status + connect URL.
//   - `/admin/notifications/log` (notificationLog router): tenant-wide mailbox
//     notification audit log.
//
// All routes here are tenant-scoped only — no clientOrgId in the URL — so they
// resolve through `buildTenantNested`.
export const mailboxUrls = {
  list: (): string => buildTenantNested("/admin/mailboxes"),
  assign: (integrationId: string): string =>
    buildTenantNested(`/admin/mailboxes/${encodeURIComponent(integrationId)}/assign`),
  removeAssignment: (integrationId: string, userId: string): string =>
    buildTenantNested(
      `/admin/mailboxes/${encodeURIComponent(integrationId)}/assign/${encodeURIComponent(userId)}`
    ),
  remove: (integrationId: string): string =>
    buildTenantNested(`/admin/mailboxes/${encodeURIComponent(integrationId)}`),
  integrationsList: (): string => buildTenantNested("/admin/integrations"),
  assignmentsList: (): string => buildTenantNested("/admin/mailbox-assignments"),
  assignmentsCreate: (): string => buildTenantNested("/admin/mailbox-assignments"),
  assignmentUpdate: (id: string): string =>
    buildTenantNested(`/admin/mailbox-assignments/${encodeURIComponent(id)}`),
  assignmentDelete: (id: string): string =>
    buildTenantNested(`/admin/mailbox-assignments/${encodeURIComponent(id)}`),
  assignmentRecentIngestions: (id: string): string =>
    buildTenantNested(`/admin/mailbox-assignments/${encodeURIComponent(id)}/recent-ingestions`),
  gmailStatus: (): string => buildTenantNested("/integrations/gmail"),
  gmailConnectUrl: (): string => buildTenantNested("/integrations/gmail/connect-url"),
  notificationLog: (): string => buildTenantNested("/admin/notifications/log")
};
