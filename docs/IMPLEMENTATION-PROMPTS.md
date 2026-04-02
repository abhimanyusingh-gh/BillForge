# Implementation Prompts: India Compliance Intelligence Layer

> Last updated: 2026-03-30
>
> Each prompt below is a self-contained instruction set for one implementation unit.
> Execute sequentially within each phase. Prompts within the same step can run in parallel where noted.
>
> **Convention:** Each prompt references the PRD section, RFC section, and specific files to create or modify.
> Read PRD-INDIA-COMPLIANCE.md and RFC-INDIA-COMPLIANCE.md before starting any prompt.

---

## Phase 1: India Compliance Core (m21)

---

### Prompt 1.1 — Data Models: Vendor Master, GL Code Master, TDS Rate Table

**Goal:** Create the MongoDB models and seed data for the three new collections that all compliance features depend on.

**References:** RFC §3.2 (TDS Rate Table), RFC §3.3 (GL Code Master), RFC §3.4 (Vendor Master)

**Tasks:**

1. Create `backend/src/models/VendorMaster.ts`:
   - Schema as specified in RFC §3.4
   - `bankHistory` is an array of embedded documents with `accountHash`, `ifsc`, `bankName`, `firstSeen`, `lastSeen`, `invoiceCount`
   - `emailDomains` is a string array
   - Unique index on `{ tenantId, vendorFingerprint }`
   - Index on `{ tenantId, pan }` (sparse — PAN may be null)
   - Index on `{ tenantId, name }` (text search)

2. Create `backend/src/models/GlCodeMaster.ts`:
   - Schema as specified in RFC §3.3
   - `linkedTdsSection` is optional string
   - `parentCode` is optional string for hierarchical chart of accounts
   - Unique index on `{ tenantId, code }`
   - Index on `{ tenantId, category }`
   - Default `isActive: true`

3. Create `backend/src/models/TdsRateTable.ts`:
   - Schema as specified in RFC §3.2
   - All rates in basis points (number)
   - All thresholds in minor units (number)
   - `effectiveTo: null` means currently active
   - Unique index on `{ section, effectiveFrom }`

4. Create `backend/src/models/VendorGlMapping.ts`:
   - Fields: `tenantId`, `vendorFingerprint`, `glCode`, `glCodeName`, `usageCount`, `recentUsages` (array of last 5 dates), `lastUsedAt`
   - Unique index on `{ tenantId, vendorFingerprint, glCode }`

5. Create `backend/src/models/TdsSectionMapping.ts`:
   - Fields: `tenantId` (nullable for system defaults), `glCategory`, `panCategory`, `tdsSection`, `priority`
   - Index on `{ tenantId, glCategory, panCategory }`

6. Create seed script `backend/src/seeds/seedTdsRates.ts`:
   - Seed FY2025-26 TDS rates for sections: 194C, 194J, 194H, 194I(a), 194I(b), 194Q
   - Include rates for company, individual, and no-PAN scenarios
   - Include threshold amounts (single transaction and annual cumulative)
   - Seed default TDS section mappings (system-level, tenantId: null):
     - "Professional Services" + any PAN → 194J
     - "Contractor Services" + Company → 194C (2%)
     - "Contractor Services" + Individual → 194C (1%)
     - "Rent - Building" + any PAN → 194I(b)
     - "Rent - Machinery" + any PAN → 194I(a)
     - "Commission" + any PAN → 194H
   - Make idempotent (upsert by section + effectiveFrom)

7. Create `backend/src/models/TenantComplianceConfig.ts`:
   - Fields: `tenantId` (unique index), `complianceEnabled` (boolean, default false), `autoSuggestGlCodes` (boolean, default true), `autoDetectTds` (boolean, default true), `enabledSignals` (string[]), `disabledSignals` (string[]), `signalSeverityOverrides` (Map<string, string>), `defaultTdsSection` (optional string)
   - When `complianceEnabled` is false, `NoOpComplianceEnricher` is used — zero overhead

8. Extend the Invoice model (`backend/src/models/Invoice.ts`):
   - Add optional `compliance` subdocument matching RFC §3.1 schema
   - Include `riskSignals` items with `status`, `resolvedBy`, `resolvedAt` fields for resolution tracking
   - Do NOT make it required — existing invoices must remain valid
   - Add TypeScript interface `InvoiceCompliance` to `backend/src/types/invoice.ts`

9. Wire `seedTdsRates()` into the existing `seedLocalDemoData()` function so TDS rates are seeded on `yarn docker:up` alongside demo users and tenants.

**Existing field conflict:** The Invoice model already has `riskFlags: Array<string>` and `riskMessages: Array<string>`. Do NOT remove them (backward compatibility). New invoices will populate `compliance.riskSignals` instead. Frontend should read `compliance.riskSignals` when present, fall back to `riskFlags`/`riskMessages` for older invoices.

**Verification:** All models compile. Seed script runs without error. Existing tests pass unchanged.

**Do not:** Add routes, services, or UI. Models only.

---

### Prompt 1.2 — PAN Extraction: SLM Field Extension

**Goal:** Extend the SLM field extraction to return PAN, GSTIN, and bank details (account number, IFSC) as new structured fields.

**References:** PRD §3.2 (PAN Extraction), RFC §2.1 (Pipeline Extension Point)

**Tasks:**

1. Update the SLM request schema in `backend/src/verifier/HttpFieldVerifier.ts`:
   - Add to the expected response fields: `pan`, `bankAccountNumber`, `bankIfsc`
   - **Note:** `gstin` already exists at `parsed.gst.gstin` — do NOT add a duplicate. Reuse the existing field for PAN cross-reference validation.
   - These are optional string fields (may not be present on all invoices)

2. Update the SLM engine (`invoice-slm/app/engine.py`):
   - Add `pan`, `bankAccountNumber`, `bankIfsc` to the structured output schema (GSTIN is already extracted)
   - Add extraction instructions: PAN format `[A-Z]{5}[0-9]{4}[A-Z]`
   - Bank account: look for "A/C No", "Account Number", "Bank Account" labels
   - IFSC: 11-char alphanumeric starting with 4 letters, `[A-Z]{4}0[A-Z0-9]{6}`

3. Update `backend/src/parser/invoiceParser.ts`:
   - Parse the new fields from SLM response
   - Store in the invoice's parsed data: `pan`, `bankAccountNumber`, `bankIfsc` (GSTIN already parsed via `gst.gstin`)

