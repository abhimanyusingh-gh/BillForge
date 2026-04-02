# Architecture Decisions: India Compliance Intelligence Layer

> Last updated: 2026-03-30

---

## 1. Why These Decisions Matter

The compliance layer sits between extraction and export — it enriches parsed invoice data with TDS calculations, GL codes, PAN validation, and risk signals before the reviewer sees them. Every architectural choice here must preserve two invariants: (1) the reviewer always decides (the system suggests, never auto-books), and (2) the existing extraction pipeline is not disrupted (compliance is additive, not intrusive).

---

## 2. Compliance Pipeline Integration

### 2.1 Pipeline Extension Point

**Decision:** Compliance enrichment runs as a post-extraction stage in `InvoiceExtractionPipeline`, after SLM extraction and deterministic validation, before the invoice is persisted with status `PARSED` or `NEEDS_REVIEW`.

**Why it matters:** Running compliance checks inline means the reviewer sees TDS, GL, PAN, and risk signals immediately — not as a delayed async update. The review panel shows the complete picture on first load.

**How it integrates:**

```
OCR → SLM Extraction → Deterministic Validation → [NEW] Compliance Enrichment → Confidence Scoring → Persist
```

**Compliance enrichment steps (ordered):**
1. PAN extraction and validation (L1 format, L2 GSTIN cross-ref)
2. Vendor master lookup (existing vendor? known PAN? known bank details?)
3. GL code suggestion (vendor history → description match → default)
4. TDS section detection (PAN category + GL code/expense type → section + rate)
5. TDS amount calculation (taxable amount × rate)
6. Risk signal evaluation (bank change, email sender, IRN, MSME deadline)
7. Compliance confidence scoring (feeds into overall invoice confidence)

**What would change this:** If compliance checks become expensive (> 500ms per invoice due to external API calls in Phase 2), they should move to an async post-processing queue. Phase 1 checks are all local/deterministic and add < 50ms.

**Error handling:** Compliance enrichment failures are non-fatal. If any compliance sub-service throws, the error is logged to `processingIssues`, the invoice is persisted with partial or empty `compliance` data, and extraction continues. The invoice is still reviewable — the reviewer just won't see compliance suggestions. This prevents a TDS rate table misconfiguration from blocking all invoice processing.

**Vendor fingerprint access:** The vendor fingerprint is available from `metadata.vendorFingerprint` (set during pipeline extraction). It is passed to the compliance enrichment service alongside `tenantId`.

### 2.2 Compliance as Separate Service Module

**Decision:** All compliance logic lives in `backend/src/services/compliance/` as a set of focused service modules. The pipeline calls a single `ComplianceEnrichmentService.enrich(invoice, tenantConfig)` method.

**Why it matters:** Compliance rules change with Indian tax law (annually, sometimes quarterly). Isolating the compliance logic from the extraction pipeline means tax rate updates, new TDS sections, and new risk signals are localized changes — they don't touch the OCR, SLM, or export code.

**Module structure:**
```
backend/src/services/compliance/
├── ComplianceEnrichmentService.ts    (orchestrator — calls all below)
├── TdsCalculationService.ts          (section detection, rate lookup, calculation)
├── PanValidationService.ts           (format, GSTIN cross-ref, future: API)
├── GlCodeSuggestionService.ts        (vendor history, description match)
├── RiskSignalEvaluator.ts            (all risk signal checks, replaces inline checks in confidenceAssessment.ts)
├── VendorMasterService.ts            (vendor PAN, bank, MSME, GL history)
├── IrnValidationService.ts           (Phase 2)
├── MsmeTrackingService.ts            (Phase 2)
└── CostCenterService.ts              (Phase 3)
```

**Interface boundary:** `ComplianceEnrichmentService` implements a `ComplianceEnricher` interface. This allows a `NoOpComplianceEnricher` for tenants that haven't configured compliance features, and keeps the pipeline code clean.

```typescript
interface ComplianceEnricher {
  enrich(invoice: ParsedInvoiceData, tenantId: string, vendorFingerprint: string): Promise<ComplianceResult>
}
```

The service looks up `TenantComplianceConfig` and `VendorMaster` internally from `tenantId` and `vendorFingerprint`. This matches the existing pattern where services receive IDs and handle their own lookups.

---

## 3. Data Model Extensions

### 3.1 Invoice Model Extensions

