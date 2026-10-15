# Meterbox — Managed OpenMeter Cloud Platform

**Meterbox** is a full-stack multi-tenant usage metering, sub-5ms edge entitlement evaluation, Dead-Letter Queue (DLQ) replay, and hybrid subscription + usage billing control plane built on **OpenMeter**, **Redpanda**, **ClickHouse**, **PostgreSQL**, and **Redis**.

---

## System Architecture

```mermaid
flowchart LR
    Client["Customer App / SDK"] -->|"Bearer mb_ing_* / mb_ent_*"| Gateway["Go Edge Gateway (:8888)"]
    Console["Next.js Control Plane UI (:3000)"] -->|"X-OpenMeter-Namespace"| Gateway

    subgraph Edge["Edge Auth, Dedup & Quota Cache"]
        Gateway -->|"SHA-256 Key Lookup + RLS"| PG[("PostgreSQL 16\nTenants & Keys")]
        Gateway -->|"SETNX 48h Dedup &\nSub-5ms Balance Cache"| Redis[("Redis 7.4")]
    end

    subgraph Stream["Noisy-Neighbor Lane Router (Redpanda)"]
        Gateway -->|"Within Burst"| RT[["om_events_realtime"]]
        Gateway -->|"Burst Overflow / Backfill"| Bulk[["om_events_bulk"]]
        Gateway -->|"Schema / Type Mismatch"| DLQ[["om_events_dlq"]]
    end

    subgraph OLAP["Columnar Rollup Engine (ClickHouse 24.8)"]
        RT --> Raw[("om_events_raw\nORDER BY (namespace, type, subject, hour, id)")]
        Bulk --> Raw
        Raw -->|"Incremental MV"| Rollup[("om_meter_rollups_1m\nAggregatingMergeTree")]
    end

    Rollup -->|"Usage Rating + Priority Grants"| Billing["Hybrid Billing & Stripe Sync"]
    Gateway -.->|"Self-Metering"| Dogfood[("ns_meterbox_internal")]
```

---

## Core Capabilities

### 1. Multi-Tenancy & 1:1 Environment-to-Namespace Isolation
- Every **Organization** (`org_*`) provisions isolated **Production** (`ns_live_*`) and **Sandbox** (`ns_test_*`) environments mapped 1:1 to OpenMeter `namespace` boundaries.
- **PostgreSQL Row-Level Security (RLS)** enforces tenant isolation across control-plane metadata tables (`organizations`, `environments`, `api_keys`, `dlq_events`).
- **1-Click Sandbox Reset:** `POST /api/control/v1/environments/reset` wipes and re-seeds only the target sandbox namespace without affecting production telemetry.

### 2. Four-Tier Scoped API Keys (`SHA-256` Hashed)
| Key Prefix | Scope | Permitted Operations | Isolation Boundary |
| :--- | :--- | :--- | :--- |
| `mb_ing_live_*` / `mb_ing_test_*` | `ingest` | Write-only `POST /api/v1/events` (CloudEvents v1.0) | Organization + Environment |
| `mb_ent_live_*` / `mb_ent_test_*` | `entitlement` | Sub-5ms `GET /api/v1/subjects/{sub}/entitlements/{feat}/value` & Portal Tokens | Organization + Environment |
| `mb_sk_live_*` / `mb_sk_test_*` | `admin` | Full Control Plane, Meters, Plans, Grants, DLQ Replay, Invoices | Organization + Environment |
| `mb_portal_*` | `portal` | Read-only `GET /api/portal/v1/summary` | Organization + Environment + Subject |

### 3. Synchronous Edge Deduplication, Noisy-Neighbor Lanes & DLQ Replay
- **Exact-Once Idempotency:** Every incoming CloudEvent is checked against `SETNX dedup:{namespace}:{source}:{id}` in Redis before ingestion so network retries never double-count customer usage.
- **Token-Bucket Lane Routing:** Interactive traffic within a tenant's rate limit routes to `om_events_realtime`, while burst overflows or historical backfills (`X-Meterbox-Lane: bulk`) spill to `om_events_bulk` so noisy neighbors cannot delay other tenants.
- **Zero-Drop Dead-Letter Queue (DLQ):** Events with non-numeric meter properties or invalid payloads are captured in `om_events_dlq` where operators can inspect, edit the JSON payload in-place, and replay them into ClickHouse with one click.

### 4. ClickHouse Primary Key Pruning & Materialized Rollups
- Shared multi-tenant ClickHouse tables avoid ZooKeeper/ClickHouseKeeper metadata explosion by placing `namespace LowCardinality(String)` first in the primary sorting key:
  ```sql
  PARTITION BY toYYYYMM(time)
  ORDER BY (namespace, type, subject, toStartOfHour(time), id)
  ```
- Incremental `AggregatingMergeTree` materialized views (`om_meter_rollups_1m`) pre-aggregate `SUM`, `COUNT`, `AVG`, `MAX`, and `UNIQUE_COUNT` metrics across custom JSONPath dimensions (`$.model`, `$.region`, `$.gpu_class`).