4. Update the Invoice TypeScript interface (`backend/src/types/invoice.ts`):
   - Add optional fields: `pan`, `bankAccountNumber`, `bankIfsc` to `ParsedInvoiceFields` (`gstin` already exists in `GstBreakdown`)

5. Update deterministic validation (`backend/src/services/extraction/deterministicValidation.ts`):
   - Add PAN format validation: `[A-Z]{5}[0-9]{4}[A-Z]` — if extracted PAN doesn't match, add warning `PAN_FORMAT_INVALID`
   - Add GSTIN format validation: 15-char pattern — if extracted GSTIN doesn't match, add warning `GSTIN_FORMAT_INVALID`
   - Add PAN-GSTIN cross-reference: chars 3-12 of GSTIN should equal PAN — if mismatch, add warning `PAN_GSTIN_MISMATCH`

**Verification:** Process a test invoice containing PAN and GSTIN. Verify fields are extracted and stored. Verify cross-reference validation fires correctly on mismatched test data.

**Do not:** Build the compliance enrichment pipeline yet. This prompt only extends extraction.

---

### Prompt 1.3 — Compliance Enrichment Service: Core Framework

**Goal:** Create the compliance enrichment service framework and integrate it into the extraction pipeline.

**References:** RFC §2.1 (Pipeline Extension Point), RFC §2.2 (Separate Service Module)

**Tasks:**

1. Create directory `backend/src/services/compliance/`

2. Create `backend/src/services/compliance/ComplianceEnricher.ts`:
   ```typescript
   interface ComplianceResult {
     pan: InvoiceCompliance["pan"]
     tds: InvoiceCompliance["tds"]
     glCode: InvoiceCompliance["glCode"]
     costCenter: InvoiceCompliance["costCenter"]
     irn: InvoiceCompliance["irn"]
     msme: InvoiceCompliance["msme"]
     vendorBank: InvoiceCompliance["vendorBank"]
     riskSignals: InvoiceCompliance["riskSignals"]
   }

   interface ComplianceEnricher {
     enrich(invoice: ParsedInvoiceData, tenantId: string, vendorFingerprint: string): Promise<ComplianceResult>
   }
   ```

3. Create `backend/src/services/compliance/ComplianceEnrichmentService.ts`:
   - Implements `ComplianceEnricher`
   - Orchestrates all compliance sub-services (PAN, TDS, GL, risk signals, vendor master)
   - Looks up `TenantComplianceConfig` internally by `tenantId` — if `complianceEnabled` is false, delegates to `NoOpComplianceEnricher`
   - Looks up `VendorMaster` by `tenantId` + `vendorFingerprint` (read first, then write after enrichment)
   - Each sub-service is injected via constructor (testable)
   - **Error handling:** Wraps each sub-service call in try/catch. If a sub-service throws, log to `processingIssues` and continue with partial results. Compliance failure must never block invoice persistence.
   - Returns a `ComplianceResult` that the pipeline merges into the invoice document

4. Create `backend/src/services/compliance/NoOpComplianceEnricher.ts`:
   - Returns empty compliance result for tenants that haven't enabled compliance features
   - Or when compliance enrichment is disabled via config

5. Create `backend/src/services/compliance/PanValidationService.ts`:
   - `validate(pan: string | null, gstin: string | null): PanValidationResult`
   - L1: regex format check
   - L2: GSTIN cross-reference (chars 3-12)
   - Returns validation level, result, and any risk signals

6. Create `backend/src/services/compliance/VendorMasterService.ts`:
   - `upsertFromInvoice(tenantId, vendorFingerprint, invoiceData): VendorMasterDoc`
   - Creates or updates vendor master from extracted invoice data
   - Updates bank history, email domains, PAN, GSTIN, invoice count
   - `findByFingerprint(tenantId, vendorFingerprint): VendorMasterDoc | null`
   - `detectBankChange(tenantId, vendorFingerprint, currentBankHash, currentIfsc): boolean`

7. Integrate into `backend/src/services/extraction/InvoiceExtractionPipeline.ts`:
   - Hook point: after `validateInvoiceFields()` returns and BEFORE `assessInvoiceConfidence()` is called (~line 272)
   - Vendor fingerprint is available from `metadata.vendorFingerprint` (set earlier in pipeline)
   - Call `complianceEnricher.enrich(parsedData, tenantId, vendorFingerprint)`
   - Merge `ComplianceResult` into the invoice document's `compliance` field
   - Pass `complianceResult.riskSignals` as a new parameter to `assessInvoiceConfidence()`
   - Modify `assessInvoiceConfidence()` to accept optional `externalRiskSignals: RiskSignal[]` and sum their penalties (replacing the inline `TOTAL_AMOUNT_ABOVE_EXPECTED` / `DUE_DATE_TOO_FAR` checks which move into the evaluator)
   - Store compliance risk signals in `compliance.riskSignals` instead of the old `riskFlags`/`riskMessages` fields

8. Register in dependency injection (`backend/src/core/dependencies.ts`):
   - Instantiate `ComplianceEnrichmentService` with sub-services
   - Pass to pipeline constructor

**Verification:** Pipeline processes an invoice and populates the `compliance` subdocument. PAN validation runs on extracted PAN. Vendor master upserted. Existing tests pass.

**Do not:** Build TDS or GL services yet. Framework + PAN + Vendor Master only.

---

### Prompt 1.4 — TDS Calculation Service

**Goal:** Implement TDS section detection, rate lookup, and amount calculation.

**References:** PRD §3.1 (TDS/TCS Calculation Engine), RFC §4 (TDS Calculation Architecture)

**Tasks:**

