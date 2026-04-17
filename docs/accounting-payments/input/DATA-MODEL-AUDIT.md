Now I have a comprehensive picture. Let me compile the full report.

---

# BillForge Data Model Report

## 1. Executive Summary

- **Total models**: 30 Mongoose schemas across 4 domains
- **Total collections**: 26 distinct MongoDB collections (4 sub-schemas are embedded-only: `ocrBlock`, `extractionFieldProvenance`, `workflowStepResult`, `bankHistoryEntry`)
- **Total top-level fields**: approximately 280
- **Total indexes**: 58 declared indexes across all models

### Key Relationships (Text-Based ER)

```
Tenant (1)
  |-- (1:N) User                   [via User.tenantId = Tenant._id]
  |-- (1:N) TenantUserRole         [via TenantUserRole.tenantId = Tenant._id]
  |-- (1:N) Invoice                [via Invoice.tenantId = Tenant._id]
  |-- (1:N) BankAccount            [via BankAccount.tenantId]
  |-- (1:N) BankStatement          [via BankStatement.tenantId]
  |-- (1:N) BankTransaction        [via BankTransaction.tenantId]
  |-- (1:1) TenantComplianceConfig [unique on tenantId]
  |-- (1:1) TenantExportConfig     [unique on tenantId]
  |-- (1:1) TenantTcsConfig        [unique on tenantId]
  |-- (1:1) ApprovalWorkflow       [unique on tenantId]
  |-- (1:N) TenantIntegration      [via tenantId + provider + email]
  |-- (1:N) TenantInvite           [via tenantId]
  |-- (1:N) TenantMailboxAssignment [via tenantId, refs TenantIntegration]
  |-- (1:N) VendorMaster           [via tenantId + vendorFingerprint]
  |-- (1:N) GlCodeMaster           [via tenantId + code]
  |-- (1:N) CostCenterMaster       [via tenantId + code]
  |-- (1:N) VendorGlMapping        [via tenantId + vendorFingerprint + glCode]
  |-- (1:N) VendorCostCenterMapping
  |-- (1:N) ExtractionMapping
  |-- (1:N) ExtractionLearning
  |-- (1:N) VendorTemplate
  |-- (1:N) ViewerScope
  |-- (1:N) ExportBatch
  |-- (1:N) Checkpoint

Invoice (N) -- (0..1) BankTransaction   [via compliance.reconciliation.bankTransactionId]
BankTransaction (N) -- (1) BankStatement [via statementId]
BankTransaction (0..1) -- Invoice        [via matchedInvoiceId]

TdsRateTable  -- global (no tenantId), referenced by section
TdsSectionMapping -- per-tenant or global (tenantId nullable)
```

### Top 5 Data Model Risks

1. **GL code source enum mismatch** -- Mongoose schema has 4 values; TypeScript type has 5 (`slm-classification` missing from schema). Silent data loss on write.
2. **TDS rate unit ambiguity** -- `TenantComplianceConfig.tdsRates` uses `rateIndividual`/`rateCompany`/`rateNoPan` (no unit suffix) but `TdsCalculationService` treats them as BPS. `TdsRateTable` uses `rateCompanyBps`. Mismatch invites bugs.
3. **Single-invoice reconciliation mapping** -- `BankTransaction.matchedInvoiceId` is a single string. Cannot model split payments (one bank txn mapped to multiple invoices) or consolidated payments (multiple bank txns to one invoice).
4. **No integer validation on minor-unit financial fields** -- Only `parsed.totalAmountMinor` has `Number.isInteger` validation. All other `*Minor` fields (GST breakdowns, line items, TDS, TCS, bank debit/credit/balance) accept floating-point values.
5. **Dead fields on User model** -- `passwordHash`, `tempPassword`, `mustChangePassword`, `emailVerified`, `verificationTokenHash` are remnants of pre-Keycloak local auth. They consume space and create confusion.

---

## 2. Current Model Catalog

### 2.1 Core Domain

#### Tenant
- **File**: `backend/src/models/core/Tenant.ts`
- **Collection**: `tenants`
- **Fields**:
  | Field | Type | Required | Default | Indexed |
  |-------|------|----------|---------|---------|
  | name | String | yes | - | no |
  | onboardingStatus | String enum [pending, completed] | yes | pending | no |
  | country | String enum [IN] | yes | IN | no |
  | defaultCurrency | String | yes | INR | no |
  | mode | String enum [test, live] | yes | test | no |
  | enabled | Boolean | yes | true | no |
  | createdAt/updatedAt | Date | auto | auto | createdAt: yes |
- **Indexes**: `{ createdAt: 1 }`
- **Relationships**: Root entity; referenced by string `_id` across all tenant-scoped models
- **Issues**: No index on `enabled` or `mode` for filtering active/live tenants in platform admin queries. No `slug` or `subdomain` field for multi-tenant URL routing.

#### User
- **File**: `backend/src/models/core/User.ts`
- **Collection**: `users`
- **Fields**:
  | Field | Type | Required | Default | Indexed |
  |-------|------|----------|---------|---------|
  | email | String | yes | - | unique |
  | externalSubject | String | yes | - | unique |
  | tenantId | String | yes | - | compound |
  | displayName | String | yes | - | no |
  | encryptedRefreshToken | String | no | - | no |
  | lastLoginAt | Date | yes | - | no |
  | passwordHash | String | no | - | no |
  | tempPassword | String | no | - | no |
  | mustChangePassword | Boolean | no | false | no |
  | emailVerified | Date | no | - | no |
  | verificationTokenHash | String | no | - | no |
  | enabled | Boolean | yes | true | no |
- **Indexes**: `{ email: 1 } unique`, `{ externalSubject: 1 } unique`, `{ tenantId: 1, email: 1 }`
- **Issues**:
  - `passwordHash`, `tempPassword`, `mustChangePassword`, `emailVerified`, `verificationTokenHash` are dead fields from pre-Keycloak era. Still written to in `platformAdminService.ts` for onboarding, but Keycloak is the source of truth for credentials.
  - `tenantId` stored as String (not ObjectId ref) -- consistent pattern across all models, but prevents `$lookup` joins without `$toString`/`$toObjectId` overhead.
  - No index on `enabled` for filtering disabled users.