**Decision:** Add compliance fields to the existing Invoice model as an embedded `compliance` subdocument. Do not create a separate collection.

**Why it matters:** Compliance data is always read with the invoice (it appears in the review panel). A separate collection means a join on every invoice read. An embedded document means one read, one write, one index scan.

**Schema addition:**
```typescript
compliance: {
  pan: {
    value: string | null
    source: "extracted" | "vendor-master" | "manual"
    validationLevel: "L1" | "L2" | "L3" | null
    validationResult: "valid" | "format-invalid" | "gstin-mismatch" | "struck-off" | null
    gstinCrossRef: boolean
  }
  tds: {
    section: string | null           // "194C", "194J", etc.
    rate: number | null              // basis points (e.g., 200 = 2%)
    amountMinor: number | null       // TDS amount in minor units
    netPayableMinor: number | null   // total - TDS in minor units
    source: "auto" | "manual"
    confidence: "high" | "medium" | "low"
  }
  glCode: {
    code: string | null
    name: string | null
    source: "vendor-default" | "description-match" | "category-default" | "manual"
    confidence: number | null        // 0-100
    suggestedAlternatives: Array<{ code: string, name: string, score: number }>
  }
  costCenter: {
    code: string | null
    name: string | null
    source: "vendor-default" | "gl-linked" | "manual"
    confidence: number | null
  }
  irn: {
    value: string | null
    valid: boolean | null
  }
  msme: {
    udyamNumber: string | null
    classification: "micro" | "small" | "medium" | null
    paymentDeadline: Date | null     // invoice date + 45 days
  }
  vendorBank: {
    accountHash: string | null       // SHA-256 of account number
    ifsc: string | null
    bankName: string | null
    isChanged: boolean               // true if different from vendor history
    verifiedChange: boolean          // true if reviewer confirmed the change
  }
  riskSignals: Array<{
    code: string                     // e.g., "PAN_GSTIN_MISMATCH"
    category: "financial" | "compliance" | "fraud" | "data-quality"
    severity: "info" | "warning" | "critical"
    message: string                  // human-readable explanation
    confidencePenalty: number         // points deducted from confidence score
    status: "open" | "dismissed" | "acted-on"  // reviewer resolution
    resolvedBy: string | null        // userId who resolved
    resolvedAt: Date | null          // resolution timestamp
  }>
}
```

**Migration:** New invoices get `compliance: {}` on creation. Existing invoices remain unchanged — the field is optional. No backfill migration needed.

**`riskFlags` / `riskMessages` deprecation:** The Invoice model already has `riskFlags: Array<string>` and `riskMessages: Array<string>` for the two existing risk signals (`TOTAL_AMOUNT_ABOVE_EXPECTED`, `DUE_DATE_TOO_FAR`). These are superseded by `compliance.riskSignals`. Migration path: new invoices populate `compliance.riskSignals` only. Existing invoices keep old fields. Frontend reads `compliance.riskSignals` when present, falls back to `riskFlags`/`riskMessages` for pre-compliance invoices. Old fields are not removed (backward compatibility) but are no longer written to.

### 3.2 TDS Rate Table

**Decision:** Store TDS rates in a `TdsRateTable` collection (not hardcoded). Seed with current rates. Admin can update when rates change.

**Why it matters:** TDS rates change with the annual Finance Act. Hardcoded rates become stale. A configurable table means the first adopter's CA can update rates without a code deployment.

**Schema:**
```typescript
{
  section: string              // "194C"
  description: string          // "Payment to Contractors"
  rateCompanyBps: number       // 200 (2% in basis points)
  rateIndividualBps: number    // 100 (1%)
  rateNoPanBps: number         // 2000 (20% — no PAN penalty rate)
  thresholdSingleMinor: number // 3000000 (₹30,000)
  thresholdAnnualMinor: number // 10000000 (₹1,00,000)
  effectiveFrom: Date
  effectiveTo: Date | null     // null = currently active
  isActive: boolean
}
```

**Seeded data:** Current FY2025-26 rates for sections 194C, 194J, 194H, 194I(a), 194I(b), 194Q. Platform admin can add/modify. Tenant admin cannot (rates are statutory, not tenant-specific).

### 3.3 GL Code Master

**Decision:** Tenant-scoped `GlCodeMaster` collection. Each tenant uploads their own chart of accounts.

**Why it matters:** Every accounting firm has a different chart of accounts. There is no universal GL code list. The tenant admin must be able to configure their own.

