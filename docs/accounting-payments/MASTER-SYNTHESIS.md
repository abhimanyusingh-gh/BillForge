# BillForge Master Synthesis: Accounting, Payments & Tally Integration

## Pipeline Metadata

- **Pipeline**: 9-stage expert review (PM → CA → Accounting Ops → Bank → Tax → Integration → Product → Architecture → Implementation)
- **Date**: 2026-04-16
- **VKL Version**: Final (44 decisions, 20 constraints, 6 resolved conflicts)
- **EIL Entries**: 32 evidence items
- **OAR Items**: 15 open questions
- **Input Documents**: [PRD-REFINED.md](./input/PRD-REFINED.md), [TALLY-INTEGRATION-AUDIT.md](./input/TALLY-INTEGRATION-AUDIT.md), [UX-AUDIT-REPORT.md](./input/UX-AUDIT-REPORT.md), [DATA-MODEL-AUDIT.md](./input/DATA-MODEL-AUDIT.md)

---

## 1. System Overview

### 1.1 What BillForge Is

BillForge is an India-specific accounts payable automation platform that ingests vendor invoices (via email, file upload, or folder scan), extracts structured data using OCR + SLM, enriches with compliance data (TDS, GST, PAN, risk signals), routes through configurable approval workflows, and exports to Tally for accounting.

### 1.2 What This Synthesis Adds

This document defines the architecture for three new capabilities:

1. **Payment Recording & Tracking** — recording payments against approved invoices, tracking partial/full payment status, generating Tally payment vouchers
2. **TDS Cumulative Threshold Tracking** — per-vendor annual TDS threshold compliance per Income Tax Act
3. **Enhanced Tally Integration** — fixing existing XML export for correct bill tracking, adding payment voucher export, enabling vendor pre-validation

### 1.3 Current State (Exists Today)

> *Based on VKL: D-001, D-005*

| Capability | Status |
|---|---|
| Invoice lifecycle (PENDING → EXPORTED) | Complete |
| Per-invoice TDS calculation (section detection, rate lookup, single-transaction threshold) | Complete |
| GST breakdown (CGST/SGST/IGST/Cess) on invoices and Tally export | Complete |
| Tally Purchase Voucher XML generation | Complete but structurally flawed (see Section 3) |
| Bank statement upload + 1:1 reconciliation | Complete |
| Vendor master (auto-created from invoices) | Complete but no CRUD |
| Multi-step approval workflow | Complete |
| Risk signal framework | Complete |

### 1.4 What Does NOT Exist

| Capability | Priority |
|---|---|
| Payment model / payment recording | MVP |
| TDS cumulative annual threshold tracking | MVP |
| Tally XML structural fixes (ALLLEDGERENTRIES, ISINVOICE, BILLALLOCATIONS) | Phase 0 (immediate) |
| Vendor CRUD API | MVP |
| Payment voucher Tally export | MVP |
| Split/aggregate reconciliation | Post-MVP |
| Tally vendor sync | Post-MVP |
| Form 26Q data preparation | Post-MVP |

---

## 2. Accounting & Payment Flows

### 2.1 Invoice Lifecycle (Unchanged)

> *Based on VKL: D-001*

```
PENDING
  → PARSED (OCR + SLM successful, compliance enrichment including TDS)
  → FAILED_OCR
  → FAILED_PARSE

PARSED → NEEDS_REVIEW / AWAITING_APPROVAL / APPROVED
NEEDS_REVIEW → PARSED / AWAITING_APPROVAL / APPROVED / PENDING (retry)
AWAITING_APPROVAL → APPROVED / NEEDS_REVIEW (rejected)
APPROVED → EXPORTED

Payment status is ORTHOGONAL (not a lifecycle state):
  APPROVED/EXPORTED invoices carry: paymentStatus = unpaid | partially_paid | fully_paid | overpaid
```

**VKL Decision D-001**: Payment tracking is an orthogonal attribute on the invoice, not a lifecycle status. An invoice can be APPROVED and simultaneously partially_paid. These are independent dimensions.

### 2.2 Payment Lifecycle (New)

> *Based on VKL: D-002, D-011, D-012*

```
draft → approved → processed → [terminal]
draft → cancelled → [terminal]
approved → failed → draft (retry)

Special types:
  type="standard" — normal payment against invoices
  type="advance" — payment before invoice (empty allocations)
  type="reversal" — reverses a prior payment (links via reversesPaymentId)
```

**Payment Flow:**
1. AP clerk selects approved/exported invoices → "Record Payment"
2. System pre-fills: amount = sum of net payables (after TDS), payment method, date
3. Clerk enters UTR/reference, confirms allocations per invoice
4. System validates: sum of allocations = payment amount, no duplicate UTR (C-010), each invoice is APPROVED/EXPORTED
5. Payment created in `draft` status
6. If payment workflow enabled: route for approval → `approved`
7. On `processed`: update each invoice's `paymentStatus` and `paidAmountMinor` via atomic $inc
8. Emit AuditLog entry (D-004)
9. Optionally: generate Tally payment voucher for export

**Advance Payment (D-011):** Payment with empty allocations array. Later matched to invoice via manual allocation endpoint. Tracked as "unallocated" until fully allocated.

**Payment Reversal (D-012):** A new Payment document with `type="reversal"` and `reversesPaymentId` referencing the original. Reversal decrements the invoice's `paidAmountMinor`. Original payment record is never mutated (C-009).

### 2.3 Payment Run (Batch Processing)

> *Based on VKL: D-015*

```
PaymentRun: {
  tenantId, runDate, status (draft|approved|processed|cancelled),
  paymentIds[], totalAmountMinor, createdBy
}
```

AP clerk selects multiple approved invoices → "Create Payment Run" → system groups by vendor → creates one Payment per vendor → generates bank upload file (future: bank-specific formats for NEFT/RTGS bulk upload). For MVP, the PaymentRun is a logical grouping; bank file generation is deferred.

### 2.4 TDS Computation Flow

> *Based on VKL: D-006, D-010, D-024, D-025, D-026, C-008, C-014, C-015, C-020*

```
Invoice arrives → TdsCalculationService.computeTds()
  1. Detect section via TdsSectionMapping (glCategory × panCategory → section)
  2. Determine taxable base:
     - If GST shown separately: taxableAmount = invoiceAmount − totalGST  [C-008, E11]
     - If GST inclusive: taxableAmount = invoiceAmount                    [C-015, E29]
  3. Look up rate via TDS rate hierarchy (D-024):
     a. Check Section 197 lower deduction certificate on vendor (D-013)
        → If valid and within maxAmount: use certificate rate
     b. Check Section 206AB (non-filer penalty) — deferred, risk signal only (D-027)
     c. Check Section 206AA (no PAN): if no PAN, rate = max(20%, standard rate) [C-004, E7]
     d. Check tenant override rate (TenantComplianceConfig.tdsRates)
     e. Fall back to TdsRateTable standard rate
     → Apply HIGHEST of applicable rates (except Section 197 which overrides downward)
  4. Check single-transaction threshold (existing logic)
  5. Check cumulative annual threshold (NEW — D-006):
     a. Determine FY from invoice date in IST timezone (D-043, C-002)
     b. Query TdsVendorLedger for {tenantId, vendorFingerprint, FY, section}
     c. If cumulative + current < threshold: TDS = 0, emit BELOW_ANNUAL_THRESHOLD
     d. If threshold crossing with this invoice: TDS on entire cumulative, subtract already deducted
     e. If already past threshold: normal per-invoice TDS
     f. Atomic upsert TdsVendorLedger ($inc cumulativeBaseMinor, $push entry) [D-038]
  6. Assign TDS quarter from deduction date [C-014, D-026]:
     Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
  7. Store structured result on invoice (D-025):
     {section, rateSource, rateBps, taxableBaseMinor, tdsAmountMinor, netPayableMinor, quarter}
  8. Emit risk signals as appropriate
```

**Edge Cases Addressed:**
- Backdated invoice: FY from invoice date, not processing date. Catch-up TDS computed on this invoice.
- Invoice correction: Reverse old TdsVendorLedger entry, recompute with new amount. (OAR-002 — implementation TBD, risk signal for now.)
- Concurrent processing: Atomic $inc prevents race conditions (D-038). Full MongoDB transactions on replica set.

### 2.5 Aging Report

> *Based on VKL: D-018*

Standard AP aging buckets computed from invoice due date:

| Bucket | Definition |
|---|---|
| Current | Not yet past due |
| 1–30 | 1 to 30 days past due |
| 31–60 | 31 to 60 days past due |
| 61–90 | 61 to 90 days past due |
| 90+ | More than 90 days past due |

Query: `invoices WHERE paymentStatus IN (unpaid, partially_paid) GROUP BY aging bucket`. MSME vendors flagged separately (C-003: 45-day statutory limit, E16).

---

## 3. Tally Integration Architecture

### 3.1 Connectivity Model

> *Based on VKL: D-028, E30*

Tally Prime runs on localhost (typically port 9000). BillForge is cloud-hosted. No direct connectivity is possible.

| Phase | Approach |
|---|---|
| Phase 0–5 | File-based export: generate XML → user downloads → manual import into Tally |
| Phase 6+ | Desktop bridge agent (Electron/system tray) for direct localhost connectivity |

### 3.2 Purchase Voucher XML Fixes (Phase 0)

> *Based on VKL: D-005, D-019, C-005, C-016, C-017, E1, E2, E8*

**These 5 changes must be implemented IMMEDIATELY (1-2 days):**

| # | Fix | Current | Required |
|---|---|---|---|
| 1 | Ledger entry tag | `LEDGERENTRIES.LIST` | `ALLLEDGERENTRIES.LIST` |
| 2 | Invoice mode | `ISINVOICE=No` | `ISINVOICE=Yes` |
| 3 | Bill reference | Missing | `<REFERENCE>{invoiceNumber}</REFERENCE>` |
| 4 | Effective date | Missing | `<EFFECTIVEDATE>{YYYYMMDD}</EFFECTIVEDATE>` |
| 5 | Bill allocation | Missing | `BILLALLOCATIONS.LIST` with `BILLTYPE=New Ref` inside party entry |

**Corrected Purchase Voucher XML Structure:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Import</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Vouchers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>{companyName}</SVCURRENTCOMPANY>
      </STATICVARIABLES>
    </DESC>
    <DATA>
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Purchase" ACTION="Create" OBJVIEW="Accounting Voucher View">
          <DATE>{YYYYMMDD}</DATE>
          <EFFECTIVEDATE>{YYYYMMDD}</EFFECTIVEDATE>
          <GUID>{sha256(tenantId:invoiceId:exportVersion)}</GUID>
          <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
          <VOUCHERNUMBER>{invoiceNumber}</VOUCHERNUMBER>
          <REFERENCE>{invoiceNumber}</REFERENCE>
          <NARRATION>{narration}</NARRATION>
          <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
          <ISINVOICE>Yes</ISINVOICE>
          <PARTYLEDGERNAME>{vendorName}</PARTYLEDGERNAME>
          <PARTYGSTIN>{vendorGstin}</PARTYGSTIN>
          <BASICBUYERNAME>{companyName}</BASICBUYERNAME>
          <PLACEOFSUPPLY>{stateFromGstin}</PLACEOFSUPPLY>

          <!-- Party (Creditor) Entry -->
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>{vendorLedgerName}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
            <AMOUNT>-{netPayableAmount}</AMOUNT>
            <BILLALLOCATIONS.LIST>
              <NAME>{invoiceNumber}</NAME>
              <BILLTYPE>New Ref</BILLTYPE>
              <AMOUNT>-{netPayableAmount}</AMOUNT>
            </BILLALLOCATIONS.LIST>
          </ALLLEDGERENTRIES.LIST>

          <!-- Purchase/Expense Ledger -->
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>{purchaseLedger}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>{taxableAmount}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>

          <!-- GST Ledgers (CGST/SGST or IGST) -->
          <!-- ... existing logic, tag renamed to ALLLEDGERENTRIES.LIST ... -->

          <!-- TDS Payable (if applicable) -->
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>{tdsLedger}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>-{tdsAmount}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
        </VOUCHER>
      </TALLYMESSAGE>
    </DATA>
  </BODY>
</ENVELOPE>
```

### 3.3 Payment Voucher XML (Phase 4)

> *Based on VKL: D-002, E9*

```xml
<VOUCHER VCHTYPE="Payment" ACTION="Create" OBJVIEW="Accounting Voucher View">
  <DATE>{YYYYMMDD}</DATE>
  <EFFECTIVEDATE>{YYYYMMDD}</EFFECTIVEDATE>
  <GUID>{sha256(tenantId:paymentId:1)}</GUID>
  <VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>
  <VOUCHERNUMBER>{paymentNumber}</VOUCHERNUMBER>
  <NARRATION>Payment to {vendorName} | Ref: {utrNumber}</NARRATION>

  <!-- Bank Ledger (Credit — money going out) -->
  <ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>{bankLedgerName}</LEDGERNAME>
    <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
    <AMOUNT>-{paymentAmount}</AMOUNT>
  </ALLLEDGERENTRIES.LIST>

  <!-- Vendor Ledger (Debit — settling liability) -->
  <ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>{vendorLedgerName}</LEDGERNAME>
    <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
    <AMOUNT>{paymentAmount}</AMOUNT>
    <!-- One BILLALLOCATIONS per invoice in this payment -->
    <BILLALLOCATIONS.LIST>
      <NAME>{invoiceNumber}</NAME>
      <BILLTYPE>Agst Ref</BILLTYPE>
      <AMOUNT>{allocatedAmount}</AMOUNT>
    </BILLALLOCATIONS.LIST>
  </ALLLEDGERENTRIES.LIST>
</VOUCHER>
```

**Key rule (E9):** `BILLTYPE` = `Agst Ref` (Against Reference) settles the outstanding bill created by the Purchase Voucher. The `NAME` must exactly match the `REFERENCE` from the original Purchase Voucher.

### 3.4 Batch Export

> *Based on VKL: D-029, C-018*

All export operations (live and file) use the batch XML builder. Single HTTP request per batch. Maximum 100 vouchers per request. Multiple batches for larger exports.

### 3.5 Deduplication

> *Based on VKL: D-030, D-035*

GUID = `SHA-256(tenantId:invoiceId:exportVersion)`. Track `exportVersion` counter on Invoice.export subdocument. First export: `ACTION="Create"`. Subsequent exports: `ACTION="Alter"`. Re-export of failed invoices only re-sends failures, not entire batch.

### 3.6 PLACEOFSUPPLY Derivation

> *Based on VKL: D-031, C-017, E31*

GSTIN format: `SSXXXXXXXXXXXXC` where `SS` = 2-digit state code.

| Code | State | Code | State |
|---|---|---|---|
| 01 | Jammu & Kashmir | 19 | West Bengal |
| 02 | Himachal Pradesh | 20 | Jharkhand |
| 03 | Punjab | 21 | Odisha |
| 04 | Chandigarh | 22 | Chhattisgarh |
| 05 | Uttarakhand | 23 | Madhya Pradesh |
| 06 | Haryana | 24 | Gujarat |
| 07 | Delhi | 25 | Daman & Diu |
| 08 | Rajasthan | 26 | Dadra & Nagar Haveli |
| 09 | Uttar Pradesh | 27 | Maharashtra |
| 10 | Bihar | 29 | Karnataka |
| 11 | Sikkim | 30 | Goa |
| 12 | Arunachal Pradesh | 32 | Kerala |
| 13 | Nagaland | 33 | Tamil Nadu |
| 14 | Manipur | 34 | Puducherry |
| 15 | Mizoram | 35 | Andaman & Nicobar |
| 16 | Tripura | 36 | Telangana |
| 17 | Meghalaya | 37 | Andhra Pradesh |
| 18 | Assam | 38 | Ladakh |

Store `stateCode` and `stateName` on VendorMaster. Derive from GSTIN on first encounter.

### 3.7 Vendor Pre-Validation (Phase 6)

Before voucher export:
1. Collect unique vendor names from batch
2. If Tally connectivity available (desktop agent): query Tally for existing Sundry Creditor ledgers
3. Compare: fuzzy match vendor names → Tally ledger names
4. Missing vendors: auto-create in Tally (if `autoCreateVendors` enabled) or report to user
5. Use `tallyLedgerName` from VendorMaster if set (overrides extracted vendor name)

---

## 4. Data Model (Final)

### 4.1 New Models

> *Based on VKL: D-002, D-003, D-004, D-006, RC-001, RC-002, RC-003*

#### Payment

```typescript
{
  tenantId: String, required, indexed
  paymentNumber: String, required, unique per tenant
  type: "standard" | "advance" | "reversal", default "standard"
  reversesPaymentId: String | null           // for type="reversal"
  vendorFingerprint: String, required
  paymentDate: Date, required
  amountMinor: Number, required, integer-validated  // [C-001]
  currency: String, default "INR"
  method: "neft" | "rtgs" | "upi" | "imps" | "cheque" | "cash" | "other"  // [C-013]
  utrNumber: String | null                  // UTR/reference, validated per method [D-020]
  chequeNumber: String | null
  bankLedgerName: String | null             // Tally bank ledger for voucher [D-021]
  status: "draft" | "approved" | "processed" | "failed" | "cancelled"
  allocations: [{
    invoiceId: String, required
    allocatedMinor: Number, required, integer-validated
    tdsDeductedMinor: Number, default 0
    tcsCollectedMinor: Number, default 0
    netPaidMinor: Number, required, integer-validated
  }]
  reconciliationMappingId: String | null
  createdBy: String, required
  notes: String | null
  timestamps: true
}

