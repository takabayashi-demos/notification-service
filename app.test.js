const request = require('supertest');
const app = require('./app');

describe('notification-service', () => {
  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('POST /api/v1/queue', () => {
    it('should queue a notification', async () => {
      const res = await request(app)
        .post('/api/v1/queue')
        .send({
          to: 'user@example.com',
          message: 'Test notification',
          channel: 'email',
          priority: 'high'
        });
      
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('queued');
      expect(res.body.recipients).toEqual(['user@example.com']);
      expect(res.body.channel).toBe('email');
      expect(res.body.priority).toBe('high');
    });

    it('should reject missing required fields', async () => {
      const res = await request(app)
        .post('/api/v1/queue')
        .send({ message: 'Missing to field' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing required fields');
    });

    it('should handle multiple recipients', async () => {
      const res = await request(app)
        .post('/api/v1/queue')
        .send({
          to: 'user1@example.com, user2@example.com',
          message: 'Broadcast message'
        });
      
      expect(res.status).toBe(201);
      expect(res.body.recipients).toHaveLength(2);
    });
  });

  describe('GET /api/v1/queue', () => {
    it('should retrieve queued notifications', async () => {
      await request(app)
        .post('/api/v1/queue')
        .send({ to: 'test@example.com', message: 'Test' });

      const res = await request(app).get('/api/v1/queue');
      expect(res.status).toBe(200);
      expect(res.body.items).toBeDefined();
      expect(res.body.total).toBeGreaterThan(0);
    });
  });

  describe('DELETE /api/v1/queue/:id', () => {
    it('should cancel a queued notification', async () => {
      const created = await request(app)
        .post('/api/v1/queue')
        .send({
          to: 'user@example.com',
          message: 'Test cancellation',
          channel: 'sms'
        });

      const res = await request(app)
        .delete(`/api/v1/queue/${created.body.id}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('cancelled');
      expect(res.body.cancelledAt).toBeDefined();
      expect(res.body.id).toBe(created.body.id);
    });

    it('should return 404 for non-existent notification', async () => {
      const res = await request(app)
        .delete('/api/v1/queue/invalid-id');
      
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Notification not found');
    });

    it('should return 400 when cancelling already cancelled notification', async () => {
      const created = await request(app)
        .post('/api/v1/queue')
        .send({ to: 'user@example.com', message: 'Test' });

      await request(app).delete(`/api/v1/queue/${created.body.id}`);
      
      const res = await request(app)
        .delete(`/api/v1/queue/${created.body.id}`);
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Cannot cancel');
    });
  });
});
