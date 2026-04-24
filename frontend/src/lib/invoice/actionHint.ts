import type { Invoice } from "@/types";

export const ACTION_HINT_KIND = {
  Ready: "Ready",
  Pending: "Pending",
  Blocked: "Blocked",
  MissingData: "MissingData",
  Done: "Done"
} as const;

export type ActionHintKind = (typeof ACTION_HINT_KIND)[keyof typeof ACTION_HINT_KIND];

interface ActionHint {
  kind: ActionHintKind;
  text: string;
}

function hasMissingCustomerGstinOnInr(invoice: Invoice): boolean {
  const parsed = invoice.parsed;
  if (!parsed) return false;
  if (parsed.currency !== "INR") return false;
  if (!parsed.customerName) return false;
  const gstin = parsed.customerGstin;
  return !gstin || gstin.trim() === "";
}

function hasOpenCriticalRiskSignal(invoice: Invoice): boolean {
  const summaryMax = invoice.complianceSummary?.riskSignalMaxSeverity;
  if (summaryMax === "critical") return true;
  const signals = invoice.compliance?.riskSignals;
  if (!signals) return false;
  return signals.some((s) => s.status === "open" && s.severity === "critical");
}

export function getActionHint(invoice: Invoice): ActionHint | null {
  switch (invoice.status) {
    case "PENDING":
      return { kind: ACTION_HINT_KIND.Pending, text: "Awaiting OCR" };
    case "FAILED_OCR":
      return { kind: ACTION_HINT_KIND.Blocked, text: "OCR failed — reingest" };
    case "FAILED_PARSE":
      return { kind: ACTION_HINT_KIND.Blocked, text: "Parse failed — reingest" };
    case "PARSED":
    case "NEEDS_REVIEW": {
      if (hasMissingCustomerGstinOnInr(invoice)) {
        return { kind: ACTION_HINT_KIND.MissingData, text: "Missing customer GSTIN" };
      }
      if (hasOpenCriticalRiskSignal(invoice)) {
        return { kind: ACTION_HINT_KIND.Blocked, text: "Critical risk signal open" };
      }
      return { kind: ACTION_HINT_KIND.Ready, text: "Ready to approve" };
    }
    case "AWAITING_APPROVAL": {
      const step = invoice.workflowState?.currentStep;
      const text = step ? `In approval (step ${step})` : "In approval";
      return { kind: ACTION_HINT_KIND.Pending, text };
    }
    case "APPROVED":
      return { kind: ACTION_HINT_KIND.Ready, text: "Ready to export" };
    case "EXPORTED":
      return { kind: ACTION_HINT_KIND.Done, text: "Exported" };
    default:
      return null;
  }
}
