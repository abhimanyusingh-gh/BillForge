# RFC: Accounting, Payments & Tally Integration

## 1. RFC Metadata

| Field | Value |
|---|---|
| **Title** | Accounting, Payments & Tally Integration |
| **Authors** | BillForge Engineering |
| **Status** | Draft |
| **Date** | 2026-04-17 |
| **VKL Version** | Final (44 decisions, 20 constraints, 6 resolved conflicts) |
| **EIL Entries** | 32 evidence items |
| **OAR Items** | 15 open questions |
| **Input Documents** | [PRD.md](./PRD.md) v1.2, [PRD-REFINED.md](./input/PRD-REFINED.md), [TALLY-INTEGRATION-AUDIT.md](./input/TALLY-INTEGRATION-AUDIT.md), [UX-AUDIT-REPORT.md](./input/UX-AUDIT-REPORT.md), [DATA-MODEL-AUDIT.md](./input/DATA-MODEL-AUDIT.md), BillForge-PRD-CA-FIRMS-INDIA.pdf |

---

## 2. Executive Summary

BillForge is an India-specific accounts payable automation platform that ingests vendor invoices, extracts structured data using OCR + SLM, enriches with compliance data (TDS, GST, PAN, risk signals), routes through configurable approval workflows, and exports to Tally for accounting.

This RFC defines the architecture for four interconnected capabilities:

1. **TDS Cumulative Threshold Tracking** -- Per-vendor annual TDS threshold compliance per Income Tax Act, closing a compliance gap where individual invoices below single-transaction thresholds but cumulatively exceeding annual thresholds produce zero TDS. Includes the full TDS rate hierarchy (Section 197, 206AA, 206AB), FY/quarter assignment, and GST exclusion from taxable base per CBDT Circular 23/2017.

2. **Payment Recording & Payment Voucher Export** -- Recording payments against approved invoices, tracking partial/full/overpayment status, detecting duplicate UTRs, processing advance payments and reversals, batch payment runs, and generating Tally Payment Voucher XML that settles outstanding bill references.

3. **Tally Integration Fixes** -- Five critical XML structural fixes (ALLLEDGERENTRIES.LIST, ISINVOICE=Yes, REFERENCE, EFFECTIVEDATE, BILLALLOCATIONS.LIST) that must be deployed immediately, plus PLACEOFSUPPLY derivation, GUID-based deduplication, batch export, and vendor pre-validation design.

4. **Reconciliation Enhancement, Audit Log & Vendor Management** -- Junction-table reconciliation replacing 1:1 inline fields (enabling split/aggregate matching), an immutable audit log with 8-year retention, vendor CRUD with merge capability, and nine data integrity fixes across the schema layer.

The work is phased across 6 phases (Phase 0 through Phase 5) plus UX quick wins, with a total raw timeline of 14-18 engineering weeks. Adjusted for team size (2 backend, 1 frontend) and 70% productivity factor: 18-24 calendar weeks. Phase 0 (Tally XML fixes) has zero dependencies and executes in 1-2 days.

---

## 3. Problem Statement

### 3.1 TDS Compliance Gap

BillForge today computes TDS on a per-invoice basis only. The `TdsCalculationService.computeTds()` method checks a single-transaction threshold but never checks whether cumulative payments to a vendor in a financial year have crossed the annual aggregate threshold prescribed under the Income Tax Act, 1961.

Sections 194C, 194J, 194H, 194I, 194A (among others) prescribe both single-transaction and annual aggregate thresholds. For example, Section 194C mandates TDS on payments to contractors only when the aggregate amount credited or paid during the FY exceeds Rs 1,00,000 (E3). Individual transactions below Rs 30,000 are exempt per single-transaction threshold, but once the annual cumulative crosses Rs 1,00,000, TDS applies to the entire amount credited/paid during the year, minus any TDS already deducted.

Consequences of the current gap:

1. **Under-deduction of TDS** -- Invoices that individually fall below single-transaction thresholds but cumulatively exceed annual thresholds produce zero TDS, violating the Income Tax Act.
2. **Interest liability under Section 201(1A)** -- Late deduction attracts 1% per month interest; late deposit attracts 1.5% per month (E13). These are strict liability provisions with no discretion.
3. **Disallowance under Section 40(a)(ia)** -- 30% of expenditure where TDS was not deducted is disallowed as a business expense.
4. **Incorrect Form 26Q filing** -- Without cumulative tracking, quarterly TDS returns will carry wrong figures, inviting scrutiny from the Assessing Officer.
5. **Vendor disputes** -- Once catch-up TDS is eventually recognized, deducting a large accumulated amount from a single payment creates friction with the vendor.

Additionally: no GST exclusion from TDS base per CBDT Circular 23/2017 (C-008, E11); no Section 197 lower deduction certificate support (D-013, E14); no Section 206AA 20% penalty rate enforcement (C-004, E7); no TDS quarter assignment for Form 26Q (D-026, C-014, E28); no TAN tracking on the Tenant model (D-009, C-007, E15); and rate field naming inconsistency between TenantComplianceConfig and TdsRateTable.

### 3.2 Missing Payment Lifecycle

The procure-to-pay workflow terminates at `EXPORTED`. There is no mechanism to:

- Record that a payment was made against one or more approved invoices
- Track partial payment, full payment, or overpayment status on individual invoices
- Detect duplicate payments via UTR/reference deduplication
- Generate Tally Payment Voucher XML that settles the outstanding bill references created by Purchase Voucher exports
- Process advance payments (payment before invoice receipt) or reversals (bounced cheques, bank returns)
- Enforce Indian compliance constraints on cash payments (Section 40A(3) limit of Rs 2,00,000) or MSME payment deadlines (MSMED Act Section 15, 45-day cap)

Without payment recording, the AP team must manually track payment status in spreadsheets, manually create Payment Vouchers in Tally, and has no system-enforced protection against duplicate UTRs or over-allocation.

### 3.3 Broken Tally Export

BillForge's current Tally export produces XML that Tally Prime imports as journal-style vouchers, not as proper purchase invoices. Five cascading consequences:

1. **No bill tracking.** Without `BILLALLOCATIONS.LIST`, every purchase voucher vanishes from Tally's Outstanding Receivable/Payable reports.
2. **No GST return filing from Tally.** `ISINVOICE=No` means vouchers never appear in auto-generated GSTR-2 data.
3. **No payment settlement.** Without a matching `New Ref` bill on the purchase side, payment vouchers cannot settle outstanding balances.
4. **Incorrect tag names.** Tally Prime expects `ALLLEDGERENTRIES.LIST`, not `LEDGERENTRIES.LIST` (E1).
5. **Missing PLACEOFSUPPLY.** Tally cannot determine intra-state vs inter-state GST treatment (C-017).

Additionally: per-invoice HTTP export instead of batch, no deduplication mechanism for re-exports, the `ExportBatch` model lacks per-invoice status, and the `ocrText` exclusion bug silently breaks amount resolution.

### 3.4 Reconciliation, Audit & Vendor Management Gaps

**(a) Reconciliation is 1:1 only.** The current `BankTransaction.matchedInvoiceId` stores a single string, making split payments (one bank debit covering multiple invoices) and aggregate payments (multiple transfers settling one invoice) impossible to represent. Indian AP teams routinely process both patterns.

**(b) No audit trail for financial mutations.** No AuditLog model exists. TDS overrides, GL code changes, manual reconciliation matches, and payment recordings happen silently. Income Tax Act record-keeping requirements mandate traceability for a minimum of 8 years.

**(c) No vendor management API.** `VendorMaster` records are auto-created during invoice ingestion but expose no CRUD endpoints. Users cannot correct vendor names, set Tally ledger mappings, manage vendor status, or merge duplicate vendor fingerprints. OCR variations in vendor names create duplicate fingerprints, fragmenting TDS cumulative tracking.

**(d) Data integrity issues.** GL code source enum mismatch (silent data loss), TDS rate unit ambiguity, missing integer validation on 15+ financial fields, dead User model fields, legacy Invoice fields, hardcoded TenantInvite role enum, missing indexes, and a tenant isolation gap on MailboxNotificationEvent.

---

## 4. Proposed Solution

### 4.1 TDS Cumulative Threshold & Tax Compliance

#### 4.1.1 TDS Computation Algorithm Changes

The TDS computation is split into two methods to satisfy VKL C-020 (pure function constraint) and prevent double-counting when `computeTds` is called more than once (e.g., preview/dry-run before final commit):

1. **`computeTds()`** -- Pure function. Accepts cumulative data as input, returns TDS result + a ledger delta. Has no side effects, does not call `upsertEntry`, does not write to the database. Safe to call repeatedly for previews or dry-runs.
2. **`recordTdsToLedger()`** -- Called by the orchestrator (pipeline or API handler) after `computeTds()` returns. Persists the ledger delta to `TdsVendorLedger`. Called exactly once per invoice processing.

**Orchestrator usage:**

```typescript
const cumulativeData = await tdsVendorLedgerService.getCumulativeForVendor(
  tenantId, vendorFingerprint, fy, section
);
const result = tdsCalculationService.computeTds(invoice, tenantId, glCategory, vendorFingerprint, cumulativeData);

if (!dryRun) {
  await tdsVendorLedgerService.recordTdsToLedger(
    tenantId, vendorFingerprint, invoiceId, invoice.invoiceDate,
    result.ledgerDelta, result.tds.section!, fy, result.tds.quarter!
  );
}
```

**`computeTds` method signature (pure -- no async, no DB calls):**

```typescript
computeTds(
  invoice: ParsedInvoiceData,
  tenantId: string,
  glCategory: string | null,
  vendorFingerprint: string,
  cumulativeData: { cumulativeBaseMinor: number; cumulativeTdsMinor: number; entries?: TdsLedgerEntry[] } | null
): TdsCalculationResult
```

**`TdsCalculationResult` extended with ledger delta:**

```typescript
export interface TdsCalculationResult {
  tds: ComplianceTdsResult;
  riskSignals: ComplianceRiskSignal[];
  ledgerDelta: TdsLedgerDelta;
}

export interface TdsLedgerDelta {
  taxableAmountMinor: number;
  tdsAmountMinor: number;
  rateBps: number;
  rateSource: TdsRateSource;
  thresholdJustCrossed: boolean;
}
```

**Extended ComplianceTdsResult type** (see Section 4.7.7 for full type definitions):

```typescript
export interface ComplianceTdsResult {
  section: string | null;
  rate: number | null;
  rateBps: number | null;
  rateSource: TdsRateSource | null;
  amountMinor: number | null;
  taxableBaseMinor: number | null;
  netPayableMinor: number | null;
  source: TdsSource;
  confidence: TdsConfidence;
  quarter: TdsQuarter | null;
}
```

**Complete revised algorithm (pure function -- PA-01 fix, no DB writes):**

Note: `computeTds` is now synchronous and pure. It receives `cumulativeData` as an input parameter (fetched by the orchestrator) and returns a `ledgerDelta` for the orchestrator to persist via `recordTdsToLedger()`. The `resolveEffectiveRate` and `detectSection` lookups are also made pure by passing pre-resolved config data. For brevity, only the threshold and catch-up logic is shown in full below; section detection and rate hierarchy are unchanged except that they no longer perform DB queries internally.

```typescript
computeTds(
  invoice: ParsedInvoiceData,
  tenantId: string,
  glCategory: string | null,
  vendorFingerprint: string,
  cumulativeData: { cumulativeBaseMinor: number; cumulativeTdsMinor: number; entries?: TdsLedgerEntry[] } | null
): TdsCalculationResult {
  const riskSignals: ComplianceRiskSignal[] = [];
  const panCategory = this.getPanCategory(invoice.pan);
  const panValid = invoice.pan ? PAN_FORMAT.test(invoice.pan.toUpperCase()) : false;

  const detection = this.detectSection(panCategory, glCategory);

  if (!detection.section) {
    return {
      tds: {
        section: null, rate: null, rateBps: null, rateSource: null,
        amountMinor: null, taxableBaseMinor: null, netPayableMinor: null,
        source: "auto", confidence: TDS_CONFIDENCE.LOW, quarter: null
      },
      riskSignals,
      ledgerDelta: { taxableAmountMinor: 0, tdsAmountMinor: 0, rateBps: 0, rateSource: "standard", thresholdJustCrossed: false }
    };
  }

  if (detection.confidence === TDS_CONFIDENCE.MEDIUM) {
    riskSignals.push(createRiskSignal(
      RISK_SIGNAL_CODE.TDS_SECTION_AMBIGUOUS, "compliance", "warning",
      `Multiple TDS sections could apply for category "${glCategory}" — please verify section ${detection.section}.`,
      4
    ));
  }

  const rateLookup = this.lookupRate(detection.section, panCategory);
  if (!rateLookup) {
    return {
      tds: {
        section: detection.section, rate: null, rateBps: null,
        rateSource: null, amountMinor: null, taxableBaseMinor: null,
        netPayableMinor: null, source: "auto",
        confidence: detection.confidence, quarter: null
      },
      riskSignals,
      ledgerDelta: { taxableAmountMinor: 0, tdsAmountMinor: 0, rateBps: 0, rateSource: "standard", thresholdJustCrossed: false }
    };
  }

  const { effectiveRateBps, rateSource } = this.resolveEffectiveRate(
    detection.section, panCategory, panValid, invoice.pan,
    vendorFingerprint, rateLookup
  );

  if (!panValid && invoice.pan !== undefined && invoice.pan !== null) {
    riskSignals.push(createRiskSignal(
      RISK_SIGNAL_CODE.TDS_NO_PAN_PENALTY_RATE, "compliance", "critical",
      `No valid PAN — TDS at 20% penalty rate (Section 206AA) applies instead of ${rateLookup.rateBps / 100}%.`,
      10
    ));
  } else if (!invoice.pan) {
    riskSignals.push(createRiskSignal(
      RISK_SIGNAL_CODE.TDS_NO_PAN_PENALTY_RATE, "compliance", "critical",
      "No PAN available — TDS at 20% penalty rate (Section 206AA) applies.",
      10
    ));
  }

  const taxableAmount = this.determineTaxableAmount(invoice);
  const totalAmount = invoice.totalAmountMinor ?? taxableAmount;

  if (taxableAmount <= 0) {
    return {
      tds: {
        section: detection.section, rate: effectiveRateBps,
        rateBps: effectiveRateBps, rateSource,
        amountMinor: null, taxableBaseMinor: null,
        netPayableMinor: null, source: "auto",
        confidence: detection.confidence, quarter: null
      },
      riskSignals,
      ledgerDelta: { taxableAmountMinor: 0, tdsAmountMinor: 0, rateBps: effectiveRateBps, rateSource, thresholdJustCrossed: false }
    };
  }

  const invoiceDate = invoice.invoiceDate ?? new Date();
  const fy = determineFY(invoiceDate);
  const quarter = determineQuarter(invoiceDate);

  const previousCumulative = cumulativeData?.cumulativeBaseMinor ?? 0;
  const previousTdsDeducted = cumulativeData?.cumulativeTdsMinor ?? 0;
  const newCumulative = previousCumulative + taxableAmount;
  const annualThreshold = rateLookup.thresholdAnnualMinor;

  let tdsAmountMinor: number;
  let netPayableMinor: number;
  let thresholdJustCrossed = false;

  if (annualThreshold > 0 && newCumulative <= annualThreshold) {
    tdsAmountMinor = 0;
    netPayableMinor = totalAmount;

    riskSignals.push(createRiskSignal(
      RISK_SIGNAL_CODE.TDS_BELOW_ANNUAL_THRESHOLD, "compliance", "info",
      `Cumulative amount (${newCumulative / 100} INR) at or below annual threshold `
        + `(${annualThreshold / 100} INR) for section ${detection.section}. No TDS deducted.`,
      0
    ));
  } else if (annualThreshold > 0 && previousCumulative <= annualThreshold && newCumulative > annualThreshold) {
    thresholdJustCrossed = true;
    const catchUpBase = newCumulative;
    const grossTds = Math.round(catchUpBase * effectiveRateBps / 10000);
    tdsAmountMinor = grossTds - previousTdsDeducted;
    netPayableMinor = totalAmount - tdsAmountMinor;

    riskSignals.push(createRiskSignal(
      RISK_SIGNAL_CODE.TDS_ANNUAL_THRESHOLD_CROSSED, "compliance", "warning",
      `This invoice caused cumulative to cross the annual threshold `
        + `(${annualThreshold / 100} INR) for section ${detection.section}. `
        + `Catch-up TDS of ${tdsAmountMinor / 100} INR deducted (covers prior invoices).`,
      3
    ));

    if (cumulativeData?.entries && cumulativeData.entries.length > 0) {
      const historicalRates = new Set(cumulativeData.entries.map(e => e.rateBps));
      if (historicalRates.size > 1 || (historicalRates.size === 1 && !historicalRates.has(effectiveRateBps))) {
        riskSignals.push(createRiskSignal(
          RISK_SIGNAL_CODE.TDS_CATCHUP_RATE_VARIANCE, "compliance", "warning",
          `Catch-up TDS computed using current rate (${effectiveRateBps / 100}%) but prior invoices used different rates `
            + `(${[...historicalRates].map(r => r / 100 + "%").join(", ")}). `
            + `Production should apply per-entry rates for exact catch-up calculation.`,
          6
        ));
      }
    }
  } else {
    if (rateLookup.thresholdSingleMinor > 0 && taxableAmount < rateLookup.thresholdSingleMinor) {
      tdsAmountMinor = 0;
      netPayableMinor = totalAmount;
      riskSignals.push(createRiskSignal(
        RISK_SIGNAL_CODE.TDS_BELOW_THRESHOLD, "compliance", "info",
        `Invoice amount below single-transaction TDS threshold for section ${detection.section}.`,
        0
      ));
    } else {
      const calc = this.calculate(taxableAmount, effectiveRateBps, totalAmount);
      tdsAmountMinor = calc.tdsAmountMinor;
      netPayableMinor = calc.netPayableMinor;
    }
  }

  const currentFY = determineFY(new Date());
  if (fy !== currentFY) {
    riskSignals.push(createRiskSignal(
      RISK_SIGNAL_CODE.TDS_BACKDATED_THRESHOLD_ADJUSTMENT, "compliance", "warning",
      `Backdated invoice (FY ${fy}) processed in current FY (${currentFY}). `
        + `TDS computed against cumulative for the invoice's FY.`,
      5
    ));
  }

  return {
    tds: {
      section: detection.section, rate: effectiveRateBps,
      rateBps: effectiveRateBps, rateSource,
      amountMinor: tdsAmountMinor, taxableBaseMinor: taxableAmount,
      netPayableMinor, source: "auto",
      confidence: detection.confidence, quarter
    },
    riskSignals,
    ledgerDelta: {
      taxableAmountMinor: taxableAmount,
      tdsAmountMinor,
      rateBps: effectiveRateBps,
      rateSource,
      thresholdJustCrossed
    }
  };
}
```

**Note on threshold comparison (SR-04 fix):** The Income Tax Act uses the word "exceeds" for threshold applicability (e.g., "aggregate amount exceeds one lakh rupees"), which means strictly greater than. Therefore, `newCumulative <= annualThreshold` is the correct below-threshold branch (TDS does NOT apply when the amount equals the threshold). TDS applies only when the cumulative strictly exceeds (`>`) the threshold.

**Note on catch-up rate variance (DA-01 fix):** For MVP, catch-up TDS uses the current `effectiveRateBps` for the entire cumulative. When ledger entries show that prior invoices were processed at different rates (e.g., rate change mid-FY, or Section 197 certificate applied to some but not all), the `TDS_CATCHUP_RATE_VARIANCE` risk signal is emitted. Production should iterate entries and apply per-entry rates for exact catch-up calculation. See test scenario #23.

#### 4.1.2 TDS Rate Hierarchy (D-024)

```
Priority (highest wins, EXCEPT Section 197 overrides downward):

