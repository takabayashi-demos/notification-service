const express = require('express');
const rateLimit = require('express-rate-limit');
const app = express();

app.use(express.json());

const queue = [];
let idCounter = 0;

const queueLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

app.get('/health', (req, res) => {
  res.json({ status: 'UP', timestamp: new Date().toISOString() });
});

app.get('/api/v1/queue', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  res.json({
    items: queue.slice(-limit),
    total: queue.length
  });
});

app.post('/api/v1/queue', queueLimiter, (req, res) => {
  try {
    const { to, message, channel, priority } = req.body || {};

    if (!to || !message) {
      return res.status(400).json({ error: 'Missing required fields: to, message' });
    }

    if (typeof to !== 'string' || typeof message !== 'string') {
      return res.status(400).json({ error: 'Fields "to" and "message" must be strings' });
    }

    const recipients = to.split(',').map(r => r.trim()).filter(Boolean);

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'At least one valid recipient is required' });
    }

    const entry = {
      id: `notif-${++idCounter}`,
      recipients,
      message,
      channel: channel || 'email',
      priority: priority || 'normal',
      status: 'queued',
      createdAt: new Date().toISOString()
    };

    queue.push(entry);
    res.status(201).json(entry);
  } catch (err) {
    console.error('Queue insertion error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
