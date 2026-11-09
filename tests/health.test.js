const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const redis = require('../utils/redis');
const queueConnection = require('../utils/queueConnection');

beforeAll(async () => {
  await mongoose.connect(process.env.DATABASE_LOCAL);
});

afterAll(async () => {
  await mongoose.disconnect();
  await redis.quit();
  await queueConnection.quit();
});

describe('GET /health', () => {
  it('returns 200 when all services are up', async () => {
    const res = await request(app).get('/health');

    expect(res.statusCode).toBe(200);
    expect(res.body.services).toEqual({
      mongo: true,
      stockRedis: true,
      queueRedis: true,
    });
  });
});