### 5. Sub-5ms Entitlements, Priority Credit Grants & Hybrid Billing
- **Write-Through Edge Quota Cache:** Evaluates `has_access`, consumed usage, remaining quota, and soft-limit vs. hard-cap rules in microseconds, invalidating automatically when new events arrive for a subject.
- **Priority Prepaid Credit Waterfall:** Supports multiple credit grants per subject with explicit burn-down priority (`Priority 1` promotional credits burn before `Priority 2` monthly allowances) and rollover controls.
- **Hybrid Plans & Invoice Sheet Generator:** Combines base subscription fees with graduated, flat per-unit, or package usage tiers and syncs finalized invoices with Stripe.
- **Dogfood Self-Billing (`ns_meterbox_internal`):** Meterbox meters its own cloud tenants by emitting `meterbox.events.ingested` CloudEvents into the reserved `ns_meterbox_internal` namespace.

---

## Repository Structure

```text
Meterbox/
├── backend/
│   ├── cmd/meterbox/main.go             # Control Plane & OpenMeter Edge Gateway server (:8888)
│   └── internal/
│       ├── auth/apikey.go               # SHA-256 key generation, namespace resolution & scope middleware
│       ├── billing/engine.go            # Hybrid plan rating, graduated tiers & Stripe invoice generator
│       ├── clickhouse/client.go         # ClickHouse HTTP batch writer & rollup aggregation engine
│       ├── control/handlers.go          # REST API router, CORS & Control Plane / OpenMeter v1 handlers
│       ├── control/handlers_test.go     # End-to-end multi-tenant verification test suite
│       ├── entitlement/engine.go        # Sub-5ms quota evaluation & priority credit grant waterfall
│       ├── ingest/pipeline.go           # CloudEvents validator, SETNX dedup, lane router & DLQ replay
│       ├── models/types.go              # Core domain models & API schemas
│       └── store/store.go               # Multi-tenant store coordinating ClickHouse, Redpanda & Redis
├── frontend/
│   ├── src/app/
│   │   ├── layout.tsx                   # Next.js root layout & typography (Outfit, DM Sans, DM Mono)
│   │   ├── globals.css                  # Design system tokens, responsive layout, drawers & dark mode
│   │   └── page.tsx                     # Interactive Control Plane UI, OLAP Studio, Customer 360° & Docs
│   └── next.config.mjs                  # Next.js configuration
├── infra/
│   ├── clickhouse/init-db.sql           # Multi-tenant ClickHouse MergeTree & Materialized View DDL
│   └── postgres/init-db.sql             # Control Plane PostgreSQL schema with Row-Level Security (RLS)
├── docker-compose.yml                   # Postgres 16, Redis 7.4, ClickHouse 24.8 & Redpanda v24.2
└── Makefile                             # Developer workflow targets
```

---

## Quickstart

### 1. Run Automated Backend Test Suite
```bash
make test
```

### 2. Start Backing Infrastructure (Optional Docker Compose)
The Go server includes an automatic in-memory fallback for local development and connects to PostgreSQL, Redis, ClickHouse, and Redpanda automatically when the Docker stack is running:
```bash
make up
```

### 3. Start the Go Control Plane & Edge Gateway (`:8888`)
```bash
make dev-backend
```

### 4. Start the Next.js Control Plane Frontend (`:3000`)
```bash
make dev-frontend
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## REST API Quick Reference

### Ingest CloudEvents (`POST /api/v1/events`)
```bash
curl -s -X POST "http://localhost:8888/api/v1/events" \
  -H "Authorization: Bearer mb_ing_live_acme_default_collector_key_01" \
  -H "Content-Type: application/json" \
  -d '{
    "specversion": "1.0",
    "id": "evt_live_1001",
    "source": "https://gateway.acme-ai.dev/v1/chat",
    "type": "ai.llm.tokens",
    "subject": "cust_hyperion_labs",
    "data": {
      "tokens": 4200,
      "model": "claude-4-sonnet",
      "token_type": "output"
    }
  }'
```

### Query ClickHouse Meter Rollups (`GET /api/v1/meters/{slug}/query`)
```bash
curl -s "http://localhost:8888/api/v1/meters/llm_tokens_total/query" \
  -H "X-OpenMeter-Namespace: ns_live_acme"
```

### Evaluate Sub-5ms Customer Entitlement (`GET /api/v1/subjects/{subject}/entitlements/{feature}/value`)
```bash
curl -s "http://localhost:8888/api/v1/subjects/cust_hyperion_labs/entitlements/ai_token_allowance/value" \
  -H "X-OpenMeter-Namespace: ns_live_acme"
```

### Generate Hybrid Usage Invoice (`POST /api/v1/invoices/generate`)
```bash
curl -s -X POST "http://localhost:8888/api/v1/invoices/generate" \
  -H "Content-Type: application/json" \
  -H "X-OpenMeter-Namespace: ns_live_acme" \
  -d '{
    "subject_key": "cust_hyperion_labs",
    "plan_slug": "ai_scale_hybrid",
    "sync_to_stripe": true
  }'
```
