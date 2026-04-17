const request = require('supertest');
const app = require('./app');

describe('Rate Limiting', () => {
  it('should allow requests under the limit', async () => {
    const payload = {
      to: 'customer@example.com',
      message: 'Test notification'
    };

    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/v1/queue')
        .send(payload);
      expect(res.status).toBe(201);
    }
  });

  it('should return 429 when rate limit exceeded', async () => {
    const payload = {
      to: 'spam@example.com',
      message: 'Spam notification'
    };

    const requests = [];
    for (let i = 0; i < 101; i++) {
      requests.push(
        request(app)
          .post('/api/v1/queue')
          .send(payload)
      );
    }

    const results = await Promise.all(requests);
    const rateLimited = results.filter(r => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  }, 30000);

  it('should include rate limit headers', async () => {
    const payload = {
      to: 'test@example.com',
      message: 'Header test'
    };

    const res = await request(app)
      .post('/api/v1/queue')
      .send(payload);

    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining']).toBeDefined();
  });
});

describe('Health Check', () => {
  it('should return UP status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
  });
});
