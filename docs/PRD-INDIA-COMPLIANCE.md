# Product Requirements Document: India Compliance Intelligence Layer

> Last updated: 2026-03-30

---

## 1. Overview

### The Problem

**Source: competitive gap analysis against Cashflo Flo AI Accountant, not collected from customer interviews.** This must be validated through Gate G7. The gaps below are our best hypothesis of what Indian AP teams need beyond extraction and export. They have not been verified through timed observation or direct interviews.

BillForge extracts invoice data and exports it to Tally. But between extraction and export, there is a compliance gap. An Indian AP clerk doesn't just type values into Tally — she must:

1. **Look up the TDS section** applicable to this vendor and this service type. Is it 194C (contractors)? 194J (professionals)? She checks the vendor's PAN, cross-references the service description, picks the right section, calculates the deduction, and enters the net payable. She does this for every invoice.

2. **Validate the vendor's PAN and GSTIN** before booking. A struck-off PAN means the payment is to a non-existent entity. A mismatched GSTIN means the input tax credit will be denied during audit. She checks the government portal manually.

3. **Pick the right GL code** from a chart of accounts with 200+ entries. "Office Supplies" vs "Computer Consumables" vs "Stationery" — she guesses based on the vendor name and invoice description. Different clerks code the same vendor differently. Month-end rework fixes the inconsistencies.

4. **Watch for vendor bank account changes.** A vendor who has been paid to HDFC for two years suddenly submits an invoice with an ICICI account number. Is it legitimate? Or is the email compromised? She has no systematic way to flag this.

The bottleneck here is not extraction — BillForge already solves that. The bottleneck is **compliance intelligence**: the judgment calls that happen after extraction and before booking.

### Why This Matters Now

Cashflo's Flo AI Accountant offers 30+ risk signal scanning, automatic GL coding, TDS/TCS calculation, PAN validation, MSME classification, IRN e-invoice compliance, and vendor bank change detection. These are not nice-to-haves for the Indian market — they are the table stakes that separate "invoice OCR tool" from "AP automation platform."

BillForge's current differentiation (source-verified review, extraction learning, Tally export) remains strong. But without the compliance layer, we compete on extraction accuracy alone. With it, we compete on **end-to-end AP automation** — from inbox to Tally with compliance checks baked in.

### What We Don't Yet Know

Four things must be validated before these features become roadmap commitments:

1. **TDS section applicability.** We believe automated TDS section detection from vendor PAN + service description covers 80%+ of cases. This must be confirmed with the first adopter's CA — edge cases (lower deduction certificates, threshold exemptions) may require manual override.

2. **GL coding accuracy.** We believe historical invoice-to-GL mapping can achieve 95%+ accuracy after 60 days of training data. This must be confirmed with production telemetry from the first tenant.

3. **PAN validation API availability.** Government PAN verification APIs have rate limits, downtime, and access requirements. The feasibility of real-time validation during ingestion must be confirmed.

4. **Vendor bank change frequency.** We believe bank account changes are rare (< 2% of invoices) and that flagging them adds value without creating alert fatigue. This must be confirmed with the first adopter's payment history.

---

## 2. Target Users

### Who Benefits

| Who | What Changes for Them | Current Pain |
|-----|----------------------|--------------|
| **AP Clerk (MEMBER)** | Sees TDS section and GL code pre-filled. Sees risk flags for PAN issues, bank changes. Confirms or overrides. | Manually looks up TDS sections, picks GL codes from memory, has no systematic fraud detection. |
| **Firm Admin (TENANT_ADMIN)** | Configures GL code master, TDS defaults, compliance rules. Views compliance dashboard. | Spends month-end fixing GL miscoding and TDS errors across team. |
| **CA / Auditor (VIEWER)** | Sees compliance status per invoice. Audit trail includes TDS, PAN, and GSTIN validation results. | Manually verifies compliance during periodic audits. |

### What This Doesn't Change

The core review flow is unchanged. Source-verified review, extraction learning, and Tally export work exactly as they do today. The compliance layer adds pre-filled suggestions and risk flags — the reviewer still decides. **Compliance intelligence assists; it never auto-books.**

---

## 3. Core Features

### Phase 1: India Compliance Core (m21)

#### 3.1 TDS/TCS Calculation Engine

**The need:** "I spend 30 seconds per invoice just figuring out which TDS section applies and calculating the deduction."

