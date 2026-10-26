const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL);

redis.on('error', (err) => {
  console.error('Redis error:', err.message);
});

module.exports = redis;