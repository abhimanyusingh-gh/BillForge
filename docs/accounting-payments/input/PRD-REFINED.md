# Refined PRD: Accounting, Payments, and Tally Integration for LedgerBuddy

## 1. Executive Summary

This document refines the draft "Accounting, Payments & Tally Integration" PRD by grounding every requirement in what LedgerBuddy actually has today versus what needs to be built. The codebase was read exhaustively across 35+ files.

**What already exists (no new work needed):**
- Full invoice lifecycle: PENDING through EXPORTED, with multi-step approval workflows
- TDS calculation with section detection (194C, 194J, 194H, 194I, 194Q, 194A), rate lookup by PAN category, single-transaction threshold check, and risk signals
- TCS rate config per tenant with audit history
- GST breakdown (CGST/SGST/IGST/Cess) on invoices and in Tally XML export
- Tally export: Purchase voucher XML generation with GST ledger entries, TDS deduction entries, TCS entries, party GSTIN, and narration
- Tally export config per tenant (company name, ledger names for purchase/GST/TDS/TCS)
- Bank statement upload (PDF + CSV), transaction parsing, and auto-reconciliation with a scoring algorithm
- Vendor master with PAN validation, GSTIN cross-reference, bank change detection, MSME tracking
- GL code suggestion (vendor default, description match, SLM classification, manual)
- Cost center suggestion
- IRN (e-invoice) validation
- Risk signal framework with configurable severity, enable/disable per tenant
- CSV export with configurable columns

**What does NOT exist (new work required):**
- Payment recording (no `Payment` model, no payment status on invoices, no partial/full payment tracking)
- TDS cumulative vendor threshold tracking (the `thresholdAnnualMinor` field exists in `TdsRateTable` but is never checked -- the `TdsCalculationService` only checks `thresholdSingleMinor`)
- Split/aggregate transaction-to-invoice mapping in reconciliation (current system is 1:1 only)
- Tally vendor/ledger sync (no read from Tally, no bidirectional sync)
- Tally Payment voucher generation (current system only generates Purchase vouchers)
- Event/audit log model (no events emitted, no event store)
- FY (Financial Year) context for TDS cumulative tracking
- Debit note / credit note handling

---

## 2. Current State Assessment (Codebase Evidence)

### 2.1 Invoice States

The actual invoice status enum from `/Users/abhimanyusingh/IdeaProjects/Invoice Processor/backend/src/types/invoice.ts` lines 4-13:

```
PENDING -> PARSED -> NEEDS_REVIEW -> AWAITING_APPROVAL -> APPROVED -> EXPORTED
                 \-> FAILED_OCR
                 \-> FAILED_PARSE
```

The draft PRD proposes `CREATED -> TDS_CALCULATED -> PARTIALLY_PAID -> FULLY_PAID -> EXPORTED_TO_TALLY`. This conflicts completely. The system does not have payment states and TDS is not a distinct status -- it is computed during compliance enrichment and stored as a subdocument on the invoice.

### 2.2 TDS Infrastructure

`TdsCalculationService` at lines 26-255:
- Detects TDS section via `TdsSectionMapping` (glCategory + panCategory -> section)
- Looks up rate from `TdsRateTable` (with tenant override from `TenantComplianceConfig.tdsRates`)
- Computes TDS amount = taxableAmount * rateBps / 10000
- Checks `thresholdSingleMinor` (per-invoice threshold)
- Does NOT check `thresholdAnnualMinor` -- this value exists in the schema and seed data but is never used in computation

This is the single largest gap relevant to the PRD.

### 2.3 Tally Export

`TallyExporter` generates Purchase voucher XML only. The XML structure:
- ENVELOPE > BODY > DATA > TALLYMESSAGE > VOUCHER (type=Purchase)
- LEDGERENTRIES.LIST entries for: Party (credit), Purchase ledger (debit), GST ledgers (debit), TDS ledger (credit), TCS ledger (debit)
- Sends to Tally via HTTP POST to `TALLY_ENDPOINT` with XML body
- Can also generate batch XML file for download
- Per-tenant config via `TenantExportConfig` (company name, ledger names)

No Payment voucher, no Journal voucher, no Debit/Credit note voucher generation exists.

### 2.4 Reconciliation

`ReconciliationService` lines 34-273:
- 1:1 matching only (one transaction to one invoice)
- Scoring: amount match (50 pts exact, 30 pts within tolerance), invoice number in description (30 pts), vendor name word overlap (20 pts), date proximity (2-10 pts)
- Auto-match above configurable threshold (default 50), suggest above suggest threshold (default 30)
- TCS adjustment is factored in (netPayable + TCS)
- No split mapping (one payment to multiple invoices)
- No aggregate mapping (multiple payments to one invoice)

### 2.5 Bank Account Model

`BankAccount` is for Account Aggregator (AA) integration, not for tracking outgoing payments. It has consent-based access states (pending_consent, active, paused, revoked, expired, error). It stores balance but has no concept of "our bank account for paying vendors."

---

## 3. Section-by-Section Analysis

### Section 4.1: Invoice Lifecycle (States & Transitions)

#### What exists today
- Invoice states: PENDING, PARSED, NEEDS_REVIEW, AWAITING_APPROVAL, APPROVED, EXPORTED, FAILED_OCR, FAILED_PARSE (`types/invoice.ts:4-13`)
- Approval transitions handled by `InvoiceService.approveInvoices` and `ApprovalWorkflowService` (multi-step, condition-based, role-based)
- Export transitions handled by `ExportService` (APPROVED -> EXPORTED)
- Retry transitions: FAILED_OCR/FAILED_PARSE/PARSED/NEEDS_REVIEW -> PENDING

#### What's missing (gaps)
- No payment tracking states (PARTIALLY_PAID, FULLY_PAID, PAYMENT_INITIATED)
- No "rejected" terminal state (workflow rejection returns to NEEDS_REVIEW, not a terminal REJECTED)
- No concept of "payment recorded" as a lifecycle event