Indexes:
  { tenantId: 1, createdAt: -1 }
  { tenantId: 1, vendorFingerprint: 1 }
  { tenantId: 1, status: 1 }
  { tenantId: 1, paymentNumber: 1 } unique
  { tenantId: 1, utrNumber: 1 } unique sparse  // [C-010, D-017]
```

#### TdsVendorLedger

```typescript
{
  tenantId: String, required
  vendorFingerprint: String, required
  financialYear: String, required              // "2025-26" [C-002]
  section: String, required                    // "194C"
  cumulativeBaseMinor: Number, default 0, integer-validated  // [C-001]
  cumulativeTdsMinor: Number, default 0, integer-validated
  invoiceCount: Number, default 0
  thresholdCrossedAt: Date | null
  lastUpdatedInvoiceId: String
  quarter: String                              // "Q1" | "Q2" | "Q3" | "Q4" [C-014]
  entries: [{
    invoiceId: String, required
    invoiceDate: Date, required
    taxableAmountMinor: Number, integer-validated
    tdsAmountMinor: Number, integer-validated
    rateSource: String                         // [D-025]
    quarter: String
    recordedAt: Date, required
  }]
  timestamps: true
}

Indexes:
  { tenantId: 1, vendorFingerprint: 1, financialYear: 1, section: 1 } unique
  { tenantId: 1, financialYear: 1, section: 1 }
  { tenantId: 1, financialYear: 1, thresholdCrossedAt: 1 }
```

#### ReconciliationMapping

> *Junction table approach per RC-002*

```typescript
{
  tenantId: String, required
  bankTransactionId: String, required
  invoiceId: String, required
  paymentId: String | null                     // ref to Payment
  allocatedMinor: Number, required, integer-validated
  matchConfidence: Number | null               // 0-100
  matchMethod: "auto" | "suggested" | "manual", required
  createdBy: String
  timestamps: true
}

Indexes:
  { tenantId: 1, bankTransactionId: 1, invoiceId: 1 } unique
  { tenantId: 1, invoiceId: 1 }
  { tenantId: 1, bankTransactionId: 1 }
```

#### AuditLog

> *Per RC-003*

```typescript
{
  tenantId: String, required
  entityType: "invoice" | "payment" | "vendor" | "bank_transaction" |
              "reconciliation" | "tds_override" | "gl_override" | "export" |
              "approval" | "config"
  entityId: String, required
  action: String, required                     // e.g. "tds_manual_override", "payment_recorded"
  previousValue: Mixed | null
  newValue: Mixed | null
  userId: String, required
  userEmail: String
  timestamp: Date, default Date.now
  timestamps: false                            // timestamp field is canonical [C-006]
}

Indexes:
  { tenantId: 1, entityType: 1, entityId: 1, timestamp: -1 }
  { tenantId: 1, timestamp: -1 }
  { tenantId: 1, userId: 1, timestamp: -1 }
  { tenantId: 1, action: 1, timestamp: -1 }
  // NO TTL index for compliance tenants [C-019]
```

### 4.2 Model Extensions

#### Invoice (add to compliance subdocument)

```typescript
paymentStatus: "unpaid" | "partially_paid" | "fully_paid" | "overpaid", default "unpaid"
paidAmountMinor: Number, default 0, integer-validated
gstTreatment: "regular" | "reverse_charge" | "exempt" | "nil_rated" | "composition", default "regular"
itcEligible: Boolean, default true
```

New index: `{ tenantId: 1, paymentStatus: 1, "parsed.dueDate": 1 }` — aging queries.

#### VendorMaster (add)

```typescript
tallyLedgerName: String | null
tallyLedgerGroup: String, default "Sundry Creditors"
vendorStatus: "active" | "inactive" | "blocked", default "active"
stateCode: String | null                       // from GSTIN [D-031]
stateName: String | null
lowerDeductionCert: {                          // Section 197 [D-013]
  certificateNumber: String
  validFrom: Date
  validTo: Date
  maxAmountMinor: Number, integer-validated
  applicableRateBps: Number
} | null
```

New index: `{ tenantId: 1, vendorStatus: 1 }`

#### Tenant (add)

```typescript
tan: String | null                             // Tax Deduction Account Number [D-009, C-007]
```

#### TenantExportConfig (add)

```typescript
tallyBankLedger: String | null                 // for payment voucher export
tallyEndpointUrl: String | null
autoCreateVendors: Boolean, default false
```

#### ApprovalWorkflow (add)

```typescript
workflowType: "invoice" | "payment", default "invoice"
```

### 4.3 Schema Fixes (Existing Models)

| Fix | Model | Details |
|---|---|---|
| GL_CODE_SOURCE enum | Invoice.ts | Add `"slm-classification"` to Mongoose enum |
| Integer validation | All *Minor fields | Add `validate: { validator: Number.isInteger }` [C-001] |
| TDS rate naming | TenantComplianceConfig | Rename `rateIndividual` → `rateIndividualBps` (match TdsRateTable) |
| Dead fields | User | Remove passwordHash, tempPassword, mustChangePassword, emailVerified, verificationTokenHash |
| Legacy fields | Invoice | Remove riskFlags, riskMessages (superseded by compliance.riskSignals) |
| Invite roles | TenantInvite | Expand role enum from ["ap_clerk"] to all TenantAssignableRoles |
| Missing index | Invoice | Add `{ tenantId: 1, contentHash: 1 } sparse` for duplicate detection |

---

## 5. API Contracts

### 5.1 Payments

```
POST   /api/payments                    — Record a payment
GET    /api/payments                    — List payments (filters: vendor, date, status, method)
GET    /api/payments/:id                — Payment detail
PATCH  /api/payments/:id                — Update draft payment
POST   /api/payments/:id/approve        — Approve payment
DELETE /api/payments/:id                — Cancel draft payment
POST   /api/payments/:id/allocate       — Allocate advance payment to invoice(s)

Auth: requireAuth, requireCap("canRecordPayments") [D-036]
```

**POST /api/payments validation rules:**
- `sum(allocations[].allocatedMinor)` must equal `amountMinor`
- Each invoiceId must exist, belong to tenant, and be APPROVED or EXPORTED
- Each allocatedMinor must not exceed invoice's remaining payable
- UTR/reference must be unique within tenant (C-010)
- Cash payments > Rs 2,00,000 emit CASH_PAYMENT_ABOVE_LIMIT risk signal (D-022, C-012)

### 5.2 Vendors

```
GET    /api/vendors                     — List vendors (search, pagination, status filter)
GET    /api/vendors/:fingerprint        — Vendor detail with invoice history
PATCH  /api/vendors/:fingerprint        — Update vendor (tallyLedgerName, status, defaultGlCode, etc.)
POST   /api/vendors/:fingerprint/merge  — Merge two vendor fingerprints
POST   /api/vendors/:fingerprint/cert   — Upload Section 197 lower deduction certificate [D-013]

Auth: requireAuth
```

### 5.3 Reports

```
GET    /api/reports/tds-liability       — TDS liability by vendor/section/FY (from TdsVendorLedger)
GET    /api/reports/payment-aging       — Invoice aging buckets [D-018]
GET    /api/reports/vendor-summary      — Payment and invoice history for a vendor
GET    /api/reports/reconciliation      — Match rates and value gaps across statements

Auth: requireAuth
Query params: fy (required for TDS), vendorFingerprint (optional), section (optional)
```

### 5.4 Reconciliation Mappings

```
POST   /api/reconciliation-mappings     — Create manual split/aggregate mapping
GET    /api/reconciliation-mappings     — List mappings for a statement
DELETE /api/reconciliation-mappings/:id — Remove mapping

