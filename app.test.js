const request = require('supertest');
const app = require('./app');

describe('Queue API', () => {
  test('GET /health returns UP', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('UP');
  });

  test('GET /api/v1/queue returns list', async () => {
    const res = await request(app).get('/api/v1/queue');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.items)).toBeTruthy();
  });

  test('POST /api/v1/queue validates input', async () => {
    const res = await request(app)
      .post('/api/v1/queue')
      .send({});
    expect(res.statusCode).toBe(400);
  });

  test('POST /api/v1/queue returns 400 with missing_fields on empty body', async () => {
    const res = await request(app)
      .post('/api/v1/queue')
      .send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.missing_fields).toEqual(
      expect.arrayContaining(['type', 'recipient', 'message'])
    );
  });

  test('POST /api/v1/queue returns 400 when recipient is null', async () => {
    const res = await request(app)
      .post('/api/v1/queue')
      .send({ type: 'email', recipient: null, message: 'hello' });
    expect(res.statusCode).toBe(400);
    expect(res.body.missing_fields).toContain('recipient');
  });

  test('POST /api/v1/queue returns 400 for invalid type', async () => {
    const res = await request(app)
      .post('/api/v1/queue')
      .send({ type: 'fax', recipient: 'user@walmart.com', message: 'hello' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/Invalid notification type/);
  });

  test('POST /api/v1/queue creates entry with valid payload', async () => {
    const res = await request(app)
      .post('/api/v1/queue')
      .send({ type: 'email', recipient: 'user@walmart.com', message: 'Order shipped' });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.status).toBe('queued');
  });

  test('response time < 500ms', async () => {
    const start = Date.now();
    await request(app).get('/api/v1/queue');
    expect(Date.now() - start).toBeLessThan(500);
  });
});
