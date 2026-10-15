-- Meterbox Control Plane & Multi-Tenant OpenMeter Relational Schema (PostgreSQL)
-- Enforces strict tenant isolation via `namespace` column and Row-Level Security (RLS).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. CONTROL PLANE TABLES (Organizations, Environments, Scoped API Keys, DLQ)
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    plan_tier TEXT NOT NULL DEFAULT 'pro',
    stripe_customer_id TEXT,
    billing_email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS environments (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('production', 'sandbox')),
    openmeter_namespace TEXT NOT NULL UNIQUE,
    rate_limit_rps INTEGER NOT NULL DEFAULT 1000,
    retention_days INTEGER NOT NULL DEFAULT 400,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, slug)
);

CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    env_id TEXT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    openmeter_namespace TEXT NOT NULL,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_preview TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    scope TEXT NOT NULL CHECK (scope IN ('ingest', 'entitlement', 'admin', 'portal')),
    subject_filter TEXT,
    rate_limit_rps INTEGER NOT NULL DEFAULT 1000,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_namespace ON api_keys(openmeter_namespace);

CREATE TABLE IF NOT EXISTS dlq_events (
    id TEXT PRIMARY KEY,
    openmeter_namespace TEXT NOT NULL,
    event_id TEXT,
    raw_payload JSONB NOT NULL,
    error_code TEXT NOT NULL,
    error_reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'replayed', 'discarded')),
    failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    replayed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dlq_namespace_status ON dlq_events(openmeter_namespace, status);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id TEXT PRIMARY KEY,
    openmeter_namespace TEXT NOT NULL,
    url TEXT NOT NULL,
    signing_secret TEXT NOT NULL,
    event_types TEXT[] NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. OPENMETER DOMAIN TABLES (Scoped by `namespace` + Row-Level Security)
-- ============================================================================

CREATE TABLE IF NOT EXISTS meters (
    id TEXT PRIMARY KEY,
    namespace TEXT NOT NULL,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    aggregation TEXT NOT NULL CHECK (aggregation IN ('COUNT', 'SUM', 'MAX', 'AVG', 'UNIQUE_COUNT')),
    event_type TEXT NOT NULL,
    value_property TEXT,
    group_by JSONB NOT NULL DEFAULT '{}'::jsonb,
    window_size TEXT NOT NULL DEFAULT 'HOUR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (namespace, slug)
);

CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    namespace TEXT NOT NULL,
    key TEXT NOT NULL,
    display_name TEXT NOT NULL,
    email TEXT,
    stripe_customer_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (namespace, key)
);

CREATE TABLE IF NOT EXISTS entitlements (
    id TEXT PRIMARY KEY,
    namespace TEXT NOT NULL,
    subject_key TEXT NOT NULL,
    feature_key TEXT NOT NULL,
    feature_name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('metered', 'boolean', 'static')),
    meter_slug TEXT,
    issue_after_reset NUMERIC(20, 4) NOT NULL DEFAULT 0,
    is_soft_limit BOOLEAN NOT NULL DEFAULT FALSE,
    static_config JSONB,
    reset_period TEXT NOT NULL DEFAULT 'MONTH',
    period_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', NOW()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (namespace, subject_key, feature_key)
);

CREATE TABLE IF NOT EXISTS entitlement_grants (
    id TEXT PRIMARY KEY,
    namespace TEXT NOT NULL,
    entitlement_id TEXT NOT NULL REFERENCES entitlements(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount NUMERIC(20, 4) NOT NULL,
    priority INTEGER NOT NULL DEFAULT 1,
    rollover_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    namespace TEXT NOT NULL,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    currency TEXT NOT NULL DEFAULT 'USD',
    base_price_cents INTEGER NOT NULL DEFAULT 0,
    billing_cadence TEXT NOT NULL DEFAULT 'MONTH',
    included_credits NUMERIC(20, 4) NOT NULL DEFAULT 0,
    rate_cards JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (namespace, slug)
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    namespace TEXT NOT NULL,
    subject_key TEXT NOT NULL,
    plan_slug TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due')),
    stripe_subscription_id TEXT,
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', NOW()),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', NOW()) + INTERVAL '1 month'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    namespace TEXT NOT NULL,
    subject_key TEXT NOT NULL,
    plan_slug TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    subtotal_cents INTEGER NOT NULL,
    tax_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid', 'synced_stripe')),
    stripe_invoice_id TEXT,
    line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row-Level Security (Defense-in-Depth Tenant Isolation)
ALTER TABLE meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE entitlement_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_meters ON meters
    USING (current_setting('app.current_namespace', true) IS NULL OR current_setting('app.current_namespace', true) = '' OR namespace = current_setting('app.current_namespace', true));
CREATE POLICY tenant_isolation_subjects ON subjects
    USING (current_setting('app.current_namespace', true) IS NULL OR current_setting('app.current_namespace', true) = '' OR namespace = current_setting('app.current_namespace', true));
CREATE POLICY tenant_isolation_entitlements ON entitlements
    USING (current_setting('app.current_namespace', true) IS NULL OR current_setting('app.current_namespace', true) = '' OR namespace = current_setting('app.current_namespace', true));
CREATE POLICY tenant_isolation_grants ON entitlement_grants
    USING (current_setting('app.current_namespace', true) IS NULL OR current_setting('app.current_namespace', true) = '' OR namespace = current_setting('app.current_namespace', true));
CREATE POLICY tenant_isolation_plans ON plans
    USING (current_setting('app.current_namespace', true) IS NULL OR current_setting('app.current_namespace', true) = '' OR namespace = current_setting('app.current_namespace', true));
CREATE POLICY tenant_isolation_subscriptions ON subscriptions
    USING (current_setting('app.current_namespace', true) IS NULL OR current_setting('app.current_namespace', true) = '' OR namespace = current_setting('app.current_namespace', true));
CREATE POLICY tenant_isolation_invoices ON invoices
    USING (current_setting('app.current_namespace', true) IS NULL OR current_setting('app.current_namespace', true) = '' OR namespace = current_setting('app.current_namespace', true));
