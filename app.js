const express = require('express');
const app = express();

app.use(express.json());

const SUPPORTED_CHANNELS = ['email', 'sms', 'push'];
const queues = [];

app.get('/health', (req, res) => {
  res.json({ status: 'UP' });
});

app.get('/api/v1/queue', (req, res) => {
  res.json({ queues });
});

app.post('/api/v1/queue', (req, res) => {
  const { channel, recipient, message } = req.body;

  if (!channel || !SUPPORTED_CHANNELS.includes(channel)) {
    return res.status(400).json({
      error: `channel must be one of: ${SUPPORTED_CHANNELS.join(', ')}`
    });
  }

  if (!recipient || typeof recipient !== 'object') {
    return res.status(400).json({ error: 'recipient is required' });
  }

  const destination = channel === 'email' ? recipient.email : recipient.phone;
  if (!destination) {
    return res.status(400).json({
      error: `recipient.${channel === 'email' ? 'email' : 'phone'} is required for channel "${channel}"`
    });
  }

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  queues.push({
    channel,
    destination,
    message,
    status: 'pending',
    createdAt: new Date().toISOString()
  });

  res.status(201).json({ status: 'queued' });
});

module.exports = app;
