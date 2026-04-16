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

  test('POST /api/v1/queue rejects numeric to field', async () => {
    const res = await request(app)
      .post('/api/v1/queue')
      .send({ to: 15551234567, message: 'hello' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/must be strings/);
  });

  test('POST /api/v1/queue rejects whitespace-only recipients', async () => {
    const res = await request(app)
      .post('/api/v1/queue')
      .send({ to: '   ,  , ', message: 'hello' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/valid recipient/);
  });

  test('POST /api/v1/queue returns 201 on success', async () => {
    const res = await request(app)
      .post('/api/v1/queue')
      .send({ to: 'user@walmart.com', message: 'Order shipped' });
    expect(res.statusCode).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('queued');
  });

  test('response time < 500ms', async () => {
    const start = Date.now();
    await request(app).get('/api/v1/queue');
    expect(Date.now() - start).toBeLessThan(500);
  });
});
