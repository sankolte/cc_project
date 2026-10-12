// monitor-server/worker.js
// Background worker: SQS Consumer, Anomaly Detection Engine & S3 Archiver

const queue = require('./queue');
const db = require('./db');
const s3 = require('./s3');

let isWorkerRunning = false;
let workerInterval = null;
let rawLogBuffer = [];
let lastArchiveTime = Date.now();

// SLA Thresholds
const LATENCY_THRESHOLD_MS = 1500;
const S3_ARCHIVE_INTERVAL_MS = 60 * 1000; // 1 minute
const S3_BATCH_SIZE_LIMIT = 50;

/**
 * Evaluates a telemetry record for SLA violations and anomaly events
 */
async function evaluateAnomalies(telemetry) {
  const incidentsDetected = [];

  // 1. High Latency SLA Violation Check
  if (telemetry.latency_ms && telemetry.latency_ms > LATENCY_THRESHOLD_MS) {
    const incident = await db.insertIncident({
      type: 'HIGH_LATENCY',
      severity: 'CRITICAL',
      endpoint: telemetry.endpoint,
      observed_value: `${telemetry.latency_ms} ms`,
      threshold_value: `${LATENCY_THRESHOLD_MS} ms`,
      status: 'OPEN'
    });
    incidentsDetected.push(incident);
  }

  // 2. Server 5xx Crash Check
  if (telemetry.status_code && telemetry.status_code >= 500) {
    const incident = await db.insertIncident({
      type: 'SERVER_ERROR',
      severity: 'CRITICAL',
      endpoint: telemetry.endpoint,
      observed_value: `HTTP ${telemetry.status_code}`,
      threshold_value: 'HTTP 2xx/3xx',
      status: 'OPEN'
    });
    incidentsDetected.push(incident);
  }

  return incidentsDetected;
}

/**
 * Process a single batch of messages from SQS
 */
async function processQueueBatch(maxMessages = 10) {
  const messages = await queue.receiveFromQueue(maxMessages);
  if (!messages || messages.length === 0) return { processed: 0, incidents: 0 };

  let processedCount = 0;
  let totalIncidents = 0;

  for (const msg of messages) {
    try {
      const telemetry = JSON.parse(msg.body);

      // 1. Store structured log in RDS / database
      await db.insertTelemetryLog(telemetry);

      // 2. Evaluate for Anomalies
      const detected = await evaluateAnomalies(telemetry);
      totalIncidents += detected.length;

      // 3. Buffer for S3 batch upload
      rawLogBuffer.push(telemetry);

      // 4. Delete message from SQS upon successful processing
      await queue.deleteFromQueue(msg.receiptHandle);
      processedCount++;
    } catch (err) {
      console.error(`[Worker] Error processing SQS message (${msg.messageId}): ${err.message}`);
    }
  }

  // Check if buffer should be archived to S3
  const timeSinceLastArchive = Date.now() - lastArchiveTime;
  if (rawLogBuffer.length >= S3_BATCH_SIZE_LIMIT || (rawLogBuffer.length > 0 && timeSinceLastArchive > S3_ARCHIVE_INTERVAL_MS)) {
    await flushS3Archive();
  }

  return { processed: processedCount, incidents: totalIncidents };
}

/**
 * Flush raw log buffer to Amazon S3
 */
async function flushS3Archive() {
  if (rawLogBuffer.length === 0) return;
  const batchToArchive = [...rawLogBuffer];
  rawLogBuffer = [];
  lastArchiveTime = Date.now();

  try {
    const result = await s3.archiveBatch(batchToArchive);
    return result;
  } catch (err) {
    console.error(`[Worker] S3 archival failed: ${err.message}`);
  }
}

/**
 * Start background polling loop
 */
function startWorker(pollIntervalMs = 500) {
  if (isWorkerRunning) return;
  isWorkerRunning = true;
  console.log('⚙️ [Worker] Anomaly detection worker started (polling SQS).');

  workerInterval = setInterval(async () => {
    try {
      await processQueueBatch(10);
    } catch (err) {
      console.error(`[Worker] Polling loop error: ${err.message}`);
    }
  }, pollIntervalMs);
}

/**
 * Stop background worker loop
 */
function stopWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
  isWorkerRunning = false;
  console.log('🛑 [Worker] Worker loop stopped.');
}

module.exports = {
  startWorker,
  stopWorker,
  processQueueBatch,
  flushS3Archive,
  evaluateAnomalies,
  getRawLogBufferSize: () => rawLogBuffer.length
};