1. Section 197 lower deduction certificate -> use certificate rate [E14]
2. Section 206AB non-filer penalty -> higher of (2x rate, 5%) [E26] -- deferred, risk signal only [D-027]
3. Section 206AA no-PAN penalty -> minimum 20% [E7, C-004]
4. Tenant override rate (TenantComplianceConfig.tdsRates)
5. Standard rate (TdsRateTable)
```

**`resolveEffectiveRate` implementation:**

Per the PA-01 pure function constraint, `resolveEffectiveRate` is now a pure method. The orchestrator pre-fetches vendor data (including `lowerDeductionCert`) and cumulative data, and passes them as parameters. No DB calls inside this method.

```typescript
private resolveEffectiveRate(
  section: string,
  panCategory: string | null,
  panValid: boolean,
  pan: string | null | undefined,
  vendorFingerprint: string,
  fallbackLookup: TdsRateLookup,
  vendorCert?: LowerDeductionCert | null,
  cumulativeBaseMinor?: number,
  isFromTenantConfig?: boolean
): { effectiveRateBps: number; rateSource: TdsRateSource } {
  // Priority 1: Section 197 lower deduction certificate (overrides downward)
  if (vendorCert) {
    const now = new Date();
    const fy = determineFY(now);

    if (vendorCert.validFrom <= now && vendorCert.validTo >= now && vendorCert.financialYear === fy) {
      if ((cumulativeBaseMinor ?? 0) < vendorCert.maxAmountMinor) {
        return {
          effectiveRateBps: vendorCert.applicableRateBps,
          rateSource: TDS_RATE_SOURCE.SECTION_197
        };
      }
    }
  }

  // Priority 2: Section 206AB (non-filer) -- deferred per D-027, risk signal only

  // Priority 3: Section 206AA (no PAN penalty) -- C-004, E7
  // Section 206AA prescribes the higher of: (a) 20%, (b) twice the applicable rate, (c) 5%
  // Since 20% >= 5% always, the formula reduces to max(20%, 2 * applicable rate) (DA-02 fix)
  if (!pan || !panValid) {
    const penaltyRateBps = 2000; // 20%
    const effectiveRateBps = Math.max(penaltyRateBps, fallbackLookup.rateBps * 2);
    return {
      effectiveRateBps,
      rateSource: TDS_RATE_SOURCE.NO_PAN_206AA
    };
  }

  // Priority 4/5: Tenant override or standard (already resolved by lookupRate)
  return {
    effectiveRateBps: fallbackLookup.rateBps,
    rateSource: isFromTenantConfig
      ? TDS_RATE_SOURCE.TENANT_OVERRIDE
      : TDS_RATE_SOURCE.STANDARD
  };
}
```

**Section 194Q -- TDS on purchase of goods [Addressed: DA-08]:** Section 194Q (TDS on purchase of goods exceeding Rs 50 lakh in aggregate per vendor per FY) is not currently supported. The `TdsSectionMapping` framework can accommodate it without architectural changes -- it requires adding a new section entry with the appropriate rate, thresholds, and PAN category mappings. Tracked as a future section addition.

#### 4.1.3 TDS Taxable Base (C-008, C-015)

- **GST shown separately**: taxable base = invoice amount minus total GST [E11, CBDT Circular 23/2017]
- **GST inclusive (not shown separately)**: taxable base = full invoice amount [E29]

**`determineTaxableAmount` implementation (SR-05):**

```typescript
private determineTaxableAmount(invoice: ParsedInvoiceData): number {
  const gst = invoice.gst;
  const totalAmount = invoice.totalAmountMinor ?? 0;

  if (!gst) {
    return totalAmount;
  }

  const gstShownSeparately = (
    (gst.cgstMinor != null && gst.cgstMinor > 0) ||
    (gst.sgstMinor != null && gst.sgstMinor > 0) ||
    (gst.igstMinor != null && gst.igstMinor > 0)
  );

  if (gstShownSeparately) {
    const totalGst = (gst.cgstMinor ?? 0)
      + (gst.sgstMinor ?? 0)
      + (gst.igstMinor ?? 0)
      + (gst.cessMinor ?? 0);
    const taxableBase = gst.subtotalMinor ?? (totalAmount - totalGst);
    return Math.max(taxableBase, 0);
  }

  return totalAmount;
}
```

When GST components (CGST, SGST, or IGST) are present and non-zero, GST is considered "shown separately" per CBDT Circular 23/2017, and the taxable base excludes total GST. If `subtotalMinor` (the pre-GST amount) is available, it is used directly; otherwise, the taxable base is computed as `totalAmount - totalGst`. When GST is not shown separately (no non-zero GST components), TDS applies on the full invoice amount.

#### 4.1.4 FY Determination Utility (D-043, C-002)

Indian FY runs April 1 to March 31. All date comparisons use IST (UTC+05:30) because a UTC timestamp of March 31 23:00 is actually April 1 04:30 IST, which belongs to the next FY.

**Input contract (DA-03 fix):**

- `determineFY` and `determineQuarter` expect a **UTC `Date` object**. The functions internally convert to IST.
- **Invoice dates from OCR/user input** are interpreted as IST noon (12:00 IST = 06:30 UTC) to avoid boundary ambiguity. The pipeline normalizes invoice dates at ingestion time: `new Date(Date.UTC(year, month - 1, day, 6, 30, 0))` (IST noon in UTC).
- **System-generated dates** (e.g., `new Date()`) are already UTC and passed directly.
- Callers must never pass a date that has already been offset to IST -- doing so would double-offset.

```typescript
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function determineFY(date: Date): string {
  const istTime = new Date(date.getTime() + IST_OFFSET_MS);
  const year = istTime.getUTCFullYear();
  const month = istTime.getUTCMonth(); // 0-indexed

  if (month >= 3) { // April (3) onwards
    const startYear = year;
    const endYear = (year + 1) % 100;
    return `${startYear}-${String(endYear).padStart(2, "0")}`;
  } else { // Jan-March belongs to previous FY
    const startYear = year - 1;
    const endYear = year % 100;
    return `${startYear}-${String(endYear).padStart(2, "0")}`;
  }
}

export function determineQuarter(date: Date): TdsQuarter {
  const istTime = new Date(date.getTime() + IST_OFFSET_MS);
  const month = istTime.getUTCMonth(); // 0-indexed

  if (month >= 3 && month <= 5) return TDS_QUARTER.Q1;   // Apr-Jun
  if (month >= 6 && month <= 8) return TDS_QUARTER.Q2;   // Jul-Sep
  if (month >= 9 && month <= 11) return TDS_QUARTER.Q3;  // Oct-Dec
  return TDS_QUARTER.Q4;                                   // Jan-Mar
}
```

**Alternative (production recommendation):** Replace the manual offset with `Intl.DateTimeFormat` for robustness against DST edge cases (India does not observe DST, but this pattern is safer for future multi-timezone support):

```typescript
const IST_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Kolkata",
  year: "numeric", month: "numeric", day: "numeric"
});

function getISTComponents(date: Date): { year: number; month: number; day: number } {
  const parts = IST_FORMATTER.formatToParts(date);
  return {
    year: Number(parts.find(p => p.type === "year")!.value),
    month: Number(parts.find(p => p.type === "month")!.value),
    day: Number(parts.find(p => p.type === "day")!.value)
  };
}
```

#### 4.1.5 TDS Quarter & Deposit Deadlines

Based on **deduction date** (invoice date, or payment date if earlier for advances), NOT processing date [E28]:

| Quarter | Period | TDS Deposit Due Date |
|---|---|---|
| Q1 | April 1 -- June 30 | 7th July |
| Q2 | July 1 -- September 30 | 7th October |
| Q3 | October 1 -- December 31 | 7th January |
| Q4 | January 1 -- March 31 | 30th April (special for March) |

**[Addressed: DA-04]** The 30th April deposit deadline for Q4 (March deductions) applies to non-government deductors only. Government deductors must deposit TDS on the same day as the deduction is made, without waiting for the next month's 7th.

Late TDS interest (E13): Late deduction = 1% per month (part month = full month). Late deposit after deduction = 1.5% per month.

#### 4.1.6 TdsVendorLedgerService

**File:** `backend/src/services/compliance/TdsVendorLedgerService.ts`

```typescript
const MAX_ENTRIES_PER_LEDGER = 500;

