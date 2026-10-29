const Redis = require('ioredis');

const redis = new Redis(process.env.QUEUE_REDIS_URL, {
  maxRetriesPerRequest: null,
});

redis.on('error', (err) => {
  console.error('Queue redis error:', err.message);
});

module.exports = redis;