1. Create `backend/src/services/compliance/TdsCalculationService.ts`:

   - `detectSection(panCategory, glCategory, tenantId): { section, confidence }`:
     - Query `TdsSectionMapping` with fallback chain (RFC §4.1):
       1. Tenant + glCategory + panCategory
       2. Tenant + glCategory + "*"
       3. System (null) + glCategory + panCategory
       4. System (null) + glCategory + "*"
       5. No match → return null with "low" confidence
     - Return highest-priority match

   - `lookupRate(section, panCategory): { rateBps, thresholdSingleMinor, thresholdAnnualMinor }`:
     - Query `TdsRateTable` where section matches and `effectiveTo` is null (active)
     - Select rate based on PAN category: company → `rateCompanyBps`, individual → `rateIndividualBps`, missing → `rateNoPanBps`
     - If PAN is missing or invalid, use `rateNoPanBps` (20% = 2000 bps per Section 206AA)

   - `calculate(taxableAmountMinor, rateBps): { tdsAmountMinor, netPayableMinor }`:
     - `tdsAmountMinor = Math.round(taxableAmountMinor * rateBps / 10000)`
     - `netPayableMinor = totalAmountMinor - tdsAmountMinor`
     - All integer arithmetic — no floats

   - `determineTaxableAmount(invoice): number`:
     - If `subtotalMinor` exists (pre-GST amount), use it
     - Otherwise fall back to `totalAmountMinor`

   - `getPanCategory(pan: string): string | null`:
     - 4th character of PAN: C=Company, P=Person, H=HUF, F=Firm, T=Trust, etc.
     - If PAN is null or invalid, return null

2. Wire into `ComplianceEnrichmentService.ts`:
   - After PAN validation and GL code suggestion
   - Call TDS detection with PAN category + GL code category
   - Calculate TDS amount
   - Set `compliance.tds` on invoice

3. Add risk signals for TDS edge cases:
   - `TDS_NO_PAN_PENALTY_RATE` (critical): "No valid PAN — TDS at 20% penalty rate applies"
   - `TDS_SECTION_AMBIGUOUS` (warning): "Multiple TDS sections could apply — please verify"
   - `TDS_BELOW_THRESHOLD` (info): "Invoice amount below TDS threshold — no TDS applicable"

4. Write unit tests with 100% branch coverage:
   - Section detection with all fallback levels
   - Rate lookup for company, individual, no-PAN
   - Calculation with known amounts (verify integer arithmetic)
   - PAN category extraction for all 4th-character types
   - Taxable amount determination (subtotal vs total)
   - Edge cases: zero amount, null PAN, missing GL code, no matching section

**Verification:** Given a test invoice with PAN `ABCPK1234F` (individual) and GL category "Professional Services", the service returns section 194J, rate 1000 bps (10%), and correct TDS amount.

---

### Prompt 1.5 — GL Code Suggestion Service

**Goal:** Implement frequency-based GL code suggestion with vendor learning.

**References:** PRD §3.3 (Automatic GL Code Suggestion), RFC §5 (GL Code Suggestion Architecture)

**Tasks:**

1. Create `backend/src/services/compliance/GlCodeSuggestionService.ts`:

   - `suggest(tenantId, vendorFingerprint, parsed: ParsedInvoiceData, ocrText?: string): GlSuggestion`:
     - Step 1: Vendor history lookup
       - Fetch `VendorGlMapping` records for (tenantId, vendorFingerprint)
       - Score: `usageCount + 2 * recentUsageCount` (recent = last 5 usages)
       - If top score / total invoices > 0.6 → high confidence
       - Return top suggestion + up to 3 alternatives
     - Step 2: Description-based fallback (if no vendor history)
       - **Note:** `ParsedInvoiceData` has no `description` field. Use these text sources instead:
         - `parsed.notes` (join array into single string)
         - `parsed.vendorName`
         - `ocrText` (first 500 characters)
       - Tokenize combined text, match tokens against `GlCodeMaster` names and categories (case-insensitive)
       - Score by number of matching tokens
       - Always cap confidence at 70% for description-based matches
     - Step 3: No match → return null with no suggestion

   - `recordUsage(tenantId, vendorFingerprint, glCode, glCodeName): void`:
     - Upsert `VendorGlMapping`: increment `usageCount`, push date to `recentUsages` (keep last 5), update `lastUsedAt`
     - Update vendor master `defaultGlCode` if this is now the most-used code

   - `importFromCsv(tenantId, csvRows: Array<{code, name, category, linkedTdsSection?}>): ImportResult`:
     - Validate: code required, name required, no duplicate codes within batch
     - Upsert into `GlCodeMaster` (by tenantId + code)
     - Return: { created: number, updated: number, errors: Array<{row, reason}> }

2. Wire into `ComplianceEnrichmentService.ts`:
   - After PAN validation, before TDS detection
   - Call GL suggestion → set `compliance.glCode`
   - Pass GL code category to TDS detection for section matching

3. Write unit tests with 100% branch coverage:
   - Vendor with 10 invoices, 8 to GL 5010, 2 to GL 5020 → suggest 5010
   - Vendor with no history, description "professional consulting" → match "Professional Fees"
   - Vendor with no history, no description → no suggestion
   - CSV import with valid rows, duplicate codes, missing required fields
   - Recency bias: last 3 overrides to GL 5020 should shift suggestion

**Verification:** Import a CSV of 10 GL codes for a tenant. Process 5 invoices from the same vendor, manually assigning GL codes. On the 6th invoice, verify the system suggests the most-used code.

---

### Prompt 1.6 — Risk Signal Evaluator: Unified Framework

**Goal:** Replace inline risk flag checks with a unified risk signal evaluator supporting all current and new signals.

**References:** PRD §3.9 (Expanded Risk Signal Framework), RFC §6 (Risk Signal Architecture)

**Tasks:**

1. Create `backend/src/services/compliance/RiskSignalEvaluator.ts`:
   - Implements the `evaluate()` method returning `RiskSignal[]`
   - Organizes checks by category:

   **Financial signals (migrated from existing):**
   - `TOTAL_AMOUNT_ABOVE_EXPECTED` — migrate logic from `confidenceAssessment.ts`
   - `TOTAL_AMOUNT_BELOW_MINIMUM` — new: flag if amount is suspiciously low (< ₹100)

   **Compliance signals (new):**
   - `PAN_FORMAT_INVALID` — from PAN validation result
   - `PAN_GSTIN_MISMATCH` — from PAN validation result
   - `PAN_MISSING` — invoice has GSTIN but no PAN (info)
   - `TDS_NO_PAN_PENALTY_RATE` — from TDS calculation
   - `TDS_SECTION_AMBIGUOUS` — from TDS detection

   **Data quality signals (migrated + new):**
   - `DUE_DATE_TOO_FAR` — migrate from `confidenceAssessment.ts`
   - `INVOICE_DATE_TOO_OLD` — migrate from deterministicValidation if exists
   - `MISSING_MANDATORY_FIELDS` — vendor name or total amount missing

   **Fraud signals (Phase 2 — stub only):**
   - `VENDOR_BANK_CHANGED` — stub, will activate in Phase 2
   - `SENDER_DOMAIN_MISMATCH` — stub
   - `SENDER_FIRST_TIME` — stub
   - `SENDER_FREEMAIL` — stub