**Schema:**
```typescript
{
  tenantId: ObjectId
  code: string                // "5010"
  name: string                // "Office Supplies"
  category: string            // "Indirect Expenses"
  linkedTdsSection: string | null  // "194C" — auto-links GL to TDS
  parentCode: string | null   // hierarchical chart of accounts
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}
```

**Unique index:** `{ tenantId, code }` — each GL code unique per tenant.

### 3.4 Vendor Master

**Decision:** Create a `VendorMaster` collection that consolidates vendor data across invoices. Currently vendor data is scattered (vendor fingerprint templates, extraction learning by vendor, GL mapping by vendor). The vendor master becomes the single source of vendor intelligence.

**Why it matters:** TDS, GL, bank change detection, and MSME tracking all need a per-vendor view. Without a vendor master, each feature would maintain its own vendor index — duplicated logic, inconsistent data.

**Schema:**
```typescript
{
  tenantId: ObjectId
  vendorFingerprint: string        // SHA-256 layout fingerprint (links to existing templates)
  name: string                     // canonical vendor name
  aliases: string[]                // alternate names seen on invoices
  pan: string | null               // last validated PAN
  gstin: string | null             // last seen GSTIN
  panCategory: "C" | "P" | "H" | "F" | "T" | "A" | "B" | "L" | "J" | "G" | null
  defaultGlCode: string | null
  defaultCostCenter: string | null
  defaultTdsSection: string | null
  bankHistory: Array<{
    accountHash: string            // SHA-256
    ifsc: string
    bankName: string
    firstSeen: Date
    lastSeen: Date
    invoiceCount: number
  }>
  msme: {
    udyamNumber: string | null
    classification: "micro" | "small" | "medium" | null
    verifiedAt: Date | null
  }
  emailDomains: string[]           // known sender domains
  invoiceCount: number
  lastInvoiceDate: Date
  createdAt: Date
  updatedAt: Date
}
```

**Population strategy:** The vendor master is populated lazily — when an invoice is processed and persisted, the compliance enrichment step upserts the vendor master with any new data (PAN, GSTIN, bank details, email domain). No bulk import required (though an admin upload endpoint is available for pre-seeding).

**Relationship to existing VendorTemplateStore:** The vendor template store (`vendorTemplateStore.ts`) handles layout fingerprinting for extraction. The vendor master handles compliance data. They share the `vendorFingerprint` key. The template store is not replaced — it continues to handle extraction-specific template matching. The vendor master adds compliance context on top.

### 3.6 Tenant Compliance Config

**Decision:** Per-tenant compliance configuration stored in a `TenantComplianceConfig` collection. Controls which compliance features are active for the tenant.

**Why it matters:** Not all tenants need TDS calculation or MSME tracking. A tenant processing only international invoices doesn't need India-specific compliance. The config allows progressive enablement — start with GL codes only, add TDS later.

**Schema:**
```typescript
{
  tenantId: ObjectId               // unique index
  complianceEnabled: boolean       // master toggle, default false
  autoSuggestGlCodes: boolean      // default true when enabled
  autoDetectTds: boolean           // default true when enabled
  enabledSignals: string[]         // risk signal codes to evaluate (empty = all)
  disabledSignals: string[]        // risk signal codes to suppress
  signalSeverityOverrides: Map<string, "info" | "warning" | "critical">
  defaultTdsSection: string | null // tenant-wide fallback TDS section
  createdAt: Date
  updatedAt: Date
}
```

**Default behavior:** When `complianceEnabled` is false, the `NoOpComplianceEnricher` is used — zero compliance overhead. When true, all sub-services run unless individually disabled.

---

### 3.7 Cost Center Master (Phase 3)

**Schema:**
```typescript
{
  tenantId: ObjectId
  code: string
  name: string
  department: string | null
  linkedGlCodes: string[]        // GL codes that default to this cost center
  isActive: boolean
}
```

---

## 4. TDS Calculation Architecture

### 4.1 Section Detection Logic

**Decision:** TDS section is determined by a two-factor lookup: GL code category (or expense description if no GL code) × PAN entity type. The lookup uses a configurable mapping table, not hardcoded if-else chains.

**Why it matters:** The mapping between expense types and TDS sections is not always 1:1. "Professional services" could be 194J or 194JB depending on the entity type. A mapping table makes the logic transparent and auditable — the CA can review and adjust the mappings.

