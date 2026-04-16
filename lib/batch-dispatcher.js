/**
 * BatchDispatcher groups notifications by channel and flushes in chunks
 * to reduce per-item overhead on downstream transports (SES, Twilio, FCM).
 */
class BatchDispatcher {
  constructor(redis, opts = {}) {
    this.redis = redis;
    this.chunkSize = opts.chunkSize || 50;
    this.flushIntervalMs = opts.flushIntervalMs || 1000;
    this.buffers = { email: [], sms: [], push: [] };
    this._timer = null;
    this._processing = false;
    this._stats = { dispatched: 0, batches: 0, errors: 0 };
  }

  enqueue(channel, notification) {
    if (!this.buffers[channel]) {
      throw new Error(`Unknown channel: ${channel}`);
    }
    this.buffers[channel].push(notification);

    // Flush immediately if chunk threshold reached
    if (this.buffers[channel].length >= this.chunkSize) {
      this._flushChannel(channel);
    }
  }

  start() {
    if (this._timer) return;
    this._timer = setInterval(() => this._flushAll(), this.flushIntervalMs);
  }

  async stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    await this._flushAll();
  }

  stats() {
    return {
      ...this._stats,
      pending: Object.fromEntries(
        Object.entries(this.buffers).map(([ch, buf]) => [ch, buf.length])
      ),
    };
  }

  async _flushAll() {
    if (this._processing) return;
    this._processing = true;
    try {
      await Promise.all(
        Object.keys(this.buffers).map((ch) => this._flushChannel(ch))
      );
    } finally {
      this._processing = false;
    }
  }

  async _flushChannel(channel) {
    const buffer = this.buffers[channel];
    if (buffer.length === 0) return;

    // Drain buffer into chunks
    const items = buffer.splice(0, buffer.length);
    const chunks = [];
    for (let i = 0; i < items.length; i += this.chunkSize) {
      chunks.push(items.slice(i, i + this.chunkSize));
    }

    for (const chunk of chunks) {
      try {
        // Pipeline status updates for the whole chunk
        const pipeline = this.redis.pipeline();
        for (const item of chunk) {
          pipeline.set(
            `notif:queue:${channel}:${item.id}`,
            JSON.stringify({ ...item, status: 'dispatched', dispatched_at: new Date().toISOString() }),
            'EX',
            86400
          );
        }
        await pipeline.exec();

        this._stats.dispatched += chunk.length;
        this._stats.batches += 1;
      } catch (err) {
        console.error(`[batch-dispatcher] flush error on ${channel}:`, err.message);
        this._stats.errors += 1;
        // Re-queue failed items at the front for retry
        this.buffers[channel].unshift(...chunk);
      }
    }
  }
}

module.exports = { BatchDispatcher };