export class TdsVendorLedgerService {
  async recordTdsToLedger(
    tenantId: string,
    vendorFingerprint: string,
    invoiceId: string,
    invoiceDate: Date,
    ledgerDelta: TdsLedgerDelta,
    section: string,
    financialYear: string,
    quarter: TdsQuarter
  ): Promise<TdsVendorLedgerDocument> {
    const now = new Date();
    const entry = {
      invoiceId, invoiceDate,
      taxableAmountMinor: ledgerDelta.taxableAmountMinor,
      tdsAmountMinor: ledgerDelta.tdsAmountMinor,
      rateBps: ledgerDelta.rateBps,
      rateSource: ledgerDelta.rateSource,
      quarter, recordedAt: now
    };

    const update: Record<string, unknown> = {
      $inc: {
        cumulativeBaseMinor: ledgerDelta.taxableAmountMinor,
        cumulativeTdsMinor: ledgerDelta.tdsAmountMinor,
        invoiceCount: 1
      },
      $push: {
        entries: { $each: [entry], $slice: -MAX_ENTRIES_PER_LEDGER }
      },
      $set: { lastUpdatedInvoiceId: invoiceId }
    };

    if (ledgerDelta.thresholdJustCrossed) {
      (update.$set as Record<string, unknown>).thresholdCrossedAt = now;
    }

    const doc = await TdsVendorLedgerModel.findOne(
      { tenantId, vendorFingerprint, financialYear, section },
      { invoiceCount: 1 }
    ).lean();

    if (doc && (doc.invoiceCount ?? 0) >= MAX_ENTRIES_PER_LEDGER) {
      await this.archiveOldestEntries(tenantId, vendorFingerprint, financialYear, section, 100);
    }

    const result = await TdsVendorLedgerModel.findOneAndUpdate(
      { tenantId, vendorFingerprint, financialYear, section },
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return result as TdsVendorLedgerDocument;
  }

  private async archiveOldestEntries(
    tenantId: string,
    vendorFingerprint: string,
    financialYear: string,
    section: string,
    count: number
  ): Promise<void> {
    const doc = await TdsVendorLedgerModel.findOne(
      { tenantId, vendorFingerprint, financialYear, section },
      { entries: { $slice: count } }
    ).lean();

    if (!doc || !doc.entries || doc.entries.length === 0) return;

    await TdsVendorLedgerArchiveModel.updateOne(
      { tenantId, vendorFingerprint, financialYear, section },
      { $push: { entries: { $each: doc.entries } } },
      { upsert: true }
    );

    await TdsVendorLedgerModel.updateOne(
      { tenantId, vendorFingerprint, financialYear, section },
      { $push: { entries: { $each: [], $slice: -MAX_ENTRIES_PER_LEDGER } } }
    );
  }

  async getCumulativeForVendor(
    tenantId: string,
    vendorFingerprint: string,
    financialYear: string,
    section: string
  ): Promise<{ cumulativeBaseMinor: number; cumulativeTdsMinor: number; invoiceCount: number; entries?: TdsLedgerEntry[] } | null> {
    const doc = await TdsVendorLedgerModel.findOne(
      { tenantId, vendorFingerprint, financialYear, section },
      { cumulativeBaseMinor: 1, cumulativeTdsMinor: 1, invoiceCount: 1, entries: 1 }
    ).lean();

    if (!doc) return null;

    return {
      cumulativeBaseMinor: doc.cumulativeBaseMinor ?? 0,
      cumulativeTdsMinor: doc.cumulativeTdsMinor ?? 0,
      invoiceCount: doc.invoiceCount ?? 0,
      entries: doc.entries ?? []
    };
  }

  async backfillFromExistingInvoices(tenantId: string): Promise<{
    processed: number;
    ledgerEntriesCreated: number;
    skipped: number;
    errors: string[];
  }> {
    let processed = 0;
    let ledgerEntriesCreated = 0;
    let skipped = 0;
    const errors: string[] = [];
    const BATCH_SIZE = 100;
    let lastId: string | null = null;

    while (true) {
      const query: Record<string, unknown> = {
        tenantId,
        status: { $in: ["PARSED", "NEEDS_REVIEW", "AWAITING_APPROVAL", "APPROVED", "EXPORTED"] },
        "compliance.tds.section": { $ne: null },
        "compliance.tds.amountMinor": { $ne: null }
      };

      if (lastId) {
        query._id = { $gt: lastId };
      }

      const invoices = await InvoiceModel
        .find(query)
        .sort({ _id: 1 })
        .limit(BATCH_SIZE)
        .select({ _id: 1, "parsed.invoiceDate": 1, "parsed.vendorName": 1, "compliance.tds": 1 })
        .lean();

      if (invoices.length === 0) break;

      for (const inv of invoices) {
        try {
          const invoiceDate = inv.parsed?.invoiceDate ?? inv.createdAt;
          const tds = inv.compliance?.tds;
          if (!tds?.section || tds.amountMinor == null) continue;

          const vendorName = inv.parsed?.vendorName;
          const vendorFingerprint = await this.resolveVendorFingerprint(tenantId, vendorName);
          if (!vendorFingerprint) {
            skipped++;
            errors.push(`Invoice ${String(inv._id)}: cannot resolve vendorFingerprint from vendor name "${vendorName ?? "(none)}". Skipped.`);
            processed++;
            continue;
          }

          const fy = determineFY(new Date(invoiceDate));
          const quarter = determineQuarter(new Date(invoiceDate));
          const taxableBase = tds.netPayableMinor != null && tds.amountMinor != null
            ? tds.netPayableMinor + tds.amountMinor
            : 0;

          const existingEntry = await TdsVendorLedgerModel.findOne({
            tenantId, financialYear: fy, section: tds.section,
            "entries.invoiceId": String(inv._id)
          }).lean();

          if (existingEntry) { processed++; continue; }

          await this.recordTdsToLedger(
            tenantId, vendorFingerprint, String(inv._id), new Date(invoiceDate),
            {
              taxableAmountMinor: taxableBase,
              tdsAmountMinor: tds.amountMinor,
              rateBps: tds.rate ?? 0,
              rateSource: "standard",
              thresholdJustCrossed: false
            },
            tds.section, fy, quarter
          );
          ledgerEntriesCreated++;
        } catch (err) {
          errors.push(`Invoice ${String(inv._id)}: ${(err as Error).message}`);
        }
        processed++;
      }
      lastId = String(invoices[invoices.length - 1]._id);
    }
    return { processed, ledgerEntriesCreated, skipped, errors };
  }

  private async resolveVendorFingerprint(tenantId: string, vendorName: string | undefined): Promise<string | null> {
    if (!vendorName) return null;
    const vendor = await VendorMasterModel.findOne(
      { tenantId, $or: [{ vendorName }, { aliases: vendorName }] },
      { vendorFingerprint: 1 }
    ).lean();
    if (vendor?.vendorFingerprint) return vendor.vendorFingerprint;
    return computeVendorFingerprint(vendorName);
  }
}
```

**Entry archival (SR-02 fix):** The `entries[]` array on `TdsVendorLedger` is capped at 500 entries via `$slice: -MAX_ENTRIES_PER_LEDGER`. When the cap is reached, the oldest entries are archived to a `TdsVendorLedgerArchive` collection (same schema as the entry subdocument, keyed by `{ tenantId, vendorFingerprint, financialYear, section }`). The `cumulativeBaseMinor` and `cumulativeTdsMinor` counters remain on the main document and are never reset -- they are the source of truth for cumulative totals. The archive is read-only and used for historical TDS reports and audit.

**Backfill vendorFingerprint resolution (SR-08 fix):** The backfill no longer passes an empty string for `vendorFingerprint`. Instead, it resolves the fingerprint from the invoice's vendor name by looking up `VendorMaster` (by name or alias). If no match is found, it computes a fingerprint using `computeVendorFingerprint()`. Invoices where the fingerprint cannot be resolved are skipped and reported in the `errors` array.

**Atomicity guarantees (D-038):** The `findOneAndUpdate` with `$inc` and `$push` is a single atomic MongoDB operation. Even under concurrent invoice processing, two simultaneous calls for the same vendor/section/FY will both succeed. On replica sets, full MongoDB transactions can wrap the orchestrator's call to `getCumulativeForVendor` + `computeTds` + `recordTdsToLedger` for full serializable consistency.

**Idempotency (D-041):** The backfill script checks for existing `entries.invoiceId` before upserting. Re-running produces no duplicate entries.

#### 4.1.7 Section 197 Lower Deduction Certificate

Vendors with valid certificates from the Assessing Officer are entitled to a reduced or nil TDS rate. Certificate validation logic:

1. Query vendor's `lowerDeductionCert` field (see Section 4.7.3 for schema).
2. Check `validFrom <= now <= validTo` and `financialYear === currentFY`.
3. Check whether cumulative TDS base for the FY has exceeded `maxAmountMinor`. If exhausted, standard rate applies.
4. If valid and within limits, use `applicableRateBps`. This overrides all other rates downward.
5. Emit `TDS_SECTION_197_APPLIED` risk signal.
6. If expired, emit `TDS_SECTION_197_EXPIRED` risk signal and fall through to standard hierarchy.

**API endpoint:** `POST /api/vendors/:fingerprint/cert` (see Section 5.2).

#### 4.1.8 GST Compliance

| Aspect | Current | Required (MVP) | Required (Post-MVP) |
|---|---|---|---|
| CGST/SGST/IGST breakdown | Yes | No change | -- |
| HSN/SAC per line item | Extracted, not exported | Export to Tally (Phase 6) | -- |
| gstTreatment field | New | regular, reverse_charge, exempt, nil_rated, composition | -- |
| itcEligible field | New | Boolean flag on invoice | GSTR-2B matching [OAR-015] |
| PLACEOFSUPPLY | Missing | Derive from GSTIN state code [D-031, C-017] | -- |
| e-Invoice/IRN | Schema exists | Validation only | Generation [E17] |
| RCM (Reverse Charge) | Not implemented | gstTreatment flag; Tally RCM entries (Phase 7) | Auto-detect |

#### 4.1.9 TCS Compliance

TCS rate applied per tenant config. Existing implementation is correct:
- TCS = base net payable x tcsRatePercent / 100
- Added to payment amount (vendor collects TCS from buyer)
- Flows into Tally XML as TCS Receivable ledger entry

**Gap**: No annual threshold tracking for TCS (Section 206C(1H) applies only above Rs 50 lakh per vendor per year). Deferred to post-MVP.

#### 4.1.10 MSME Compliance

Per VKL D-014, C-003; EIL E4, E16:

- MSMED Act 2006, Section 15: Payment to micro/small enterprises within agreed period, max 45 days from acceptance
- Interest on delayed payment: 3x bank rate, compounded monthly [E16]
- BillForge must: track agreed payment terms per vendor, enforce 45-day statutory cap, calculate interest liability on overdue payments, flag overdue MSME invoices as risk signal

**MSME interest formula [Addressed: DA-05]:**

```
interest = principal * ((1 + 3 * bankRate / 100 / 12) ^ months - 1)
```

Where `principal` is the outstanding amount in minor units, `bankRate` is the RBI bank rate (percentage), and `months` is the number of months overdue (fractional months rounded up). The bank rate is configurable via `msmeBankRatePercent` on `TenantComplianceConfig` (default: current RBI bank rate at time of deployment). This field must be updated when RBI revises the bank rate.

---

### 4.2 Payment Recording & Payment Voucher Export

#### 4.2.1 Payment Lifecycle State Machine

```
                  +-----------+
                  |   draft   |
                  +-----+-----+
                        |
           +------------+------------+
           |                         |
           v                         v
     +-----------+            +-------------+
     | approved  |            |  cancelled  | [terminal]
     +-----+-----+            +-------------+
           |
    +------+------+
    |             |
    v             v
+----------+  +--------+
| processed|  | failed |
| [terminal]  +----+---+
+----------+       |
                   v
             +-----------+
             |   draft   | (retry)
             +-----------+
```

**State transition guards:**

| From | To | Guard | Side Effects |
|---|---|---|---|
| `draft` | `approved` | Caller has `canApprovePayments`. All allocations still valid. | Sets `approvedBy`, `approvedAt` |
| `draft` | `cancelled` | Caller is `createdBy` or has `canApprovePayments` | None |
| `approved` | `processed` | System-initiated or caller has `canApprovePayments`. Allocations re-validated. | Atomic `$inc` on each invoice's `paidAmountMinor`. `paymentStatus` recomputed. Sets `processedAt`. |
| `approved` | `failed` | System-detected failure (bank rejection, timeout) | Sets `failureReason` |
| `failed` | `draft` | Caller has `canRecordPayments`. Allows editing before retry. | Clears `failureReason` |
| `approved` | `cancelled` | Caller has `canApprovePayments` | None |

**Reversal handling:** Reversal documents skip the `draft -> approved` workflow. They are created directly in `processed` status because the reversal of a payment is a corrective action initiated by an authorized user.

**Immutability rule (C-009)**: Once a payment reaches `processed` or `cancelled`, the document is never modified. The only way to "undo" a processed payment is via a reversal document.

#### 4.2.2 PaymentService

**File:** `backend/src/services/payment/PaymentService.ts`

```typescript
export class PaymentService {
  async createPayment(tenantId: string, input: CreatePaymentInput, userId: string): Promise<PaymentDocument>
  async approvePayment(tenantId: string, paymentId: string, userId: string): Promise<PaymentDocument>
  async processPayment(tenantId: string, paymentId: string, userId: string): Promise<PaymentDocument>
  async cancelPayment(tenantId: string, paymentId: string, userId: string): Promise<PaymentDocument>
  async allocateAdvancePayment(tenantId: string, paymentId: string, allocations: AllocationInput[], userId: string): Promise<PaymentDocument>
  async reversePayment(tenantId: string, paymentId: string, reason: string, userId: string): Promise<PaymentDocument>
  async getPayment(tenantId: string, paymentId: string): Promise<PaymentDocument | null>
  async listPayments(tenantId: string, filters: PaymentListFilters): Promise<{ items: PaymentDocument[]; total: number }>
  async getInvoicePaymentHistory(tenantId: string, invoiceId: string): Promise<PaymentDocument[]>
}
```

**Decomposition recommendation (PA-02):** `PaymentService` currently has 9+ methods spanning lifecycle management, allocation logic, and batch operations. For Phase 5+, decompose into three focused services sharing a common `PaymentRepository`:

| Service | Responsibility | Methods |
|---|---|---|
| `PaymentLifecycleService` | State transitions, guards, validation | `create`, `approve`, `process`, `cancel`, `reverse` |
| `PaymentAllocationService` | Invoice allocation, advance allocation, over-allocation prevention | `allocateAdvancePayment`, `validateAllocations`, `computeRemainingPayable` |
| `PaymentRunService` | Batch payment creation, grouping by vendor | `createPaymentRun`, `processPaymentRun` |
| `PaymentRepository` | Shared data access, queries, listing | `findById`, `list`, `getInvoicePaymentHistory`, `save` |

All three services inject `PaymentRepository` and `AuditLogService`. `PaymentLifecycleService` depends on `PaymentAllocationService` for re-validation at process time. This decomposition is not required for MVP but should be executed before adding bank file generation or multi-currency support.
```

**`createPayment()` validation rules:**

1. **Sum check**: `sum(allocations[].allocatedMinor)` must exactly equal `amountMinor`. For advance payments (`type="advance"`), `allocations` must be empty and `unallocatedMinor` is set to `amountMinor`.
2. **Invoice eligibility**: Each `allocation.invoiceId` must reference an invoice with status `APPROVED` or `EXPORTED`.
3. **Over-allocation prevention**: Each `allocation.allocatedMinor` must not exceed the invoice's remaining payable (`netPayableMinor - paidAmountMinor`).
4. **Duplicate UTR detection (C-010 / D-017)**: The unique sparse index on `{ tenantId, utrNumber }` rejects duplicates. Service catches MongoDB 11000 and returns descriptive error.
5. **Cash payment limit check (D-022 / C-012)**: If `method === "cash"` and `amountMinor > 20_000_00` (Rs 2,00,000), emit `CASH_PAYMENT_ABOVE_LIMIT` risk signal. The payment is still allowed (warns, not blocks).
6. **UTR format validation (D-020)**: Per payment method:
   - NEFT/RTGS: `/^[A-Za-z0-9]{16,22}$/`
   - UPI: non-empty
   - IMPS: `/^[A-Za-z0-9]+$/`
   - Cheque/Cash/Other: no validation
7. **RTGS minimum amount**: `amountMinor >= 2_00_000_00` (Rs 2,00,000) per RBI mandate.
8. **Payment number generation**: Auto-generated as `PAY-{YYYYMMDD}-{sequence}`. The `{ tenantId, paymentNumber }` unique index guarantees uniqueness.

**`processPayment()` -- atomic invoice updates (SR-01 fix):**

The original two-step pattern (`bulkWrite` of `$inc` followed by separate read + status recompute) had a TOCTOU race: a crash between steps would leave `paidAmountMinor` incremented but `paymentStatus` stale. The fix uses a single `findOneAndUpdate` per invoice with an aggregation pipeline update that atomically increments `paidAmountMinor` AND computes `paymentStatus` in one operation. When a replica set is available, the entire operation is wrapped in a MongoDB transaction.

```typescript
async processPayment(tenantId: string, paymentId: string, userId: string): Promise<PaymentDocument> {
  const session = this.mongoClient.startSession();

  try {
    let payment: PaymentDocument | null = null;

    await session.withTransaction(async () => {
      payment = await PaymentModel.findOne({ _id: paymentId, tenantId }).session(session);
      if (!payment || payment.status !== "approved") {
        throw new InvalidStateTransitionError(payment?.status, "processed");
      }

      for (const alloc of payment.allocations) {
        const netPayableField = {
          $ifNull: [
            "$compliance.tds.netPayableMinor",
            { $ifNull: ["$parsed.totalAmountMinor", 0] }
          ]
        };

        await InvoiceModel.findOneAndUpdate(
          { _id: alloc.invoiceId, tenantId },
          [
            {
              $set: {
                paidAmountMinor: { $add: [{ $ifNull: ["$paidAmountMinor", 0] }, alloc.netPaidMinor] }
              }
            },
            {
              $set: {
                paymentStatus: {
                  $switch: {
                    branches: [
                      { case: { $lte: ["$paidAmountMinor", 0] }, then: "unpaid" },
                      { case: { $lt: ["$paidAmountMinor", netPayableField] }, then: "partially_paid" },
                      { case: { $eq: ["$paidAmountMinor", netPayableField] }, then: "fully_paid" },
                    ],
                    default: "overpaid"
                  }
                }
              }
            }
          ],
          { session }
        );
      }

      payment.status = "processed";
      payment.processedAt = new Date();
      await payment.save({ session });
    });

    return payment!;
  } finally {
    await session.endSession();
  }
}
```

**Standalone MongoDB fallback:** If no replica set is available (development/test), omit `session`. The aggregation pipeline update still guarantees per-invoice atomicity (increment + status in one write). Cross-invoice consistency relies on the reconciliation script (see R14).
```

**`reversePayment()` (D-012 / C-009):**

Creates a new Payment document with `type="reversal"` and `reversesPaymentId` referencing the original. The original payment document is never mutated. Invoice `paidAmountMinor` is decremented by `$inc` with negative values, and `paymentStatus` is recomputed. Only `processed` payments can be reversed; a payment can only be reversed once.

**Payment status recomputation (pure function):**

```typescript
function computePaymentStatus(paidAmountMinor: number, netPayableMinor: number): InvoicePaymentStatus {
  if (paidAmountMinor <= 0) return "unpaid";
  if (paidAmountMinor < netPayableMinor) return "partially_paid";
  if (paidAmountMinor === netPayableMinor) return "fully_paid";
  return "overpaid";
}
```

#### 4.2.3 Advance Payment Flow (D-011)

1. **Create**: `POST /api/payments` with `type: "advance"`, `allocations: []`. `unallocatedMinor` set to `amountMinor`.
2. **Lifecycle**: `draft -> approved -> processed`. On `processed`, no invoice updates (no allocations).
3. **Invoice arrives**: AP clerk sees vendor has unallocated advance payments.
4. **Allocate**: `POST /api/payments/:id/allocate`. Validates `sum(allocations) <= unallocatedMinor`, each invoice is eligible, each allocation does not exceed remaining payable. Appends allocations, decrements `unallocatedMinor`, increments each invoice's `paidAmountMinor`, recomputes `paymentStatus`.

#### 4.2.4 Payment Run (Batch Processing, D-015)

AP clerk selects multiple approved invoices, system groups by vendor, creates one Payment per vendor:

```typescript
async createPaymentRun(
  tenantId: string,
  invoiceIds: string[],
  defaultMethod: PaymentMethod,
  userId: string
): Promise<PaymentRunDocument> {
  // 1. Fetch and validate invoices (APPROVED or EXPORTED)
  // 2. Group by vendorFingerprint
  // 3. For each vendor group, create Payment with allocations
  // 4. Create PaymentRun document linking all paymentIds
  // 5. Return PaymentRun
}
```

For MVP, the PaymentRun is a logical grouping. Bank-specific file generation (NEFT/RTGS bulk upload formats) is deferred.

#### 4.2.5 Payment Voucher XML Generation

**Function signature** (added to `backend/src/services/export/tallyExporter/xml.ts`):

```typescript
export interface PaymentVoucherInput {
  tenantCompanyName: string;
  bankLedgerName: string;
  vendorLedgerName: string;
  paymentNumber: string;
  paymentDate: Date;
  amountMinor: number;
  currency: string;
  utrNumber: string | null;
  vendorName: string;
  guid: string;
  allocations: Array<{
    invoiceNumber: string;
    allocatedMinor: number;
  }>;
}

export function buildPaymentVoucherPayload(input: PaymentVoucherInput): string
export function buildPaymentVoucherBatchXml(companyName: string, inputs: PaymentVoucherInput[]): string
```

**XML output per voucher:**

```xml
<VOUCHER VCHTYPE="Payment" ACTION="Create" OBJVIEW="Accounting Voucher View">
  <DATE>{YYYYMMDD}</DATE>
  <EFFECTIVEDATE>{YYYYMMDD}</EFFECTIVEDATE>
  <GUID>{sha256(tenantId:paymentId:exportVersion)}</GUID>
  <VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>
  <VOUCHERNUMBER>{paymentNumber}</VOUCHERNUMBER>
  <NARRATION>Payment to {vendorName} | Ref: {utrNumber}</NARRATION>
  <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>

  <!-- Bank Ledger (Credit -- money going out) -->
  <ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>{bankLedgerName}</LEDGERNAME>
    <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
    <AMOUNT>-{paymentAmount}</AMOUNT>
  </ALLLEDGERENTRIES.LIST>

