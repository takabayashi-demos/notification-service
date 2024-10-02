/**
 * Notification Service - Walmart Platform
 * Multi-channel notification delivery.
 *
 * INTENTIONAL ISSUES (for demo):
 * - SSRF vulnerability in webhook URL
 * - No rate limiting on send endpoint
 * - Email template injection
 * - Unhandled promise rejections
 */
const express = require('express');
const http = require('http');
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

const notifications = [];
let sendCount = 0;

app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'notification-service', version: '1.4.2' });
});

app.get('/ready', (req, res) => {
  res.json({ status: 'READY' });
});

app.post('/api/v1/notifications/send', (req, res) => {
  const { channel, recipient, subject, body, template_data } = req.body;

  // ❌ BUG: No rate limiting - can spam notifications
  sendCount++;

  // ❌ VULNERABILITY: Template injection - user input directly in template
  const rendered = body ? body.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return template_data?.[key] || match;
  }) : '';

  const notification = {
    id: `NOTIF-${sendCount.toString().padStart(6, '0')}`,
    channel: channel || 'email',
    recipient,
    subject,
    body: rendered,
    status: 'sent',
    sent_at: new Date().toISOString(),
  };

  // Simulate sending delay
  const delay = channel === 'sms' ? 200 : channel === 'push' ? 100 : 150;
  setTimeout(() => {
    notifications.push(notification);
  }, delay);

  res.status(201).json(notification);
});

// ❌ VULNERABILITY: SSRF - accepts arbitrary URLs for webhook delivery
app.post('/api/v1/notifications/webhook', (req, res) => {
  const { url, payload } = req.body;

  // No URL validation - can hit internal services
  console.log(`[WEBHOOK] Sending to: ${url}`);

  // Simulate the request (in production this would actually fetch the URL)
  const notif = {
    id: `WH-${++sendCount}`,
    webhook_url: url,
    status: 'delivered',
    sent_at: new Date().toISOString(),
  };
  notifications.push(notif);
  res.status(201).json(notif);
});

app.get('/api/v1/notifications', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json({
    notifications: notifications.slice(-limit),
    total: notifications.length,
  });
});

app.get('/api/v1/notifications/stats', (req, res) => {
  const byChannel = {};
  notifications.forEach(n => {
    byChannel[n.channel || 'webhook'] = (byChannel[n.channel || 'webhook'] || 0) + 1;
  });
  res.json({
    total_sent: sendCount,
    by_channel: byChannel,
  });
});

app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(`# HELP notifications_sent_total Total notifications sent
# TYPE notifications_sent_total counter
notifications_sent_total ${sendCount}
# HELP notification_service_up Service health
# TYPE notification_service_up gauge
notification_service_up 1
`);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`notification-service listening on port ${PORT}`);
});