#### TenantUserRole
- **File**: `backend/src/models/core/TenantUserRole.ts`
- **Collection**: `tenantuserroles`
- **Fields**:
  | Field | Type | Required | Default | Indexed |
  |-------|------|----------|---------|---------|
  | tenantId | String | yes | - | compound unique |
  | userId | String | yes | - | compound unique |
  | role | String enum [PLATFORM_ADMIN, TENANT_ADMIN, ap_clerk, senior_accountant, ca, tax_specialist, firm_partner, ops_admin, audit_clerk] | yes | - | compound |
  | capabilities | Embedded (21 boolean flags + 1 number) | no | {} | no |
- **Indexes**: `{ tenantId: 1, userId: 1 } unique`, `{ tenantId: 1, role: 1 }`
- **Embedded**: `userCapabilitiesSchema` with 21 boolean capabilities and `approvalLimitMinor` (Number, no integer validation)
- **Issues**: Memory notes mention MEMBER and VIEWER roles, but neither appears in the `TenantRoles` or `PersonaRoles` arrays. The persona-based role system (ap_clerk, senior_accountant, etc.) appears to serve as the "MEMBER" concept, but there is no explicit VIEWER role in the enum. `approvalLimitMinor` lacks integer validation.

#### Checkpoint
- **File**: `backend/src/models/core/Checkpoint.ts`
- **Collection**: `checkpoints`
- **Fields**: `tenantId` (String, default "default"), `sourceKey` (String), `marker` (String), `metadata` (Map of String)
- **Indexes**: `{ tenantId: 1, sourceKey: 1 } unique`
- **Issues**: None significant. Clean ingestion cursor model.

#### AuthLoginState
- **File**: `backend/src/models/core/AuthLoginState.ts`
- **Collection**: `authloginstates`
- **Fields**: `state` (String, unique), `codeVerifier`, `redirectUri`, `nextPath` (default "/"), `expiresAt` (Date)
- **Indexes**: `{ state: 1 } unique` (implicit from schema), `{ expiresAt: 1 } TTL`
- **Issues**: None. Properly TTL-indexed for auto-cleanup.

---

### 2.2 Invoice Domain

#### Invoice
- **File**: `backend/src/models/invoice/Invoice.ts`
- **Collection**: `invoices`
- **Fields** (heavily nested, ~80+ leaf fields):
  - **Top-level**: `tenantId`, `workloadTier`, `sourceType`, `sourceKey`, `sourceDocumentId`, `attachmentName`, `contentHash`, `mimeType`, `receivedAt`, `ocrProvider`, `ocrText`, `ocrConfidence`, `ocrBlocks[]`, `ocrTokens`, `slmTokens`, `confidenceScore`, `confidenceTone`, `autoSelectForApproval`, `riskFlags[]`, `riskMessages[]`, `status`, `processingIssues[]`, `gmailMessageId`, `metadata` (Map)
  - **Nested `parsed`**: `invoiceNumber`, `vendorName`, `invoiceDate` (Date), `dueDate` (Date), `totalAmountMinor` (integer-validated), `currency`, `notes[]`, `gst` (gstin, subtotalMinor, cgstMinor, sgstMinor, igstMinor, cessMinor, totalTaxMinor), `pan`, `bankAccountNumber`, `bankIfsc`, `lineItems[]` (description, hsnSac, quantity, rate, amountMinor, taxRate, cgstMinor, sgstMinor, igstMinor)
  - **Nested `extraction`**: `source`, `strategy`, `invoiceType`, `classification` (invoiceType, category, tdsSection), `fieldConfidence` (Map), `fieldProvenance` (Map of provenance sub-schema), `lineItemProvenance[]`, `fieldOverlayPaths` (Map)
  - **Nested `approval`**: `approvedBy`, `approvedAt`, `userId`, `email`, `role`
  - **Nested `workflowState`**: `workflowId`, `currentStep`, `status`, `stepResults[]`
  - **Nested `export`**: `system`, `batchId`, `exportedAt`, `externalReference`, `error`
  - **Nested `compliance`**: `pan` (value, source, validationLevel, validationResult, gstinCrossRef), `tds` (section, rate, amountMinor, netPayableMinor, source, confidence), `glCode` (code, name, source, confidence, suggestedAlternatives[]), `costCenter` (code, name, source, confidence), `irn` (value, valid), `msme` (udyamNumber, classification, paymentDeadline), `tcs` (rate, amountMinor, source), `vendorBank` (accountHash, ifsc, bankName, isChanged, verifiedChange), `reconciliation` (bankTransactionId, verifiedByStatement, matchedAt), `riskSignals[]` (code, category, severity, message, confidencePenalty, status, resolvedBy, resolvedAt)
- **Indexes** (11 total):
  1. `{ tenantId, sourceType, sourceKey, sourceDocumentId, attachmentName } unique` -- deduplication
  2. `{ tenantId, gmailMessageId } unique partial` -- Gmail dedup
  3. `{ tenantId, "approval.userId" }`
  4. `{ tenantId, status, createdAt: -1 }` -- list page main query
  5. `{ tenantId, createdAt }`
  6. `{ tenantId, "approval.approvedAt" }`
  7. `{ tenantId, "export.exportedAt" }`
  8. `{ tenantId, "parsed.vendorName", status }`
  9. `{ tenantId, status, "parsed.totalAmountMinor" }` -- reconciliation
  10. `{ tenantId, "parsed.gst.gstin" } sparse` -- reconciliation GSTIN filter
- **Issues**:
  - **Enum mismatch**: `compliance.glCode.source` enum in Mongoose is `["vendor-default", "description-match", "category-default", "manual"]`. TypeScript `GL_CODE_SOURCE` includes `"slm-classification"`. Values written via SLM classification will either be silently dropped or trigger validation errors depending on Mongoose strict mode.
  - **No integer validation** on `parsed.gst.*Minor`, `parsed.lineItems[].amountMinor`, `compliance.tds.amountMinor`, `compliance.tds.netPayableMinor`, `compliance.tcs.amountMinor`. Only `parsed.totalAmountMinor` has `Number.isInteger` validation.
  - **No index on `contentHash`** despite being used in `$group` aggregation for duplicate detection (`invoiceService.ts` line 146). This aggregation runs on every list query via `$facet`.
  - **`riskFlags` and `riskMessages`** are legacy fields that predate `compliance.riskSignals[]`. They are still written to but should probably be removed.
  - **Document size risk**: `ocrText` can be very large. Excluded from queries via `.select({ ocrText: 0 })` but still counts toward the 16MB BSON limit.
  - **`compliance.reconciliation` is 1:1**: Only stores a single `bankTransactionId`. Cannot represent partial payments or split bank transactions.