  <!-- Vendor Ledger (Debit -- settling liability) -->
  <ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>{vendorLedgerName}</LEDGERNAME>
    <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
    <AMOUNT>{paymentAmount}</AMOUNT>
    <!-- One BILLALLOCATIONS per invoice -->
    <BILLALLOCATIONS.LIST>
      <NAME>{invoiceNumber}</NAME>
      <BILLTYPE>Agst Ref</BILLTYPE>
      <AMOUNT>{allocatedAmount}</AMOUNT>
    </BILLALLOCATIONS.LIST>
  </ALLLEDGERENTRIES.LIST>
</VOUCHER>
```

**Key rule (E9):** `BILLTYPE=Agst Ref` (Against Reference) settles the outstanding bill created by the Purchase Voucher. The `NAME` must exactly match the `REFERENCE` from the original Purchase Voucher.

**BILLALLOCATIONS sign convention [Addressed: DA-06]:** `BILLALLOCATIONS.AMOUNT` must always match the sign of the parent `ALLLEDGERENTRIES.AMOUNT`. For example, if the vendor ledger entry has `AMOUNT={positive}`, then each `BILLALLOCATIONS.AMOUNT` within that entry must also be positive. Mismatched signs cause Tally to reject the voucher or create incorrect outstanding balances.

#### 4.2.6 New Capabilities (D-036)

Three new capabilities added to `userCapabilitiesSchema`:

| Persona | `canRecordPayments` | `canApprovePayments` | `canExportPaymentVouchers` |
|---|---|---|---|
| `TENANT_ADMIN` | true | true | true |
| `ap_clerk` | true | false | true |
| `senior_accountant` | true | true | true |
| `ca` | true | true | true |
| `tax_specialist` | false | false | false |
| `firm_partner` | true | true | true |
| `ops_admin` | false | false | false |
| `audit_clerk` | false | false | false |
| `PLATFORM_ADMIN` | false | false | false |

---

### 4.3 Tally Integration Architecture

#### 4.3.1 Phase 0: Purchase Voucher XML Fixes (Critical, 1-2 days)

All five fixes target `backend/src/services/export/tallyExporter/xml.ts`.

**Fix 1: LEDGERENTRIES.LIST to ALLLEDGERENTRIES.LIST (C-005, E1)**

Global replacement. Tally Prime's XML import schema expects `ALLLEDGERENTRIES.LIST`.

**Fix 2: ISINVOICE No to Yes (E2)**

`ISINVOICE=No` tells Tally this is a non-invoice voucher. Must be `Yes` for bill tracking and GST return preparation.

**Fix 3: Add REFERENCE tag (E8)**

Add `<REFERENCE>{invoiceNumber}</REFERENCE>` after `VOUCHERNUMBER`. The `REFERENCE` field holds the supplier's invoice number, used by `BILLALLOCATIONS.LIST` to create and settle bills.

**Fix 4: Add EFFECTIVEDATE tag**

Add `<EFFECTIVEDATE>{YYYYMMDD}</EFFECTIVEDATE>` after `DATE`. Controls the date used for aging calculations in Tally.

**Fix 5: Add BILLALLOCATIONS.LIST inside party entry (E8)**

Insert inside the party (creditor) `ALLLEDGERENTRIES.LIST`:

```xml
<BILLALLOCATIONS.LIST>
  <NAME>{invoiceNumber}</NAME>
  <BILLTYPE>New Ref</BILLTYPE>
  <AMOUNT>-{netPayableAmount}</AMOUNT>
</BILLALLOCATIONS.LIST>
```

`BILLTYPE=New Ref` creates a new outstanding bill. This is the foundation for the entire bill tracking and payment settlement chain.

**Complete corrected buildVoucherElement function:**

```typescript
function buildVoucherElement(input: VoucherPayloadInput): string {
  const voucherNumber = xmlEscape(input.voucherNumber);
  const partyLedgerName = xmlEscape(input.partyLedgerName);
  const purchaseLedgerName = xmlEscape(input.purchaseLedgerName);
  const narration = xmlEscape(input.narration ?? "Invoice import from BillForge");
  const tcsAmountMinor = (input.tcs && input.tcs.amountMinor > 0) ? input.tcs.amountMinor : 0;
  const partyTotalMinor = Math.abs(input.amountMinor) + tcsAmountMinor;
  const totalAmount = formatAmount(partyTotalMinor, input.currency);
  const dateStr = formatTallyDate(input.date);
  const placeOfSupply = input.gstin ? deriveStateFromGstin(input.gstin) : undefined;

  const lines: string[] = [
    '        <VOUCHER VCHTYPE="Purchase" ACTION="Create" OBJVIEW="Accounting Voucher View">',
    `          <DATE>${dateStr}</DATE>`,
    `          <EFFECTIVEDATE>${dateStr}</EFFECTIVEDATE>`,
    "          <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>",
    `          <VOUCHERNUMBER>${voucherNumber}</VOUCHERNUMBER>`,
    `          <REFERENCE>${voucherNumber}</REFERENCE>`,
    '          <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>',
    "          <ISINVOICE>Yes</ISINVOICE>",
    `          <PARTYLEDGERNAME>${partyLedgerName}</PARTYLEDGERNAME>`,
    `          <NARRATION>${narration}</NARRATION>`
  ];

  if (input.gstin) {
    lines.push(`          <PARTYGSTIN>${xmlEscape(input.gstin)}</PARTYGSTIN>`);
  }
  if (placeOfSupply) {
    lines.push(`          <PLACEOFSUPPLY>${xmlEscape(placeOfSupply)}</PLACEOFSUPPLY>`);
  }
  if (input.companyGstin) {
    lines.push(`          <BASICBUYERNAME>${xmlEscape(input.companyName)}</BASICBUYERNAME>`);
  }

  // Party (Creditor) Entry with BILLALLOCATIONS
  lines.push(
    "          <ALLLEDGERENTRIES.LIST>",
    `            <LEDGERNAME>${partyLedgerName}</LEDGERNAME>`,
    "            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>",
    "            <ISPARTYLEDGER>Yes</ISPARTYLEDGER>",
    "            <ISLASTDEEMEDPOSITIVE>Yes</ISLASTDEEMEDPOSITIVE>",
    `            <AMOUNT>-${totalAmount}</AMOUNT>`,
    "            <BILLALLOCATIONS.LIST>",
    `              <NAME>${voucherNumber}</NAME>`,
    "              <BILLTYPE>New Ref</BILLTYPE>",
    `              <AMOUNT>-${totalAmount}</AMOUNT>`,
    "            </BILLALLOCATIONS.LIST>",
    "          </ALLLEDGERENTRIES.LIST>"
  );

  // Purchase/Expense and GST ledger entries follow existing logic
  // with ALLLEDGERENTRIES.LIST tag name...

  // TDS Payable entry (if applicable)
  if (input.tds && input.tds.amountMinor > 0) {
    const tdsAmount = formatAmount(Math.abs(input.tds.amountMinor), input.currency);
    lines.push(
      "          <ALLLEDGERENTRIES.LIST>",
      `            <LEDGERNAME>${xmlEscape(input.tds.ledgerName)}</LEDGERNAME>`,
      "            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>",
      `            <AMOUNT>-${tdsAmount}</AMOUNT>`,
      "          </ALLLEDGERENTRIES.LIST>"
    );
  }

  lines.push("        </VOUCHER>");
  return lines.join("\n");
}
```

**TDS Payable entry sign convention [Addressed: SR-10]:** The TDS Payable ledger entry uses `ISDEEMEDPOSITIVE=Yes` with a negative `AMOUNT` (Tally convention: credit to liability). An alternative valid pattern is `ISDEEMEDPOSITIVE=No` with a positive `AMOUNT`. This RFC uses the `Yes/negative` pattern for consistency with the party creditor entry, which also uses `ISDEEMEDPOSITIVE=Yes` with negative amount.

**wrapVouchersInEnvelope** gains the XML declaration:

```typescript
function wrapVouchersInEnvelope(escapedCompanyName: string, voucherElements: string[]): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<ENVELOPE>",
    // ... HEADER, BODY, DESC, STATICVARIABLES, DATA, TALLYMESSAGE ...
    ...voucherElements,
    "      </TALLYMESSAGE>",
    "    </DATA>",
    "  </BODY>",
    "</ENVELOPE>"
  ].join("\n");
}
```

#### 4.3.2 PLACEOFSUPPLY Derivation (D-031, C-017, E31)

GSTIN format: `SSXXXXXXXXXXXXC` where `SS` = 2-digit state code.

**State code lookup table** (40 codes, [Addressed: DA-07] added codes 28 and 99):

```typescript
const GSTIN_STATE_CODE_MAP: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
  "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
  "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh",
  "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
  "16": "Tripura", "17": "Meghalaya", "18": "Assam",
  "19": "West Bengal", "20": "Jharkhand", "21": "Odisha",
  "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "25": "Daman & Diu", "26": "Dadra & Nagar Haveli & Daman & Diu",
  "27": "Maharashtra", "28": "Andhra Pradesh (Old)", "29": "Karnataka", "30": "Goa",
  "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman & Nicobar Islands", "36": "Telangana",
  "37": "Andhra Pradesh", "38": "Ladakh", "97": "Other Territory",
  "99": "Centre Jurisdiction"
};

