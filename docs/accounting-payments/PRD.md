# LedgerBuddy PRD: Accounting, Payments & Tally Integration

**Version**: 1.1
**Date**: 2026-04-16
**Status**: Draft
**Authors**: Product Management, LedgerBuddy
**VKL Version**: Final (44 decisions, 20 constraints, 6 resolved conflicts)
**EIL Entries**: 32 evidence items
**OAR Items**: 15 open questions
**Input Documents**: [MASTER-SYNTHESIS.md](./MASTER-SYNTHESIS.md), [PRD-REFINED.md](./input/PRD-REFINED.md), [TALLY-INTEGRATION-AUDIT.md](./input/TALLY-INTEGRATION-AUDIT.md), [UX-AUDIT-REPORT.md](./input/UX-AUDIT-REPORT.md), [DATA-MODEL-AUDIT.md](./input/DATA-MODEL-AUDIT.md)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
   - 1.1 [The Problem](#11-the-problem)
   - 1.2 [The Solution](#12-the-solution)
2. [Market Context & Competitive Landscape](#2-market-context--competitive-landscape)
   - 2.1 [Indian AP Automation Market (incl. TAM/SAM/SOM)](#21-indian-ap-automation-market)
   - 2.2 [Competitor Analysis (incl. Suvit, Refrens)](#22-competitor-analysis)
   - 2.3 [LedgerBuddy Differentiators](#23-ledgerbuddy-differentiators)
   - 2.4 [Competitive Moat](#24-competitive-moat)
   - 2.5 [What Indian Accountants Need](#25-what-indian-accountants-need-that-competitors-do-not-offer-well)
3. [User Personas](#3-user-personas)
4. [Feature Requirements](#4-feature-requirements)
   - 4.1 [TDS Cumulative Threshold](#41-tds-cumulative-threshold)
   - 4.2 [TDS Rate Hierarchy](#42-tds-rate-hierarchy)
   - 4.3 [TDS Reporting & Dashboard](#43-tds-reporting--dashboard)
   - 4.4 [Payment Recording (incl. Payment Journey Map)](#44-payment-recording)
   - 4.5 [Payment Methods & Banking](#45-payment-methods--banking)
   - 4.6 [Payment Approval & Runs](#46-payment-approval--runs)
   - 4.7 [Advance Payments & Reversals](#47-advance-payments--reversals)
   - 4.8 [Reconciliation Enhancement](#48-reconciliation-enhancement)
   - 4.9 [MSME Compliance](#49-msme-compliance)
   - 4.10 [Tally Purchase Voucher Fixes](#410-tally-purchase-voucher-fixes)
   - 4.11 [Tally Payment Voucher Export](#411-tally-payment-voucher-export)
   - 4.12 [Pre-Export Validation](#412-pre-export-validation)
   - 4.13 [Export History & Re-Export](#413-export-history--re-export)
   - 4.14 [Vendor Management](#414-vendor-management)
   - 4.15 [GST Compliance](#415-gst-compliance)
   - 4.16 [Audit Trail](#416-audit-trail)
   - 4.17 [Risk Signal Management](#417-risk-signal-management)
5. [Role Hierarchy & Capabilities](#5-role-hierarchy--capabilities)
6. [UX Strategy & Quick Wins](#6-ux-strategy--quick-wins)
   - 6.1 [Current UX Assessment](#61-current-ux-assessment)
   - 6.2 [Error States](#62-error-states)
   - 6.3 [UX Quick Wins](#63-ux-quick-wins-immediate-parallel-with-all-phases)
   - 6.4 [Medium-Term UX](#64-medium-term-ux-delivered-with-feature-phases)
   - 6.5 [Navigation Restructure](#65-navigation-restructure-post-mvp-major-redesign)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Implementation Phasing (incl. Resource Plan)](#8-implementation-phasing)
9. [Success Metrics](#9-success-metrics)
   - 9.1 [Go-to-Market Readiness](#91-go-to-market-readiness)
10. [Risks & Mitigations](#10-risks--mitigations)
11. [Open Questions (OAR)](#11-open-questions-oar)
12. [Out of Scope](#12-out-of-scope)
13. [Dependencies](#13-dependencies)
14. [Glossary](#14-glossary)
15. [Appendix A: Demo Script](#appendix-a-demo-script)

---

## 1. Executive Summary

LedgerBuddy is an India-specific accounts payable automation platform that ingests vendor invoices (via email, file upload, or folder scan), extracts structured data using OCR + SLM (Small Language Model), enriches each invoice with compliance data -- TDS, GST, PAN verification, MSME flags, and risk signals -- routes invoices through configurable multi-step approval workflows, and exports finalized vouchers to Tally Prime for accounting.

This PRD defines the requirements for three interconnected capabilities that bring LedgerBuddy from a competent extraction-and-approval tool into a compliance-first AP automation platform:

1. **TDS Cumulative Threshold Tracking & Rate Hierarchy** -- per-vendor, per-section annual threshold compliance per the Income Tax Act, replacing today's single-transaction-only TDS computation with a full financial-year-aware cumulative engine. Layered rate resolution incorporating Section 197 lower deduction certificates, Section 206AA no-PAN penalties, tenant-level overrides, and the standard rate table.
2. **Payment Recording & Tracking** -- recording payments against approved invoices, tracking partial/full payment status, advance payments, reversals, payment approval workflows, and generating Tally payment vouchers.
3. **Enhanced Tally Integration & Vendor Management** -- fixing existing XML export for correct bill tracking, adding payment voucher export, enabling vendor pre-validation, CRUD API for vendor master, and pre-export validation.

### 1.1 The Problem

CA and accounting firms in India face a set of interlocking challenges that grow worse with every new client added to the practice:

1. **Manual data entry at scale.** When a client sends 200 purchase invoices for quarterly GST filing, each one must be opened, read, and keyed into Tally. A single invoice may require entry of 15 or more fields: invoice number, date, vendor name, GSTIN, PAN, line items with HSN/SAC codes, individual tax rates, CGST, SGST or IGST amounts, Cess, total, bank details, and due date. Multiply that across 30 clients and a small firm is staring at thousands of manual entries every quarter.

2. **GST compliance complexity.** Determining whether to apply CGST+SGST (intra-state) or IGST (inter-state) requires knowing both the supplier and recipient GSTIN state codes. HSN/SAC classification must be correct for rate determination. A wrong split means mismatch notices from the GST portal, leading to hours of reconciliation work and potential penalties.

3. **TDS and TCS intricacy.** Each invoice may attract TDS under a different section -- 194C for contractor payments, 194J for professional fees, 194H for commission -- with different rates depending on whether the vendor is a company (PAN category "C"), an individual, or has no PAN at all (triggering the 20% penalty rate under Section 206AA). TCS adds another layer. Getting this wrong exposes your client to interest and penalty under Section 201.

4. **Error-prone verification.** Manually verifying that the PAN on an invoice matches the PAN embedded in the vendor's GSTIN is tedious but critical. A mismatch may indicate an invalid invoice. Similarly, detecting that a vendor has changed their bank account details -- a common vector for payment fraud -- is nearly impossible when processing at volume.

5. **Juggling personal and business clients.** Firms serving a mix of proprietorship, partnership, LLP, and corporate clients need different compliance workflows, different GL structures, and different approval hierarchies for each. A single shared spreadsheet cannot accommodate this.

6. **Tally export friction.** After all the verification work, the final step -- getting data into Tally -- often involves manual voucher creation or error-prone XML file generation. GST ledger entries must be split correctly, TDS payable ledgers must reference the right section, and the narration must carry enough context for audit trail.

7. **Difficulty scaling.** The direct consequence of all the above: firms cannot take on more clients without hiring proportionally more staff. A firm handling 20 clients with 4 staff members cannot handle 40 clients without 8 staff members, because the work is linear and manual.

### 1.2 The Solution

LedgerBuddy addresses each of these pain points through an integrated platform built from the ground up for Indian accounting practices:

- **AI-Powered Extraction.** Invoices enter the system through upload, email ingestion, or folder watch. OCR reads every line. An AI language model extracts structured fields -- vendor name, invoice number, date, line items with HSN/SAC, tax breakdowns, PAN, GSTIN, bank details -- and produces a confidence score for each field. The system highlights exactly where on the source document each value was found.

- **India-First Compliance Engine.** LedgerBuddy automatically splits GST into CGST/SGST or IGST based on extracted GSTIN data. It detects the applicable TDS section from GL category and PAN type, calculates the TDS amount and net payable, validates PAN format and cross-references it with GSTIN, checks for MSME payment deadlines, and flags missing e-invoice IRN for high-value transactions. Every compliance check produces a clear risk signal -- not a hidden score, but a visible, actionable finding.

- **One Client, One Workspace.** Each client is a separate tenant with its own chart of accounts, vendor master, TDS section mappings, TCS rates, approval workflows, and user access list. Data is completely isolated.

- **Role-Based Team Access.** From firm partner (full control across clients) to audit clerk (read-only access for external auditors), LedgerBuddy maps to how your firm actually operates.

- **One-Click Tally Export.** When invoices are approved, LedgerBuddy generates Tally-compatible XML with purchase vouchers that include the correct party ledger, GL-mapped purchase ledger, CGST/SGST/IGST/Cess ledger entries, and TDS payable ledger entries. Download the file and import it directly into Tally Prime.

- **Bank Statement Reconciliation.** Upload a bank statement (PDF or CSV), and LedgerBuddy automatically matches debit transactions to approved invoices based on amount, invoice number, vendor name, and date proximity. TDS and TCS adjustments are factored into the matching.

### What Exists Today

| Capability | Status | Gaps |
|---|---|---|
| Per-invoice TDS section detection via `TdsSectionMapping` | Complete | No cumulative awareness; each invoice evaluated in isolation |
| TDS rate lookup via `TdsRateTable` and `TenantComplianceConfig.tdsRates` | Complete | No Section 197 certificate support; no 206AB non-filer flag; inconsistent field names (`rateIndividual` vs `rateIndividualBps`) |
| Single-transaction threshold check | Complete | Annual threshold (`thresholdAnnualMinor`) exists on `TdsRateTable` but is never queried |
| GST exclusion from TDS base | Complete | Uses `subtotalMinor` when available; falls back to `totalAmountMinor` when GST is inclusive |
| TDS risk signals | Partial | No cumulative threshold signals, no Section 197 signal, no non-filer signal |
| TDS reporting | None | No `TdsVendorLedger` model, no TDS liability endpoint, no quarterly aggregation |
| Invoice lifecycle (PENDING to EXPORTED) | Complete | No payment tracking after export |
| GST breakdown (CGST/SGST/IGST/Cess) | Complete | No PLACEOFSUPPLY, no gstTreatment field, no ITC eligibility tracking |
| Tally Purchase Voucher XML generation | Complete but structurally flawed | LEDGERENTRIES.LIST (wrong tag), ISINVOICE=No, no BILLALLOCATIONS, no REFERENCE, no EFFECTIVEDATE, no GUID |
| Bank statement upload + 1:1 reconciliation | Complete | No split/aggregate matching, no TDS-adjusted amounts |
| Vendor master (auto-created from invoices) | Complete | No CRUD API, no tallyLedgerName, no lowerDeductionCert, no stateCode |
| Multi-step approval workflow | Complete | No payment approval workflow |
| Risk signal framework | Complete | Missing several compliance-critical signals |
| Payment model / payment recording | Does not exist | -- |
| Audit trail | Does not exist | -- |

### What This PRD Proposes

- A new `TdsVendorLedger` collection that atomically accumulates per-vendor, per-section, per-financial-year TDS data
- A modified `TdsCalculationService` that consults cumulative thresholds and applies a rate hierarchy (Section 197, 206AA, tenant override, standard)
- A complete `Payment` model with allocation tracking, advance payments, reversals, and approval workflows
- Tally XML structural fixes (Phase 0, immediate) and payment voucher export (Phase 4)
- A `VendorService` with CRUD, merge, Section 197 certificate management, and Tally sync fields
- Pre-export validation modal and export history enhancement
- GST treatment classification (regular, reverse charge, exempt, nil_rated, composition) and ITC eligibility tracking
- An immutable `AuditLog` for all financial mutations with 8-year retention
- UX quick wins and medium-term UX improvements aligned with feature phases

---

## 2. Market Context & Competitive Landscape

### 2.1 Indian AP Automation Market

India's accounts payable automation market is estimated at USD 1.2-1.5 billion (2025), growing at 18-22% CAGR, driven by three forces: (a) GST digitization creating a compliance-aware mindset, (b) MSME Act enforcement tightening payment discipline, and (c) the Income Tax Department's push toward e-TDS, faceless assessments, and automated notice generation based on 26Q discrepancies. The market is bifurcated: large enterprises use SAP/Oracle modules, while the addressable middle -- CA firms managing 10-100 clients, SMEs processing 200-5,000 invoices per month, and mid-market finance teams with 3-15 AP staff -- relies on manual data entry into Tally, spreadsheet-based TDS tracking, and periodic reconciliation firefighting.

#### Market Sizing

| Segment | Estimate | Basis |
|---|---|---|
| **TAM** (Total Addressable Market) | USD 1.2-1.5B | Full India AP automation market (2025), 18-22% CAGR |
| **SAM** (Serviceable Addressable Market) | ~USD 200M | CA firms managing multi-client AP (est. 15,000 firms with 10+ clients) + mid-market companies (5,000-50,000 invoices/year) using Tally Prime. Excludes enterprises on SAP/Oracle and micro-businesses with <100 invoices/year. |
| **SOM** (Serviceable Obtainable Market) | USD 1-2M (Year 1) | Anchored to 10 CA firm pilots converting to paid at avg. Rs 10,000-15,000/tenant/month across ~50 client tenants. Conservative 0.5-1% SAM penetration in Year 1. |

SOM rationale: India's CA firm ecosystem is relationship-driven. Initial traction comes from 2-3 early adopter firms (demo phase), expanding to 10 firms by end of Year 1 through referral and professional network effects. Each CA firm brings 3-10 client tenants, creating compounding revenue per acquisition.

### 2.2 Competitor Analysis

| Capability | LedgerBuddy | Tally Prime | Zoho Books | ClearTax | Suvit | Refrens |
|---|---|---|---|---|---|---|
| **Invoice OCR/Extraction** | AI-powered (OCR + SLM), multi-format, auto-classification | None; manual data entry only | Basic OCR, template-limited | GST invoice OCR only (filing-centric) | Excel/PDF to Tally import; template-based extraction | Basic invoice creation; no inbound extraction |
| **TDS Section Detection** | Auto-detect from vendor PAN category + GL category with confidence scoring | Manual selection per voucher | Manual; basic 194C/194J presets | Post-facto for filing; not AP-integrated | Manual section selection | Not supported |
| **TDS Cumulative Threshold** | Automatic per-vendor annual tracking with threshold crossing alerts | None; user tracks manually | None | Tracks for filing; not real-time at AP entry | None | None |
| **Section 197 Certificate** | Upload on vendor, auto-apply lower rate within validity window | Manual rate override per voucher | Not supported | Not supported at AP level | Not supported | Not supported |
| **GST Compliance** | CGST/SGST/IGST/Cess breakdown, GSTIN extraction, state code derivation | Full GST module but manual entry | Full GST with e-way bill; no AP extraction | Deep GST filing; lighter AP | GST auto-fill from GSTIN; filing-centric | GST invoicing; no AP-side compliance |
| **MSME Payment Tracking** | Auto-flag 45-day statutory deadline per MSMED Act Section 15 | None | Basic due date tracking | Not in scope | None | None |
| **Tally Integration** | XML export (purchase + payment vouchers), vendor pre-validation planned | Native (is Tally) | Export via CSV/JSON; no native Tally XML | Tally CSV import for filing data | Direct Tally XML import (core value prop) | CSV export; no native Tally |
| **Approval Workflow** | Multi-step, role-based, configurable per tenant | Voucher authorization | Basic approval chain | Not applicable | None | Basic approval |
| **Bank Reconciliation** | AI-scored matching, TDS-adjusted amounts, split/aggregate detection | BRS module (manual) | Auto-reconciliation | Not in scope | None | None |
| **Target Market** | India SME/CA firms | India (all segments) | India + Global SME | India tax filing | India SME/CA (Tally users) | India freelancers/SME |

### 2.3 LedgerBuddy Differentiators

1. **Cumulative TDS intelligence at AP entry point**: Per-vendor annual TDS threshold tracking with automatic catch-up computation is something no competitor offers at the AP entry point. ClearTax tracks cumulative amounts for filing but cannot influence deduction at invoice processing time. This is the deepest moat -- replicating the cumulative engine requires domain expertise, atomic ledger design, and rate hierarchy integration that template-based competitors cannot bolt on.
2. **CA firm multi-tenancy with independent configs**: A single CA firm partner can manage multiple client companies, each with independent TDS configurations, GL mappings, and approval workflows -- a use case that Tally Prime handles poorly (separate data folders) and Zoho Books charges per-organization. Network effects compound: each CA firm brings 3-10 client tenants, creating organic growth per acquisition.
3. **Compliance-first pipeline (not bolted-on)**: TDS, GST, PAN, and MSME compliance are embedded in the extraction and approval pipeline, not bolted on as a reporting layer. Risk signals surface at the point of action, not after filing deadlines. This architectural decision means compliance intelligence improves with every invoice processed, not just at quarter-end.
4. **Extraction-to-Tally single flow**: No other tool combines AI-powered multi-format invoice extraction with correct Tally XML voucher generation. Tally users today re-key extracted data; LedgerBuddy eliminates that. This is the most visible differentiator but the least defensible -- competitors can replicate XML generation faster than cumulative compliance intelligence.

### 2.4 Competitive Moat

Three competitive threats require explicit defensibility analysis:

1. **Tally shipping native invoice import**: Tally Prime 5.x has shown no movement toward AI-based invoice extraction. Their product philosophy is "data entry in Tally" not "data import from outside." Even if Tally adds basic OCR, it will lack compliance enrichment (cumulative TDS, PAN validation, MSME tracking) and multi-tenant CA firm workflows. LedgerBuddy's moat is compliance intelligence, not import plumbing.

2. **Zoho Books expanding Tally integration**: Zoho has added Tally data migration tools but targets Tally-to-Zoho conversion, not Tally-alongside-Zoho workflows. CA firms overwhelmingly keep clients on Tally Prime; Zoho's strategy of replacing Tally alienates this segment. LedgerBuddy's "enhance Tally, don't replace it" positioning is structurally different and aligned with how CA firms actually work.

3. **ClearTax moving into AP**: ClearTax has deep filing-side TDS/GST compliance but approaches AP from a tax filing lens, not an operational AP lens. Their value ends at Form 26Q preparation; LedgerBuddy starts at invoice receipt and extends through payment and Tally export. ClearTax also lacks multi-tenant CA firm architecture.

4. **Suvit as direct Tally import competitor**: Suvit's core value proposition -- Excel/PDF to Tally import -- overlaps with LedgerBuddy's export pipeline. However, Suvit is template-dependent (users map columns manually), has no compliance enrichment layer, no approval workflows, and no cumulative TDS tracking. LedgerBuddy's AI extraction + compliance engine provides structurally higher accuracy and auditability. The risk is Suvit's existing Tally user base and brand recognition among CA firms; mitigation is LedgerBuddy's demonstrably superior extraction quality and compliance automation in pilot comparisons.

**Defensibility summary**: LedgerBuddy's moat is the combination of (a) AI extraction quality (OCR + SLM, not templates), (b) compliance intelligence embedded in the processing pipeline (not bolted on for filing), (c) multi-tenant CA firm architecture, and (d) correct Tally XML with bill tracking. No single competitor addresses all four.

### 2.5 What Indian Accountants Need That Competitors Do Not Offer Well

- **Real-time TDS threshold awareness**: "Will this invoice push us over the Section 194C annual threshold of Rs 1,00,000 for this vendor?" -- answered at processing time, not at quarter-end.
- **Correct Tally import on the first try**: Purchase vouchers that create proper bill references, enable accounts payable aging in Tally, and carry GSTIN/place-of-supply for GST filing -- without manual cleanup.
- **Vendor-centric compliance view**: A single screen showing a vendor's PAN status, MSME classification, TDS cumulative position, outstanding invoices, and Tally ledger mapping.
- **Section 197 automation**: When a vendor provides a lower deduction certificate, the system should automatically apply the lower rate within the validity period and revert to standard rate afterward -- without manual voucher-by-voucher overrides.

---

## 3. User Personas

### 3.1 CA Firm Partner (Rajesh, 45, Mumbai)

**Role**: Managing partner at a mid-size CA firm handling accounting, tax filing, and audit for 30+ client companies.

**Goals**:
- Process invoices across multiple client companies with minimal per-client setup
- Ensure TDS compliance across all clients to avoid IT notices and client reputation damage
- Generate Form 26Q preparation data quarterly without manual spreadsheet aggregation
- Delegate daily processing to juniors while maintaining approval oversight

**Pain Points**:
- Tracks TDS thresholds per vendor in Excel across 30 clients; misses threshold crossings 2-3 times per quarter
- Junior staff frequently selects wrong TDS section; correction requires voucher deletion and re-entry in Tally
- Tally import of third-party extractions produces "journal" entries instead of proper purchase vouchers, breaking bill-by-bill aging
- Quarter-end 26Q preparation takes 3-4 days of manual aggregation

**How LedgerBuddy Serves Rajesh**:
- Multi-tenant workspace: one login, switch between client companies, each with independent compliance configuration
- TDS cumulative dashboard: at-a-glance view of which vendors are approaching or have crossed annual thresholds, per section, per FY
- TDS liability report exportable in Form 26Q structure (deductee-wise, section-wise, quarter-wise)
- Correct Tally XML with `ISINVOICE=Yes`, `BILLALLOCATIONS`, and proper ledger tags -- import once, no cleanup

#### Rajesh's First 30 Minutes (Onboarding Journey)

| Minute | Step | Action | Likely Drop-Off Risk |
|--------|------|--------|---------------------|
| 0-2 | **Keycloak Login** | Rajesh receives invite email, sets password, logs in via Keycloak SSO. | Low -- standard SSO flow. Risk: email lands in spam. |
| 2-5 | **Create Tenant** | Creates first client company tenant (name, type). | Low -- simple form. Risk: unclear whether to create firm-level or client-level tenant. Mitigation: tooltip "Create one tenant per client company." |
| 5-10 | **Configure Company** | Enters company name, TAN, GSTIN, financial year start. | Medium -- TAN may not be at hand. Mitigation: allow skip with "Complete later" and show reminder badge. |
| 10-15 | **Import GL Codes** | Uploads GL code CSV or manually adds 5-10 common codes. | HIGH -- CSV format confusion is the most likely drop-off point. Mitigation: downloadable template CSV, inline format preview, "Use standard chart" one-click option with common India GL codes. |
| 15-18 | **Configure TDS Sections** | Reviews auto-populated TDS section table (194C, 194H, 194I, 194J defaults). Adjusts rates if using tenant overrides. | Medium -- may feel overwhelming. Mitigation: defaults pre-populated from standard rate table; "Use defaults" prominent. |
| 18-22 | **Upload First Invoice** | Drags and drops a single invoice PDF. Watches extraction progress. | Low -- drag-and-drop is intuitive. Risk: extraction takes >30s and user abandons. Mitigation: progress indicator with "typically 10-20 seconds" hint. |
| 22-26 | **Review Extraction** | Opens extracted invoice. Reviews vendor, amounts, GST breakdown, auto-detected TDS section. Corrects any field if needed. | Medium -- if extraction quality is poor on first invoice, trust is damaged. Mitigation: choose a clean, well-formatted invoice for first upload guidance. |
| 26-28 | **Approve Invoice** | Clicks Approve. Sees invoice move to APPROVED status. | Low -- single button click. |
| 28-30 | **Export to Tally** | Clicks Export. Sees pre-export validation modal (all green). Downloads XML. | Low -- satisfying completion moment. Mitigation: show "Next steps: import this XML into Tally Prime" instruction. |

**Success criterion**: Rajesh completes all 8 steps within 30 minutes without contacting support. **Primary drop-off point**: GL code CSV import (minute 10-15). **Secondary drop-off point**: TDS section configuration (minute 15-18).

### 3.2 AP Clerk (Priya, 28, Bengaluru)

**Role**: Accounts payable clerk at a mid-market manufacturing company processing 400-600 invoices per month.

**Goals**:
- Process invoices quickly with minimal manual data entry
- Apply correct TDS deduction without needing to remember section-specific rules
- Record payments and match them to bank statement entries
- Flag unusual invoices for supervisor review

**Pain Points**:
- Types invoice data into Tally manually; 3-5 minutes per invoice, 15-20 errors per week
- Unsure whether to deduct TDS on a vendor who is below the annual threshold but approaching it
- Cannot tell if a vendor's PAN is valid or if the GSTIN matches the PAN until IT notice arrives
- Bank reconciliation takes 2 full days per month

**How LedgerBuddy Serves Priya**:
- Auto-extraction reduces per-invoice handling to 30-60 seconds (review + approve)
- System auto-computes TDS with clear signals: "Below annual threshold -- no TDS deducted" or "Threshold crossed with this invoice -- catch-up TDS of Rs X,XXX applied"
- PAN validation and GSTIN cross-reference happen at extraction time; risk signals surface immediately
- Reconciliation scoring with TDS-adjusted amounts eliminates the "why doesn't the bank debit match the invoice amount?" confusion

### 3.3 Finance Controller (Meera, 38, Chennai)

**Role**: Finance controller at a services company with Rs 50 crore annual revenue, overseeing AP, compliance, and financial reporting.

**Goals**:
- Maintain zero-error TDS compliance to avoid Section 201(1A) interest and Section 271C penalties
- Approve high-value invoices with full compliance visibility (TDS section, rate source, PAN status, risk signals)
- Monitor AP aging and MSME payment deadlines to avoid statutory interest
- Ensure all Tally exports are audit-ready

**Pain Points**:
- Discovered during IT assessment that Rs 12 lakh in TDS was computed on GST-inclusive amounts, resulting in Rs 85,000 vendor dispute
- No visibility into whether a Section 197 lower deduction certificate is being applied correctly or has expired
- AP aging report in Tally does not distinguish MSME vendors from non-MSME vendors; statutory 45-day deadline missed repeatedly
- Quarter-end TDS deposit calculation requires pulling data from Tally, Excel, and the bank portal separately

**How LedgerBuddy Serves Meera**:
- TDS rate hierarchy transparently shows: "Rate source: Section 197 certificate (valid through 31-Mar-2027, Rs 15,00,000 remaining)" or "Rate source: Standard rate table, Section 194C, 2%"
- GST exclusion from TDS base is automatic per CBDT Circular 23/2017; auditable in the TDS result on each invoice
- MSME risk signals at warning (7 days before deadline) and critical (overdue) levels
- TDS liability report with quarterly aggregation, deposit deadline awareness, and per-vendor drill-down

### 3.4 Tax Specialist (Vikram, 32, Delhi)

**Role**: In-house tax compliance specialist at a conglomerate with 12 entities, responsible for TDS/TCS filing, PAN verification, and IT assessment responses.

**Goals**:
- Ensure all deductors (group entities) file accurate Form 26Q quarterly returns
- Track per-vendor cumulative TDS positions to ensure threshold-based deductions are correct
- Maintain PAN database for all deductees and apply correct 206AA penalty rates when PAN is missing
- Respond to IT notices with auditable deduction-by-deduction trail

**Pain Points**:
- Cumulative threshold tracking across 12 entities for 800+ vendors is entirely manual; 2 FTEs spend 40% of their time on this
- Section 197 certificates arrive by email; Vikram tracks validity in a spreadsheet that is frequently out of date
- When a backdated invoice arrives (invoice date in a prior quarter), recalculating the cumulative threshold impact requires pulling all prior invoices for that vendor
- Cannot quickly answer "what was the TDS deducted on vendor X for section 194C in Q2 FY 2025-26?" without pulling Tally data + Excel reconciliation

**How LedgerBuddy Serves Vikram**:
- `TdsVendorLedger` maintains an atomic, per-entry audit trail of every invoice's contribution to the cumulative threshold -- queryable by vendor, section, FY, and quarter
- Section 197 certificates stored on VendorMaster with validity dates and remaining amount; system auto-reverts to standard rate on expiry
- Backdated invoices automatically assigned to the correct FY based on invoice date (IST timezone) with catch-up TDS computation
- TDS liability report directly answers the "how much TDS for vendor X, section Y, quarter Z?" question in under 2 seconds

### 3.5 Platform Operations Manager (Aisha, 30, Pune)

**Role**: Platform Operations Manager at LedgerBuddy, responsible for onboarding new tenants, monitoring platform usage, and ensuring compliance health across all tenants.

**Goals**:
- Onboard new CA firm tenants with minimal friction and consistent configuration
- Monitor usage patterns across all tenants to identify adoption bottlenecks and churn risk
- Maintain a compliance health dashboard showing aggregate TDS accuracy, MSME overdue rates, and export success rates across tenants
- Proactively identify tenants with degraded compliance posture before it leads to IT notices or client escalation

**Pain Points**:
- Tenant onboarding is manual and error-prone; configuration steps vary per tenant with no standardized checklist
- No aggregate view of platform health -- must log into each tenant individually to assess compliance posture
- Usage metrics (invoice volume, export frequency, payment adoption) are not surfaced; churn signals go undetected
- Compliance issues at one tenant are invisible until the CA firm escalates

**How LedgerBuddy Serves Aisha**:
- Standardized tenant onboarding workflow with progress tracking and validation at each step
- Platform-level analytics dashboard showing per-tenant KPIs: invoice volume, TDS accuracy, export success rate, MSME overdue count, payment adoption
- Compliance health heatmap: tenants ranked by risk score (unresolved critical signals, missed MSME deadlines, low TDS accuracy)
- Proactive alerts when a tenant's compliance metrics degrade below configurable thresholds

---

## 4. Feature Requirements

### 4.1 TDS Cumulative Threshold

**User Story**: "As a tax specialist, I need to see per-vendor cumulative TDS so I know when the annual threshold is crossed, and the system automatically computes catch-up TDS when a crossing occurs."

**Background**: Under the Income Tax Act, TDS on certain sections (notably 194C, 194H, 194I, 194J) is not required if the total payments to a single vendor in a financial year remain below a specified annual threshold. Once the threshold is crossed, TDS becomes applicable on the entire cumulative amount (not just the excess). Today, `TdsCalculationService` checks only the single-transaction threshold (`thresholdSingleMinor`); the `thresholdAnnualMinor` field exists on `TdsRateTable` but is never consulted.

**Evidence**: E3 (Section 194C annual threshold Rs 1,00,000), E11 (CBDT Circular 23/2017 GST exclusion). **VKL Decisions**: D-006, D-010, D-024, D-025, D-026, D-038, D-043.

#### Functional Requirements

**FR-TDS-001**: The system shall maintain a `TdsVendorLedger` document per unique combination of {tenantId, vendorFingerprint, financialYear, section}. This document accumulates `cumulativeBaseMinor` (sum of taxable bases) and `cumulativeTdsMinor` (sum of TDS deducted) across all invoices for that vendor-section-FY.

*Acceptance Criteria*: Given vendor V with section 194C in FY 2025-26, when 5 invoices are processed, then a single `TdsVendorLedger` document exists with `cumulativeBaseMinor` equal to the sum of all 5 taxable bases and `cumulativeTdsMinor` equal to the sum of all 5 TDS amounts. The document contains 5 entries in the `entries` array.

**FR-TDS-002**: The system shall determine the financial year from the invoice date, not the processing date. Financial year runs April 1 through March 31. The invoice date shall be interpreted in IST (UTC+05:30) timezone for FY boundary determination.

*Acceptance Criteria*: An invoice with date 2026-03-31T20:00:00Z (which is 2026-04-01T01:30:00 IST) is assigned to FY 2026-27, not FY 2025-26. An invoice with date 2026-03-31T18:29:59Z (which is 2026-03-31T23:59:59 IST) is assigned to FY 2025-26. [VKL: D-043, C-002]

**FR-TDS-003**: The financial year string shall be formatted as `"YYYY-YY"` (e.g., `"2025-26"`) matching Indian tax convention.

*Acceptance Criteria*: An invoice dated 2025-07-15 produces FY string `"2025-26"`. An invoice dated 2026-02-28 produces FY string `"2025-26"`. An invoice dated 2026-04-01 produces FY string `"2026-27"`.

**FR-TDS-004**: When processing an invoice, `TdsCalculationService.computeTds()` shall, after section detection and rate lookup, query the `TdsVendorLedger` for the vendor's cumulative taxable base in the applicable FY and section.

*Acceptance Criteria*: The query uses the compound index `{ tenantId, vendorFingerprint, financialYear, section }`. If no document exists, the cumulative base is treated as 0.

**FR-TDS-005**: If the cumulative taxable base (prior invoices) plus the current invoice's taxable base is below the annual threshold for that section, the system shall set TDS amount to 0 and emit the `TDS_BELOW_ANNUAL_THRESHOLD` risk signal.

*Acceptance Criteria*: Vendor with prior cumulative of Rs 60,000 against section 194C (annual threshold Rs 1,00,000) receives an invoice for Rs 30,000. TDS = 0. Risk signal emitted with message: "Cumulative amount (Rs 90,000) below annual threshold (Rs 1,00,000) for section 194C. No TDS deducted."

**FR-TDS-006**: If the cumulative taxable base was previously below the annual threshold and the current invoice causes it to cross the threshold (prior cumulative < threshold, prior cumulative + current >= threshold), the system shall compute TDS on the *entire* cumulative amount (prior + current), subtract TDS already deducted on prior invoices, and apply the remainder as TDS on this invoice.

*Acceptance Criteria*: Vendor has prior cumulative Rs 80,000 with Rs 0 TDS deducted (below threshold). Current invoice taxable base Rs 30,000. Section 194C at 2% for individual. Total cumulative = Rs 1,10,000 (above Rs 1,00,000 threshold). TDS on Rs 1,10,000 = Rs 2,200. Prior TDS = Rs 0. TDS on this invoice = Rs 2,200 - Rs 0 = Rs 2,200. Risk signal `TDS_ANNUAL_THRESHOLD_CROSSED` emitted. [VKL: D-006]

**FR-TDS-007**: If the cumulative taxable base was already above the annual threshold before this invoice, the system shall compute TDS on the current invoice's taxable base only (normal per-invoice TDS).

*Acceptance Criteria*: Vendor has prior cumulative Rs 2,50,000 with Rs 5,000 TDS deducted (already above Rs 1,00,000 threshold). Current invoice taxable base Rs 50,000. Section 194C at 2%. TDS on this invoice = Rs 1,000. No threshold-related risk signal emitted.

**FR-TDS-008**: The `TdsVendorLedger` update (incrementing `cumulativeBaseMinor`, `cumulativeTdsMinor`, `invoiceCount`, and pushing to the `entries` array) shall be performed as an atomic `findOneAndUpdate` with `$inc` and `$push` operators, using `upsert: true` and `returnDocument: 'after'`. The catch-up TDS computation (threshold crossing detection) shall use the cumulative values from the RETURNED document, not from a separate prior read, to eliminate the read-then-write race condition. Specifically: (1) increment `cumulativeBaseMinor` by the current invoice's taxable base, (2) read `cumulativeBaseMinor` from the returned document, (3) if `returnedCumulativeBaseMinor >= threshold` and `(returnedCumulativeBaseMinor - currentTaxableBase) < threshold`, this invoice caused the threshold crossing and catch-up TDS is computed on the full `returnedCumulativeBaseMinor`.

*Acceptance Criteria*:

- Two invoices for the same vendor processed concurrently (within 100ms) produce a `TdsVendorLedger` document with both entries reflected correctly in `cumulativeBaseMinor`, `cumulativeTdsMinor`, and `entries` array. No lost updates. [VKL: D-038]
- **Concurrency test case**: Vendor at Rs 80,000 cumulative on section 194C (threshold Rs 1,00,000). Two invoices of Rs 20,000 each submitted concurrently. Expected outcome: exactly one invoice receives catch-up TDS (on the full cumulative at the point of its atomic increment), and the other receives normal per-invoice TDS. The invoice whose `findOneAndUpdate` returns `cumulativeBaseMinor = 1,00,000` (i.e., the first to increment) triggers catch-up; the one returning `cumulativeBaseMinor = 1,20,000` (threshold already crossed before its base was added) applies normal rate. Total TDS across both invoices equals the correct cumulative TDS for Rs 1,20,000.
- No separate `findOne` read precedes the `findOneAndUpdate`. The threshold crossing decision is derived entirely from the atomically returned document.

**FR-TDS-009**: The `TdsVendorLedger.entries` array shall store, for each invoice: `invoiceId`, `invoiceDate`, `taxableAmountMinor`, `tdsAmountMinor`, `rateSource` (string describing which rate was applied and why), `quarter` (Q1-Q4), and `recordedAt` (timestamp of ledger entry creation).

*Acceptance Criteria*: After processing an invoice with Section 197 certificate applied, the entry's `rateSource` reads `"section-197-cert-XXXX"` (where XXXX is the certificate number). After processing an invoice with no PAN penalty, `rateSource` reads `"206aa-no-pan"`.

**FR-TDS-010**: When the cumulative threshold is crossed for the first time in a given FY+section, the system shall set `thresholdCrossedAt` on the `TdsVendorLedger` document to the current timestamp.

*Acceptance Criteria*: `thresholdCrossedAt` is null before threshold crossing. After the crossing invoice is processed, `thresholdCrossedAt` is set. Subsequent invoices for the same vendor-section-FY do not modify `thresholdCrossedAt`.

**FR-TDS-011**: When a backdated invoice arrives (invoice date falls in a financial year for which invoices have already been processed), the system shall compute TDS based on the cumulative state of that FY as of the invoice's insertion, applying catch-up TDS if the backdated invoice causes a threshold crossing.

*Acceptance Criteria*: FY 2025-26 has Rs 90,000 cumulative for vendor V on section 194C (below Rs 1,00,000 threshold). A new invoice arrives with invoice date 2025-08-15 (FY 2025-26) and taxable base Rs 20,000. New cumulative = Rs 1,10,000 (above threshold). System deducts catch-up TDS on Rs 1,10,000 minus any prior TDS. Risk signal `TDS_BACKDATED_THRESHOLD_ADJUSTMENT` emitted. [VKL: D-006]

**FR-TDS-012**: The structured TDS result stored on the invoice's `compliance.tds` subdocument shall include: `section`, `rateBps` (integer, basis points), `rateSource` (human-readable string), `taxableBaseMinor` (integer), `tdsAmountMinor` (integer), `netPayableMinor` (integer), `quarter` (Q1-Q4), `source` ("auto" or "manual"), `confidence` (high/medium/low).

*Acceptance Criteria*: After TDS computation, each field is populated. `netPayableMinor = totalAmountMinor - tdsAmountMinor + tcsAmountMinor`. `taxableBaseMinor` reflects GST exclusion when applicable. `rateBps` is an integer (e.g., 200 for 2%). [VKL: D-025]

**TCS Sign Convention Note**: `netPayableMinor = totalAmountMinor - tdsAmountMinor + tcsAmountMinor`. TCS is collected BY the vendor FROM the buyer (buyer pays more). TDS is deducted BY the buyer FROM the vendor (buyer pays less). Therefore TDS reduces net payable and TCS increases it.

**FR-TDS-013**: The system shall support manual TDS override on any invoice. When a user manually sets a TDS section, rate, or amount, the `source` field changes to `"manual"` and an `AuditLog` entry is created recording the previous and new values, the user ID, and the timestamp.

*Acceptance Criteria*: User overrides TDS section from 194C to 194J on invoice I. `compliance.tds.source` = `"manual"`. AuditLog entry created with `entityType="invoice"`, `entityId=I`, `action="tds_manual_override"`, `previousValue={section:"194C", ...}`, `newValue={section:"194J", ...}`. [VKL: D-004]

**FR-TDS-014**: Manual TDS overrides shall still update the `TdsVendorLedger` -- reversing the auto-computed entry and applying the manual values -- to maintain cumulative accuracy.

*Acceptance Criteria*: Invoice auto-computed at section 194C with Rs 2,000 TDS. User overrides to 194J with Rs 5,000 TDS. TdsVendorLedger for 194C is decremented by Rs 2,000. TdsVendorLedger for 194J is incremented by Rs 5,000. Both operations are atomic.

**FR-TDS-014a**: When a manual override changes the TDS section (e.g., from 194C to 194J), the system shall execute the following cascading operations atomically:

1. **Decrement old section**: `findOneAndUpdate` on `TdsVendorLedger` for the old section, decrementing `cumulativeBaseMinor` and `cumulativeTdsMinor` by the original invoice's values, removing the invoice entry from the `entries` array.
2. **Upsert new section**: `findOneAndUpdate` with `upsert: true` on `TdsVendorLedger` for the new section, incrementing `cumulativeBaseMinor` and `cumulativeTdsMinor` by the overridden values, pushing a new entry to the `entries` array with `rateSource: "manual-override:{userId}"`.
3. **No retroactive recomputation**: The system shall NOT retroactively recompute TDS on other invoices that were processed under the old section. Existing TDS amounts on other invoices remain unchanged.
4. **Risk signal on threshold impact**: If the decrement causes the old section's `cumulativeBaseMinor` to drop below `thresholdAnnualMinor` (i.e., vendor was above threshold and is now below due to the section move), emit `TDS_CUMULATIVE_RECALC_NEEDED` risk signal with severity "warning" and message: "Manual section change moved Rs {amount} from {oldSection} to {newSection}. {oldSection} cumulative dropped below threshold (Rs {cumulative} < Rs {threshold}). Prior invoices under {oldSection} may have over-deducted TDS. Manual review recommended."

*Acceptance Criteria*:

- Invoice I auto-computed at 194C with taxable base Rs 50,000 and TDS Rs 1,000. User overrides section to 194J with TDS Rs 5,000. After override: 194C ledger decremented by Rs 50,000 base / Rs 1,000 TDS; 194J ledger incremented by Rs 50,000 base / Rs 5,000 TDS. Invoice I entry removed from 194C entries, added to 194J entries.
- Given vendor at Rs 1,10,000 cumulative on 194C (above Rs 1,00,000 threshold). Invoice with Rs 20,000 base overridden from 194C to 194J. New 194C cumulative = Rs 90,000 (below threshold). `TDS_CUMULATIVE_RECALC_NEEDED` risk signal emitted. Other invoices' TDS amounts remain unchanged.
- Given vendor at Rs 1,50,000 cumulative on 194C. Invoice with Rs 10,000 base overridden to 194J. New 194C cumulative = Rs 1,40,000 (still above threshold). No risk signal emitted.
- Both ledger operations execute within a single MongoDB session. If either fails, both roll back.

**FR-TDS-015**: The system shall handle the edge case where an invoice is re-processed (e.g., re-extraction after OCR correction). The previous TdsVendorLedger entry for that invoice shall be reversed (decrement cumulative, remove from entries array) before the new entry is applied. When re-processing changes the TDS section, the same rules as FR-TDS-014a apply: reverse old section ledger, upsert new section ledger, emit `TDS_CUMULATIVE_RECALC_NEEDED` if old section drops below threshold.

*Acceptance Criteria*: Invoice originally processed with taxable base Rs 50,000. Re-processed with corrected taxable base Rs 45,000. TdsVendorLedger cumulative decremented by Rs 50,000 then incremented by Rs 45,000. Net effect: -Rs 5,000. The `entries` array contains only the corrected entry for this invoice. If re-processing changes the section (e.g., 194C to 194J), the 194C ledger is decremented and 194J ledger is upserted, following FR-TDS-014a cascading rules including threshold-impact risk signals.

**FR-TDS-016**: The `TdsVendorLedger` shall be queryable by tenant + FY to produce a list of all vendors with their cumulative TDS positions, supporting the TDS liability report.

*Acceptance Criteria*: `GET /api/reports/tds-liability?fy=2025-26` returns all TdsVendorLedger documents for the tenant in FY 2025-26, sorted by vendor name, with cumulative base, cumulative TDS, invoice count, and threshold crossing status per section.

**FR-TDS-017**: A backfill migration script shall exist that processes all historical invoices (in invoice-date order) for each tenant, building TdsVendorLedger documents from scratch. The script shall be idempotent (safe to re-run).

*Acceptance Criteria*: Running the backfill twice produces the same TdsVendorLedger state. The script processes invoices in batches of 100 via cursor-based iteration. Progress is logged. [VKL: D-041, D-044]

**FR-TDS-018**: The system shall enforce that all `*Minor` fields on `TdsVendorLedger` are integers, using Mongoose's `validate: { validator: Number.isInteger }` constraint.

*Acceptance Criteria*: Attempting to store `cumulativeBaseMinor: 100050.5` fails validation. All TDS arithmetic uses `Math.round()` to ensure integer results before storage. [VKL: C-001]

**FR-TDS-019**: The TDS computation latency (from `computeTds()` call to return) shall not exceed 200ms at the 95th percentile, including the cumulative threshold lookup.

*Acceptance Criteria*: Under load testing with 1,000 invoices queued, 95% of `computeTds()` calls complete within 200ms. The `TdsVendorLedger` compound index `{ tenantId, vendorFingerprint, financialYear, section }` is used for all lookups.

**FR-TDS-020**: When the system cannot determine the TDS section (no glCategory available, no mapping found), it shall return `section: null`, `tdsAmountMinor: null`, `netPayableMinor: null`, and emit the `TDS_SECTION_AMBIGUOUS` risk signal. It shall NOT default to any section.

*Acceptance Criteria*: Invoice with no GL category match returns null TDS result. No TdsVendorLedger entry is created. Risk signal emitted with severity "warning".

#### Financial Year & Quarter Handling

**FR-TDS-021**: The `determineFY(invoiceDate: Date): string` utility function shall convert the invoice date to IST and return the FY string.

*Acceptance Criteria*: `determineFY(new Date("2026-03-31T18:30:00Z"))` returns `"2026-27"` (because 18:30 UTC = 00:00 IST on April 1). `determineFY(new Date("2026-03-31T18:29:59Z"))` returns `"2025-26"`. [VKL: D-043, C-002]

**FR-TDS-022**: The `determineQuarter(deductionDate: Date): string` utility function shall convert the deduction date to IST and return the quarter string.

*Acceptance Criteria*: April 1 through June 30 IST = "Q1". July 1 through September 30 IST = "Q2". October 1 through December 31 IST = "Q3". January 1 through March 31 IST = "Q4". [VKL: C-014]

**FR-TDS-023**: For standard invoices, the deduction date is the invoice date. For advance payments (payment before invoice), the deduction date is the payment date if it falls in an earlier quarter than the invoice date.

*Acceptance Criteria*: Advance payment on June 15 for invoice dated July 5: deduction quarter = Q1 (from payment date June 15). Standard invoice dated July 5: deduction quarter = Q2.

**FR-TDS-024**: The system shall handle financial year boundary edge cases: invoice dated March 31 processed on April 2 is assigned to prior FY; invoice dated April 1 starts a fresh cumulative in the new FY.

*Acceptance Criteria*: Vendor with Rs 80,000 cumulative in FY 2025-26 receives an invoice dated April 1, 2026. This invoice starts fresh in FY 2026-27 with cumulative = Rs 0. The Rs 80,000 remains in FY 2025-26.

---

### 4.2 TDS Rate Hierarchy

**User Story**: "As a finance controller, I need the system to automatically apply the correct TDS rate considering certificates, PAN status, and overrides, and I need to see exactly which rate source was applied and why."

**Background**: The applicable TDS rate is not a simple lookup. It depends on a priority hierarchy defined by the Income Tax Act. **VKL Decisions**: D-013, D-024, D-027. **Evidence**: E7, E14, E26.

#### Functional Requirements

**FR-TDS-100**: The TDS rate hierarchy shall be applied in the following priority order:

1. **Section 197 lower deduction certificate** (overrides downward): If the vendor has a valid certificate (`lowerDeductionCert` on VendorMaster) and the certificate's `validFrom <= invoiceDate <= validTo` and the certificate's `maxAmountMinor` has not been exhausted, apply `applicableRateBps` from the certificate.
2. **Section 206AB non-filer penalty** (deferred): If the vendor is flagged as a "specified person" under Section 206AB, the applicable rate would be `max(2 * standardRate, 5%)`. This is deferred to a risk signal only (D-027); the system does not auto-apply this rate.
3. **Section 206AA no-PAN penalty**: If the vendor has no valid PAN, apply `max(20%, standardRate)`. The 20% is expressed as 2000 bps.
4. **Tenant override rate**: If the tenant's `TenantComplianceConfig.tdsRates` array contains an active entry for the detected section, use the tenant-specific rate.
5. **Standard rate**: Fall back to `TdsRateTable` for the detected section.

The highest applicable rate wins, EXCEPT Section 197 which overrides downward (i.e., Section 197 can reduce the rate below the standard rate).

*Acceptance Criteria*: Vendor with valid Section 197 certificate at 1% and standard rate 2%: applied rate = 1% (certificate overrides downward). Vendor with no PAN and standard rate 2%: applied rate = 20% (206AA penalty). Vendor with no PAN and standard rate 25%: applied rate = 25% (standard is higher than 20% floor). Vendor with both no PAN and Section 197 certificate: 206AA (20%) applies because PAN absence invalidates certificate benefit.

**FR-TDS-101**: The `ComplianceTdsResult` interface shall be extended to include `rateBps` (integer), `rateSource` (string), `taxableBaseMinor` (integer), and `quarter` (string). The existing `rate` field shall be deprecated in favor of `rateBps` for naming consistency.

*Acceptance Criteria*: `rateSource` is a human-readable string. Examples: `"standard-rate-table"`, `"tenant-override"`, `"section-197-cert-LDC/2025/12345"`, `"206aa-no-pan-penalty"`. [VKL: D-025]

**FR-TDS-102**: Section 197 lower deduction certificate data shall be stored on `VendorMaster.lowerDeductionCert` with fields: `certificateNumber` (string), `validFrom` (Date), `validTo` (Date), `maxAmountMinor` (integer), `applicableRateBps` (integer).

*Acceptance Criteria*: Certificate uploaded via `POST /api/vendors/:fingerprint/cert`. When cumulative payments to vendor exceed `maxAmountMinor`, certificate benefit ceases and standard rate resumes. [VKL: D-013]

**FR-TDS-103**: When a Section 197 certificate is applied, the system shall emit the `TDS_SECTION_197_APPLIED` risk signal with severity "info" and a message including the certificate number, applicable rate, and remaining amount.

*Acceptance Criteria*: Risk signal message: "Lower TDS rate applied per Section 197 certificate LDC/2025/12345: 1% (standard: 2%). Valid until 31-Mar-2027, Rs 35,00,000 remaining."

**FR-TDS-104**: When a Section 197 certificate has expired (current date > `validTo`), the system shall ignore the certificate, apply the standard rate hierarchy, and emit a risk signal: "Section 197 certificate LDC/2025/12345 expired on {date}. Standard rate applied."

*Acceptance Criteria*: Vendor's certificate `validTo` is 2025-12-31. Invoice processed on 2026-01-15. Certificate ignored. Standard rate applied. Info-level risk signal emitted.

**FR-TDS-105**: Section 206AB non-filer status shall be tracked as a boolean flag on VendorMaster (`isSpecifiedPerson206AB`). When true, the system shall emit the `TDS_NON_FILER_FLAG` risk signal with severity "warning" but shall NOT automatically increase the TDS rate. The risk signal message shall state: "Vendor may be a specified person under Section 206AB. Higher TDS rate (2x standard or 5%, whichever is higher) may be applicable. Verify with TRACES before processing."

*Acceptance Criteria*: `isSpecifiedPerson206AB = true` on vendor. Risk signal emitted. TDS rate remains at standard (or tenant override or 206AA, per hierarchy). Rate is NOT auto-doubled. [VKL: D-027]

**FR-TDS-106**: The Section 206AA no-PAN penalty shall apply whenever the vendor's PAN is absent or invalid (fails `PAN_FORMAT` regex). The penalty rate is `max(2000, standardRateBps)` -- i.e., at least 20%.

*Acceptance Criteria*: Vendor with no PAN, section 194C (standard rate 200 bps / 2%): applied rate = 2000 bps (20%). Vendor with no PAN, section 194I(b) (standard rate 1000 bps / 10%): applied rate = 2000 bps (20%). Vendor with no PAN, section 194DA (standard rate 2500 bps / 25%): applied rate = 2500 bps (25%, because 25% > 20%). [VKL: C-004, E7]

**FR-TDS-107**: The TDS taxable base shall exclude GST when GST components are shown separately on the invoice (`gst.subtotalMinor > 0`). When GST is inclusive (no separate breakdown), the taxable base shall be the full invoice amount.

*Acceptance Criteria*: Invoice total Rs 1,18,000 with GST subtotal Rs 1,00,000 and total GST Rs 18,000: taxable base = Rs 1,00,000. Invoice total Rs 1,18,000 with no GST breakdown: taxable base = Rs 1,18,000. [VKL: C-008, C-015, E11, E29]

**FR-TDS-108**: The `rateSource` string in the TDS result shall be deterministic and machine-parseable for audit trail purposes. The format shall be one of:
- `"standard-rate-table:{section}:{panCategory}"`
- `"tenant-override:{section}:{panCategory}"`
- `"section-197-cert:{certificateNumber}"`
- `"206aa-no-pan-penalty:{section}"`
- `"manual-override:{userId}"`

*Acceptance Criteria*: `rateSource` for a standard rate on section 194C for individual PAN: `"standard-rate-table:194C:P"`. Parseable by splitting on `:`.

---

### 4.3 TDS Reporting & Dashboard

**User Story**: "As a CA firm partner, I need a TDS liability report by vendor, section, and quarter for Form 26Q preparation, so I can file quarterly returns without manually aggregating data from Tally and spreadsheets."

**Background**: Form 26Q is the quarterly TDS return filed by deductors for non-salary payments. It requires deductee-wise details: PAN, section, amount paid/credited, TDS deducted, TDS deposited, date of deduction, date of deposit. LedgerBuddy's `TdsVendorLedger` contains the first five data points; deposit tracking is deferred (OAR-010).

#### Functional Requirements: TDS Reporting

**FR-TDS-200**: The system shall provide a `GET /api/reports/tds-liability` endpoint that accepts: `fy` (required, string, e.g. "2025-26"), `quarter` (optional, "Q1"|"Q2"|"Q3"|"Q4"), `vendorFingerprint` (optional), `section` (optional).

*Acceptance Criteria*: Calling with `fy=2025-26` returns all TdsVendorLedger documents for the tenant in that FY. Adding `quarter=Q2` filters to entries where `quarter="Q2"`. Adding `vendorFingerprint=abc` filters to that vendor only.

**FR-TDS-201**: The TDS liability report response shall include, for each vendor-section combination: `vendorFingerprint`, `vendorName`, `vendorPan`, `section`, `sectionDescription`, `cumulativeBaseMinor`, `cumulativeTdsMinor`, `invoiceCount`, `thresholdAnnualMinor`, `thresholdCrossed` (boolean), `thresholdCrossedAt`, `quarterBreakdown` (array of `{ quarter, baseMinor, tdsMinor, invoiceCount }` for Q1-Q4), and `entries` (detailed per-invoice array, only when a specific vendor is queried).

*Acceptance Criteria*: Report for FY 2025-26 with 3 vendors across sections 194C and 194J returns 4 rows. Each row includes quarter breakdown. When `vendorFingerprint` is specified, the `entries` array is included.

**FR-TDS-202**: The report shall support CSV export with columns matching Form 26Q Annexure II structure: deductee PAN, deductee name, section, amount paid/credited, date of payment/credit, TDS deducted, TDS deposited (blank -- deferred), date of deduction, TAN of deductor.

*Acceptance Criteria*: CSV download via `GET /api/reports/tds-liability?fy=2025-26&format=csv`. TAN sourced from `Tenant.tan`. "TDS deposited" column left blank with a note.

**FR-TDS-203**: The report computation shall complete within 3 seconds for tenants with up to 500 vendor-section-FY combinations.

*Acceptance Criteria*: Load test with 500 TdsVendorLedger documents returns within 3 seconds. Uses aggregation pipeline with `$match` on compound index.

#### Functional Requirements: TDS Dashboard

**FR-TDS-300**: The system shall provide a TDS dashboard accessible to users with TENANT_ADMIN or MEMBER roles, displaying KPIs for the current financial year.

*Acceptance Criteria*: Dashboard loads with current FY auto-selected (based on current date in IST). User can switch to prior FYs.

**FR-TDS-301**: The TDS dashboard shall display KPIs for the selected FY: Total TDS Deducted, Vendors with TDS Activity, Threshold Crossings This FY, Vendors Without PAN, Active Sections.

*Acceptance Criteria*: KPIs update when FY filter changes. "Vendors Without PAN" cross-references VendorMaster.

**FR-TDS-302**: The dashboard shall display a quarterly summary table matching the Form 26Q structure with columns: Quarter, Period, Total Taxable Base, Total TDS Deducted, Vendor Count, Deposit Deadline, Status (Pending/Overdue).

*Acceptance Criteria*: Four rows, one per quarter. Deposit deadlines: Q1=7-Jul, Q2=7-Oct, Q3=7-Jan, Q4=30-Apr. [E12, E24]

**FR-TDS-303**: The dashboard shall display a "Vendors Approaching Threshold" list showing vendors where `cumulativeBaseMinor` is between 80% and 100% of `thresholdAnnualMinor` for any section.

*Acceptance Criteria*: Vendor with cumulative Rs 85,000 against section 194C threshold Rs 1,00,000 appears. Vendor already crossed does not. List sorted by proximity. Maximum 20 vendors with "View all" link.

**FR-TDS-304**: The dashboard shall provide drill-down from any vendor row to the vendor's full TDS history: all entries in `TdsVendorLedger.entries` for that vendor-section-FY, with links to source invoices.

*Acceptance Criteria*: Clicking vendor row shows table of all contributing invoices with invoice number, date, taxable amount, TDS deducted, rate source, and quarter. Each invoice number links to invoice detail.

**FR-TDS-305**: The TDS dashboard shall display a "Recently Crossed Threshold" list showing vendors where `thresholdCrossedAt` falls within the current quarter. Columns: Vendor Name, Section, Crossing Date, Catch-Up TDS Amount (TDS deducted on the threshold-crossing invoice minus normal per-invoice TDS), Total TDS Deducted This FY. List sorted by crossing date descending. Maximum 20 entries with "View all" link.

*Acceptance Criteria*: Vendor whose threshold was crossed on 15-May-2026 appears in the list when viewed during Q1 FY 2026-27 (Apr-Jun 2026). Vendor whose threshold was crossed in Q4 of prior FY does not appear. Catch-up TDS amount correctly reflects the difference between the catch-up computation and what normal per-invoice TDS would have been.

---

### 4.4 Payment Recording

**User Story US-PAY-001 (AP Clerk, Single Invoice Payment):** "As an AP clerk, I need to record a payment made against a single approved invoice so that the invoice's outstanding balance is updated and the payment can be exported to Tally as a Payment Voucher."

**User Story US-PAY-002 (AP Clerk, Multi-Invoice Payment):** "As an AP clerk, I need to record a single payment that covers multiple invoices from the same vendor so that I can match real-world batch payment behavior where one NEFT transaction settles several bills."

**User Story US-PAY-003 (AP Clerk, Partial Payment):** "As an AP clerk, I need to record a partial payment against an invoice when the vendor agrees to accept payment in installments or when a deduction is applied beyond TDS."

**User Story US-PAY-004 (Finance Controller, Payment Visibility):** "As a finance controller, I need to see the payment status of all invoices at a glance so that I can identify outstanding liabilities and aging risk."

#### Functional Requirements: Payment Creation

| ID | Requirement | VKL Ref |
|---|---|---|
| FR-PAY-001 | The system shall provide a Payment model with fields: `tenantId`, `paymentNumber` (auto-generated, unique per tenant), `type` (standard/advance/reversal), `vendorFingerprint`, `paymentDate`, `amountMinor` (integer-validated, C-001), `currency` (default INR), `method`, `utrNumber`, `chequeNumber`, `bankLedgerName`, `status`, `allocations[]`, `reconciliationMappingId`, `createdBy`, `notes`. | D-002, C-001 |
| FR-PAY-002 | Payment method shall be one of: `neft`, `rtgs`, `upi`, `imps`, `cheque`, `cash`, `other`. | C-013 |
| FR-PAY-003 | Payment status shall follow the lifecycle: `draft` -> `approved` -> `processed` -> [terminal]; `draft` -> `cancelled` -> [terminal]; `approved` -> `failed` -> `draft` (retry). | D-002 |
| FR-PAY-004 | Each allocation entry shall contain: `invoiceId`, `allocatedMinor` (integer-validated), `tdsDeductedMinor` (default 0), `tcsCollectedMinor` (default 0), `netPaidMinor` (integer-validated). **Relationship**: `allocatedMinor` = gross amount allocated against this invoice (before tax adjustments). `netPaidMinor` = cash actually disbursed to vendor = `allocatedMinor - tdsDeductedMinor + tcsCollectedMinor`. The invoice's `paidAmountMinor` is incremented by `netPaidMinor` (not `allocatedMinor`), because `paidAmountMinor` tracks cash received by the vendor and is compared against `compliance.tds.netPayableMinor` for payment status determination. | D-002, C-001 |
| FR-PAY-005 | On payment creation, the system shall validate that `sum(allocations[].allocatedMinor) == amountMinor`. Reject with HTTP 400 if mismatch. | D-002 |
| FR-PAY-006 | On payment creation, the system shall validate that each `invoiceId` exists, belongs to the same tenant, and has status APPROVED or EXPORTED. Reject with HTTP 400 identifying invalid invoice(s). | D-002 |
| FR-PAY-007 | On payment creation, the system shall validate that each `allocatedMinor` does not exceed the invoice's remaining payable: `invoice.compliance.tds.netPayableMinor - invoice.paidAmountMinor`. Reject with HTTP 400 showing remaining payable. | D-002 |
| FR-PAY-008 | UTR/reference number shall be validated per payment method (see Section 4.5). | D-020 |
| FR-PAY-009 | The system shall enforce UTR uniqueness within a tenant via a unique sparse index on `{tenantId, utrNumber}`. Duplicate UTR submission shall be rejected with HTTP 409 and the existing payment's `paymentNumber`. | C-010, D-017 |
| FR-PAY-010 | For `method="cash"` with `amountMinor > 20000000` (Rs 2,00,000), the system shall emit `CASH_PAYMENT_ABOVE_LIMIT` risk signal on all associated invoices and return a warning (but shall not block creation). | D-022, C-012, E21 |
| FR-PAY-011 | When a payment transitions to `processed` status, the system shall atomically update each allocated invoice: `$inc { paidAmountMinor: allocatedMinor }` and recompute `paymentStatus` as: `unpaid` if 0, `partially_paid` if between 0 and netPayable, `fully_paid` if equal, `overpaid` if exceeds. | D-001, D-002 |
| FR-PAY-012 | Payment number generation shall follow the format `PAY-{YYYYMM}-{sequence}` where sequence is a zero-padded 5-digit auto-incrementing counter per tenant per month. | D-002 |
| FR-PAY-013 | The system shall expose `POST /api/payments`, `GET /api/payments`, `GET /api/payments/:id`, `PATCH /api/payments/:id` (draft only), `DELETE /api/payments/:id` (cancel draft only). | D-002 |
| FR-PAY-014 | All payment endpoints shall require `requireAuth` and `requireCap("canRecordPayments")`. | D-036 |
| FR-PAY-015 | The system shall add `paymentStatus` (enum: unpaid/partially_paid/fully_paid/overpaid, default: unpaid) and `paidAmountMinor` (integer, default: 0) to the Invoice model. A compound index `{tenantId, paymentStatus, "parsed.dueDate"}` shall support aging queries. | D-001 |

#### Payment Journey Map (End-to-End)

The following journey traces a payment from invoice approval through Tally reconciliation, mapping each step to the phase that delivers it:

```
[Approve Invoice]        Phase existing (approval workflow)
       |
       v
[Record Payment]         Phase 3 (FR-PAY-001 through FR-PAY-015)
  |-- Single invoice: inline form in invoice detail
  |-- Multi-invoice: vendor-grouped allocation table
  |-- Advance: type="advance", no allocations at creation
       |
       v
[Payment Approval]       Phase 3 (FR-PAY-026 through FR-PAY-030)
  |-- If workflow enabled: draft -> approved -> processed
  |-- If no workflow: draft -> processed (auto-progress)
       |
       v
[Process Payment]        Phase 3 (FR-PAY-011)
  |-- Atomic $inc on invoice.paidAmountMinor
  |-- paymentStatus recomputed (unpaid/partial/full/overpaid)
  |-- AuditLog entry created
       |
       v
[Export Payment Voucher]  Phase 4 (FR-TALLY-020 through FR-TALLY-025)
  |-- Tally Payment Voucher XML generated
  |-- BILLALLOCATIONS with BILLTYPE="Agst Ref"
  |-- References purchase voucher REFERENCE (invoice number)
       |
       v
[Confirm Tally Import]   Phase 4 (FR-TALLY-007a)
  |-- User confirms import via POST /confirm/:batchId
  |-- exportVersion incremented
       |
       v
[Upload Bank Statement]  Phase existing (bank statement upload)
  |-- CSV/PDF bank statement uploaded
  |-- Transactions parsed and stored
       |
       v
[Reconciliation]         Phase 5 (FR-REC-001 through FR-REC-016)
  |-- 1:1 match: UTR + TDS-adjusted amount
  |-- Split match: one transaction -> multiple invoices
  |-- Aggregate match: multiple transactions -> one invoice
  |-- ReconciliationMapping created
  |-- Match confirms payment was actually debited
```

**Key handoff points:**
- Invoice `paymentStatus` gates payment recording (must be APPROVED or EXPORTED)
- Payment `status` gates voucher export (must be `processed`)
- Purchase voucher `REFERENCE` links payment voucher `BILLALLOCATIONS` (Tally bill tracking)
- Bank statement `debitMinor` validates against payment `netPaidMinor` (TDS-adjusted)

---

### 4.5 Payment Methods & Banking

#### Per-Method Validation and UX

| ID | Method | Settlement Timing | Min/Max Amount | UTR/Ref Format | Validation Rules | UX Considerations |
|---|---|---|---|---|---|---|
| FR-BANK-001 | NEFT | 24x7 half-hourly batches (E22, RBI Dec 2019) | No statutory limit | Alphanumeric, 16-22 characters | Regex: `/^[A-Z0-9]{16,22}$/i`. Reject if outside range. | Default method for amounts < Rs 2,00,000. Show "Settlement: within 30 minutes" hint. |
| FR-BANK-002 | RTGS | Real-time gross settlement | Minimum Rs 2,00,000 (E23) | Alphanumeric, 16-22 characters | Amount validation: `amountMinor >= 20000000`. Same UTR format as NEFT. | Auto-suggest when amount >= Rs 2L. Block if amount < Rs 2L. |
| FR-BANK-003 | UPI | Real-time | Maximum configurable (default Rs 1,00,000) | Varies by PSP app; alphanumeric, 12-35 characters | Basic non-empty validation. Warn if `amountMinor > tenant.paymentConfig.upiWarnThresholdMinor` (default: 10000000 = Rs 1,00,000). Threshold configurable per tenant via `PATCH /api/tenant/config`. | Show UPI reference field label as "UPI Transaction ID". Warning message: "UPI amount exceeds Rs {threshold}. Some UPI apps may reject this transaction." |
| FR-BANK-004 | IMPS | Real-time, 24x7 | Maximum Rs 5,00,000 | Alphanumeric, 12-16 characters | Basic non-empty validation. Warn if amount > Rs 5,00,000. | Show "Instant settlement, 24x7" hint. |
| FR-BANK-005 | Cheque | 1-3 business days (CTS clearing) | No statutory limit | 6-digit numeric (MICR cheque number) | Regex: `/^\d{6}$/`. Reject non-numeric or wrong length. | Show `chequeNumber` field instead of UTR. |
| FR-BANK-006 | Cash | Instant | Legal limit Rs 2,00,000 per Section 40A(3) (E21) | N/A (no UTR) | Hide UTR field. Emit `CASH_PAYMENT_ABOVE_LIMIT` if > Rs 2,00,000. | Show prominent warning about Section 40A(3). |
| FR-BANK-007 | Other | Varies | No limit | Free-text, required | Non-empty validation. | Show free-text "Reference Number" and "Description" fields. |

#### Reconciliation Date Tolerance

**FR-BANK-008**: Reconciliation date proximity scoring shall use business days (excluding weekends and Indian gazetted holidays). A tolerance of +/-2 business days shall be applied: matches within 2 business days receive full date score (10 points). [VKL: D-023]

---

### 4.6 Payment Approval & Runs

#### Payment Approval Workflow

**User Story US-PAY-007 (Finance Controller):** "As a finance controller, I need to require approval before payments are processed so that no funds leave the company without proper authorization."

| ID | Requirement | VKL Ref |
|---|---|---|
| FR-PAY-026 | The ApprovalWorkflow model shall be extended with `workflowType` (enum: `invoice`, `payment`; default: `invoice`). | D-002 |
| FR-PAY-027 | When a payment approval workflow is enabled, payments shall enter `draft` and require `POST /api/payments/:id/approve` before transitioning to `approved` -> `processed`. | D-002 |
| FR-PAY-028 | When no payment approval workflow is enabled, payments shall auto-progress from `draft` to `processed`. | D-002 |
| FR-PAY-029 | Payment approval shall require `requireCap("canApprovePayments")`, separate from `canApproveInvoices`. | D-036 |
| FR-PAY-030 | The approval endpoint shall reuse existing `approvalWorkflowService` step-evaluation logic with `workflowType="payment"`. Step conditions may reference `amountMinor`, `method`, and `vendorFingerprint`. | D-002 |

#### Payment Run (Batch Processing)

**User Story US-PAY-008 (AP Clerk):** "As an AP clerk, I need to process all due payments for the week in one batch, grouped by vendor."

| ID | Requirement | VKL Ref |
|---|---|---|
| FR-PAY-031 | The system shall provide a PaymentRun model with fields: `tenantId`, `runDate`, `status` (draft/approved/processed/cancelled), `paymentIds[]`, `totalAmountMinor`, `createdBy`. | D-015 |
| FR-PAY-032 | When creating a payment run, the system shall group selected invoices by `vendorFingerprint` and create one Payment per vendor. | D-015 |
| FR-PAY-033 | The payment run's `totalAmountMinor` shall equal the sum of all constituent payments' `amountMinor`. | D-015 |
| FR-PAY-034 | Processing a payment run shall process all constituent payments atomically. If any fails, the entire run fails. | D-015 |
| FR-PAY-035 | Bank upload file generation (NEFT H2H, RTGS bulk XML) is deferred to post-MVP. The PaymentRun model shall include a `bankFileUrl` field (nullable). | D-015 |

---

### 4.7 Advance Payments & Reversals

#### Advance Payments

**User Story US-PAY-005 (AP Clerk):** "As an AP clerk, I need to record an advance payment to a vendor before their invoice arrives, so that when the invoice is approved, I can allocate the advance against it."

| ID | Requirement | VKL Ref |
|---|---|---|
| FR-PAY-016 | The system shall support `type="advance"` payments where `allocations` is empty at creation time. | D-011 |
| FR-PAY-017 | Advance payments shall expose `POST /api/payments/:id/allocate` accepting `{ invoiceId, allocatedMinor }`. | D-011 |
| FR-PAY-018 | The allocation endpoint shall validate vendor fingerprint match, APPROVED/EXPORTED status, and sufficient unallocated balance. | D-011 |
| FR-PAY-019 | Unallocated advance balance = `amountMinor - sum(allocations[].allocatedMinor)`, exposed as `unallocatedMinor` in GET response. | D-011 |
| FR-PAY-020 | An advance payment shall be listed in the vendor detail view with its unallocated balance prominently displayed. | D-011 |

#### Payment Reversal

**User Story US-PAY-006 (Finance Controller, Bounced Cheque):** "As a finance controller, I need to record a bounced cheque or failed NEFT so that the invoice's outstanding balance is restored and the original payment record remains intact for audit."

| ID | Requirement | VKL Ref |
|---|---|---|
| FR-PAY-021 | The system shall support `type="reversal"` payments with a required `reversesPaymentId` referencing a `processed` payment. | D-012 |
| FR-PAY-022 | A reversal shall auto-populate `allocations` from the original payment. Clerk may adjust amounts downward (partial reversal) but not upward. | D-012 |
| FR-PAY-023 | On reversal reaching `processed` status, the system shall atomically decrement each invoice's `paidAmountMinor` and recompute `paymentStatus`. | D-012 |
| FR-PAY-024 | The original payment document shall never be mutated after reaching `processed` status. | C-009 |
| FR-PAY-025 | A payment may not be reversed after it has been fully reversed (sum of all reversal allocations equals original payment allocations). Partial reversals are permitted, and subsequent partial reversals are allowed until the original payment is fully reversed. Attempting to create a reversal that would cause total reversed amounts to exceed original allocation amounts shall return HTTP 409 with the remaining reversible amount per allocation. | D-012 |

---

### 4.8 Reconciliation Enhancement

**Current State:** `ReconciliationService.ts` performs 1:1 scoring-based matching. It writes inline fields on both `BankTransaction` and `Invoice`. No split/aggregate matching. Amount matching uses gross amounts, not TDS-adjusted. No date tolerance for business days.

#### Functional Requirements

| ID | Requirement | VKL Ref |
|---|---|---|
| FR-REC-001 | The system shall introduce a ReconciliationMapping junction model with fields: `tenantId`, `bankTransactionId`, `invoiceId`, `paymentId` (nullable), `allocatedMinor` (integer-validated), `matchConfidence` (0-100), `matchMethod` (auto/suggested/manual), `createdBy`. Unique compound index on `{tenantId, bankTransactionId, invoiceId}`. | RC-002, D-003 |
| FR-REC-002 | **Split matching (one bank transaction -> many invoices):** After the 1:1 pass, for each remaining unmatched debit transaction, attempt subset-sum combinations of up to 10 invoices from the same vendor. If sum matches within Rs 1 tolerance (E19), create ReconciliationMapping rows with `matchMethod="suggested"`. | D-016, E19 |
| FR-REC-003 | **Aggregate matching (many bank transactions -> one invoice):** For each remaining unmatched invoice, find unmatched transactions with vendor reference overlap. If sum equals net payable within tolerance, suggest aggregate mapping. | D-016 |
| FR-REC-004 | **TDS-adjusted amount matching:** Compare `bankTransaction.debitMinor` against `expectedDebit = invoice.compliance.tds.netPayableMinor + invoice.compliance.tcs.amountMinor` (not `parsed.totalAmountMinor`). Fall back to gross when TDS/TCS absent. | C-011 |
| FR-REC-005 | **Date tolerance:** +/-2 business days (excluding weekends and Indian gazetted holidays). Matches within 2 business days receive full date score (10 points). | D-023 |
| FR-REC-006 | Expose `POST /api/reconciliation-mappings`, `GET /api/reconciliation-mappings?statementId=X`, `DELETE /api/reconciliation-mappings/:id`. Auth: `requireAuth`, `requireCap("canApproveInvoices")`. | D-003 |
| FR-REC-007 | Validate sum of all mappings for a `bankTransactionId` does not exceed `debitMinor`. | D-003 |
| FR-REC-008 | Validate sum of all mappings for an `invoiceId` does not exceed net payable. | D-003 |
| FR-REC-009 | **Migration:** Existing inline fields (`BankTransaction.matchedInvoiceId`, `Invoice.compliance.reconciliation.bankTransactionId`) migrated to ReconciliationMapping via idempotent backfill. Dual-write during transition, then cut over behind feature flag. | D-003 |
| FR-REC-010 | Split matching limited to 10 candidate invoices per subset-sum evaluation. When more than 10 unmatched invoices exist for a vendor, apply greedy pre-filter: (1) sort candidate invoices by `netPayableMinor` descending, (2) include invoices while `runningSum <= transactionDebitMinor`, (3) if the resulting candidate set exceeds 10, retain the top 10 by amount proximity to the target debit (i.e., `abs(netPayableMinor - remainingTarget)` ascending). This ensures the subset-sum search space is bounded to 2^10 = 1,024 combinations maximum. Performance bound: pre-filter + subset-sum evaluation shall complete within 500ms per transaction for up to 100 candidate invoices per vendor. | D-016 |
| FR-REC-011 | Reconciliation UI: split-pane view with bank transactions on left, candidate invoices on right. TDS-adjusted amounts shown alongside gross. Manual drag-and-drop or checkbox assignment. | D-008 |
| FR-REC-012 | Auto-suggested split/aggregate mappings visually distinct from 1:1 matches (dashed border, badge) and require explicit user confirmation. | D-016 |

#### Reconciliation Accuracy Benchmark

Reconciliation accuracy is measured against 3 anonymized monthly bank statements from pilot firms, manually labeled with correct transaction-to-invoice matches. This ground truth dataset serves as the benchmark for all reconciliation algorithm changes.

**Auto-match rate** = correct auto-matches / total matches in ground truth.

A "correct auto-match" is one where the system's auto-matched {bankTransactionId, invoiceId} pair exactly matches a pair in the ground truth. Suggested matches (requiring user confirmation) are counted separately. The benchmark must be re-run and pass before any reconciliation algorithm change is merged.

#### Reconciliation Reporting

| ID | Requirement | VKL Ref |
|---|---|---|
| FR-REC-013 | `GET /api/reports/reconciliation?statementId=X` returns: `totalTransactions`, `matchedCount`, `suggestedCount`, `unmatchedCount`, `matchRate`, `totalDebitMinor`, `matchedDebitMinor`, `unmatchedDebitMinor`, `valueGapMinor`. | D-018 |
| FR-REC-014 | Report includes `unmatchedTransactions[]` with `date`, `description`, `debitMinor`, `daysUnreconciled`. | D-018 |
| FR-REC-015 | Report includes `unmatchedInvoices[]`: APPROVED/EXPORTED invoices with no ReconciliationMapping, sorted by `parsed.dueDate` ascending. | D-018 |
| FR-REC-016 | Cross-statement aggregate view at `GET /api/reports/reconciliation/summary` with match rates and value gaps across date range. | D-018 |

---

### 4.9 MSME Compliance

**Statutory Basis:** MSMED Act 2006, Section 15 (E4): Payment to micro/small enterprises within agreed period or 45 days, whichever is shorter. Interest: 3x RBI bank rate, compounded monthly (E16).

**User Story US-MSME-001 (Finance Controller):** "As a finance controller, I need to see which invoices from MSME vendors are approaching or past their payment deadline so I can prioritize them."

#### Functional Requirements

| ID | Requirement | VKL Ref |
|---|---|---|
| FR-MSME-001 | VendorMaster shall store `msme.classification` (micro/small/medium) and `msme.udyamNumber`. | D-014 |
| FR-MSME-002 | VendorMaster shall be extended with `msme.agreedPaymentDays` (integer, nullable). Default: null (statutory 45 days). | D-014 |
| FR-MSME-003 | When invoice parsed for MSME vendor (micro/small), compute `compliance.msme.paymentDeadline` as `invoiceDate + min(agreedPaymentDays ?? 45, 45)` days. | C-003, E4 |
| FR-MSME-004 | `MSME_PAYMENT_DUE_SOON` risk signal fires when within 7 days of deadline AND `paymentStatus` is unpaid/partially_paid. Severity: warning. | D-014 |
| FR-MSME-005 | `MSME_PAYMENT_OVERDUE` risk signal fires when past deadline AND `paymentStatus` is unpaid/partially_paid. Severity: critical. | D-014 |
| FR-MSME-006 | MSME risk signals re-evaluated nightly via scheduled job. Auto-resolved when invoice transitions to `fully_paid`. | D-014 |
| FR-MSME-007 | Interest calculation per MSMED Act Section 16: `interest = principal * ((1 + 3 * bankRate / 100 / 12) ^ months - 1)`. The rate is 3x the RBI bank rate, compounded monthly. Bank rate stored in system config. Fractional months rounded up to full months. Worked example: Rs 1,00,000 overdue for 3 months at 6% bank rate: monthly rate = 3 * 6 / 100 / 12 = 0.015 (1.5%); interest = 1,00,000 * ((1 + 0.015)^3 - 1) = 1,00,000 * (1.045678 - 1) = Rs 4,568. | E16 |
| FR-MSME-008 | `GET /api/reports/msme-liability` returns total overdue, interest liability, breakdown by classification, per-vendor detail. | D-014 |
| FR-MSME-009 | Medium enterprises tracked for visibility but NOT subject to 45-day statutory deadline. Risk signals fire only for micro and small. | C-003 |
| FR-MSME-010 | Vendor CRUD (`PATCH /api/vendors/:fingerprint`) allows updating `msme.classification`, `msme.udyamNumber`, `msme.agreedPaymentDays`. Changes trigger recomputation of `paymentDeadline` on all unpaid invoices. | D-014 |

#### MSME Risk Signal Specification

| Signal Code | Severity | Trigger Condition | Message Template |
|---|---|---|---|
| `MSME_PAYMENT_OVERDUE` | critical | `today > paymentDeadline` AND `paymentStatus IN (unpaid, partially_paid)` AND `msme.classification IN (micro, small)` | "Payment to MSME vendor {vendorName} is {daysOverdue} days past the statutory 45-day deadline. Estimated interest: Rs {interestAmount}." |
| `MSME_PAYMENT_DUE_SOON` | warning | `paymentDeadline - today <= 7 days` AND `paymentDeadline >= today` AND `paymentStatus IN (unpaid, partially_paid)` AND `msme.classification IN (micro, small)` | "Payment to MSME vendor {vendorName} is due in {daysRemaining} days (deadline: {deadlineDate})." |

#### MSME Dashboard

The MSME Dashboard is a section within Reports, accessible to users with `canApproveInvoices`.

**Layout:**
1. **Summary Cards** (3): Total Overdue to MSME, Estimated Interest Liability, Vendors At Risk
2. **Aging by Classification** (horizontal stacked bar chart): X-axis: aging buckets; Segments: Micro (red), Small (orange), Medium (yellow)
3. **Vendor Detail Table** (paginated, sortable): Vendor Name, Classification, Udyam Number, Overdue Invoices, Overdue Amount, Days Overdue (max), Interest Liability, Agreed Terms

#### Aging Report

**User Story US-AGING-001 (Finance Controller):** "As a finance controller, I need a standard AP aging report bucketed by days past due so I can manage cash flow, identify delinquent invoices, and report to management."

| ID | Requirement | VKL Ref |
|---|---|---|
| FR-AGING-001 | `GET /api/reports/payment-aging` returns invoice counts and amounts grouped by aging buckets: Current (not past due), 1-30, 31-60, 61-90, 90+ days past due. Bucket assignment based on `parsed.dueDate` relative to current date in IST. | D-018 |
| FR-AGING-002 | Report includes only invoices with `paymentStatus IN (unpaid, partially_paid)` and `status IN (APPROVED, EXPORTED)`. | D-018 |
| FR-AGING-003 | Each bucket reports: `invoiceCount`, `totalOutstandingMinor` (sum of netPayableMinor - paidAmountMinor), `msmeInvoiceCount`, `msmeOutstandingMinor` (MSME vendors flagged separately per C-003). | D-018, C-003 |
| FR-AGING-004 | Optional `vendorFingerprint` filter for single-vendor aging. | D-018 |
| FR-AGING-005 | Each bucket drillable: response includes `invoiceIds[]`, frontend links count to filtered invoice list. | D-018 |
| FR-AGING-006 | Invoices without `parsed.dueDate` placed in "No Due Date" bucket with `MISSING_MANDATORY_FIELDS` risk signal. | D-018 |

---

### 4.10 Tally Purchase Voucher Fixes

**User Story**: "As a CA, I need Tally import to produce invoice-mode vouchers with bill tracking so I can reconcile payments and file GST returns from Tally."

**Priority**: P0 -- Execute immediately (1-2 day effort)

**Current state in code** (`backend/src/services/export/tallyExporter/xml.ts`): `ISINVOICE=No` hardcoded, `LEDGERENTRIES.LIST` non-canonical, no `REFERENCE`, `EFFECTIVEDATE`, `BILLALLOCATIONS.LIST`, `PLACEOFSUPPLY`, `GUID`, or XML declaration.

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-TALLY-001 | All ledger entry elements must use `<ALLLEDGERENTRIES.LIST>` instead of `<LEDGERENTRIES.LIST>`. | Every occurrence replaced. Batch and single-voucher builders both emit canonical tag. All existing tests updated. |
| FR-TALLY-002 | `ISINVOICE` must be `Yes` for all purchase vouchers. | Voucher imports as invoice mode in Tally. Appears in outstanding reports, aging, and GST data. |
| FR-TALLY-003 | Party ledger entry must include `BILLALLOCATIONS.LIST` with `BILLTYPE=New Ref` and `NAME` = invoice number. | Bill created in Tally's subledger. Matches the `REFERENCE` value. |
| FR-TALLY-004 | Voucher must include `<REFERENCE>{invoiceNumber}</REFERENCE>`. | Reference matches `BILLALLOCATIONS.LIST NAME` and `VOUCHERNUMBER`. Available for payment matching in Tally. |
| FR-TALLY-005 | Voucher must include `<EFFECTIVEDATE>{YYYYMMDD}</EFFECTIVEDATE>`. | Tally calculates credit period from this date. Defaults to invoice date if no specific effective date. |
| FR-TALLY-006 | Include `<PLACEOFSUPPLY>` derived from vendor GSTIN first 2 digits. | GSTIN state code table (01-38) maps to state names. Stored on VendorMaster. Omitted when GSTIN absent. |
| FR-TALLY-007 | Each voucher includes `<GUID>` from `SHA-256(tenantId:invoiceId:exportVersion)`. First export uses `ACTION="Create"`, subsequent use `ACTION="Alter"`. | Export version tracked on invoice `export` subdocument. Re-import updates rather than duplicates. |
| FR-TALLY-007a | In file-based export mode (Phases 0-5, no desktop bridge), `exportVersion` shall increment only upon confirmed import, not upon file download. Re-downloading the same export uses the same GUID and `ACTION="Create"` until the user explicitly confirms successful Tally import via `POST /api/exports/tally/confirm/:batchId`. Upon confirmation: (1) `exportVersion` increments on all invoices in the batch, (2) `ExportBatch.confirmedAt` is set, (3) subsequent exports for the same invoices use `ACTION="Alter"` with the new GUID. If the user re-exports without confirming the prior batch, the system reuses the same `exportVersion` and GUID, producing identical XML (idempotent re-download). | Prevents GUID mismatch when users download XML multiple times before importing into Tally. Confirmation endpoint returns HTTP 200 with `{ confirmed: true, invoicesUpdated: N }`. Confirming an already-confirmed batch returns HTTP 200 (idempotent). |
| FR-TALLY-008 | XML begins with `<?xml version="1.0" encoding="UTF-8"?>`. | UTF-8 encoded. Non-ASCII characters preserved correctly. |
| FR-TALLY-009 | Include `<BASICBUYERNAME>{companyName}</BASICBUYERNAME>`. | Value from `TenantExportConfig.tallyCompanyName` or tenant company name. |
| FR-TALLY-010 | All GST ledger entries (CGST, SGST, IGST, Cess) use `ALLLEDGERENTRIES.LIST`. Intra/inter-state logic unchanged. | Total of all entries balances to zero. Purchase ledger = taxable base. |
| FR-TALLY-011 | TDS ledger entry uses `ALLLEDGERENTRIES.LIST` with `ISDEEMEDPOSITIVE=Yes` and negative amount. | Entry appears only when TDS > 0. Party ledger reflects `netPayableMinor`. Accounting balances. |
| FR-TALLY-012 | Batch export: up to 100 vouchers per `<TALLYMESSAGE>`. Split for larger batches. One HTTP POST per batch. | Per-invoice success/failure tracked. [VKL: D-029, C-018] |
| FR-TALLY-013 | `<NARRATION>` includes vendor name, invoice number, LedgerBuddy ref. Truncated to 255 chars. XML-escaped. | Structured narrations enable identification without opening vouchers. |
| FR-TALLY-014 | `<PARTYGSTIN>` present when vendor has GSTIN. | GSTIN validated as 15-char alphanumeric before inclusion. |
| FR-TALLY-015 | Invoice `export.exportVersion` counter increments on each export. Used in GUID (FR-TALLY-007). | Version tracking enables safe re-export and audit trail. |

#### Corrected Purchase Voucher XML Structure

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

          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>{purchaseLedger}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>{taxableAmount}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>

          <!-- GST Ledgers (CGST/SGST or IGST) -->
          <!-- TDS Payable (if applicable) -->
        </VOUCHER>
      </TALLYMESSAGE>
    </DATA>
  </BODY>
</ENVELOPE>
```

#### PLACEOFSUPPLY State Code Reference

| Code | State | Code | State | Code | State |
|------|-------|------|-------|------|-------|
| 01 | Jammu & Kashmir | 14 | Manipur | 26 | Dadra & Nagar Haveli |
| 02 | Himachal Pradesh | 15 | Mizoram | 27 | Maharashtra |
| 03 | Punjab | 16 | Tripura | 29 | Karnataka |
| 04 | Chandigarh | 17 | Meghalaya | 30 | Goa |
| 05 | Uttarakhand | 18 | Assam | 32 | Kerala |
| 06 | Haryana | 19 | West Bengal | 33 | Tamil Nadu |
| 07 | Delhi | 20 | Jharkhand | 34 | Puducherry |
| 08 | Rajasthan | 21 | Odisha | 35 | Andaman & Nicobar |
| 09 | Uttar Pradesh | 22 | Chhattisgarh | 36 | Telangana |
| 10 | Bihar | 23 | Madhya Pradesh | 37 | Andhra Pradesh |
| 11 | Sikkim | 24 | Gujarat | 38 | Ladakh |
| 12 | Arunachal Pradesh | 25 | Daman & Diu | | |
| 13 | Nagaland | | | | |

---

### 4.11 Tally Payment Voucher Export

**User Story**: "As a finance controller, I need to export payment vouchers to Tally so vendor outstanding balances are updated automatically when payments are recorded in LedgerBuddy."

**Priority**: P1 -- MVP (depends on Phase 3)

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-TALLY-020 | Generate Tally Payment Voucher XML with bank ledger entry (credit) and vendor ledger entry (debit) settling outstanding bills. | XML structure: `VOUCHER VCHTYPE="Payment" ACTION="Create"`, `ALLLEDGERENTRIES.LIST` for bank and vendor. `EFFECTIVEDATE` = payment date. `NARRATION` = "Payment to {vendorName} \| Ref: {utrNumber}". GUID = `SHA-256(tenantId:paymentId:1)`. |
| FR-TALLY-021 | Vendor ledger entry must contain `BILLALLOCATIONS.LIST` with `BILLTYPE="Agst Ref"` referencing the purchase voucher's `REFERENCE`. | `NAME` exactly matches original `REFERENCE` (invoice number). After import, purchase voucher outstanding reduced by allocated amount. |
| FR-TALLY-022 | Multi-invoice payment produces one voucher with N `BILLALLOCATIONS.LIST` entries under the vendor ledger. | Sum of all allocation amounts equals total payment amount. Each invoice's outstanding reduced independently. |
| FR-TALLY-023 | Bank ledger name configurable per tenant via `TenantExportConfig.tallyBankLedger`. Falls back to env var `TALLY_BANK_LEDGER` (default: "Bank Account"). | Admin UI exposes in tenant config. |
| FR-TALLY-024 | Batch payment voucher export via `POST /api/exports/tally/payment-vouchers` accepting `{ paymentIds: string[] }`. Up to 100 per batch. Per-payment success/failure. | Failed payments do not block successful ones. ExportBatch record created. |
| FR-TALLY-025 | Partial payment voucher: `BILLALLOCATIONS.LIST AMOUNT` = partial payment amount, not full invoice amount. | After import, Tally shows reduced but non-zero outstanding for that invoice. |

#### Payment Voucher XML Structure

```xml
<VOUCHER VCHTYPE="Payment" ACTION="Create" OBJVIEW="Accounting Voucher View">
  <DATE>{YYYYMMDD}</DATE>
  <EFFECTIVEDATE>{YYYYMMDD}</EFFECTIVEDATE>
  <GUID>{sha256(tenantId:paymentId:1)}</GUID>
  <VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>
  <VOUCHERNUMBER>{paymentNumber}</VOUCHERNUMBER>
  <NARRATION>Payment to {vendorName} | Ref: {utrNumber}</NARRATION>

  <ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>{bankLedgerName}</LEDGERNAME>
    <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
    <AMOUNT>-{paymentAmount}</AMOUNT>
  </ALLLEDGERENTRIES.LIST>

  <ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>{vendorLedgerName}</LEDGERNAME>
    <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
    <AMOUNT>{paymentAmount}</AMOUNT>
    <BILLALLOCATIONS.LIST>
      <NAME>{invoiceNumber}</NAME>
      <BILLTYPE>Agst Ref</BILLTYPE>
      <AMOUNT>{allocatedAmount}</AMOUNT>
    </BILLALLOCATIONS.LIST>
  </ALLLEDGERENTRIES.LIST>
</VOUCHER>
```

---

### 4.12 Pre-Export Validation

**User Story**: "As an AP clerk, I want the system to check for problems before I export, so I don't waste time with failed Tally imports."

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-TALLY-030 | GL code assignment check: every invoice must have a GL code assigned. | Invoices without `compliance.glCode.code` fail. Message: "No GL code assigned." Per-invoice check. |
| FR-TALLY-031 | Vendor PAN presence check for TDS-applicable invoices. | Invoices with `tdsAmountMinor > 0` where `vendor.pan` is null fail. Message: "Vendor PAN missing." |
| FR-TALLY-032 | Critical risk signal check. | Invoices with unresolved critical-severity signals fail. Warning-severity produces warning but does not fail. |
| FR-TALLY-033 | Amount reconciliation check: `totalAmount = subtotal + totalGST`, `netPayable = totalAmount - TDS + TCS`. | Mismatch beyond Rs 1 tolerance fails. Shows expected vs actual. |
| FR-TALLY-034 | Vendor existence check in Tally (Phase 6 only, when desktop bridge available). | Fuzzy match vendor names. Auto-create if `autoCreateVendors` enabled. Skip in file-export mode. |
| FR-TALLY-035 | Pre-export validation modal before generating XML. Checklist with pass/fail/warn per invoice, grouped by validation type. | Three actions: "Export Valid Only", "Export All" (with confirmation), "Cancel". Count of valid vs invalid shown. |
| FR-TALLY-036 | Selective exclusion: each invoice has checkbox (default: checked for valid, unchecked for invalid). Users can override. | Force-included invalid invoices tagged with validation warnings in export history. |
| FR-TALLY-037 | Each failing invoice in the validation modal shows an [Edit] link that opens the invoice detail panel in a slide-over. After fixing the issue (e.g., assigning GL code, adding vendor PAN), a "Revalidate" button re-runs all validation checks on the current selection without requiring invoice re-selection or modal dismissal. Revalidation updates pass/fail/warn counts and status per invoice in real time. | Clicking [Edit] opens invoice detail. Fixing the field and clicking "Revalidate" transitions the invoice from FAIL to PASS if the issue is resolved. No full-page navigation required. |

**Pre-Export Validation Modal Wireframe:**

```
+--------------------------------------------------+
|  Pre-Export Validation  (15 invoices)             |
+--------------------------------------------------+
|                                                    |
|  [PASS] GL codes assigned              15/15      |
|  [PASS] Vendor PAN present             15/15      |
|  [FAIL] Vendor name valid              13/15      |
|         > INV-045: "Unknown Vendor"    [Edit]     |
|         > INV-051: empty vendor name   [Edit]     |
|  [WARN] Risk signals unresolved         1/15      |
|         > INV-023: DUPLICATE_AMOUNT    [Edit]     |
|  [PASS] Invoice totals balanced        15/15      |
|                                                    |
|  [Revalidate]                                      |
|  [Export 13 valid]  [Export all 15]  [Cancel]      |
+--------------------------------------------------+
```

---

### 4.13 Export History & Re-Export

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-TALLY-040 | Per-invoice status in export batch. `ExportBatch.items` array with `{ invoiceId, invoiceNumber, vendorName, success, error, voucherType }`. Expandable row per batch in UI. | Failed invoices show specific Tally `LINEERROR` message. |
| FR-TALLY-041 | Re-export failed invoices only. "Re-export Failed" button on batches with failures. Pre-selects failed invoices and opens validation modal. Uses `ACTION="Create"` for never-exported, `ACTION="Alter"` for corrections. | New ExportBatch linked to original. |
| FR-TALLY-042 | Download original XML from S3. "Download XML" button in export history. | `Content-Type: application/xml`, `Content-Disposition: attachment`. 90-day retention. |
| FR-TALLY-043 | Export progress indicator via SSE for batches > 10 invoices. | Progress messages: "Validating...", "Building XML ({n}/{total})...", "Uploading...", "Complete. {success} succeeded, {fail} failed." |

**Export History Wireframe:**

```
+------------------------------------------------------------------+
| Export History                                                      |
+------+--------+------+-----+------+--------+------------------+   |
| Date | System | Total| Pass| Fail | User   | Actions          |   |
+------+--------+------+-----+------+--------+------------------+   |
|Apr 15| Tally  |   15 |  12 |    3 | alice@ | [v] [Download]   |   |
|      |        |      |     |      |        | [Re-export Failed]|  |
+------+--------+------+-----+------+--------+------------------+   |
  v Expanded:                                                        |
  +----------+---------+--------+------------------------------+    |
  | Invoice  | Vendor  | Status | Error                        |    |
  +----------+---------+--------+------------------------------+    |
  | INV-001  | Acme    |  Pass  | --                           |    |
  | INV-003  | Gamma   |  FAIL  | Ledger "Gamma Inc" not found |    |
  +----------+---------+--------+------------------------------+    |
+------------------------------------------------------------------+
```

---

### 4.14 Vendor Management

#### Vendor List

**User Story**: "As a finance controller, I need to see all vendors with their PAN, GSTIN, TDS section, and Tally sync status."

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-VENDOR-001 | `GET /api/vendors` returns paginated, searchable, filterable vendor list. Params: `search`, `page`, `limit` (default 20), `status`, `sort`, `order`. Auth: all roles (VIEWER read-only). | Returns `{ items, page, limit, total }`. |
| FR-VENDOR-002 | Vendor list columns: Name (with alias count), PAN, GSTIN, TDS Section, Tally Status (synced/pending/not_synced), Invoice Count, Last Invoice, Status (active/inactive/blocked), Actions. | Color-coded status badges. |
| FR-VENDOR-003 | Search matches name, aliases, PAN, GSTIN. Debounced (300ms). PAN/GSTIN use prefix matching. | Empty search returns all (respecting filters). |
| FR-VENDOR-004 | Filter tabs: All, Active, Inactive, Blocked. Default: Active. Counts on each tab. | "Active (42)", "Blocked (3)" format. |

#### Vendor Detail

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-VENDOR-005 | `GET /api/vendors/:fingerprint` returns full profile with invoices, TDS summary (per FY from TdsVendorLedger), payment summary, bank history. | Computed fields included. |
| FR-VENDOR-006 | Invoice section: Invoice Number, Date, Amount, GST, TDS, Net Payable, Status, Payment Status. Sortable, filterable, paginated. | Clicking navigates to invoice detail. |
| FR-VENDOR-007 | TDS summary per FY: Financial Year, Section, Cumulative Base, Cumulative TDS, Threshold, Threshold Status, Invoice Count. Current FY highlighted. | Remaining amount shown for "Below threshold" rows. |
| FR-VENDOR-008 | Payment history: Total Invoiced, Total Paid, Total Outstanding. Payment list when Payment model exists. | Derived from invoice `paidAmountMinor` before Phase 3. |
| FR-VENDOR-009 | Bank history with change detection: Bank Name, IFSC, Account Hash (masked), First Seen, Last Seen, Invoice Count. "Bank details changed" alert for new accounts. | Most recent highlighted. |
| FR-VENDOR-010 | MSME section: Udyam Number, Classification, Verified Date. Outstanding invoices > 38 days show approaching warning; > 45 days show overdue alert. | Section visible only when classification set. |

#### Vendor Editing

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-VENDOR-011 | `PATCH /api/vendors/:fingerprint` updates: `tallyLedgerName`, `defaultGlCode`, `defaultCostCenter`, `defaultTdsSection`, `vendorStatus`, `msme.udyamNumber`, `msme.classification`. Non-updatable: fingerprint, name, pan, gstin. All create AuditLog. Auth: `requireNotViewer`. | Validation: tallyLedgerName max 100 chars; glCode must exist in tenant GL list. |
| FR-VENDOR-012 | `POST /api/vendors/:fingerprint/cert` uploads Section 197 certificate. Body: `{ certificateNumber, validFrom, validTo, maxAmountMinor, applicableRateBps }`. | `validTo` must be future. `applicableRateBps` <= standard rate. AuditLog created. Risk signal emitted on use. |
| FR-VENDOR-013 | Vendor status management: `active` (normal), `inactive` (informational), `blocked` (emits `VENDOR_BLOCKED` critical risk signal, invoice cannot be approved until unblocked). | Status changes create AuditLog. |

#### Vendor Merge (Phase 5 / Post-MVP)

Vendor merge and duplicate detection are deferred from Phase 2 to Phase 5 or post-MVP. Vendor CRUD, certificate upload, and Tally sync fields remain in Phase 2.

| ID | Requirement | Phase | Acceptance Criteria |
|---|---|---|---|
| FR-VENDOR-014 | `POST /api/vendors/:fingerprint/merge` absorbs source into target. Reassigns invoices, appends aliases, merges bank history, migrates TdsVendorLedger entries. Source deleted. Runs in MongoDB transaction. Auth: TENANT_ADMIN minimum. | Phase 5 | Idempotent. AuditLog records both fingerprints. |
| FR-VENDOR-015 | Duplicate vendor detection: normalized name comparison, Levenshtein distance < 3, shared PAN. "Possible Duplicates" section on vendor detail. | Phase 5 | Vendors with same PAN always flagged. Merge button initiates FR-VENDOR-014 flow. |

**FR-VENDOR-014a: Vendor Merge TdsVendorLedger Algorithm**

On merge, for each `TdsVendorLedger` document belonging to the source vendor:

1. Find the matching target document by `{tenantId, targetVendorFingerprint, financialYear, section}`.
2. If a matching target document exists: sum `cumulativeBaseMinor` and `cumulativeTdsMinor` from source into target. Append all source `entries` to target `entries` array. Update `invoiceCount` accordingly.
3. If no matching target document exists: update the source document's `vendorFingerprint` to the target fingerprint (re-parent).
4. If merged `cumulativeBaseMinor` exceeds `thresholdAnnualMinor` and neither individual vendor had crossed the threshold before merge (both `thresholdCrossedAt` were null), emit `TDS_MERGE_THRESHOLD_CROSSED` risk signal with severity "warning" and message: "Vendor merge caused cumulative base (Rs {amount}) to exceed threshold (Rs {threshold}) for section {section} in FY {fy}. Neither source nor target vendor had individually crossed this threshold."
5. Do NOT retroactively recompute TDS on historical invoices. Existing TDS amounts on all invoices remain unchanged.
6. Delete the source `TdsVendorLedger` document after successful merge.

All operations execute within the same MongoDB transaction as the vendor merge.

**Vendor Merge Confirmation Wireframe:**

```
+------------------------------------------------------------------+
|  Merge Vendors                                            [x Close] |
+------------------------------------------------------------------+
|                                                                    |
|  SOURCE (will be deleted)        TARGET (will be kept)             |
|  +--------------------------+    +--------------------------+      |
|  | ACME CORPN PVT LTD      |    | Acme Corporation Pvt Ltd |      |
|  | PAN: ABCDE1234F          | -> | PAN: ABCDE1234F          |      |
|  | GSTIN: 29ABCDE1234F1Z5   |    | GSTIN: 29ABCDE1234F1Z5   |      |
|  | Status: Active            |    | Status: Active            |      |
|  +--------------------------+    +--------------------------+      |
|                                                                    |
|  Affected Entities:                                                |
|  +------------------------------------------------------------+   |
|  |  7 invoices will be reassigned to target vendor             |   |
|  |  2 TDS ledger entries (FY 2025-26: 194C, 194J) will merge  |   |
|  |  3 bank records will be appended to target history          |   |
|  +------------------------------------------------------------+   |
|                                                                    |
|  [!] WARNING: This action cannot be undone. The source vendor      |
|  "ACME CORPN PVT LTD" will be permanently deleted. All invoices,  |
|  TDS ledger entries, and bank records will be moved to the         |
|  target vendor.                                                    |
|                                                                    |
|  [Cancel]                              [Merge Vendors]             |
+------------------------------------------------------------------+
```

#### Tally Vendor Sync (Phase 6)

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-VENDOR-020 | Sync vendor list from Tally: fetch Sundry Creditor ledgers, compare with LedgerBuddy records. Match: exact name, then tallyLedgerName, then fuzzy. | Results: matched, unmatched_in_ledgerbuddy, unmatched_in_tally. |
| FR-VENDOR-021 | Auto-create vendors in Tally when `autoCreateVendors` enabled. Generate ledger XML with NAME, PARENT, GSTIN, PANIT, ISBILLWISEON=Yes. | Failed auto-creation excludes invoices from export batch. |
| FR-VENDOR-022 | `tallySyncStatus` field on VendorMaster: not_synced (default), synced, pending_create, created_in_tally. | Vendor list shows colored indicator. |
| FR-VENDOR-023 | Conflict detection during sync: compare GSTIN, PAN, state. Report conflicts. Do not block export. | User can update LedgerBuddy or Tally data. AuditLog for resolutions. |

**Vendor List Wireframe:**

```
+------------------------------------------------------------------+
| VENDORS (147)                                    [Search...    ]  |
+------------------------------------------------------------------+
| Name            | PAN        | TDS  | Tally  | Inv# | Status     |
+-----------------+------------+------+--------+------+------------+
| Acme Corp Ltd   | AADCA1234K | 194C | Synced |   12 | Active     |
| Beta Services   | BBBPB5678L | 194J | Pending|    3 | Active     |
| Gamma Traders   | -          | -    | -      |    1 | Active     |
+-----------------+------------+------+--------+------+------------+
| [All (87)] [Active (72)] [Inactive (12)] [Blocked (3)]           |
+------------------------------------------------------------------+
```

**Vendor Detail Wireframe:**

```
+------------------------------------------------------------------+
| < Back to Vendors                                                  |
| ACME CORPORATION PVT LTD                     Status: [Active  v]  |
| Aliases: Acme Corp, ACME CORP PVT LTD                             |
+-------------------+-------------------+------------------------+   |
| PAN: ABCDE1234F   | GSTIN: 29ABCDE..  | TDS: 194C (Contractors)|  |
| Tally: Acme Corp  | GL: 5010-Prof.Svc | State: Karnataka       |  |
+-------------------+-------------------+------------------------+   |
|                                                      [Edit Vendor] |
| === Section 197 Certificate ==================================     |
| | Cert: LOWDEDCERT/2025-26/12345 | Rate: 0.5% | Max: Rs 50L   |  |
| | Valid: 01-Apr-2025 to 31-Mar-2026       [Upload New]          |  |
| === TDS Summary ===============================================    |
| | FY    | Sec  | Cum.Base  | Cum.TDS | Threshold | Status       |  |
| | 25-26 | 194C | 4,50,000  | 4,500   | 1,00,000  | Above        |  |
| | 25-26 | 194J |   80,000  |     0   | 30,000    | Above        |  |
| === Possible Duplicates =======================================    |
| | "ACME CORPN PVT LTD" (PAN: ABCDE1234F, 2 invoices)  [Merge] |  |
+------------------------------------------------------------------+
```

---

### 4.15 GST Compliance

#### GST Treatment Field

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-GST-001 | Invoice compliance subdocument includes `gstTreatment` enum: `regular`, `reverse_charge`, `exempt`, `nil_rated`, `composition`. Default: `regular`. | Mongoose enum validation. Backward-compatible (existing invoices default to regular). |
| FR-GST-002 | SLM extraction pipeline attempts to detect reverse charge and composition from document text (keywords: "reverse charge", "RCM", "composition dealer", "u/s 10"). | Detection flags for manual review. |
| FR-GST-003 | Invoice detail panel displays gstTreatment with edit dropdown. Override creates AuditLog entry. | Human-readable label, not enum value. |
| FR-GST-004 | When `gstTreatment === "reverse_charge"`, Tally XML includes RCM entries: Output CGST/SGST (credit) and Input CGST/SGST (RCM) (debit). | Accounting balances. RCM entries mirrored for IGST if inter-state. |
| FR-GST-005 | `GST_REVERSE_CHARGE_DETECTED` risk signal (info) emitted when SLM detects RCM keywords but `gstTreatment` is still `regular`. | Prompts manual review. |

#### ITC Eligibility

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-GST-006 | Invoice compliance subdocument includes `itcEligible` boolean, default `true`. | Stored on invoice. |
| FR-GST-007 | Auto-set to `false` when gstTreatment is exempt/nil_rated/composition or invoice relates to blocked credit categories (Section 17(5)). | Auto-detection from treatment field. |
| FR-GST-008 | `ITC_BLOCKED` risk signal (warning) emitted when `itcEligible === false` with reason. | Human-readable reason in message. |
| FR-GST-009 | Compliance panel shows "ITC Eligible" (green) or "ITC Blocked: {reason}" (red). Manual override available with AuditLog. | Binary indicator with explanation. |

#### Place of Supply

**FR-GST-010**: Tally XML includes `<PLACEOFSUPPLY>` derived from vendor GSTIN state code (first 2 digits). State code/name stored on VendorMaster. Intra/inter-state determination uses tenant vs vendor state codes. Invalid codes emit `INVALID_GSTIN_STATE_CODE` risk signal.

(State code reference table in Section 4.10.)

#### E-Invoice / IRN

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-GST-011 | `VENDOR_EINVOICE_MISSING` risk signal (warning) emitted when vendor above e-invoice threshold, no IRN, and regular GST treatment. | Threshold check against vendor aggregate turnover. |
| FR-GST-012 | E-invoice threshold configurable via `TenantComplianceConfig.eInvoiceThresholdMinor` (default: Rs 5 crore). | Accommodates government threshold changes. |
| FR-GST-013 | Compliance panel shows IRN status: "IRN Present: {irn}" (green), "IRN Missing" (amber), "IRN Not Required" (gray). | Three states with appropriate colors. |

#### GSTR-2B Reconciliation (Post-MVP)

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-GST-014 | Import GSTR-2B JSON from GST portal and match against LedgerBuddy invoices. | Upload endpoint accepts standard format. |
| FR-GST-015 | Matching: supplier GSTIN (exact), invoice number (fuzzy), date (30-day tolerance), taxable value (Rs 1), tax amounts (Rs 1 each). | Per-field tolerance. |
| FR-GST-016 | Results: Matched, Mismatch (amounts differ), Missing in GSTR-2B, Extra in GSTR-2B. | Filterable view by category. |
| FR-GST-017 | `GSTR2B_MISMATCH` risk signal (critical) for ITC at risk. | Attached to affected invoices. 8-year retention. |

---

### 4.16 Audit Trail

**User Story**: "As a CA partner conducting a statutory audit, I need a complete, immutable record of every financial mutation so I can demonstrate compliance with Income Tax Act and Companies Act requirements."

#### Functional Requirements

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-AUDIT-001 | `AuditLog` collection records every mutation to financial data. Insert-only (no update/delete at application layer). | No update/delete routes in API. |
| FR-AUDIT-002 | Actions creating AuditLog entries: TDS manual override, GL code change, payment recorded/reversed/approved, invoice approved/rejected, export initiated/completed, vendor field updated, GST treatment override, ITC eligibility override, risk signal dismissed, reconciliation mapping created/removed, config changed. | Full list of 16 action types covered. |
| FR-AUDIT-003 | Each entry contains: `tenantId`, `entityType`, `entityId`, `action`, `previousValue`, `newValue`, `userId`, `userEmail`, `timestamp` (server-generated per C-006). | All fields populated. Timestamp not client-provided. |
| FR-AUDIT-004 | Writes are fire-and-forget per D-039. Failed write: log error, do NOT block primary operation, retry once after 1s, dead-letter if retry fails. | Unit test verifies non-blocking on write failure. |
| FR-AUDIT-004a | `AuditLogDeadLetter` collection with same schema as AuditLog plus `error` (string), `failedAt` (Date), `retryCount` (integer, default 0) fields. Monthly cron job retries dead letters with exponential backoff (1h, 2h, 4h, 8h max). Successfully retried entries are moved to AuditLog and removed from dead letter. TENANT_ADMIN dashboard shows dead letter count. Alert emitted if count > 0 for more than 24 hours. | Dead letter collection exists. Monthly cron runs. Dashboard shows count badge on Audit Trail section. Alert fires after 24h threshold. |
| FR-AUDIT-005 | Minimum 8-year retention for compliance tenants. No TTL index on AuditLog. | Income Tax Act: 6-10 years. Companies Act: 8 years. |
| FR-AUDIT-006 | Indexes: `{ tenantId, entityType, entityId, timestamp: -1 }`, `{ tenantId, timestamp: -1 }`, `{ tenantId, userId, timestamp: -1 }`, `{ tenantId, action, timestamp: -1 }`. | Entity history, chronological, user activity, and action filtering. |
| FR-AUDIT-007 | Access: TENANT_ADMIN and PLATFORM_ADMIN only. No VIEWER/MEMBER access. No write API. | Role-restricted. |
| FR-AUDIT-008 | `AuditLogService` exposes: `log(entry)` (fire-and-forget), `query(tenantId, filters)` (paginated), `exportCsv(tenantId, filters)` (stream). | Three methods. |
| FR-AUDIT-009 | All `*Minor` amounts in entries are integers per C-001. Display formats as currency. | Integer validation on input. |
| FR-AUDIT-010 | Query endpoint: `GET /api/audit-logs?entityType=&entityId=&from=&to=&action=&userId=&page=&pageSize=`. | All filters optional. Paginated. |

#### Audit Trail UX

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-AUDIT-011 | Invoice detail panel includes "Activity" tab showing chronological audit trail. | Loads within 500ms. |
| FR-AUDIT-012 | Each entry: timestamp (IST), user, human-readable action ("Changed GL code from 'X' to 'Y'"), formatted previous/new values. | Not raw JSON. |
| FR-AUDIT-013 | Activity tab filterable by action type (All/TDS/GL/Approvals/Payments/Exports), user, date range. | Dropdown and date picker filters. |
| FR-AUDIT-014 | Tenant-level audit trail in Settings (admin only) across all entities with entity type and ID filters. | Global view. |
| FR-AUDIT-015 | CSV export: Timestamp, User Email, Action, Entity Type, Entity ID, Previous Value, New Value. | Downloadable. Proper JSON escaping. |

### 4.17 Risk Signal Management

**User Story**: "As a finance controller, I need to manage risk signals efficiently across hundreds of invoices so that critical compliance issues are always visible and resolved noise does not obscure actionable items."

#### Functional Requirements

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-RISK-001 | Risk signals shall be filterable by severity (critical, warning, info) in all views: invoice list, invoice detail, vendor detail, TDS dashboard, and MSME dashboard. | Severity filter dropdown available on each view. Default: show all. |
| FR-RISK-002 | Info-level risk signals shall be auto-dismissed after 30 days from emission if not manually dismissed or resolved. A nightly job marks stale info signals as `auto_dismissed`. | Signals older than 30 days with severity "info" and status "open" are auto-dismissed. AuditLog entry created with action "risk_signal_auto_dismissed". |
| FR-RISK-003 | Bulk dismiss by type: users with TENANT_ADMIN role can dismiss all signals of a given type within a scope (e.g., dismiss all `TDS_BELOW_ANNUAL_THRESHOLD` for FY 2025-26). Confirmation modal shows count of signals to be dismissed. | `POST /api/risk-signals/bulk-dismiss` accepts `{ signalType, scope }`. Returns count dismissed. AuditLog entry with action "risk_signal_bulk_dismissed". |
| FR-RISK-004 | Critical signals are pinned at the top of any list where risk signals appear, regardless of sort order. Visual treatment: red left border, bold text, pin icon. | Critical signals always render above warning and info signals. Pinning is visual-only (does not affect underlying data sort). |
| FR-RISK-005 | Unresolved critical signal count is shown as a badge on the navigation tab (Invoices tab badge shows "Invoices (3)" where 3 = unresolved critical count). Badge updates in real time via existing SSE connection. | Badge count = `db.riskSignals.countDocuments({ tenantId, severity: "critical", status: "open" })`. Badge hidden when count = 0. SSE event `risk_signal_count_changed` triggers badge refresh. |

#### Complete Risk Signal Catalog

| Signal | Category | Severity | Trigger |
|---|---|---|---|
| `TOTAL_AMOUNT_ABOVE_EXPECTED` | Financial | Warning | Invoice exceeds configured maximum |
| `TOTAL_AMOUNT_BELOW_MINIMUM` | Financial | Info | Unusually low amount |
| `DUE_DATE_TOO_FAR` | Data Quality | Warning | Due date exceeds expected range |
| `MISSING_MANDATORY_FIELDS` | Data Quality | Warning | Vendor name or amount missing |
| `PAN_FORMAT_INVALID` | Compliance | Warning | PAN does not match expected format |
| `PAN_GSTIN_MISMATCH` | Compliance | Warning | PAN does not match GSTIN |
| `TDS_SECTION_AMBIGUOUS` | Compliance | Warning | Multiple sections could apply |
| `TDS_NO_PAN_PENALTY_RATE` | Compliance | Critical | Missing or invalid PAN triggers 20% rate |
| `TDS_BELOW_THRESHOLD` | Compliance | Info | Amount below deduction threshold |
| `TDS_BELOW_ANNUAL_THRESHOLD` | Compliance | Info | Cumulative amount below annual threshold |
| `TDS_ANNUAL_THRESHOLD_CROSSED` | Compliance | Warning | Cumulative amount crossed annual threshold |
| `TDS_BACKDATED_THRESHOLD_ADJUSTMENT` | Compliance | Warning | Backdated invoice caused threshold crossing |
| `TDS_SECTION_197_APPLIED` | Compliance | Info | Lower deduction certificate applied |
| `TDS_NON_FILER_FLAG` | Compliance | Warning | Vendor may be specified person under 206AB |
| `TDS_CUMULATIVE_RECALC_NEEDED` | Compliance | Warning | Manual section change impacted cumulative threshold |
| `TDS_MERGE_THRESHOLD_CROSSED` | Compliance | Warning | Vendor merge caused threshold crossing |
| `IRN_MISSING` | Compliance | Warning | High-value invoice lacks e-invoice IRN |
| `IRN_FORMAT_INVALID` | Compliance | Warning | IRN does not match expected format |
| `VENDOR_EINVOICE_MISSING` | Compliance | Warning | Vendor above e-invoice threshold, no IRN |
| `GST_REVERSE_CHARGE_DETECTED` | Compliance | Info | RCM keywords detected, treatment still regular |
| `ITC_BLOCKED` | Compliance | Warning | ITC ineligible with reason |
| `INVALID_GSTIN_STATE_CODE` | Compliance | Warning | GSTIN state code invalid |
| `GSTR2B_MISMATCH` | Compliance | Critical | ITC at risk due to GSTR-2B mismatch |
| `MSME_PAYMENT_DUE_SOON` | Compliance | Warning | MSME invoice approaching 45-day deadline |
| `MSME_PAYMENT_OVERDUE` | Compliance | Critical | MSME invoice past 45-day deadline |
| `VENDOR_BANK_CHANGED` | Fraud | Critical | Vendor bank details differ from history |
| `DUPLICATE_INVOICE_NUMBER` | Fraud | Critical | Same vendor + invoice number seen before |
| `CASH_PAYMENT_ABOVE_LIMIT` | Financial | Warning | Cash payment exceeds Rs 2,00,000 (Section 40A(3)) |
| `VENDOR_BLOCKED` | Compliance | Critical | Invoice from a blocked vendor |

---

## 5. Role Hierarchy & Capabilities

LedgerBuddy's role system maps directly to how CA and accounting firms are structured. Each role carries a default set of capabilities that can be customized per user.

### Firm Role Mapping

| Role | Firm Equivalent | Key Capabilities |
|---|---|---|
| **Firm Partner** (PLATFORM_ADMIN) | Managing partner, senior partner | Full control: all invoices, all configurations, all users, all exports, compliance sign-off, workflow configuration, cost center management, vendor communications |
| **Tenant Admin** (TENANT_ADMIN) | Office manager, engagement lead | User management, connection management (email/bank), workflow configuration, GL code configuration, TCS configuration, compliance configuration, full invoice access |
| **Senior Accountant** (MEMBER + elevated) | Audit manager, review head | Invoice review and approval, field editing, TDS and GL code overrides, compliance review, Tally export, CSV export, compliance report download |
| **CA (Chartered Accountant)** (MEMBER + elevated) | Signing CA, audit partner | Compliance sign-off, TDS override, GL code override, approval with configurable limits, compliance report download, vendor communications |
| **Tax Specialist** (MEMBER + elevated) | GST consultant, TDS specialist | TDS mapping configuration, TDS and GL code overrides, TCS configuration, compliance sign-off, export capabilities |
| **AP Clerk** (MEMBER) | Data entry operator, accounts assistant | Invoice upload, ingestion trigger, field editing on own uploads, limited approval capability |
| **IT/Ops Admin** (TENANT_ADMIN) | Systems administrator | Connection management (email, bank accounts), user management, technical configuration |
| **Audit Clerk** (VIEWER) | External auditor, statutory auditor's team | Read-only access to invoices, compliance data, risk signals, and export history. Cannot upload, edit, approve, delete, or export. Data scope can be configured to limit which invoices are visible. |

### Capability Granularity

Beyond role-based defaults, each user can have individual capabilities toggled:

- Approval limit (maximum invoice amount in Rs the user can approve)
- Upload and ingestion permissions
- Field editing permissions
- Delete and retry permissions
- TDS and GL code override permissions
- Compliance sign-off authority
- Configuration access (TDS mappings, GL codes, workflows, compliance settings, cost centers)
- Export permissions (Tally, CSV, compliance reports)
- Invoice visibility scope (own vs all)
- Vendor communication permissions
- Payment recording and approval permissions (see Section 13 Capability Matrix)

---

## 6. UX Strategy & Quick Wins

### 6.1 Current UX Assessment

**Overall UX Maturity Score: 5.5 / 10**

**Top Strengths:**

| # | Strength |
|---|----------|
| 1 | Source preview with bounding-box highlighting -- clicking a field chip renders OCR crop inline |
| 2 | Multi-step approval workflow with simple/advanced modes (progressive disclosure) |
| 3 | Keyboard-driven navigation (j/k/Space/Enter/a/e/?) following Vim/Gmail conventions |
| 4 | Draggable, minimizable ingestion overlay with position persistence |
| 5 | Comprehensive compliance configuration (TDS sections, PAN levels, GL CSV import, TCS) |

**Top Weaknesses:**

| # | Weakness | Impact |
|---|----------|--------|
| 1 | No workflow-based navigation (accountants must filter status tabs to find work) | High |
| 2 | Confidence score whitewashes compliance data (TDS/PAN/GL hidden behind detail click) | High |
| 3 | No vendor-centric view (no master list, no "all invoices from vendor X") | High |
| 4 | Fire-and-forget export (no pre-export validation, no per-voucher feedback) | High |
| 5 | Statement-drill-down reconciliation (no split-pane, no TDS-adjusted amounts) | Medium |

### 6.2 Error States

All new features shall implement consistent error handling patterns. No feature ships without error state coverage for each of the categories below.

#### 5.2.1 Inline Validation Errors (Field-Level)

All form inputs across payment recording, vendor editing, TDS overrides, and reconciliation mapping shall display field-level validation errors inline, directly below the input field. Pattern:

- Red border on the input field
- Red text below the field with a warning icon (16px) and descriptive message
- Message appears immediately on blur (not on keystroke) for format validation; on submit for cross-field validation
- Example messages: "UTR must be 16-22 alphanumeric characters", "Amount exceeds remaining payable (Rs 25,000)", "Certificate expiry date must be in the future"
- Multiple errors on a single field stack vertically
- Errored fields are scrolled into view on form submission with the first error focused

#### 5.2.2 Server-Side Rejection

| Error Type | Pattern | Example |
|---|---|---|
| **Transient** (network timeout, 5xx, rate limit) | Toast notification (bottom-right, auto-dismiss 8s) with retry action. Message: "{operation} failed. [Retry]" | "Payment recording failed. [Retry]" |
| **Blocking** (business rule violation, 4xx with actionable detail) | Modal dialog with: (a) error title, (b) specific reason, (c) recommended action, (d) "OK" or "Fix & Retry" button. Modal blocks further interaction until acknowledged. | "Cannot record payment: Invoice INV-045 is not in APPROVED status (current: NEEDS_REVIEW). Approve the invoice before recording payment." |
| **Conflict** (409, duplicate UTR, concurrent edit) | Modal dialog with conflict details and resolution options. | "UTR UTIB2026040200001 already exists on payment PAY-202604-00012. [View Existing Payment] [Use Different UTR]" |

#### 5.2.3 Batch Operation Partial Failure

For batch operations (bulk export, payment runs, bulk approve), partial failures display an expandable success/fail summary:

```
+------------------------------------------------------------------+
|  Batch Operation Result                                            |
+------------------------------------------------------------------+
|  [checkmark] 12 succeeded    [x] 3 failed                        |
|                                                                    |
|  v Failed (3)                                                      |
|  +------+---------+------------------------------------------+    |
|  | Item | ID      | Error                                    |    |
|  +------+---------+------------------------------------------+    |
|  | [x]  | INV-045 | Vendor PAN missing; TDS cannot be        |    |
|  |      |         | computed                                  |    |
|  | [x]  | INV-051 | GL code not assigned                      |    |
|  | [x]  | INV-067 | Tally ledger "Gamma Inc" not found        |    |
|  +------+---------+------------------------------------------+    |
|                                                                    |
|  > Succeeded (12)  [click to expand]                              |
|                                                                    |
|  [Retry Failed (3)]  [Download Report]  [Close]                   |
+------------------------------------------------------------------+
```

- Failed items have checkboxes for selective retry
- "Retry Failed" re-submits only checked items
- "Download Report" exports full success/fail list as CSV
- Succeeded items are collapsed by default (expandable)
- Each failed item links to the entity detail for manual remediation

#### 5.2.4 Non-Recoverable Errors

For errors the user cannot resolve (data corruption, infrastructure failure, unhandled exception):

- Full-page or modal error state with: (a) "Something went wrong" heading, (b) brief non-technical description, (c) error ID (UUID) for support reference, (d) "Contact Support" button with pre-filled error ID, (e) "Try Again" button that reloads the current view
- Error ID is logged server-side with full stack trace, request context, and user ID
- Message: "An unexpected error occurred. Reference: ERR-{uuid}. Please contact support with this reference if the issue persists."
- No raw error messages, stack traces, or technical details exposed to the user

#### 5.2.5 Error State Applicability by Feature

| Feature | Inline Validation | Server Rejection | Batch Partial Failure | Non-Recoverable |
|---|---|---|---|---|
| Payment Recording | Amount, UTR, method, date | Duplicate UTR (409), invoice status (400), over-allocation (400) | Payment run processing | Infrastructure failure |
| TDS Override | Section, rate, amount | Ledger update failure | N/A (single-item) | TdsVendorLedger corruption |
| Vendor Editing | Tally ledger name, GL code, cert dates | Merge conflict, vendor blocked | Bulk vendor status change | Database transaction failure |
| Tally Export | N/A (pre-export modal handles) | Tally connection refused | Per-invoice export failure (FR-TALLY-040) | S3 upload failure |
| Reconciliation | Allocation amount | Over-allocation (400), mapping conflict | Bulk match confirmation | Scoring engine failure |
| Advance Allocation | Amount, vendor match | Insufficient unallocated balance | N/A | Infrastructure failure |

### 6.3 UX Quick Wins (Immediate, Parallel with All Phases)

**Quick Win 1: Risk Signals Expanded by Default for NEEDS_REVIEW Invoices**

**FR-UX-001:** When invoice detail panel renders for `status === "NEEDS_REVIEW"`, `RiskSignalList` initializes with `expanded = true`. Other statuses preserve current default (collapsed).

*Acceptance Criteria:* NEEDS_REVIEW shows expanded signals without interaction. Other statuses collapsed. Toggle not locked. Empty signals show nothing. Effort: 2 hours.

---

**Quick Win 2: Risk Indicator Column in Invoice Table**

**FR-UX-002:** Invoice table includes "Risk" column with colored dot from highest-severity open risk signal: Red (critical), Amber (warning), Green (none), Gray (no compliance data). Tooltip: "2 risk signals (1 critical)".

*Acceptance Criteria:* Column between Status and GL. Dismissed signals excluded. Clicking dot opens detail with signals expanded. Column sortable (critical first). Effort: 4-6 hours.

---

**Quick Win 3: PAN Label Clarification**

**FR-UX-003:** PAN validation displayed as descriptive text: L0 = "Not validated" (gray), L1 = "Format valid" (amber, single checkmark), L2 = "GSTIN cross-checked" (green, double checkmark). L1/L2 codes NOT shown in UI. Tooltips explain each level.

*Acceptance Criteria:* No L1/L2 codes visible. Color coding matches. No regressions in export flows. Effort: 2 hours.

---

**Quick Win 4: Action Hints in Status Badges**

**FR-UX-004:** Status badges include contextual action text: AWAITING_APPROVAL: "Approve (Step {current}/{total})", NEEDS_REVIEW: "Review: {n} signals", PARSED: "Ready for review", APPROVED: "Ready to export", FAILED_*: "Retry available".

*Acceptance Criteria:* Step count from workflowState. Signal count excludes dismissed. Truncates at narrow widths. Effort: 4-6 hours.

---

**Quick Win 5: ARIA Accessibility Fixes**

**FR-UX-005:** All tab elements include `role="tab"` and `aria-selected={isActive}`. Tab containers include `role="tablist"`. Applies to `TenantViewTabs.tsx` and `TenantInvoicesToolbar.tsx` status filter buttons.

*Acceptance Criteria:* VoiceOver announces "Invoices tab, selected". No visual regressions. Effort: 1-2 hours.

---

**Quick Win 6: Action Required Queue**

**FR-UX-006:** "Action Required" filter mode in Invoices tab displays NEEDS_REVIEW and AWAITING_APPROVAL (where current user is valid approver) sorted by age descending. Shows action per row ("Review"/"Approve") and age ("5d", "2h"). Count badge on tab: "Invoices (12)".

**FR-UX-006a:** Action Required queue is the default landing view for TENANT_ADMIN and MEMBER roles, overriding the current Overview default. When the queue is empty, fall through to the Overview dashboard with the empty state message: "All clear. No invoices need your attention." VIEWER and PLATFORM_ADMIN roles retain Overview as default landing.

*Acceptance Criteria:* First tab in status filter row. Sorted by createdAt ascending. Server-side pagination (default 20). Effort: 1-2 days.

---

**Quick Win 7: Pre-Export Validation Modal**

**FR-UX-007:** Validation modal before Tally export checks: GL code assigned, vendor PAN present (if TDS applicable), no critical risk signals, vendor name non-empty, invoice total balances. Results as checklist: PASS (green), FAIL (red), WARN (amber).

**FR-UX-007a/b:** Three actions: "Export {M} valid", "Export all {N}" (with confirmation), "Cancel". Keyboard-navigable.

*Acceptance Criteria:* Modal between button click and XML generation. Client-side validation. Failing invoices clickable. Effort: 1-2 days.

(Wireframe in Section 4.12.)

### 6.4 Medium-Term UX (Delivered with Feature Phases)

**FR-UX-008: Vendor List Tab (Phase 2)**

"Vendors" tab between Invoices and Exports. Paginated, searchable table with: Vendor Name, PAN, GSTIN, TDS Section, Status, Tally Sync, Invoices, FY TDS Deducted. Clicking navigates to vendor detail.

(Wireframe in Section 4.14.)

---

**FR-UX-009: Payment Recording Form in Invoice Detail (Phase 3)**

Payment History section in invoice detail for APPROVED/EXPORTED invoices: totals, progress bar, payment table, "Record Payment" button. Inline form with amount, date, method, UTR, notes. Client-side validation: amount > 0, not future date, UTR per method, cash limit warning.

**Wireframe:**

```
+--------------------------------------------------+
|  Payment History                                  |
+--------------------------------------------------+
|  Invoice Total: INR 1,00,000                      |
|  TDS (194C @ 1%): INR 1,000                      |
|  Net Payable: INR 99,000                          |
|  [========================>    ] 75% paid         |
|  Date       Amount    Method  Ref       By        |
|  15-Apr-26  50,000    NEFT    UTR-123   amit@co   |
|  01-Apr-26  24,000    NEFT    UTR-098   amit@co   |
|  Paid: 74,000 | Remaining: 25,000                 |
|  [+ Record Payment]                               |
+--------------------------------------------------+
```

---

**FR-UX-010: Payment Column in Invoice Table (Phase 3)**

Mini progress bar (60px) showing `paidAmountMinor / netPayableMinor`. Status badge: Unpaid (red), Partial (amber), Paid (green), Overpaid (purple). Sortable and filterable.

#### Detailed Payment UX Requirements (Phase 3)

| ID | Requirement |
|---|---|
| FR-UX-PAY-001 | Invoice table includes a `Payment` column with badge: Unpaid (grey, outline), Partial (amber, filled, showing percentage), Paid (green, filled), Overpaid (red, filled). |
| FR-UX-PAY-002 | For `partially_paid`, badge includes micro progress bar showing `paidAmountMinor / netPayableMinor` percentage. **Responsive**: Width 60px on desktop (>1024px viewport). On mobile (<768px), collapse to badge-only showing percentage text (e.g., "63%") without the bar. On tablet (768-1024px), bar width 40px. |
| FR-UX-PAY-003 | Invoice table supports filtering by `paymentStatus` via dropdown: All, Unpaid, Partially Paid, Paid, Overpaid. |
| FR-UX-PAY-004 | "Aging" indicator on unpaid invoices: colored dot (Green = not due, Yellow = due within 7d, Orange = 1-30d past, Red = 31+ past). MSME vendors show "M" overlay. |
| FR-UX-PAY-005 | Amount column shows gross amount and "Net: {netPayable}" on second line when TDS applied. |
| FR-UX-PAY-006 | Invoice detail includes "Payment" section below Compliance for APPROVED/EXPORTED invoices. |
| FR-UX-PAY-007 | Payment section header: Gross Amount, TDS Deducted, TCS Applied, Net Payable, Amount Paid, Remaining Balance. Progress bar at full width. |
| FR-UX-PAY-008 | "Payment History" timeline below summary: payment number (link), date, amount, method, UTR, status. Reversals shown with strikethrough and "Reversed" badge. |
| FR-UX-PAY-009 | "Record Payment" button for invoices with `paymentStatus != fully_paid`. Opens slide-over panel. |
| FR-UX-PAY-010 | Payment slide-over pre-fills: vendor name (read-only), amount (net minus paid), method (dropdown), date (today), UTR (dynamic per method). "Save as Draft" and "Record Payment" buttons. |
| FR-UX-PAY-011 | MSME vendors show compliance callout: "Payment due by {deadline}. {daysRemaining} days remaining." or "OVERDUE by {daysOverdue} days. Interest: Rs {amount}." in red. |
| FR-UX-PAY-012 | "Record Payment" button hidden for users without `canRecordPayments`. Payment History visible to all (read-only for VIEWER). |

**Multi-Invoice Payment Wireframe (Vendor-Grouped Allocation):**

```
+------------------------------------------------------------------+
|  Record Payment                                          [x Close] |
+------------------------------------------------------------------+
|  Payment Date: [16-Apr-2026]   Method: [NEFT v]                   |
|  UTR: [________________________]                                   |
|                                                                    |
|  v ACME CORPORATION PVT LTD (3 invoices)          Subtotal: 2,35,000|
|  +----------+----------+---------+--------+--------+-----------+   |
|  | Invoice  | Due Date | Net     | TDS    | Alloc  | Net Paid  |   |
|  |          |          | Payable |        | Amount | (auto)    |   |
|  +----------+----------+---------+--------+--------+-----------+   |
|  | INV-001  | 15-Apr   | 99,000  | 1,000  |[99,000]| 98,000    |   |
|  | INV-003  | 20-Apr   | 49,500  |   500  |[49,500]| 49,000    |   |
|  | INV-008  | 01-May   | 98,000  | 2,000  |[88,000]| 86,000    |   |
|  +----------+----------+---------+--------+--------+-----------+   |
|                                                                    |
|  > BETA SERVICES LLP (1 invoice)                  Subtotal: 45,000|
|  +----------+----------+---------+--------+--------+-----------+   |
|  | INV-012  | 18-Apr   | 47,000  | 2,000  |[45,000]| 43,000    |   |
|  +----------+----------+---------+--------+--------+-----------+   |
|                                                                    |
|  Total Payment: Rs 2,80,000                                        |
|  Total TDS:     Rs   5,500                                         |
|  Net Disbursed: Rs 2,74,500                                        |
|                                                                    |
|  [Save All as Draft]              [Record Payment]                  |
+------------------------------------------------------------------+
```

- Vendor headers are collapsible (v/> toggle); expanded by default
- Alloc Amount pre-filled to full net payable; editable for partial payments
- Net Paid auto-computed: `allocAmount - tdsDeducted + tcsCollected`
- Multi-vendor payments create one Payment document per vendor (FR-PAY-032)
- Overdue invoices (past due date) highlighted with red text on due date
- MSME vendors show deadline callout below vendor header

**Invoice Detail Payment Section Wireframe:**

```
+---------------------------------------------------------------+
| PAYMENT                                           [Record Payment] |
+---------------------------------------------------------------+
| Gross Amount    TDS Deducted    TCS Applied    Net Payable     |
| Rs 1,50,000     Rs 15,000       Rs 0           Rs 1,35,000    |
|                                                                |
| Amount Paid     Remaining Balance                              |
| Rs 85,000       Rs 50,000                                     |
|                                                                |
| [===============================>                    ] 63%     |
+---------------------------------------------------------------+
| MSME: Payment due by 15-May-2026. 29 days remaining.   [!]    |
+---------------------------------------------------------------+
| PAYMENT HISTORY                                                |
|                                                                |
| PAY-202604-00012  |  02-Apr-2026  |  Rs 50,000  |  NEFT       |
|   UTR: UTIB2026040200001  |  Processed  [green]               |
|                                                                |
| PAY-202604-00018  |  10-Apr-2026  |  Rs 35,000  |  UPI        |
|   Ref: 423891726345  |  Processed  [green]                    |
+---------------------------------------------------------------+
```

---

**FR-UX-011: TDS Cumulative Dashboard (Phase 1)**

Accessible from Overview tab. FY selector. Summary cards: Total TDS Deducted, TDS Deposited, Balance Due, Next Deadline. Per-vendor table. Per-quarter breakdown. Threshold alerts (approaching within 20%, crossed this quarter).

---

**FR-UX-012: Reconciliation Split-Pane UI (Phase 5)**

Two-column layout: bank transactions (left, 45%) and candidate invoices (right, 55%). TDS-adjusted amount explanation per candidate. Match confidence breakdown (amount/invoice number/vendor name/date proximity). Split mapping UI for multi-invoice matches.

**Wireframe:**

```
+-------------------------------+----------------------------+
| BANK TRANSACTIONS             | CANDIDATE INVOICES         |
| [All v] [Unmatched v]         | for: 15-Apr Acme -25,000  |
+-------------------------------+----------------------------+
| 15-Apr Acme Corp    -25,000  || INV-001  Acme  10,000     |
|   [Unmatched]                ||   TDS: 100  Exp: 9,900    |
|                              ||   Conf: 85%               |
| 10-Apr Beta Svc      -9,900 || INV-002  Acme   8,000     |
|   [Suggested 95%]            ||   TDS: 80   Exp: 7,920    |
|                              ||   Conf: 72%               |
| 05-Apr Delta Co     -15,000 ||                            |
|   [Matched]                  || Split Total: 24,750        |
|                              || Bank Debit:  25,000        |
|                              || [Match Selected] [Skip]    |
+-------------------------------+----------------------------+
```

### 6.5 Navigation Restructure (Post-MVP Major Redesign)

**Current:** `Overview | Invoices | Exports | [Statements] | [Tenant Config] | [Connections]`

**Proposed:** `Dashboard | Inbox | Invoices | Vendors | Payments | Reconciliation | Exports | Settings`

| Tab | Replaces | Content | Visibility |
|-----|----------|---------|-----------|
| Dashboard | Overview | KPI cards, status donut, aging chart, TDS summary | All roles |
| Inbox | (new) | Action Required queue sorted by age | All roles |
| Invoices | Invoices | Full invoice list with all filters and bulk actions | All roles |
| Vendors | (new) | Vendor master, TDS tracking, Tally sync | All roles (write admin-only) |
| Payments | (new) | Payment list, recording, runs, advances | All roles (write requires canRecordPayments) |
| Reconciliation | Statements | Bank statement upload, split-pane matching | Admin + connections |
| Exports | Exports | Export history, purchase/payment voucher batches | All roles |
| Settings | Config + Connections | Workflows, GL codes, compliance, users, connections | Admin only |

**Migration Strategy (incremental, not big-bang):**

| Step | Change | When |
|------|--------|------|
| 1 | Add "Vendors" tab | Phase 2 (Week 4-5) |
| 2 | Add "Payments" tab | Phase 3 (Week 6-8) |
| 3 | Rename "Statements" to "Reconciliation" | Phase 5 (Week 10-12) |
| 4 | Add "Inbox" tab | Post-MVP |
| 5 | Merge Config + Connections into "Settings" | Post-MVP |
| 6 | Rename "Overview" to "Dashboard" | Post-MVP |

---

## 7. Non-Functional Requirements

### Performance

| ID | Requirement | Metric |
|---|---|---|
| NFR-001 | TDS computation latency | p95 < 200ms including TdsVendorLedger lookup, rate hierarchy, and ledger update |
| NFR-002 | Payment recording API | p95 < 500ms single-invoice; p95 < 1000ms multi-invoice (up to 50 allocations) |
| NFR-003 | Reconciliation scoring | < 10 seconds for 1000 transactions vs 5000 invoices. Split/aggregate adds at most 50% |
| NFR-004 | TDS report generation | < 3 seconds for 500 vendor-section-FY combinations |
| NFR-005 | Vendor list endpoint | < 200ms for 10,000 vendors |
| NFR-006 | Tally XML batch generation | < 2 seconds for 100 vouchers; total export < 10 seconds including S3 upload |
| NFR-007 | MSME nightly job | < 60 seconds for tenants with 10,000 active invoices |
| NFR-008 | Audit log query | < 500ms for entity history on collections with 10M entries (index-covered) |

### Data Integrity

| ID | Requirement | Detail |
|---|---|---|
| NFR-009 | Integer minor units | All `*Minor` fields validated at schema and API level. No floating-point. `Math.round()` before storage. [C-001] |
| NFR-010 | Atomicity | TdsVendorLedger uses `$inc/$push` atomic ops. Full MongoDB transactions on replica set for multi-document updates. [D-038] |
| NFR-011 | Payment immutability | Once `processed`, no field modifiable via API. Reversals create new documents. [C-009] |
| NFR-012 | UTR uniqueness | Unique sparse index on `{tenantId, utrNumber}`. Application pre-check + index as source of truth. [C-010] |
| NFR-013 | Concurrent payment safety | `paidAmountMinor` uses atomic `$inc`. Over-payment emits `overpaid` status. [D-002] |

### Compliance & Retention

| ID | Requirement | Detail |
|---|---|---|
| NFR-014 | Audit retention | TdsVendorLedger and AuditLog: minimum 8 years. No TTL index for compliance tenants. [C-019] |
| NFR-015 | Timezone consistency | All FY/quarter determinations use IST (UTC+05:30). Not dependent on server locale. [D-043, C-002] |

### Testing

| ID | Requirement | Detail |
|---|---|---|
| NFR-016 | 100% branch coverage | Required on: `TdsCalculationService`, `TdsVendorLedgerService`, `PaymentService`, `TallyExporter/xml.ts`, `determineFY()`, `determineQuarter()`. [D-040] |
| NFR-017 | Backfill idempotency | TDS cumulative backfill safe to re-run N times. Cursor-based, batch size 100. [D-041, D-044] |
| NFR-018 | TDS test matrix | Below threshold, at threshold, above threshold, threshold crossing with catch-up, backdated invoice, multiple sections, Section 197 (valid/expired/exhausted), no-PAN penalty (rate higher/lower than 20%), concurrent processing. |

### Export Quality

| ID | Requirement | Detail |
|---|---|---|
| NFR-019 | XML validity | All XML well-formed. Passes Tally Prime import validator. |
| NFR-020 | Concurrency | One active export per tenant. Queue or reject concurrent requests. |
| NFR-021 | UTF-8 encoding | Non-ASCII characters preserved. XML entities escaped. |
| NFR-022 | Backward compatibility | Phase 0 changes do not conflict with previously imported vouchers (all prior exports were ISINVOICE=No, so no bill references exist). |
| NFR-023 | Vendor merge atomicity | Full MongoDB transaction. Partial merges not acceptable. |

---

## 8. Implementation Phasing

### Phase Overview

| Phase | Scope | Duration | Parallel? | Dependencies |
|-------|-------|----------|-----------|-------------|
| Phase 0 | Tally XML Fixes | 1-2 days | Standalone | None |
| Phase 1 | TDS Cumulative Threshold | 2-3 weeks | Yes, with Phase 2 | None |
| Phase 2 | Vendor CRUD & Fields | 1 week | Yes, with Phase 1 | None |
| Phase 2.5 | AuditLog Model & Service | 3-4 days | Yes, parallel with Phase 1 & 2 | None |
| Phase 3 | Payment Recording | 2-3 weeks | No | Phase 2, Phase 2.5 |
| Phase 4 | Payment Voucher Export | 1-2 weeks | No | Phase 0, Phase 3 |
| Phase 5 | Reconciliation Enhancement & Vendor Merge | 2-3 weeks | Partially parallel with Phase 4 | Phase 3 (reconciliation), Phase 2 (vendor merge) |
| Payment Lite | Single-invoice payment for demo | 1 week | After Phase 2 | Phase 2 |
| UX QW | Quick Wins 1-7 | Continuous | Yes, with all phases | None |

**Critical Path:** Phase 0 -> (Phase 1 || Phase 2 || Phase 2.5) -> Payment Lite -> Phase 3 -> (Phase 4 || Phase 5)

**Total Calendar Time:** 14-18 weeks (Phases 1+2 parallel, Phases 4+5 partially parallel).

### Resource Plan

**Team assumption**: 2 backend engineers (BE-1, BE-2), 1 frontend engineer (FE-1), 0.5 QA engineer (QA-1, shared with another project).

| Phase | BE-1 | BE-2 | FE-1 | QA-1 | Duration |
|---|---|---|---|---|---|
| Phase 0: Tally XML Fixes | Lead | -- | -- | Validate import | 1-2 days |
| Phase 1: TDS Cumulative | Lead (model, service, backfill) | Support (risk signals, report endpoint) | TDS dashboard UI | Test matrix | 2-3 weeks |
| Phase 2: Vendor CRUD | -- | Lead (API, cert) | Vendor list + detail UI | CRUD validation | 1 week |
| Phase 3: Payment Recording | Lead (Payment model, service, approval) | Support (AuditLog, risk signals) | Payment forms, progress bars | Payment test matrix | 2-3 weeks |
| Phase 4: Payment Voucher Export | Lead (XML builder, batch export) | -- | Export history UI updates | Tally import validation | 1-2 weeks |
| Phase 5: Reconciliation + Vendor Merge | -- | Lead (split/aggregate, mapping model, vendor merge) | Split-pane UI, merge confirmation modal | Reconciliation scenarios, merge atomicity | 2-3 weeks |
| UX Quick Wins | -- | -- | Lead (all 7 quick wins) | Smoke test | Parallel, Weeks 1-2 |

**Estimated burn rate**: ~3.5 FTEs for 14-18 weeks.

**Reduced team contingency**: If team < 3 engineers (e.g., 2 engineers + 0.5 QA), Phase 1 and Phase 2 cannot run in parallel, and Phase 4 and Phase 5 become fully sequential. Critical path extends to 20-24 weeks. In this scenario, prioritize: Phase 0 -> Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5, and defer UX quick wins to available gaps between phases.

### Dependency Graph

```
Phase 0: Tally XML Fixes (1-2 days)
  |
  +--- Phase 1: TDS Cumulative (2-3 weeks, no deps) --------+
  |                                                           |
  +--- Phase 2: Vendor CRUD (1 week, no deps) ---------------+
  |                                                           |
  +--- Phase 2.5: AuditLog (3-4 days, no deps, parallel) ---+
                    |                                         |
                    v                                         v
              Phase 3: Payment Model (2-3 weeks, needs Phase 2 + Phase 2.5)
                    |
                    +---> Phase 4: Payment Voucher Export (1-2 weeks)
                    |
                    +---> Phase 5: Reconciliation Enhancement + Vendor Merge (2-3 weeks)
                    |
                    +---> MSME Compliance (1 week, parallel)
                    +---> Aging Report (3-4 days, parallel)
                    +---> UX Enhancements (1-2 weeks, parallel)
```

### Phase 0: Tally XML Fixes (1-2 Days)

**Deliverables:**
1. `LEDGERENTRIES.LIST` -> `ALLLEDGERENTRIES.LIST` in xml.ts
2. `ISINVOICE` -> `Yes`
3. Add `<REFERENCE>` tag
4. Add `<EFFECTIVEDATE>` tag
5. Add `BILLALLOCATIONS.LIST` with `BILLTYPE=New Ref`
6. Add `<PLACEOFSUPPLY>` (GSTIN state code lookup)
7. Add `<?xml version="1.0" encoding="UTF-8"?>` declaration
8. Update all existing tests

**Definition of Done:** All 8 fixes applied. 100% branch coverage on `xml.ts` maintained. Manual Tally Prime import validates correct purchase invoice with bill allocation. Sprinto benchmark passes.

### Phase 1: TDS Cumulative Threshold (2-3 Weeks)

**Deliverables:**
0. **OAR-007 user research (Weeks 1-2)**: Conduct 3 structured interviews with CA firms to determine Tally statutory TDS module usage. If >50% use statutory TDS, add statutory tags to Phase 0 scope before Phase 1 completes.
1. `TdsVendorLedger` Mongoose model with atomic `$inc`
2. `TdsVendorLedgerService` with cumulative tracking, threshold detection, FY management
3. `determineFY()` utility (IST timezone)
4. Modified `TdsCalculationService.computeTds()` with cumulative threshold algorithm
5. New risk signals: `TDS_BELOW_ANNUAL_THRESHOLD`, `TDS_ANNUAL_THRESHOLD_CROSSED`, `TDS_BACKDATED_THRESHOLD_ADJUSTMENT`, `TDS_SECTION_197_APPLIED`
6. TDS taxable base: exclude GST when shown separately (CBDT Circular 23/2017)
7. Backfill migration script (idempotent, cursor-based, batch 100)
8. `GET /api/reports/tds-liability` endpoint
9. TDS dashboard UI (FR-UX-011)
10. 100% branch coverage test suite

**Definition of Done:** Cumulative threshold handles all test matrix scenarios. Concurrent processing test passes. Backfill runs on 1,000 historical invoices. TDS dashboard renders with FY selector. Sprinto benchmark passes.

### Phase 2: Vendor CRUD & Fields (1 Week)

**Deliverables:**
1. VendorMaster extensions: `tallyLedgerName`, `tallyLedgerGroup`, `vendorStatus`, `stateCode`, `stateName`, `lowerDeductionCert`
2. `TAN` on Tenant model
3. `VendorService` with CRUD (merge deferred to Phase 5)
4. Vendor API endpoints (list, detail, update, cert upload). Merge and duplicate detection deferred to Phase 5 per FR-VENDOR-014/015.
5. Section 197 certificate management
6. Tally export uses `tallyLedgerName` when set
7. Vendor list tab in frontend

**Definition of Done:** CRUD endpoints functional. Section 197 validates date range. Vendor tab renders with search/pagination. VIEWER read-only. Sprinto benchmark passes.

### Phase 2.5: AuditLog Model & Service (3-4 Days, Parallel with Phase 1 & 2)

**Deliverables:**
1. `AuditLog` Mongoose model (insert-only, no update/delete at application layer)
2. `AuditLogDeadLetter` collection (same schema + `error`, `failedAt`, `retryCount`; monthly cron retries; dashboard shows count; alert if >0 for >24h)
3. `AuditLogService` with `log(entry)` (fire-and-forget), `query(tenantId, filters)` (paginated), `exportCsv(tenantId, filters)` (stream)
4. Indexes: `{ tenantId, entityType, entityId, timestamp: -1 }`, `{ tenantId, timestamp: -1 }`, `{ tenantId, userId, timestamp: -1 }`, `{ tenantId, action, timestamp: -1 }`
5. `GET /api/audit-logs` query endpoint with filters (entityType, entityId, from, to, action, userId, page, pageSize)
6. Audit Trail UX: Activity tab on invoice detail, tenant-level audit trail in Settings

**Definition of Done:** AuditLog inserts do not block primary operations. Dead-letter collection captures failed writes with retry. 100% branch coverage on `AuditLogService`. Role restriction enforced (TENANT_ADMIN and PLATFORM_ADMIN only). Sprinto benchmark passes.

### Phase 3: Payment Recording (2-3 Weeks)

**Deliverables:**
1. `Payment` Mongoose model with allocations
2. `paymentStatus` and `paidAmountMinor` on Invoice
3. `PaymentService` with validation, duplicate detection, advance, reversal
4. Payment CRUD + approval API endpoints
5. Auto-computed `paymentStatus`
6. `CASH_PAYMENT_ABOVE_LIMIT` risk signal
7. Payment recording form in invoice detail (FR-UX-009)
8. Payment progress bar in invoice table (FR-UX-010)

**Definition of Done:** Payment validates allocations, no duplicate UTR, APPROVED/EXPORTED invoices only. Reversal creates new document, never mutates original. AuditLog failure does not block. 100% branch coverage on `PaymentService`. Sprinto benchmark passes.

### Phase 4: Payment Voucher Export (1-2 Weeks)

**Deliverables:**
1. `buildPaymentVoucherPayload()` in xml.ts
2. `bankLedgerName` on `TenantExportConfig`
3. `POST /api/exports/tally/payment-vouchers` endpoint
4. GUID generation for payment vouchers
5. `BILLALLOCATIONS.LIST` with `BILLTYPE="Agst Ref"`
6. Batch export (up to 100 per request)

**Definition of Done:** Payment voucher XML matches specification. `BILLTYPE="Agst Ref"` references purchase voucher `REFERENCE`. Manual Tally import settles purchase bill. 100% branch coverage. Sprinto benchmark passes.

### Phase 5: Reconciliation Enhancement & Vendor Merge (2-3 Weeks)

**Deliverables:**
1. `ReconciliationMapping` Mongoose model
2. Manual split/aggregate mapping endpoints
3. TDS-adjusted amount matching (C-011)
4. Date tolerance +/-2 business days (D-023)
5. Auto split detection (up to 10 invoices, D-016)
6. Auto aggregate detection
7. Migration from inline fields to ReconciliationMapping
8. Reconciliation split-pane UI (FR-UX-012)
9. Vendor merge (FR-VENDOR-014): merge API with TdsVendorLedger algorithm (FR-VENDOR-014a), merge confirmation modal
10. Duplicate vendor detection (FR-VENDOR-015): normalized name comparison, Levenshtein distance, shared PAN flagging

**Definition of Done:** TDS-adjusted scoring produces correct results. Split detection < 5 seconds for 100 unmatched transactions. Migration idempotent. Split-pane UI renders. Business day tolerance works. Vendor merge executes atomically with correct TdsVendorLedger consolidation. Duplicate detection surfaces candidates on vendor detail. Sprinto benchmark passes.

### UX Quick Wins (Parallel Throughout)

| Quick Win | FR | When |
|-----------|-----|------|
| 1. Risk signals expanded for NEEDS_REVIEW | FR-UX-001 | Week 1 |
| 2. Risk indicator column | FR-UX-002 | Week 1 |
| 3. PAN label clarification | FR-UX-003 | Week 1 |
| 4. Action hints in status badges | FR-UX-004 | Week 1 |
| 5. ARIA accessibility fixes | FR-UX-005 | Week 1 |
| 6. Action Required queue | FR-UX-006 | Week 2 |
| 7. Pre-export validation modal | FR-UX-007 | Week 2 |

### Demo Scope (5-6 Weeks)

Phase 0 + Phase 1 + Phase 2 + UX Quick Wins 1-7 + Payment Lite.

**Payment Lite for Demo (1 week addition):** A minimal payment recording capability to demonstrate the end-to-end invoice-to-payment flow, scoped to prevent the demo from appearing as "extraction-only." Payment Lite includes:

- Record a single payment against a single approved invoice (no multi-invoice allocation)
- Payment status tracking on invoice (unpaid / partially_paid / fully_paid)
- Payment method + UTR field (no method-specific validation beyond basic non-empty)
- Payment history display in invoice detail panel
- No payment approval workflow, no advance payments, no reversals, no payment runs

Payment Lite reuses a subset of Phase 3's `Payment` model (the full model is designed, but only single-invoice creation and status tracking are wired). This avoids throwaway code while delivering a convincing demo narrative: "upload invoice -> extract -> approve -> record payment -> export to Tally."

**Demo capabilities:** Correct Tally import with bill tracking, per-vendor TDS threshold tracking, TDS cumulative dashboard, vendor master with Tally sync, single-invoice payment recording, Action Required queue, risk indicators, pre-export validation.

**Demo Time:** 15 minutes.

### MVP Scope (8-10 Weeks)

Demo Scope + Phase 3 + Phase 4.

**Launch Criteria:**
1. All Phase 0-4 features pass acceptance criteria. No critical bugs.
2. Performance: invoice list < 2s for 1,000 invoices; TDS dashboard < 2s for 500 vendors; payment recording < 1s.
3. Compliance: TDS matches manual calculation for all test matrix scenarios.
4. Coverage: 100% branch on TdsCalculationService, TdsVendorLedgerService, PaymentService, TallyExporter/xml.ts.
5. Security: canRecordPayments enforced. AuditLog insert-only. VIEWER blocked from writes.
6. Data: all `*Minor` integers. Atomic `$inc` for balances.

### Full Production (14-18 Weeks)

MVP + Phase 5 + Future Phase 6 (Tally Desktop Bridge).

---

## 9. Success Metrics

| Metric | Current Baseline | Demo Target (Wk 5) | MVP Target (Wk 10) | Full Prod Target (Wk 18) | Measurement |
|--------|-----------------|--------------------|--------------------|--------------------------|------------|
| Invoice processing volume | ~100/month | 200/month | 500/month | 1,000/month per tenant | APPROVED+EXPORTED count |
| TDS accuracy rate | Unknown | 95%+ | 99%+ | 99.5%+ | Sample audit of 50 invoices/month vs manual |
| Time from receipt to Tally export | 72-96 hours | < 48 hours | < 24 hours | < 12 hours | avg(exportedAt - createdAt) |
| Reconciliation match rate | ~60% (1:1 only) | 70% (TDS-adjusted) | 80% (split/aggregate basic) | 85%+ auto-match | auto match count / total debits |
| Payment recording adoption | 0% | N/A | 50% invoices with payment | 80% invoices with payment | paymentStatus != unpaid / total approved |
| Time to record payment | N/A | N/A | Median < 45 seconds | Median < 30 seconds | Frontend event timing |
| Tally import success rate | Unknown | > 95% | > 99% | > 99.5% | Per-invoice in ExportBatch |
| TDS threshold detection accuracy | 0% | 100% crossings detected | 100% zero false negatives | 100% | Reconcile vs manual verification |
| Reduction in manual TDS corrections | Unknown | N/A | >= 70% reduction | >= 85% reduction | AuditLog tds_manual_override rate |
| CA firm adoption | 0 | 2 firms pilot | 5 firms production | 10 firms, 3 paying | CRM + active tenant count |
| MSME overdue invoice count | Unknown | N/A | 80% reduction | 90% reduction | MSME_PAYMENT_OVERDUE count trend |
| Audit trail completeness | 0% | N/A | 100% mutations logged | 100% with CSV export | AuditLog count > 0 for active tenants |
| Pre-export validation adoption | N/A | > 80% exports use modal | 100% (mandatory) | 100% | Feature usage analytics |
| Quarter-end prep time reduction | Manual (days) | N/A | >= 50% reduction | >= 75% reduction | User survey |
| User satisfaction | Not measured | Qualitative from 2 pilots | 3 of 5 pilot firms willing to provide a customer reference call (Week 10) | 2 of 3 paying firms renew at contract end (Week 18) | Reference call willingness tracked in CRM; renewal tracked at contract end |

### 9.1 Go-to-Market Readiness

#### Pilot Selection Criteria

| Criterion | Requirement | Rationale |
|---|---|---|
| Firm size | 3-10 staff, managing 10-50 client companies | Large enough to validate multi-tenancy, small enough for hands-on onboarding |
| Tally version | Tally Prime 4.x or 5.x (not legacy ERP 9) | XML import format compatibility; Prime is the forward path |
| Invoice volume | 200-1,000 invoices/month across clients | Sufficient volume to demonstrate TDS threshold crossings and reconciliation value |
| TDS complexity | At least 3 distinct TDS sections active (e.g., 194C, 194J, 194I) | Validates rate hierarchy and cumulative threshold across sections |
| Willingness | Dedicated point of contact; agrees to 2-week onboarding; provides feedback | Pilot success requires engagement, not just software access |

#### Pilot Onboarding Script (2 Weeks)

| Day | Activity |
|---|---|
| Day 1-2 | Tenant setup: company name, TAN, GL code CSV import, TDS section mapping, Tally company name |
| Day 3-4 | Historical invoice import: upload 50-100 past invoices to build TdsVendorLedger baseline and vendor master |
| Day 5-7 | Supervised processing: CA firm processes 20-30 live invoices with LedgerBuddy team observing and collecting friction points |
| Day 8-10 | Independent processing: CA firm processes invoices independently; LedgerBuddy monitors error rates and support tickets |
| Day 11-14 | Tally export validation: export 50+ invoices to Tally, verify bill tracking, run Form 26Q comparison against manual preparation |

#### Pricing Hypothesis

| Tier | Monthly Price (per tenant) | Included | Target |
|---|---|---|---|
| Starter | Rs 2,999/month | Up to 200 invoices, 1 user, basic TDS | Single-company SMEs |
| Professional | Rs 7,999/month | Up to 1,000 invoices, 5 users, full TDS + MSME + payment tracking | Mid-market finance teams |
| CA Partner | Rs 4,999/month per client tenant (min 5 tenants) | Up to 500 invoices/tenant, unlimited users, multi-tenant dashboard | CA firms managing multiple clients |

Annual billing at 2 months free (10-month effective rate). Pilot firms receive 3 months free, converting to paid upon mutual agreement.

#### Conversion Criteria (Pilot to Paid)

A pilot converts to paid when all of the following are met:

1. **Functional**: Tally import success rate > 95% for 2 consecutive weeks
2. **Adoption**: > 80% of invoices processed through LedgerBuddy (not manually entered in Tally)
3. **Accuracy**: Zero TDS computation errors flagged by CA partner during pilot period
4. **Value**: CA partner confirms >= 50% reduction in quarter-end TDS preparation time (qualitative)
5. **Willingness**: CA partner agrees to pricing terms and signs service agreement

---

## 10. Risks & Mitigations

### Compliance Risks

| # | Risk | Severity | Mitigation |
|---|------|----------|-----------|
| R1 | TDS cumulative threshold not tracked leads to incorrect deductions, vendor disputes, IT notices | Critical | Phase 1 highest priority. TdsVendorLedger with atomic $inc. Comprehensive test matrix. |
| R2 | TDS computed on GST-inclusive amount (over-deduction) causes vendor complaints | High | C-008, C-015: exclude GST when shown separately (CBDT Circular 23/2017). Risk signal when GST not separately shown. |
| R3 | MSME payment deadline not enforced leads to MSMED Act violation, interest liability | High | Risk signals at warning (7 days) and critical (overdue). Payment status tracking in Phase 3. |
| R4 | No TAN tracking makes Form 16A/26Q generation impossible | High | TAN added to Tenant model in Phase 2. |
| R5 | Tally import produces non-invoice entries, no bill tracking, no GST filing from Tally | Critical | Phase 0 immediate fix (1-2 days). Manual Tally Prime validation before any demo. |

### Technical Risks

| # | Risk | Severity | Mitigation |
|---|------|----------|-----------|
| R6 | TdsVendorLedger race condition on concurrent invoice processing | Medium | D-038: atomic $inc with findOneAndUpdate. Integration test with 10 concurrent submissions. Full transactions on replica set. |
| R7 | TdsVendorLedger backfill produces incorrect cumulative totals | Medium | Idempotent script. Run on staging with production snapshot. Compare against manual calculation for 20 sampled vendors. |
| R8 | Reconciliation split-detection subset-sum computationally expensive | Low | Limit to 10 invoices (D-016). Greedy pre-filter. Performance target < 5 seconds. |
| R9 | Schema migration for integer validation breaks existing float data | Medium | Pre-migration fixup script rounds all *Minor fields. Validation applied per-model as touched. |
| R10 | Dual-write during ReconciliationMapping migration creates consistency risk | Medium | Feature flag. Read from new, write to both. Migrate, cut over. |
| R11 | AuditLog write failures silently lose compliance data | Medium | Fire-and-forget with single retry. Dead-letter mechanism. Monthly audit of dead letters. |

### Product Risks

| # | Risk | Severity | Mitigation |
|---|------|----------|-----------|
| R12 | Demo without payment recording unconvincing for finance directors | Medium | **Mitigated**: Payment Lite added to demo scope (5-6 weeks). Single-invoice payment recording demonstrates the end-to-end flow. Full payment features (multi-invoice, approval, advance, reversal) follow in Phase 3. |
| R13 | 14-18 week total timeline too long for market entry | Medium | Parallelized phasing. Phase 0 + Phase 1&2 (parallel) + Payment Lite = 5-6 weeks to demo. Full production at 14-18 weeks with adequate team (3.5 FTE); 20-24 weeks if team < 3 engineers. |
| R14 | Navigation restructure delays feature delivery if attempted as big-bang | Low | New tabs added incrementally. No removal until replacements proven. |
| R15 | Tally XML structural errors cause import failures during demo | High | Phase 0 first. Automated XML validation test. Manual Tally Prime import before any demo. |

---

## 11. Open Questions (OAR)

| ID | Severity | Question | Status | Recommended Approach | Decision Owner |
|---|---|---|---|---|---|
| OAR-001 | HIGH | How to verify Section 197 certificate authenticity? TRACES API integration? | Partially resolved by D-013 | Track manually for MVP. Emit `TDS_SECTION_197_UNVERIFIED` risk signal. Defer TRACES API. | Product + CA Advisor |
| OAR-002 | HIGH | Invoice correction -> TDS recomputation strategy (reverse + recompute)? | Algorithm defined, impl deferred | MVP: emit `TDS_INVOICE_CORRECTED` risk signal. Block auto-recompute. Require manual override. Phase 6: automated reverse-and-recompute. | Engineering Lead |
| OAR-003 | MED | Generate Form 26Q directly or export to TRACES-compatible FVU format? | Open | Export to FVU format (lower effort, leverages existing CA tools). | Product |
| OAR-006 | HIGH | Payment reversal for bounced cheques: auto-detect from bank statement? | D-012 defines model | MVP: manual reversal only. Post-MVP: pattern detection ("bounce", "return", "dishonour") with suggested reversal. | Product + Engineering |
| OAR-007 | HIGH | Does target market use Tally statutory TDS module or manual Form 26Q filing? | **Phase 1 research (Weeks 1-2)** | Conduct 3 structured interviews with CA firms in Weeks 1-2 of Phase 1. Interview script: (a) "Do you use Tally's statutory TDS module or manual/Excel-based 26Q filing?", (b) "If statutory, which nature-of-payment categories do you use?", (c) "Would you switch to statutory if import handled it automatically?" Decision rule: if >50% of interviewed firms use Tally statutory TDS, add statutory TDS tags (`INCOMETAXSTATUTORYDETAILS`, `NATOFPAYMENT`, `DEDUCTEETYPE`) to Phase 0 scope. If <=50%, defer to Phase 7. | Product |
| OAR-008 | HIGH | TAN storage and propagation | **RESOLVED** by D-009 | TAN field added to Tenant model. | -- |
| OAR-009 | MED | Multi-currency Tally export (FOREIGNCURRENCYNAME, EXCHANGERATE)? | Open | Defer. India AP predominantly INR. Confirm with target CAs. Add to Phase 6 if needed. | Product |
| OAR-010 | MED | TDS deposit (challan) tracking in-scope for MVP? | Deferred | Defer. Enables 26Q but adds model + workflow complexity. Risk signal for deadlines is sufficient for MVP. | Product |
| OAR-011 | MED | E-TDS filing: generate FVU file or integrate with TRACES? | Post-MVP | Recommend FVU file generation. | Product |
| OAR-012 | LOW | Tax calendar feature? | Post-MVP | Standard in competitors but low priority vs core compliance. | Product |
| OAR-013 | LOW | Payment advice generation (PDF/email to vendor)? | Post-MVP | Value-add, not compliance-critical. | Product |
| OAR-014 | LOW | Three-way matching (PO-GRR-Invoice) architectural consideration? | Enterprise | Not for MVP. Nullable `purchaseOrderRef` field added to Invoice model now to avoid breaking migration when three-way matching is implemented in a future phase. No other schema changes. | Product |
| OAR-015 | MED | GSTR-2B reconciliation: native or third-party? | Recommend native | Build GSTR-2B JSON import + matching (FR-GST-014 through FR-GST-017). Post-MVP Phase 7. | Product + Engineering |

---

## 12. Out of Scope

The following capabilities are explicitly excluded from this PRD and deferred to named future phases:

| Capability | Rationale | Future Phase |
|---|---|---|
| Form 26Q filing / e-TDS generation | Requires TDS deposit (challan) tracking. Recommend FVU file export. | Post-MVP (OAR-003, OAR-010) |
| TRACES integration for Section 197 verification | Certificates manually uploaded and trusted for MVP. | Post-MVP (OAR-001) |
| TDS challan/deposit tracking | Recording challan numbers, BSR codes, deposit dates adds model + workflow complexity. | Post-MVP (OAR-010) |
| Section 206AB auto-rate adjustment | Requires TRACES compliance check API. Deferred to risk signal only. | Post-MVP (D-027) |
| Form 16A generation | Depends on challan tracking and 26Q filing. | Post-MVP |
| TCS annual threshold tracking | Section 206C(1H) applies above Rs 50 lakh/vendor/year. | Post-MVP |
| Multi-currency payments/export | India AP predominantly INR. FEMA compliance needed (Form 15CA/15CB). | Post-MVP (OAR-009) |
| Bank API integration (real-time feeds) | Requires per-bank partnerships. Manual upload sufficient for MVP. | Phase 7+ |
| Bank upload file generation (NEFT H2H, RTGS bulk) | Bank-specific formats vary. PaymentRun model accommodates. | Phase 6 |
| Payment advice generation (PDF/email) | Value-add, not compliance-critical. | Post-MVP (OAR-013) |
| Three-way matching (PO-GRR-Invoice) | Enterprise feature requiring PO and GR modules. | Post-MVP (OAR-014) |
| Automatic bounced cheque detection from statements | Requires narrative pattern recognition. Manual reversal for MVP. | Phase 7+ (OAR-006) |
| GSTR-2B reconciliation | Requires GST return data import. Separate feature track. | Phase 7 (OAR-015) |
| UPI autopay / NACH mandate setup | Payment gateway integration + vendor agreements. | Phase 8+ |
| Tally statutory TDS module integration | Requires deductee type mapping to Tally nature-of-payment. | Phase 7+ |
| Inventory/line-item mode vouchers (HSN/SAC) | All vouchers use Accounting Voucher View. | Phase 6+ |
| Debit Note and Journal Voucher generation | Only Purchase and Payment Vouchers in scope. | Post-MVP |
| Direct Tally API connectivity (desktop bridge) | Phases 0-5 use file-based export. | Phase 6+ |
| Reverse Charge Mechanism (RCM) in Tally | Requires additional voucher structure. | Phase 7 |
| Tax calendar / reminder system | Low priority vs core compliance features. | Post-MVP (OAR-012) |
| Vendor auto-creation from pipeline (manual creation before invoice) | Vendors continue auto-creation during processing. | N/A |

---

## 13. Dependencies

### Infrastructure Dependencies

| Dependency | Required By | Current Status | Risk |
|---|---|---|---|
| MongoDB replica set (for transactions) | FR-PAY-011 (atomic updates), FR-VENDOR-014 (merge), FR-MSME-007 (nightly job) | Available in production. Local dev uses standalone (atomic $inc works, multi-doc transactions do not). | Medium |
| ApprovalWorkflow `workflowType` extension | FR-PAY-026 through FR-PAY-030 | Not yet implemented. Schema change required. | Low |
| VendorMaster field extensions | FR-MSME-002, FR-VENDOR-011, Phase 3 validation | Partially exists (msme subdoc). New fields needed. | Low |
| Invoice model extensions | FR-PAY-015 | New fields: paymentStatus, paidAmountMinor, `purchaseOrderRef: { type: String, default: null }`. New index. Nullable `purchaseOrderRef` added now to avoid breaking migration when three-way matching (PO-GRR-Invoice) is implemented in a future phase. | Low |
| Nightly scheduled job infrastructure | FR-MSME-006 | Does not exist. Requires cron-style runner (node-cron or Bull). | Medium |
| AuditLog model and service | FR-AUDIT-001, FR-PAY-001 (AC-5) | Not yet implemented. | Low |
| Desktop bridge agent (Electron/system tray) | Phase 6 vendor sync, pre-validation | Does not exist. New application surface. | High |

### Cross-Phase Dependencies

| Dependency | Owner | Blocker For | Risk |
|---|---|---|---|
| TdsVendorLedger model and service | Backend (Compliance) | Phase 1 cumulative, FR-VENDOR-007 TDS summary | Medium |
| Payment model and service | Backend (Payment) | Phase 3, Phase 4 payment voucher export | High |
| AuditLog model and service | Backend (Core) | FR-VENDOR-011, FR-AUDIT-* | Low |
| Frontend navigation restructure | Frontend | FR-VENDOR-002 tab placement | Low |

### Capability Matrix

| Capability | PLATFORM_ADMIN | TENANT_ADMIN | MEMBER | VIEWER |
|---|---|---|---|---|
| canRecordPayments | Yes | Yes | Configurable | No |
| canApprovePayments | Yes | Yes | No | No |
| canExportPaymentVouchers | Yes | Yes | No | No |
| canViewPayments | Yes | Yes | Yes | Yes (ViewerScope) |
| canViewAgingReport | Yes | Yes | Yes | Yes (ViewerScope) |
| canViewMsmeDashboard | Yes | Yes | No | No |
| canManageVendorMsmeFields | Yes | Yes | No | No |
| canViewAuditLogs | Yes | Yes | No | No |

---

## 14. Glossary

| Term | Full Form | Definition |
|------|-----------|-----------|
| **TDS** | Tax Deducted at Source | A mechanism of income tax collection in India where the payer deducts tax at prescribed rates from payments to the payee (vendor) and remits it to the government. Governed by Sections 192-206 of the Income Tax Act, 1961. |
| **TCS** | Tax Collected at Source | A mechanism where the seller (vendor) collects tax from the buyer at the time of sale. Governed by Section 206C of the Income Tax Act. |
| **GST** | Goods and Services Tax | India's unified indirect tax replacing multiple state and central taxes. Levied on supply of goods and services. Introduced July 1, 2017. |
| **CGST** | Central Goods and Services Tax | GST component collected by Central Government on intra-state supplies. Rate is half the applicable GST rate. |
| **SGST** | State Goods and Services Tax | GST component collected by State Government on intra-state supplies. Rate equals CGST. |
| **IGST** | Integrated Goods and Services Tax | GST component for inter-state supplies. Rate equals full GST rate. Collected by Central Government and apportioned to destination state. |
| **PAN** | Permanent Account Number | 10-character alphanumeric identifier (AAAAA0000A) issued by Income Tax Department. Absence triggers 20% TDS under Section 206AA. |
| **TAN** | Tax Deduction and Collection Account Number | 10-character identifier (AAAA00000A) required on all TDS returns (Form 26Q) and certificates (Form 16A). |
| **GSTIN** | Goods and Services Tax Identification Number | 15-character identifier (SSAAAAA0000A0Z0). First 2 digits = state code; characters 3-12 = PAN. |
| **IRN** | Invoice Reference Number | 64-character hash from GST e-invoice system. Mandatory for businesses with turnover > Rs 5 crore. |
| **MSME** | Micro, Small and Medium Enterprises | Classified by investment and turnover under MSMED Act 2006. Micro: up to Rs 1 Cr / Rs 5 Cr. Small: up to Rs 10 Cr / Rs 50 Cr. Medium: up to Rs 50 Cr / Rs 250 Cr. Entitled to 45-day statutory payment deadline. |
| **FY** | Financial Year | April 1 to March 31. TDS thresholds and reporting are per FY. |
| **AY** | Assessment Year | Year following FY in which income is assessed. AY 2026-27 = FY 2025-26. |
| **Form 26Q** | Quarterly TDS Return (Non-Salary) | Filed with TRACES reporting all TDS deductions. Due: Q1 by 31-Jul, Q2 by 31-Oct, Q3 by 31-Jan, Q4 by 31-May. |
| **Form 16A** | TDS Certificate (Non-Salary) | Certificate from deductor to deductee. Must issue within 15 days of quarterly filing. Generated from TRACES. |
| **RCM** | Reverse Charge Mechanism | GST mechanism where buyer pays GST instead of supplier. ITC available only after RCM payment. |
| **ITC** | Input Tax Credit | Credit claimable for GST paid on purchases against GST liability on sales. Available only if in GSTR-2B. |
| **GSTR-2B** | Auto-Generated ITC Statement | Read-only ITC statement generated from suppliers' GSTR-1 filings. Basis for ITC claims. |
| **HSN** | Harmonized System of Nomenclature | 4-8 digit code classifying goods for GST. Example: 8471 = data processing machines. |
| **SAC** | Services Accounting Code | 6-digit code classifying services for GST. Example: 998311 = management consulting. |
| **UTR** | Unique Transaction Reference | Identifier for electronic fund transfers (NEFT/RTGS/IMPS). Typically 16-22 alphanumeric characters. |
| **NEFT** | National Electronic Funds Transfer | Bank-to-bank transfer system, 24x7 since Dec 2019. Settlement in half-hourly batches. |
| **RTGS** | Real Time Gross Settlement | Real-time transfer for high-value transactions. Minimum Rs 2,00,000. Immediate and irrevocable. |
| **Section 197** | Lower Deduction Certificate | Allows vendor to obtain certificate for TDS at lower rate based on estimated income. Valid for specific FY and maximum amount. |
| **Section 206AA** | No-PAN Penalty Rate | TDS at higher of prescribed rate or 20% when deductee fails to furnish PAN. |
| **Section 206AB** | Non-Filer Penalty Rate | TDS at higher of 2x prescribed rate or 5% for specified persons who have not filed IT returns for 2 preceding AYs. |
| **TRACES** | TDS Reconciliation Analysis and Correction Enabling System | Online portal for TDS/TCS filing, certificates, corrections. URL: tdscpc.gov.in. |
| **FVU** | File Validation Utility | NSDL software for validating TDS return files before TRACES submission. |

---

## Appendix A: Demo Script

**Target Audience:** CA firm partners and mid-market finance controllers.
**Duration:** 15 minutes (10 min demo + 5 min Q&A).
**Presenter:** Product manager or solutions engineer.

### Seed Data Requirements

Before the demo, seed the following in a dedicated demo tenant:

- Tenant: "Demo CA Firm - Client ABC Pvt Ltd" with TAN, GL codes, TDS section mappings
- 8 vendors with varying profiles: 2 with PAN (active), 1 without PAN (206AA scenario), 1 MSME micro vendor, 1 with Section 197 certificate, 1 blocked vendor, 1 with GSTIN from different state (inter-state GST), 1 with cumulative near threshold
- 15 historical invoices (processed, building TdsVendorLedger baseline): vendor "Infra Services Ltd" at Rs 90,000 cumulative on 194C (near Rs 1,00,000 threshold)
- 5 new invoices ready for processing (uploaded but not yet approved)

### Demo Steps

| Step | Action | What to Show | Talking Points |
|---|---|---|---|
| **1. Login & Overview** | Log in as tenant admin. Show Overview dashboard. | KPI cards, status distribution, Action Required count badge. | "LedgerBuddy gives your team a single view of where every invoice stands. No more digging through Tally data folders." |
| **2. Upload Invoices** | Upload 3 invoice PDFs (drag and drop). | Ingestion progress overlay with elapsed time, OCR + SLM extraction, auto-classification. | "Drop invoices in any format -- PDF, image, scanned. AI extracts vendor, amounts, GST breakdown, dates. No templates to configure." |
| **3. Review Extracted Data** | Open an extracted invoice. Show compliance panel. | Auto-detected TDS section, GST breakdown (CGST/SGST or IGST), PAN validation level, risk signals. | "Every invoice is enriched with compliance data at extraction time. TDS section, PAN status, GST treatment -- all before you approve." |
| **4. TDS Threshold Crossing** | Open the invoice for "Infra Services Ltd" (Rs 20,000, pushing cumulative from Rs 90,000 to Rs 1,10,000). | `TDS_ANNUAL_THRESHOLD_CROSSED` risk signal. Catch-up TDS computed on full Rs 1,10,000. TDS amount shows the catch-up calculation. | "This invoice just pushed the vendor over the Section 194C annual threshold. The system automatically computes catch-up TDS on the entire cumulative amount. No spreadsheet tracking needed." |
| **5. No-PAN Vendor** | Show the invoice from vendor without PAN. | `TDS_NO_PAN_PENALTY` risk signal, 20% rate applied, `rateSource: "206aa-no-pan-penalty:194J"`. | "When a vendor hasn't provided their PAN, the system automatically applies the 20% penalty rate per Section 206AA. Your team doesn't need to remember the rule." |
| **6. Vendor Management** | Navigate to Vendors tab. Open "Infra Services Ltd." | Vendor detail with TDS summary (cumulative position across FYs), Section 197 certificate, possible duplicates, Tally ledger mapping. | "One screen shows everything about a vendor: PAN, GSTIN, TDS position, MSME status, Tally mapping. CA firms managing 30+ clients can finally see the full picture." |
| **7. Approve & Export** | Approve 5 invoices. Click Export to Tally. | Pre-export validation modal: GL codes assigned, PAN present, no critical signals. Export 5 valid invoices. | "Before export, the system checks for problems. No more failed Tally imports because a GL code was missing or a vendor name was empty." |
| **8. Show Tally Import Result** | Switch to Tally Prime (pre-imported). Show the purchase voucher. | Invoice-mode voucher with BILLALLOCATIONS, bill tracking in Tally's outstanding report, PLACEOFSUPPLY for GST filing. | "The voucher imports correctly on the first try. Bill tracking works. GST filing data is present. AP aging in Tally shows the right numbers." |
| **9. Record Payment** | Back in LedgerBuddy. Record a payment against one approved invoice. | Payment form with amount, method, UTR. Invoice status updates to "Paid." Payment history visible. | "Record payments as they happen. The invoice status updates instantly. When you export, LedgerBuddy generates the payment voucher that settles the bill in Tally." |
| **10. TDS Dashboard** | Navigate to TDS dashboard. | FY selector, quarterly summary, vendors approaching threshold, per-vendor drill-down. | "Quarter-end 26Q preparation that used to take 3-4 days? This dashboard gives you the data in 2 seconds. Filter by quarter, vendor, section -- and export to CSV for your filing tool." |

### Anticipated CA Questions and Prepared Answers

| Question | Answer |
|---|---|
| "What if the SLM extracts the wrong TDS section?" | "Every auto-detected section includes a confidence score and the rate source is transparent. Your team can override with one click, and the system logs the change for audit. The cumulative ledger updates automatically." |
| "Does this work with Tally ERP 9 or only Prime?" | "XML import works with both Tally ERP 9 and Tally Prime. The XML format is compatible with both. We test against Tally Prime; ERP 9 users should validate on their version." |
| "Can I manage multiple client companies?" | "Yes. Each client company is a separate tenant with its own TDS configuration, GL codes, approval workflows, and vendor master. You switch between clients without logging out." |
| "What happens when a backdated invoice arrives?" | "The system assigns it to the correct financial year based on invoice date and recomputes the cumulative TDS position. If it causes a threshold crossing, catch-up TDS is applied automatically." |
| "How do you handle Section 197 certificates?" | "Upload the certificate on the vendor profile with validity dates and maximum amount. The system automatically applies the lower rate within the validity window and reverts to standard when it expires or the amount is exhausted." |
| "What about vendors who haven't filed returns (206AB)?" | "We flag them with a risk signal but don't auto-apply the higher rate, because 206AB verification requires TRACES API confirmation. The signal prompts your team to verify before processing." |
| "Is the data exportable for 26Q filing?" | "Yes. The TDS liability report exports as CSV with columns matching Form 26Q Annexure II structure. TDS deposited column is blank for now (challan tracking is on our roadmap)." |
| "What if Tally import fails for some vouchers?" | "The export history shows per-invoice success/failure with the specific Tally error. You can re-export only the failed invoices with one click." |

---

*VKL Traceability: This PRD is grounded in VKL decisions D-001 through D-044; constraints C-001 through C-020; and evidence items E1 through E32. Every functional requirement traces to at least one VKL decision or constraint.*