**Mapping table (seeded, tenant-customizable):**
```typescript
{
  tenantId: ObjectId | null    // null = system default, non-null = tenant override
  glCategory: string           // "Professional Services"
  panCategory: string          // "C" (company), "P" (individual), "*" (any)
  tdsSection: string           // "194J"
  priority: number             // higher wins when multiple rules match
}
```

**Fallback chain:**
1. Tenant-specific mapping (tenantId + glCategory + panCategory)
2. Tenant-specific mapping (tenantId + glCategory + "*")
3. System default mapping (null + glCategory + panCategory)
4. System default mapping (null + glCategory + "*")
5. No suggestion (TDS section = null, confidence = "low")

### 4.2 Rate Application

**Decision:** TDS rates stored in basis points (1% = 100 bps). Calculation uses integer arithmetic throughout to maintain the minor-units invariant.

**Calculation:**
```
tdsAmountMinor = Math.round(taxableAmountMinor * rateBps / 10000)
netPayableMinor = totalAmountMinor - tdsAmountMinor
```

**Taxable amount:** For GST invoices, TDS is calculated on the pre-GST subtotal (`subtotalMinor`), not the total. If subtotal is not available, fall back to total. This is a common source of TDS errors in manual processes.

### 4.3 No-PAN Penalty Rate

**Decision:** If PAN is missing or invalid, TDS rate defaults to 20% (Section 206AA). This is surfaced as a critical risk signal, not silently applied.

**Why it matters:** 20% TDS on a large invoice is a significant financial impact. The reviewer must be made aware that the higher rate is being applied because of missing PAN, so they can request PAN from the vendor before approving.

---

## 5. GL Code Suggestion Architecture

### 5.1 Frequency-Based Model

**Decision:** GL code suggestions use a simple frequency count, not ML classification. The vendor's most-used GL code is suggested. Recency bias: the last 5 assignments are weighted 2x.

**Why it matters:** ML classification requires labeled training data that doesn't exist yet. Frequency-based suggestion works on day one — the first invoice from a vendor gets no suggestion, the second gets a suggestion based on the first. After 10 invoices, the suggestion is reliable. This is the minimum viable approach that delivers value immediately.

**Algorithm:**
```
For vendor V in tenant T:
  1. Fetch all VendorGlMapping records for (T, V.fingerprint)
  2. Score = usageCount + (2 × recentUsageCount)  // recent = last 5
  3. Sort by score descending
  4. Top result = suggestion, score/totalInvoices = confidence
  5. If confidence < 60%, also show top 3 alternatives
```

### 5.2 Description-Based Fallback

**Decision:** If no vendor history exists, attempt keyword matching on available text against GL code names and categories. Simple token matching, not LLM.

**Text sources (in order):** `parsed.notes` (joined), `parsed.vendorName`, and `ocrText` (first 500 characters). `ParsedInvoiceData` has no `description` field — these three sources provide sufficient keywords for matching.

**Why it matters:** New vendors have no history. Without a fallback, every first invoice from a new vendor gets no GL suggestion. Keyword matching on "professional services" → GL "Professional Fees" is better than nothing.

**Constraint:** Description-based matches always show confidence < 70% to signal that this is a guess, not a learned pattern.

### 5.3 GL-TDS Linkage

**Decision:** GL codes can be linked to TDS sections in the GL code master (`linkedTdsSection`). When a GL code is confirmed, the linked TDS section is auto-suggested.

**Why it matters:** In practice, GL code and TDS section are correlated. "Professional Fees" (GL 5020) almost always means 194J. Linking them reduces the reviewer's decision points from two (pick GL, then pick TDS section) to one (pick GL, TDS follows).

---

## 6. Risk Signal Architecture

### 6.1 Unified Risk Signal Model

**Decision:** Replace the current inline risk flag checks in `confidenceAssessment.ts` with a `RiskSignalEvaluator` that runs all checks and returns a typed array of signals.

**Why it matters:** The current implementation has two risk signals hardcoded in the confidence scoring function. Adding 13+ more signals in the same function would make it unmaintainable. The evaluator pattern separates signal detection from confidence scoring.

**Interface:**
```typescript
interface RiskSignal {
  code: string
  category: "financial" | "compliance" | "fraud" | "data-quality"
  severity: "info" | "warning" | "critical"
  message: string
  confidencePenalty: number
}

interface RiskSignalEvaluator {
  evaluate(invoice: ParsedInvoiceData, vendorMaster: VendorMasterDoc | null, tenantConfig: TenantComplianceConfig): RiskSignal[]
}
```

