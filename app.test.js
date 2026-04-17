const request = require('supertest');
const app = require('./app');

describe('notification-service', () => {
  describe('POST /api/v1/queue', () => {
    it('should accept valid notification', async () => {
      const res = await request(app)
        .post('/api/v1/queue')
        .send({
          to: 'user@example.com',
          message: 'Test message',
          channel: 'email',
          priority: 'high'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.recipients).toEqual(['user@example.com']);
    });

    it('should enforce max queue size', async () => {
      for (let i = 0; i < 10005; i++) {
        await request(app)
          .post('/api/v1/queue')
          .send({
            to: `user${i}@example.com`,
            message: `Message ${i}`
          });
      }

      const res = await request(app).get('/health');
      expect(res.body.queueSize).toBeLessThanOrEqual(10000);
    });
  });

  describe('GET /health', () => {
    it('should return queue metrics', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('queueSize');
      expect(res.body).toHaveProperty('queueLimit');
      expect(res.body.queueLimit).toBe(10000);
    });
  });
});
