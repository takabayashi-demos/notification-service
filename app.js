const express = require('express');
const { LRUCache } = require('lru-cache');
const Redis = require('ioredis');

const app = express();
app.use(express.json());

// --- Redis connection pool ---
const redisPool = new Redis.Cluster(
  [{ host: process.env.REDIS_HOST || '127.0.0.1', port: parseInt(process.env.REDIS_PORT, 10) || 6379 }],
  {
    redisOptions: {
      password: process.env.REDIS_PASSWORD || undefined,
      connectTimeout: 5000,
      maxRetriesPerRequest: 2,
    },
    scaleReads: 'slave',
    enableReadyCheck: true,
    slotsRefreshTimeout: 2000,
    natMap: process.env.REDIS_NAT_MAP ? JSON.parse(process.env.REDIS_NAT_MAP) : undefined,
  }
).on('error', (err) => {
  console.error('[redis-pool] connection error:', err.message);
});

// Fallback to standalone Redis if cluster mode fails
const redis = process.env.REDIS_CLUSTER === 'true'
  ? redisPool
  : new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 2,
      connectTimeout: 5000,
      lazyConnect: true,
    });

// --- LRU cache for queue reads ---
const queueCache = new LRUCache({
  max: 500,
  ttl: 2000, // 2s TTL — queue state is near-realtime, not realtime
  allowStale: true, // serve stale while revalidating
  updateAgeOnGet: false,
});

// Pre-parsed queue metadata cache (avoids repeated JSON.parse per request)
const metadataCache = new Map();

function parseQueueMetadata(raw) {
  if (!raw) return null;
  const cached = metadataCache.get(raw);
  if (cached) return cached;
  try {
    const parsed = JSON.parse(raw);
    metadataCache.set(raw, parsed);
    // Cap metadata cache to prevent unbounded growth
    if (metadataCache.size > 10000) {
      const firstKey = metadataCache.keys().next().value;
      metadataCache.delete(firstKey);
    }
    return parsed;
  } catch {
    return null;
  }
}

// --- Health endpoint ---
app.get('/health', (_req, res) => {
  res.json({ status: 'UP', cache_size: queueCache.size });
});

// --- Queue endpoints ---
app.get('/api/v1/queue', async (req, res) => {
  try {
    const cacheKey = `queue:list:${req.query.channel || 'all'}:${req.query.status || 'all'}`;
    const cached = queueCache.get(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }

    const pattern = req.query.channel
      ? `notif:queue:${req.query.channel}:*`
      : 'notif:queue:*';

    const keys = await redis.keys(pattern);
    const pipeline = redis.pipeline();
    keys.forEach((k) => pipeline.get(k));
    const results = await pipeline.exec();

    const items = results
      .map(([err, val], i) => {
        if (err || !val) return null;
        const meta = parseQueueMetadata(val);
        if (!meta) return null;
        if (req.query.status && meta.status !== req.query.status) return null;
        return { id: keys[i].split(':').pop(), ...meta };
      })
      .filter(Boolean);

    const body = { items, count: items.length, cached: false };
    queueCache.set(cacheKey, body);
    res.set('X-Cache', 'MISS');
    res.json(body);
  } catch (err) {
    console.error('[queue] list error:', err.message);
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

app.post('/api/v1/queue', async (req, res) => {
  const { channel, recipient, message, priority } = req.body;
  if (!channel || !recipient || !message) {
    return res.status(400).json({
      error: 'Missing required fields: channel, recipient, message',
    });
  }

  const validChannels = ['email', 'sms', 'push'];
  if (!validChannels.includes(channel)) {
    return res.status(400).json({
      error: `Invalid channel. Must be one of: ${validChannels.join(', ')}`,
    });
  }

  try {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const entry = {
      channel,
      recipient,
      message,
      priority: priority || 'normal',
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    await redis.set(
      `notif:queue:${channel}:${id}`,
      JSON.stringify(entry),
      'EX',
      86400 // 24h TTL
    );

    // Invalidate cache for this channel
    for (const key of queueCache.keys()) {
      if (key.includes(channel) || key.includes('all')) {
        queueCache.delete(key);
      }
    }

    res.status(201).json({ id, ...entry });
  } catch (err) {
    console.error('[queue] enqueue error:', err.message);
    res.status(500).json({ error: 'Failed to enqueue notification' });
  }
});

module.exports = app;