#### Conflicts with current implementation
- The draft PRD proposes replacing the existing state machine with `CREATED -> TDS_CALCULATED -> PARTIALLY_PAID -> FULLY_PAID -> EXPORTED_TO_TALLY`. This must be abandoned. TDS is a compliance enrichment that runs during the extraction pipeline, not a discrete status. Payment states should be additive, not replacing.

#### Refined requirements
- **Keep all existing states unchanged**
- Add new payment-tracking fields to the Invoice compliance subdocument rather than adding new invoice statuses. Rationale: an invoice can be APPROVED and simultaneously have partial payment. Payment is an attribute, not a lifecycle phase.
- Add a new `paymentStatus` field on Invoice: `"unpaid" | "partially_paid" | "fully_paid" | "overpaid"`, computed from linked Payment records
- Add a `paidAmountMinor` computed field that sums all Payment records for the invoice

---

### Section 4.2: TDS Calculation

#### What exists today
- `TdsCalculationService.computeTds()` (`TdsCalculationService.ts:134-254`): full per-invoice TDS computation
- Section detection via `TdsSectionMapping` (glCategory + panCategory matrix)
- Rate lookup from `TdsRateTable` (per-section, per-PAN-category: company, individual, no-PAN) with tenant override
- `thresholdSingleMinor` check: skips TDS if invoice below single-transaction threshold
- `thresholdAnnualMinor`: stored in `TdsRateTable` schema (`TdsRateTable.ts:11`) and seeded (e.g., 194C = Rs 1,00,000; 194I(a) = Rs 2,40,000) but NEVER CHECKED in calculation logic
- TDS risk signals: NO_PAN_PENALTY_RATE, SECTION_AMBIGUOUS, BELOW_THRESHOLD
- Manual TDS override via PATCH endpoint (section, source=manual)
- TDS amount flows into Tally XML export as a credit ledger entry

#### What's missing (gaps)
- **Cumulative annual threshold tracking per vendor per FY**: The `thresholdAnnualMinor` field is seeded but never evaluated. For sections like 194C (annual threshold Rs 1,00,000) and 194I (Rs 2,40,000), TDS should only apply when cumulative payments to a vendor exceed the annual threshold.
- No `TdsVendorLedger` or equivalent to track cumulative amounts
- No FY context (financial year April-March) for threshold resets
- No backdated invoice recomputation (if an old invoice is processed that pushes cumulative over threshold, prior invoices need re-evaluation)
- No TDS certificate (Form 16A) generation or tracking

#### Conflicts with current implementation
- The PRD treats TDS as a status in the invoice lifecycle. It is actually a compliance enrichment step that runs during extraction. This is correct and should not change.

#### Refined requirements
New model: **TdsVendorLedger**
```typescript
{
  tenantId: string;
  vendorFingerprint: string;
  financialYear: string;        // "2025-26" (April-March)
  section: string;              // "194C"
  cumulativeBaseMinor: number;  // sum of taxable amounts
  cumulativeTdsMinor: number;   // sum of TDS deducted
  invoiceCount: number;
  thresholdCrossedAt: Date | null;
  lastUpdatedInvoiceId: string;
  entries: Array<{
    invoiceId: string;
    invoiceDate: Date;
    taxableAmountMinor: number;
    tdsAmountMinor: number;
    recordedAt: Date;
  }>;
}
```

Algorithm change in `TdsCalculationService.computeTds()`:
1. After section detection and rate lookup, if `thresholdAnnualMinor > 0`, query `TdsVendorLedger` for the vendor+section+FY
2. If `cumulativeBaseMinor + currentTaxableAmount < thresholdAnnualMinor`: set TDS to 0, emit `TDS_BELOW_ANNUAL_THRESHOLD` risk signal (info)
3. If the current invoice causes the cumulative to cross the threshold for the first time: compute TDS on the entire cumulative amount (not just the current invoice), then subtract what was already deducted
4. After computation, upsert the `TdsVendorLedger` entry
5. Add a new risk signal code: `TDS_ANNUAL_THRESHOLD_CROSSED`

---

### Section 4.3: Reconciliation & Payment Matching

#### What exists today
- `ReconciliationService` with scoring-based 1:1 matching (`ReconciliationService.ts:34-273`)
- Scoring model: amount (50/30 pts), invoice number in description (30 pts), vendor name (20 pts), date proximity (2-10 pts)
- Configurable thresholds per tenant: `reconciliationAutoMatchThreshold`, `reconciliationSuggestThreshold`, `reconciliationAmountToleranceMinor`
- Manual match/unmatch endpoints
- TCS adjustment in amount matching
- GSTIN-filtered matching (when statement has GSTIN assigned)
- Match result stored on both `BankTransaction.matchedInvoiceId` and `Invoice.compliance.reconciliation`

#### What's missing (gaps)
- **Split mapping**: one bank transaction paying multiple invoices (very common -- vendor sends one payment for 3 invoices)
- **Aggregate mapping**: multiple bank transactions for one invoice (e.g., advance + final payment)
- No partial payment tracking when a transaction amount is less than the invoice amount
- No debit note / credit note handling in reconciliation
- No recurring payment pattern detection

#### Conflicts with current implementation
- The current schema uses `matchedInvoiceId: string` (singular) on `BankTransaction`. Split mapping requires `matchedInvoiceIds: string[]` or a junction table.
- The current schema stores `compliance.reconciliation.bankTransactionId: string` (singular) on Invoice. Aggregate mapping requires an array.

#### Refined requirements

