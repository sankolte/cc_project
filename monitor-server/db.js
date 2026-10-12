// monitor-server/db.js
// Database connector supporting Amazon RDS (PostgreSQL) with seamless in-memory fallback

const { Pool } = require('pg');

let pool = null;
let isConnectedToPostgres = false;

// In-Memory Storage Fallback (used when PostgreSQL / RDS is not available locally)
const inMemoryStore = {
  telemetryLogs: [],
  incidents: [],
  metrics: []
};

function initDb() {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '5432', 10);
  const database = process.env.DB_NAME || 'anomaly_detection';
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || 'postgres';
  const ssl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;

  try {
    pool = new Pool({
      host,
      port,
      database,
      user,
      password,
      ssl,
      connectionTimeoutMillis: 2000
    });

    pool.on('error', (err) => {
      console.warn(`[DB] PostgreSQL pool error: ${err.message}. Operating in fallback mode.`);
      isConnectedToPostgres = false;
    });
  } catch (err) {
    console.warn(`[DB] Could not initialize PostgreSQL pool: ${err.message}. Using fallback.`);
    pool = null;
  }
}

/**
 * Initializes database tables (if connected to PostgreSQL/RDS)
 */
async function setupSchema() {
  if (!pool) return;

  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS telemetry_logs (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          endpoint VARCHAR(255) NOT NULL,
          method VARCHAR(10) NOT NULL,
          status_code INT NOT NULL,
          latency_ms INT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS metrics (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          request_count INT DEFAULT 0,
          avg_latency INT DEFAULT 0,
          error_rate NUMERIC(5,2) DEFAULT 0.00
        );
        CREATE TABLE IF NOT EXISTS incidents (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          type VARCHAR(50) NOT NULL,
          severity VARCHAR(20) NOT NULL,
          endpoint VARCHAR(255) NOT NULL,
          observed_value VARCHAR(100) NOT NULL,
          threshold_value VARCHAR(100) NOT NULL,
          status VARCHAR(20) DEFAULT 'OPEN'
        );
      `);
      isConnectedToPostgres = true;
      console.log('✅ [DB] Successfully connected to PostgreSQL / Amazon RDS and initialized schema.');
    } finally {
      client.release();
    }
  } catch (err) {
    console.log(`ℹ️ [DB] RDS/PostgreSQL not reachable (${err.message}). Using fast in-memory store for local operations.`);
    isConnectedToPostgres = false;
  }
}

/**
 * Insert telemetry log
 */
async function insertTelemetryLog(log) {
  const item = {
    id: inMemoryStore.telemetryLogs.length + 1,
    timestamp: log.timestamp || new Date().toISOString(),
    endpoint: log.endpoint,
    method: log.method,
    status_code: log.status_code,
    latency_ms: log.latency_ms
  };

  inMemoryStore.telemetryLogs.push(item);

  if (isConnectedToPostgres && pool) {
    try {
      await pool.query(
        'INSERT INTO telemetry_logs (timestamp, endpoint, method, status_code, latency_ms) VALUES ($1, $2, $3, $4, $5)',
        [item.timestamp, item.endpoint, item.method, item.status_code, item.latency_ms]
      );
    } catch (err) {
      console.warn(`[DB] Failed to insert log to PostgreSQL: ${err.message}`);
    }
  }

  return item;
}

/**
 * Insert detected incident
 */
async function insertIncident(incident) {
  const item = {
    id: inMemoryStore.incidents.length + 1,
    timestamp: incident.timestamp || new Date().toISOString(),
    type: incident.type,
    severity: incident.severity || 'CRITICAL',
    endpoint: incident.endpoint,
    observed_value: incident.observed_value,
    threshold_value: incident.threshold_value,
    status: incident.status || 'OPEN'
  };

  inMemoryStore.incidents.unshift(item); // newer first

  if (isConnectedToPostgres && pool) {
    try {
      await pool.query(
        'INSERT INTO incidents (timestamp, type, severity, endpoint, observed_value, threshold_value, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [item.timestamp, item.type, item.severity, item.endpoint, item.observed_value, item.threshold_value, item.status]
      );
    } catch (err) {
      console.warn(`[DB] Failed to insert incident to PostgreSQL: ${err.message}`);
    }
  }

  return item;
}

/**
 * Fetch recent telemetry logs
 */
async function getRecentTelemetryLogs(limit = 50) {
  if (isConnectedToPostgres && pool) {
    try {
      const res = await pool.query('SELECT * FROM telemetry_logs ORDER BY timestamp DESC LIMIT $1', [limit]);
      return res.rows;
    } catch (err) {
      console.warn(`[DB] Falling back to in-memory logs: ${err.message}`);
    }
  }
  return inMemoryStore.telemetryLogs.slice(-limit).reverse();
}

/**
 * Fetch recent incidents
 */
async function getRecentIncidents(limit = 20) {
  if (isConnectedToPostgres && pool) {
    try {
      const res = await pool.query('SELECT * FROM incidents ORDER BY timestamp DESC LIMIT $1', [limit]);
      return res.rows;
    } catch (err) {
      console.warn(`[DB] Falling back to in-memory incidents: ${err.message}`);
    }
  }
  return inMemoryStore.incidents.slice(0, limit);
}

/**
 * Compute real-time aggregated metrics for dashboard
 */
async function getMetricsSummary() {
  const logs = inMemoryStore.telemetryLogs;
  const incidents = inMemoryStore.incidents;

  const totalRequests = logs.length;
  if (totalRequests === 0) {
    return {
      status: 'HEALTHY',
      totalRequests: 0,
      avgLatency: 0,
      errorRate: 0,
      serverErrors: 0,
      activeIncidents: 0
    };
  }

  const recentWindow = logs.slice(-100);
  const totalLatency = recentWindow.reduce((acc, l) => acc + (l.latency_ms || 0), 0);
  const avgLatency = Math.round(totalLatency / recentWindow.length);

  const serverErrors = recentWindow.filter(l => l.status_code >= 500).length;
  const errorRate = Number(((serverErrors / recentWindow.length) * 100).toFixed(1));

  const activeIncidents = incidents.filter(i => i.status === 'OPEN').length;
  const systemStatus = activeIncidents > 0 || errorRate > 10 || avgLatency > 1500 ? 'CRITICAL' : 'HEALTHY';

  return {
    status: systemStatus,
    totalRequests,
    avgLatency,
    errorRate,
    serverErrors,
    activeIncidents
  };
}

module.exports = {
  initDb,
  setupSchema,
  insertTelemetryLog,
  insertIncident,
  getRecentTelemetryLogs,
  getRecentIncidents,
  getMetricsSummary,
  _inMemoryStore: inMemoryStore
};
