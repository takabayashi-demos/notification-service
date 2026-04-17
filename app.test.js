const request = require('supertest');
const app = require('./app');

describe('Security validation tests', () => {
  describe('Input validation', () => {
    it('should reject invalid channel', async () => {
      const res = await request(app)
        .post('/api/v1/queue')
        .send({
          to: 'test@example.com',
          message: 'Test message',
          channel: 'invalid'
        });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid channel');
    });

    it('should reject invalid priority', async () => {
      const res = await request(app)
        .post('/api/v1/queue')
        .send({
          to: 'test@example.com',
          message: 'Test message',
          priority: 'critical'
        });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid priority');
    });

    it('should reject oversized messages', async () => {
      const largeMessage = 'x'.repeat(10001);
      const res = await request(app)
        .post('/api/v1/queue')
        .send({
          to: 'test@example.com',
          message: largeMessage
        });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('exceeds maximum length');
    });

    it('should accept valid input', async () => {
      const res = await request(app)
        .post('/api/v1/queue')
        .send({
          to: 'test@example.com',
          message: 'Valid message',
          channel: 'email',
          priority: 'high'
        });
      
      expect(res.status).toBe(201);
      expect(res.body.channel).toBe('email');
      expect(res.body.priority).toBe('high');
    });
  });

  describe('Rate limiting', () => {
    it('should enforce rate limit after 100 requests', async () => {
      const requests = [];
      
      for (let i = 0; i < 101; i++) {
        requests.push(
          request(app)
            .post('/api/v1/queue')
            .send({
              to: 'test@example.com',
              message: `Message ${i}`
            })
        );
      }
      
      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);
      
      expect(rateLimited.length).toBeGreaterThan(0);
      expect(rateLimited[0].body.error).toContain('Too many requests');
    });
  });
});
