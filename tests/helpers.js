const crypto = require('crypto');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/userModel');
const Booking = require('../models/bookingModel');
const redis = require('../utils/redis');
const queueConnection = require('../utils/queueConnection');

async function connect() {
  await mongoose.connect(process.env.DATABASE_LOCAL);
  // wait for the partial unique index (rule 2) to exist
  await Booking.init();
}

async function disconnect() {
  await mongoose.disconnect();
  await redis.quit();
  await queueConnection.quit();
}

async function createEvent(totalTickets) {
  const res = await request(app)
    .post('/api/v1/events')
    .send({
      name: `test-${Date.now()}-${crypto.randomUUID()}`,
      totalTickets,
      priceCents: 5000,
    });
  if (res.statusCode >= 300) {
    throw new Error(`createEvent failed: ${res.statusCode} ${res.text}`);
  }
  return res.body.data.event._id;
}

// Same trick as the load test: create users directly, sign their tokens.
async function createUsers(count) {
  const run = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const docs = Array.from({ length: count }, (_, i) => ({
    name: `TestUser ${i}`,
    email: `testuser_${run}_${i}@example.com`,
    password: crypto.randomBytes(30).toString('hex'),
  }));
  const users = await User.insertMany(docs);
  return users.map((u) => ({
    id: u._id,
    token: jwt.sign({ id: u._id, email: u.email }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    }),
  }));
}

function book(eventId, token, quantity = 1, key = crypto.randomUUID()) {
  const req = request(app)
    .post(`/api/v1/events/${eventId}/book`)
    .set('idempotency-key', key)
    .send({ quantity });
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
}

async function availableTickets(eventId) {
  return Number(await redis.hget(`event:${eventId}`, 'availableTickets'));
}

async function waitFor(check, { timeout = 10000, interval = 100 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await check()) return true;
    await new Promise((r) => setTimeout(r, interval));
  }
  return false;
}

module.exports = {
  request,
  app,
  Booking,
  connect,
  disconnect,
  createEvent,
  createUsers,
  book,
  availableTickets,
  waitFor,
};
