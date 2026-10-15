-- Meterbox Multi-Tenant ClickHouse Analytical Schema
-- Key Architectural Decision:
--   1. PARTITION BY toYYYYMM(time) prevents "Too many parts" errors across thousands of tenants.
--   2. ORDER BY (namespace, type, subject, toStartOfHour(time), id) places `namespace` first in the sparse
--      primary index so queries for a single tenant skip 99.9%+ of granules with zero cross-tenant scan overhead.

CREATE DATABASE IF NOT EXISTS openmeter;

CREATE TABLE IF NOT EXISTS openmeter.om_events
(
    namespace LowCardinality(String),
    id String,
    type LowCardinality(String),
    source String,
    subject String,
    time DateTime64(3, 'UTC'),
    data String,
    ingested_at DateTime64(3, 'UTC'),
    stored_at DateTime64(3, 'UTC'),
    lane LowCardinality(String) DEFAULT 'realtime'
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(time)
ORDER BY (namespace, type, subject, toStartOfHour(time), id)
TTL toDateTime(time) + INTERVAL 400 DAY DELETE
SETTINGS index_granularity = 8192;

-- Pre-aggregated hourly rollup table for fast dashboard & invoice queries
CREATE TABLE IF NOT EXISTS openmeter.om_events_hourly
(
    namespace LowCardinality(String),
    type LowCardinality(String),
    subject String,
    window_start DateTime('UTC'),
    event_count SimpleAggregateFunction(sum, UInt64)
)
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(window_start)
ORDER BY (namespace, type, subject, window_start);

CREATE MATERIALIZED VIEW IF NOT EXISTS openmeter.om_events_hourly_mv
TO openmeter.om_events_hourly
AS SELECT
    namespace,
    type,
    subject,
    toStartOfHour(time) AS window_start,
    count() AS event_count
FROM openmeter.om_events
GROUP BY namespace, type, subject, window_start;
