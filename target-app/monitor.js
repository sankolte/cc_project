// target-app/monitor.js
// Lightweight, non-blocking telemetry middleware

/**
 * Creates an Express middleware that measures HTTP request latency,
 * captures response status codes, and asynchronously dispatches telemetry.
 *
 * @param {Object} options
 * @param {string} options.ingestionUrl - Monitoring API telemetry endpoint (e.g., http://localhost:5000/api/telemetry)
 * @returns {Function} Express middleware function
 */
function createMonitoringMiddleware(options = {}) {
  const ingestionUrl = options.ingestionUrl || process.env.MONITOR_INGESTION_URL || 'http://localhost:5000/api/telemetry';

  return function monitoringMiddleware(req, res, next) {
    // Record request start time
    const startTime = Date.now();

    // Hook into response completion
    res.on('finish', () => {
      const latencyMs = Date.now() - startTime;
      const telemetryPayload = {
        timestamp: new Date().toISOString(),
        endpoint: req.baseUrl ? `${req.baseUrl}${req.path}` : req.path,
        method: req.method,
        status_code: res.statusCode,
        latency_ms: latencyMs
      };

      // Asynchronous, non-blocking dispatch (fire-and-forget)
      // If the monitoring server is down, the target application is completely unaffected.
      fetch(ingestionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telemetryPayload)
      }).catch(err => {
        // Silently ignore or debug-log network failures so target app never crashes
        if (process.env.DEBUG_TELEMETRY === 'true') {
          console.warn(`[Telemetry Middleware] Warning: Failed to deliver telemetry: ${err.message}`);
        }
      });
    });

    next();
  };
}

module.exports = createMonitoringMiddleware;