export function deriveStateFromGstin(gstin: string): string | undefined {
  if (!gstin || gstin.length < 2) return undefined;
  const stateCode = gstin.substring(0, 2);
  return GSTIN_STATE_CODE_MAP[stateCode];
}
```

Store `stateCode` and `stateName` on VendorMaster (see Section 4.7.3). Derive from GSTIN on first encounter.

#### 4.3.3 XML Encoding & Sanitization (D-032, C-016, E32)

- UTF-8 declaration: `<?xml version="1.0" encoding="UTF-8"?>` prepended
- Non-printable character sanitization: strip `U+0000-U+0008`, `U+000B`, `U+000C`, `U+000E-U+001F` before entity encoding
- Hindi/regional scripts: UTF-8 natively supported, no transliteration needed

```typescript
function xmlEscape(value: string): string {
  return value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
```

#### 4.3.4 Batch Export (D-029, C-018)

Replace per-invoice HTTP POST loop with batch XML construction and chunked delivery. Maximum 100 vouchers per `TALLYMESSAGE` (C-018). File-based path splits into multiple `TALLYMESSAGE` blocks for exports exceeding 100 invoices.

**Per-tenant export mutex [Addressed: PA-05]:** Only one export batch may be in-flight per tenant at any time. The `ExportBatch` collection tracks active batches with a `{ tenantId, status: "in_progress" }` query. If an export is already in progress for the tenant, the endpoint returns HTTP 429 (Too Many Requests) with a `Retry-After` header. This prevents concurrent exports from producing duplicate or interleaved XML payloads.

```typescript
async exportInvoices(invoices: InvoiceDocument[], tenantId?: string): Promise<ExportResultItem[]> {
  const effectiveConfig = tenantId ? await this.resolveEffectiveConfig(tenantId) : this.config;
  const validatedInputs = [];
  const results: ExportResultItem[] = [];

  // Validate each invoice
  for (const invoice of invoices) {
    const validation = validateInvoiceForExport(invoice, invoiceId, effectiveConfig);
    if (!validation.valid) { results.push({ invoiceId, success: false, error: validation.error }); continue; }
    validatedInputs.push({ invoice, input: validation.input!, invoiceId });
  }

  // Process in batches of 100
  const BATCH_SIZE = 100;
  for (let offset = 0; offset < validatedInputs.length; offset += BATCH_SIZE) {
    const batch = validatedInputs.slice(offset, offset + BATCH_SIZE);
    const batchXml = buildTallyBatchImportXml(effectiveConfig.companyName, batch.map(b => b.input));
    // POST to Tally or generate file...
  }
  return results;
}
```

#### 4.3.5 GUID-Based Deduplication (D-030, D-035)

```typescript
function generateTallyGuid(tenantId: string, entityId: string, exportVersion: number): string {
  return createHash("sha256").update(`${tenantId}:${entityId}:${exportVersion}`).digest("hex");
}
```

- First export (`exportVersion === 0`): `ACTION="Create"`. Increment to 1.
- Re-export (`exportVersion >= 1`): `ACTION="Alter"`. Increment.
- Partial re-export: only re-send failed invoices from the batch.

The `Invoice.export` subdocument gains `exportVersion: Number` and `guid: String` fields (see Section 4.7.4).

#### 4.3.6 Connectivity Model (D-028, E30)

| Phase | Approach |
|---|---|
| Phase 0-5 | File-based export: generate XML, user downloads, manual import into Tally |
| Phase 6+ | Desktop bridge agent (Electron/system tray) for direct localhost connectivity |

#### 4.3.7 Vendor Pre-Validation (Phase 6)

When the desktop agent is available:
1. Collect unique vendor names from export batch
2. Query Tally for existing Sundry Creditor ledgers
3. Compare: exact match, then normalized match (case-insensitive, whitespace-collapsed), then token overlap (Jaccard, threshold 0.7)
4. Missing vendors: auto-create in Tally (if `autoCreateVendors` enabled) or report to user
5. Use `tallyLedgerName` from VendorMaster if set

#### 4.3.8 ocrText Exclusion Bug Fix

`exportService.ts` excludes `ocrText` via `.select({ ocrText: 0 })`, but `resolveInvoiceTotalAmountMinor` falls back to `ocrText` parsing. This fallback is always `undefined`.

**Fix:** Remove the ocrText fallback from the exporter. An APPROVED invoice without `parsed.totalAmountMinor` has a data quality issue that should have been caught during review:

```typescript
const resolvedTotalAmountMinor = invoice.parsed?.totalAmountMinor ?? null;
if (resolvedTotalAmountMinor === null || resolvedTotalAmountMinor <= 0) {
  results.push({ invoiceId, success: false, error: "Invoice is missing parsed.totalAmountMinor." });
  continue;
}
```

---

### 4.4 Reconciliation Enhancement

#### 4.4.1 Algorithm Enhancements

The enhanced algorithm runs in four passes. Passes 1-2 execute today (modified). Passes 3-4 are new for Phase 5.

**Pass 1: 1:1 Scoring (Modified)**

Two corrections:

1. **TDS-adjusted amount matching (C-011).** Expected bank debit = `invoice.compliance.tds.netPayableMinor + invoice.compliance.tcs.amountMinor`. If TDS not set, fall back to `parsed.totalAmountMinor`.

2. **Date tolerance: +/-2 business days (D-023).** Business-day-aware scoring (Saturdays and Sundays skipped; Indian bank holidays not tracked in MVP):
   ```
   businessDays <= 2:  score += 10
   businessDays <= 5:  score += 5
   businessDays <= 15: score += 2
   ```

**Pass 2: Write Results**

Auto-match above threshold creates ReconciliationMapping rows (see Section 4.7.1) instead of updating inline fields.

**Pass 3: Split Detection (one transaction to many invoices, D-016)**

For each unmatched transaction after Pass 1:

```
FUNCTION detectSplits(txn, unmatchedInvoices, tolerance):
  vendorCandidates = filter by word overlap in txn.description
  IF length == 0 OR length > 50: RETURN null

  candidates = filter where expectedDebit <= target + tolerance
  candidates = sort descending by expectedDebit
  candidates = limit to 10 (D-016)

  // Subset-sum with branch-and-bound
  search(index, currentSum, currentSet):
    IF |currentSum - target| <= tolerance AND better than best: save
    IF currentSum >= target + tolerance: prune
    // Include or exclude candidates[index]

  IF bestSubset has >= 2 items: RETURN match
```

**Performance bounds:** N capped at 10 means worst case 2^10 = 1024 evaluations per transaction. Greedy sort + pruning reduces average to ~50-100.

**Pass 4: Aggregate Detection (many transactions to one invoice)**

For each unmatched invoice after Pass 3: find transactions with vendor name overlap, try contiguous windows of size 2-5, fall back to subset-sum.

#### 4.4.2 Migration: Inline Fields to Junction Table

**[Addressed: PA-07]** Simplified from 4 phases to 2 to reduce operational overhead and eliminate the dual-write consistency risk window.

**Phase 1: Deploy + backfill + switch reads (single release).** Deploy ReconciliationMapping model. Run cursor-based backfill (batch size 100, idempotent -- checks for existing rows before inserting). Switch all reads to junction table. All new writes go to junction table only. Feature flag: `RECONCILIATION_JUNCTION_ENABLED` (default true for new deploys). Inline fields are still populated during this phase for rollback safety but are not read.

**Phase 2: Remove inline fields (follow-up release).** Stop writing to `BankTransaction.matchedInvoiceId` and `Invoice.compliance.reconciliation`. Remove inline field writes from codebase. Point of no return -- verify 2+ weeks stability on Phase 1 before executing.

---

### 4.5 Audit Log

**File:** `backend/src/services/core/AuditLogService.ts`

```typescript
export class AuditLogService {
  async record(entry: {
    tenantId: string;
    entityType: AuditEntityType;
    entityId: string;
    action: string;
    previousValue?: unknown;
    newValue?: unknown;
    userId: string;
    userEmail?: string;
  }): Promise<void> {
    AuditLogModel.create({
      ...entry,
      timestamp: new Date()
    }).catch(err => {
      logger.error("auditlog.write.failed", {
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        error: err.message
      });
    });
  }
}
```

Per VKL D-039, writes are **fire-and-forget**. The `record()` method does not `await` the database write. The calling code is never blocked by an audit log write failure.

**Dead letter queue for failed writes [Addressed: PA-06]:** When an audit write fails (caught in the `.catch()` handler), the entry is pushed to an `AuditLogDLQ` collection with the same schema as `AuditLog` plus `error: String`, `failedAt: Date`, and `retryCount: Number` (default 0). A background job runs every 15 minutes, retries DLQ entries with exponential backoff (base 1 minute, max 1 hour, cap 5 retries). An alert fires if the DLQ contains entries older than 24 hours, indicating a persistent write failure that requires operator intervention.

**Actions dictionary:**

| Action | Entity Type | Trigger |
|---|---|---|
| `payment_recorded` | payment | PaymentService.create() |
| `payment_approved` | payment | PaymentService.approve() |
| `payment_reversed` | payment | PaymentService.reverse() |
| `payment_cancelled` | payment | PaymentService.cancel() |
| `tds_manual_override` | tds_override | compliance field edit |
| `gl_code_changed` | gl_override | compliance field edit |
| `reconciliation_matched` | reconciliation | auto/manual match |
| `reconciliation_unmatched` | reconciliation | unmatch |
| `invoice_approved` | approval | workflow step completion |
| `invoice_exported` | export | Tally export |
| `vendor_merged` | vendor | VendorService.merge() |
| `vendor_status_changed` | vendor | VendorService.update() |
| `section_197_cert_uploaded` | vendor | cert upload |
| `config_updated` | config | tenant config change |

---

### 4.6 Vendor Management

#### 4.6.1 VendorService

**File:** `backend/src/services/compliance/VendorService.ts`

```typescript
export class VendorService {
  async listVendors(tenantId: string, filters: { search?: string; vendorStatus?: VendorStatus; page?: number; pageSize?: number }): Promise<{ vendors: VendorMasterDocument[]; total: number }>
  async getVendor(tenantId: string, fingerprint: string): Promise<{ vendor: VendorMasterDocument; invoiceSummary: InvoiceSummary }>
  async updateVendor(tenantId: string, fingerprint: string, fields: VendorUpdateFields, userId: string, userEmail: string): Promise<VendorMasterDocument>
  async mergeVendors(tenantId: string, sourceFingerprint: string, targetFingerprint: string, userId: string, userEmail: string): Promise<MergeResult>
}
```

#### 4.6.2 Vendor Merge Algorithm

Merge consolidates all data from source vendor into target. The entire operation is wrapped in a MongoDB transaction (PA-04 fix). On standalone MongoDB without replica set, a `mergeStatus` field on the source vendor tracks progress for partial failure recovery.

**Transaction wrapper:**

```typescript
async mergeVendors(tenantId: string, sourceFingerprint: string, targetFingerprint: string, userId: string, userEmail: string): Promise<MergeResult> {
  const session = this.mongoClient.startSession();
  try {
    let result: MergeResult;
    await session.withTransaction(async () => {
      await VendorMasterModel.updateOne(
        { tenantId, vendorFingerprint: sourceFingerprint },
        { $set: { mergeStatus: "in_progress", mergeTargetFingerprint: targetFingerprint } },
        { session }
      );
      result = await this.executeMergeSteps(tenantId, sourceFingerprint, targetFingerprint, userId, userEmail, session);
    });
    return result!;
  } catch (err) {
    await VendorMasterModel.updateOne(
      { tenantId, vendorFingerprint: sourceFingerprint },
      { $set: { mergeStatus: "failed" } }
    );
    throw err;
  } finally {
    await session.endSession();
  }
}
```

**Merge steps (all within transaction session):**

1. **Merge aliases**: Combine target aliases + source name + source aliases (deduplicated).
2. **Update invoices**: All invoices referencing source vendor name/aliases update to target vendor name.
3. **Update payments (PA-03 fix)**: All `Payment` documents referencing the source vendor update `vendorName` and `vendorFingerprint` to the target vendor. This prevents denormalized `vendorName` from drifting after merge.
   ```typescript
   await PaymentModel.updateMany(
     { tenantId, vendorFingerprint: sourceFingerprint },
     { $set: { vendorFingerprint: targetFingerprint, vendorName: targetVendor.vendorName } },
     { session }
   );
   ```
4. **Merge TdsVendorLedger**: For each source ledger row, atomic `$inc` on target (cumulativeBaseMinor, cumulativeTdsMinor, invoiceCount), `$push` entries. Then delete source ledger rows.
5. **Merge VendorGlMapping**: Upsert into target, `$inc` usageCount, `$max` lastUsedAt. Delete source mappings.
6. **Merge VendorCostCenterMapping**: Same pattern as GL mappings.
7. **Update target**: Set merged aliases, `$inc` invoiceCount, `$max` lastInvoiceDate.
8. **Soft-delete source**: Set `vendorStatus: "inactive"`, `mergeStatus: "completed"`.
9. **Audit**: Record merge with full before/after.

**Standalone MongoDB fallback (PA-04):** When no replica set is available, the `mergeStatus` field on the source vendor (`"in_progress"` / `"completed"` / `"failed"`) enables recovery. A background job can detect `mergeStatus: "in_progress"` vendors that have been stuck for > 5 minutes and either retry or alert an admin. The `mergeTargetFingerprint` field stores the intended target for recovery.

---

### 4.7 Data Model Changes (Consolidated)

#### 4.7.1 New Model: ReconciliationMapping

```typescript
const reconciliationMappingSchema = new Schema(
  {
    tenantId: { type: String, required: true },
    bankTransactionId: { type: String, required: true },
    invoiceId: { type: String, required: true },
    paymentId: { type: String, default: null },
    allocatedMinor: {
      type: Number, required: true,
      validate: { validator: Number.isInteger, message: "allocatedMinor must be an integer." }
    },
    matchConfidence: { type: Number, default: null, min: 0, max: 100 },
    matchMethod: {
      type: String, enum: RECONCILIATION_MATCH_METHODS, required: true
    },
    createdBy: { type: String, default: null }
  },
  { timestamps: true }
);

reconciliationMappingSchema.index({ tenantId: 1, bankTransactionId: 1, invoiceId: 1 }, { unique: true });
reconciliationMappingSchema.index({ tenantId: 1, invoiceId: 1 });
reconciliationMappingSchema.index({ tenantId: 1, bankTransactionId: 1 });
```

#### 4.7.2 New Model: TdsVendorLedger

```typescript
const tdsVendorLedgerEntrySchema = new Schema(
  {
    invoiceId: { type: String, required: true },
    invoiceDate: { type: Date, required: true },
    taxableAmountMinor: { type: Number, required: true, validate: INTEGER_VALIDATOR },
    tdsAmountMinor: { type: Number, required: true, validate: INTEGER_VALIDATOR },
    rateBps: { type: Number, required: true },
    rateSource: { type: String, required: true, enum: ["section-197", "206aa-no-pan", "tenant-override", "standard"] },
    quarter: { type: String, required: true, enum: ["Q1", "Q2", "Q3", "Q4"] },
    recordedAt: { type: Date, required: true, default: Date.now }
  },
  { _id: false }
);

const tdsVendorLedgerSchema = new Schema(
  {
    tenantId: { type: String, required: true },
    vendorFingerprint: { type: String, required: true },
    financialYear: {
      type: String, required: true,
      validate: { validator: (v: string) => /^\d{4}-\d{2}$/.test(v), message: "YYYY-YY format required." }
    },
    section: { type: String, required: true },
    cumulativeBaseMinor: { type: Number, default: 0, validate: INTEGER_VALIDATOR },
    cumulativeTdsMinor: { type: Number, default: 0, validate: INTEGER_VALIDATOR },
    invoiceCount: { type: Number, default: 0 },
    thresholdCrossedAt: { type: Date, default: null },
    lastUpdatedInvoiceId: { type: String, default: null },
    entries: { type: [tdsVendorLedgerEntrySchema], default: [] }
  },
  { timestamps: true }
);

tdsVendorLedgerSchema.index({ tenantId: 1, vendorFingerprint: 1, financialYear: 1, section: 1 }, { unique: true });
tdsVendorLedgerSchema.index({ tenantId: 1, financialYear: 1, section: 1 });
tdsVendorLedgerSchema.index({ tenantId: 1, financialYear: 1, thresholdCrossedAt: 1 });
```

**TdsVendorLedgerArchive (SR-02 fix):** When the `entries[]` array on `TdsVendorLedger` exceeds 500 entries, oldest entries are archived here. Same entry schema, keyed by the same composite key.

```typescript
const tdsVendorLedgerArchiveSchema = new Schema(
  {
    tenantId: { type: String, required: true },
    vendorFingerprint: { type: String, required: true },
    financialYear: { type: String, required: true },
    section: { type: String, required: true },
    entries: { type: [tdsVendorLedgerEntrySchema], default: [] }
  },
  { timestamps: true }
);

tdsVendorLedgerArchiveSchema.index({ tenantId: 1, vendorFingerprint: 1, financialYear: 1, section: 1 }, { unique: true });
```

#### 4.7.3 New Model: Payment

```typescript
const PAYMENT_TYPES = ["standard", "advance", "reversal"] as const;
const PAYMENT_METHODS = ["neft", "rtgs", "upi", "imps", "cheque", "cash", "other"] as const;
const PAYMENT_STATUSES = ["draft", "approved", "processed", "failed", "cancelled"] as const;

const paymentAllocationSchema = new Schema(
  {
    invoiceId: { type: String, required: true },
    invoiceNumber: { type: String, required: true },
    allocatedMinor: { type: Number, required: true, min: 1, validate: INTEGER_VALIDATOR },
    tdsDeductedMinor: { type: Number, default: 0, validate: INTEGER_VALIDATOR },
    tcsCollectedMinor: { type: Number, default: 0, validate: INTEGER_VALIDATOR },
    netPaidMinor: { type: Number, required: true, validate: INTEGER_VALIDATOR }
  },
  { _id: false }
);

const paymentSchema = new Schema(
  {
    tenantId: { type: String, required: true },
    paymentNumber: { type: String, required: true },
    type: { type: String, enum: PAYMENT_TYPES, required: true, default: "standard" },
    reversesPaymentId: { type: String, default: null },
    vendorFingerprint: { type: String, required: true },
    vendorName: { type: String, required: true },
    paymentDate: { type: Date, required: true },
    amountMinor: { type: Number, required: true, min: 1, validate: INTEGER_VALIDATOR },
    currency: { type: String, required: true, default: "INR" },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    utrNumber: { type: String, default: null },
    chequeNumber: { type: String, default: null },
    bankLedgerName: { type: String, default: null },
    status: { type: String, enum: PAYMENT_STATUSES, required: true, default: "draft" },
    allocations: { type: [paymentAllocationSchema], default: [] },
    unallocatedMinor: { type: Number, default: 0, validate: INTEGER_VALIDATOR },
    paymentRunId: { type: String, default: null },
    reconciliationMappingId: { type: String, default: null },
    createdBy: { type: String, required: true },
    approvedBy: { type: String, default: null },
    approvedAt: { type: Date, default: null },
    processedAt: { type: Date, default: null },
    failureReason: { type: String, default: null },
    notes: { type: String, default: null }
  },
  { timestamps: true }
);

paymentSchema.index({ tenantId: 1, createdAt: -1 });
paymentSchema.index({ tenantId: 1, vendorFingerprint: 1, createdAt: -1 });
paymentSchema.index({ tenantId: 1, status: 1 });
paymentSchema.index({ tenantId: 1, paymentNumber: 1 }, { unique: true });
paymentSchema.index(
  { tenantId: 1, utrNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      utrNumber: { $exists: true },
      $and: [
        { utrNumber: { $ne: null } },
        { utrNumber: { $ne: "" } }
      ]
    }
  }
);
// SR-03 fix: The original `{ $type: "string" }` filter did not exclude empty strings,
// allowing duplicate empty-string UTRs to be silently accepted. Application contract:
// set utrNumber = null (not "") when no UTR is available. The service layer enforces
// this by normalizing empty strings to null before save.
paymentSchema.index({ tenantId: 1, paymentRunId: 1 }, { sparse: true });
paymentSchema.index({ tenantId: 1, "allocations.invoiceId": 1 });
paymentSchema.index({ tenantId: 1, type: 1, reversesPaymentId: 1 }, { sparse: true });
paymentSchema.index({ tenantId: 1, paymentDate: -1 });
```

**Minimum value enforcement [Addressed: SR-06]:** Both `amountMinor` (on the payment document) and `allocatedMinor` (on each allocation entry) carry a `min: 1` Mongoose validator to reject zero-value or negative payments at the schema layer. This ensures every persisted payment represents a positive monetary transfer.

#### 4.7.4 New Model: PaymentRun

```typescript
const PAYMENT_RUN_STATUSES = ["draft", "approved", "processed", "cancelled"] as const;

const paymentRunSchema = new Schema(
  {
    tenantId: { type: String, required: true },
    runDate: { type: Date, required: true },
    status: { type: String, enum: PAYMENT_RUN_STATUSES, required: true, default: "draft" },
    paymentIds: { type: [String], default: [] },
    totalAmountMinor: { type: Number, required: true, validate: INTEGER_VALIDATOR },
    invoiceCount: { type: Number, required: true, default: 0 },
    vendorCount: { type: Number, required: true, default: 0 },
    createdBy: { type: String, required: true }
  },
  { timestamps: true }
);

paymentRunSchema.index({ tenantId: 1, createdAt: -1 });
paymentRunSchema.index({ tenantId: 1, status: 1 });
```

#### 4.7.5 New Model: AuditLog

```typescript
const AUDIT_ENTITY_TYPES = [
  "invoice", "payment", "vendor", "bank_transaction",
  "reconciliation", "tds_override", "gl_override", "export",
  "approval", "config"
] as const;

const auditLogSchema = new Schema(
  {
    tenantId: { type: String, required: true },
    entityType: { type: String, enum: AUDIT_ENTITY_TYPES, required: true },
    entityId: { type: String, required: true },
    action: { type: String, required: true },
    previousValue: { type: Schema.Types.Mixed, default: null },
    newValue: { type: Schema.Types.Mixed, default: null },
    userId: { type: String, required: true },
    userEmail: { type: String, default: null },
    timestamp: { type: Date, required: true, default: Date.now }
  },
  { timestamps: false }
);

auditLogSchema.index({ tenantId: 1, entityType: 1, entityId: 1, timestamp: -1 });
auditLogSchema.index({ tenantId: 1, timestamp: -1 });
auditLogSchema.index({ tenantId: 1, userId: 1, timestamp: -1 });
auditLogSchema.index({ tenantId: 1, action: 1, timestamp: -1 });
// NO TTL index for compliance tenants (C-019: 8-year retention)
```

Design: `timestamps: false` (C-006: `timestamp` field is canonical). Insert-only constraint enforced at service layer.

**Data minimization policy [Addressed: SR-07]:** `previousValue` and `newValue` must contain only the changed fields, not full document snapshots. Maximum 10KB per entry enforced at the service layer -- entries exceeding this limit are truncated with a `truncated: true` flag before persistence.

#### 4.7.6 Model Extensions

**Invoice (add fields):**

```typescript
paymentStatus: {
  type: String,
  enum: ["unpaid", "partially_paid", "fully_paid", "overpaid"],
  default: "unpaid"
},
paidAmountMinor: {
  type: Number, default: 0,
  validate: { validator: Number.isInteger, message: "paidAmountMinor must be an integer." }
},
gstTreatment: {
  type: String,
  enum: ["regular", "reverse_charge", "exempt", "nil_rated", "composition"],
  default: "regular"
},
itcEligible: { type: Boolean, default: true },
```

New index: `{ tenantId: 1, paymentStatus: 1, "parsed.dueDate": 1 }` (aging queries).

**Invoice.export subdocument (add fields):**

```typescript
exportVersion: { type: Number, default: 0 },
guid: { type: String }
```

**VendorMaster (add fields):**

```typescript
tallyLedgerName: { type: String, default: null },
tallyLedgerGroup: { type: String, default: "Sundry Creditors" },
vendorStatus: {
  type: String,
  enum: ["active", "inactive", "blocked"],
  default: "active"
},
stateCode: { type: String, default: null },
stateName: { type: String, default: null },
lowerDeductionCert: {
  type: new Schema({
    certificateNumber: { type: String, required: true },
    validFrom: { type: Date, required: true },
    validTo: { type: Date, required: true },
    maxAmountMinor: { type: Number, required: true, validate: INTEGER_VALIDATOR },
    applicableRateBps: { type: Number, required: true },
    section: { type: String, required: true },
    financialYear: {
      type: String, required: true,
      validate: { validator: (v: string) => /^\d{4}-\d{2}$/.test(v) }
    },
    uploadedBy: { type: String, required: true },
    uploadedAt: { type: Date, required: true, default: Date.now }
  }, { _id: false }),
  default: null
}
```

```typescript
mergeStatus: {
  type: String,
  enum: ["none", "in_progress", "completed", "failed"],
  default: "none"
},
mergeTargetFingerprint: { type: String, default: null }
```

New index: `{ tenantId: 1, vendorStatus: 1 }`

**Tenant (add field):**

```typescript
tan: {
  type: String, default: null,
  validate: {
    validator: (v: string | null) => v === null || /^[A-Z]{4}\d{5}[A-Z]$/.test(v),
    message: "TAN must be 10 characters: 4 letters, 5 digits, 1 letter."
  }
}
```

**TenantExportConfig (add fields):**

```typescript
tallyBankLedger: { type: String, default: null },
tallyEndpointUrl: { type: String, default: null },
autoCreateVendors: { type: Boolean, default: false },
```

**ApprovalWorkflow (add field):**

```typescript
workflowType: { type: String, enum: ["invoice", "payment"], default: "invoice" }
```

#### 4.7.7 Shared Enum Constants (D-042)

**File:** `backend/src/types/enums.ts`

```typescript
export const PAYMENT_TYPES = ["standard", "advance", "reversal"] as const;
export type PaymentType = typeof PAYMENT_TYPES[number];

export const PAYMENT_METHODS = ["neft", "rtgs", "upi", "imps", "cheque", "cash", "other"] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

export const PAYMENT_STATUSES_PAYMENT = ["draft", "approved", "processed", "failed", "cancelled"] as const;
export type PaymentStatusPayment = typeof PAYMENT_STATUSES_PAYMENT[number];

export const INVOICE_PAYMENT_STATUSES = ["unpaid", "partially_paid", "fully_paid", "overpaid"] as const;
export type InvoicePaymentStatus = typeof INVOICE_PAYMENT_STATUSES[number];

export const VENDOR_STATUSES = ["active", "inactive", "blocked"] as const;
export type VendorStatus = typeof VENDOR_STATUSES[number];

export const GST_TREATMENTS = ["regular", "reverse_charge", "exempt", "nil_rated", "composition"] as const;
export type GstTreatment = typeof GST_TREATMENTS[number];

export const GL_CODE_SOURCES = [
  "vendor-default", "description-match", "category-default",
  "slm-classification", "manual"
] as const;
export type GlCodeSource = typeof GL_CODE_SOURCES[number];

export const RECONCILIATION_MATCH_METHODS = ["auto", "suggested", "manual"] as const;
export type ReconciliationMatchMethod = typeof RECONCILIATION_MATCH_METHODS[number];

export const AUDIT_ENTITY_TYPES = [
  "invoice", "payment", "vendor", "bank_transaction",
  "reconciliation", "tds_override", "gl_override", "export",
  "approval", "config"
] as const;
export type AuditEntityType = typeof AUDIT_ENTITY_TYPES[number];

export const TDS_RATE_SOURCE = {
  SECTION_197: "section-197",
  NO_PAN_206AA: "206aa-no-pan",
  TENANT_OVERRIDE: "tenant-override",
  STANDARD: "standard",
} as const;
export type TdsRateSource = (typeof TDS_RATE_SOURCE)[keyof typeof TDS_RATE_SOURCE];