#### ExportBatch
- **File**: `backend/src/models/invoice/ExportBatch.ts`
- **Collection**: `exportbatches`
- **Fields**: `tenantId`, `system`, `total`, `successCount`, `failureCount`, `requestedBy`, `fileKey`
- **Indexes**: `{ tenantId: 1, createdAt: -1 }`
- **Issues**: No reference back to the specific invoice IDs in the batch. The only link is `Invoice.export.batchId`.

#### ExtractionLearning
- **File**: `backend/src/models/invoice/ExtractionLearning.ts`
- **Collection**: `extractionlearnings`
- **Fields**: `tenantId`, `groupKey`, `groupType` (enum: invoice-type, vendor), `corrections[]` (field, hint, count, lastSeen)
- **Indexes**: `{ tenantId, groupKey, groupType } unique`, `{ updatedAt } TTL 90 days`
- **Issues**: None significant. TTL auto-cleans stale data.

#### ExtractionMapping
- **File**: `backend/src/models/invoice/ExtractionMapping.ts`
- **Collection**: `extractionmappings` (explicitly set)
- **Fields**: `tenantId`, `matchType` (gstin, vendorNameFuzzy), `matchKey`, `canonicalVendorName`, `fieldOverrides` (currency), `createdBy`, `source` (manual, user-correction), `appliedCount`, `lastAppliedAt`
- **Indexes**: `{ tenantId, matchType, matchKey } unique`, `{ tenantId, updatedAt: -1 }`
- **Issues**: None.

#### VendorTemplate
- **File**: `backend/src/models/invoice/VendorTemplate.ts`
- **Collection**: `vendortemplates`
- **Fields**: `tenantId`, `fingerprintKey`, `layoutSignature`, `vendorName`, `currency`, `invoicePrefix`, `confidenceScore`, `usageCount`
- **Indexes**: `{ tenantId, fingerprintKey } unique`, `{ tenantId, vendorName }`
- **Issues**: None.

#### ApprovalWorkflow
- **File**: `backend/src/models/invoice/ApprovalWorkflow.ts`
- **Collection**: `approvalworkflows`
- **Fields**: `tenantId`, `enabled`, `mode` (simple, advanced), `simpleConfig` (requireManagerReview, requireFinalSignoff), `steps[]` (order, name, type, approverType, approverRole, approverUserIds, approverPersona, approverCapability, rule, condition, timeoutHours, escalateTo), `updatedBy`
- **Indexes**: `{ tenantId: 1 } unique`
- **Issues**: `condition.value` is `Schema.Types.Mixed` -- no type safety. `timeoutHours` is defined but no scheduler exists to enforce escalation.

---

### 2.3 Bank Domain

#### BankAccount
- **File**: `backend/src/models/bank/BankAccount.ts`
- **Collection**: `bankaccounts`
- **Fields**: `tenantId`, `createdByUserId`, `status` (enum: pending_consent, active, paused, revoked, expired, error), `consentHandle`, `consentId`, `consentArtefact`, `aaAddress`, `displayName`, `bankName`, `maskedAccNumber`, `balanceMinor`, `currency`, `balanceFetchedAt`, `lastErrorReason`, `sessionId`, `fiSessionId`
- **Indexes**: `{ tenantId, createdAt: -1 }`, `{ consentHandle } sparse`, `{ sessionId } sparse`
- **Issues**: `balanceMinor` has no integer validation. No index on `status` for filtering active accounts.

#### BankStatement
- **File**: `backend/src/models/bank/BankStatement.ts`
- **Collection**: `bankstatements`
- **Fields**: `tenantId`, `fileName`, `bankName`, `accountNumberMasked`, `accountHolder`, `currency`, `periodFrom` (Date), `periodTo` (Date), `transactionCount`, `matchedCount`, `suggestedCount`, `unmatchedCount`, `processingStatus` (enum), `source` (pdf-parsed, csv-import), `uploadedBy`, `s3Key`, `gstin`, `gstinLabel`
- **Indexes**: `{ tenantId, createdAt: -1 }`, `{ tenantId, bankName, accountNumberMasked }`
- **Issues**: Reconciliation counts (`matchedCount`, `suggestedCount`, `unmatchedCount`) are denormalized and updated on reconciliation completion. If a subsequent unmatch/rematch occurs, these counts may drift unless re-reconciliation is run.

#### BankTransaction
- **File**: `backend/src/models/bank/BankTransaction.ts`
- **Collection**: `banktransactions`
- **Fields**: `tenantId`, `statementId`, `date` (Date), `description`, `reference`, `debitMinor`, `creditMinor`, `balanceMinor`, `matchedInvoiceId` (single string), `matchConfidence`, `matchStatus` (matched, suggested, unmatched, manual), `source` (parsed, csv-import, pdf-parsed)
- **Indexes** (5): `{ tenantId, statementId }`, `{ tenantId, matchStatus }`, `{ tenantId, matchedInvoiceId } sparse`, `{ tenantId, date, description, debitMinor, creditMinor }`, `{ tenantId, statementId, matchStatus, debitMinor }`
- **Issues**:
  - **Single `matchedInvoiceId`**: Cannot represent split or partial payments.
  - **No integer validation** on `debitMinor`, `creditMinor`, `balanceMinor`.
  - **Orphan risk**: If an invoice is deleted, the `matchedInvoiceId` on the transaction becomes a dangling reference. No cascade cleanup exists.

---

### 2.4 Compliance Domain

#### GlCodeMaster
- **File**: `backend/src/models/compliance/GlCodeMaster.ts`
- **Collection**: `glcodemasters`
- **Fields**: `tenantId`, `code`, `name`, `category`, `linkedTdsSection`, `parentCode`, `isActive`
- **Indexes**: `{ tenantId, code } unique`, `{ tenantId, category }`
- **Issues**: `parentCode` enables a hierarchy but no recursive index. `linkedTdsSection` is a string reference, not validated against `TdsRateTable`.

