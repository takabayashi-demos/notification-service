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
    expect(Array.isArray(res.body.queues)).toBeTruthy();
  });

  test('POST /api/v1/queue with empty body returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/queue')
      .send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('POST /api/v1/queue with unsupported channel returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/queue')
      .send({ channel: 'fax', recipient: { phone: '5551234567' }, message: 'test' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/channel must be one of/);
  });

  test('POST /api/v1/queue with missing recipient returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/queue')
      .send({ channel: 'sms', message: 'test' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/recipient is required/);
  });

  test('POST /api/v1/queue with missing destination returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/queue')
      .send({ channel: 'email', recipient: {}, message: 'test' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/recipient\.email is required/);
  });

  test('POST /api/v1/queue with missing message returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/queue')
      .send({ channel: 'sms', recipient: { phone: '5551234567' } });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/message is required/);
  });

  test('POST /api/v1/queue with valid payload returns 201', async () => {
    const res = await request(app)
      .post('/api/v1/queue')
      .send({ channel: 'email', recipient: { email: 'user@walmart.com' }, message: 'Order shipped' });
    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe('queued');
  });

  test('response time < 500ms', async () => {
    const start = Date.now();
    await request(app).get('/api/v1/queue');
    expect(Date.now() - start).toBeLessThan(500);
  });
});