**Confidence integration:** The existing `assessConfidence()` function receives the risk signals array and sums their penalties. This replaces the current inline `TOTAL_AMOUNT_ABOVE_EXPECTED` and `DUE_DATE_TOO_FAR` checks — those become signals in the evaluator.

### 6.2 Signal Severity and Penalties

**Decision:** Three severity levels with default confidence penalties:

| Severity | Default Penalty | Reviewer Experience |
|----------|----------------|-------------------|
| `info` | 0 points | Blue indicator — informational, no action required |
| `warning` | 4 points | Yellow indicator — worth checking |
| `critical` | 10 points | Red indicator — must be reviewed before approval |

**Why it matters:** Not all risk signals are equal. A first-time sender (info) shouldn't block approval. A vendor bank change (critical) should force the reviewer to pause and verify.

**Constraint:** Total penalty from risk signals capped at 30 points. Without the cap, an invoice with many minor warnings could drop to red confidence and create alert fatigue.

### 6.3 Per-Tenant Signal Configuration (Phase 2)

**Decision:** Tenants can enable/disable specific risk signals and adjust severity. Stored in `TenantComplianceConfig`.

**Why it matters:** A CA firm that doesn't handle MSME vendors doesn't need MSME signals. A firm that processes only from known vendors doesn't need first-time sender warnings. Configurability prevents alert fatigue.

---

## 7. Vendor Master Architecture

### 7.1 Lazy Population

**Decision:** The vendor master is populated during compliance enrichment, not as a separate ingestion step. Each invoice upsert updates the vendor master atomically.

**Why it matters:** No separate vendor onboarding step for the tenant admin. The vendor master builds itself as invoices flow through the system. After 30 days, the vendor master reflects the actual vendor landscape — not a stale CSV import.

### 7.2 Vendor Matching

**Decision:** Vendor matching uses the existing vendor fingerprint (layout-based SHA-256). Name-based fuzzy matching is not added in Phase 1.

**Why it matters:** Layout fingerprinting is deterministic and already proven in the extraction pipeline. Name-based matching introduces false positives ("Sharma Associates" vs "Sharma & Associates" — same vendor? Maybe. Different invoice layouts? Definitely different fingerprints). Adding fuzzy name matching is a Phase 3 enhancement if fingerprint-only proves too strict.

**Constraint:** If a vendor changes their invoice layout, they appear as a new vendor in the master. The reviewer can manually link vendors (Phase 3 feature). Until then, the system treats each layout as a distinct vendor.

### 7.3 Bank Change Detection

**Decision:** Bank details are stored as a history array on the vendor master. Each entry is timestamped with first-seen and last-seen dates. A "change" is detected when the current invoice's bank hash doesn't match the most recent entry.

**Why it matters:** A vendor may have multiple legitimate bank accounts (different branches, different currencies). Storing history rather than a single "expected" value lets the system distinguish "this vendor has used this account before" from "this is a completely new account."

**Detection logic:**
```
If vendor has bank history:
  If current bank hash matches ANY history entry → no flag
  If current bank hash matches NO history entry → VENDOR_BANK_CHANGED (critical)
If vendor has no bank history:
  Store current bank details → no flag (first invoice baseline)
```

---

## 8. Tally Export Extensions

### 8.1 TDS Ledger Entries

**Decision:** When TDS data exists on an invoice, the Tally export XML includes a TDS ledger entry as a negative amount (credit to TDS payable).

**Export structure:**
```xml
<VOUCHER>
  <!-- Existing: vendor party ledger (debit) -->
  <LEDGERENTRIES.LIST>
    <LEDGERNAME>Vendor Name</LEDGERNAME>
    <AMOUNT>-{netPayableMinor / 100}</AMOUNT>  <!-- net of TDS -->
  </LEDGERENTRIES.LIST>

  <!-- Existing: purchase/expense ledger (credit) -->
  <LEDGERENTRIES.LIST>
    <LEDGERNAME>{glCodeName or purchaseLedger}</LEDGERNAME>
    <AMOUNT>{subtotalMinor / 100}</AMOUNT>
  </LEDGERENTRIES.LIST>

  <!-- Existing: GST ledger entries -->
  <!-- ... CGST, SGST, IGST, Cess ... -->

  <!-- NEW: TDS ledger entry -->
  <LEDGERENTRIES.LIST>
    <LEDGERNAME>{TALLY_TDS_LEDGER} - {tdsSection}</LEDGERNAME>
    <AMOUNT>-{tdsAmountMinor / 100}</AMOUNT>
  </LEDGERENTRIES.LIST>
</VOUCHER>
```