#### CostCenterMaster
- **File**: `backend/src/models/compliance/CostCenterMaster.ts`
- **Collection**: `costcentermasters`
- **Fields**: `tenantId`, `code`, `name`, `department`, `linkedGlCodes[]`, `isActive`
- **Indexes**: `{ tenantId, code } unique`
- **Issues**: `linkedGlCodes` are stored as string array. No validation that they exist in `GlCodeMaster`.

#### VendorMaster
- **File**: `backend/src/models/compliance/VendorMaster.ts`
- **Collection**: `vendormasters`
- **Fields**: `tenantId`, `vendorFingerprint`, `name`, `aliases[]`, `pan`, `gstin`, `panCategory` (enum: C/P/H/F/T/A/B/L/J/G), `defaultGlCode`, `defaultCostCenter`, `defaultTdsSection`, `bankHistory[]` (accountHash, ifsc, bankName, firstSeen, lastSeen, invoiceCount), `msme` (udyamNumber, classification, verifiedAt), `emailDomains[]`, `invoiceCount`, `lastInvoiceDate`
- **Indexes**: `{ tenantId, vendorFingerprint } unique`, `{ tenantId, pan } sparse`, `{ tenantId, name } text`
- **Issues**: 
  - `invoiceCount` and `lastInvoiceDate` are denormalized and updated manually. Can drift if invoice deletions don't decrement.
  - No Tally sync fields (needed for PRD).
  - `defaultGlCode`, `defaultCostCenter`, `defaultTdsSection` are string references with no foreign-key validation.

#### VendorGlMapping
- **File**: `backend/src/models/compliance/VendorGlMapping.ts`
- **Collection**: `vendorglmappings`
- **Fields**: `tenantId`, `vendorFingerprint`, `glCode`, `glCodeName`, `usageCount`, `recentUsages[]` (Date array), `lastUsedAt`
- **Indexes**: `{ tenantId, vendorFingerprint, glCode } unique`
- **Issues**: `glCodeName` is denormalized from `GlCodeMaster.name`. Rename in GlCodeMaster won't propagate.

#### VendorCostCenterMapping
- **File**: `backend/src/models/compliance/VendorCostCenterMapping.ts`
- **Collection**: `vendorcostcentermappings`
- **Fields**: `tenantId`, `vendorFingerprint`, `costCenterCode`, `costCenterName`, `usageCount`, `lastUsedAt`
- **Indexes**: `{ tenantId, vendorFingerprint, costCenterCode } unique`
- **Issues**: Same denormalization risk as VendorGlMapping.

#### TdsRateTable
- **File**: `backend/src/models/compliance/TdsRateTable.ts`
- **Collection**: `tdsratetables`
- **Fields**: `section`, `description`, `rateCompanyBps`, `rateIndividualBps`, `rateNoPanBps`, `thresholdSingleMinor`, `thresholdAnnualMinor`, `effectiveFrom` (Date), `effectiveTo` (Date), `isActive`
- **Indexes**: `{ section, effectiveFrom } unique`, `{ isActive, effectiveTo }`
- **Relationships**: Global (no tenantId). Referenced by section string from `TdsSectionMapping` and `TdsCalculationService`.
- **Issues**: No integer validation on `*Bps` or `*Minor` fields. No `tenantId` -- by design this is a system-wide reference table, but it cannot support tenant-specific TDS rate overrides at this level (those are in TenantComplianceConfig).

#### TdsSectionMapping
- **File**: `backend/src/models/compliance/TdsSectionMapping.ts`
- **Collection**: `tdssectionmappings`
- **Fields**: `tenantId` (nullable), `glCategory`, `panCategory`, `tdsSection`, `priority`
- **Indexes**: `{ tenantId, glCategory, panCategory }` (not unique -- allows multiple mappings per combo, sorted by priority)
- **Issues**: `tenantId` defaults to `null` for global mappings. The query in `TdsCalculationService` uses `tenantId: null` as a fallback, which is correct. However, the index is NOT unique, which is intentional for priority-based disambiguation but could lead to unbounded growth.

---

### 2.5 Integration Domain

#### TenantComplianceConfig
- **File**: `backend/src/models/integration/TenantComplianceConfig.ts`
- **Collection**: `tenantcomplianceconfigs`
- **Fields**: ~30+ fields including all compliance toggles, TDS rates (embedded array), risk signal config, reconciliation thresholds, confidence weights, etc.
- **Indexes**: `{ tenantId } unique`
- **Issues**:
  - **TDS rate unit confusion**: `tdsRates[].rateIndividual`/`rateCompany`/`rateNoPan` are named without `Bps` suffix but `TdsCalculationService.lookupRate()` assigns them to `rateBps` and divides by 10000. This is a semantic mismatch waiting to cause bugs if someone populates these as percentage values (e.g., 10 for 10%) rather than BPS (e.g., 1000 for 10%).
  - Extremely wide config document -- 30+ optional fields in a single document is a maintenance burden. Could be split into sub-configs.
  - A parallel `TenantComplianceConfigFields` TypeScript interface is manually maintained (not derived from schema). Can drift.

#### TenantExportConfig
- **File**: `backend/src/models/integration/TenantExportConfig.ts`
- **Collection**: `tenantexportconfigs`
- **Fields**: `tenantId`, `tallyCompanyName`, `tallyPurchaseLedger`, `tallyCgstLedger`, `tallySgstLedger`, `tallyIgstLedger`, `tallyCessLedger`, `tallyTdsLedger`, `tallyTcsLedger`, `csvColumns[]` (key, label)
- **Indexes**: `{ tenantId } unique`
- **Issues**: No Tally vendor ledger sync fields. CSV column config is minimal.

