// target-app/server.js
// Sample E-Commerce Target Application instrumented with Telemetry Middleware

const express = require('express');
const createMonitoringMiddleware = require('./monitor');

const app = express();
const PORT = process.env.TARGET_PORT || 3000;
const INGESTION_URL = process.env.MONITOR_INGESTION_URL || 'http://localhost:5000/api/telemetry';

app.use(express.json());

// 🔌 Attach the lightweight monitoring middleware
app.use(createMonitoringMiddleware({ ingestionUrl: INGESTION_URL }));

// Mock Products Catalog
const PRODUCTS = [
  { id: 1, name: 'Cloud Computing Textbook', price: 49.99, stock: 120 },
  { id: 2, name: 'Wireless Mechanical Keyboard', price: 89.99, stock: 45 },
  { id: 3, name: '4K Ultra-HD Monitor', price: 299.99, stock: 15 },
  { id: 4, name: 'Noise-Cancelling Headphones', price: 199.99, stock: 30 }
];

// 1. Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', application: 'demo-ecommerce-app', port: PORT });
});

// 2. Fast Route: Catalog lookup
app.get('/api/products', (req, res) => {
  res.json({ success: true, count: PRODUCTS.length, data: PRODUCTS });
});

// 3. Normal Route: Place order
app.post('/api/order', (req, res) => {
  const { productId, quantity = 1 } = req.body || {};
  const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;

  res.status(201).json({
    success: true,
    message: 'Order created successfully',
    order: {
      orderId,
      productId: productId || 1,
      quantity,
      createdAt: new Date().toISOString()
    }
  });
});

// 4. Potentially Slow Route: Payment Processing (Simulates downstream latency / chaos)
app.post('/api/payment', async (req, res) => {
  // Check if artificial latency is requested via query or header or body
  const delay = parseInt(req.query.delay || req.body?.delay || 0, 10);

  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  res.json({
    success: true,
    transactionId: `TXN-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    amount: req.body?.amount || 99.99,
    status: 'PAID',
    processingTimeMs: delay
  });
});

// 5. Fault Injection Route: Server 500 error generator
app.get('/api/error', (req, res) => {
  res.status(500).json({
    success: false,
    error: 'InternalServerError',
    message: 'Simulated downstream database connection timeout (HTTP 500)'
  });
});

// 6. Auth Route: Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === 'admin' && password === 'password123') {
    return res.json({ success: true, token: 'mock-jwt-token-xyz' });
  }
  return res.status(401).json({ success: false, error: 'Invalid credentials' });
});

// Start Server if run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🛍️ Target Demo Application running at http://localhost:${PORT}`);
    console.log(`📡 Telemetry being dispatched to: ${INGESTION_URL}`);
  });
}

module.exports = app;
