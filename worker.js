const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: './config.env' });
const { Worker } = require('bullmq');
const Booking = require('./models/bookingModel');
const queueConnection = require('./utils/queueConnection');
const redis = require('./utils/redis');

mongoose
  .connect(process.env.DATABASE_LOCAL, {
    serverSelectionTimeoutMS: 2000,
  })
  .then(() => console.log('DB connection successful!'))
  .catch((err) => console.log('DB initial connection failed:', err.message));

const worker = new Worker(
  'bookings',
  async (job) => {
    const { bookingId, userId, eventId, quantity, totalPriceCents } = job.data;

    try {
      await Booking.create({
        _id: bookingId,
        userId,
        eventId,
        quantity,
        totalPriceCents,
      });

      await redis.del(`booking:${bookingId}`);
    } catch (err) {
      if (err.code === 11000) {
        await redis.del(`booking:${bookingId}`);
        return;
      }
      throw err;
    }
  },
  { connection: queueConnection },
);

worker.on('failed', async (job, err) => {
  if (!job) return;

  const maxAttempts = job.opts?.attempts || 1;
  if (job.attemptsMade < maxAttempts) return;

  const { bookingId, eventId, quantity } = job.data;

  try {
    await redis.hincrby(`event:${eventId}`, 'availableTickets', quantity);

    await redis.set(`booking:${bookingId}`, 'failed', 'EX', 3600);
    console.log(`Booking ${bookingId} marked as FAILED in Redis.`);
  } catch (rollbackErr) {
    console.error('ROLLBACK FAILED:', rollbackErr);
  }
});

console.log('Worker is listening on queue: bookings');