#### TenantIntegration
- **File**: `backend/src/models/integration/TenantIntegration.ts`
- **Collection**: `tenantintegrations`
- **Fields**: `tenantId`, `provider` (gmail), `status` (connected, requires_reauth, error), `emailAddress`, `encryptedRefreshToken`, `createdByUserId`, `lastErrorReason`, `lastSyncedAt`, `reauthNotifiedAt`, `pollingConfig` (enabled, intervalHours, lastPolledAt, nextPollAfter)
- **Indexes**: `{ tenantId, provider, emailAddress } unique`, `{ provider }`, `{ pollingConfig.enabled, pollingConfig.nextPollAfter, status }`
- **Issues**: Tight to Gmail. Adding other providers (Outlook, IMAP) will require schema flexibility.

#### TenantInvite
- **File**: `backend/src/models/integration/TenantInvite.ts`
- **Collection**: `tenantinvites`
- **Fields**: `tenantId`, `email`, `tokenHash`, `role` (hardcoded enum: ["ap_clerk"]), `invitedByUserId`, `expiresAt`, `acceptedAt`
- **Indexes**: `{ tokenHash } unique`, `{ expiresAt } TTL`, `{ tenantId, email, acceptedAt }`
- **Issues**: Role enum is hardcoded to only `["ap_clerk"]`. Cannot invite users with other roles (senior_accountant, etc.).

#### TenantMailboxAssignment
- **File**: `backend/src/models/integration/TenantMailboxAssignment.ts`
- **Collection**: `tenantmailboxassignments`
- **Fields**: `tenantId`, `integrationId` (ObjectId ref to TenantIntegration), `assignedTo`
- **Indexes**: `{ tenantId, integrationId, assignedTo } unique`
- **Issues**: Only model using ObjectId ref. All others use string IDs. Inconsistent.

#### TenantTcsConfig
- **File**: `backend/src/models/integration/TenantTcsConfig.ts`
- **Collection**: `tenanttcsconfigs`
- **Fields**: `tenantId`, `ratePercent`, `effectiveFrom`, `updatedBy`, `enabled`, `tcsModifyRoles[]`, `history[]` (previousRate, newRate, changedBy, changedByName, changedAt, reason, effectiveFrom)
- **Indexes**: `{ tenantId } unique`
- **Issues**: `ratePercent` is percentage, while TDS uses BPS. The TCS rate in `ReconciliationService` is used as `tcsRatePercent` and applied as `baseNetPayable * tcsRatePercent / 100`. This is correct but different from TDS convention. Should be documented.

#### OAuthState
- **File**: `backend/src/models/integration/OAuthState.ts`
- **Collection**: `oauthstates`
- **Fields**: `state` (unique), `userId`, `tenantId`, `provider` (gmail), `codeVerifier`, `expiresAt`
- **Indexes**: `{ state } unique` (implicit), `{ expiresAt } TTL`
- **Issues**: None.

#### ViewerScope
- **File**: `backend/src/models/integration/ViewerScope.ts`
- **Collection**: `viewerscopes`
- **Fields**: `tenantId`, `viewerUserId`, `visibleUserIds[]`
- **Indexes**: `{ tenantId, viewerUserId } unique`
- **Issues**: None. Clean model for viewer data scope.

#### MailboxNotificationEvent
- **File**: `backend/src/models/integration/MailboxNotificationEvent.ts`
- **Collection**: `mailboxnotificationevents`
- **Fields**: `userId`, `provider` (gmail), `emailAddress`, `eventType`, `reason`, `delivered`
- **Indexes**: `{ userId, provider, eventType, createdAt: -1 }`
- **Issues**: No `tenantId` field. This breaks the universal tenant isolation pattern. A platform admin query across tenants would work, but tenant-scoped queries require a join through User.

---

## 3. Data Integrity Issues

### 3.1 Missing Indexes

| Query Pattern | Location | Missing Index |
|---|---|---|
| `contentHash` grouping in `$facet` | `invoiceService.ts:146` | `{ tenantId: 1, contentHash: 1 } sparse` |
| `InvoiceModel.countDocuments({ ...baseQuery, "compliance.tds.source": TDS_SOURCE.MANUAL })` | `complianceAnalytics.ts:59` | `{ tenantId: 1, "compliance.tds.source": 1 }` |
| `InvoiceModel.countDocuments({ ...baseQuery, "compliance.pan.validationResult": "valid" })` | `complianceAnalytics.ts:47` | `{ tenantId: 1, "compliance.pan.validationResult": 1 } sparse` |
| `VendorMasterModel.countDocuments({ tenantId, pan: null })` | `complianceAnalytics.ts:51` | Already covered by `{ tenantId, pan } sparse` |
| `BankAccountModel.findOne({ sessionId })` | `MockBankConnectionService.ts:33` | Already covered by `{ sessionId } sparse` |
| `InvoiceModel.findOne({ tenantId, "parsed.invoiceNumber": ..., "parsed.vendorName": ... })` | `DuplicateInvoiceDetector.ts:27` | `{ tenantId: 1, "parsed.invoiceNumber": 1, "parsed.vendorName": 1 }` -- the existing vendor+status index is not optimal for this |

### 3.2 Denormalization Risks

1. **VendorMaster.invoiceCount / lastInvoiceDate**: Incremented during compliance enrichment but never decremented on invoice deletion. Over time, counts will inflate for tenants that delete failed invoices.
2. **VendorGlMapping.glCodeName / VendorCostCenterMapping.costCenterName**: Copied from master records. A rename in GlCodeMaster or CostCenterMaster won't propagate. Recommend either removing the denormalized name or adding a sync mechanism.
3. **BankStatement.matchedCount/suggestedCount/unmatchedCount**: Set once on reconciliation. Manual match/unmatch operations do not update these counts.
4. **Invoice.compliance.glCode.name**: Copied from GlCodeMaster at enrichment time.

### 3.3 Type Mismatches (Mongoose Schema vs TypeScript)

1. **GL_CODE_SOURCE enum**: TypeScript type has 5 values including `"slm-classification"`. Mongoose schema enum has only 4 (missing `"slm-classification"`). This means if the SLM classification pipeline sets `glCode.source = "slm-classification"`, Mongoose will either reject the save (strict mode) or silently strip the field.
2. **TenantComplianceConfig.tdsRates rate fields**: Named `rateIndividual`/`rateCompany`/`rateNoPan` in schema and TS interface, but consumed as BPS in `TdsCalculationService`. The `TdsRateTable` model correctly names these `rateCompanyBps`/`rateIndividualBps`/`rateNoPanBps`.
3. **InvoiceFieldProvenance**: TypeScript interface includes `blockIndices?: number[]`, `parsingConfidence?: number`, `extractionConfidence?: number` -- none of these exist in the Mongoose `extractionFieldProvenanceSchema`.

