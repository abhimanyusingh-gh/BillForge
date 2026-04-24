import { BADGE_TONE, type BadgeTone } from "@/components/ds/Badge";
import type { Invoice } from "@/types";
import { ACTION_REASON, ACTION_REASON_SEVERITY, type ActionReason } from "@/lib/invoice/actionRequired";

export const PRE_EXPORT_REASON = {
  MissingGstin: ACTION_REASON.MissingGstin,
  CriticalRisk: ACTION_REASON.CriticalRisk,
  ExportFailed: ACTION_REASON.ExportFailed
} as const;

type PreExportReason = (typeof PRE_EXPORT_REASON)[keyof typeof PRE_EXPORT_REASON];

const PRE_EXPORT_REASON_LABEL: Record<PreExportReason, string> = {
  [PRE_EXPORT_REASON.MissingGstin]: "Missing customer GSTIN",
  [PRE_EXPORT_REASON.CriticalRisk]: "Critical risk signal",
  [PRE_EXPORT_REASON.ExportFailed]: "Previous export failed"
};

const PRE_EXPORT_REASON_TONE: Record<PreExportReason, BadgeTone> = {
  [PRE_EXPORT_REASON.MissingGstin]: BADGE_TONE.warning,
  [PRE_EXPORT_REASON.CriticalRisk]: BADGE_TONE.danger,
  [PRE_EXPORT_REASON.ExportFailed]: BADGE_TONE.danger
};

export interface PreExportFailure {
  invoiceId: string;
  invoiceNumber: string | null;
  vendorName: string | null;
  reason: PreExportReason;
  detail: string;
}

export interface PreExportFailureGroup {
  reason: PreExportReason;
  label: string;
  tone: BadgeTone;
  failures: PreExportFailure[];
}

function classifyInvoiceForExport(invoice: Invoice): PreExportReason | null {
  if (invoice.export?.error) {
    return PRE_EXPORT_REASON.ExportFailed;
  }
  if (invoice.complianceSummary?.riskSignalMaxSeverity === "critical") {
    return PRE_EXPORT_REASON.CriticalRisk;
  }
  const currency = invoice.parsed?.currency ?? "INR";
  const customerGstin = (invoice.parsed?.customerGstin ?? "").trim();
  if (currency === "INR" && customerGstin === "") {
    return PRE_EXPORT_REASON.MissingGstin;
  }
  return null;
}

function buildDetail(invoice: Invoice, reason: PreExportReason): string {
  switch (reason) {
    case PRE_EXPORT_REASON.MissingGstin:
      return "Add the customer GSTIN on the INR invoice before exporting to Tally.";
    case PRE_EXPORT_REASON.CriticalRisk:
      return "Review and resolve the critical compliance risk before exporting.";
    case PRE_EXPORT_REASON.ExportFailed:
      return invoice.export?.error
        ? `Previous export failed: ${invoice.export.error}`
        : "Previous export failed. Review the error before retrying.";
  }
}

export function getPreExportFailures(invoice: Invoice): PreExportFailure[] {
  const reason = classifyInvoiceForExport(invoice);
  if (!reason) return [];
  return [
    {
      invoiceId: invoice._id,
      invoiceNumber: invoice.parsed?.invoiceNumber ?? null,
      vendorName: invoice.parsed?.vendorName ?? null,
      reason,
      detail: buildDetail(invoice, reason)
    }
  ];
}

export function buildPreExportFailureGroups(
  invoices: readonly Invoice[]
): PreExportFailureGroup[] {
  const byReason = new Map<PreExportReason, PreExportFailure[]>();
  for (const invoice of invoices) {
    for (const failure of getPreExportFailures(invoice)) {
      const bucket = byReason.get(failure.reason);
      if (bucket) {
        bucket.push(failure);
      } else {
        byReason.set(failure.reason, [failure]);
      }
    }
  }
  const orderedReasons = Array.from(byReason.keys()).sort(
    (a, b) =>
      ACTION_REASON_SEVERITY[b as ActionReason] -
      ACTION_REASON_SEVERITY[a as ActionReason]
  );
  return orderedReasons.map((reason) => ({
    reason,
    label: PRE_EXPORT_REASON_LABEL[reason],
    tone: PRE_EXPORT_REASON_TONE[reason],
    failures: byReason.get(reason) ?? []
  }));
}

export function totalPreExportFailures(groups: readonly PreExportFailureGroup[]): number {
  let total = 0;
  for (const group of groups) total += group.failures.length;
  return total;
}
