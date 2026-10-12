-- ==========================================================
-- Database Schema for Cloud-Based Anomaly Detection Platform
-- Compatible with PostgreSQL / Amazon RDS PostgreSQL
-- ==========================================================

-- 1. Table: telemetry_logs
-- Stores raw structured HTTP telemetry dispatched by target applications
CREATE TABLE IF NOT EXISTS telemetry_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INT NOT NULL,
    latency_ms INT NOT NULL
);

-- Indexing for rapid queries by time and route
CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_endpoint ON telemetry_logs (endpoint);

-- 2. Table: metrics
-- Stores aggregated operational snapshots (e.g. 1-minute rollups)
CREATE TABLE IF NOT EXISTS metrics (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    request_count INT DEFAULT 0,
    avg_latency INT DEFAULT 0,
    error_rate NUMERIC(5,2) DEFAULT 0.00
);

CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics (timestamp DESC);

-- 3. Table: incidents
-- Stores detected anomaly events (SLA latency breaches, 5xx server spikes)
CREATE TABLE IF NOT EXISTS incidents (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    type VARCHAR(50) NOT NULL,            -- 'HIGH_LATENCY', 'SERVER_ERROR', 'TRAFFIC_SURGE'
    severity VARCHAR(20) NOT NULL,        -- 'WARNING', 'CRITICAL'
    endpoint VARCHAR(255) NOT NULL,
    observed_value VARCHAR(100) NOT NULL, -- e.g. '2450 ms'
    threshold_value VARCHAR(100) NOT NULL,-- e.g. '1500 ms'
    status VARCHAR(20) DEFAULT 'OPEN'     -- 'OPEN', 'RESOLVED'
);

CREATE INDEX IF NOT EXISTS idx_incidents_timestamp ON incidents (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents (status);
