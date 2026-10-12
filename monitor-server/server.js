// monitor-server/server.js
// Central Ingestion API, Dashboard Service & Background Processing Engine

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./db');
const queue = require('./queue');
const s3 = require('./s3');
const worker = require('./worker');

const app = express();
const PORT = process.env.MONITOR_PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve Static Frontend Dashboard
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------
// 1. INGESTION ENDPOINT (Decoupled via Amazon SQS)
// -------------------------------------------------------------
app.post('/api/telemetry', async (req, res) => {
  const { endpoint, method, status_code, latency_ms, timestamp } = req.body || {};

  // Basic validation
  if (!endpoint || !method || status_code === undefined || latency_ms === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Invalid telemetry payload: endpoint, method, status_code, and latency_ms are required'
    });
  }

  const payload = {
    timestamp: timestamp || new Date().toISOString(),
    endpoint,
    method,
    status_code: parseInt(status_code, 10),
    latency_ms: parseInt(latency_ms, 10)
  };

  try {
    // 📬 Decoupled: Immediately dispatch to SQS queue without blocking on DB or S3
    const queueResult = await queue.sendToQueue(payload);
    res.status(202).json({
      success: true,
      queued: true,
      messageId: queueResult.messageId
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 2. DASHBOARD & DATA QUERY APIS
// -------------------------------------------------------------

// System Health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'monitoring-platform',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Live Aggregated Metrics (for real-time dashboard cards & charts)
app.get('/api/stats', async (req, res) => {
  try {
    const summary = await db.getMetricsSummary();
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Recent Anomaly Incidents
app.get('/api/incidents', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || 20, 10);
    const incidents = await db.getRecentIncidents(limit);
    res.json({ success: true, count: incidents.length, data: incidents });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Recent Request Telemetry Logs
app.get('/api/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || 50, 10);
    const logs = await db.getRecentTelemetryLogs(limit);
    res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Trigger S3 Archival manually (useful during live demos & testing)
app.post('/api/flush-archive', async (req, res) => {
  try {
    const result = await worker.flushS3Archive();
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// INITIALIZATION
// -------------------------------------------------------------
async function initialize() {
  db.initDb();
  await db.setupSchema();
  queue.initQueue();
  s3.initS3();
  worker.startWorker(500);
}

if (require.main === module) {
  initialize().then(() => {
    app.listen(PORT, () => {
      console.log(`☁️ Monitoring Platform Server running at http://localhost:${PORT}`);
      console.log(`📊 Live Dashboard accessible at: http://localhost:${PORT}`);
    });
  });
}

module.exports = {
  app,
  initialize,
  db,
  queue,
  s3,
  worker
};
