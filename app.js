const express = require('express');
const app = express();

app.use(express.json());

// In-memory queue store (replaced by SQS/Kafka in prod)
const queues = [];
let idSeq = 1;

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'UP', service: 'notification-service', timestamp: new Date().toISOString() });
});

// List queued notifications
app.get('/api/v1/queue', (_req, res) => {
  res.json({ items: queues, count: queues.length });
});

// Enqueue a notification
const VALID_TYPES = ['email', 'sms', 'push'];

app.post('/api/v1/queue', (req, res) => {
  const body = req.body || {};

  // --- FIX: validate required fields BEFORE any property access ---
  const required = ['type', 'recipient', 'message'];
  const missing = required.filter(f => body[f] == null || (typeof body[f] === 'string' && body[f].trim() === ''));

  if (missing.length > 0) {
    return res.status(400).json({
      error: 'Missing required fields',
      missing_fields: missing,
    });
  }

  const type = body.type.trim().toLowerCase();

  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({
      error: `Invalid notification type. Must be one of: ${VALID_TYPES.join(', ')}`,
    });
  }

  const entry = {
    id: idSeq++,
    type,
    recipient: body.recipient.trim(),
    message: body.message.trim(),
    status: 'queued',
    created_at: new Date().toISOString(),
  };

  queues.push(entry);
  res.status(201).json(entry);
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
