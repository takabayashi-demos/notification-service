const express = require('express');
const app = express();

app.use(express.json());

// Constants
const QUEUE_DEFAULT_LIMIT = 50;
const QUEUE_MAX_LIMIT = 200;
const DEFAULT_CHANNEL = 'email';
const DEFAULT_PRIORITY = 'normal';
const VALID_CHANNELS = ['email', 'sms', 'push'];
const VALID_PRIORITIES = ['low', 'normal', 'high', 'urgent'];

const queue = [];
let idCounter = 0;

// Validation helpers
function validateNotificationRequest(body) {
  const errors = [];
  
  if (!body) {
    return { valid: false, errors: ['Request body is required'] };
  }

  const { to, message, channel, priority } = body;

  if (!to) errors.push('Field "to" is required');
  if (!message) errors.push('Field "message" is required');

  if (to && typeof to !== 'string') {
    errors.push('Field "to" must be a string');
  }
  if (message && typeof message !== 'string') {
    errors.push('Field "message" must be a string');
  }

  if (channel && !VALID_CHANNELS.includes(channel)) {
    errors.push(`Invalid channel. Must be one of: ${VALID_CHANNELS.join(', ')}`);
  }

  if (priority && !VALID_PRIORITIES.includes(priority)) {
    errors.push(`Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function parseRecipients(to) {
  if (!to) return [];
  return to.split(',').map(r => r.trim()).filter(Boolean);
}

app.get('/health', (req, res) => {
  res.json({ status: 'UP', timestamp: new Date().toISOString() });
});

app.get('/api/v1/queue', (req, res) => {
  const limit = Math.min(
    parseInt(req.query.limit) || QUEUE_DEFAULT_LIMIT,
    QUEUE_MAX_LIMIT
  );
  res.json({
    items: queue.slice(-limit),
    total: queue.length
  });
});

app.post('/api/v1/queue', (req, res) => {
  try {
    const validation = validateNotificationRequest(req.body);
    
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: validation.errors 
      });
    }

    const { to, message, channel, priority } = req.body;
    const recipients = parseRecipients(to);

    if (recipients.length === 0) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: ['At least one valid recipient is required']
      });
    }

    const entry = {
      id: `notif-${++idCounter}`,
      recipients,
      message,
      channel: channel || DEFAULT_CHANNEL,
      priority: priority || DEFAULT_PRIORITY,
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
