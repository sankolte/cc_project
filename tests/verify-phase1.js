// tests/verify-phase1.js
// Automated Verification Script for Phase 1 (Target App & Telemetry Middleware)

const http = require('http');

console.log('====================================================');
console.log('🧪 VERIFYING PHASE 1: TARGET APP & TELEMETRY MIDDLEWARE');
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

// Global buffer to collect telemetry received at mock monitoring server
const receivedTelemetry = [];

// 1. Create Mock Monitoring Server
const mockMonitorServer = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/telemetry') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        receivedTelemetry.push(parsed);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, queued: true }));
      } catch (err) {
        res.writeHead(400);
        res.end();
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

const MOCK_MONITOR_PORT = 5999;
const TARGET_PORT = 3999;

// Set env for target app
process.env.TARGET_PORT = TARGET_PORT;
process.env.MONITOR_INGESTION_URL = `http://localhost:${MOCK_MONITOR_PORT}/api/telemetry`;

const targetApp = require('../target-app/server');

async function runTests() {
  let targetServer;

  try {
    // Start Mock Ingestion Server
    await new Promise(resolve => mockMonitorServer.listen(MOCK_MONITOR_PORT, resolve));
    console.log(`📡 Mock Ingestion Server listening on port ${MOCK_MONITOR_PORT}`);

    // Start Target App
    targetServer = await new Promise(resolve => {
      const s = targetApp.listen(TARGET_PORT, () => resolve(s));
    });
    console.log(`🛍️ Target App listening on port ${TARGET_PORT}\n`);

    // Helper for HTTP requests
    const fetchTarget = (path, options = {}) => {
      return fetch(`http://localhost:${TARGET_PORT}${path}`, options);
    };

    // Test 1: Target App Health Endpoint
    const resHealth = await fetchTarget('/health');
    const dataHealth = await resHealth.json();
    assert(resHealth.status === 200, 'Health endpoint returns HTTP 200');
    assert(dataHealth.status === 'healthy', 'Health payload status is "healthy"');

    // Wait 100ms for async telemetry flush
    await new Promise(r => setTimeout(r, 100));

    // Test 2: Catalog Products Route & Telemetry Dispatch
    const resProducts = await fetchTarget('/api/products');
    const dataProducts = await resProducts.json();
    assert(resProducts.status === 200, 'GET /api/products returns HTTP 200');
    assert(dataProducts.data && dataProducts.data.length > 0, 'Catalog returns product items');

    await new Promise(r => setTimeout(r, 150));
    const productsTelemetry = receivedTelemetry.find(t => t.endpoint === '/api/products');
    assert(!!productsTelemetry, 'Telemetry received for /api/products');
    assert(productsTelemetry?.method === 'GET', 'Telemetry method correctly captured as GET');
    assert(productsTelemetry?.status_code === 200, 'Telemetry status_code correctly captured as 200');
    assert(typeof productsTelemetry?.latency_ms === 'number', 'Telemetry includes numeric latency_ms');

    // Test 3: Delayed Route (Payment Route Latency Measurement)
    const resPayment = await fetchTarget('/api/payment?delay=150', { method: 'POST' });
    assert(resPayment.status === 200, 'POST /api/payment returns HTTP 200');

    await new Promise(r => setTimeout(r, 150));
    const paymentTelemetry = receivedTelemetry.find(t => t.endpoint === '/api/payment');
    assert(!!paymentTelemetry, 'Telemetry received for /api/payment');
    assert(paymentTelemetry?.latency_ms >= 140, `Telemetry measured realistic latency (${paymentTelemetry?.latency_ms}ms >= 140ms)`);

    // Test 4: Fault Injection (HTTP 500 error capture)
    const resError = await fetchTarget('/api/error');
    assert(resError.status === 500, 'GET /api/error returns HTTP 500');

    await new Promise(r => setTimeout(r, 150));
    const errorTelemetry = receivedTelemetry.find(t => t.endpoint === '/api/error');
    assert(!!errorTelemetry, 'Telemetry received for /api/error');
    assert(errorTelemetry?.status_code === 500, 'Telemetry correctly logged HTTP 500 status code');

    // Test 5: Fallback Resilience (Monitoring Server down should not break target app)
    await new Promise(resolve => mockMonitorServer.close(resolve));
    console.log(`🔌 Mock Monitoring Server stopped (simulating monitoring downtime)`);

    const resFallback = await fetchTarget('/api/products');
    assert(resFallback.status === 200, 'Target app continues functioning normally when monitoring server is offline');

  } catch (err) {
    console.error('Unhandled test error:', err);
    assert(false, `Unexpected error occurred: ${err.message}`);
  } finally {
    if (targetServer) {
      await new Promise(resolve => targetServer.close(resolve));
    }
  }

  console.log('\n----------------------------------------------------');
  console.log(`📊 RESULTS: ${passedTests}/${totalTests} Tests Passed`);
  console.log('----------------------------------------------------');

  if (passedTests === totalTests) {
    console.log('🎉 Phase 1 verification complete and successful!\n');
    process.exit(0);
  } else {
    console.error('⚠️ Phase 1 has failing checks.\n');
    process.exit(1);
  }
}

runTests();