**The solution:** Based on the vendor's PAN category (company, individual, HUF) and the invoice's service/expense type, BillForge suggests the applicable TDS section, rate, and deducted amount. The reviewer confirms or overrides.

**How it works:**
1. Extract vendor PAN from invoice (new SLM field) or look up from vendor master
2. Determine PAN category from 4th character (C=company, P=individual, H=HUF, F=firm)
3. Match expense type (from GL code or invoice description) to TDS section
4. Apply rate based on section + PAN category + threshold
5. Calculate: TDS amount = taxable amount × applicable rate
6. Display in review panel: section, rate, amount, net payable
7. Store in invoice model for Tally export

**TDS sections in scope (first adopter):**
| Section | Description | Rate (Company) | Rate (Individual) |
|---------|-------------|----------------|-------------------|
| 194C | Contractors | 2% | 1% |
| 194J | Professional/Technical | 10% | 10% |
| 194H | Commission/Brokerage | 5% | 5% |
| 194I(a) | Rent (Plant/Machinery) | 2% | 2% |
| 194I(b) | Rent (Land/Building) | 10% | 10% |
| 194Q | Purchase of Goods | 0.1% | 0.1% |

**What the reviewer sees:** A "TDS" section in the detail panel showing suggested section, rate, calculated amount, and net payable. Green if high confidence. Yellow if ambiguous (multiple sections could apply). Override dropdown to change section manually. Override feeds the learning store for future invoices from that vendor.

**Constraints:**
- Threshold exemptions (e.g., 194C applies only above ₹30,000 single / ₹1,00,000 annual) require cumulative vendor payment tracking — Phase 2
- Lower deduction certificates require manual upload and vendor-level override — Phase 2
- TCS (Tax Collected at Source) is seller-side; relevance to AP is limited. Include only 206C(1H) for purchase of goods above ₹50L — Phase 2

#### 3.2 PAN Extraction and Validation

**The need:** "I need to verify the vendor's PAN before booking. A wrong PAN means TDS credit is denied."

