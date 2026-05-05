export const chromeUrls = {
  actionRequiredCount: () => "/api/invoices/action-required?pageSize=1",
  triageCount: () => "/api/invoices/triage?pageSize=1",
  clientOrgs: () => "/api/admin/client-orgs?includeArchived=false"
} as const;
