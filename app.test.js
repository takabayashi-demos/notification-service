const request = require('supertest');
const app = require('./app');

describe('Notification Service API', () => {
  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'UP');
      expect(res.body).toHaveProperty('timestamp');
      expect(new Date(res.body.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('POST /api/v1/queue', () => {
    it('should create notification with valid data', async () => {
      const payload = {
        to: 'user@example.com',
        message: 'Order shipped',
        channel: 'email',
        priority: 'high'
      };

      const res = await request(app)
        .post('/api/v1/queue')
        .send(payload)
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        recipients: ['user@example.com'],
        message: 'Order shipped',
        channel: 'email',
        priority: 'high',
        status: 'queued'
      });
      expect(res.body).toHaveProperty('id');
      expect(res.body.id).toMatch(/^notif-\d+$/);
      expect(res.body).toHaveProperty('createdAt');
    });

    it('should handle multiple recipients', async () => {
      const payload = {
        to: 'user1@example.com, user2@example.com, user3@example.com',
        message: 'Flash sale alert'
      };

      const res = await request(app)
        .post('/api/v1/queue')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.recipients).toEqual([
        'user1@example.com',
        'user2@example.com',
        'user3@example.com'
      ]);
    });

    it('should use defaults for optional fields', async () => {
      const payload = {
        to: 'user@example.com',
        message: 'Test message'
      };

      const res = await request(app)
        .post('/api/v1/queue')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.channel).toBe('email');
      expect(res.body.priority).toBe('normal');
    });

    it('should reject request without "to" field', async () => {
      const payload = { message: 'Test message' };

      const res = await request(app)
        .post('/api/v1/queue')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing required fields');
    });

    it('should reject request without "message" field', async () => {
      const payload = { to: 'user@example.com' };

      const res = await request(app)
        .post('/api/v1/queue')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing required fields');
    });

    it('should reject non-string "to" field', async () => {
      const payload = {
        to: 12345,
        message: 'Test message'
      };

      const res = await request(app)
        .post('/api/v1/queue')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('must be strings');
    });

    it('should reject non-string "message" field', async () => {
      const payload = {
        to: 'user@example.com',
        message: { text: 'Invalid' }
      };

      const res = await request(app)
        .post('/api/v1/queue')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('must be strings');
    });

    it('should reject empty recipient list after trimming', async () => {
      const payload = {
        to: '   ,  , ',
        message: 'Test message'
      };

      const res = await request(app)
        .post('/api/v1/queue')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('At least one valid recipient');
    });

    it('should trim whitespace from recipients', async () => {
      const payload = {
        to: '  user1@example.com  ,   user2@example.com  ',
        message: 'Test'
      };

      const res = await request(app)
        .post('/api/v1/queue')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.recipients).toEqual(['user1@example.com', 'user2@example.com']);
    });
  });

  describe('GET /api/v1/queue', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 5; i++) {
        await request(app)
          .post('/api/v1/queue')
          .send({
            to: `user${i}@example.com`,
            message: `Test message ${i}`
          });
      }
    });

    it('should retrieve queue items', async () => {
      const res = await request(app).get('/api/v1/queue');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(5);
    });

    it('should respect limit parameter', async () => {
      const res = await request(app).get('/api/v1/queue?limit=3');

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(3);
    });

    it('should default to 50 items when no limit specified', async () => {
      const res = await request(app).get('/api/v1/queue');

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeLessThanOrEqual(50);
    });

    it('should cap limit at 200', async () => {
      const res = await request(app).get('/api/v1/queue?limit=500');

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeLessThanOrEqual(200);
    });

    it('should return most recent items', async () => {
      const res = await request(app).get('/api/v1/queue?limit=2');

      expect(res.status).toBe(200);
      const items = res.body.items;
      if (items.length === 2) {
        const first = new Date(items[0].createdAt);
        const second = new Date(items[1].createdAt);
        expect(first.getTime()).toBeLessThanOrEqual(second.getTime());
      }
    });
  });
});
