const request = require('supertest');
const app = require('./app');

describe('notification-service', () => {
  describe('GET /api/v1/queue', () => {
    it('should correctly parse limit with leading zero', async () => {
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/v1/queue')
          .send({ to: 'test@example.com', message: `Message ${i}` });
      }

      const res = await request(app)
        .get('/api/v1/queue?limit=08')
        .expect(200);

      expect(res.body.items.length).toBe(8);
    });
  });

  describe('POST /api/v1/queue', () => {
    it('should prevent unbounded queue growth', async () => {
      const MAX_QUEUE_SIZE = 10000;
      
      for (let i = 0; i < MAX_QUEUE_SIZE + 100; i++) {
        await request(app)
          .post('/api/v1/queue')
          .send({ to: 'test@example.com', message: `Bulk message ${i}` });
      }

      const res = await request(app)
        .get('/api/v1/queue?limit=200')
        .expect(200);

      expect(res.body.total).toBeLessThanOrEqual(MAX_QUEUE_SIZE);
    });
  });
});