2. Update `backend/src/services/confidenceAssessment.ts`:
   - Remove inline `TOTAL_AMOUNT_ABOVE_EXPECTED` and `DUE_DATE_TOO_FAR` checks
   - Accept `riskSignals: RiskSignal[]` as parameter
   - Sum `confidencePenalty` from all signals (cap at 30 total)
   - Existing warning penalty logic (4 points per warning, max 25) remains unchanged

3. Update pipeline to pass risk signals from compliance enrichment to confidence scoring.

4. Write unit tests with 100% branch coverage:
   - Each signal type triggers correctly
   - Penalty cap at 30 works
   - Multiple signals accumulate correctly
   - Existing confidence scoring behavior unchanged for invoices without compliance data

**Verification:** Existing confidence scoring tests pass unchanged. New test with PAN mismatch + high amount triggers both signals and reduces confidence correctly.

---

### Prompt 1.7 — Tally Export: TDS and GL Code Extensions

**Goal:** Extend Tally XML export to include TDS ledger entries and GL-code-based expense ledger mapping.

**References:** PRD §3.4 (Enhanced Tally Export), RFC §8 (Tally Export Extensions)

**Tasks:**

1. Update `backend/src/services/tallyExporter.ts`:
   - Read `compliance.tds` from invoice — if present, add TDS ledger entry to voucher XML
   - TDS ledger entry: `<LEDGERNAME>` = `{TALLY_TDS_LEDGER} - {section}`, `<AMOUNT>` = negative TDS amount
   - Party ledger amount changes from total to `netPayableMinor` (total - TDS)
   - Read `compliance.glCode` from invoice — if present and source is not "manual" with null code:
     - Use GL code name as the purchase/expense ledger name instead of configured `purchaseLedger`
   - Add env vars: `TALLY_TDS_LEDGER` (default: "TDS Payable")
   - Handle edge cases: TDS amount is 0, GL code is null, both TDS and GST entries exist simultaneously

2. Update `backend/src/config/env.ts`:
   - Add `TALLY_TDS_LEDGER` with default "TDS Payable"

3. Extend existing Tally export tests:
   - Invoice with TDS only (no GST) → verify TDS ledger entry and net payable
   - Invoice with TDS + GST → verify both TDS and GST ledger entries, amounts balance
   - Invoice with GL code → verify expense ledger uses GL code name
   - Invoice with GL code + TDS → verify full voucher structure
   - Invoice without compliance data → existing behavior unchanged

4. Maintain 100% branch coverage on `tallyExporter.ts`.

**Verification:** Export a test invoice with TDS 194J @ 10% on ₹1,00,000 subtotal + 18% GST. Verify XML contains:
- Party ledger: ₹1,08,000 (₹1,18,000 total - ₹10,000 TDS)
- Purchase ledger: ₹1,00,000 (subtotal)
- CGST ledger: ₹9,000
- SGST ledger: ₹9,000
- TDS ledger: -₹10,000

---

### Prompt 1.8 — API Routes: GL Codes, TDS Rates, Compliance Override

**Goal:** Create REST endpoints for GL code management, TDS rate viewing, and compliance field overrides.

**References:** RFC §9 (API Extensions)

**Tasks:**

1. Create `backend/src/routes/glCodes.ts`:
   - `GET /api/admin/gl-codes` — list tenant's GL codes (TENANT_ADMIN, MEMBER)
     - Query params: `category` (filter), `search` (text search on name/code), `active` (boolean)
     - Paginated response
   - `POST /api/admin/gl-codes` — create single GL code (TENANT_ADMIN)
     - Validate: code and name required, code unique per tenant
   - `PUT /api/admin/gl-codes/:code` — update GL code (TENANT_ADMIN)
     - Can update name, category, linkedTdsSection, parentCode, isActive
   - `DELETE /api/admin/gl-codes/:code` — soft delete (set isActive: false) (TENANT_ADMIN)
   - `POST /api/admin/gl-codes/import` — bulk CSV import (TENANT_ADMIN)
     - Accept multipart/form-data with CSV file
     - CSV columns: code, name, category, linkedTdsSection (optional)
     - **Dependency:** Add `csv-parse` package to `backend/package.json` (no CSV library currently installed)
     - Return: { created, updated, errors }

2. Create `backend/src/routes/tdsRates.ts`:
   - `GET /api/compliance/tds-rates` — list active TDS rates (any authenticated user)
     - Returns all records where `effectiveTo` is null
   - `PUT /api/compliance/tds-rates/:section` — update rate (PLATFORM_ADMIN only)
     - Sets `effectiveTo` on current record, creates new record with `effectiveFrom: now`
     - Preserves audit trail — never modifies existing rate records

3. Create `backend/src/routes/vendors.ts`:
   - `GET /api/vendors` — list vendor master entries (TENANT_ADMIN, MEMBER)
     - Query params: `search` (name), `hasPan` (boolean), `hasMsme` (boolean)
     - Paginated response
   - `GET /api/vendors/:id` — vendor detail with bank history, PAN, email domains (TENANT_ADMIN)

4. Extend `backend/src/routes/invoices.ts`:
   - Extend `PATCH /api/invoices/:id` to accept compliance overrides (use existing endpoint, NOT a new `/compliance` sub-route):
     - `tdsSection` — overrides auto-detected section, triggers TDS recalculation
     - `glCode` — overrides suggested GL code, updates VendorGlMapping
     - `costCenter` — overrides suggested cost center (Phase 3, accept but no-op for now)
     - `vendorBankVerified` — marks bank change as verified in vendor master
     - `dismissRiskSignal` — sets `status: "dismissed"` on a specific risk signal by code, records `resolvedBy` and `resolvedAt`
   - Each override updates the invoice AND triggers learning (vendor master, GL mapping)
   - Extend `GET /api/invoices` list response to include `complianceSummary` per invoice:
     - `{ tdsSection, glCode, riskSignalCount, riskSignalMaxSeverity }` — lightweight, avoids response bloat
   - Full `compliance` subdocument returned only on `GET /api/invoices/:id`

5. Create `backend/src/routes/tenantComplianceConfig.ts`:
   - `GET /api/admin/compliance-config` — get tenant's compliance config (TENANT_ADMIN)
   - `PUT /api/admin/compliance-config` — update config (TENANT_ADMIN)
   - Creates default config on first access if none exists

