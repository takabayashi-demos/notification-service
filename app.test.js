const request = require('supertest');
const app = require('./app');

describe('GET /api/v1/queue filtering', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/queue').send({ to: 'user1@example.com', message: 'Test 1', channel: 'email', priority: 'high' });
    await request(app).post('/api/v1/queue').send({ to: 'user2@example.com', message: 'Test 2', channel: 'sms', priority: 'normal' });
    await request(app).post('/api/v1/queue').send({ to: 'user3@example.com', message: 'Test 3', channel: 'push', priority: 'low' });
    await request(app).post('/api/v1/queue').send({ to: 'user4@example.com', message: 'Test 4', channel: 'email', priority: 'normal' });
  });

  it('should filter by channel', async () => {
    const res = await request(app).get('/api/v1/queue?channel=email');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items.every(item => item.channel === 'email')).toBe(true);
  });

  it('should filter by status', async () => {
    const res = await request(app).get('/api/v1/queue?status=queued');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    expect(res.body.items.every(item => item.status === 'queued')).toBe(true);
  });

  it('should filter by priority', async () => {
    const res = await request(app).get('/api/v1/queue?priority=high');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].priority).toBe('high');
  });

  it('should filter by multiple parameters', async () => {
    const res = await request(app).get('/api/v1/queue?channel=email&priority=normal');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].channel).toBe('email');
    expect(res.body.items[0].priority).toBe('normal');
  });

  it('should be case-insensitive', async () => {
    const res = await request(app).get('/api/v1/queue?channel=EMAIL');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  it('should return empty array when no matches', async () => {
    const res = await request(app).get('/api/v1/queue?channel=fax');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.items).toEqual([]);
  });

  it('should respect limit parameter with filters', async () => {
    const res = await request(app).get('/api/v1/queue?limit=1');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
  });
});