**Configuration:** `TALLY_TDS_LEDGER` env var (default: "TDS Payable"). Section suffix is appended (e.g., "TDS Payable - 194C") to enable section-wise TDS reconciliation in Tally.

### 8.2 GL Code in Export

**Decision:** If GL code is confirmed on the invoice, use it as the purchase/expense ledger name in the Tally export instead of the generic `purchaseLedger` config.

**Why it matters:** Currently, all invoices export with the same purchase ledger name. With GL codes, each invoice maps to the correct expense head in Tally — "Professional Fees", "Office Supplies", "Rent" — without manual re-mapping after import.

---

## 9. API Extensions

### 9.1 New Endpoints

| Method | Path | Description | Role |
|--------|------|-------------|------|
| GET | `/api/compliance/tds-rates` | List active TDS rate table | Any |
| PUT | `/api/compliance/tds-rates/:section` | Update TDS rate | PLATFORM_ADMIN |
| GET | `/api/admin/gl-codes` | List tenant GL code master | TENANT_ADMIN, MEMBER |
| POST | `/api/admin/gl-codes` | Create GL code | TENANT_ADMIN |
| PUT | `/api/admin/gl-codes/:code` | Update GL code | TENANT_ADMIN |
| DELETE | `/api/admin/gl-codes/:code` | Deactivate GL code | TENANT_ADMIN |
| POST | `/api/admin/gl-codes/import` | Bulk import GL codes (CSV) | TENANT_ADMIN |
| GET | `/api/admin/cost-centers` | List cost center master | TENANT_ADMIN, MEMBER |
| POST | `/api/admin/cost-centers` | Create cost center | TENANT_ADMIN |
| GET | `/api/vendors` | List vendor master entries | TENANT_ADMIN, MEMBER |
| GET | `/api/vendors/:id` | Vendor detail (history, bank, PAN) | TENANT_ADMIN |
| PATCH | `/api/vendors/:id/link` | Manually link two vendor records | TENANT_ADMIN |
| PATCH | `/api/invoices/:id` (extended) | Override compliance fields (TDS, GL, cost center) + dismiss risk signals | MEMBER, TENANT_ADMIN |
| GET | `/api/analytics/compliance` | Compliance dashboard data | TENANT_ADMIN |

### 9.2 Compliance Data in List vs Detail Responses

**Decision:** The `GET /api/invoices` list endpoint returns a compliance summary per invoice to avoid response bloat. The full compliance subdocument is returned only on `GET /api/invoices/:id`.

**List response (per invoice):**
```typescript
complianceSummary: {
  tdsSection: string | null
  glCode: string | null
  riskSignalCount: number
  riskSignalMaxSeverity: "info" | "warning" | "critical" | null
}
```

**Detail response:** Full `compliance` subdocument as defined in §3.1.

**Why it matters:** A list page showing 20 invoices with full compliance data (including `suggestedAlternatives`, `riskSignals` with messages, bank history) would add ~2KB per invoice. The summary keeps the list response lean while giving the table enough data to show TDS/GL columns and risk signal count badges.

### 9.3 Invoice PATCH Extension

**Decision:** The existing `PATCH /api/invoices/:id` endpoint is extended to accept compliance field overrides. Overrides update both the invoice and the vendor master (for learning).

**Fields:**
- `tdsSection` — override auto-detected TDS section
- `glCode` — override suggested GL code
- `costCenter` — override suggested cost center
- `vendorBankVerified` — mark bank change as verified

**Learning effect:** When a reviewer overrides a GL code, the `VendorGlMapping` is updated (increment usage count for the new code). When a reviewer overrides a TDS section, the vendor master's `defaultTdsSection` is updated. This creates the same learning feedback loop as extraction corrections.

---

## 10. Frontend Extensions

### 10.1 Compliance Panel in Invoice Detail

**Decision:** Add a "Compliance" section to the invoice detail panel, below the existing extracted fields. Shows TDS, GL code, PAN validation, and risk signals.

