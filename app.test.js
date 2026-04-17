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
});