### 3.4 Missing Timestamps

All models have `{ timestamps: true }`. No gaps here.

### 3.5 Orphan Risks

1. **Invoice deletion** does not clean up:
   - `BankTransaction.matchedInvoiceId` references (confirmed: `invoiceService.ts:297` does `InvoiceModel.deleteMany` with no cascade)
   - `VendorMaster.invoiceCount` is not decremented
   - `ExportBatch` references in `Invoice.export.batchId` are not bidirectional
2. **TenantIntegration deletion** (`tenantAdminService.ts:165`) does clean up `TenantMailboxAssignment` first -- this is correct.
3. **User deletion** (role removal in `tenantAdminService.ts:201`) deletes the `TenantUserRole` but does not clean up `ViewerScope.visibleUserIds` entries referencing that user.

### 3.6 Tenant Isolation Gaps

1. **TdsRateTable**: No `tenantId` -- by design (global reference table). Acceptable.
2. **MailboxNotificationEvent**: No `tenantId`. Queries use `userId` instead. A platform-level audit query would need a join through `User.tenantId`.
3. **AuthLoginState**: No `tenantId` -- by design (pre-authentication state). Acceptable.

### 3.7 Financial Precision

- **Convention**: Integer minor units (cents/paise). Enforced in project memory.
- **Actual enforcement**: Only `Invoice.parsed.totalAmountMinor` has `Number.isInteger` validation.
- **Missing integer validation on**: All `*Minor` fields in GST breakdown (6 fields), line items (4 fields per item), compliance TDS (2 fields), compliance TCS (1 field), bank transactions (3 fields), bank account balance (1 field), TDS rate table thresholds (2 fields), TenantUserRole `approvalLimitMinor` (1 field). That is approximately 15+ field definitions lacking integer validation.
- **`lineItems[].rate` and `lineItems[].quantity`**: Stored as Number (floating-point). This is acceptable for rate/quantity which can be fractional, but could cause rounding issues in total calculations.

### 3.8 Date Handling

All date fields in Mongoose schemas use `{ type: Date }`. No string-as-date issues found in schema definitions. The `invoiceDate` and `dueDate` are properly typed as Date in both schema and TypeScript interface.

---

## 4. New Models Specification

### A. PaymentEntry (NEW)

Records payments made against invoices. Enables partial payment tracking, multi-payment reconciliation, and aging analysis.

```
Collection: paymententries
Fields:
  tenantId:             String, required, indexed
  invoiceId:            String, required, indexed  (ref: Invoice._id)
  amountMinor:          Number, required, integer-validated
  currency:             String, required, default "INR"
  paymentDate:          Date, required
  reference:            String (UTR number, cheque number, etc.)
  method:               String, enum [bank_transfer, cheque, cash, upi, neft, rtgs, other]
  bankTransactionId:    String, default null (ref: BankTransaction._id)
  status:               String, enum [created, mapped, unmapped], default "created"
  createdByUserId:      String, required
  note:                 String
  
  timestamps: true

Indexes:
  { tenantId: 1, invoiceId: 1, createdAt: -1 }
  { tenantId: 1, bankTransactionId: 1 } sparse
  { tenantId: 1, status: 1 }
  { tenantId: 1, paymentDate: 1 }

Business Rules:
  - Sum of all PaymentEntry.amountMinor for an invoiceId must not exceed
    Invoice.compliance.tds.netPayableMinor (or parsed.totalAmountMinor if no TDS)
  - Once status = "mapped" (linked to BankTransaction), amountMinor is immutable
  - "unmapped" status is set via explicit remap action
```

### B. TdsVendorLedger (NEW)

Cumulative TDS tracking per vendor per financial year. Required for annual threshold-based TDS applicability (Section 194C, etc. have annual aggregate thresholds).

```
Collection: tdsvendorledgers
Fields:
  tenantId:                    String, required
  vendorFingerprint:           String, required
  financialYear:               String, required (e.g., "2025-26")
  section:                     String, required (TDS section code)
  cumulativeInvoiceAmountMinor: Number, required, default 0, integer-validated
  cumulativeTaxableAmountMinor: Number, required, default 0, integer-validated
  thresholdMinor:              Number, required, default 0, integer-validated
  thresholdCrossedAt:          Date, default null
  totalTdsApplicableMinor:     Number, required, default 0, integer-validated
  totalTdsDeductedMinor:       Number, required, default 0, integer-validated
  invoiceCount:                Number, required, default 0
  lastUpdatedInvoiceId:        String
  
  timestamps: true

Indexes:
  { tenantId: 1, vendorFingerprint: 1, financialYear: 1, section: 1 } unique
  { tenantId: 1, financialYear: 1, thresholdCrossedAt: 1 }

Business Rules:
  - Updated atomically when an invoice is enriched with TDS
  - thresholdCrossedAt set once when cumulativeInvoiceAmountMinor >= thresholdMinor
  - Financial year derived from invoiceDate (Apr 1 boundary for India)
```

### C. VendorTallySync (extend VendorMaster rather than new collection)

See Section 5 for VendorMaster extensions. A separate collection adds join overhead for a 1:1 relationship. Better as embedded fields.

### D. BankTransactionMapping (NEW)

Normalizes the many-to-many relationship between bank transactions, invoices, and payments.

```
Collection: banktransactionmappings
Fields:
  tenantId:           String, required
  bankTransactionId:  String, required (ref: BankTransaction._id)
  invoiceId:          String, required (ref: Invoice._id)
  paymentEntryId:     String, default null (ref: PaymentEntry._id)
  amountMinor:        Number, required, integer-validated
  matchConfidence:    Number, default null (0-100)
  matchMethod:        String, enum [auto, suggested, manual], required
  createdByUserId:    String
  
  timestamps: true

Indexes:
  { tenantId: 1, bankTransactionId: 1, invoiceId: 1 } unique
  { tenantId: 1, invoiceId: 1 }
  { tenantId: 1, bankTransactionId: 1 }

Business Rules:
  - Sum of amountMinor per bankTransactionId must not exceed BankTransaction.debitMinor
  - Sum of amountMinor per invoiceId must not exceed invoice net payable
  - Replaces the current inline BankTransaction.matchedInvoiceId and Invoice.compliance.reconciliation
  - Migration: existing matched pairs become single-row entries in this collection
```