**Layout:**
```
┌─────────────────────────────────────┐
│ Extracted Fields (existing)          │
│  Vendor, Invoice#, Date, Total...   │
├─────────────────────────────────────┤
│ Compliance (new)                     │
│  TDS: 194C @ 2% = ₹2,360           │
│  GL: Office Supplies (5010) [✓][▾]  │
│  PAN: ABCDE1234F ✓ (matches GSTIN)  │
│  Net Payable: ₹1,15,640            │
├─────────────────────────────────────┤
│ Risk Signals (new)                   │
│  ⚠ Vendor bank account changed      │
│  ℹ First invoice from this sender   │
└─────────────────────────────────────┘
```

**Interaction:** TDS section and GL code are editable dropdowns. PAN and risk signals are read-only displays. Override triggers PATCH to backend + learning update.

### 10.2 GL Code Configuration Tab

**Decision:** Add a "Chart of Accounts" section to `TenantConfigTab` where the tenant admin can manage GL codes. Supports manual entry and CSV import.

### 10.3 Compliance Dashboard (Phase 2)

**Decision:** Add a "Compliance" tab to the overview dashboard showing TDS summary, GL distribution, risk signal frequency, and vendor compliance health.

---

## 11. Testing Strategy

### 11.1 Coverage Requirements

| Module | Coverage | Rationale |
|--------|----------|-----------|
| `TdsCalculationService.ts` | 100% branch | Financial calculation — errors cause direct monetary harm |
| `PanValidationService.ts` | 100% branch | Compliance validation — false positives block invoices |
| `GlCodeSuggestionService.ts` | 100% branch | Suggestion accuracy — wrong suggestions erode trust |
| `RiskSignalEvaluator.ts` | 100% branch | Risk detection — missed signals are security/fraud gaps |
| `tallyExporter.ts` (extended) | 100% branch | Export accuracy — maintains existing enforcement |

### 11.2 E2E Test Extensions

- `tenantLifecycle.e2e.test.ts` extended: GL code configuration → invoice with GL suggestion → Tally export with GL code
- `compliancePipeline.e2e.test.ts` (new): Invoice with PAN → TDS calculation → risk signals → export with TDS entry
- Deterministic test invoices with known PAN, GSTIN, TDS-applicable services

---

## 12. Consequences

**Positive:**
- Compliance checks run inline — no async delay, reviewer sees full picture immediately
- Vendor master consolidates scattered vendor data into a single queryable collection
- TDS rate table is configurable — no code deployment for annual rate changes
- Risk signal framework is extensible — adding a new signal is a function, not a pipeline change
- GL suggestion uses existing learning pattern — corrections improve future suggestions

**Tradeoffs:**
- Compliance enrichment adds processing time per invoice (< 50ms Phase 1, potentially > 500ms Phase 2 with external APIs)
- Vendor master lazy population means incomplete data for the first 30 days
- Frequency-based GL suggestion is simple but won't handle nuanced categorization (same vendor, different service types)
- TDS section detection depends on GL code accuracy — cascading errors possible

**Risks to monitor:**
- TDS calculation accuracy — wrong TDS rate is worse than no suggestion (financial harm)
- Risk signal alert fatigue — if > 30% of signals are dismissed, thresholds need recalibration
- Vendor master data quality — garbage in (bad extraction) means garbage out (wrong compliance suggestions)
- Phase 2 external API latency — government APIs may not meet SLA for inline processing

---

## 13. RFC Index Additions

| RFC | Status | Summary |
|-----|--------|---------|
| RFC-30 | New | Compliance Pipeline Extension Point — post-extraction, pre-persist enrichment stage |
| RFC-31 | New | TDS Calculation Architecture — section detection, rate lookup, basis-point arithmetic |
| RFC-32 | New | GL Code Suggestion — frequency-based with vendor learning, description fallback |
| RFC-33 | New | Vendor Master — consolidated vendor intelligence collection with lazy population |
| RFC-34 | New | Risk Signal Framework — unified evaluator replacing inline checks, 15+ signals |
| RFC-35 | New | Tally Export Extensions — TDS ledger entries, GL-code-as-expense-ledger |
| RFC-36 | Planned (Phase 2) | External Validation APIs — PAN L3, IRN verification, MSME Udyam lookup |
| RFC-37 | Planned (Phase 3) | Multi-ERP Export — Generic CSV, Zoho Books, SAP IDoc adapters |