**The solution:** Extract PAN from the invoice, validate format, cross-reference with GSTIN (characters 3-12 of the 15-character GSTIN encode the vendor's PAN: `{2-digit state code}{PAN}{entity code}{Z}{checksum}`), and flag mismatches.

**Validation levels:**
| Level | Check | Implementation |
|-------|-------|---------------|
| L1 — Format | PAN matches `[A-Z]{5}[0-9]{4}[A-Z]` | Regex, deterministic |
| L2 — GSTIN cross-reference | PAN matches chars 3-12 of GSTIN | Deterministic comparison |
| L3 — Government verification | PAN is active and not struck off | External API (Phase 2) |

**Phase 1 delivers L1 and L2.** L3 requires government API integration and is scoped for Phase 2 after API feasibility is confirmed.

**Risk flags generated:**
- `PAN_FORMAT_INVALID` — PAN doesn't match expected pattern
- `PAN_GSTIN_MISMATCH` — PAN extracted from invoice doesn't match PAN embedded in GSTIN
- `PAN_MISSING` — No PAN found on invoice (warning, not error — not all invoices carry PAN)
- `GSTIN_FORMAT_INVALID` — GSTIN doesn't match the 15-character pattern `[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z][Z][0-9A-Z]` (includes checksum position validation)

#### 3.3 Automatic GL Code Suggestion

**The need:** "Five clerks code the same vendor five different ways. Month-end is a reconciliation nightmare."

**The solution:** BillForge suggests a GL code based on (1) the vendor's historical GL assignments, (2) the invoice description/line items, and (3) tenant-configured default mappings. The suggestion is pre-filled; the reviewer confirms or changes.

**How it works:**
1. Tenant admin uploads or configures a GL code master (code, name, category, TDS section linkage)
2. On each invoice, the system checks: vendor-specific default → description-based match → category default → no suggestion
3. Suggestion shown with confidence: "Office Supplies (GL 5010) — based on 12 prior invoices from this vendor"
4. Reviewer confirms or overrides. Override updates the vendor-GL mapping for future invoices.
5. Confirmed GL code included in Tally export XML

**Learning model:** Simple frequency-based, not ML. Vendor V has been coded to GL 5010 in 12 of 14 invoices → suggest GL 5010 with 86% confidence. If the last 3 overrides all went to GL 5020, switch suggestion. This is deliberately simple — the value is consistency, not intelligence. Upgrade to ML-based classification in Phase 3 if frequency-based proves insufficient.

**Data model:**
- `GlCodeMaster`: tenant-scoped chart of accounts (code, name, category, linkedTdsSection, isActive)
- `VendorGlMapping`: tenant + vendor fingerprint → GL code + usage count + last used
- Invoice model extended: `glCode`, `glCodeConfidence`, `glCodeSource` (vendor-default | description-match | manual)

#### 3.4 Enhanced Tally Export with TDS and GL

**The need:** "Even after I figure out TDS and GL codes, I have to manually enter them in Tally. That's where errors creep in."

**The solution:** Tally XML export includes TDS ledger entries and GL code mapping. The exported voucher is ready to import — no manual re-entry of compliance data.

**Export additions:**
- TDS ledger entry with section, rate, and amount (configurable ledger name: `TALLY_TDS_LEDGER`)
- GL code in voucher narration or mapped to Tally ledger name
- Net payable amount (total - TDS) as the party ledger amount

---

### Phase 2: Fraud and Risk Intelligence (m22)

#### 3.5 Vendor Bank Account Change Detection

**The need:** "A vendor who always paid to HDFC suddenly has an ICICI account. Is this legitimate or is the email compromised?"

**The solution:** Store vendor bank details from each invoice. When bank details change from the historical pattern, flag the invoice with a risk signal.

**How it works:**
1. Extract bank account number and IFSC from invoice (new SLM fields)
2. Store per-vendor bank detail history (account number hash, IFSC, bank name, first seen, last seen)
3. On new invoice: compare against history. If different → `VENDOR_BANK_CHANGED` risk flag
4. Risk flag reduces confidence score and surfaces in review panel
5. Reviewer can mark as "verified change" to update the vendor's expected bank details

**Privacy:** Bank account numbers stored as SHA-256 hash, not plaintext. Comparison is hash-to-hash. Display shows masked format (last 4 digits only).

#### 3.6 IRN / E-Invoice Validation

**The need:** "Under GST e-invoicing rules, invoices above ₹5 crore must carry a valid IRN. I have to check this manually."

**The solution:** Extract IRN (Invoice Reference Number) and QR code data from the invoice. Validate format. Flag invoices that should have an IRN but don't.

**Validation:**
- IRN format: 64-character hex string
- IRN presence check: if vendor GSTIN indicates turnover > ₹5Cr threshold, IRN should be present
- QR code data extraction (if present): validate signed JSON contains matching invoice number and date

**Risk flags:**
- `IRN_MISSING` — Invoice from a vendor that should have e-invoicing, but no IRN found
- `IRN_FORMAT_INVALID` — IRN present but doesn't match expected format

#### 3.7 MSME Classification and Payment Priority

**The need:** "MSME Act requires payment within 45 days. I don't even know which of my vendors are MSMEs."

**The solution:** Track vendor MSME registration status. Flag invoices from MSME vendors that are approaching the 45-day payment deadline.

**How it works:**
1. Extract MSME registration number (Udyam number: `UDYAM-XX-00-0000000`) from invoice
2. Store in vendor master with classification (micro/small/medium)
3. On invoice review: if vendor is MSME and invoice date > 30 days ago, show `MSME_PAYMENT_DUE_SOON` warning
4. If > 45 days, show `MSME_PAYMENT_OVERDUE` risk flag
5. Dashboard widget: "MSME invoices approaching deadline"

#### 3.8 Suspicious Email Sender Detection

**The need:** "I have no way to know if the email that delivered this invoice is legitimate."

**The solution:** Compare the sender email domain against the vendor's known email patterns. Flag first-time senders and domain mismatches.

**Risk flags:**
- `SENDER_DOMAIN_MISMATCH` — Invoice claims to be from Vendor X, but email came from a different domain
- `SENDER_FIRST_TIME` — First invoice received from this email address (informational, not blocking)
- `SENDER_FREEMAIL` — Invoice from a free email provider (gmail.com, yahoo.com) for a vendor that previously used a corporate domain

**Implementation:** Email metadata already captured during Gmail ingestion. Add sender domain tracking per vendor. Compare on each new invoice.

#### 3.9 Expanded Risk Signal Framework

**Current state:** 2 risk signals (`TOTAL_AMOUNT_ABOVE_EXPECTED`, `DUE_DATE_TOO_FAR`)

**Phase 2 target:** 15+ risk signals organized by category:

| Category | Signals |
|----------|---------|
| **Financial** | Amount above expected, Amount below minimum (possible partial), Unusual currency |
| **Compliance** | PAN format invalid, PAN-GSTIN mismatch, IRN missing, IRN format invalid, MSME payment due, MSME overdue |
| **Fraud** | Vendor bank changed, Sender domain mismatch, Sender first-time, Sender freemail, Duplicate invoice number (same vendor, different content) |
| **Data Quality** | Due date too far, Invoice date too old, Missing mandatory fields, GSTIN format invalid |

Each signal carries a severity (info/warning/critical), a confidence penalty (0-15 points), and a human-readable explanation displayed in the review panel.

#### 3.9a Duplicate Invoice Number Detection

**The need:** "A vendor submits INV-001 for ₹50,000 and later submits INV-001 again for ₹75,000. Our content-hash dedup won't catch this because the documents are different."

**The solution:** Track invoice numbers per vendor. When a new invoice has the same invoice number as a previously processed invoice from the same vendor but a different content hash, flag it as `DUPLICATE_INVOICE_NUMBER` (critical fraud signal).

**How it works:**
1. On each parsed invoice, look up vendor master for prior invoices with the same invoice number
2. If match found AND content hash differs → `DUPLICATE_INVOICE_NUMBER` risk signal
3. If match found AND content hash matches → existing dedup handles this (skip)
4. Display in review panel: "This vendor previously submitted invoice {number} on {date} for {amount}. Current submission has different content."

**Distinction from content-hash dedup:** Content-hash dedup (existing) catches exact file re-uploads. Invoice number dedup catches resubmissions with altered amounts — a common vendor fraud vector.

#### 3.9b Compliance Reports

**The need:** "During audit, the CA asks for a TDS deduction summary for the quarter. I manually compile it from Tally entries."

**The solution:** Generate downloadable compliance reports from BillForge data:

| Report | Contents | Frequency |
|--------|----------|-----------|
| TDS Deduction Summary | Vendor-wise TDS deductions by section, rate, and amount for a date range | Monthly/Quarterly |
| GST Reconciliation | Invoice-wise GSTIN, GST amounts (CGST/SGST/IGST/Cess), PAN cross-ref status | Monthly |
| Vendor Compliance Health | Vendors missing PAN, vendors with bank changes, MSME payment status | On-demand |
| Risk Signal Audit Log | All risk signals raised, reviewer action taken, resolution timestamps | On-demand |

**Export formats:** PDF and CSV. PDF for CA presentation, CSV for further analysis.

**Access:** TENANT_ADMIN and VIEWER roles. Reports respect VIEWER scope restrictions.

---

### Phase 3: Automation and Multi-ERP (m23)

#### 3.10 Cost Center Allocation

**The need:** "Every invoice needs a cost center. We have 40 cost centers and the clerks pick randomly."

**The solution:** Tenant admin configures cost center master. System suggests cost center based on vendor, GL code, and invoice description. Same learning model as GL codes — frequency-based with override feedback.

**Data model:**
- `CostCenterMaster`: tenant-scoped (code, name, department, isActive)
- `VendorCostCenterMapping`: tenant + vendor fingerprint → cost center + usage count
- Invoice model extended: `costCenter`, `costCenterConfidence`, `costCenterSource`

#### 3.11 Automated Vendor Communication

**The need:** "When an invoice fails validation, I manually email the vendor to request a revision. This takes 4-6 hours a day across all vendors."

**The solution:** Configurable email templates triggered by specific validation failures. The system drafts the email; the reviewer approves sending.

**Templates:**
| Trigger | Template | Action |
|---------|----------|--------|
| PAN missing | "Please provide PAN on your invoices" | Auto-draft, reviewer approves send |
| IRN missing | "E-invoice IRN required per GST rules" | Auto-draft, reviewer approves send |
| Bank details changed | "Please confirm your updated bank details" | Auto-draft, reviewer approves send |
| GSTIN invalid | "GSTIN on invoice does not match records" | Auto-draft, reviewer approves send |

**Constraints:**
- Never auto-sends. Always requires reviewer approval. Same principle as "system never auto-approves."
- Email sent from tenant's connected Gmail (reuse existing OAuth connection)
- Vendor response tracking is out of scope for Phase 3

#### 3.12 Multi-ERP Export Adapters

**The need:** "Not everyone uses Tally. The second adopter might use SAP or Zoho Books."

**The solution:** Extend `AccountingExporter` interface with additional adapters.

**Phase 3 scope:**
| Adapter | Format | Priority |
|---------|--------|----------|
| Tally XML | Purchase voucher XML (existing) | Live |
| Generic CSV | Configurable column mapping | Phase 3 |
| Zoho Books | API integration | Phase 3 (if adopter validated) |
| SAP IDoc | IDoc XML format | Phase 3 (if adopter validated) |

**Constraint:** Only build adapters for which we have a validated adopter. Generic CSV is the safety net — any ERP can import CSV. SAP and Zoho are built only if a specific customer requests them.

---

## 4. Requirements

### New Differentiators

| ID | Requirement | Why | Phase |
|----|-------------|-----|-------|
| D-5 | TDS section auto-detection with PAN-based rate lookup | Eliminates the most time-consuming compliance step in Indian AP | Phase 1 |
| D-6 | GL code suggestion with vendor-level learning | Consistency across team; reduces month-end rework by 70% | Phase 1 |
| D-7 | 15+ risk signals with categorized severity | Moves from "extraction tool" to "compliance platform" | Phase 2 |
| D-8 | Vendor bank change detection | Fraud prevention — a feature competitors highlight prominently | Phase 2 |

### New Table Stakes (India Market)

| ID | Requirement | Phase |
|----|-------------|-------|
| TS-8 | PAN extraction and format validation | Phase 1 |
| TS-9 | PAN-GSTIN cross-reference validation | Phase 1 |
| TS-10 | TDS amount in Tally export | Phase 1 |
| TS-11 | GL code in Tally export | Phase 1 |
| TS-12 | IRN extraction and format validation | Phase 2 |
| TS-13 | MSME vendor tracking and payment deadline alerts | Phase 2 |
| TS-14 | Cost center allocation | Phase 3 |
| TS-15 | GSTIN format validation (15-char pattern with checksum) | Phase 1 |
| TS-16 | Duplicate invoice number detection (same vendor, different content) | Phase 2 |
| TS-17 | Compliance reports (TDS summary, GST reconciliation, vendor health) | Phase 2 |

---

## 5. Success Metrics

### Primary Signal

**Compliance accuracy rate per tenant** — percentage of invoices where the system-suggested TDS section, GL code, and cost center were accepted without override. Target: 90% after 60 days of tenant-specific training data.

**Risk signal precision** — percentage of risk flags that led to actual reviewer action (correction, rejection, vendor contact). A flag that is always dismissed is noise, not signal. Target: > 60% action rate across all signal types.

### Leading Indicators

| Metric | Target | Phase |
|--------|--------|-------|
| TDS section suggestion accuracy | > 85% after 30 days | Phase 1 |
| GL code suggestion accuracy | > 90% after 60 days | Phase 1 |
| PAN validation coverage | > 95% of GST invoices have PAN extracted | Phase 1 |
| Risk signal action rate | > 60% flags lead to reviewer action | Phase 2 |
| Vendor bank change detection rate | > 99% of changes flagged | Phase 2 |
| Month-end GL rework reduction | > 50% compared to pre-BillForge | Phase 1 |
| Ingestion throughput | > 1,000 invoices/hour sustained | Phase 1 |
| Compliance enrichment latency | < 50ms per invoice (Phase 1), < 500ms (Phase 2 with APIs) | Phase 1/2 |
| Duplicate invoice number detection rate | > 95% of resubmissions flagged | Phase 2 |

---

## 6. Pre-Launch Validation Gates

| Gate | Action | Owner | Blocks | Phase |
|------|--------|-------|--------|-------|
| **G7** | Interview first adopter's CA: walk through their TDS workflow for 5 real invoices. Which sections do they use most? How do they determine applicability? What are the edge cases? | Product + CA | TDS engine design finalization | Phase 1 |
| **G8** | Export a Tally XML file with TDS entries. Have the first adopter's accountant import it into Tally and verify the voucher renders correctly with TDS deduction. | Engineering + CA | TDS export go-live | Phase 1 |
| **G9** | Collect 100 invoices from the first adopter. Manually label PAN, GL code, and TDS section. Run the system on the same invoices. Measure accuracy. | Engineering | Accuracy claims | Phase 1 |
| **G10** | Interview first adopter's payment team: how often do vendor bank details change? How do they currently detect fraudulent changes? | Product | Bank change detection priority | Phase 2 |
| **G11** | Name a specific second adopter who uses SAP or Zoho Books. If none: build Generic CSV only. | Product | Multi-ERP adapter investment | Phase 3 |

---

## 7. Open Questions

| Question | Owner | Status | Phase |
|----------|-------|--------|-------|
| TDS threshold tracking — cumulative or per-invoice? | Product + CA | Gate G7 will inform | Phase 1 |
| Lower deduction certificate workflow? | Product + CA | Gate G7 will inform | Phase 2 |
| Government PAN verification API access and rate limits? | Engineering | Research needed | Phase 2 |
| IRN verification against GST portal — feasible? | Engineering | Research needed | Phase 2 |
| MSME Udyam verification API availability? | Engineering | Research needed | Phase 2 |
| Vendor communication — email from tenant Gmail or platform sender? | Product | Decision needed before Phase 3 | Phase 3 |

---

## 8. Out of Scope

| Item | Risk Level | Watch For | Phase Candidate |
|------|-----------|-----------|-----------------|
| TCS (beyond 206C(1H)) | Low — seller-side tax | Buyer-side TCS obligations under new provisions | Future |
| Advance reconciliation | Medium — valuable for large AP teams | Customer request for vendor advance tracking | Future |
| Debit note matching | Medium — tied to credit note workflow | Customer request for debit-credit reconciliation | Future |
| Payment execution | High — requires banking integration | Scope creep from "suggest TDS" to "execute payment" | Never (different product) |
| RBI compliance reporting | Low — regulatory, not AP workflow | Regulatory changes affecting AP automation | Future |
| SAP BAPI/OData real-time integration | Low — batch export sufficient for target segment | Enterprise adopter with real-time ERP sync requirement | Future |

---

## 9. Phasing Summary

| Phase | Milestone | Features | Dependency |
|-------|-----------|----------|------------|
| **Phase 1 (m21)** | India Compliance Core | TDS/TCS engine, PAN extraction + L1/L2 validation, GL code suggestion + learning, Enhanced Tally export | Gate G7, G8, G9 |
| **Phase 2 (m22)** | Fraud & Risk Intelligence | Vendor bank change detection, IRN validation, MSME tracking, Suspicious email detection, Expanded risk framework (15+ signals) | Gate G10, Phase 1 complete |
| **Phase 3 (m23)** | Automation & Multi-ERP | Cost center allocation, Vendor communication templates, Generic CSV export, Zoho/SAP adapters (if validated) | Gate G11, Phase 2 complete |

---

## 10. Competitive Position After Implementation

| Capability | Cashflo | BillForge (Current) | BillForge (After Phase 3) |
|-----------|---------|--------------------|-----------------------------|
| Invoice OCR/Extraction | Standard | **Superior** (source-verified review, extraction learning) | **Superior** |
| TDS/TCS Calculation | Yes | No | **Yes** |
| PAN Validation | Yes (incl. struck-off) | No | **Yes** (L1+L2 Phase 1, L3 Phase 2) |
| GL Code Auto-Assignment | Yes (99.8% claimed) | No | **Yes** (frequency + learning) |
| Risk Signals | 30+ | 2 | **15+** |
| Vendor Bank Change Alert | Yes | No | **Yes** |
| IRN/E-Invoice Validation | Yes | No | **Yes** |
| MSME Classification | Yes | No | **Yes** |
| Cost Center Allocation | Yes | No | **Yes** |
| Vendor Communication | Yes (automated) | No | **Yes** (reviewer-approved) |
| ERP Integration | SAP, Dynamics, any | Tally only | **Tally + CSV + validated adapters** |
| Source-Verified Review | No | **Yes** (unique differentiator) | **Yes** |
| Extraction Learning | No | **Yes** (unique differentiator) | **Yes** |
| Approval Workflows | Unknown | **Yes** (simple + advanced) | **Yes** |
| Multi-Tenant SaaS | Unknown | **Yes** | **Yes** |

**Net position:** After Phase 3, BillForge matches Cashflo on India compliance features while maintaining two unique differentiators (source-verified review, extraction learning) that Cashflo does not offer.
