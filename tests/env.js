// One place for the test environment. Uses a separate Mongo database and
// Redis database number 1, so the real data (database 0) is never touched.
module.exports = {
  NODE_ENV: 'test',
  DATABASE_LOCAL: 'mongodb://localhost:27017/flash-sale-test',
  REDIS_URL: 'redis://localhost:6379/1',
  QUEUE_REDIS_URL: 'redis://localhost:6380/1',
  JWT_SECRET: 'test-secret',
  JWT_EXPIRES_IN: '1h',
  WEBHOOK_SECRET: 'test-webhook-secret',
};
