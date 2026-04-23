const express = require('express');
const app = express();

app.use(express.json());

const queue = [];
let idCounter = 0;

app.get('/health', (req, res) => {
  res.json({ status: 'UP', timestamp: new Date().toISOString() });
});

app.get('/api/v1/queue', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const { channel, status, priority } = req.query;

  let filtered = queue;

  if (channel) {
    const channelLower = channel.toLowerCase();
    filtered = filtered.filter(item => item.channel.toLowerCase() === channelLower);
  }

  if (status) {
    const statusLower = status.toLowerCase();
    filtered = filtered.filter(item => item.status.toLowerCase() === statusLower);
  }

  if (priority) {
    const priorityLower = priority.toLowerCase();
    filtered = filtered.filter(item => item.priority.toLowerCase() === priorityLower);
  }

  res.json({
    items: filtered.slice(-limit),
    total: filtered.length
  });
});

app.post('/api/v1/queue', (req, res) => {
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

const PORT = process.env.PORT || 8080;

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`notification-service listening on port ${PORT}`);
  });
}

module.exports = app;
