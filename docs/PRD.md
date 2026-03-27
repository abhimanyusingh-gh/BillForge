# Product Requirements Document: BillForge

> Last updated: 2026-03-27

---

## 1. Overview

### The Problem

An accounts payable clerk processing 150+ invoices daily spends most of their time not on judgment calls, but on hunting — scrolling through PDFs to find a vendor name, cross-referencing a total against a line buried on page three, and manually keying values into Tally. When invoices arrive in different formats from different vendors, every new document restarts the same search-and-verify loop. This repetitive search fatigue is the bottleneck, not the approval decision itself.

### Why BillForge

BillForge eliminates the search. For every extracted field — vendor name, invoice number, total amount — the reviewer sees the extracted value alongside a cropped image of exactly where in the document it was found. Instead of scanning an entire PDF top-to-bottom, the reviewer glances at a value, sees the source crop, confirms or corrects, and moves on.

**Verification time target: under 45 seconds per invoice (median).** This target is a hypothesis based on the interaction pattern — source crops eliminate the document search loop that dominates manual review time. The number must be validated with timed observations of real AP clerks processing real invoices from the first adopter before it becomes a marketing claim. Until then, it is an internal design target, not an external promise.

### Three Outcomes That Matter

**1. Verification in seconds, not minutes.**
Every extracted field is paired with its source crop — the exact region of the document where the value was found, highlighted with a bounding box overlay. The reviewer doesn't search the document; the document's evidence is brought to them. This is the core interaction pattern that makes BillForge faster than any alternative that shows extracted data without showing proof.

**2. Accuracy that compounds over time.**
Every correction a reviewer makes is recorded per vendor and per invoice type. The next time an invoice from that vendor arrives, the system applies those learned corrections automatically. BillForge gets more accurate the longer a tenant uses it — which means the switching cost works in the customer's favor. After 30 days, the system requires fewer corrections; after 90 days, it handles known vendors almost autonomously. This is a retention mechanism, not just a feature.

**3. India-first accounting connectivity.**
Tally is the dominant accounting system for Indian SMBs and mid-market finance teams. BillForge generates Tally-native XML with full GST breakdown (CGST/SGST/IGST/Cess) — ready to import with no manual mapping. This is the go-to-market wedge: competitors serving the Indian market either don't support Tally natively or don't handle GST itemization correctly. Export connectivity is built on a boundary/adapter pattern — Tally is the first connector, not the last. Adding QuickBooks, Zoho, or any ERP is an adapter implementation behind the same `AccountingExporter` interface.

### Architecture as Product Capability

Every external dependency in BillForge — OCR engine, ML model, file storage, email source, accounting export — is defined as an interface with pluggable provider implementations. This is not a technical footnote; it is a deliberate product decision that serves the customer:

- **Ingestion boundary:** Gmail is the first connector. When a customer uses Outlook or a custom ERP inbox, adding a new `IngestionSource` implementation is a connector change, not a rewrite. The `FileStore` boundary means ingestion works identically whether files arrive from email, S3, or manual upload.
- **OCR/ML boundary:** The OCR provider can be swapped from local MLX (development) to a cloud API (production) with a configuration change. The SLM model can be upgraded without touching the pipeline code.
- **Export boundary:** Tally is one implementation of `AccountingExporter`. The interface, field mapping, and export batch tracking are generic. Adding a new accounting target requires only the adapter and ledger mapping — the approval workflow, audit trail, and batch management come for free.

This means when the second adopter arrives with different tools, BillForge adapts at the configuration layer, not the code layer.

---

## 2. Target Users

### First Adopter Profile

The first adopter is an Indian accounting services firm where each staff member handles invoices for a specific client. Invoices arrive at a client-specific Gmail inbox. The tenant admin assigns each inbox to the responsible team member. The workflow is flat: one person, one client, one inbox.

### Operational Model