export const TDS_QUARTER = { Q1: "Q1", Q2: "Q2", Q3: "Q3", Q4: "Q4" } as const;
export type TdsQuarter = (typeof TDS_QUARTER)[keyof typeof TDS_QUARTER];
```

Use these constants in both Mongoose schema `enum` declarations and TypeScript type annotations to guarantee they never drift.

**Enum pattern convention [Addressed: SR-09]:** Two patterns are used in this codebase. The **object pattern** (`{ KEY: 'value' } as const`) is used for enums that need both a constant name for code references and a string value for storage/serialization (e.g., `TDS_RATE_SOURCE`, `TDS_QUARTER`). The **array pattern** (`['value'] as const`) is used for simple string unions where the constant name would be identical to the value (e.g., `PAYMENT_TYPES`, `PAYMENT_METHODS`). Both patterns derive their TypeScript union type from the constant definition.

#### 4.7.8 Schema Fixes (Existing Models)

| # | Fix | Model | Details |
|---|---|---|---|
| 1 | GL_CODE_SOURCE enum | Invoice.ts | Add `"slm-classification"` to Mongoose enum for `compliance.glCode.source` |
| 2 | Integer validation | All `*Minor` fields | Add `validate: { validator: Number.isInteger }` (C-001). Full list: Invoice (14 fields), BankTransaction (3), BankAccount (1), TdsRateTable (2), TenantUserRole (1), TenantComplianceConfig (4) |
| 3 | TDS rate naming | TenantComplianceConfig | Rename `rateIndividual` to `rateIndividualBps`, `rateCompany` to `rateCompanyBps`, `rateNoPan` to `rateNoPanBps` |
| 4 | Dead fields | User | Remove `passwordHash`, `tempPassword`, `mustChangePassword`, `emailVerified`, `verificationTokenHash` (pre-Keycloak remnants) |
| 5 | Legacy fields | Invoice | Remove `riskFlags`, `riskMessages` (superseded by `compliance.riskSignals`) |
| 6 | Invite roles | TenantInvite | Expand role enum from `["ap_clerk"]` to all `TenantAssignableRoles` |
| 7 | Missing indexes | Invoice | Add `{ tenantId: 1, contentHash: 1 } sparse` for duplicate detection; `{ tenantId: 1, "compliance.tds.source": 1 }`; `{ tenantId: 1, "parsed.invoiceNumber": 1, "parsed.vendorName": 1 }` |
| 8 | Missing indexes | BankAccount | Add `{ tenantId: 1, status: 1 }` |
| 9 | Tenant isolation | MailboxNotificationEvent | Add `tenantId` field (required), backfill from User collection |

**Pre-validation fixup migration for integer validation:**

**Dry-run step [Addressed: EM-05]:** Before running updates, execute a count query per field to report affected document counts. Review the counts and investigate if more than 5% of documents are affected for any field -- a high percentage may indicate a systemic upstream issue (e.g., currency conversion bug) rather than normal floating-point drift.

```javascript
for (const field of minorFields) {
  const count = await db.invoices.countDocuments(
    { [field]: { $exists: true, $not: { $mod: [1, 0] } } }
  );
  console.log(`${field}: ${count} documents with non-integer values`);
}
```

**Update migration:**

```javascript
const minorFields = [
  "parsed.gst.subtotalMinor", "parsed.gst.cgstMinor", "parsed.gst.sgstMinor",
  "parsed.gst.igstMinor", "parsed.gst.cessMinor", "parsed.gst.totalTaxMinor",
  "compliance.tds.amountMinor", "compliance.tds.netPayableMinor",
  "compliance.tcs.amountMinor"
];
for (const field of minorFields) {
  await db.invoices.updateMany(
    { [field]: { $exists: true, $not: { $mod: [1, 0] } } },
    [{ $set: { [field]: { $round: [`$${field}`, 0] } } }]
  );
}
// Same for BankTransaction: debitMinor, creditMinor, balanceMinor
```

#### 4.7.9 Risk Signal Codes (Consolidated)

*Updated per PRD v1.2 -- complete catalog aligned with PRD Section 4.17.*

| Code | Category | Severity | Trigger |
|---|---|---|---|
| `TOTAL_AMOUNT_ABOVE_EXPECTED` | Financial | `warning` | Invoice exceeds configured maximum |
| `TOTAL_AMOUNT_BELOW_MINIMUM` | Financial | `info` | Unusually low amount |
| `DUE_DATE_TOO_FAR` | Data Quality | `warning` | Due date exceeds expected range |
| `MISSING_MANDATORY_FIELDS` | Data Quality | `warning` | Vendor name or amount missing |
| `PAN_FORMAT_INVALID` | Compliance | `warning` | PAN does not match expected format |
| `PAN_GSTIN_MISMATCH` | Compliance | `warning` | PAN does not match GSTIN |
| `TDS_SECTION_AMBIGUOUS` | Compliance | `warning` | Multiple sections could apply |
| `TDS_NO_PAN_PENALTY_RATE` | Compliance | `critical` | Missing or invalid PAN triggers 20% rate |
| `TDS_BELOW_THRESHOLD` | Compliance | `info` | Amount below single-transaction deduction threshold |
| `TDS_BELOW_ANNUAL_THRESHOLD` | Compliance | `info` | Cumulative below annual threshold, no TDS deducted |
| `TDS_ANNUAL_THRESHOLD_CROSSED` | Compliance | `warning` | This invoice caused cumulative to cross threshold |
| `TDS_BACKDATED_THRESHOLD_ADJUSTMENT` | Compliance | `warning` | Backdated invoice triggered catch-up TDS |
| `TDS_CATCHUP_RATE_VARIANCE` | Compliance | `warning` | Catch-up TDS computed at current rate but prior entries used different rates |
| `TDS_SECTION_197_APPLIED` | Compliance | `info` | Lower rate applied per vendor certificate |
| `TDS_SECTION_197_EXPIRED` | Compliance | `warning` | Section 197 certificate expired |
| `TDS_SECTION_197_EXHAUSTED` | Compliance | `warning` | Certificate limit exhausted |
| `TDS_NON_FILER_FLAG` | Compliance | `warning` | Vendor may be Section 206AB specified person |
| `TDS_CUMULATIVE_RECALC_NEEDED` | Compliance | `warning` | Manual section change impacted cumulative threshold |
| `TDS_MERGE_THRESHOLD_CROSSED` | Compliance | `warning` | Vendor merge caused threshold crossing |
| `TDS_RATE_CONFLICT` | Compliance | `warning` | Tenant override differs from statutory by > 500 bps |
| `TDS_RATE_TABLE_STALE` | Compliance | `warning` | TDS rate table has not been updated in > 13 months |
| `IRN_MISSING` | Compliance | `warning` | High-value invoice lacks e-invoice IRN |
| `IRN_FORMAT_INVALID` | Compliance | `warning` | IRN does not match expected format |
| `VENDOR_EINVOICE_MISSING` | Compliance | `warning` | Vendor above e-invoice threshold but no IRN |
| `GST_REVERSE_CHARGE_DETECTED` | Compliance | `info` | RCM keywords detected, treatment still regular |
| `ITC_BLOCKED` | Compliance | `warning` | ITC ineligible with reason |
| `INVALID_GSTIN_STATE_CODE` | Compliance | `warning` | GSTIN state code invalid |
| `GSTR2B_MISMATCH` | Compliance | `critical` | ITC at risk due to GSTR-2B mismatch |
| `MSME_PAYMENT_DUE_SOON` | Compliance | `warning` | MSME invoice approaching 45-day deadline |
| `MSME_PAYMENT_OVERDUE` | Compliance | `critical` | Payment to MSME vendor past 45-day statutory limit |
| `MSME_PAYMENT_APPROACHING` | Compliance | `warning` | Payment to MSME vendor within 7 days of deadline |
| `VENDOR_BANK_CHANGED` | Fraud | `critical` | Vendor bank details differ from history |
| `SENDER_FREEMAIL` | Fraud | `warning` | Invoice from freemail but vendor previously used corporate domain |
| `SENDER_DOMAIN_MISMATCH` | Fraud | `warning` | Sender domain does not match vendor's known email domains |
| `SENDER_FIRST_TIME` | Fraud | `info` | First invoice received from this email domain |
| `DUPLICATE_INVOICE_NUMBER` | Fraud | `critical` | Same vendor + invoice number seen before |
| `CASH_PAYMENT_ABOVE_LIMIT` | Financial | `warning` | Cash payment > Rs 2,00,000 (Section 40A(3)) |
| `VENDOR_BLOCKED` | Compliance | `critical` | Invoice from a blocked vendor |
| `BANK_PAYMENT_VERIFIED` | Financial | `info` | Payment matched to bank statement |

**MSME signal escalation [Addressed: EM-07]:** MSME risk signals are evaluated by a nightly cron job that scans all unpaid invoices with MSME-registered vendors. `MSME_PAYMENT_APPROACHING` signals auto-escalate to `MSME_PAYMENT_OVERDUE` (severity `critical`) when the 45-day deadline passes. Signals are persisted on the invoice's `compliance.riskSignals` array so they survive across sessions and appear in exports. The cron job also recomputes interest liability using the MSME interest formula (see Section 4.1.10).

**Note on implementation code [Addressed: PA-09]:** TypeScript code in this RFC defines behavioral contracts and interface shapes. Implementers should use these as reference specifications; exact implementation may vary based on codebase conventions and testing requirements.

---

## 5. API Contracts (Consolidated)

### 5.1 Payments

```
POST   /api/payments                    -- Record a payment
GET    /api/payments                    -- List payments (filters: vendor, date, status, method, type)
GET    /api/payments/:id                -- Payment detail
PATCH  /api/payments/:id                -- Update draft payment
POST   /api/payments/:id/approve        -- Approve payment
DELETE /api/payments/:id                -- Cancel draft/approved payment
POST   /api/payments/:id/allocate       -- Allocate advance payment to invoice(s)

Auth: requireAuth, requireNotViewer, requireCap("canRecordPayments")
Approve: requireCap("canApprovePayments")
```

**POST /api/payments validation rules:**
- `sum(allocations[].allocatedMinor)` must equal `amountMinor` (for type="standard")
- `allocations` must be empty for type="advance"
- Each invoiceId must exist, belong to tenant, status IN (APPROVED, EXPORTED)
- Each allocatedMinor must not exceed invoice's remaining payable
- UTR unique within tenant (C-010)
- Cash > Rs 2,00,000 emits risk signal (does not reject)
- RTGS amountMinor >= Rs 2,00,000 (E23)
- UTR format validated per method (D-020)

### 5.2 Vendors

```
GET    /api/vendors                     -- List vendors (search, pagination, status filter)
GET    /api/vendors/:fingerprint        -- Vendor detail with invoice history
PATCH  /api/vendors/:fingerprint        -- Update vendor (tallyLedgerName, status, defaultGlCode, etc.)
POST   /api/vendors/:fingerprint/merge  -- Merge two vendor fingerprints
POST   /api/vendors/:fingerprint/cert   -- Upload Section 197 lower deduction certificate (D-013)

Auth: requireAuth
Merge/Cert: TENANT_ADMIN only
```

**POST /api/vendors/:fingerprint/cert validation:**
- `certificateNumber` non-empty, unique per vendor per FY
- `validFrom` < `validTo`
- `maxAmountMinor` > 0, integer
- `applicableRateBps` >= 0 (0 = nil deduction)
- `section` matches a known TDS section
- `financialYear` matches YYYY-YY format
- No overlapping certificates for same section and FY

### 5.3 Reports

```
GET    /api/reports/tds-liability       -- TDS liability by vendor/section/FY (from TdsVendorLedger)
GET    /api/reports/payment-aging       -- Invoice aging buckets (D-018)
GET    /api/reports/vendor-summary      -- Payment and invoice history for a vendor
GET    /api/reports/reconciliation      -- Match rates and value gaps across statements

Auth: requireAuth
Query params: fy (required for TDS), vendorFingerprint (optional), section (optional), quarter (optional)
```

**GET /api/reports/tds-liability response:**

```typescript
{
  tenantId: string,
  tan: string | null,
  financialYear: string,
  summary: {
    totalVendors: number,
    totalTdsLiabilityMinor: number,
    totalTaxableBaseMinor: number,
    vendorsCrossingThreshold: number,
    vendorsBelowThreshold: number,
    byQuarter: {
      Q1: { tdsMinor: number, baseMinor: number, invoiceCount: number },
      Q2: { tdsMinor: number, baseMinor: number, invoiceCount: number },
      Q3: { tdsMinor: number, baseMinor: number, invoiceCount: number },
      Q4: { tdsMinor: number, baseMinor: number, invoiceCount: number }
    }
  },
  vendors: [{
    vendorFingerprint: string,
    vendorName: string,
    pan: string | null,
    section: string,
    cumulativeBaseMinor: number,
    cumulativeTdsMinor: number,
    invoiceCount: number,
    thresholdMinor: number,
    thresholdCrossedAt: string | null,
    lowerDeductionCert: { certificateNumber, applicableRateBps, validTo } | null,
    entries: [{ invoiceId, invoiceDate, taxableAmountMinor, tdsAmountMinor, rateBps, rateSource, quarter }]
  }],
  pagination: { page, pageSize, totalCount, totalPages }
}
```

**GET /api/reports/payment-aging response:**

```typescript
{
  buckets: [
    { label: "Current", range: "Not yet due", count, totalOutstandingMinor, msmeCount, msmeTotalMinor },
    { label: "1-30", range: "1-30 days past due", ... },
    { label: "31-60", range: "31-60 days past due", ... },
    { label: "61-90", range: "61-90 days past due", ... },
    { label: "90+", range: "90+ days past due", ... }
  ],
  totalOutstandingMinor, totalCount, msmeOverdueCount, msmeOverdueTotalMinor
}
```

### 5.4 Reconciliation Mappings

```
POST   /api/reconciliation-mappings     -- Create manual split/aggregate mapping
GET    /api/reconciliation-mappings     -- List mappings for a statement
DELETE /api/reconciliation-mappings/:id -- Remove mapping

Auth: requireAuth, requireCap("canApproveInvoices")
```

### 5.5 Tally Payment Voucher Export

```
POST   /api/exports/tally/payment-vouchers  -- Export payment vouchers to Tally XML

Auth: requireAuth, requireNotViewer, requireCap("canExportPaymentVouchers")
Body: { paymentIds: string[] }  // max 100 per batch (C-018)

Validation:
  - Each payment must be "processed" status
  - Each payment must have at least one allocation
  - Tenant must have tallyBankLedger configured or each payment must have bankLedgerName