6. Register all new routes in `backend/src/app.ts`.

**Verification:** API tests for each endpoint. GL code CRUD lifecycle. TDS rate retrieval. Compliance override on an invoice triggers learning updates.

**Do not:** Build frontend. API only.

---

### Prompt 1.9 — Frontend: Compliance Panel in Invoice Detail

**Goal:** Display compliance data (TDS, GL code, PAN validation, risk signals) in the invoice detail panel with inline editing for TDS section and GL code.

**References:** RFC §10 (Frontend Extensions)

**Tasks:**

1. Create `frontend/src/components/CompliancePanel.tsx`:
   - Renders below existing `ExtractedFieldsTable` in the detail panel
   - Sections:
     - **TDS**: Section badge (e.g., "194C"), rate, calculated amount, net payable. Dropdown to override section.
     - **GL Code**: Suggested code with name and confidence. Dropdown to override (populated from tenant's GL master via API). Shows "based on N prior invoices" or "matched from description".
     - **PAN**: Extracted value with validation status badge (✓ valid, ✗ invalid, ⚠ mismatch). Non-editable.
     - **Net Payable**: Computed from total - TDS. Updates live when TDS section changes.
   - On TDS or GL override: PATCH `/api/invoices/:id` with updated compliance fields. Show optimistic update, revert on error.

2. Create `frontend/src/components/RiskSignalList.tsx`:
   - Renders below CompliancePanel
   - Groups signals by severity: critical first, then warning, then info
   - Each signal: icon (color-coded by severity) + message text
   - Critical signals have a red left border
   - Collapsible — shows count badge when collapsed, expands to full list

3. Update `frontend/src/components/tenantAdmin/TenantInvoicesView.tsx`:
   - Import and render `CompliancePanel` and `RiskSignalList` in detail panel
   - Pass invoice compliance data and tenant GL codes
   - Fetch GL codes on mount (cache in state — they don't change per session)
   - Handle compliance override callbacks

4. Update invoice list table:
   - Add optional columns (user-togglable): "TDS Section", "GL Code", "Risk Signals" (count badge)
   - Risk signal count badge: red if any critical, yellow if warnings only, gray if info only

5. Fetch TDS rates on app load (needed for TDS section dropdown labels).

**Verification:** Open an invoice with compliance data. Verify TDS, GL, PAN, and risk signals render correctly. Override GL code → verify PATCH fires → verify updated data reflects. Override TDS section → verify recalculated amount.

---

### Prompt 1.10 — Frontend: GL Code Configuration in Tenant Config

**Goal:** Add GL code management UI to the tenant admin configuration tab.

**References:** RFC §10.2 (GL Code Configuration Tab)

**Tasks:**

1. Create `frontend/src/components/tenantAdmin/GlCodeManager.tsx`:
   - Table of GL codes: code, name, category, linked TDS section, status (active/inactive)
   - Sortable by code, name, category
   - Search filter (filters as you type)
   - Add button → inline form: code (required), name (required), category (dropdown of common categories + custom), linked TDS section (optional dropdown)
   - Edit button per row → inline edit mode
   - Delete button → confirms → soft delete (set inactive)
   - CSV Import button:
     - File picker for CSV
     - Preview parsed rows with validation errors highlighted
     - Confirm to import
     - Show results: N created, N updated, N errors

2. Add "Chart of Accounts" section to `frontend/src/components/tenantAdmin/TenantConfigTab.tsx`:
   - Position after existing config sections
   - Collapsible section header: "Chart of Accounts (GL Codes)" with count badge
   - Renders `GlCodeManager`

3. Common GL categories for dropdown seed: "Office Expenses", "Professional Services", "Rent", "Utilities", "Travel", "Contractor Services", "Raw Materials", "Commission", "Insurance", "Repairs & Maintenance", "Other"

**Verification:** Navigate to Config tab as TENANT_ADMIN. Add 3 GL codes manually. Import a CSV with 10 codes. Verify all appear in the table. Edit one, delete one. Verify the GL code dropdown in CompliancePanel (Prompt 1.9) shows the configured codes.

---

### Prompt 1.11 — Integration Tests and E2E Validation

**Goal:** End-to-end validation of the Phase 1 compliance pipeline.

**References:** RFC §11 (Testing Strategy)

**Tasks:**

1. Create `backend/src/services/compliance/__tests__/TdsCalculationService.test.ts`:
   - 100% branch coverage
   - All TDS sections with company and individual PAN
   - No-PAN penalty rate (20%)
   - Below-threshold scenarios
   - Subtotal vs total taxable amount
   - Edge: zero amount, null section, invalid PAN

2. Create `backend/src/services/compliance/__tests__/PanValidationService.test.ts`:
   - 100% branch coverage
   - Valid PAN format
   - Invalid PAN (wrong length, wrong characters)
   - GSTIN cross-reference match and mismatch
   - Null PAN, null GSTIN, both null

3. Create `backend/src/services/compliance/__tests__/GlCodeSuggestionService.test.ts`:
   - 100% branch coverage
   - Vendor with strong history → high confidence suggestion
   - Vendor with split history → lower confidence, alternatives shown
   - Vendor with no history → description fallback
   - No match at all → null suggestion
   - CSV import validation

4. Create `backend/src/services/compliance/__tests__/RiskSignalEvaluator.test.ts`:
   - 100% branch coverage
   - Each signal type individually
   - Multiple signals simultaneously
   - Penalty cap at 30
   - Backward compatibility: same results as old inline checks for financial and data-quality signals

5. Extend `backend/src/__tests__/e2e/tenantLifecycle.e2e.test.ts`:
   - After invoice extraction, verify `compliance` subdocument is populated
   - Verify PAN validation result
   - Override GL code → verify learning updates vendor master
   - Export to Tally → verify TDS ledger entry in XML

6. Create `backend/src/__tests__/e2e/compliancePipeline.e2e.test.ts`:
   - Upload a test invoice with known PAN (ABCPK1234F), GSTIN (29ABCPK1234F1Z5), and amount (₹1,00,000)
   - Verify extraction: PAN, GSTIN, amount
   - Verify compliance enrichment: PAN validated (L1+L2), TDS section detected, GL code suggested (if vendor has history)
   - Verify risk signals: none (clean invoice) or specific signals (for test invoices with intentional issues)
   - Verify Tally export: TDS entry, GL code mapping, amounts balance

**Verification:** All unit tests pass with 100% branch coverage on compliance modules. E2E test passes with live OCR/SLM (or mock). No regression in existing tests.

---

## Phase 2: Fraud and Risk Intelligence (m22)

---

### Prompt 2.1 — Vendor Bank Change Detection

**Goal:** Activate the bank change detection stub from Phase 1 with full vendor bank history tracking.

**References:** PRD §3.5 (Vendor Bank Account Change Detection), RFC §7.3 (Bank Change Detection)

**Tasks:**

1. Update `VendorMasterService.ts`:
   - On invoice processing, if bank account number and IFSC are extracted:
     - Hash account number with SHA-256
     - Check against vendor's `bankHistory` array
     - If hash matches any existing entry → update `lastSeen` and `invoiceCount`
     - If hash matches no entry → add new entry, set `firstSeen` and `lastSeen` to now
     - Return `isChanged: true` if this is a new bank account AND the vendor has prior bank history

2. Update `ComplianceEnrichmentService.ts`:
   - Set `compliance.vendorBank` from vendor master service result
   - If `isChanged: true` → add `VENDOR_BANK_CHANGED` risk signal (critical, 10-point penalty)

3. Update `PATCH /api/invoices/:id` compliance override:
   - When `vendorBankVerified: true` is sent, update the vendor master to mark the new bank account as verified
   - Remove the `VENDOR_BANK_CHANGED` signal from the invoice

4. Frontend: Show bank change alert in `RiskSignalList.tsx`:
   - Critical severity: red border, prominent placement
   - Show: "Vendor bank account changed from {old bank name} to {new bank name}"
   - "Verify Change" button → PATCH with `vendorBankVerified: true`
   - Display masked account numbers (last 4 digits)

5. Tests: 100% branch coverage on bank change detection logic. Test scenarios:
   - First invoice from vendor (no history) → no flag
   - Same bank as previous → no flag
   - Different bank, vendor has history → flag
   - Multiple banks in history, current matches older entry → no flag (legitimate multi-bank vendor)
   - Verify change → flag removed

---

### Prompt 2.2 — IRN / E-Invoice Validation

**Goal:** Extract and validate Invoice Reference Number (IRN) for GST e-invoice compliance.

**References:** PRD §3.6 (IRN / E-Invoice Validation)

**Tasks:**

1. Update SLM extraction to include `irn` field:
   - 64-character hex string, usually near QR code or top of invoice
   - Add to `invoice-slm/app/engine.py` structured output

2. Create `backend/src/services/compliance/IrnValidationService.ts`:
   - `validate(irn: string | null, vendorGstin: string | null): IrnValidationResult`
   - Format check: 64-char hex (`[a-f0-9]{64}`)
   - Presence check: if vendor appears to be above e-invoicing threshold (heuristic: GSTIN present + amount > ₹5Cr), flag if IRN missing
   - Returns risk signals: `IRN_MISSING`, `IRN_FORMAT_INVALID`

3. Wire into `ComplianceEnrichmentService.ts`.

4. Frontend: Display IRN in compliance panel (read-only). Show risk signal if missing/invalid.

5. Tests: format validation, presence check, threshold logic.

---

### Prompt 2.3 — MSME Classification and Payment Tracking

**Goal:** Track vendor MSME status and alert on approaching payment deadlines.

**References:** PRD §3.7 (MSME Classification and Payment Priority)

**Tasks:**

1. Update SLM extraction to include `udyamNumber` field:
   - Format: `UDYAM-XX-00-0000000` (Udyam registration number)
   - Add to `invoice-slm/app/engine.py` structured output

2. Create `backend/src/services/compliance/MsmeTrackingService.ts`:
   - `updateVendorMsme(tenantId, vendorFingerprint, udyamNumber): void`
   - Parse classification from Udyam number (encoded in the number)
   - Store in vendor master: `msme.udyamNumber`, `msme.classification`, `msme.verifiedAt`
   - `checkPaymentDeadline(invoiceDate: Date): RiskSignal[]`:
     - If vendor is MSME and invoice is > 30 days old → `MSME_PAYMENT_DUE_SOON` (warning)
     - If > 45 days → `MSME_PAYMENT_OVERDUE` (critical)

3. Wire into `ComplianceEnrichmentService.ts`.

4. Frontend: Show MSME badge on vendor name in invoice list. Show payment deadline warning in risk signals.

5. Dashboard widget: "MSME invoices approaching deadline" — count + list (added to overview dashboard).

6. Tests: Udyam format validation, deadline calculation, classification detection.

---

### Prompt 2.4 — Suspicious Email Sender Detection

**Goal:** Detect and flag suspicious email senders by comparing against vendor's known email domains.

**References:** PRD §3.8 (Suspicious Email Sender Detection)

**Tasks:**

1. Update `VendorMasterService.ts`:
   - Track `emailDomains` per vendor — array of domains seen on invoices from this vendor
   - On each invoice ingested via email, extract sender domain and add to vendor's `emailDomains` if new

2. Create email sender analysis in `RiskSignalEvaluator.ts`:
   - `SENDER_DOMAIN_MISMATCH`: Invoice vendor name matches a known vendor, but sender email domain doesn't match any of the vendor's known domains
   - `SENDER_FIRST_TIME`: First invoice from this specific email address (info level)
   - `SENDER_FREEMAIL`: Invoice from a freemail provider (gmail.com, yahoo.com, outlook.com, hotmail.com) when vendor has previously used a corporate domain

3. Email metadata is already captured during Gmail ingestion — sender email is stored as `invoice.metadata.get("from")` (set via `GmailImapIngestionProvider.ts` line 116). Do NOT add new dedicated fields. Instead, read from the existing `metadata` Map and extract the domain. Add a helper: `extractDomainFromMetadata(invoice.metadata?.get("from"))`.

4. Frontend: Show email sender risk signals in `RiskSignalList.tsx`.

5. Tests: domain comparison, freemail detection, first-time sender tracking.

---

### Prompt 2.5 — Duplicate Invoice Number Detection

**Goal:** Detect when a vendor submits a new invoice with the same invoice number as a prior one but different content.

**References:** PRD §3.9a (Duplicate Invoice Number Detection)

**Tasks:**

1. Update `VendorMasterService.ts` or create a `DuplicateInvoiceDetector` utility:
   - On each parsed invoice, query existing invoices for the same `tenantId` + vendor (by fingerprint or name) + invoice number
   - If a match is found with a different content hash → flag
   - If a match is found with the same content hash → existing dedup handles it (skip)

2. Add `DUPLICATE_INVOICE_NUMBER` to `RiskSignalEvaluator.ts`:
   - Severity: critical (10-point penalty)
   - Message: "Vendor previously submitted invoice {number} on {date} for {amount}. This submission has different content."
   - Include reference to the prior invoice ID for easy navigation

3. Frontend: Show in `RiskSignalList.tsx` with a link to the prior invoice.

4. Add index on `{ tenantId, vendorName, invoiceNumber }` to Invoice model for efficient lookup.

5. Tests: same number + different hash → flag, same number + same hash → no flag (dedup handles), different number → no flag, same number + different vendor → no flag.

---

### Prompt 2.6 — Compliance Reports

**Goal:** Generate downloadable compliance reports (TDS summary, GST reconciliation, vendor health, risk signal audit log).

**References:** PRD §3.9b (Compliance Reports)

**Tasks:**

1. Create `backend/src/services/compliance/ComplianceReportService.ts`:
   - `generateTdsSummary(tenantId, dateRange): TdsSummaryReport`
     - Vendor-wise TDS deductions grouped by section
     - Total TDS amount per section and overall
     - Override rate (manual vs auto TDS sections)
   - `generateGstReconciliation(tenantId, dateRange): GstReconciliationReport`
     - Invoice-wise: invoice number, vendor, GSTIN, CGST, SGST, IGST, Cess, total GST, PAN status
   - `generateVendorHealthReport(tenantId): VendorHealthReport`
     - Vendors missing PAN, vendors with recent bank changes, MSME vendors with payment status
   - `generateRiskSignalAuditLog(tenantId, dateRange): RiskSignalAuditReport`
     - All risk signals raised, grouped by type, with reviewer action (dismissed, acted on, pending)

2. Create `backend/src/routes/complianceReports.ts`:
   - `GET /api/reports/tds-summary?from=&to=&format=csv|pdf` (TENANT_ADMIN, VIEWER)
   - `GET /api/reports/gst-reconciliation?from=&to=&format=csv|pdf` (TENANT_ADMIN, VIEWER)
   - `GET /api/reports/vendor-health?format=csv|pdf` (TENANT_ADMIN)
   - `GET /api/reports/risk-audit?from=&to=&format=csv|pdf` (TENANT_ADMIN)
   - CSV generation: use a lightweight CSV library (e.g., `csv-stringify`)
   - PDF generation: Phase 2 delivers CSV only. PDF is Phase 3 (requires a PDF renderer dependency).

3. Frontend: Add "Reports" section to compliance dashboard with download buttons per report type and date range picker.

4. VIEWER scope: reports respect ViewerScope — a viewer only sees data for users in their scope.

5. Tests: report generation with known data, date range filtering, VIEWER scope filtering.

---

### Prompt 2.7 — Compliance Analytics Dashboard

**Goal:** Add a compliance-focused analytics view for tenant admins.

**References:** RFC §10.3 (Compliance Dashboard)

**Tasks:**

1. Create `backend/src/routes/complianceAnalytics.ts`:
   - `GET /api/analytics/compliance` — returns:
     - TDS summary: total TDS amount, breakdown by section, override rate
     - GL distribution: top 10 GL codes by invoice count and amount
     - Risk signal frequency: count by signal type, action rate (flagged vs dismissed)
     - PAN coverage: % of invoices with valid PAN
     - Vendor compliance health: vendors missing PAN, vendors with bank changes, MSME vendors

2. Create `frontend/src/components/ComplianceDashboard.tsx`:
   - TDS summary cards: total TDS, top sections, override rate
   - GL distribution horizontal bar chart (reuse existing chart patterns)
   - Risk signal frequency table with action rates
   - Vendor health scorecard
   - Downloadable reports section (links to report endpoints from Prompt 2.6)

3. Add "Compliance" tab to the dashboard tab bar (visible to TENANT_ADMIN only).

4. Tests: API returns correct aggregations. Frontend renders all sections.

---

## Phase 3: Automation and Multi-ERP (m23)

---

### Prompt 3.1 — Cost Center Allocation

**Goal:** Add cost center master, suggestion logic, and integration with GL codes.

**References:** PRD §3.10 (Cost Center Allocation), RFC §3.5 (Cost Center Master)

**Tasks:**

1. Create `backend/src/services/compliance/CostCenterService.ts`:
   - Same frequency-based suggestion model as GL codes
   - Additional: GL-code-linked cost centers (if GL 5010 is linked to CC "Marketing", auto-suggest)
   - `VendorCostCenterMapping` collection (mirror of VendorGlMapping)

2. Routes: `GET/POST/PUT/DELETE /api/admin/cost-centers` (mirror GL code routes)

3. Wire into `ComplianceEnrichmentService.ts` — runs after GL code suggestion

4. Frontend: Add cost center to `CompliancePanel.tsx` (dropdown override like GL code). Add cost center manager to `TenantConfigTab.tsx`.

5. Tally export: Add cost center to voucher narration or as a category tag.

6. Tests: 100% branch coverage. E2E: configure cost centers → process invoice → verify suggestion → export.

---

### Prompt 3.2 — Vendor Communication Templates

**Goal:** Auto-draft emails to vendors when validation fails, sent through tenant's Gmail connection after reviewer approval.

**References:** PRD §3.11 (Automated Vendor Communication)

**Tasks:**

1. Create `backend/src/services/compliance/VendorCommunicationService.ts`:
   - `generateDraft(invoice, trigger, vendorEmail): EmailDraft`
   - Triggers: `PAN_MISSING`, `IRN_MISSING`, `VENDOR_BANK_CHANGED`, `GSTIN_FORMAT_INVALID`
   - Templates stored as configurable objects (tenant can customize subject + body)
   - Template variables: `{{vendorName}}`, `{{invoiceNumber}}`, `{{invoiceDate}}`, `{{tenantName}}`

2. Create `backend/src/routes/vendorCommunication.ts`:
   - `POST /api/invoices/:id/vendor-email` — generate draft for specific trigger
   - `POST /api/invoices/:id/vendor-email/send` — send approved draft via tenant's Gmail OAuth
   - `GET /api/admin/vendor-email-templates` — list/edit templates (TENANT_ADMIN)

3. Frontend: "Request from Vendor" button on critical risk signals → shows draft email → "Send" button

4. Reuse existing Gmail OAuth token from `tenantGmailIntegrationService.ts` for sending.

5. Tests: template rendering, email sending (mock), trigger matching.

**Constraint:** Never auto-sends. Always shows draft to reviewer first.

---

### Prompt 3.3 — Generic CSV Export Adapter

**Goal:** Add a configurable CSV export option alongside Tally XML.

**References:** PRD §3.12 (Multi-ERP Export Adapters)

**Tasks:**

1. Create `backend/src/services/csvExporter.ts`:
   - Implements `AccountingExporter` interface
   - Configurable column mapping: tenant admin selects which fields map to which CSV columns
   - Default columns: Invoice Number, Vendor Name, Date, Total, Currency, TDS Section, TDS Amount, GL Code, Cost Center, Net Payable, CGST, SGST, IGST, Cess
   - CSV generation with proper escaping (commas in vendor names, etc.)

2. Routes:
   - `POST /api/exports/csv` — submit invoices for CSV export
   - `GET /api/exports/csv/download/:batchId` — download CSV file
   - `GET /api/admin/csv-mapping` — get/set column mapping config

3. Frontend: Add "Export as CSV" option alongside "Export to Tally" in the export UI.

4. Tests: CSV generation with special characters, column mapping, batch tracking.

---

### Prompt 3.4 — Phase 3 E2E Validation and Documentation

**Goal:** Full end-to-end validation of all three phases and documentation update.

**Tasks:**

1. E2E test: Full compliance lifecycle
   - Configure GL codes and cost centers
   - Upload invoice → extraction → compliance enrichment → review with compliance panel
   - Override GL code → verify learning
   - Approve → export to Tally with TDS + GL + cost center → verify XML
   - Export same batch to CSV → verify CSV columns match
   - Risk signal on bank change → verify change → verify signal cleared

2. Update `docs/PRD.md`:
   - Add compliance features to Core Features section
   - Update Requirements table with D-5 through D-8 and TS-8 through TS-14
   - Update Competitive Position section

3. Update `docs/RFC.md`:
   - Add RFC-30 through RFC-37 summaries
   - Update RFC-05 (Confidence and Risk) to reference unified risk signal evaluator
   - Update RFC-08 (Tally Export) to include TDS and GL code extensions

4. Update `docs/RFC-INDEX.md`:
   - Add entries RFC-30 through RFC-37 with status, summary, related code, confidence

5. Update `docs/state-machine/INVOICE-STATE-MACHINE.md`:
   - Verify all new endpoints match §4 contracts
   - Update `frontend/src/types.ts` sync checklist verification
   - Add any new state transitions discovered during implementation

6. Performance validation:
   - Compliance enrichment < 50ms per invoice (Phase 1 features)
   - Tally export with TDS/GL: verify no regression in export time
   - GL code suggestion: < 10ms per invoice (database query)

---

## Execution Notes

### Dependencies Between Prompts

```
Phase 1:
  1.1 (Models) ─┬── 1.2 (SLM Extension) ────┐
                 ├── 1.3 (Framework) ──────────┤
                 │                              ├── 1.7 (Tally Export)
                 ├── 1.4 (TDS Service) ────────┤
                 ├── 1.5 (GL Service) ─────────┤
                 └── 1.6 (Risk Signals) ───────┘
                                                ├── 1.8 (API Routes)
                                                ├── 1.9 (Frontend: Panel) ─── 1.10 (Frontend: Config)
                                                └── 1.11 (Tests)

Phase 2:
  2.1 (Bank) ──┐
  2.2 (IRN) ───┤
  2.3 (MSME) ──┼── 2.6 (Reports) ── 2.7 (Dashboard)
  2.4 (Email) ─┤
  2.5 (Dedup) ─┘

Phase 3:
  3.1 (Cost Center) ──┐
  3.2 (Vendor Comms) ──┼── 3.4 (E2E + Docs)
  3.3 (CSV Export) ────┘
```

### Parallelizable Work

**Within Phase 1:**
- Prompts 1.2 (SLM) and 1.1 (Models) can start in parallel
- Prompts 1.4 (TDS), 1.5 (GL), 1.6 (Risk Signals) can run in parallel after 1.1 + 1.3
- Prompts 1.9 (Frontend Panel) and 1.7 (Tally Export) can run in parallel after services are done
- Prompt 1.8 (API Routes) can start as soon as services exist

**Within Phase 2:**
- Prompts 2.1-2.5 can run in parallel — they're independent feature additions
- Prompt 2.6 (Reports) depends on risk signals and compliance data being populated
- Prompt 2.7 (Dashboard) depends on 2.6 completing (includes report download links)

**Within Phase 3:**
- Prompts 3.1-3.3 can run in parallel
- Prompt 3.4 depends on all completing

### Quality Gates Per Phase

**Phase 1 complete when:**
- [ ] All compliance models created and seeded
- [ ] PAN extracted and validated (L1 + L2) on test invoices
- [ ] TDS section detected and amount calculated correctly
- [ ] GL code suggested from vendor history
- [ ] Risk signals unified and backward-compatible
- [ ] Tally export includes TDS and GL code entries
- [ ] All compliance modules at 100% branch coverage
- [ ] E2E test passes
- [ ] Frontend shows compliance panel with working overrides
- [ ] GL code configuration UI works (CRUD + CSV import)

**Phase 2 complete when:**
- [ ] Vendor bank change detected and flagged
- [ ] IRN extracted and validated
- [ ] MSME vendor tracked with payment deadline alerts
- [ ] Suspicious email senders flagged
- [ ] Duplicate invoice numbers detected across vendor history
- [ ] Compliance reports downloadable (TDS summary, GST reconciliation, vendor health, risk audit — CSV)
- [ ] Compliance analytics dashboard renders with real data
- [ ] Ingestion throughput validated at > 1,000 invoices/hour
- [ ] All new modules at 100% branch coverage

**Phase 3 complete when:**
- [ ] Cost centers configurable and suggested
- [ ] Vendor communication drafts generated and sendable
- [ ] CSV export works with configurable column mapping
- [ ] Full E2E lifecycle test passes
- [ ] PRD, RFC, and RFC-INDEX updated
- [ ] Performance benchmarks met