**Phase 1 (keep existing 1:1, add manual split/aggregate):**
- New model: **ReconciliationMapping**
```typescript
{
  tenantId: string;
  transactionIds: string[];     // one or many bank transaction IDs
  invoiceIds: string[];         // one or many invoice IDs
  type: "one_to_one" | "split" | "aggregate" | "partial";
  allocations: Array<{
    transactionId: string;
    invoiceId: string;
    allocatedMinor: number;
  }>;
  createdBy: string;
  createdAt: Date;
  matchSource: "auto" | "manual";
}
```
- Keep existing 1:1 auto-matching as-is
- Add manual endpoints for creating split/aggregate mappings
- Update `Invoice.compliance.reconciliation` to allow `bankTransactionIds: string[]`

**Phase 2 (auto split/aggregate detection):**
- After 1:1 matching pass, run a second pass for unmatched transactions:
  - Group unmatched debit transactions by date+reference pattern
  - Check if their sum matches an unmatched invoice (aggregate scenario)
  - Check if a single unmatched transaction matches the sum of multiple unmatched invoices (split scenario)

---

### Section 4.4: Payment Recording

#### What exists today
- **Nothing.** There is no Payment model, no payment recording endpoint, no payment status field.
- Bank reconciliation matches bank transactions to invoices but does not record "a payment was made." It records "a debit in the bank statement looks like it corresponds to this invoice."

#### What's missing (gaps)
- Full Payment model with recording, status tracking, and history
- Payment method tracking (NEFT/RTGS/UPI/cheque)
- Payment-to-invoice linking (with partial payment support)
- Payment approval workflow (separate from invoice approval)
- UTR (Unique Transaction Reference) tracking
- Payment scheduling (based on due dates, MSME deadlines)

#### Refined requirements

New model: **Payment**
```typescript
{
  tenantId: string;
  paymentNumber: string;         // auto-generated or manual
  vendorFingerprint: string;
  paymentDate: Date;
  amountMinor: number;
  currency: string;
  method: "neft" | "rtgs" | "upi" | "cheque" | "cash" | "other";
  utrNumber: string | null;
  chequeNumber: string | null;
  bankAccountId: string | null;  // ref to BankAccount
  status: "draft" | "approved" | "processed" | "failed" | "cancelled";
  allocations: Array<{
    invoiceId: string;
    allocatedMinor: number;
    tdsDeductedMinor: number;
    tcsCollectedMinor: number;
    netPaidMinor: number;
  }>;
  reconciliationMappingId: string | null;
  createdBy: string;
  notes: string | null;
}
```

New API endpoints:
- `POST /payments` -- record a payment
- `GET /payments` -- list payments (with filters: vendor, date range, status)
- `GET /payments/:id` -- payment detail
- `PATCH /payments/:id` -- update draft payment
- `POST /payments/:id/approve` -- approve payment
- `DELETE /payments/:id` -- cancel draft payment

---

### Section 4.5: Tally Export (Purchase Vouchers)

#### What exists today
- `TallyExporter` generates Purchase voucher XML (`tallyExporter/xml.ts:101-222`)
- Voucher elements include: DATE, VOUCHERTYPENAME (Purchase), VOUCHERNUMBER, PARTYLEDGERNAME, NARRATION, PARTYGSTIN
- LEDGERENTRIES.LIST for: Party (credit, negative), Purchase ledger (debit), GST ledgers (CGST/SGST/IGST/Cess, debit), TDS ledger (credit, negative), TCS ledger (debit)
- Per-tenant config: company name, purchase ledger, GST ledger names, TDS prefix, TCS ledger (`TenantExportConfig.ts`)
- Export modes: direct HTTP POST to Tally + batch file download
- Export history tracking via `ExportBatch` model
- Amount resolution with OCR fallback
- Validation: rejects invoices with missing vendor name, missing/invalid invoice number, invalid amount

#### What's missing (gaps)
- No Payment voucher generation (for recording outgoing payments in Tally)
- No Journal voucher generation (for TDS adjustments, write-offs)
- No Debit Note / Credit Note voucher generation
- No Tally ledger master import (creating vendor party ledgers in Tally)
- No Tally data read (fetching existing ledgers/groups from Tally to validate)
- No HSN/SAC line-item level export (current export is header-level only, despite line items existing on the invoice model)

#### Conflicts with current implementation
- None. The PRD's Tally requirements are additive.

#### Refined requirements

**Phase 1: Payment Voucher Generation**
- New function `buildTallyPaymentVoucherPayload(input: PaymentVoucherInput)` in `xml.ts`
- PaymentVoucherInput structure:
```typescript
{
  companyName: string;
  voucherNumber: string;
  partyLedgerName: string;
  bankLedgerName: string;
  amountMinor: number;
  currency?: string;
  date: Date;
  narration?: string;
  tds?: { section: string; amountMinor: number; ledgerName: string };
  tcs?: { amountMinor: number; ledgerName: string };
}
```
- VOUCHER VCHTYPE="Payment" with LEDGERENTRIES: Bank (credit), Party (debit), TDS (credit if applicable)

**Phase 2: Tally Ledger Sync**
- Tally XML export request to fetch existing ledgers: `<ENVELOPE><HEADER><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>List of Ledgers</ID></HEADER>...</ENVELOPE>`
- Parse response to build a local cache of Tally ledger names
- Before export, validate that party ledger and all other referenced ledgers exist in Tally
- Auto-create missing party ledgers with correct parent group (Sundry Creditors)

---

### Section 4.6: Vendor Master & Tally Sync

#### What exists today
- `VendorMaster` model (`VendorMaster.ts:15-55`): vendorFingerprint, name, aliases, PAN, GSTIN, panCategory, defaultGlCode, defaultCostCenter, defaultTdsSection, bankHistory, MSME info, emailDomains, invoiceCount
- `VendorMasterService` (`VendorMasterService.ts:23-170`): upsertFromInvoice (auto-creates/updates on each invoice), detectBankChange, updateBankHistory
- Vendor fingerprint is created during extraction (hash of normalized vendor name)

