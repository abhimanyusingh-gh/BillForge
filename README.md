<div align="center">

# BillForge

**Ingest invoices from email. Extract data with OCR + ML. Review, approve, export.**

A multi-tenant invoice processing platform with pluggable OCR, staged ML extraction, configurable approval workflows, and Tally XML export — designed for finance teams managing high-volume invoice flows.

[![Node.js](https://img.shields.io/badge/Node.js-20-339933.svg?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB.svg?logo=python&logoColor=white)](https://www.python.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248.svg?logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## What It Does

BillForge connects to Gmail inboxes (or folder/S3 sources), runs invoices through a staged OCR → ML extraction → confidence scoring pipeline, and presents them in a review dashboard where teams can approve, edit, and export to accounting systems.

**Typical workflow:**

```
Gmail inbox  →  OCR extraction  →  Field parsing  →  Confidence scoring
     →  Human review  →  Approval workflow  →  Tally XML export
```

## Features

- **Multi-source ingestion** — Gmail (IMAP/OAuth2), local folders, S3 upload with crash-safe checkpointing and duplicate filtering
- **Staged extraction pipeline** — Vendor fingerprint → OCR → heuristic parsing → SLM verification → LLM vision re-extraction (cost-gated by confidence)
- **Extraction learning** — Records field corrections per vendor/invoice type, feeds prior learnings to future extractions
- **Configurable approval workflows** — Simple (checkboxes) or advanced (multi-step builder with role/user approvers, amount conditions, any/all rules)
- **Tally XML export** — Purchase voucher generation with India GST support (CGST/SGST/IGST/Cess), downloadable or direct POST
- **Multi-tenant SaaS** — Tenant onboarding, RBAC (admin/member/viewer), data isolation, per-tenant Gmail integration
- **Review dashboard** — Inline editing, confidence badges, source overlay inspection, batch approval, keyboard shortcuts
- **Financial burndown** — Real-time analytics with approval trends, vendor breakdown, pending value burndown chart
- **Gmail auto-polling** — Optional background polling per inbox (1/2/4/8h intervals) with tenant-wide messageId dedup

## Architecture

```
┌─ Ingestion ─────┐    ┌─ Extraction ──────────┐    ┌─ Approval ──┐    ┌─ Export ─┐
│ Gmail / Folder   │ →  │ OCR → Parser → SLM    │ →  │ Workflow    │ →  │ Tally    │
│ S3 Upload        │    │ → LLM Assist           │    │ Engine      │    │ XML      │
└──────────────────┘    │ → Learning Store       │    └─────────────┘    └──────────┘
                        └────────────────────────┘
┌─ API Layer ─────────────────────────────────────────────────────────────────────────┐
│ Express + Auth Middleware + RBAC (Keycloak OIDC)                                    │
└─────────────────────────────────────────────────────────────────────────────────────┘
┌─ Frontend ──────────────┐    ┌─ Data ───────────────────┐
│ React + Vite             │    │ MongoDB / S3 / Keycloak  │
│ Dashboard + Config       │    │ Tenant-isolated          │
└──────────────────────────┘    └──────────────────────────┘
```

Every external dependency (OCR, SLM, file storage, email transport) is defined as an interface with explicit provider selection. Swapping providers is a configuration change, not a code change.

> Full architecture diagram: [`docs/architecture.drawio`](docs/architecture.drawio)

## Quick Start

**Prerequisites:** Node.js 20+, Yarn 4+, Docker, Python 3.11+ (Apple Silicon for local MLX)

```bash
# Clone and install
git clone <repo-url> && cd billforge
yarn install

# Set up local ML services (optional — mock OCR works without this)
python3 -m venv .venv-ml
./.venv-ml/bin/pip install -r invoice-ocr/requirements.local.txt \
                           -r invoice-slm/requirements.local.txt

# Start everything
yarn docker:up
```

Open `http://localhost:5177` and log in as `tenant-admin-1@local.test` / `DemoPass!1`.

**What happens:** The stack starts MongoDB, Keycloak, MinIO, OCR, SLM, backend, and frontend with seeded demo tenants and sample invoices. Click "Ingest" to process invoices through the full pipeline.

### Services

| Service | URL |
|---------|-----|
| Dashboard | `http://localhost:5177` |
| Backend API | `http://localhost:4100` |
| Keycloak | `http://localhost:8280` |
| MinIO Console | `http://localhost:9101` |

## Example: End-to-End Flow

```bash
# 1. Trigger ingestion (processes sample invoices through OCR + ML)
curl -X POST http://localhost:4100/api/jobs/ingest \
  -H "Authorization: Bearer $TOKEN"

# 2. Approve parsed invoices
curl -X POST http://localhost:4100/api/invoices/approve \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"ids": ["<invoice-id>"]}'

# 3. Export to Tally XML (generates file + marks as EXPORTED)
curl -X POST http://localhost:4100/api/exports/tally/download \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"ids": ["<invoice-id>"]}'
```

Or use the dashboard — select invoices, click Approve, click Export.

## Extraction Pipeline

Each invoice passes through progressively more expensive stages, gated by confidence:

1. **Vendor Fingerprint** — Match known vendor patterns (free)
2. **Template Path** — Apply vendor-specific extraction templates (free)
3. **OCR + Heuristic Parsing** — Text extraction + rule-based field parsing (low cost)
4. **Deterministic Validation** — Date/amount consistency checks (free)
5. **SLM Verification** — ML field verification with invoice type classification (medium cost)
6. **LLM Vision Re-extraction** — Page image analysis when confidence < 85% (high cost)
7. **Learning Store** — Record corrections for future extractions (free)

## Configuration

BillForge uses a runtime manifest file for environment-specific wiring:

| Adapter | Options |
|---------|---------|
| OCR | `deepseek` / `mock` |
| Field Verifier | `http` / `none` |
| File Store | Local disk / S3 |
| Ingestion Sources | `email` / `folder` |
| Export | Tally endpoint + company + ledger names |

See `backend/runtime-manifest.local.json` for the full schema.

## Deployment

**Local development:** `yarn docker:up` — single command, includes demo data.

**AWS with Terraform:**

```bash
ENV=stg AWS_REGION=us-east-1 bash ./scripts/deploy-aws.sh
```

Terraform modules: EC2 Spot workers, DocumentDB, S3, ECS Fargate Keycloak, IAM/STS roles. See [AWS Deployment Guide](docs/AWS_DEPLOYMENT_GUIDE.md).

## Tech Stack

**Backend:** Node.js 20, TypeScript (strict), Express, Mongoose, Zod, Sharp, AWS SDK v3
**Frontend:** React 19, TypeScript (strict), Vite 6, Recharts
**ML Services:** Python 3.11, FastAPI, MLX (dev only), DeepSeek OCR
**Infrastructure:** Docker Compose, MongoDB 7, Keycloak, MinIO, Terraform, GitHub Actions

## Design Principles

- **Provider boundaries** — OCR, SLM, storage, email are interfaces. MLX imports isolated to `local_*.py` modules. Production images have zero MLX dependencies.
- **Integer minor units** — All currency stored as integers (cents). No floating-point math. Formatting at display/export boundaries only.
- **Crash-safe checkpointing** — Per-file ingestion markers. Workers resume from last checkpoint. Unique indexes prevent duplicates.
- **Tenant-first data model** — Every collection partitioned by `tenantId`. Platform admin sees aggregates only, never invoice-level data.
- **Runtime composition** — Same image serves local/stg/prod. Environment wiring via manifest files, not code branches.

## Testing

```bash
yarn test                            # All unit tests (300+ backend, 95 frontend)
yarn workspace billforge-backend coverage  # Coverage with threshold enforcement
yarn run knip                        # Dead code analysis
yarn e2e:local                       # Backend E2E (requires running stack)
```

100% branch coverage enforced on tracked modules. CI runs typecheck → test → knip → Docker build → Trivy scan.

## Contributing

1. Read [`docs/RFC.md`](docs/RFC.md) for architecture decisions
2. Follow provider boundaries — ML imports stay in `local_*.py`
3. Add tests — unit for services, E2E for workflows
4. Run `yarn run quality:check` before committing
5. Use integer minor units for all amounts

## Documentation

- [Architecture Decisions (RFC)](docs/RFC.md)
- [AWS Deployment Guide](docs/AWS_DEPLOYMENT_GUIDE.md)
- [Local OCR Setup](docs/LOCAL_DEEPSEEK_OCR_SETUP.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## License

[MIT](LICENSE)

---

<div align="center">

[Documentation](docs/) · [Report an Issue](../../issues)

</div>