Response: { batchId, fileKey, filename, total, successCount, failureCount, items[] }
```

---

## 6. Migration Plan (Consolidated, Ordered by Dependency)

### Phase 0: Tally XML Fixes & Schema Fixes (1-2 days)

**Dependency: None. Execute IMMEDIATELY.**

| Step | Change | Risk | Rollback |
|---|---|---|---|
| 0.1 | `LEDGERENTRIES.LIST` to `ALLLEDGERENTRIES.LIST` in xml.ts | None | Revert tag name |
| 0.2 | `ISINVOICE` to `Yes` | None | Revert to `No` |
| 0.3 | Add `<REFERENCE>` tag | None | Remove tag |
| 0.4 | Add `<EFFECTIVEDATE>` tag | None | Remove tag |
| 0.5 | Add `BILLALLOCATIONS.LIST` inside party entry | None | Remove block |
| 0.6 | Add `PLACEOFSUPPLY` (GSTIN state code lookup) | None | Remove tag |
| 0.7 | Add `<?xml version="1.0" encoding="UTF-8"?>` declaration | None | Remove line |
| 0.8 | Add `"slm-classification"` to GL_CODE_SOURCE enum | None (additive) | Remove value |
| 0.9 | ocrText exclusion bug fix in tallyExporter.ts | Low | Revert |
| 0.10 | Update all existing xml.test.ts assertions | None | Revert |

### Phase 0.5: Export Infrastructure (3-4 days)

**Dependency: Phase 0.**

| Step | Change |
|---|---|
| 0.5.1 | GUID generation + exportVersion counter on Invoice.export |
| 0.5.2 | Batch export chunking (100-voucher limit) |
| 0.5.3 | ExportBatch per-invoice items + re-export endpoint |
| 0.5.4 | xmlEscape sanitization enhancement (non-printable chars) |

### Phase 1: TDS Cumulative Threshold + Schema Fixes (2-3 weeks)

**Dependency: None. Start in parallel with Phase 2.**

| Step | Change | Risk |
|---|---|---|
| 1.1 | Run integer fixup script for all `*Minor` fields | Low (rounding < 1 unit) |
| 1.2 | Add `Number.isInteger` validators to all `*Minor` fields | Low |
| 1.3 | Add missing indexes (contentHash, tds.source, invoiceNumber+vendorName, BankAccount status) | None |
| 1.4 | Rename TDS rate fields in TenantComplianceConfig (rateIndividual to rateIndividualBps) | Medium (coordinated deploy) |
| 1.5 | Define shared enum constants in `types/enums.ts` | None |
| 1.6 | Create TdsVendorLedger model | None |
| 1.7 | Create TdsVendorLedgerService (upsert, getCumulative) | None |
| 1.8 | Add `determineFY()` / `determineQuarter()` utilities | None |
| 1.9 | Modify `TdsCalculationService.computeTds()` (cumulative threshold, rate hierarchy, GST exclusion, quarter) | Medium |
| 1.10 | Add new risk signal codes | None |
| 1.11 | Backfill migration script | Low (idempotent) |
| 1.12 | Add `GET /api/reports/tds-liability` endpoint | None |
| 1.13 | 100% branch coverage tests (24 scenarios) | None |

**Phase 1 rollback plan [Addressed: EM-04]:** Feature flag `TDS_CUMULATIVE_ENABLED` (default `false` in production until validated). When disabled, `computeTds` skips cumulative lookup and uses per-invoice-only logic (pre-Phase-1 behavior). Rollback script: drop `TdsVendorLedger` entries for the affected tenant and re-trigger compliance enrichment on all affected invoices in PARSED/NEEDS_REVIEW/AWAITING_APPROVAL status. The feature flag and rollback script must be tested as part of 1.13 before enabling in production.

### Phase 2: Vendor CRUD & Fields + Audit Log (1-2 weeks, parallel with Phase 1)

**Dependency: None.**

| Step | Change |
|---|---|
| 2.1 | Create AuditLog model and AuditLogService |
| 2.2 | Create ReconciliationMapping model + begin dual-write |
| 2.3 | Backfill existing matches into ReconciliationMapping |
| 2.4 | Add fields to VendorMaster (tallyLedgerName, vendorStatus, stateCode, stateName, lowerDeductionCert) |
| 2.5 | Add TAN to Tenant model |
| 2.6 | Add tenantId to MailboxNotificationEvent + backfill |
| 2.7 | Create VendorService (CRUD, merge) + API endpoints |
| 2.8 | Section 197 certificate upload endpoint |
| 2.9 | Modify Tally export to use tallyLedgerName when set |

### Phase 3: Payment Model & Recording (2-3 weeks)

**Dependency: Phase 2 (vendor fields, audit log).**

| Step | Change |
|---|---|
| 3.1 | Create Payment model + PaymentRun model |
| 3.2 | Add paymentStatus, paidAmountMinor, gstTreatment, itcEligible to Invoice |
| 3.3 | Create PaymentService (create, approve, process, cancel, allocate, reverse) |
| 3.4 | Payment CRUD API endpoints |
| 3.5 | Advance payment + allocation flow |
| 3.6 | Payment reversal flow |
| 3.7 | Payment run (batch creation) |
| 3.8 | New capabilities (canRecordPayments, canApprovePayments, canExportPaymentVouchers) |
| 3.9 | Cash payment + MSME risk signals |

### Phase 4: Payment Voucher Export (1-2 weeks)

**Dependency: Phase 3.**

| Step | Change |
|---|---|
| 4.1 | `buildPaymentVoucherPayload()` + `buildPaymentVoucherBatchXml()` in xml.ts |
| 4.2 | Add `tallyBankLedger`, `tallyEndpointUrl`, `autoCreateVendors` to TenantExportConfig |
| 4.3 | `POST /api/exports/tally/payment-vouchers` endpoint |
| 4.4 | GUID generation for payment vouchers |
| 4.5 | BILLALLOCATIONS with BILLTYPE="Agst Ref" |

### Phase 5: Reconciliation Enhancement (2-3 weeks)

**Dependency: Phase 3 (Payment model for paymentId linkage).**

| Step | Change |
|---|---|
| 5.1 | TDS-adjusted amount matching in reconciliation scoring (C-011) |
| 5.2 | Date tolerance +/-2 business days (D-023) |
| 5.3 | Cut over ReconciliationService reads to junction table (feature flag) |
| 5.4 | Split detection algorithm (limit 10 invoices, D-016) |
| 5.5 | Aggregate detection algorithm |
| 5.6 | Manual split/aggregate mapping endpoints |
| 5.7 | Stop writing to inline fields; deprecate |
| 5.8 | Reporting: aging report, reconciliation summary, vendor summary |

### Cleanup (2-3 days, after Phase 5 stable for 2+ weeks)

| Step | Change |
|---|---|
| C.1 | Remove dead User fields (passwordHash, tempPassword, etc.) |
| C.2 | Remove legacy Invoice fields (riskFlags, riskMessages) |
| C.3 | Expand TenantInvite role enum to TenantAssignableRoles |
| C.4 | Remove inline reconciliation fields (BankTransaction.matchedInvoiceId, Invoice.compliance.reconciliation) |
| C.5 | Add `workflowType` to ApprovalWorkflow |

### UX Quick Wins (parallel with all phases)

1. Risk signal default expansion for NEEDS_REVIEW
2. Risk indicator column in invoice table
3. PAN label clarification (L1/L2 to descriptive)
4. Action hints in status badges
5. Action Required queue
6. Pre-export validation modal
7. ARIA accessibility fixes

---

## 7. Test Plan (Consolidated)

### 7.1 TDS Cumulative Threshold Tests

100% branch coverage on `TdsCalculationService`, `TdsVendorLedgerService`, `determineFY`/`determineQuarter`.

| # | Scenario | Expected | Signals |
|---|---|---|---|
| 1 | Below threshold, no prior invoices | TDS = 0 | `TDS_BELOW_ANNUAL_THRESHOLD` |
| 2 | Exactly at threshold | Threshold crossed, catch-up TDS on full cumulative | `TDS_ANNUAL_THRESHOLD_CROSSED` |
| 3 | Above threshold, normal TDS | TDS on current invoice at applicable rate | None |
| 4 | Threshold crossing with catch-up | TDS = round(cumulative * rate) - prior TDS | `TDS_ANNUAL_THRESHOLD_CROSSED` |
| 5 | Backdated invoice (prior FY) | FY from invoice date, catch-up if applicable | `TDS_BACKDATED_THRESHOLD_ADJUSTMENT` |
| 6 | Multiple sections per vendor | Separate ledger rows, only crossed section triggers | Per-section |
| 7 | Section 197 override | Certificate rate applied | `TDS_SECTION_197_APPLIED` |
| 8 | Section 197 expired | Standard rate applied | `TDS_SECTION_197_EXPIRED` |
| 9 | Section 197 exhausted | Standard rate applied | `TDS_SECTION_197_EXHAUSTED` |
| 10 | No PAN penalty (206AA) | Rate = max(20%, standard) | `TDS_NO_PAN_PENALTY_RATE` |
| 11 | No PAN with Section 197 | Section 197 takes priority | Both signals |
| 12 | Concurrent processing | Both `$inc` succeed atomically, total correct | Verify final cumulative |
| 13 | FY boundary -- March 31 IST (Apr 1 in IST) | FY = next year | None |
| 14 | FY boundary -- March 31 UTC (still March in IST) | FY = current year | None |
| 15 | GST exclusion from base | Taxable = subtotalMinor (GST excluded) | None |
| 16 | GST not shown separately | Taxable = totalAmountMinor | None |
| 17 | Zero taxable amount | No TDS, early return | None |
| 18 | Tenant override rate | Rate from tenant config | None |
| 19 | Idempotent backfill | Second run: 0 entries created | None |
| 20 | Single-txn below but annual above | Catch-up TDS on full cumulative | `TDS_ANNUAL_THRESHOLD_CROSSED` |
| 21 | Ledger upsert for new vendor/section/FY | Document created with correct initial values | None |
| 22 | Quarter assignment for each month | Correct Q1-Q4 mapping in IST | None |
| 23 | Catch-up TDS with rate change during FY (DA-01) | Vendor had invoices at 1000 bps, rate changed to 1500 bps, catch-up uses current rate but emits `TDS_CATCHUP_RATE_VARIANCE` signal | `TDS_CATCHUP_RATE_VARIANCE`, `TDS_ANNUAL_THRESHOLD_CROSSED` |
| 24 | Exact threshold boundary (SR-04) | Cumulative exactly equals annual threshold -- no TDS deducted (threshold NOT exceeded) | `TDS_BELOW_ANNUAL_THRESHOLD` |

### 7.2 Payment Service Tests

100% branch coverage on `PaymentService`.

| Test Case | Branches |
|---|---|
| Create standard payment with valid allocations | Happy path |
| Sum mismatch | Validation rejection |
| Non-existent invoice | Eligibility check |
| PENDING invoice | Status eligibility |
| Exceeds remaining payable | Over-allocation |
| Duplicate UTR | C-010 detection |
| Cash payment above Rs 2L | Signal emitted |
| Cash payment at exactly Rs 2L | No signal (boundary) |
| RTGS below Rs 2L minimum | Validation rejection |
| Advance payment with empty allocations | unallocatedMinor set |
| Advance with non-empty allocations | Validation rejection |
| UTR format per method (NEFT valid/invalid, UPI, cheque) | D-020 |
| Approve from draft | State transition |
| Approve from non-draft | Rejection |
| Process updates invoice paidAmountMinor | Atomic $inc |
| Process: unpaid to partially_paid | Partial payment |
| Process: unpaid to fully_paid | Full payment |
| Multi-invoice payment | Multiple allocations |
| Cancel draft | No invoice side effects |
| Cancel processed | Rejection |
| Reverse processed payment | Creates reversal document (C-009) |
| Reverse decrements paidAmountMinor | Negative $inc |
| Reverse recomputes paymentStatus | Status recomputation |
| Double reversal rejected | Idempotency guard |
| Allocate advance to invoice | unallocatedMinor decremented |
| Allocate exceeding unallocated | Rejection |
| Payment number uniqueness | Sequence generation |

### 7.3 Tally XML Tests

100% branch coverage on `TallyExporter/xml.ts`.

| Test Case | Assertion |
|---|---|
| Basic voucher correct tags | `ALLLEDGERENTRIES.LIST`, `ISINVOICE=Yes`, `REFERENCE`, `EFFECTIVEDATE` |
| UTF-8 declaration | Starts with `<?xml version="1.0" encoding="UTF-8"?>` |
| VOUCHER ACTION attribute | Create vs Alter based on exportVersion |
| Party entry has BILLALLOCATIONS | `BILLTYPE=New Ref`, NAME matches REFERENCE |
| Non-party entries have NO BILLALLOCATIONS | Purchase, GST, TDS ledgers |
| PLACEOFSUPPLY derivation | Maharashtra=27, Karnataka=29, Delhi=07, invalid=omitted |
| GUID deterministic | Same input = same GUID |
| Amounts in major units | 150000 paise = "1500.00" |
| XML escaping special chars | `&` = `&amp;`, `<` = `&lt;` |
| Hindi vendor name | UTF-8 pass-through |
| Non-printable chars stripped | `\x00`, `\x0B` removed |
| Batch of 5 invoices | Single TALLYMESSAGE, 5 VOUCHER elements |
| Batch of 150 invoices | Two chunks (100 + 50) |
| Payment voucher: single invoice | BILLTYPE=Agst Ref |
| Payment voucher: multi-invoice | Multiple BILLALLOCATIONS.LIST |
| Payment voucher: bank credit (negative) | `-{amount}` |
| Payment voucher: vendor debit (positive) | `{amount}` |
| Batch payment voucher export | Multiple VOUCHER elements |
| NARRATION includes UTR | Format check |

### 7.4 Reconciliation Tests

100% branch coverage on `ReconciliationService`.

| Test Case | Assertion |
|---|---|
| Unique constraint prevents duplicate (tenantId, txnId, invId) | MongoDB error |
| allocatedMinor rejects float | Validation error |
| 1:1 match creates one ReconciliationMapping row | Row count = 1 |
| Split (1 txn to 3 invoices) creates 3 rows | Sum of allocatedMinor = txn.debitMinor |
| Aggregate (2 txns to 1 invoice) creates 2 rows | Sum of allocatedMinor = netPayable |
| TDS-adjusted matching uses netPayableMinor + tcsAmountMinor | Correct expectedDebit |
| Date tolerance +/-2 business days (Friday-Monday) | Correct scoring |
| Subset-sum finds correct combination from 10 candidates | Match found |
| Subset-sum returns null when no valid subset | No match |
| Rs 1 tolerance boundary | Edge case |
| Backfill is idempotent (run twice = same result) | No duplicates |
| Dual-write consistency | Inline and junction agree |

### 7.5 Tally Integration Validation (EM-02)

Automated unit tests validate XML structure, but Tally Prime's XML import behavior cannot be fully verified without a live Tally instance. The following manual test procedure must be executed before each release that touches the export pipeline.

**Prerequisites:**
- Tally Prime Release 4.0+ installed on a Windows machine (or VM)
- A test company created in Tally with ledgers: at least one Sundry Creditor, one Purchase account, one Bank account
- BillForge staging environment with test invoices and payments

**Manual test checklist:**

- [ ] Export a single Purchase Voucher XML from BillForge. Import into Tally via `Import Data > XML`. Verify: voucher appears in Day Book, party ledger shows outstanding bill, GSTR-2 data includes the entry.
- [ ] Export a batch of 5 Purchase Vouchers. Import. Verify: all 5 appear in Day Book. Outstanding report shows 5 bills.
- [ ] Export a Payment Voucher for one of the imported Purchase Vouchers. Import. Verify: Outstanding report shows the bill as settled (partially or fully). Payment appears in Bank Book.
- [ ] Export a Payment Voucher referencing 3 invoices (multi-allocation). Import. Verify: all 3 bills settled. BILLALLOCATIONS with `Agst Ref` match original `New Ref` names.
- [ ] Re-export the same Purchase Voucher (ACTION="Alter"). Import. Verify: no duplicate voucher created; existing voucher updated.
- [ ] Export a voucher with Hindi vendor name. Import. Verify: vendor name renders correctly in Tally.
- [ ] Export a voucher with PLACEOFSUPPLY. Import. Verify: Tally shows correct state in GST details.
- [ ] Export a voucher with TDS ledger entry. Import. Verify: TDS Payable ledger in Tally shows correct amount.
- [ ] Export 150 invoices (exceeds 100-voucher batch limit). Import both chunks. Verify: all 150 appear.
- [ ] Attempt to import a voucher with a non-existent ledger name. Verify: Tally returns LINEERROR and BillForge handles it gracefully.

**Frequency:** Before each release that modifies `xml.ts`, `tallyExporter.ts`, or `paymentVoucher.ts`. Results documented in release notes.

### 7.6 Audit Log Tests

| Test Case | Assertion |
|---|---|
| Insert-only (no update/delete exposed) | API check |
| Fire-and-forget does not block on DB failure | Timeout check |
| Timestamp set automatically | Field present |
| All 4 indexes present | Index verification |
| TDS override produces correct previousValue/newValue | Content check |
| Vendor merge audit references both fingerprints | Content check |
| No TTL index on collection | Compliance check (C-019) |

### 7.7 Vendor Service Tests

| Test Case | Assertion |
|---|---|
| listVendors with text search | Matching vendors returned |
| listVendors with status filter | Only matching status |
| listVendors pagination | Correct page/total |
| getVendor returns invoice summary | Aggregation correct |
| getVendor 404 for nonexistent | Error response |
| updateVendor creates audit log entry | Audit recorded |
| mergeVendors updates invoices | All source invoices moved |
| mergeVendors consolidates GL mappings | Upserts, increments usageCount |
| mergeVendors merges TdsVendorLedger | Sums cumulatives, concatenates entries |
| mergeVendors soft-deletes source | Status = "inactive" |
| mergeVendors rejects self-merge | Error |

### 7.8 Data Integrity Tests

| Test Case | Assertion |
|---|---|
| GL_CODE_SOURCE accepts "slm-classification" | Save succeeds |
| All *Minor fields reject floats | Validation error |
| TenantInvite accepts all TenantAssignableRoles | Save succeeds |
| MailboxNotificationEvent requires tenantId | Validation error when missing |
| Integer fixup rounds 99.5 to 100 | Correct rounding |
| TDS rate rename preserves values | Same data, new field names |

---

## 8. Risk Register (Consolidated, Deduplicated)

### Compliance Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | TDS cumulative threshold not tracked -- incorrect deduction, vendor disputes, IT notice | HIGH | Phase 1 priority. TdsVendorLedger with atomic ops. |
| R2 | TDS computed on GST-inclusive amount -- over-deduction, vendor complaints | HIGH | C-008, C-015: exclude GST when shown separately. |
| R3 | MSME payment deadline not enforced -- MSMED Act violation, interest liability | HIGH | D-014: track agreed terms + 45-day cap. Risk signals. |
| R4 | No TAN tracking -- Form 16A/26Q generation impossible | HIGH | D-009: add TAN to Tenant model. |
| R5 | Tally import produces non-invoice entries -- no bill tracking, no GST filing | HIGH | D-019: Phase 0 immediate fix. |
| R6 | Section 197 certificate validation is manual -- no TRACES API | MEDIUM | Accept at face value with audit trail. Defer TRACES to post-MVP (OAR-001). |
| R7 | Backdated invoice for closed FY triggers catch-up TDS -- mismatch with filed returns | HIGH | Emit `TDS_BACKDATED_THRESHOLD_ADJUSTMENT`. For FYs > 2 years old, escalate to `critical`. |

### Technical Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R8 | TdsVendorLedger race condition -- TOCTOU window between threshold read and write | MEDIUM | Atomic `$inc` prevents write-level races. After upsert, read back cumulative; if threshold crossed but missed, emit corrective write. On replica sets, use MongoDB transactions. |
| R9 | TdsVendorLedger backfill produces incorrect cumulative totals | MEDIUM | Use TDS data stored on invoice, not recompute. Verify sums. Idempotent script. |
| R10 | Reconciliation split-detection subset-sum is expensive for large datasets | LOW | Capped at 10 invoices (D-016). Greedy pre-filter + branch-and-bound limits worst case to 1024 evaluations. |
| R11 | Schema migration for integer validation breaks existing float data | MEDIUM | Run fixup script (round all *Minor fields) before deploying validators. |
| R12 | Dual-write period during ReconciliationMapping migration creates consistency risk | MEDIUM | Feature flag controls read source. Dual-write ensures both updated. Backfill is idempotent and verifiable. |
| R13 | Concurrent processPayment for same invoice -- over-allocation | HIGH | Re-validate remaining payable inside processPayment via findOneAndUpdate with $inc. On replica sets, use transactions. Reconciliation script recomputes paidAmountMinor from processed payments. **Monitoring [Addressed: EM-06]:** A nightly reconciliation job recomputes `paidAmountMinor` for every invoice from processed payments and alerts on any discrepancy (expected vs actual). Dashboard metric tracks payment concurrency (concurrent processPayment calls per invoice within a 1-second window). |
| R14 | Orphaned paidAmountMinor if processPayment fails mid-batch | MEDIUM | Wrap in MongoDB session/transaction. Add reconciliation script that recomputes from processed payments. |
| R15 | Payment voucher references invoice not yet exported to Tally (no matching "New Ref") | MEDIUM | Validate each allocated invoice has `status === EXPORTED` at export time. Warn user. |
| R16 | tallyBankLedger not configured when user attempts payment voucher export | LOW | Validate at POST and return 400 with clear message. |
| R17 | Existing Tally vouchers use old LEDGERENTRIES.LIST -- re-import creates duplicates | HIGH | GUID-based dedup with ACTION="Alter". For pre-GUID vouchers, provide one-time migration guide. |
| R18 | Batch import to Tally is all-or-nothing -- one bad voucher rejects batch | HIGH | Parse LINEERROR responses. Fall back to per-invoice export for failed batch. |
| R19 | Vendor merge incorrectly consolidates TDS cumulatives | HIGH | Atomic updates. Verification step recomputes from entries. Comprehensive tests. |
| R20 | TDS rate field renaming requires coordinated deploy | MEDIUM | Deploy migration first (adds new fields, preserves old). Deploy code (reads new). Cleanup removes old. |
| R21 | AuditLog collection grows unbounded without TTL (C-019: 8-year retention) | LOW | Monitor collection size. Archive to S3 for entries > 2 years in post-MVP. |

### Product Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R22 | Demo without payment recording unconvincing for finance directors | MEDIUM | D-034: demo scope includes TDS + vendor. Payment is Phase 3 (MVP). |
| R23 | 18-24 calendar week total timeline (adjusted for team size) too long for market entry | MEDIUM | D-033: parallelized phasing. Phase 0 + Phase 1 + 2 (parallel) = 4-5 weeks. Add second backend engineer to critical path phases. |
| R24 | Navigation restructure delays feature delivery | LOW | D-008: UX quick wins parallel, major redesign post-MVP. |
| R25 | TDS rate table seed data incorrectness (EM-03) | HIGH | Incorrect section rates, thresholds, or PAN categories cause systematic under/over-deduction. Mitigation: (1) Publish the full TDS rate table as a versioned JSON fixture in the repository. (2) Add a `tdsRateTable.verification.test.ts` that asserts every section's rate against the Income Tax Act rates for the current assessment year. (3) Designate an annual update owner (compliance lead or CTO) who reviews and updates the rate table within 2 weeks of the Finance Bill passage each year. (4) Emit `TDS_RATE_TABLE_STALE` risk signal if the rate table has not been updated in > 13 months. |

---

## 9. Timeline & Phasing

### Dependency Graph

```
Phase 0 (1-2 days) ─────────────────────────────────────┐
                                                         │
