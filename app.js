const express = require('express');
const app = express();

app.use(express.json({ limit: '10kb' }));

const queue = [];
let idCounter = 0;

const VALID_CHANNELS = ['email', 'sms', 'push'];
const VALID_PRIORITIES = ['low', 'normal', 'high', 'urgent'];

const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 100;

function rateLimitMiddleware(req, res, next) {
  const clientIp = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!rateLimitStore.has(clientIp)) {
    rateLimitStore.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return next();
  }
  
  const record = rateLimitStore.get(clientIp);
  
  if (now > record.resetAt) {
    rateLimitStore.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return next();
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    res.set('Retry-After', Math.ceil((record.resetAt - now) / 1000));
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }
  
  record.count++;
  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) {
      rateLimitStore.delete(ip);
    }
  }
}, 5 * 60 * 1000);

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

app.post('/api/v1/queue', rateLimitMiddleware, (req, res) => {
  try {
    const { to, message, channel, priority } = req.body || {};

    if (!to || !message) {
      return res.status(400).json({ error: 'Missing required fields: to, message' });
    }

    if (typeof to !== 'string' || typeof message !== 'string') {
      return res.status(400).json({ error: 'Fields "to" and "message" must be strings' });
    }

    if (message.length > 10000) {
      return res.status(400).json({ error: 'Message exceeds maximum length of 10000 characters' });
    }

    const recipients = to.split(',').map(r => r.trim()).filter(Boolean);

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'At least one valid recipient is required' });
    }

    const validatedChannel = channel || 'email';
    if (!VALID_CHANNELS.includes(validatedChannel)) {
      return res.status(400).json({ error: `Invalid channel. Must be one of: ${VALID_CHANNELS.join(', ')}` });
    }

    const validatedPriority = priority || 'normal';
    if (!VALID_PRIORITIES.includes(validatedPriority)) {
      return res.status(400).json({ error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }

    const entry = {
      id: `notif-${++idCounter}`,
      recipients,
      message,
      channel: validatedChannel,
      priority: validatedPriority,
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

const PORT = process.env.PORT || 8080;

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`notification-service listening on port ${PORT}`);
  });
}

module.exports = app;