#### What's missing (gaps)
- No Tally vendor sync (LedgerBuddy vendor master is independent of Tally's ledger master)
- No vendor CRUD API (vendors are auto-created from invoices only, no manual add/edit)
- No vendor merge/dedup (if the same vendor has multiple fingerprints)
- No `tallyLedgerName` field on vendor (the Tally party ledger name may differ from the extracted vendorName)
- No vendor status (active/inactive/blocked)

#### Refined requirements

Add fields to `VendorMaster`:
```typescript
tallyLedgerName: string | null;   // mapped Tally party ledger name
tallyLedgerGroup: string | null;  // Tally parent group (default: "Sundry Creditors")
vendorStatus: "active" | "inactive" | "blocked";
```

New API endpoints:
- `GET /vendors` -- list vendors with search, pagination
- `GET /vendors/:fingerprint` -- vendor detail with invoice history summary
- `PATCH /vendors/:fingerprint` -- update vendor fields (tallyLedgerName, defaultGlCode, defaultTdsSection, vendorStatus)
- `POST /vendors/:fingerprint/merge` -- merge two vendor fingerprints

Tally sync (Phase 3 -- not for demo):
- POST `tallyEndpoint` with export request for ledger list under "Sundry Creditors" group
- Fuzzy-match LedgerBuddy vendors to Tally ledgers by name
- Allow manual mapping via `tallyLedgerName` field
- On export, use `tallyLedgerName` instead of `parsed.vendorName` if set

---

### Section 4.7: GST Compliance

#### What exists today
- Full GST breakdown on invoices: GSTIN, subtotalMinor, CGST, SGST, IGST, Cess, totalTaxMinor (`types/invoice.ts:41-49`)
- Line-item level GST: each line item has cgstMinor, sgstMinor, igstMinor (`types/invoice.ts:51-61`)
- HSN/SAC on line items (`InvoiceLineItem.hsnSac`)
- GSTIN cross-reference with PAN validation
- IRN (e-invoice) validation with configurable threshold
- GST ledger mapping per tenant (`TenantExportConfig.tallyCgstLedger` etc.)
- Tally XML export with separate GST ledger entries

#### What's missing (gaps)
- No GSTR-2B matching/validation (comparing invoice data against GST portal data)
- No ITC (Input Tax Credit) eligibility tracking
- No GST return filing integration
- No reverse charge mechanism (RCM) handling
- No inter-state vs intra-state GST automatic determination (this is currently determined by which fields are present -- if IGST > 0, it is inter-state)

#### Refined requirements

For the near term (demo-ready):
- Add `gstTreatment` field to invoice compliance: `"regular" | "reverse_charge" | "exempt" | "nil_rated" | "composition"`
- When `gstTreatment = "reverse_charge"`, the Tally export should use RCM voucher entries
- Add `itcEligible` boolean to invoice compliance (default true; false for blocked credits)
- These are low-effort additions that dramatically increase the value proposition for Indian CA firms

---

### Section 4.8: Approval Workflow

#### What exists today
- Full multi-step approval workflow (`ApprovalWorkflow.ts`, `approvalWorkflowService.ts`)
- Modes: simple (1-click) and advanced (multi-step)
- Step types: approval, compliance_signoff, escalation
- Approver types: any_member, role, specific_users, persona, capability
- Approval rules: any (one approver suffices) or all (every approver must sign)
- Conditions on steps: totalAmountMinor gt/lt/eq, tdsAmountMinor, riskSignalMaxSeverity, glCodeSource
- Timeout and escalation fields (schema exists, enforcement not implemented)
- Workflow state tracked on invoice as subdocument

#### What's missing (gaps)
- Timeout enforcement (no background job checking for timed-out steps)
- Escalation execution (field exists but no logic)
- Payment approval (separate from invoice approval)
- Audit trail (workflow steps are stored in workflowState.stepResults but not in a separate audit collection)

#### Conflicts with current implementation
- None. The PRD's workflow requirements are additive.

#### Refined requirements
- Implement timeout enforcement via a periodic job (check invoices in AWAITING_APPROVAL where currentStep timeout has elapsed, auto-escalate or auto-approve based on config)
- Payment approval should reuse the same workflow infrastructure but with a separate `ApprovalWorkflow` document keyed by `{ tenantId, workflowType: "payment" }`
- Add `workflowType` field to `ApprovalWorkflow` model: `"invoice" | "payment"` (default "invoice" for backward compatibility)

---

### Section 4.9: Reporting & Analytics

#### What exists today
- Platform analytics dashboard with KPIs, documents by tenant, status distribution
- Invoice listing with faceted counts (total, approved, pending, failed, needsReview, awaitingApproval, exported per status)
- Export history listing with batch counts

#### What's missing (gaps)
- TDS liability report (per vendor, per section, per FY)
- Payment aging report (overdue invoices by aging bucket)
- Vendor payment summary (total paid, total outstanding, average payment days)
- GST ITC summary report
- Reconciliation summary (matched%, unmatched transactions, value gaps)
- Bank statement coverage report

#### Refined requirements
New read-only API endpoints:
- `GET /reports/tds-liability?fy=2025-26` -- aggregate TdsVendorLedger by section
- `GET /reports/payment-aging` -- invoices grouped by aging bucket (0-30, 31-60, 61-90, 90+)
- `GET /reports/vendor-summary?vendorFingerprint=X` -- payment and invoice history for a vendor
- `GET /reports/reconciliation-summary` -- match rates and value gaps across all statements

---

## 4. New Domain Models (Schema Definitions)

### 4.1 TdsVendorLedger (NEW)
```typescript
// File: backend/src/models/compliance/TdsVendorLedger.ts
const tdsVendorLedgerEntrySchema = new Schema({
  invoiceId: { type: String, required: true },
  invoiceDate: { type: Date, required: true },
  taxableAmountMinor: { type: Number, required: true },
  tdsAmountMinor: { type: Number, required: true },
  recordedAt: { type: Date, required: true }
}, { _id: false });

const tdsVendorLedgerSchema = new Schema({
  tenantId: { type: String, required: true },
  vendorFingerprint: { type: String, required: true },
  financialYear: { type: String, required: true },      // "2025-26"
  section: { type: String, required: true },
  cumulativeBaseMinor: { type: Number, required: true, default: 0 },
  cumulativeTdsMinor: { type: Number, required: true, default: 0 },
  invoiceCount: { type: Number, required: true, default: 0 },
  thresholdCrossedAt: { type: Date, default: null },
  lastUpdatedInvoiceId: { type: String },
  entries: { type: [tdsVendorLedgerEntrySchema], default: [] }
}, { timestamps: true });

// Indexes
tdsVendorLedgerSchema.index({ tenantId: 1, vendorFingerprint: 1, financialYear: 1, section: 1 }, { unique: true });
tdsVendorLedgerSchema.index({ tenantId: 1, financialYear: 1, section: 1 });
```

### 4.2 Payment (NEW)
```typescript
// File: backend/src/models/payment/Payment.ts
const paymentAllocationSchema = new Schema({
  invoiceId: { type: String, required: true },
  allocatedMinor: { type: Number, required: true },
  tdsDeductedMinor: { type: Number, default: 0 },
  tcsCollectedMinor: { type: Number, default: 0 },
  netPaidMinor: { type: Number, required: true }
}, { _id: false });

const paymentSchema = new Schema({
  tenantId: { type: String, required: true },
  paymentNumber: { type: String, required: true },
  vendorFingerprint: { type: String, required: true },
  paymentDate: { type: Date, required: true },
  amountMinor: { type: Number, required: true },
  currency: { type: String, default: "INR" },
  method: { type: String, enum: ["neft", "rtgs", "upi", "cheque", "cash", "other"], required: true },
  utrNumber: { type: String, default: null },
  chequeNumber: { type: String, default: null },
  bankAccountId: { type: String, default: null },
  status: { type: String, enum: ["draft", "approved", "processed", "failed", "cancelled"], default: "draft" },
  allocations: { type: [paymentAllocationSchema], default: [] },
  reconciliationMappingId: { type: String, default: null },
  createdBy: { type: String, required: true },
  notes: { type: String, default: null }
}, { timestamps: true });

// Indexes
paymentSchema.index({ tenantId: 1, createdAt: -1 });
paymentSchema.index({ tenantId: 1, vendorFingerprint: 1 });
paymentSchema.index({ tenantId: 1, status: 1 });
paymentSchema.index({ tenantId: 1, paymentNumber: 1 }, { unique: true });
```

### 4.3 ReconciliationMapping (NEW)
```typescript
// File: backend/src/models/bank/ReconciliationMapping.ts
const allocationEntrySchema = new Schema({
  transactionId: { type: String, required: true },
  invoiceId: { type: String, required: true },
  allocatedMinor: { type: Number, required: true }
}, { _id: false });

const reconciliationMappingSchema = new Schema({
  tenantId: { type: String, required: true },
  transactionIds: { type: [String], required: true },
  invoiceIds: { type: [String], required: true },
  type: { type: String, enum: ["one_to_one", "split", "aggregate", "partial"], required: true },
  allocations: { type: [allocationEntrySchema], default: [] },
  createdBy: { type: String, required: true },
  matchSource: { type: String, enum: ["auto", "manual"], required: true }
}, { timestamps: true });

reconciliationMappingSchema.index({ tenantId: 1, createdAt: -1 });
reconciliationMappingSchema.index({ tenantId: 1, "transactionIds": 1 });
reconciliationMappingSchema.index({ tenantId: 1, "invoiceIds": 1 });
```

### 4.4 AuditEvent (NEW)
```typescript
// File: backend/src/models/core/AuditEvent.ts
const auditEventSchema = new Schema({
  tenantId: { type: String, required: true },
  entityType: { type: String, required: true },  // "invoice", "payment", "vendor", "export"
  entityId: { type: String, required: true },
  eventType: { type: String, required: true },    // "invoice.approved", "payment.recorded", "tds.calculated", "export.completed"
  actor: {
    userId: { type: String },
    email: { type: String },
    role: { type: String },
    source: { type: String, enum: ["user", "system", "webhook"] }
  },
  data: { type: Schema.Types.Mixed },
  timestamp: { type: Date, required: true, default: () => new Date() }
}, { timestamps: false });

auditEventSchema.index({ tenantId: 1, entityType: 1, entityId: 1, timestamp: -1 });
auditEventSchema.index({ tenantId: 1, eventType: 1, timestamp: -1 });
auditEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 86400 });  // TTL: 1 year
```

### 4.5 Fields to Add to Existing Models

**Invoice** (add to compliance subdocument):
```typescript
paymentStatus: { type: String, enum: ["unpaid", "partially_paid", "fully_paid", "overpaid"], default: "unpaid" }
paidAmountMinor: { type: Number, default: 0 }
gstTreatment: { type: String, enum: ["regular", "reverse_charge", "exempt", "nil_rated", "composition"], default: "regular" }
itcEligible: { type: Boolean, default: true }
```

**VendorMaster** (add):
```typescript
tallyLedgerName: { type: String, default: null }
tallyLedgerGroup: { type: String, default: "Sundry Creditors" }
vendorStatus: { type: String, enum: ["active", "inactive", "blocked"], default: "active" }
```

**ApprovalWorkflow** (add):
```typescript
workflowType: { type: String, enum: ["invoice", "payment"], default: "invoice" }
```

---

## 5. State Machines

### 5.1 Invoice Lifecycle (Existing + Payment Extension)

```
PENDING
  -> PARSED (OCR + SLM extraction successful, compliance enrichment complete including TDS)
  -> FAILED_OCR (OCR failure)
  -> FAILED_PARSE (SLM extraction failure)

PARSED
  -> NEEDS_REVIEW (missing fields or open risk signals)
  -> AWAITING_APPROVAL (workflow initiated)
  -> APPROVED (direct approval, no workflow)

NEEDS_REVIEW
  -> PARSED (fields edited, now complete)
  -> AWAITING_APPROVAL (workflow initiated)
  -> APPROVED (direct approval)
  -> PENDING (retry requested)

AWAITING_APPROVAL
  -> APPROVED (workflow completed)
  -> NEEDS_REVIEW (workflow rejected, or fields edited)

APPROVED
  -> EXPORTED (Tally export successful)
  [NEW] paymentStatus transitions: unpaid -> partially_paid -> fully_paid

EXPORTED
  [terminal for invoice status]
  [payment status can still change]
```

### 5.2 Payment Lifecycle (NEW)

```
draft -> approved -> processed -> [terminal]
draft -> cancelled -> [terminal]
approved -> failed -> draft (retry)
approved -> cancelled -> [terminal]
```

---

## 6. API Contracts for New Endpoints

### 6.1 POST /payments
```typescript
// Request
interface CreatePaymentRequest {
  vendorFingerprint: string;
  paymentDate: string;              // ISO date
  amountMinor: number;
  currency?: string;                // default "INR"
  method: "neft" | "rtgs" | "upi" | "cheque" | "cash" | "other";
  utrNumber?: string;
  chequeNumber?: string;
  bankAccountId?: string;
  allocations: Array<{
    invoiceId: string;
    allocatedMinor: number;
  }>;
  notes?: string;
}

// Response: 201
interface PaymentResponse {
  _id: string;
  paymentNumber: string;
  vendorFingerprint: string;
  amountMinor: number;
  status: string;
  allocations: Array<{
    invoiceId: string;
    allocatedMinor: number;
    tdsDeductedMinor: number;
    tcsCollectedMinor: number;
    netPaidMinor: number;
  }>;
  createdAt: string;
}

// Auth: requireAuth, requireCap("canRecordPayments")
// Validation:
//   - sum of allocations.allocatedMinor must equal amountMinor
//   - each invoiceId must exist and belong to tenant
//   - each invoice must be APPROVED or EXPORTED
//   - allocatedMinor for each invoice must not exceed invoice.compliance.tds.netPayableMinor (or totalAmountMinor if no TDS)
```

### 6.2 POST /reconciliation-mappings
```typescript
// Request
interface CreateReconciliationMappingRequest {
  transactionIds: string[];
  invoiceIds: string[];
  allocations: Array<{
    transactionId: string;
    invoiceId: string;
    allocatedMinor: number;
  }>;
}

// Response: 201
interface ReconciliationMappingResponse {
  _id: string;
  type: "one_to_one" | "split" | "aggregate" | "partial";
  transactionIds: string[];
  invoiceIds: string[];
  allocations: Array<{ transactionId: string; invoiceId: string; allocatedMinor: number }>;
  matchSource: "manual";
}

// Auth: requireAuth, requireCap("canApproveInvoices")
// Validation:
//   - all transactionIds must exist and belong to tenant
//   - all invoiceIds must exist and belong to tenant
//   - type is auto-determined: 1 txn + 1 inv = one_to_one; 1 txn + N inv = split; N txn + 1 inv = aggregate
//   - allocation totals must balance
```

### 6.3 GET /reports/tds-liability
```typescript
// Query params: fy (required), section (optional), vendorFingerprint (optional)
// Response: 200
interface TdsLiabilityReport {
  financialYear: string;
  items: Array<{
    vendorFingerprint: string;
    vendorName: string;
    section: string;
    cumulativeBaseMinor: number;
    cumulativeTdsMinor: number;
    invoiceCount: number;
    thresholdCrossedAt: string | null;
  }>;
  totals: {
    totalBaseMinor: number;
    totalTdsMinor: number;
    totalInvoiceCount: number;
  };
}

// Auth: requireAuth
```

### 6.4 GET /vendors
```typescript
// Query params: page, limit, search, status
// Response: 200
interface VendorListResponse {
  items: Array<{
    vendorFingerprint: string;
    name: string;
    aliases: string[];
    pan: string | null;
    gstin: string | null;
    defaultGlCode: string | null;
    defaultTdsSection: string | null;
    tallyLedgerName: string | null;
    vendorStatus: string;
    invoiceCount: number;
    lastInvoiceDate: string;
    msme: { classification: string | null };
  }>;
  total: number;
  page: number;
  limit: number;
}

// Auth: requireAuth
```

### 6.5 POST /exports/tally/payment-vouchers
```typescript
// Request
interface ExportPaymentVouchersRequest {
  paymentIds: string[];
}

// Response: 200
interface ExportPaymentVouchersResponse {
  batchId: string;
  total: number;
  successCount: number;
  failureCount: number;
  items: Array<{ paymentId: string; success: boolean; error?: string; externalReference?: string }>;
}

// Auth: requireAuth, requireCap("canExportToTally")
```

---

## 7. Reconciliation Algorithm Specification

### Current Algorithm (Unchanged)
Location: `ReconciliationService.reconcileStatement()` at `ReconciliationService.ts:35-91`

1. Fetch all UNMATCHED debit transactions for the statement
2. Batch-fetch candidate invoices (non-EXPORTED, amount within global min/max range +/- tolerance, optionally filtered by GSTIN)
3. For each transaction, score against all candidates:
   - Amount exact match: +50, within tolerance: +30
   - Invoice number found in transaction description: +30
   - Vendor name word overlap: +20
   - Date proximity to invoice/approval/due date: +2 to +10
4. Sort candidates by score descending
5. If best score > autoMatchThreshold (default 50): auto-match
6. If best score >= suggestThreshold (default 30): suggest
7. Otherwise: unmatched

### New Algorithm Extension (Phase 2)

After the existing 1:1 pass completes:

**Split Detection Pass** (one transaction, multiple invoices):
1. For each remaining unmatched transaction with debitMinor > 0:
2. Find all unmatched invoices for the same vendor (by vendor name word overlap in description)
3. Try subset-sum combinations (up to 5 invoices) where sum of netPayableMinor equals transaction debitMinor (+/- tolerance)
4. If a valid combination is found with total score > suggestThreshold, create a SUGGESTED ReconciliationMapping of type "split"

**Aggregate Detection Pass** (multiple transactions, one invoice):
1. For each remaining unmatched invoice:
2. Find unmatched transactions with the same vendor reference pattern in description
3. Check if sum of those transactions' debitMinor equals the invoice netPayableMinor (+/- tolerance)
4. If yes, create a SUGGESTED ReconciliationMapping of type "aggregate"

---

## 8. TDS Cumulative Threshold Algorithm

### Problem Statement
The current `TdsCalculationService.computeTds()` checks `thresholdSingleMinor` (per-invoice threshold) but ignores `thresholdAnnualMinor` (per-vendor annual cumulative threshold). For sections like 194C (annual limit Rs 1,00,000), TDS should only be deducted when cumulative payments to a vendor in a financial year exceed the threshold.

### Algorithm

In `TdsCalculationService.computeTds()`, after the existing `thresholdSingleMinor` check (line 219-239), insert:

```
1. Determine financial year from invoice date:
   - If invoice.invoiceDate.month >= 4: FY = "YYYY-(YY+1)" 
   - Else: FY = "(YYYY-1)-YY"
   
2. If rateLookup.thresholdAnnualMinor > 0:
   a. Query TdsVendorLedger for { tenantId, vendorFingerprint, financialYear, section }
   b. Let cumulative = ledger.cumulativeBaseMinor (or 0 if no record)
   c. Let currentTaxable = determineTaxableAmount(invoice)
   
   d. If cumulative + currentTaxable < thresholdAnnualMinor:
      - Set TDS amount = 0, netPayable = totalAmount
      - Emit TDS_BELOW_ANNUAL_THRESHOLD risk signal (info)
      - Upsert TdsVendorLedger: increment cumulativeBaseMinor, add entry with tdsAmountMinor=0
      - Return early
      
   e. If cumulative < thresholdAnnualMinor AND cumulative + currentTaxable >= thresholdAnnualMinor:
      (Threshold crossed with this invoice)
      - Compute TDS on ENTIRE cumulative: tdsOnCumulative = (cumulative + currentTaxable) * rateBps / 10000
      - Subtract already deducted: alreadyDeducted = ledger.cumulativeTdsMinor
      - This invoice's TDS = tdsOnCumulative - alreadyDeducted
      - Set thresholdCrossedAt = now
      - Emit TDS_ANNUAL_THRESHOLD_CROSSED risk signal (warning)
      
   f. If cumulative >= thresholdAnnualMinor:
      (Already past threshold - normal per-invoice TDS)
      - Proceed with normal calculation (existing logic)
      
   g. Upsert TdsVendorLedger with new entry

3. Continue with existing logic for thresholdSingleMinor check
```

### Backdated Invoice Handling
When an invoice arrives with a date in a prior period:
- The FY is determined from invoice date, not processing date
- If processing a backdated invoice causes cumulative to cross threshold, the catch-up TDS is computed on this invoice
- A risk signal `TDS_BACKDATED_THRESHOLD_ADJUSTMENT` should be emitted to alert the user
- No automatic recomputation of previously processed invoices (this would require a batch job and is Phase 3)

---

## 9. Tally Integration Specification

### 9.1 Current State
- One-way export: LedgerBuddy -> Tally via HTTP POST of XML
- Voucher type: Purchase only
- Config: endpoint URL + company name + ledger names (per tenant)
- No Tally data reading

### 9.2 Tally XML Protocol
Tally uses a proprietary XML format over HTTP. The server listens on a configurable port (default 9000). Key operations:
- **Import Data**: POST with `<TALLYREQUEST>Import</TALLYREQUEST>` (what we do today)
- **Export Data**: POST with `<TALLYREQUEST>Export</TALLYREQUEST>` (what we need for sync)

### 9.3 New: Payment Voucher Export

Add `buildTallyPaymentVoucherPayload()` to `xml.ts`:

```xml
<VOUCHER VCHTYPE="Payment" ACTION="Create" OBJVIEW="Accounting Voucher View">
  <DATE>{YYYYMMDD}</DATE>
  <VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>
  <VOUCHERNUMBER>{paymentNumber}</VOUCHERNUMBER>
  <PARTYLEDGERNAME>{vendorName}</PARTYLEDGERNAME>
  <NARRATION>{narration}</NARRATION>
  <LEDGERENTRIES.LIST>
    <LEDGERNAME>{bankLedgerName}</LEDGERNAME>
    <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
    <AMOUNT>-{paymentAmount}</AMOUNT>
  </LEDGERENTRIES.LIST>
  <LEDGERENTRIES.LIST>
    <LEDGERNAME>{vendorName}</LEDGERNAME>
    <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
    <AMOUNT>{netPayableAmount}</AMOUNT>
  </LEDGERENTRIES.LIST>
  <!-- If TDS was deducted -->
  <LEDGERENTRIES.LIST>
    <LEDGERNAME>{tdsLedgerName}</LEDGERNAME>
    <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
    <AMOUNT>{tdsAmount}</AMOUNT>
  </LEDGERENTRIES.LIST>
</VOUCHER>
```

### 9.4 New: Ledger Sync (Phase 3)

**Fetch Ledgers from Tally:**
```xml
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>List of Ledgers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>{companyName}</SVCURRENTCOMPANY>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No" NAME="List of Ledgers">
            <TYPE>Ledger</TYPE>
            <NATIVEMETHOD>Name</NATIVEMETHOD>
            <NATIVEMETHOD>Parent</NATIVEMETHOD>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>
```

**Auto-Create Vendor Ledger in Tally:**
```xml
<ENVELOPE>
  <HEADER><VERSION>1</VERSION><TALLYREQUEST>Import</TALLYREQUEST><TYPE>Data</TYPE><ID>All Masters</ID></HEADER>
  <BODY>
    <DESC><STATICVARIABLES><SVCURRENTCOMPANY>{companyName}</SVCURRENTCOMPANY></STATICVARIABLES></DESC>
    <DATA>
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <LEDGER NAME="{vendorName}" ACTION="Create">
          <PARENT>Sundry Creditors</PARENT>
          <ISBILLWISEON>Yes</ISBILLWISEON>
        </LEDGER>
      </TALLYMESSAGE>
    </DATA>
  </BODY>
</ENVELOPE>
```

**Offline Handling:**
- If Tally endpoint is unreachable, queue the export request
- Store in `ExportBatch` with status "queued"
- Retry on next export attempt or via manual retry
- Show clear UI indication that Tally is offline

---

## 10. Implementation Phases

### Phase 1: TDS Cumulative Threshold (2-3 weeks)
**Dependency: None. Highest compliance risk.**

1. Create `TdsVendorLedger` model
2. Add `determineFY()` utility
3. Modify `TdsCalculationService.computeTds()` to check annual thresholds
4. Add `TDS_BELOW_ANNUAL_THRESHOLD` and `TDS_ANNUAL_THRESHOLD_CROSSED` risk signal codes
5. Add migration script to backfill `TdsVendorLedger` from existing approved invoices
6. Add `GET /reports/tds-liability` endpoint
7. Unit tests with 100% branch coverage on the threshold logic

**Why first:** This is the most significant compliance gap. Indian businesses are legally required to track cumulative TDS thresholds. Getting this wrong means incorrect TDS deduction certificates and potential penalties.

### Phase 2: Vendor CRUD & Fields (1 week)
**Dependency: None**

1. Add `tallyLedgerName`, `tallyLedgerGroup`, `vendorStatus` fields to `VendorMaster`
2. Create `GET /vendors`, `GET /vendors/:fingerprint`, `PATCH /vendors/:fingerprint` endpoints
3. Modify Tally export to use `tallyLedgerName` when set

### Phase 3: Payment Model & Recording (2-3 weeks)
**Dependency: Phase 2 (vendor fields)**

1. Create `Payment` model
2. Add `paymentStatus`, `paidAmountMinor` fields to Invoice compliance subdocument
3. Create payment CRUD endpoints
4. Implement payment allocation validation (sum check, invoice eligibility)
5. Auto-compute `paymentStatus` on invoices when payments are recorded
6. Add `AuditEvent` model and emit events for payment recording

### Phase 4: Payment Voucher Export (1-2 weeks)
**Dependency: Phase 3 (Payment model)**

1. Add `buildTallyPaymentVoucherPayload()` to `xml.ts`
2. Create `POST /exports/tally/payment-vouchers` endpoint
3. Add `PaymentExporter` that implements `AccountingExporter` interface
4. Wire into `ExportService`

### Phase 5: Reconciliation Split/Aggregate (2-3 weeks)
**Dependency: Phase 3 (Payment model)**

1. Create `ReconciliationMapping` model
2. Add manual split/aggregate mapping endpoints
3. Update `Invoice.compliance.reconciliation` to support multiple transaction IDs
4. Phase 5b: Auto-detection algorithm for split/aggregate patterns

### Phase 6: Tally Ledger Sync (2-3 weeks)
**Dependency: Phase 2 (vendor fields)**

1. Implement Tally export-request XML for fetching ledger list
2. Build `TallyLedgerCache` model (per-tenant cache of Tally ledgers)
3. Add ledger sync endpoint and scheduled sync
4. Pre-export validation (check if party ledger exists)
5. Auto-create missing party ledgers in Tally

### Phase 7: GST Treatment & ITC (1 week)
**Dependency: Phase 1**

1. Add `gstTreatment` and `itcEligible` to invoice compliance
2. Modify SLM extraction prompt to detect reverse charge invoices
3. Modify Tally export to handle RCM entries
4. Add ITC eligibility risk signal

### Phase 8: Reporting (1-2 weeks)
**Dependency: Phases 1, 3, 5**

1. TDS liability report aggregation endpoint
2. Payment aging report
3. Reconciliation summary
4. Vendor payment summary

---

### Demo vs Production Prioritization

**For a demo (Phases 1-2, about 3-4 weeks):**
- TDS cumulative threshold (the headline compliance feature)
- Vendor CRUD (necessary for any Tally mapping story)
- These two alone make LedgerBuddy credibly useful for Indian AP automation

**For MVP production (Phases 1-4, about 7-9 weeks):**
- Add payment recording and payment voucher export
- This covers the full procure-to-pay cycle: invoice in -> compliance check -> approve -> pay -> export to Tally

**For full production (all phases, about 14-18 weeks):**
- Split/aggregate reconciliation, Tally sync, and reporting
- These are differentiation features, not blocking for initial production use

---

### Critical Files for Implementation
- `/Users/abhimanyusingh/IdeaProjects/Invoice Processor/backend/src/services/compliance/TdsCalculationService.ts` - Must be modified for cumulative threshold logic; currently only checks single-transaction threshold
- `/Users/abhimanyusingh/IdeaProjects/Invoice Processor/backend/src/services/export/tallyExporter/xml.ts` - Must add Payment voucher XML builder alongside existing Purchase voucher builder
- `/Users/abhimanyusingh/IdeaProjects/Invoice Processor/backend/src/types/invoice.ts` - Must add paymentStatus, gstTreatment, itcEligible to InvoiceCompliance interface; add new risk signal codes
- `/Users/abhimanyusingh/IdeaProjects/Invoice Processor/backend/src/services/bank/ReconciliationService.ts` - Must be extended for split/aggregate mapping alongside existing 1:1 scoring
- `/Users/abhimanyusingh/IdeaProjects/Invoice Processor/backend/src/models/compliance/VendorMaster.ts` - Must add tallyLedgerName, vendorStatus fields for Tally integration story