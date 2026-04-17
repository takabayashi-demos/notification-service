const request = require('supertest');
const app = require('./app');

describe('Notification Service API', () => {
  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('POST /api/v1/queue', () => {
    it('should create a notification with valid input', async () => {
      const res = await request(app)
        .post('/api/v1/queue')
        .send({
          to: 'user@example.com',
          message: 'Test notification',
          channel: 'email',
          priority: 'normal'
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toMatch(/^notif-\d+$/);
      expect(res.body.recipients).toEqual(['user@example.com']);
      expect(res.body.message).toBe('Test notification');
    });

    it('should reject request with missing required fields', async () => {
      const res = await request(app)
        .post('/api/v1/queue')
        .send({ to: 'user@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
      expect(res.body.details).toContain('Field "message" is required');
    });

    it('should reject invalid channel', async () => {
      const res = await request(app)
        .post('/api/v1/queue')
        .send({
          to: 'user@example.com',
          message: 'Test',
          channel: 'invalid'
        });

      expect(res.status).toBe(400);
      expect(res.body.details[0]).toContain('Invalid channel');
    });

    it('should reject invalid priority', async () => {
      const res = await request(app)
        .post('/api/v1/queue')
        .send({
          to: 'user@example.com',
          message: 'Test',
          priority: 'critical'
        });

      expect(res.status).toBe(400);
      expect(res.body.details[0]).toContain('Invalid priority');
    });

    it('should parse multiple recipients', async () => {
      const res = await request(app)
        .post('/api/v1/queue')
        .send({
          to: 'user1@example.com, user2@example.com',
          message: 'Test'
        });

      expect(res.status).toBe(201);
      expect(res.body.recipients).toHaveLength(2);
    });
  });

  describe('GET /api/v1/queue', () => {
    it('should return queue items', async () => {
      const res = await request(app).get('/api/v1/queue');
      expect(res.status).toBe(200);
      expect(res.body.items).toBeDefined();
      expect(res.body.total).toBeDefined();
    });

    it('should respect limit parameter', async () => {
      const res = await request(app).get('/api/v1/queue?limit=10');
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeLessThanOrEqual(10);
    });
  });
});