### E. AuditLog (NEW)

Immutable audit trail for all financial mutations.

```
Collection: auditlogs
Fields:
  tenantId:       String, required
  entityType:     String, required, enum [invoice, payment, vendor, bank_transaction, 
                  bank_mapping, tds_override, gl_override, export, approval, config]
  entityId:       String, required
  action:         String, required (e.g., "tds_manual_override", "gl_code_changed",
                  "payment_recorded", "reconciliation_matched", "invoice_approved",
                  "invoice_exported", "field_edited")
  previousValue:  Mixed, default null
  newValue:       Mixed, default null
  userId:         String, required
  userEmail:      String
  ipAddress:      String
  timestamp:      Date, required, default Date.now
  
  timestamps: false (timestamp field is the canonical time; no updatedAt needed)

Indexes:
  { tenantId: 1, entityType: 1, entityId: 1, timestamp: -1 }
  { tenantId: 1, timestamp: -1 }
  { tenantId: 1, userId: 1, timestamp: -1 }
  { tenantId: 1, action: 1, timestamp: -1 }

Business Rules:
  - Insert-only. Never updated or deleted (immutable log).
  - Must not store sensitive data (passwords, tokens) in previousValue/newValue.
  - Should use a capped collection or TTL index for non-compliance tenants,
    but uncapped for tenants requiring audit retention (configurable per tenant).
```

---

## 5. Existing Model Extensions

### Invoice Model Extensions

```
New fields on invoiceSchema:
  paidAmountMinor:       Number, default 0, integer-validated
                         (running total of all PaymentEntry amounts for this invoice)
  remainingPayableMinor: Number, default null, integer-validated
                         (derived: netPayableMinor - paidAmountMinor; can be stored or computed)
  paymentStatus:         String, enum [unpaid, partial, paid, overpaid], default "unpaid"
  tallyVoucherNumber:    String, default null
  tallyExportedAt:       Date, default null
  tallyExportError:      String, default null

New index:
  { tenantId: 1, paymentStatus: 1, "parsed.dueDate": 1 }  -- for aging bucket queries
  { tenantId: 1, tallyExportedAt: 1 } sparse               -- for Tally sync tracking
```

Rationale: `paidAmountMinor` and `paymentStatus` are denormalized from `PaymentEntry` for query performance (aging dashboards, payment status filters). Updated atomically via `$inc` when a PaymentEntry is created.

### BankTransaction Extensions

The current `matchedInvoiceId` (single string) should be kept for backward compatibility during migration but eventually deprecated in favor of `BankTransactionMapping`.

```
New field (transitional):
  legacyMatchedInvoiceId: String, default null
  (renamed from matchedInvoiceId after migration completes)

Deprecation plan:
  - Phase 1: Add BankTransactionMapping collection, write to both
  - Phase 2: Migrate all existing matchedInvoiceId values to BankTransactionMapping rows
  - Phase 3: Remove matchedInvoiceId from schema, update ReconciliationService to use mapping collection
```

### VendorMaster Extensions

```
New fields:
  tallySyncStatus:    String, enum [not_synced, synced_from_tally, pending_tally_create, 
                      created_in_tally], default "not_synced"
  tallyLedgerName:    String, default null
  tallyLastSyncedAt:  Date, default null
  tallyGstin:         String, default null
  tallyLedgerGroup:   String, default null  (Tally ledger group for accounting)

New index:
  { tenantId: 1, tallySyncStatus: 1 }
```

### TenantExportConfig Extensions

```
New fields:
  tallyAutoSyncEnabled:     Boolean, default false
  tallyAutoSyncIntervalMin: Number, default null
  tallyLastSyncedAt:        Date, default null
  tallyConnectionStatus:    String, enum [disconnected, connected, error], default "disconnected"
  tallyEndpointUrl:         String, default null
  tallyPort:                Number, default 9000
```

---

## 6. Index Strategy

### New Indexes for Existing Models

| Model | Index | Purpose |
|-------|-------|---------|
| Invoice | `{ tenantId: 1, contentHash: 1 } sparse` | Duplicate detection aggregation |
| Invoice | `{ tenantId: 1, "compliance.tds.source": 1 }` | Compliance analytics TDS override rate |
| Invoice | `{ tenantId: 1, paymentStatus: 1, "parsed.dueDate": 1 }` | Aging bucket queries |
| Invoice | `{ tenantId: 1, "parsed.invoiceNumber": 1, "parsed.vendorName": 1 }` | Duplicate invoice detection |
| BankAccount | `{ tenantId: 1, status: 1 }` | Active account filtering |
| MailboxNotificationEvent | Add `tenantId` field + `{ tenantId: 1, ... }` compound | Tenant isolation |

### Indexes for New Models

Already specified in Section 4 above. Key highlights:
- `PaymentEntry`: 4 indexes focused on invoice lookup, bank mapping, and date-range queries
- `TdsVendorLedger`: Compound unique on (tenant, vendor, FY, section) + threshold tracking
- `BankTransactionMapping`: Bidirectional lookup (by transaction and by invoice)
- `AuditLog`: 4 indexes for entity history, timeline, user activity, and action-type filtering

---

## 7. Migration Plan

### Phase 1: Schema Fixes (Non-Breaking, Deploy First)

**Order**: These can be deployed to production immediately with zero downtime.

1. **Fix GL_CODE_SOURCE enum** in `Invoice.ts` schema: Add `"slm-classification"` to the `compliance.glCode.source` enum array. No data migration needed -- existing documents without this value are unaffected; new documents can now use it.

2. **Add integer validation** to all `*Minor` fields across all models. This is a validation-only change (no data migration). Existing floating-point values in the DB will fail on next update; run a one-time fixup script: `db.invoices.updateMany({"parsed.gst.cgstMinor": {$not: {$mod: [1, 0]}}}, [{$set: {"parsed.gst.cgstMinor": {$round: ["$parsed.gst.cgstMinor", 0]}}}])` (and similarly for all other Minor fields).

