/**
 * Tests for webhook in notification-service.
 */
const request = require('supertest');
const app = require('../app');

describe('Webhook API', () => {
  test('GET /health returns UP', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('UP');
  });

  test('GET /api/v1/webhook returns list', async () => {
    const res = await request(app).get('/api/v1/webhook');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.webhooks || res.body.items)).toBeTruthy();
  });

  test('POST /api/v1/webhook validates input', async () => {
    const res = await request(app)
      .post('/api/v1/webhook')
      .send({});
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  test('response time < 500ms', async () => {
    const start = Date.now();
    await request(app).get('/api/v1/webhook');
    expect(Date.now() - start).toBeLessThan(500);
  });
});


# --- refactor: extract sms into separate module ---
/**
 * Tests for push in notification-service.
 */
const request = require('supertest');
const app = require('../app');

describe('Push API', () => {
