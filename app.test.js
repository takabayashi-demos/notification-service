const request = require('supertest');
const app = require('../app');
const { BatchDispatcher } = require('../lib/batch-dispatcher');

describe('Queue API', () => {
  test('GET /health returns UP with cache_size', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('UP');
    expect(typeof res.body.cache_size).toBe('number');
  });

  test('GET /api/v1/queue returns list', async () => {
    const res = await request(app).get('/api/v1/queue');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.items)).toBeTruthy();
    expect(typeof res.body.count).toBe('number');
  });

  test('GET /api/v1/queue returns cache header', async () => {
    // First request: MISS
    const res1 = await request(app).get('/api/v1/queue');
    expect(res1.headers['x-cache']).toBe('MISS');

    // Second request within TTL: HIT
    const res2 = await request(app).get('/api/v1/queue');
    expect(res2.headers['x-cache']).toBe('HIT');
  });

  test('POST /api/v1/queue validates required fields', async () => {
    const res = await request(app)
      .post('/api/v1/queue')
      .send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/Missing required fields/);
  });

  test('POST /api/v1/queue validates channel', async () => {
    const res = await request(app)
      .post('/api/v1/queue')
      .send({ channel: 'fax', recipient: 'user@test.com', message: 'hello' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/Invalid channel/);
  });

  test('response time < 500ms for cached reads', async () => {
    // Prime the cache
    await request(app).get('/api/v1/queue');

    const start = Date.now();
    await request(app).get('/api/v1/queue');
    expect(Date.now() - start).toBeLessThan(500);
  });
});

describe('BatchDispatcher', () => {
  let mockRedis;
  let dispatcher;

  beforeEach(() => {
    mockRedis = {
      pipeline: () => {
        const cmds = [];
        return {
          set: (...args) => cmds.push(args),
          exec: jest.fn().mockResolvedValue(cmds.map(() => [null, 'OK'])),
        };
      },
    };
    dispatcher = new BatchDispatcher(mockRedis, { chunkSize: 3, flushIntervalMs: 100 });
  });

  afterEach(async () => {
    await dispatcher.stop();
  });

  test('buffers notifications by channel', () => {
    dispatcher.enqueue('email', { id: '1', recipient: 'a@b.com', message: 'hi' });
    dispatcher.enqueue('sms', { id: '2', recipient: '+1234', message: 'hi' });

    const stats = dispatcher.stats();
    expect(stats.pending.email).toBe(1);
    expect(stats.pending.sms).toBe(1);
    expect(stats.pending.push).toBe(0);
  });

  test('auto-flushes when chunk threshold reached', async () => {
    dispatcher.enqueue('email', { id: '1', recipient: 'a@b.com', message: '1' });
    dispatcher.enqueue('email', { id: '2', recipient: 'a@b.com', message: '2' });
    dispatcher.enqueue('email', { id: '3', recipient: 'a@b.com', message: '3' });

    // Wait for flush to complete
    await new Promise((r) => setTimeout(r, 50));

    const stats = dispatcher.stats();
    expect(stats.dispatched).toBe(3);
    expect(stats.batches).toBe(1);
    expect(stats.pending.email).toBe(0);
  });

  test('rejects unknown channels', () => {
    expect(() => {
      dispatcher.enqueue('carrier_pigeon', { id: '1' });
    }).toThrow('Unknown channel');
  });

  test('stats reports errors', async () => {
    const failRedis = {
      pipeline: () => ({
        set: () => {},
        exec: jest.fn().mockRejectedValue(new Error('connection lost')),
      }),
    };
    const failDispatcher = new BatchDispatcher(failRedis, { chunkSize: 1 });
    failDispatcher.enqueue('push', { id: '1', recipient: 'token', message: 'hi' });

    await new Promise((r) => setTimeout(r, 50));

    const stats = failDispatcher.stats();
    expect(stats.errors).toBe(1);
    // Failed items re-queued
    expect(stats.pending.push).toBe(1);
    await failDispatcher.stop();
  });
});
