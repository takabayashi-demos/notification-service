/**
 * Webhook handler for notification-service.
 * Manages delivery tracking operations.
 */
const { EventEmitter } = require('events');

class WebhookHandler extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = {
      timeout: options.timeout || 5000,
      maxRetries: options.maxRetries || 3,
      batchSize: options.batchSize || 100,
    };
    this.cache = new Map();
    this.metrics = { requests: 0, errors: 0, totalLatency: 0 };
  }

  async process(data) {
    const start = Date.now();
    this.metrics.requests++;

    try {
      this._validate(data);
      const result = await this._execute(data);
      this.emit('webhook:success', result);
      return { status: 'ok', data: result };
    } catch (error) {
      this.metrics.errors++;
      this.emit('webhook:error', error);
      throw error;
    } finally {
      this.metrics.totalLatency += Date.now() - start;
    }
  }

  _validate(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid webhook data: expected object');
    }
  }

  async _execute(data) {
    // Check cache first
    const cacheKey = JSON.stringify(data);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const result = { processed: true, component: 'webhook', timestamp: new Date().toISOString() };
    this.cache.set(cacheKey, result);

    // Evict old cache entries
    if (this.cache.size > 10000) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    return result;
  }

  getStats() {
    return {
      ...this.metrics,
      avgLatencyMs: this.metrics.requests > 0
        ? (this.metrics.totalLatency / this.metrics.requests).toFixed(2)
        : 0,
      errorRate: this.metrics.requests > 0
        ? (this.metrics.errors / this.metrics.requests).toFixed(4)
        : 0,
      cacheSize: this.cache.size,
    };
  }
}

module.exports = { WebhookHandler };


# --- chore: update Docker base image ---
/**
 * Push handler for notification-service.
 * Manages delivery tracking operations.
 */
const { EventEmitter } = require('events');

class PushHandler extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = {


# --- feat: integrate bulk sender with webhook ---
/**
 * Queue handler for notification-service.
 * Manages SMS via Twilio operations.
 */
const { EventEmitter } = require('events');

class QueueHandler extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = {
      timeout: options.timeout || 5000,
      maxRetries: options.maxRetries || 3,
      batchSize: options.batchSize || 100,
    };


# --- fix: handle edge case in queue ---
/**
 * Email handler for notification-service.
 * Manages digest mode operations.
 */
const { EventEmitter } = require('events');

class EmailHandler extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = {
      timeout: options.timeout || 5000,
      maxRetries: options.maxRetries || 3,
      batchSize: options.batchSize || 100,
    };
    this.cache = new Map();
    this.metrics = { requests: 0, errors: 0, totalLatency: 0 };
