// Runs once before all tests (plain Node, outside Jest's sandbox):
// 1) cleans the test databases, 2) starts a real worker against them.
const { spawn } = require('child_process');
const path = require('path');
const Redis = require('ioredis');
const mongoose = require('mongoose');
const env = require('./env');

module.exports = async () => {
  for (const url of [env.REDIS_URL, env.QUEUE_REDIS_URL]) {
    // safety: only ever flush Redis database 1
    if (!url.endsWith('/1')) throw new Error(`Refusing to flush ${url}`);
    const client = new Redis(url);
    await client.flushdb();
    await client.quit();
  }

  await mongoose.connect(env.DATABASE_LOCAL);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  const worker = spawn('node', ['worker.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, ...env },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  globalThis.__TEST_WORKER__ = worker;

  // give the worker time to connect and register the expiry job
  await new Promise((resolve) => setTimeout(resolve, 3000));
};