3. **Add missing indexes** listed in Section 6. Use `background: true` for all index builds on production.

4. **Rename TenantComplianceConfig.tdsRates fields** to include `Bps` suffix (`rateIndividualBps`, `rateCompanyBps`, `rateNoPanBps`) with a migration script that renames the embedded array fields. Update `TdsCalculationService` and the compliance config API simultaneously.

### Phase 2: New Models (Non-Breaking, Additive)

**Order**: These add new collections with no impact on existing functionality.

5. **Create AuditLog model**. Begin writing audit entries for all financial mutations. No reads depend on this yet -- purely additive.

6. **Create TdsVendorLedger model**. Seed with historical data by aggregating existing invoices per vendor per FY. Run as a background migration job.

7. **Create PaymentEntry model**. No existing payment data to migrate (feature is new).

8. **Create BankTransactionMapping model**. Migrate existing `BankTransaction.matchedInvoiceId` values: for each matched transaction, create a corresponding `BankTransactionMapping` row.

### Phase 3: Invoice Schema Extensions (Backward-Compatible Additions)

9. **Add payment fields** to Invoice: `paidAmountMinor`, `remainingPayableMinor`, `paymentStatus`, Tally fields. All default to null/0/"unpaid" -- existing documents unaffected.

10. **Add Tally sync fields** to VendorMaster. All default to null/"not_synced".

11. **Add Tally config fields** to TenantExportConfig. All optional with defaults.

### Phase 4: Reconciliation Cutover (Breaking Change, Feature-Flagged)

12. **Update ReconciliationService** to write to `BankTransactionMapping` instead of `BankTransaction.matchedInvoiceId` and `Invoice.compliance.reconciliation`. Feature-flag the new path. Run both paths in parallel during transition.

13. **Deprecate inline reconciliation fields**: Once all tenants are migrated, remove `BankTransaction.matchedInvoiceId` and `Invoice.compliance.reconciliation`. This is the only breaking schema change.

### Phase 5: Cleanup

14. **Remove dead User fields**: `passwordHash`, `tempPassword`, `mustChangePassword`, `emailVerified`, `verificationTokenHash`. Requires updating `platformAdminService.ts` to stop writing these (Keycloak handles all auth). Run `db.users.updateMany({}, {$unset: {passwordHash: "", tempPassword: "", mustChangePassword: "", emailVerified: "", verificationTokenHash: ""}})`.

15. **Remove legacy Invoice fields**: `riskFlags`, `riskMessages` (superseded by `compliance.riskSignals`).

16. **Fix TenantInvite role enum**: Expand from `["ap_clerk"]` to include all `TenantAssignableRoles`.

---

## 8. Entity Relationship Summary

```
                                  PLATFORM
                                     |
                        +------------+------------+
                        |                         |
                     Tenant                  TdsRateTable (global)
                        |                    TdsSectionMapping (global/tenant)
            +-----------+-----------+
            |           |           |
         User    TenantUserRole  TenantInvite
            |           |
      ViewerScope  (capabilities)
            |
    MailboxNotif.Event

Tenant --1:1-- TenantComplianceConfig
       --1:1-- TenantExportConfig
       --1:1-- TenantTcsConfig
       --1:1-- ApprovalWorkflow

Tenant --1:N-- Invoice
                  |-- parsed (embedded)
                  |-- extraction (embedded)
                  |-- compliance (embedded)
                  |     |-- reconciliation -> BankTransaction (string ref)
                  |     |-- riskSignals[] (embedded)
                  |-- approval (embedded)
                  |-- workflowState (embedded) -> ApprovalWorkflow (string ref)
                  |-- export (embedded) -> ExportBatch (string ref)
                  |
                  +--[NEW]-- PaymentEntry --[NEW]--> BankTransactionMapping
                  |
               VendorMaster (via vendorFingerprint)
                  |-- bankHistory[] (embedded)
                  |-- msme (embedded)
                  |-- [NEW] tallySyncStatus
                  |
                  +-- VendorGlMapping --> GlCodeMaster
                  +-- VendorCostCenterMapping --> CostCenterMaster

Tenant --1:N-- BankAccount
       --1:N-- BankStatement --1:N-- BankTransaction
                                        |-- matchedInvoiceId -> Invoice [DEPRECATED]
                                        +--[NEW]--> BankTransactionMapping

Tenant --1:N-- TenantIntegration --1:N-- TenantMailboxAssignment
       --1:N-- ExportBatch
       --1:N-- ExtractionMapping
       --1:N-- ExtractionLearning (TTL 90d)
       --1:N-- VendorTemplate
       --1:N-- Checkpoint

[NEW] TdsVendorLedger (tenantId + vendorFingerprint + FY + section)
[NEW] AuditLog (tenantId + entityType + entityId, immutable)

Auth (ephemeral):
  AuthLoginState (TTL)
  OAuthState (TTL)
```

---

### Critical Files for Implementation

- `/Users/abhimanyusingh/IdeaProjects/Invoice Processor/backend/src/models/invoice/Invoice.ts` - Central model requiring enum fix, integer validation, new payment/Tally fields, and the most complex migration
- `/Users/abhimanyusingh/IdeaProjects/Invoice Processor/backend/src/services/bank/ReconciliationService.ts` - Must be refactored to use BankTransactionMapping instead of inline matchedInvoiceId; core of the reconciliation redesign
- `/Users/abhimanyusingh/IdeaProjects/Invoice Processor/backend/src/models/compliance/VendorMaster.ts` - Needs Tally sync fields extension and is central to the TdsVendorLedger aggregation
- `/Users/abhimanyusingh/IdeaProjects/Invoice Processor/backend/src/services/compliance/TdsCalculationService.ts` - Must integrate with TdsVendorLedger for cumulative threshold tracking; contains the BPS unit ambiguity that needs resolution
- `/Users/abhimanyusingh/IdeaProjects/Invoice Processor/backend/src/models/integration/TenantComplianceConfig.ts` - TDS rate field renaming (BPS suffix), reconciliation threshold config, and the widest config model requiring careful migration