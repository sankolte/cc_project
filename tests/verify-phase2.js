// tests/verify-phase2.js
// Automated Verification Script for Phase 2 (Ingestion, SQS, RDS/Storage & Anomaly Detection)

const http = require('http');
const path = require('path');
const fs = require('fs');

console.log('====================================================');
console.log('🧪 VERIFYING PHASE 2: INGESTION, SQS, STORAGE & ANOMALY ENGINE');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${testName}`);
  }
}

process.env.USE_MOCK_AWS = 'true';
process.env.MONITOR_PORT = '5998';

const { app, initialize, worker, db, s3 } = require('../monitor-server/server');

async function runTests() {
  let serverInstance;

  try {
    // 1. Initialize DB, Queue, S3, Worker
    await initialize();

    // 2. Start Test Monitoring Server
    serverInstance = await new Promise(resolve => {
      const s = app.listen(5998, () => resolve(s));
    });
    console.log('📡 Test Monitor Server listening on port 5998\n');

    const fetchApi = (endpoint, options = {}) => {
      return fetch(`http://localhost:5998${endpoint}`, options);
    };

    // Test 1: Ingestion API Endpoint Validation
    const resBad = await fetchApi('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: '/bad' }) // Missing method, latency, status_code
    });
    assert(resBad.status === 400, 'Ingestion rejects invalid telemetry with HTTP 400');

    // Test 2: Ingestion Accepts Valid Normal Telemetry (Decoupled SQS queuing)
    const normalPayload = {
      endpoint: '/api/products',
      method: 'GET',
      status_code: 200,
      latency_ms: 35
    };
    const resNormal = await fetchApi('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalPayload)
    });
    const dataNormal = await resNormal.json();
    assert(resNormal.status === 202, 'Ingestion accepts telemetry with HTTP 202 Accepted');
    assert(dataNormal.queued === true, 'Response confirms telemetry is decoupled & queued');

    // Wait for worker polling interval to consume from queue
    await new Promise(r => setTimeout(r, 800));

    // Test 3: Verify Telemetry processed and stored in Database
    const resLogs = await fetchApi('/api/logs');
    const dataLogs = await resLogs.json();
    assert(dataLogs.count >= 1, 'Worker pulled message from SQS and stored into database');
    const savedLog = dataLogs.data.find(l => l.endpoint === '/api/products');
    assert(savedLog && savedLog.latency_ms === 35, 'Stored log contains matching latency and endpoint');

    // Test 4: Dashboard stats stay HEALTHY under normal traffic
    const resStatsHealthy = await fetchApi('/api/stats');
    const dataStatsHealthy = await resStatsHealthy.json();
    assert(dataStatsHealthy.data.status === 'HEALTHY', 'Metrics status is HEALTHY under normal load');
    assert(dataStatsHealthy.data.activeIncidents === 0, 'No active incidents under normal conditions');

    // Test 5: High Latency Telemetry -> Triggers HIGH_LATENCY Anomaly
    const slowPayload = {
      endpoint: '/api/payment',
      method: 'POST',
      status_code: 200,
      latency_ms: 2450 // > 1500 ms SLA threshold
    };
    await fetchApi('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slowPayload)
    });

    // Wait for worker processing
    await new Promise(r => setTimeout(r, 800));

    const resIncidents = await fetchApi('/api/incidents');
    const dataIncidents = await resIncidents.json();
    const latencyIncident = dataIncidents.data.find(i => i.type === 'HIGH_LATENCY');
    assert(!!latencyIncident, 'Anomaly Engine flagged HIGH_LATENCY SLA breach incident');
    assert(latencyIncident?.endpoint === '/api/payment', 'Incident accurately records affected endpoint (/api/payment)');
    assert(latencyIncident?.severity === 'CRITICAL', 'Incident assigned CRITICAL severity');

    // Test 6: Server 5xx Error Telemetry -> Triggers SERVER_ERROR Anomaly
    const errorPayload = {
      endpoint: '/api/error',
      method: 'GET',
      status_code: 500,
      latency_ms: 40
    };
    await fetchApi('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errorPayload)
    });

    await new Promise(r => setTimeout(r, 800));

    const resIncidents2 = await fetchApi('/api/incidents');
    const dataIncidents2 = await resIncidents2.json();
    const errorIncident = dataIncidents2.data.find(i => i.type === 'SERVER_ERROR');
    assert(!!errorIncident, 'Anomaly Engine flagged SERVER_ERROR crash incident');
    assert(errorIncident?.observed_value === 'HTTP 500', 'Incident details observed HTTP 500 status');

    // Test 7: Verify Dashboard status transitions to CRITICAL after incidents
    const resStatsCritical = await fetchApi('/api/stats');
    const dataStatsCritical = await resStatsCritical.json();
    assert(dataStatsCritical.data.status === 'CRITICAL', 'Dashboard status transitioned to CRITICAL after anomalies');
    assert(dataStatsCritical.data.activeIncidents >= 2, 'Active incidents count correctly updated');

    // Test 8: S3 Batch Archival
    const resArchive = await fetchApi('/api/flush-archive', { method: 'POST' });
    const dataArchive = await resArchive.json();
    assert(dataArchive.success === true, 'S3 archival triggered successfully');
    assert(dataArchive.result && dataArchive.result.count > 0, 'S3 archival saved telemetry batch');

  } catch (err) {
    console.error('Unhandled test error:', err);
    assert(false, `Unexpected error occurred: ${err.message}`);
  } finally {
    worker.stopWorker();
    if (serverInstance) {
      await new Promise(resolve => serverInstance.close(resolve));
    }
  }

  console.log('\n----------------------------------------------------');
  console.log(`📊 RESULTS: ${passedTests}/${totalTests} Tests Passed`);
  console.log('----------------------------------------------------');

  if (passedTests === totalTests) {
    console.log('🎉 Phase 2 verification complete and successful!\n');
    process.exit(0);
  } else {
    console.error('⚠️ Phase 2 has failing checks.\n');
    process.exit(1);
  }
}

runTests();