Phase 0.5 (3-4 days) ───────────────────────────────┐   │
                                                     │   │
Phase 1 (2-3 weeks) ──────┐                          │   │
  [TDS cumulative]         │                          │   │
                           ├──► Phase 3 (2-3 weeks) ──┤   │
Phase 2 (1-2 weeks) ──────┘    [Payment model]       │   │
  [Vendor, Audit]                     │               │   │
                                      ├──► Phase 4 (1-2 weeks) ──┐
                                      │    [Payment voucher]     │
                                      │    [depends: 0.5 + 3]    │
                                      │                          │
                                      └──► Phase 5 (2-3 weeks) ─┘
                                           [Reconciliation]

UX Quick Wins ─────────── parallel with all phases ──────────────
```

**[Addressed: PA-08]** Phase 4 (Payment Voucher Export) depends on both Phase 3 (Payment model) AND Phase 0.5 (Export Infrastructure -- GUID generation, batch chunking, xmlEscape sanitization). Phase 0.5 must complete before Phase 4 can begin, as payment voucher export reuses the GUID generation and batch XML envelope from Phase 0.5.

### Summary Timeline

**Team size assumption (EM-01 fix):** 2 backend engineers, 1 frontend engineer. Productivity factor: 70% (accounting for code review, meetings, context switching, on-call). Raw engineering weeks are adjusted by dividing by (team_size * productivity_factor).

| Phase | Raw Duration | Adjusted Duration (2BE + 1FE @ 70%) | Start Condition | Parallel? |
|---|---|---|---|---|
| Phase 0 | 1-2 days | 1-2 days (1 BE) | Immediately | -- |
| Phase 0.5 | 3-4 days | 3-4 days (1 BE) | Phase 0 complete | -- |
| Phase 1 | 2-3 weeks | 2-3 weeks (1 BE) | Immediately | Yes, with Phase 2 |
| Phase 2 | 1-2 weeks | 1-2 weeks (1 BE) | Immediately | Yes, with Phase 1 |
| Phase 3 | 2-3 weeks | 2-3 weeks (2 BE) | Phase 1 + 2 complete | -- |
| Phase 4 | 1-2 weeks | 1-2 weeks (1 BE) | Phase 3 complete | Yes, with Phase 5 |
| Phase 5 | 2-3 weeks | 2-3 weeks (1 BE) | Phase 3 complete | Yes, with Phase 4 |
| Cleanup | 2-3 days | 2-3 days (1 BE) | Phase 5 stable 2+ weeks | -- |
| UX Quick Wins | 1-2 weeks | 1-2 weeks (1 FE, parallel) | Any time | Yes |
| **Total** | **14-18 weeks** | **18-24 weeks (calendar)** | | |

**Adjusted critical path:** Phase 0 (2d) -> Phase 1 (3w) -> Phase 3 (3w) -> Phase 5 (3w) = ~9.5 weeks of serial backend work. With 70% productivity: ~13.5 calendar weeks for critical path. Total including parallel phases and cleanup buffer: **18-24 calendar weeks**.

**Single-engineer scenario:** If only 1 backend engineer is available, Phases 1 and 2 cannot run in parallel, and Phase 3 duration increases. Estimated total: **26-32 calendar weeks**.

---

## 10. VKL Traceability Matrix

| RFC Section | VKL Decisions | VKL Constraints | EIL Evidence |
|---|---|---|---|
| 3.1 TDS Compliance Gap | D-006, D-009, D-010, D-013, D-024 | C-001, C-002, C-004, C-007, C-008, C-014, C-015 | E3, E5, E7, E11, E13, E14, E15, E28, E29 |
| 3.2 Missing Payment Lifecycle | D-002, D-011, D-012, D-015, D-017, D-020, D-022 | C-001, C-009, C-010, C-012, C-013 | E9, E21, E22, E23, E25 |
| 3.3 Broken Tally Export | D-005, D-019, D-028, D-029, D-030, D-031, D-032, D-035 | C-005, C-016, C-017, C-018 | E1, E2, E8, E30, E31, E32 |
| 3.4 Reconciliation/Audit/Vendor | D-003, D-004, D-016, D-018, D-023, D-039, D-042, D-044 | C-001, C-003, C-006, C-011, C-019 | E4, E16, E19, E20 |
| 4.1 TDS Computation | D-006, D-010, D-024, D-025, D-026, D-027, D-038, D-043 | C-001, C-002, C-004, C-008, C-014, C-015, C-020 | E3, E7, E11, E13, E14, E26, E28, E29 |
| 4.2 Payment System | D-002, D-011, D-012, D-015, D-017, D-020, D-021, D-022, D-036 | C-001, C-009, C-010, C-012, C-013 | E9, E21, E22, E23 |
| 4.3 Tally Integration | D-005, D-019, D-028, D-029, D-030, D-031, D-032, D-035 | C-005, C-016, C-017, C-018 | E1, E2, E8, E9, E30, E31, E32 |
| 4.4 Reconciliation | D-003, D-016, D-023 | C-001, C-011 | E19 |
| 4.5 Audit Log | D-004, D-039 | C-006, C-019 | -- |
| 4.6 Vendor Management | D-013, D-018, D-031 | C-003 | E4, E14, E16 |
| 4.7.1 ReconciliationMapping | D-003 | C-001 | -- |
| 4.7.2 TdsVendorLedger | D-006, D-026 | C-001, C-002, C-014 | E3 |
| 4.7.3 Payment Model | D-002, D-011, D-012, D-017, D-020 | C-001, C-009, C-010, C-013 | E21, E22, E23 |
| 4.7.5 AuditLog | D-004, D-039 | C-006, C-019 | -- |
| 4.7.6 Invoice Extensions | D-001 | C-001 | -- |
| 4.7.6 VendorMaster Extensions | D-013, D-031 | -- | E14, E31 |
| 4.7.6 Tenant TAN | D-009 | C-007 | E15 |
| 4.7.7 Enum Constants | D-042 | -- | -- |
| 4.7.8 Schema Fixes | D-042 | C-001 | -- |
| 6. Migration Plan | D-019, D-033, D-034, D-041, D-044 | -- | -- |
| 7. Test Plan | D-040 | -- | -- |

---

## 11. Open Questions (OAR)

| ID | Severity | Question | Status |
|---|---|---|---|
| OAR-001 | HIGH | How to verify Section 197 certificate authenticity? TRACES API integration? | Partially resolved by D-013 (tracking). Verification deferred. |
| OAR-002 | HIGH | Invoice correction -> TDS recomputation strategy (reverse + recompute)? | Algorithm defined but implementation deferred. Risk signal for now. |
| OAR-003 | MED | Generate Form 26Q directly or export to TRACES-compatible FVU format? | Open. Recommend: export to FVU format (lower effort). |
| OAR-006 | HIGH | Payment reversal for bounced cheques -- does the model handle bank statement reversal detection? | D-012 defines model. Auto-detection from statement patterns is post-MVP. |
| OAR-007 | MED | Does target market use Tally statutory TDS module or manual Form 26Q filing? | Needs user research. Deferred TDS statutory integration to Phase 6. |
| OAR-008 | HIGH | TAN storage and propagation | **RESOLVED** by D-009. |
| OAR-009 | MED | Multi-currency Tally export (FOREIGNCURRENCYNAME, EXCHANGERATE)? | Post-MVP. India AP is predominantly INR. |
| OAR-010 | MED | TDS deposit (challan) tracking in-scope for MVP? | Deferred. Enables Form 26Q but adds complexity. |
| OAR-011 | MED | E-TDS filing: generate FVU file or integrate with TRACES? | Post-MVP. Recommend FVU file generation. |
| OAR-012 | LOW | Tax calendar feature? | Post-MVP. Standard in competitors but low priority. |
| OAR-013 | LOW | Payment advice generation (PDF/email to vendor)? | Post-MVP. Value-add, not compliance-critical. |
| OAR-014 | LOW | Three-way matching (PO-GRR-Invoice) architectural consideration? | Enterprise feature. Not for MVP. No schema changes needed now. |
| OAR-015 | MED | GSTR-2B reconciliation: native or third-party? | Recommend: GSTR-2B JSON import + matching. Post-MVP. |

---

## Appendix A: Payment Methods Reference

| Method | Settlement | Min/Max | UTR Format | Validation |
|---|---|---|---|---|
| NEFT | 24x7 batches [E22] | No limit | Alphanumeric 16-22 chars | Format regex |
| RTGS | Real-time | Min Rs 2,00,000 [E23] | Alphanumeric 16-22 chars | Min amount + format |
| UPI | Real-time | Max Rs 1,00,000 | Varies by app | Basic non-empty |
| IMPS | Real-time | Max Rs 5,00,000 | Alphanumeric | Basic non-empty |
| Cheque | 1-3 business days | No limit | 6-digit numeric | Length + numeric |
| Cash | Instant | Legal limit Rs 2,00,000 [E21, C-012] | N/A | Amount validation |

## Appendix B: Evidence Index (EIL)

| ID | Evidence | Source | Confidence |
|---|---|---|---|
| E1 | Tally requires ALLLEDGERENTRIES.LIST | TALLY | 0.95 |
| E2 | ISINVOICE=Yes for bill tracking | TALLY | 0.95 |
| E3 | Section 194C annual threshold Rs 1,00,000 | IT_ACT | 0.90 |
| E4 | MSMED Act Section 15: max 45 days | RBI | 1.0 |
| E5 | Form 26Q quarterly TDS return mandatory | IT_ACT | 1.0 |
| E6 | Form 16A within 15 days of quarterly filing | IT_ACT | 0.95 |
| E7 | Section 206AA: 20% TDS for no-PAN | IT_ACT | 1.0 |
| E8 | BILLALLOCATIONS with BILLTYPE="New Ref" | TALLY | 0.95 |
| E9 | Payment voucher BILLTYPE="Agst Ref" | TALLY | 0.95 |
| E10 | UPI/NEFT/RTGS per RBI regulations | RBI | 1.0 |
| E11 | TDS excludes GST if shown separately | CBDT Circ. 23/2017 | 0.95 |
| E12 | TDS deposit due 7th of following month | IT Rule 30 | 1.0 |
| E13 | Late TDS: 1% deduction, 1.5% deposit | Section 201(1A) | 1.0 |
| E14 | Section 197 lower deduction certificate | IT_ACT | 1.0 |
| E15 | TAN mandatory on Form 16A/26Q | IT_ACT | 1.0 |
| E16 | MSME interest: 3x bank rate compounded monthly | MSMED Act | 1.0 |
| E17 | E-invoice for turnover > Rs 5 crore | GST | 1.0 |
| E18 | ITC only if in GSTR-2B | GST Section 16 | 1.0 |
| E19 | Rs 1 rounding tolerance in bank reconciliation | RBI | 0.8 |
| E20 | Three-way matching is standard AP practice | ICAI | 0.9 |
| E21 | Cash > Rs 2L non-deductible | IT Act 40A(3) | 1.0 |
| E22 | NEFT 24x7 since Dec 2019 | RBI | 1.0 |
| E23 | RTGS min Rs 2 lakh | RBI | 1.0 |
| E24 | TDS challan due 7th of following month | IT Rule 30 | 1.0 |
| E25 | Form 15CA/15CB for foreign remittances | FEMA | 0.95 |
| E26 | Section 206AB: 2x rate or 5% for non-filers | IT_ACT | 1.0 |
| E27 | Surcharge + 4% HEC on TDS for non-residents | IT_ACT | 0.95 |
| E28 | TDS quarter = quarter of deduction date | IT_ACT | 1.0 |
| E29 | GST inclusive -> TDS on gross | CBDT Circ. 23/2017 | 0.95 |
| E30 | Tally on localhost port 9000, no cloud API | TALLY | 0.95 |
| E31 | GSTIN state codes 01-37 | GST | 1.0 |
| E32 | Tally XML UTF-8 recommended | TALLY | 0.85 |

## Appendix C: Service Layer Summary

| Service | File | Responsibility |
|---|---|---|
| PaymentService | `services/payment/PaymentService.ts` | CRUD, allocation validation, paymentStatus computation, duplicate detection. Post-MVP: decompose into PaymentLifecycleService, PaymentAllocationService, PaymentRunService (PA-02). |
| TdsCalculationService | `services/compliance/TdsCalculationService.ts` | Pure TDS computation (no side effects). Returns TDS result + ledger delta. |
| TdsVendorLedgerService | `services/compliance/TdsVendorLedgerService.ts` | Cumulative tracking, ledger persistence (`recordTdsToLedger`), entry archival, FY management, backfill |
| PaymentVoucherExporter | `services/export/tallyExporter/paymentVoucher.ts` | Tally payment voucher XML generation |
| VendorService | `services/compliance/VendorService.ts` | CRUD, merge (transactional), Tally sync fields, Section 197 cert management |
| AuditLogService | `services/core/AuditLogService.ts` | Immutable event recording (fire-and-forget) |
| ReportService | `services/reporting/ReportService.ts` | TDS liability, aging, vendor summary, reconciliation summary |

## Appendix D: Failure Handling

### Tally Export Failures

| Failure | Detection | Recovery |
|---|---|---|
| Tally offline | HTTP timeout/connection refused | Mark ExportBatch as "queued". User re-exports manually. |
| Ledger not found | Tally response LINEERROR | Report to user. Auto-create if `autoCreateVendors` enabled. |
| Duplicate voucher | Tally response ERRORS | Use GUID + ACTION="Alter" for re-export (D-030). |
| Invalid XML | Tally response parse error | Log full request/response. Report to user. |

### Payment Failures

| Failure | Detection | Recovery |
|---|---|---|
| Duplicate UTR | Unique index violation (C-010) | Reject with error message. |
| Over-allocation | Sum check at API layer | Reject with remaining payable amount. |
| Invoice not APPROVED/EXPORTED | Status check at API layer | Reject with current status. |
| Payment reversal of non-existent | Reference check | Reject with error. |

### TDS Computation Failures

| Failure | Detection | Recovery |
|---|---|---|
| No TDS section mapping found | Empty result from query | Emit SECTION_AMBIGUOUS risk signal. Default to no TDS. |
| TdsVendorLedger atomic update failure | MongoDB error | Retry once. If persistent, log and emit risk signal. |
| Section 197 certificate expired | Date comparison | Revert to standard rate. Emit info risk signal. |

### AuditLog Write Failures (D-039)

Fire-and-forget. Write failure logged to application logger but does NOT block the primary operation.