| Who | What They Do Daily | In-App Role | Key Constraint |
|-----|-------------------|-------------|----------------|
| **AP Reviewer** | Opens BillForge, sees their assigned invoices already extracted. For each invoice: glances at extracted value, checks the source crop image beside it, corrects if wrong, approves. Processes 100-200 invoices/day. | MEMBER | Can approve invoices up to a configured value limit. Above that limit, approval escalates to the tenant admin. |
| **Tenant Admin** | Connects Gmail inboxes, assigns inboxes to team members, configures approval workflow rules (e.g., "invoices above ₹50,000 require admin approval"), invites new team members, reviews escalated invoices, exports approved batches to Tally. | TENANT_ADMIN | Controls the operational configuration. Manages the team. |
| **Platform Operator** | Onboards new tenants, monitors aggregate health (document counts, failure rates, token usage). Never sees invoice content — only operational metrics. | PLATFORM_ADMIN | Data boundary: sees tenant metadata only, never invoice-level data or OCR output. |
| **Auditor** | Read-only access to a configurable scope of invoices. Can view extraction results and approval history but cannot modify, approve, or export. | VIEWER | Scope is configured by tenant admin via ViewerScope (which users' invoices are visible). |

### Role Extensibility

The current model is deliberately flat for adopter one. The approval workflow engine supports multi-step, role-based, amount-conditional approval chains — this is built but gated behind configuration, not code. When adopter two arrives with a real AP hierarchy (junior reviewer → senior → manager), the workflow builder supports it without code changes:

- Simple mode: checkbox toggles for "require manager review" and "require final signoff"
- Advanced mode: ordered steps with approver type (any member / specific role / named users), approval rule (any / all must approve), and amount conditions (e.g., "if total > ₹1,00,000 require CFO approval")

The role assignment UI supports TENANT_ADMIN, MEMBER, and VIEWER. PLATFORM_ADMIN is assigned by email allowlist, not by UI.

---

## 3. Core Features

### 3.1 Source-Verified Review (The Core Differentiator)

**Customer outcome:** A reviewer verifies an invoice in 30 seconds instead of 3 minutes because they never search the document — the evidence comes to them.

**How it works:**

1. OCR extracts text with per-block bounding boxes from every page of the document
2. SLM extracts structured fields (vendor, amount, dates, etc.) and returns which OCR blocks each field came from
3. For each extracted field, the system generates a **source crop** — a zoomed image of the exact document region where the value was found
4. The reviewer sees a table: `| Field | Extracted Value | Source Crop | Confidence |`
5. They also see a **source overlay** — the full invoice page with a highlighted bounding box around the relevant region
6. Clicking a field name in the extracted fields table switches the source viewer to show that field's location

**What the reviewer does at each step:**
- Scans the extracted fields table. Green confidence = likely correct. Red = needs checking.
- For any field they want to verify, they glance at the source crop next to the value. If the crop shows "₹1,18,000/-" and the extracted value says "₹1,18,000" — confirmed. Move on.
- If a field is wrong, they click the value, type the correction, press Enter. The correction is saved and fed into the learning store for future invoices from that vendor.
- When all fields look correct, they click Approve. **Approval is always a deliberate human action** — the system surfaces high-confidence invoices for easy batch selection, but never auto-approves. The human is the decision-maker; the system is the assistant.

**Implementation:** `ExtractedFieldsTable.tsx` (crops inline), `InvoiceSourceViewer.tsx` (bbox overlays), `sourceHighlights.ts` (highlight computation), `DeepSeekOcrProvider.ts` (block extraction with coordinates)

### 3.2 Extraction Learning (The Accuracy Moat)

**Customer outcome:** BillForge gets more accurate the longer you use it. Corrections made today improve extraction for the same vendor tomorrow.

**How it works:**

- Every field correction is stored per-tenant, grouped by invoice type (e.g., "gst-tax-invoice") and vendor fingerprint (e.g., "Acme Corp standard layout")
- On future extractions, the SLM receives prior corrections as hints: "For Acme Corp GST invoices, the total is usually in the bottom-right, and the GSTIN format is XX-XXXXXXXXXX"
- Vendor-specific corrections override type-level corrections for the same field
- Corrections are capped at 6 per grouping key and auto-pruned after 90 days

**Validation needed (open question):** The 6-correction cap and 90-day TTL are initial engineering constraints, not validated thresholds. Success criteria before locking these in:
- Measure correction rate reduction: does the learning loop reduce manual corrections by ≥30% for returning vendors within 30 days?
- Monitor "other" classification rate: if >15% of invoices fall into the "other" type, the closed category set needs expansion
- Track whether vendor template changes (e.g., new invoice format) cause stale corrections to degrade accuracy

**Current status:** The full learning loop is wired end-to-end. During extraction, the pipeline fetches prior corrections from the learning store and passes them as `priorCorrections` hints to the SLM. When a reviewer manually edits a parsed field, the correction is recorded by both vendor fingerprint and invoice type. The SLM also returns an `invoiceType` classification which is stored in invoice metadata and displayed in the review UI.

**Implementation:** `extractionLearningStore.ts`, `ExtractionLearning` model (MongoDB TTL index), `vendorFingerprint.ts`

### 3.3 Multi-Source Ingestion

**Customer outcome:** Invoices arrive from whatever channel the client uses — Gmail, direct upload, S3 drop — and appear in the dashboard ready for review, with no manual import step.

Every ingestion source is an implementation of the `IngestionSource` interface. Gmail is the first production connector; folder and S3 upload are available for testing and bulk import. Adding a new source (Outlook, ERP inbox, webhook) requires implementing one interface — the pipeline, checkpointing, and dedup logic remain unchanged.

| Source | Status | Description |
|--------|--------|-------------|
| Gmail (OAuth2) | Production | Per-tenant inbox connection. Polling at 1/2/4/8h intervals. MessageId dedup. |
| S3 Upload | Production | Manual upload via dashboard. Max 50 files, 20MB each. PDF/JPG/PNG. |
| Folder | Development | Local file system source for testing. |
| *Next: Outlook* | *Planned* | *Same IngestionSource interface, new OAuth provider.* |

- Crash-safe per-source checkpointing in MongoDB
- Unique `sourceDocumentId` index prevents duplicate processing
- Ingestion serialized per tenant via `IngestionJobOrchestrator` (no concurrent race conditions)
- Test tenants: manual ingest only (button trigger). Production tenants: auto-ingest from configured sources.

### 3.4 Staged Extraction Pipeline

**Customer outcome:** High extraction accuracy without high cost — the system only uses expensive ML stages when cheaper ones aren't confident enough.

| Stage | What Happens | Triggered When |
|-------|-------------|----------------|
| Vendor Fingerprint | Match known vendor layout patterns | Always (free) |
| OCR | Text + bounding box extraction from all pages | Always (low cost) |
| SLM Field Extraction | ML model extracts structured fields from OCR blocks + page images | Always (medium cost) |
| Deterministic Validation | Cross-check: date formats, amount consistency, currency detection | Always (free) |
| LLM Vision Re-extraction | Page image analysis with prior correction hints | Only when confidence < 85% (high cost) |

**Invoice type classification:** The SLM classifies each invoice into one of 10 categories (`gst-tax-invoice`, `receipt`, `credit-note`, etc.) during extraction — no extra ML call. This classification keys the extraction learning store.

**Implementation:** `InvoiceExtractionPipeline.ts`, `DeepSeekOcrProvider.ts`, `HttpFieldVerifier.ts`, `deterministicValidation.ts`

### 3.5 Confidence Scoring

**Customer outcome:** The reviewer sees at a glance which invoices need attention and which are likely correct, without reading every field.

| Band | Score | What the Reviewer Sees |
|------|-------|----------------------|
| Green | 91–100 | "Likely correct." Pre-selected for batch approval. Reviewer can approve in one click after a quick glance. |
| Yellow | 80–90 | "Probably correct, worth checking." Opens detail panel to verify flagged fields. |
| Red | 0–79 | "Needs manual review." Source crops become critical — reviewer uses them to verify and correct. |

**Green does not mean auto-approved.** Green invoices are pre-selected in the batch selection UI, making it easy for the reviewer to approve many at once — but the reviewer must still click "Approve." The system never approves on behalf of the human. This is a hard constraint, not a default.

Risk flags: amounts above a configurable threshold, due dates unreasonably far in the future.

### 3.6 Approval Workflows

**Customer outcome:** Invoices above a certain value automatically escalate to the admin. The rules match how the team actually works.

**Current adopter workflow:** MEMBERs can approve invoices up to a configured value limit. Above that threshold, the invoice enters AWAITING_APPROVAL and requires TENANT_ADMIN sign-off.

**Available workflow modes:**
- **Simple:** Toggle "require manager review" and/or "require final signoff"
- **Advanced:** Multi-step builder with ordered approval steps, approver types (any member / role / specific users), rules (any / all), and amount-based conditions

Approval is per-invoice, tracked with timestamp, user, and role. Rejection requires a written reason. The full approval timeline is visible in the invoice detail panel.

### 3.7 Tally XML Export

**Customer outcome:** Approved invoices export directly into Tally with correct GST breakdown — no manual re-entry into the accounting system.

- Generates Tally purchase voucher XML with mapped fields
- India GST: separate ledger entries for CGST, SGST, IGST, and Cess (configurable ledger names)
- Amount conversion: integer minor units → formatted string only at the export boundary
- Download as XML file or POST directly to Tally endpoint
- Export batches tracked with audit trail (who exported, when, how many succeeded/failed)

**Extensibility:** Tally is the first implementation of `AccountingExporter`. The interface accepts mapped invoice fields and returns an export result. Adding QuickBooks, Zoho Books, or any ERP export requires implementing this interface and its field mapping — the batch tracking, approval checks, and download infrastructure are shared.

### 3.8 Multi-Tenant Data Isolation

- Every collection is partitioned by `tenantId`
- Platform admin sees aggregate metrics only — never invoice content, OCR text, or extracted values
- VIEWER role has configurable data scope (which users' invoices are visible)
- Tenant mode: `test` (manual ingest, folder source allowed) or `live` (auto-ingest from configured sources)

**Tenant lifecycle gap (documented):** There is currently no API to transition a tenant from test to live mode after creation. Mode is set at onboarding time by the platform admin. A mode transition API is planned.

### 3.9 Integrations

| Integration | Status | Boundary | Next |
|-------------|--------|----------|------|
| Gmail (OAuth2) | Live | `IngestionSource` | Outlook, custom IMAP |
| Tally XML | Live | `AccountingExporter` | QuickBooks, Zoho Books |
| SendGrid / SMTP | Live | `InviteEmailSender` | — |
| Anumati (Account Aggregator) | Built | `IBankConnectionService` | Payment reconciliation (when in scope) |
| S3 / MinIO | Live | `FileStore` | — |

All integrations are behind interface boundaries. Swapping or adding a provider is a configuration change or adapter implementation, not a pipeline rewrite. The admin should have visibility into which integrations are enabled for their tenant — an integration management UI is planned.

---

## 4. User Flows

### 4.1 The Reviewer's Day (Core Flow)

**Context:** Priya is an AP clerk at an accounting firm. She handles invoices for 3 clients. Each client's invoices land in a dedicated Gmail inbox that her tenant admin has connected to BillForge and assigned to her.

1. **Priya opens BillForge.** Her dashboard shows 47 invoices ingested overnight from her assigned inboxes. The status tab shows 38 green (high confidence), 6 yellow, 3 red.

2. **She starts with the green batch.** She clicks "Select All Green," scans the list — vendor names and amounts look right. She clicks "Approve 38 invoices." A confirmation dialog shows the count. She confirms. Done in 30 seconds.

3. **She moves to the yellow invoices.** She clicks the first one. The detail panel slides open, showing the invoice image on the left and extracted fields on the right. Next to "Total Amount: ₹1,18,000" she sees a cropped image of the handwritten amount on the invoice. It matches. She approves.

4. **She hits a red invoice.** Confidence: 62%. She sees the vendor name is wrong — the crop shows "M/s Sharma & Associates" but the extracted value says "Sharma Associate." She clicks the value, types the correction, presses Enter. The correction is saved. She checks the remaining fields using their source crops, corrects the date, and approves.

5. **Her corrections feed the learning store.** Next month, when another invoice from "M/s Sharma & Associates" arrives, the system will know the correct vendor name format. The red invoice becomes a yellow or green.

6. **The tenant admin exports.** At end of day, the admin selects all approved invoices, clicks "Export to Tally," and downloads the XML file with full GST breakdown. The invoices are marked EXPORTED and locked from further editing.

### 4.2 When Something Looks Wrong (Low-Confidence Review)

1. Reviewer opens a red-confidence invoice
2. The extracted fields table shows confidence per field — the total amount is flagged red
3. The source crop next to "Total Amount" shows a blurry handwritten number
4. The reviewer reads the crop, determines the correct value, types the correction
5. The system recalculates confidence with the manual override
6. The reviewer checks remaining fields using their crops, approves when satisfied
7. The correction is recorded: "For vendor X, GST invoice type, total amount needed manual correction"

### 4.3 Tenant Onboarding

1. Platform admin creates a new tenant (name, admin email, mode: test or live)
2. Admin receives temporary password, logs in, is forced to change it
3. **Minimum viable configuration to first export:**
   - Connect one Gmail inbox (OAuth flow in popup)
   - Assign the inbox to themselves or a team member
   - Click "Ingest" to process the first batch
   - Review extracted invoices, approve, export to Tally
4. Additional configuration (optional, not required for first value):
   - Invite team members
   - Configure approval workflow rules
   - Add more Gmail inboxes

### 4.4 Platform Operations

1. Platform admin logs in (email in allowlist)
2. Dashboard shows: total tenants, total documents processed, failure rate, token usage
3. Admin onboards new tenants, toggles tenant enabled/disabled
4. Admin monitors which tenants have Gmail connection issues (NEEDS_REAUTH)
5. Admin never sees invoice content — only operational metadata

---

## 5. Functional Requirements

### Differentiators (what makes customers choose BillForge)

| ID | Requirement | Why It Matters |
|----|-------------|---------------|
| D-1 | Source crop image alongside every extracted field | Eliminates search fatigue — the core UX differentiator |
| D-2 | Bounding box overlays on invoice pages per field | Visual proof of where data was extracted |
| D-3 | Extraction learning per tenant/vendor/type | Accuracy improves over time — retention moat |
| D-4 | Tally XML with India GST itemization | India-first go-to-market wedge |
| D-5 | Interface-driven architecture for all integrations | Adapter-based extensibility — new connectors without rewrites |

### Table Stakes (required to compete)

| ID | Requirement |
|----|-------------|
| TS-1 | OCR extraction from PDF and image invoices |
| TS-2 | Confidence scoring with visual indicators |
| TS-3 | Batch approval with confirmation |
| TS-4 | Role-based access control |
| TS-5 | Multi-tenant data isolation |
| TS-6 | Crash-safe ingestion with dedup |
| TS-7 | Audit trail (who approved what, when) |

### Operational Requirements

| ID | Requirement |
|----|-------------|
| O-1 | Gmail OAuth2 ingestion with configurable polling |
| O-2 | Manual file upload (max 50 files, 20MB each, PDF/JPG/PNG) |
| O-3 | Server-side pagination, sorting, and status filtering |
| O-4 | Keyboard shortcuts for power users (j/k navigate, space select, a approve, e export) |
| O-5 | Configurable approval workflows (simple + advanced) |
| O-6 | Exported invoices locked from editing (enforced in backend) |
| O-7 | Client-side validation for file size, count, date ranges |
| O-8 | Test vs live tenant mode with manual vs auto ingestion |

---

## 6. Non-Functional Requirements

| Requirement | Specification |
|-------------|---------------|
| Backend | Node.js 20, TypeScript 5.7, Express, Mongoose |
| Frontend | React 18, TypeScript, Vite 6 |
| Database | MongoDB 7; DocumentDB on AWS |
| ML services | Python 3.11, FastAPI, MLX (dev) |
| Storage | S3 / MinIO only — no local disk storage |
| Auth | Keycloak 26.0 (dev and prod) |
| Infrastructure | Terraform (modular), Docker Compose (local) |
| Currency | Integer minor units everywhere; formatting at boundaries |
| Startup | Backend blocks until OCR + SLM healthy |

Engineering-specific quality gates (100% branch coverage, Knip dead code analysis, CI pipeline details) are documented in the RFC, not in this PRD.

---

## 7. Success Metrics

### Primary Health Signal

**Invoices successfully exported per tenant per month** — this is the closest metric to delivered value. "Increasing or stable" is not sufficient as a target. Track by cohort: for tenants onboarded in month N, what does their export volume look like at 30, 60, 90 days? This is how you see whether the extraction learning moat is compounding value or whether you're retaining on inertia.

### Leading Indicators

| Metric | Target | Why | Validation Status |
|--------|--------|-----|-------------------|
| Time to verify one invoice (median) | < 45 seconds | Core value prop — search fatigue reduction | Hypothesis — needs timed observation with real AP clerks |
| Time to verify one invoice (P90) | < 3 minutes | Red-confidence invoices are where real pain is | Hypothesis — must include red-confidence invoice handling |
| Correction rate for returning vendors | Decreasing month-over-month per tenant | Extraction learning is working — the retention moat is forming | Needs production telemetry after learning loop activation |
| "Other" invoice type classification rate | < 15% of total invoices | Classification taxonomy is sufficient | Needs production telemetry |
| Time to first successful Tally export (new tenant) | < 30 minutes from onboarding | Onboarding is not blocking first value | Pair with "did tenant return on day 2" for activation signal |
| Correction rate on first 50 invoices | Baseline to establish | Measures initial extraction quality before learning kicks in | Critical for calibrating the learning loop timeline claims |

---

## 8. Open Questions & Validation Needed

| Question | Owner | Status |
|----------|-------|--------|
| Is 6 corrections per key enough signal to improve accuracy? | Engineering | Pipeline integrated — needs production telemetry to measure correction rate reduction |
| Does the 90-day TTL match vendor template change frequency? | Product + Customer | Needs customer interviews. Design a test with first adopter: introduce a vendor format change and measure what happens. |
| What % of real invoices fall into "other" type? | Engineering | Needs production telemetry |
| Active vs assistive learning: should corrections auto-apply or suggest? | Product | Implemented as active. Decision trigger for switching: if correction rate for returning vendors increases after learning activation. Consider starting assistive in first production deployment — show corrections in the UI as suggestions with a "learning applied" indicator so the reviewer sees the system's work. |
| Do AP teams need concurrent edit protection (optimistic locking)? | Product | Needed if multiple reviewers work on overlapping invoice sets |
| Anumati bank connection: is payment reconciliation in scope for adopter one? | Product | If not, document the bet explicitly. Infrastructure carries maintenance cost ahead of validated need. |
| Tenant mode transition (test → live): should this be a self-serve admin action or platform-gated? | Product | Currently no API exists for mode transition |
| GST line-item extraction: is header-level sufficient for input tax credit reconciliation? | Product + Customer | GST compliance may require per-line-item detail for ITC reconciliation. Validate with first adopter's CA before treating line-item extraction as safely out of scope. |
| Competitive alternatives: who are the named competitors and where do they fall short? | Product | "Competitors don't support Tally natively" needs specific names and specific gaps documented. Sales team needs this for real deal conversations. |
| Verification time claim: has it been validated with real users? | Product | The 45-second target is a hypothesis. Time real AP clerks on real invoices before using this number externally. |
| First adopter trigger: what made them choose BillForge over doing nothing? | Product | Understanding the trigger tells you who else is about to have the same problem. |
| Second adopter profile: does one exist? | Product | The advanced workflow builder and role extensibility are built for an assumed adopter two. Name the profile or acknowledge this is a bet. |

---

## 9. Out of Scope (Current Phase)

| Item | Reason | Watch For |
|------|--------|-----------|
| Line-item extraction | Field-level extraction sufficient for adopter one's workflow — **requires explicit validation**. GST compliance in India often requires line-item detail for input tax credit (ITC) reconciliation. If the first adopter's clients get audited, header-level GST totals may not be sufficient for their CA's records. Validate with the accounting firm before treating this as safely out of scope. | Customer requests, CA feedback, or a competitor offering line-item extraction in the Indian market |
| Full accounting reconciliation | Anumati infrastructure built but reconciliation not validated with customers | Whether bank connection data drives export decisions |
| Multi-currency conversion | Adopter one is India-only (INR) | International expansion requirements |
| Webhook event notifications | No downstream automation use case validated | Customers asking to trigger ERP workflows from BillForge events |
| Real-time collaborative editing | Single-reviewer-per-client model means low concurrency risk | Multiple reviewers editing same invoice simultaneously |
| Mobile application | Desktop-first workflow — AP teams work at desks | Usage patterns from analytics |

---

## 10. APIs / Data Contracts

### Backend API Routes

| Route Group | Path Prefix | Key Endpoints |
|-------------|-------------|---------------|
| Auth | `/api/auth` | Login, callback, logout, password change |
| Session | `/api/session` | Current user context + flags |
| Invoices | `/api/invoices` | List/filter/paginate, edit fields, approve, delete, retry, preview, crops, overlays |
| Jobs | `/api/jobs` | Ingest, upload, pause, SSE progress, status |
| Export | `/api/exports` | Tally export (direct + download), history |
| Approval Workflow | `/api/admin/approval-workflow` | CRUD config, step approve/reject |
| Gmail | `/api/connect/gmail`, `/api/integrations/gmail` | OAuth flow, status, polling config |
| Bank | `/api/bank/accounts`, `/api/bank/*-callback` | Account CRUD, consent webhooks |
| Tenant | `/api/tenant` | Onboarding, invite acceptance |
| Tenant Admin | `/api/admin` | Users, invites, roles, mailboxes, viewer scope |
| Platform Admin | `/api/platform` | Tenant onboarding, usage, enable/disable |
| Analytics | `/api/analytics` | Overview dashboard data |
| Health | `/health`, `/health/ready` | Liveness + readiness probes |

### ML Service APIs

| Service | Endpoint | Purpose |
|---------|----------|---------|
| OCR | `POST /v1/ocr/document` | Text + page images + bounding boxes |
| SLM | `POST /v1/verify/invoice` | Field extraction + type classification |

---

## 11. Dependencies

| Dependency | Purpose | Boundary |
|------------|---------|----------|
| MongoDB 7 / DocumentDB | Primary database | Direct (Mongoose ODM) |
| Keycloak 26.0 | Identity provider | `OidcProvider` interface |
| S3 / MinIO | Object storage | `FileStore` interface |
| invoice-ocr (FastAPI) | OCR extraction | `OcrProvider` interface |
| invoice-slm (FastAPI) | ML field extraction | `FieldVerifier` interface |
| Gmail API | Email ingestion | `IngestionSource` interface |
| Tally | Accounting export | `AccountingExporter` interface |
| SendGrid / SMTP | Invite emails | `InviteEmailSender` boundary |
| Anumati | Bank connection | `IBankConnectionService` interface |
