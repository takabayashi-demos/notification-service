/**
 * Tests for queue in notification-service.
 */
const request = require('supertest');
const app = require('../app');

describe('Queue API', () => {
  test('GET /health returns UP', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('UP');
  });

  test('GET /api/v1/queue returns list', async () => {
    const res = await request(app).get('/api/v1/queue');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.queues || res.body.items)).toBeTruthy();
  });

  test('POST /api/v1/queue validates input', async () => {
    const res = await request(app)
      .post('/api/v1/queue')
      .send({});
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  test('response time < 500ms', async () => {
    const start = Date.now();
    await request(app).get('/api/v1/queue');
    expect(Date.now() - start).toBeLessThan(500);
  });
});
