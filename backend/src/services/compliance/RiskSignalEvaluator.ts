import type { ComplianceRiskSignal, ParsedInvoiceData } from "@/types/invoice.js";
import { toMinorUnits, minorUnitsToMajorString } from "@/utils/currency.js";
import { createRiskSignal } from "@/services/compliance/riskSignalFactory.js";
import { RISK_SIGNAL_CODE } from "@/types/riskSignals.js";

const DEFAULT_RISK_SIGNAL_PENALTY_CAP = 30;

interface RiskSignalTenantConfig {
  maxInvoiceTotalMinor?: number;
  maxDueDays?: number;
  minimumExpectedTotalMinor?: number;
  riskSignalPenaltyCap?: number;
}

interface RiskSignalEvaluatorInput {
  parsed: ParsedInvoiceData;
  expectedMaxTotal: number;
  expectedMaxDueDays: number;
  referenceDate?: Date;
  tenantConfig?: RiskSignalTenantConfig;
}

export class RiskSignalEvaluator {
  evaluate(input: RiskSignalEvaluatorInput): ComplianceRiskSignal[] {
    const signals: ComplianceRiskSignal[] = [];

    this.checkAmountAboveExpected(input, signals);
    this.checkAmountBelowMinimum(input, signals);
    this.checkDueDateTooFar(input, signals);
    this.checkMissingMandatoryFields(input, signals);

    return signals;
  }

  static sumPenalties(signals: ComplianceRiskSignal[], penaltyCap?: number): number {
    const cap = penaltyCap ?? DEFAULT_RISK_SIGNAL_PENALTY_CAP;
    const raw = signals.reduce((sum, s) => sum + s.confidencePenalty, 0);
    return Math.min(cap, raw);
  }

  private checkAmountAboveExpected(input: RiskSignalEvaluatorInput, signals: ComplianceRiskSignal[]): void {
    const { parsed, tenantConfig } = input;

    if (parsed.totalAmountMinor === undefined || !Number.isInteger(parsed.totalAmountMinor)) return;

    const effectiveMaxMinor = tenantConfig?.maxInvoiceTotalMinor
      ?? toMinorUnits(input.expectedMaxTotal, parsed.currency);

    if (effectiveMaxMinor <= 0 || parsed.totalAmountMinor <= effectiveMaxMinor) return;

    const currencyPrefix = parsed.currency ? `${parsed.currency} ` : "";
    const overRatio = (parsed.totalAmountMinor - effectiveMaxMinor) / effectiveMaxMinor;
    const penalty = Math.min(30, Math.round(15 + overRatio * 25));

    signals.push(createRiskSignal(
      RISK_SIGNAL_CODE.TOTAL_AMOUNT_ABOVE_EXPECTED,
      "financial",
      "warning",
      `Total amount ${currencyPrefix}${minorUnitsToMajorString(parsed.totalAmountMinor, parsed.currency)} exceeds expected max ${currencyPrefix}${minorUnitsToMajorString(effectiveMaxMinor, parsed.currency)}.`,
      penalty
    ));
  }

  private checkAmountBelowMinimum(input: RiskSignalEvaluatorInput, signals: ComplianceRiskSignal[]): void {
    const { parsed, tenantConfig } = input;
    const minExpected = tenantConfig?.minimumExpectedTotalMinor ?? 10000;
    if (
      parsed.totalAmountMinor === undefined ||
      !Number.isInteger(parsed.totalAmountMinor) ||
      parsed.totalAmountMinor >= minExpected
    ) return;

    if (parsed.totalAmountMinor > 0) {
      signals.push(createRiskSignal(
        RISK_SIGNAL_CODE.TOTAL_AMOUNT_BELOW_MINIMUM,
        "financial",
        "info",
        `Total amount is unusually low (${minorUnitsToMajorString(parsed.totalAmountMinor, parsed.currency)}).`,
        0
      ));
    }
  }

  private checkDueDateTooFar(input: RiskSignalEvaluatorInput, signals: ComplianceRiskSignal[]): void {
    const { parsed, tenantConfig, referenceDate = new Date() } = input;

    const effectiveMaxDays = tenantConfig?.maxDueDays ?? input.expectedMaxDueDays;

    if (!parsed.dueDate || effectiveMaxDays <= 0) return;

    const dueDate = parsed.dueDate;
    if (isNaN(dueDate.getTime())) return;

    const daysToDue = Math.round(
      (Date.UTC(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()) -
        Date.UTC(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())) / 86400000
    );

    if (daysToDue <= effectiveMaxDays) return;

    const penalty = Math.min(20, Math.round(8 + (daysToDue - effectiveMaxDays) / 4));
    signals.push(createRiskSignal(
      RISK_SIGNAL_CODE.DUE_DATE_TOO_FAR,
      "data-quality",
      "warning",
      `Due date is ${daysToDue} days away, expected max is ${effectiveMaxDays} days.`,
      penalty
    ));
  }

  private checkMissingMandatoryFields(input: RiskSignalEvaluatorInput, signals: ComplianceRiskSignal[]): void {
    const { parsed } = input;
    const missing: string[] = [];
    if (!parsed.vendorName) missing.push("vendor name");
    if (parsed.totalAmountMinor === undefined || parsed.totalAmountMinor <= 0) missing.push("total amount");

    if (missing.length > 0) {
      signals.push(createRiskSignal(
        RISK_SIGNAL_CODE.MISSING_MANDATORY_FIELDS,
        "data-quality",
        "warning",
        `Missing mandatory fields: ${missing.join(", ")}.`,
        4
      ));
    }
  }

}