Auth: requireAuth, requireCap("canApproveInvoices")
```

### 5.5 Tally Payment Voucher Export

```
POST   /api/exports/tally/payment-vouchers  — Export payment vouchers to Tally XML

Auth: requireAuth, requireCap("canExportPaymentVouchers") [D-036]
Body: { paymentIds: string[] }
Response: { batchId, total, successCount, failureCount, items[] }
```

---

## 6. GST + Tax Compliance Design

### 6.1 TDS Compliance

> *Based on VKL: D-006, D-009, D-010, D-013, D-024, D-025, D-026, D-027; EIL: E3, E5, E6, E7, E11, E13, E14, E15, E26, E28, E29; Constraints: C-002, C-004, C-007, C-008, C-014, C-015, C-020*

#### TDS Rate Hierarchy (D-024)

```
Priority (highest wins, EXCEPT Section 197 overrides downward):

1. Section 197 lower deduction certificate → use certificate rate [E14]
2. Section 206AB non-filer penalty → higher of (2× rate, 5%) [E26] — deferred, risk signal only [D-027]
3. Section 206AA no-PAN penalty → minimum 20% [E7, C-004]
4. Tenant override rate (TenantComplianceConfig.tdsRates)
5. Standard rate (TdsRateTable)
```

#### TDS Taxable Base (C-008, C-015)

- **GST shown separately**: taxable base = invoice amount − total GST [E11, CBDT Circular 23/2017]
- **GST inclusive (not shown separately)**: taxable base = full invoice amount [E29]

#### TDS Quarter Assignment (D-026, C-014)

Based on **deduction date** (invoice date, or payment date if earlier for advances), NOT processing date [E28]:
- Q1: April 1 – June 30
- Q2: July 1 – September 30
- Q3: October 1 – December 31
- Q4: January 1 – March 31

#### TDS Deposit Deadlines [E12, E24]

| Quarter | Due Date |
|---|---|
| Q1 (Apr–Jun) | 7th July |
| Q2 (Jul–Sep) | 7th October |
| Q3 (Oct–Dec) | 7th January |
| Q4 (Jan–Mar) | 30th April (special for March) |

#### Late TDS Interest [E13]

- Late deduction: 1% per month (part month = full month)
- Late deposit after deduction: 1.5% per month

#### Required Identifiers [D-009, C-007, E15]

- **TAN** (Tax Deduction Account Number): Stored on Tenant model. Required on all TDS-related exports and reports.
- **PAN** of deductee (vendor): Stored on VendorMaster. If absent → 20% TDS rate [C-004].

### 6.2 GST Compliance

> *Based on EIL: E17, E18, E31*

| Aspect | Current | Required (MVP) | Required (Post-MVP) |
|---|---|---|---|
| CGST/SGST/IGST breakdown | Yes | No change | — |
| HSN/SAC per line item | Extracted, not exported | Export to Tally (Phase 6) | — |
| gstTreatment field | New | regular, reverse_charge, exempt, nil_rated, composition | — |
| itcEligible field | New | Boolean flag on invoice | GSTR-2B matching [OAR-015] |
| PLACEOFSUPPLY | Missing | Derive from GSTIN state code [D-031, C-017] | — |
| e-Invoice/IRN | Schema exists | Validation only | Generation [E17] |
| RCM (Reverse Charge) | Not implemented | gstTreatment flag; Tally RCM entries (Phase 7) | Auto-detect from vendor registration type |

### 6.3 TCS Compliance

TCS rate applied per tenant config (TenantTcsConfig). Existing implementation is correct:
- TCS = base net payable × tcsRatePercent / 100
- Added to payment amount (vendor collects TCS from buyer)
- Flows into Tally XML as TCS Receivable ledger entry

**Gap**: No annual threshold tracking for TCS (Section 206C(1H) applies only above Rs 50 lakh per vendor per year). Deferred to post-MVP.

### 6.4 MSME Compliance

> *Based on VKL: D-014, C-003; EIL: E4, E16*

- MSMED Act 2006, Section 15: Payment to micro/small enterprises within agreed period, max 45 days from acceptance
- Interest on delayed payment: 3× bank rate, compounded monthly [E16]
- BillForge must: track agreed payment terms per vendor, enforce 45-day statutory cap, calculate interest liability on overdue payments, flag overdue MSME invoices as risk signal

### 6.5 New Risk Signal Codes

| Code | Severity | Trigger |
|---|---|---|
| TDS_BELOW_ANNUAL_THRESHOLD | info | Cumulative below annual threshold, no TDS deducted |
| TDS_ANNUAL_THRESHOLD_CROSSED | warning | This invoice caused cumulative to cross threshold |
| TDS_BACKDATED_THRESHOLD_ADJUSTMENT | warning | Backdated invoice triggered catch-up TDS |
| TDS_SECTION_197_APPLIED | info | Lower rate applied per vendor certificate |
| TDS_NON_FILER_FLAG | warning | Vendor may be Section 206AB specified person |
| CASH_PAYMENT_ABOVE_LIMIT | warning | Cash payment > Rs 2,00,000 (Section 40A(3)) |
| MSME_PAYMENT_OVERDUE | critical | Payment to MSME vendor past 45-day statutory limit |
| MSME_PAYMENT_APPROACHING | warning | Payment to MSME vendor within 7 days of deadline |
| VENDOR_EINVOICE_MISSING | warning | Vendor above e-invoice threshold but no IRN on invoice |

---

## 7. Banking Flows (UPI/NEFT/RTGS)

> *Based on VKL: D-020, D-023, C-012, C-013; EIL: E21, E22, E23, E25*

### 7.1 Payment Methods

| Method | Settlement | Min/Max | UTR Format | Validation |
|---|---|---|---|---|
| NEFT | 24×7 batches [E22] | No limit | Alphanumeric 16-22 chars | Format regex |
| RTGS | Real-time | Min Rs 2,00,000 [E23] | Alphanumeric 16-22 chars | Min amount + format |
| UPI | Real-time | Max Rs 1,00,000 | Varies by app | Basic non-empty |
| IMPS | Real-time | Max Rs 5,00,000 | Alphanumeric | Basic non-empty |
| Cheque | 1-3 business days | No limit | 6-digit numeric | Length + numeric |
| Cash | Instant | Legal limit Rs 2,00,000 [E21, C-012] | N/A | Amount validation |

### 7.2 Reconciliation Date Tolerance

> *Based on VKL: D-023*

Bank statement shows value date (settlement date). Payment may have been initiated earlier. Reconciliation scoring allows ±2 business days tolerance for date proximity matching.

### 7.3 Cash Payment Risk

> *Based on VKL: D-022, C-012; EIL: E21*

Any payment with `method="cash"` and `amountMinor > 20000000` (Rs 2,00,000) must emit `CASH_PAYMENT_ABOVE_LIMIT` risk signal. Per Income Tax Act Section 40A(3), such payments are non-deductible as business expenses.

---

## 8. Reconciliation System

### 8.1 Current Algorithm (Unchanged)

1:1 scoring-based matching: amount (50/30 pts), invoice number in description (30 pts), vendor name overlap (20 pts), date proximity (2-10 pts). Auto-match above threshold (default 50), suggest above suggest threshold (default 30).

### 8.2 Amount Matching with TDS/TCS

> *Based on VKL: C-011*

Expected bank debit = invoice net payable (after TDS) + TCS (if applicable).

```
expectedDebit = invoice.compliance.tds.netPayableMinor + invoice.compliance.tcs.amountMinor
```

Amount match scoring must compare `bankTransaction.debitMinor` against `expectedDebit`, not against `invoice.parsed.totalAmountMinor`.

### 8.3 Split Detection (Phase 5)

> *Based on VKL: D-016*

After 1:1 pass, for each remaining unmatched transaction:
1. Find unmatched invoices for same vendor (name overlap in description)
2. Try subset-sum combinations up to **10 invoices** (increased from 5 per D-016)
3. If sum of net payables matches transaction debit (±tolerance + rounding Rs 1 per E19): suggest as split mapping
4. Create ReconciliationMapping entries (one per transaction-invoice pair)

### 8.4 Aggregate Detection (Phase 5)

For each remaining unmatched invoice:
1. Find unmatched transactions with same vendor reference pattern
2. Check if sum of those transactions' debit equals invoice net payable (±tolerance)
3. If yes: suggest as aggregate mapping

### 8.5 Migration from Inline Fields

Existing `BankTransaction.matchedInvoiceId` and `Invoice.compliance.reconciliation.bankTransactionId` → migrate to ReconciliationMapping rows. Phase: deploy ReconciliationMapping, write to both (dual-write), migrate existing, cut over reads, deprecate inline fields.

---

## 9. UX Principles

> *Based on VKL: D-008*

### 9.1 Immediate Quick Wins (Parallel with All Phases)

| # | Change | Impact | Effort |
|---|---|---|---|
| 1 | Expand risk signals by default for NEEDS_REVIEW invoices | High | Trivial |
| 2 | Add risk indicator column (colored dot) to invoice table | High | Low |
| 3 | Replace PAN L1/L2 with "Format valid" / "GSTIN cross-checked" | Medium | Trivial |
| 4 | Add action hint to status badge ("Approve Step 2/3", "Review: 2 signals") | High | Low |
| 5 | Add `aria-selected` to status filter tabs | Medium | Trivial |
| 6 | Build "Action Required" queue (NEEDS_REVIEW + AWAITING_APPROVAL, sorted by age) | Very High | 1-2 days |
| 7 | Pre-export validation modal (GL code, PAN, risk signals check) | High | 1-2 days |

### 9.2 Medium-Term UX (With Phases 2-4)

| # | Feature | Phase |
|---|---|---|
| 8 | Vendor list tab with search, TDS summary, Tally sync status | Phase 2 |
| 9 | Payment recording form in invoice detail panel | Phase 3 |
| 10 | Payment history on invoice detail (progress bar + table) | Phase 3 |
| 11 | TDS cumulative dashboard (per-vendor, per-section, per-FY) | Phase 1 |

### 9.3 Major Redesigns (Post-MVP)

| # | Feature | Description |
|---|---|---|
| 12 | Navigation restructure | 8-item sidebar (Dashboard, Inbox, Invoices, Vendors, Payments, Reconciliation, Exports, Settings) |
| 13 | Reconciliation split-pane | Two-column: bank transactions left, candidate invoices right, TDS-adjusted amounts |
| 14 | Compliance data in table | Move TDS/PAN/GL from detail panel to table columns; replace confidence badge |

---

## 10. Engineering Architecture

### 10.1 New Service Layer

> *Based on VKL: D-037*

| Service | File | Responsibility |
|---|---|---|
| PaymentService | `services/payment/PaymentService.ts` | CRUD, allocation validation, paymentStatus computation, duplicate detection [D-017] |
| TdsVendorLedgerService | `services/compliance/TdsVendorLedgerService.ts` | Cumulative tracking, threshold detection, FY management, backfill |
| PaymentVoucherExporter | `services/export/tallyExporter/paymentVoucher.ts` | Tally payment voucher XML generation |
| VendorService | `services/compliance/VendorService.ts` | CRUD, merge, Tally sync fields, Section 197 cert management |
| AuditLogService | `services/core/AuditLogService.ts` | Immutable event recording [D-039: fire-and-forget] |
| ReportService | `services/reporting/ReportService.ts` | TDS liability, aging, vendor summary, reconciliation summary |

### 10.2 Modified Existing Services

| Service | Modification |
|---|---|
| TdsCalculationService | Add cumulative threshold check (Section 2.4 algorithm). Atomic TdsVendorLedger upsert [D-038]. |
| TallyExporter/xml.ts | ALLLEDGERENTRIES, ISINVOICE=Yes, REFERENCE, EFFECTIVEDATE, BILLALLOCATIONS. Add buildPaymentVoucherPayload(). |
| ExportService | Add payment voucher export flow. Fix ocrText exclusion bug (include in query or remove fallback). |
| ReconciliationService | TDS-adjusted amount matching [C-011]. Phase 5: split/aggregate detection [D-016]. |

### 10.3 New Routes

| Route File | Endpoints |
|---|---|
| `routes/payment/payment.ts` | /api/payments (CRUD + approve + allocate) |
| `routes/vendor/vendor.ts` | /api/vendors (list + detail + update + merge + cert) |
| `routes/report/report.ts` | /api/reports/* |
| `routes/reconciliation/reconciliationMapping.ts` | /api/reconciliation-mappings |

### 10.4 Database Considerations

> *Based on VKL: D-038, D-041, D-044*

- **Atomic operations**: Use `findOneAndUpdate` with `$inc` for TdsVendorLedger. Full MongoDB transactions on replica set only.
- **Backfill migration**: Cursor-based iteration, batch size 100 [D-044]. Idempotent (re-runnable safely).
- **Index creation**: All new indexes with `background: true` on production.
- **AuditLog retention**: Minimum 8 years [C-019]. Separate collection, no TTL for compliance tenants.

### 10.5 Enum Consistency

> *Based on VKL: D-042*

```typescript
export const PAYMENT_METHODS = ["neft", "rtgs", "upi", "imps", "cheque", "cash", "other"] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];
// Use PAYMENT_METHODS in both Mongoose enum and TypeScript type
```

Apply same pattern to all new enums: payment status, payment type, GST treatment, vendor status.

### 10.6 Test Requirements

> *Based on VKL: D-040*

100% branch coverage on:
- `TdsCalculationService` (cumulative threshold logic)
- `TdsVendorLedgerService` (atomic updates, threshold crossing, backdated invoices)
- `PaymentService` (allocation validation, duplicate detection, reversal logic)
- `TallyExporter/xml.ts` (all voucher types, GST combinations, TDS entries)

Test matrix for TDS cumulative:
- Below threshold → no TDS
- Exactly at threshold → TDS triggers
- Above threshold → normal TDS
- Threshold crossing → catch-up TDS on entire cumulative
- Backdated invoice → correct FY, catch-up if applicable
- Multiple sections per vendor
- Section 197 certificate override
- No PAN penalty rate (206AA)
- Concurrent invoice processing (race condition test)

---

## 11. Failure Handling

### 11.1 Tally Export Failures

| Failure | Detection | Recovery |
|---|---|---|
| Tally offline | HTTP timeout/connection refused | Mark ExportBatch as "queued". User re-exports manually. |
| Ledger not found | Tally response LINEERROR | Report to user. Auto-create if `autoCreateVendors` enabled. |
| Duplicate voucher | Tally response ERRORS | Use GUID + ACTION="Alter" for re-export [D-030]. |
| Invalid XML | Tally response parse error | Log full request/response. Report to user. |

### 11.2 Payment Failures

| Failure | Detection | Recovery |
|---|---|---|
| Duplicate UTR | Unique index violation [C-010] | Reject with error message. |
| Over-allocation | Sum check at API layer | Reject with remaining payable amount. |
| Invoice not APPROVED/EXPORTED | Status check at API layer | Reject with current status. |
| Payment reversal of non-existent payment | Reference check | Reject with error. |

### 11.3 TDS Computation Failures

| Failure | Detection | Recovery |
|---|---|---|
| No TDS section mapping found | Empty result from TdsSectionMapping query | Emit SECTION_AMBIGUOUS risk signal. Default to no TDS. |
| TdsVendorLedger atomic update failure | MongoDB error | Retry once. If persistent, log and emit risk signal. |
| Section 197 certificate expired | Date comparison | Revert to standard rate. Emit info risk signal. |

### 11.4 AuditLog Write Failures

> *Based on VKL: D-039*

AuditLog writes are fire-and-forget. Write failure logged to application logger but does NOT block the primary operation. Rationale: audit is important but must not prevent business operations.

---

## 12. Risks

### 12.1 Compliance Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | TDS cumulative threshold not tracked → incorrect deduction → vendor disputes, IT notice | HIGH | Phase 1 priority. TdsVendorLedger with atomic ops. |
| 2 | TDS computed on GST-inclusive amount → over-deduction → vendor complaints | HIGH | C-008, C-015: exclude GST when shown separately. |
| 3 | MSME payment deadline not enforced → MSMED Act violation → interest liability | HIGH | D-014: track agreed terms + 45-day cap. Risk signals. |
| 4 | No TAN tracking → Form 16A/26Q generation impossible | HIGH | D-009: add TAN to Tenant model. |
| 5 | Tally import produces non-invoice entries → no bill tracking, no GST filing from Tally | HIGH | D-019: Phase 0 immediate fix. |

### 12.2 Technical Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 6 | TdsVendorLedger race condition on concurrent invoice processing | MED | D-038: atomic $inc. Full transactions on replica set. |
| 7 | TdsVendorLedger backfill from historical data produces incorrect cumulative totals | MED | D-041: idempotent script with verification. |
| 8 | Reconciliation split-detection subset-sum is computationally expensive for large datasets | LOW | D-016: limit to 10 invoices. Greedy pre-filter. |
| 9 | Schema migration for integer validation breaks existing floating-point data | MED | Run fixup script: round all *Minor fields to nearest integer before adding validation. |
| 10 | Dual-write period during ReconciliationMapping migration creates consistency risk | MED | Feature flag. Read from new, write to both. Migrate, then cut over. |

### 12.3 Product Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 11 | Demo without payment recording unconvincing for finance directors | MED | D-034: demo scope includes TDS + vendor. Payment is Phase 3 (MVP). |
| 12 | 14-18 week total timeline too long for market entry | MED | D-033: parallelized phasing. Phase 0 + Phase 1 + 2 (parallel) = 4-5 weeks. |
| 13 | Navigation restructure delays feature delivery | LOW | D-008: UX quick wins parallel, major redesign post-MVP. |

---

## 13. Open Questions (OAR — Final)

| ID | Severity | Question | Status |
|---|---|---|---|
| OAR-001 | HIGH | How to verify Section 197 certificate authenticity? TRACES API integration? | Partially resolved by D-013 (tracking). Verification deferred. |
| OAR-002 | HIGH | Invoice correction → TDS recomputation strategy (reverse + recompute)? | Algorithm defined but implementation deferred. Risk signal for now. |
| OAR-003 | MED | Generate Form 26Q directly or export to TRACES-compatible FVU format? | Open. Recommend: export to FVU format (lower effort, leverages existing tools). |
| OAR-006 | HIGH | Payment reversal for bounced cheques — does the model handle bank statement reversal detection? | D-012 defines model. Auto-detection from statement patterns is post-MVP. |
| OAR-007 | MED | Does target market use Tally statutory TDS module or manual Form 26Q filing? | Needs user research. Deferred TDS statutory integration to Phase 6. |
| OAR-008 | HIGH | TAN storage and propagation | **RESOLVED** by D-009. |
| OAR-009 | MED | Multi-currency Tally export (FOREIGNCURRENCYNAME, EXCHANGERATE)? | Post-MVP. India AP is predominantly INR. |
| OAR-010 | MED | TDS deposit (challan) tracking in-scope for MVP? | Deferred. Enables Form 26Q but adds model + workflow complexity. |
| OAR-011 | MED | E-TDS filing: generate FVU file or integrate with TRACES? | Post-MVP. Recommend FVU file generation. |
| OAR-012 | LOW | Tax calendar feature? | Post-MVP. Standard in competitors but low priority. |
| OAR-013 | LOW | Payment advice generation (PDF/email to vendor)? | Post-MVP. Value-add, not compliance-critical. |
| OAR-014 | LOW | Three-way matching (PO-GRR-Invoice) architectural consideration? | Enterprise feature. Not for MVP. No schema changes needed now. |
| OAR-015 | MED | GSTR-2B reconciliation: native or third-party? | Recommend: GSTR-2B JSON import + matching. Post-MVP. |

---

## 14. Evidence Appendix (EIL — Final)

| ID | Evidence | Source | Confidence | Used In |
|---|---|---|---|---|
| E1 | Tally requires ALLLEDGERENTRIES.LIST | TALLY | 0.95 | D-005, C-005 |
| E2 | ISINVOICE=Yes for bill tracking | TALLY | 0.95 | D-005 |
| E3 | Section 194C annual threshold Rs 1,00,000 | IT_ACT | 0.90 | D-006 |
| E4 | MSMED Act Section 15: max 45 days | RBI | 1.0 | D-014, C-003 |
| E5 | Form 26Q quarterly TDS return mandatory | IT_ACT | 1.0 | OAR-003 |
| E6 | Form 16A within 15 days of quarterly filing | IT_ACT | 0.95 | OAR-010 |
| E7 | Section 206AA: 20% TDS for no-PAN | IT_ACT | 1.0 | D-024, C-004 |
| E8 | BILLALLOCATIONS with BILLTYPE="New Ref" | TALLY | 0.95 | D-005 |
| E9 | Payment voucher BILLTYPE="Agst Ref" | TALLY | 0.95 | Section 3.3 |
| E10 | UPI/NEFT/RTGS per RBI regulations | RBI | 1.0 | C-013 |
| E11 | TDS excludes GST if shown separately | CBDT Circ. 23/2017 | 0.95 | D-010, C-008 |
| E12 | TDS deposit due 7th of following month | IT Rule 30 | 1.0 | Section 6.1 |
| E13 | Late TDS: 1% deduction, 1.5% deposit | Section 201(1A) | 1.0 | Section 6.1 |
| E14 | Section 197 lower deduction certificate | IT_ACT | 1.0 | D-013, D-024 |
| E15 | TAN mandatory on Form 16A/26Q | IT_ACT | 1.0 | D-009, C-007 |
| E16 | MSME interest: 3× bank rate compounded monthly | MSMED Act | 1.0 | D-014 |
| E17 | E-invoice for turnover > Rs 5 crore | GST | 1.0 | Risk signals |
| E18 | ITC only if in GSTR-2B | GST Section 16 | 1.0 | OAR-015 |
| E19 | Rs 1 rounding tolerance in bank reconciliation | RBI | 0.8 | Section 8.3 |
| E20 | Three-way matching is standard AP practice | ICAI | 0.9 | OAR-014 |
| E21 | Cash > Rs 2L non-deductible | IT Act 40A(3) | 1.0 | D-022, C-012 |
| E22 | NEFT 24×7 since Dec 2019 | RBI | 1.0 | Section 7.1 |
| E23 | RTGS min Rs 2 lakh | RBI | 1.0 | Section 7.1 |
| E24 | TDS challan due 7th of following month | IT Rule 30 | 1.0 | Section 6.1 |
| E25 | Form 15CA/15CB for foreign remittances | FEMA | 0.95 | OAR-009 |
| E26 | Section 206AB: 2× rate or 5% for non-filers | IT_ACT | 1.0 | D-024, D-027 |
| E27 | Surcharge + 4% HEC on TDS for non-residents | IT_ACT | 0.95 | Out of scope |
| E28 | TDS quarter = quarter of deduction date | IT_ACT | 1.0 | D-026, C-014 |
| E29 | GST inclusive → TDS on gross | CBDT Circ. 23/2017 | 0.95 | C-015 |
| E30 | Tally on localhost port 9000, no cloud API | TALLY | 0.95 | D-028 |
| E31 | GSTIN state codes 01-37 | GST | 1.0 | D-031 |
| E32 | Tally XML UTF-8 recommended | TALLY | 0.85 | D-032, C-016 |

---

## 15. Implementation Phases (Final)

> *Based on VKL: D-019, D-033, D-034*

### Phase 0: Tally XML Fixes (1-2 days)

> **Dependency: None. Execute IMMEDIATELY.**

1. `LEDGERENTRIES.LIST` → `ALLLEDGERENTRIES.LIST` in xml.ts
2. `ISINVOICE` → `Yes`
3. Add `<REFERENCE>` tag
4. Add `<EFFECTIVEDATE>` tag
5. Add `BILLALLOCATIONS.LIST` inside party entry
6. Add `<PLACEOFSUPPLY>` (GSTIN state code lookup)
7. Add `<?xml version="1.0" encoding="UTF-8"?>` declaration
8. Update all existing tests

**Files:** `xml.ts`, `tallyExporter.test.ts`

### Phase 1: TDS Cumulative Threshold (2-3 weeks)

> **Dependency: None. Start in parallel with Phase 2.**

1. Create TdsVendorLedger model
2. Create TdsVendorLedgerService with atomic upsert
3. Add `determineFY()` utility (IST timezone, D-043)
4. Modify `TdsCalculationService.computeTds()` for cumulative threshold check
5. Add new risk signal codes (BELOW_ANNUAL_THRESHOLD, THRESHOLD_CROSSED, BACKDATED_ADJUSTMENT)
6. Add TDS taxable base logic: exclude GST when shown separately (C-008)
7. Backfill migration script (D-041)
8. Add `GET /reports/tds-liability` endpoint
9. 100% branch coverage tests (D-040)

### Phase 2: Vendor CRUD & Fields (1 week, parallel with Phase 1)

> **Dependency: None.**

1. Add fields to VendorMaster: tallyLedgerName, vendorStatus, stateCode, stateName, lowerDeductionCert
2. Add TAN to Tenant model (D-009)
3. Create VendorService with CRUD, merge
4. Create vendor API endpoints
5. Section 197 certificate upload endpoint
6. Modify Tally export to use tallyLedgerName when set

### Phase 3: Payment Model & Recording (2-3 weeks)

> **Dependency: Phase 2 (vendor fields).**

1. Create Payment model
2. Add paymentStatus, paidAmountMinor to Invoice compliance subdocument
3. Create PaymentService with allocation validation, duplicate detection (D-017)
4. Payment CRUD endpoints
5. Advance payment support (D-011)
6. Payment reversal support (D-012)
7. Auto-compute paymentStatus on invoices
8. Cash payment risk signal (D-022)
9. Create AuditLog model and service (D-039)

### Phase 4: Payment Voucher Export (1-2 weeks)

> **Dependency: Phase 3.**

1. Add `buildPaymentVoucherPayload()` to xml.ts
2. Add `bankLedgerName` to TenantExportConfig
3. Create `POST /exports/tally/payment-vouchers` endpoint
4. GUID generation for payment vouchers (D-030)
5. BILLALLOCATIONS with BILLTYPE="Agst Ref" (E9)

### Phase 5: Reconciliation Enhancement (2-3 weeks)

> **Dependency: Phase 3.**

1. Create ReconciliationMapping model (junction table)
2. Manual split/aggregate mapping endpoints
3. TDS-adjusted amount matching in reconciliation scoring (C-011)
4. Date tolerance ±2 business days (D-023)
5. Phase 5b: Auto split/aggregate detection (limit 10 invoices, D-016)
6. Migration from inline matchedInvoiceId to ReconciliationMapping

### UX Quick Wins (parallel with all phases)

1. Risk signal default expansion for NEEDS_REVIEW
2. Risk indicator column in invoice table
3. PAN label clarification (L1/L2 → descriptive)
4. Action hints in status badges
5. Action Required queue
6. Pre-export validation modal
7. ARIA accessibility fixes

---

## 16. VKL Complete Registry

### 16.1 Decisions (D-001 through D-044)

| ID | Decision | Source Stage |
|---|---|---|
| D-001 | Invoice status machine unchanged. Payment is orthogonal attribute (`paymentStatus` field), not a lifecycle status. | PM (Stage 1) |
| D-002 | Payment model: batch-oriented with `allocations[]` array. One document per payment event, supports multi-invoice payments. | PM (Stage 1) |
| D-003 | Reconciliation model: normalized junction table `ReconciliationMapping`. One row per (transaction, invoice) pair. | PM (Stage 1) |
| D-004 | Audit model: `AuditLog` schema with `previousValue`/`newValue` for full change tracking. | PM (Stage 1) |
| D-005 | Tally XML must use `ALLLEDGERENTRIES.LIST`, `ISINVOICE=Yes`, `REFERENCE`, `EFFECTIVEDATE`, and `BILLALLOCATIONS.LIST`. Non-negotiable. | PM (Stage 1) |
| D-006 | TDS cumulative threshold tracking via `TdsVendorLedger`. Must use atomic MongoDB operations (`$inc`) to prevent race conditions. | PM (Stage 1) |
| D-007 | Phase ordering: Phase 0 (Tally XML fixes) → Phase 1 (TDS cumulative) + Phase 2 (Vendor CRUD) parallel → Phase 3 (Payments) → Phase 4 (Payment voucher) → Phase 5 (Reconciliation). | PM (Stage 1) |
| D-008 | UX quick wins execute immediately, parallel with all phases: risk signal defaults, action queue, pre-export checklist, PAN label fix. | PM (Stage 1) |
| D-009 | Tenant model must include `tan` field (Tax Deduction Account Number). Required for all TDS operations and reporting. | CA (Stage 2) |
| D-010 | TDS taxable base must exclude GST when GST is shown separately on the invoice, per CBDT Circular 23/2017. | CA (Stage 2) |
| D-011 | Payment model supports "unallocated" state for advance payments (payment recorded before invoice exists). Allocations array can be empty initially. | CA (Stage 2) |
| D-012 | Payment reversal modeled as a separate `Payment` document with `type="reversal"` and `reversesPaymentId`. Original payment never mutated. Preserves audit immutability. | CA (Stage 2) |
| D-013 | VendorMaster must support Section 197 lower deduction certificate: `lowerDeductionCert` subdocument with `certificateNumber`, `validFrom`, `validTo`, `maxAmountMinor`, `applicableRateBps`. TDS calculation checks this before standard rate. | CA (Stage 2) |
| D-014 | MSME payment tracking: enforce shorter of (agreed payment terms) and (45 days from acceptance). Track both. Calculate interest at 3× bank rate compounded monthly for overdue. | CA (Stage 2) |
| D-015 | Payment Run concept: `PaymentRun` model groups multiple Payment records for batch processing. Includes payment instruction file generation for bank upload (deferred). | Accounting Ops (Stage 3) |
| D-016 | Split reconciliation limit increased from 5 to 10 invoices per subset-sum combination. | Accounting Ops (Stage 3) |
| D-017 | Duplicate payment detection: unique index on `tenantId` + UTR/reference. Block if duplicate found. | Accounting Ops (Stage 3) |
| D-018 | Aging report: standard AP buckets (Current, 1-30, 31-60, 61-90, 90+) based on due date. First-class report, not derived ad-hoc. | Accounting Ops (Stage 3) |
| D-019 | Tally XML fixes are Phase 0 — execute immediately before any other phase. 1-2 days effort. | Accounting Ops (Stage 3) |
| D-020 | Payment model must validate UTR format based on payment method. NEFT/RTGS: alphanumeric 16-22 chars. UPI: varies. Cheque: 6-digit numeric. | Bank (Stage 4) |
| D-021 | "Payment bank account" is a separate concept from AA BankAccount. For MVP, add `bankLedgerName` field to Payment (string matching Tally bank ledger). Full bank account management deferred. | Bank (Stage 4) |
| D-022 | Cash payment risk signal: `CASH_PAYMENT_ABOVE_LIMIT` when payment method is "cash" and amount exceeds Rs 2,00,000 (per Section 40A(3)). | Bank (Stage 4) |
| D-023 | Reconciliation date matching must allow ±2 business day tolerance for settlement timing differences. | Bank (Stage 4) |
| D-024 | TDS rate hierarchy: (1) Section 197 certificate, (2) 206AB non-filer penalty, (3) 206AA no-PAN 20%, (4) tenant override, (5) standard rate. Apply highest applicable, except Section 197 overrides downward. | Tax (Stage 5) |
| D-025 | TDS computation result stored on invoice must include: `rateSource` enum, applied rate BPS, taxable base breakdown. | Tax (Stage 5) |
| D-026 | TDS quarter assignment: Q1(Apr-Jun), Q2(Jul-Sep), Q3(Oct-Dec), Q4(Jan-Mar). Based on deduction date, not processing date. | Tax (Stage 5) |
| D-027 | Section 206AB check deferred to Phase 3+ (requires external API integration with CBDT specified persons list). Add as configurable risk signal for now. | Tax (Stage 5) |
| D-028 | Tally connectivity: file-based export only (Phases 1-5). Desktop bridge agent Phase 6+. No direct cloud-to-Tally connection possible. | Integration (Stage 6) |
| D-029 | Batch export: use batch XML for all export operations. Single HTTP request per batch. Maximum batch size: 100 vouchers. | Integration (Stage 6) |
| D-030 | GUID for Tally vouchers: SHA-256 of `{tenantId}:{invoiceId}:{exportVersion}`. First export = Create, subsequent = Alter. Track `exportVersion` counter on Invoice.export subdocument. | Integration (Stage 6) |
| D-031 | PLACEOFSUPPLY: derive from vendor GSTIN first 2 digits using GSTN state code mapping. Store on VendorMaster as `stateCode` and `stateName`. | Integration (Stage 6) |
| D-032 | XML encoding: always emit `<?xml version="1.0" encoding="UTF-8"?>` declaration. Sanitize non-printable characters from all text fields. | Integration (Stage 6) |
| D-033 | MVP scope: Phase 0 (Tally fixes, 1-2d) + Phase 1 (TDS cumulative, 2-3w) + Phase 2 (Vendor CRUD, 1w parallel) + Phase 3 (Payment, 2-3w) + Phase 4 (Payment voucher, 1-2w). UX quick wins parallel throughout. | Product (Stage 7) |
| D-034 | Demo scope: Phase 0 + Phase 1 + Phase 2 + UX quick wins. Target: 4-5 weeks. | Product (Stage 7) |
| D-035 | Re-export strategy: track per-invoice status in ExportBatch. Re-send only failed invoices. `exportVersion` counter for GUID evolution. | Product (Stage 7) |
| D-036 | New capabilities: `canRecordPayments`, `canApprovePayments`, `canExportPaymentVouchers` added to user capabilities schema. | Product (Stage 7) |
| D-037 | New services: PaymentService, TdsVendorLedgerService, PaymentVoucherExporter, VendorService, AuditLogService, ReportService. Each as independent service files. | Architecture (Stage 8) |
| D-038 | TDS cumulative update must use MongoDB atomic operations (`$inc`, `$push` via `findOneAndUpdate`). Full transactions require replica set — degrade gracefully to atomic ops on standalone. | Architecture (Stage 8) |
| D-039 | AuditLog writes: async fire-and-forget. Write failure must not block primary operation. Log failures to application logger. | Architecture (Stage 8) |
| D-040 | 100% branch coverage on TdsCalculationService and TdsVendorLedgerService. Test matrix must cover all threshold boundary conditions and rate hierarchy combinations. | Architecture (Stage 8) |
| D-041 | TdsVendorLedger backfill: idempotent migration script. Group existing approved invoices by (tenantId, vendorFingerprint, FY, section). Compute cumulative sums. Run as background job. | Architecture (Stage 8) |
| D-042 | Shared constant pattern for enums: define once as `const` array, reference in both Mongoose schema and TypeScript types. Prevents drift. | Implementation (Stage 9) |
| D-043 | IST timezone (Asia/Kolkata) for FY determination. All invoice dates interpreted in IST for financial year boundary calculation. | Implementation (Stage 9) |
| D-044 | Migration scripts: cursor-based iteration, batch size 100, for memory safety. | Implementation (Stage 9) |

### 16.2 Constraints (C-001 through C-020)

| ID | Constraint | Source Stage |
|---|---|---|
| C-001 | All `*Minor` financial fields must use integer validation (`Number.isInteger`). No floating-point currency values. | PM (Stage 1) |
| C-002 | Financial year = April-March. FY determination: month ≥ 4 → current year start, else previous year start. | PM (Stage 1) |
| C-003 | MSME payment deadline: enforce shorter of (agreed payment terms) and (45 days from acceptance date) per MSMED Act 2006 Section 15. | PM (Stage 1) |
| C-004 | No-PAN TDS rate: minimum 20% per Section 206AA of Income Tax Act. | PM (Stage 1) |
| C-005 | Tally export must use `ALLLEDGERENTRIES.LIST` (not `LEDGERENTRIES.LIST`) for all voucher types. | PM (Stage 1) |
| C-006 | AuditLog is immutable: insert-only collection, no updates or deletes permitted. | PM (Stage 1) |
| C-007 | Deductor's TAN must be present on all TDS-related exports and reports. | CA (Stage 2) |
| C-008 | TDS taxable base = invoice amount − GST (when GST shown separately). Per CBDT Circular 23/2017. | CA (Stage 2) |
| C-009 | Payment reversals must be new documents (`type="reversal"`), never mutations of existing Payment records. | CA (Stage 2) |
| C-010 | Duplicate UTR/reference detection enforced at database level: unique sparse index on `tenantId` + `utrNumber`. | Accounting Ops (Stage 3) |
| C-011 | Reconciliation amount matching must account for TDS deduction: expected bank debit = net payable (after TDS) + TCS. | Accounting Ops (Stage 3) |
| C-012 | Cash payments > Rs 2,00,000 per transaction are non-deductible expenses per IT Act Section 40A(3). Must emit risk signal. | Bank (Stage 4) |
| C-013 | Payment method enum: `neft`, `rtgs`, `upi`, `imps`, `cheque`, `cash`, `other`. Must match Indian payment rails. | Bank (Stage 4) |
| C-014 | TDS quarter based on deduction date, not processing date. Boundaries: Q1(Apr1-Jun30), Q2(Jul1-Sep30), Q3(Oct1-Dec31), Q4(Jan1-Mar31). | Tax (Stage 5) |
| C-015 | TDS taxable base when GST not shown separately (inclusive amount): TDS applies on full invoice amount. | Tax (Stage 5) |
| C-016 | Tally export XML must include `<?xml version="1.0" encoding="UTF-8"?>` declaration. | Integration (Stage 6) |
| C-017 | `PLACEOFSUPPLY` tag required on all vouchers with GST entries. | Integration (Stage 6) |
| C-018 | Batch export maximum: 100 vouchers per request. | Integration (Stage 6) |
| C-019 | AuditLog retention: minimum 8 years. No TTL index for compliance tenants. | Architecture (Stage 8) |
| C-020 | TDS computation must be deterministic: pure function of inputs (invoice data, rate table, cumulative ledger, certificates). No external side effects during computation. | Architecture (Stage 8) |

### 16.3 Resolved Conflicts (RC-001 through RC-006)

| ID | Conflict | Resolution | Source Stage |
|---|---|---|---|
| RC-001 | Payment model: PRD proposed batch-oriented `Payment` vs Data Model proposed per-invoice `PaymentEntry` | Resolved in favor of PRD's batch-oriented `Payment` with `allocations[]` array. Multi-invoice payments are common in Indian AP. | PM (Stage 1) |
| RC-002 | Reconciliation model: PRD proposed flat `ReconciliationMapping` vs Data Model proposed normalized `BankTransactionMapping` junction table | Resolved in favor of junction table approach. One row per (transaction, invoice) pair. Cleaner for M:N queries. | PM (Stage 1) |
| RC-003 | Audit model: PRD proposed simpler `AuditEvent` vs Data Model proposed `AuditLog` with `previousValue`/`newValue` | Resolved in favor of `AuditLog` with change tracking. Regulatory compliance requires knowing what changed, not just that something changed. | PM (Stage 1) |
| RC-004 | Tally XML tag: `LEDGERENTRIES.LIST` vs `ALLLEDGERENTRIES.LIST` | Definitively resolved: `ALLLEDGERENTRIES.LIST` is the only correct tag for Tally Prime. | PM (Stage 1) |
| RC-005 | `ISINVOICE` flag: `No` vs `Yes` | Definitively resolved: `Yes` for all purchase vouchers. Required for bill tracking, GST filing, and payment settlement. | PM (Stage 1) |
| RC-006 | MSME payment terms: "max 45 days" vs "agreed period OR 45 days" | Resolved: enforce shorter of (agreed period, 45 days). Track both agreed and statutory limits. Interest at 3× bank rate compounded monthly. | CA (Stage 2) |

---

## 17. VKL Traceability Matrix

Every section of this document is grounded in VKL decisions:

| Section | VKL Decisions | VKL Constraints |
|---|---|---|
| 2.1 Invoice Lifecycle | D-001 | — |
| 2.2 Payment Lifecycle | D-002, D-011, D-012 | C-009, C-010 |
| 2.3 Payment Run | D-015 | — |
| 2.4 TDS Computation | D-006, D-010, D-024, D-025, D-026, D-027, D-038, D-043 | C-001, C-002, C-004, C-008, C-014, C-015, C-020 |
| 3.2 Purchase Voucher Fix | D-005, D-019 | C-005, C-016, C-017 |
| 3.3 Payment Voucher | D-002 | — |
| 3.4 Batch Export | D-029 | C-018 |
| 3.5 Deduplication | D-030, D-035 | — |
| 3.6 PLACEOFSUPPLY | D-031 | C-017 |
| 4.1 Payment Model | D-002, D-011, D-012, D-017, D-020 | C-001, C-009, C-010, C-013 |
| 4.1 TdsVendorLedger | D-006, D-026 | C-001, C-002, C-014 |
| 4.1 ReconciliationMapping | D-003 | C-001 |
| 4.1 AuditLog | D-004, D-039 | C-006, C-019 |
| 4.2 Invoice Extensions | D-001 | C-001 |
| 4.2 VendorMaster Extensions | D-013, D-031 | — |
| 4.2 Tenant TAN | D-009 | C-007 |
| 6.1 TDS Compliance | D-009, D-010, D-013, D-024, D-025, D-026, D-027 | C-004, C-007, C-008, C-014, C-015 |
| 6.4 MSME | D-014 | C-003 |
| 7.1 Payment Methods | D-020 | C-012, C-013 |
| 8.2 Reconciliation | D-016, D-023 | C-011 |
| 10. Architecture | D-037, D-038, D-039, D-040, D-041, D-042, D-043, D-044 | C-019, C-020 |
