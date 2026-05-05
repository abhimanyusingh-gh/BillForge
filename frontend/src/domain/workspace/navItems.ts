export type NavBadgeKey = "action" | "triage";

export type NavSection = "Banking" | "Compliance" | "Setup";

export interface NavItem {
  readonly id: string;
  readonly icon: string;
  readonly label: string;
  readonly route: string;
  readonly section?: NavSection;
  readonly badgeKey?: NavBadgeKey;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: "dashboard", icon: "dashboard", label: "Overview", route: "/" },
  { id: "action", icon: "priority_high", label: "Action Required", route: "/action-required", badgeKey: "action" },
  { id: "invoices", icon: "receipt_long", label: "Invoices", route: "/invoices" },
  { id: "vendors", icon: "business", label: "Vendors", route: "/vendors" },
  { id: "payments", icon: "payments", label: "Payments", route: "/payments" },
  { id: "recon", icon: "account_balance", label: "Reconciliation", route: "/reconciliation", section: "Banking" },
  { id: "statements", icon: "description", label: "Bank Statements", route: "/bank-statements", section: "Banking" },
  { id: "tds", icon: "receipt", label: "TDS Dashboard", route: "/tds", section: "Compliance" },
  { id: "exports", icon: "cloud_upload", label: "Tally Export", route: "/exports", section: "Compliance" },
  { id: "tallysync", icon: "cable", label: "Tally Sync", route: "/tally-sync", section: "Compliance" },
  { id: "mailboxes", icon: "mail", label: "Mailboxes", route: "/mailboxes", section: "Setup" },
  { id: "triage", icon: "alt_route", label: "Inbox Routing", route: "/triage", section: "Setup", badgeKey: "triage" },
  { id: "clients", icon: "account_tree", label: "Client Orgs", route: "/client-orgs", section: "Setup" },
  { id: "config", icon: "tune", label: "Config", route: "/config", section: "Setup" }
];

export function findNavItemByRoute(route: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.route === route);
}
