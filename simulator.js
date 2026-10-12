// simulator.js
// Chaos & Traffic Generator for Anomaly Detection Demonstrations

const TARGET_HOST = process.env.TARGET_HOST || 'http://localhost:3000';

async function sendRequest(url, options = {}) {
  const startTime = Date.now();
  try {
    const res = await fetch(url, options);
    const duration = Date.now() - startTime;
    return { ok: res.ok, status: res.status, duration };
  } catch (err) {
    return { ok: false, error: err.message, duration: Date.now() - startTime };
  }
}

/**
 * Normal Traffic: Fast catalog & checkout browsing
 */
async function simulateNormal(count = 5) {
  console.log(`\n🟢 [SIMULATOR] Generating ${count} NORMAL user requests to ${TARGET_HOST}...`);
  for (let i = 1; i <= count; i++) {
    const r1 = await sendRequest(`${TARGET_HOST}/api/products`);
    console.log(`  [${i}/${count}] GET /api/products -> HTTP ${r1.status} (${r1.duration}ms)`);
    
    const r2 = await sendRequest(`${TARGET_HOST}/api/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: (i % 4) + 1, quantity: 1 })
    });
    console.log(`  [${i}/${count}] POST /api/order -> HTTP ${r2.status} (${r2.duration}ms)`);
    await new Promise(r => setTimeout(r, 200));
  }
  console.log('✅ Normal traffic generation completed. Dashboard should remain HEALTHY.');
}

/**
 * High Latency Anomaly: Simulates slow payment processing / DB bottleneck
 */
async function simulateSlow(count = 3, delayMs = 2200) {
  console.log(`\n🟡 [SIMULATOR] Generating ${count} HIGH LATENCY requests (Delay: ${delayMs}ms) to ${TARGET_HOST}/api/payment...`);
  for (let i = 1; i <= count; i++) {
    console.log(`  [${i}/${count}] Sending POST /api/payment?delay=${delayMs}... (waiting)`);
    const r = await sendRequest(`${TARGET_HOST}/api/payment?delay=${delayMs}`, { method: 'POST' });
    console.log(`  [${i}/${count}] POST /api/payment -> HTTP ${r.status} (${r.duration}ms) ⚠️ SLA BREACH (>1500ms)`);
  }
  console.log('🚨 High Latency generation completed. Dashboard should alert CRITICAL HIGH_LATENCY.');
}

/**
 * Server Error Crash: Simulates downstream failure / HTTP 500 burst
 */
async function simulateError(count = 4) {
  console.log(`\n🔴 [SIMULATOR] Generating ${count} SERVER ERROR crashes (HTTP 500) to ${TARGET_HOST}/api/error...`);
  for (let i = 1; i <= count; i++) {
    const r = await sendRequest(`${TARGET_HOST}/api/error`);
    console.log(`  [${i}/${count}] GET /api/error -> HTTP ${r.status} (${r.duration}ms) 🚨 SERVER ERROR DETECTED`);
    await new Promise(r => setTimeout(r, 150));
  }
  console.log('🚨 Server Error generation completed. Dashboard should alert CRITICAL SERVER_ERROR.');
}

/**
 * Traffic Burst: Simulates high volume traffic spike
 */
async function simulateBurst(count = 15) {
  console.log(`\n⚡ [SIMULATOR] Generating rapid TRAFFIC BURST (${count} requests in parallel)...`);
  const promises = [];
  for (let i = 1; i <= count; i++) {
    promises.push(sendRequest(`${TARGET_HOST}/api/products`));
  }
  const results = await Promise.all(promises);
  console.log(`✅ Dispatched ${results.length} requests in parallel. All queued via SQS.`);
}

// CLI Execution handler
if (require.main === module) {
  const mode = process.argv[2] || 'normal';
  const count = parseInt(process.argv[3] || '5', 10);

  console.log('====================================================');
  console.log('🚀 CHAOS & TRAFFIC SIMULATOR CONTROLLER');
  console.log('====================================================');

  (async () => {
    switch (mode.toLowerCase()) {
      case 'slow':
      case 'latency':
        await simulateSlow(count || 3);
        break;
      case 'error':
      case 'crash':
        await simulateError(count || 4);
        break;
      case 'burst':
      case 'surge':
        await simulateBurst(count || 15);
        break;
      case 'normal':
      default:
        await simulateNormal(count || 5);
        break;
    }
  })();
}

module.exports = {
  simulateNormal,
  simulateSlow,
  simulateError,
  simulateBurst
};
