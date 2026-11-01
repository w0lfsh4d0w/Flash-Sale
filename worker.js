const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: './config.env' });
const { Worker } = require('bullmq');
const Booking = require('./models/bookingModel');
const queueConnection = require('./utils/queueConnection');
const redis = require('./utils/redis');
const { expireOneBooking } = require('./utils/expireBooking');
const bookingQueue = require('./utils/bookingQueue');

mongoose
  .connect(process.env.DATABASE_LOCAL, {
    serverSelectionTimeoutMS: 5000,
  })
  .then(async () => {
    console.log('DB connection successful!');

    // Schedule the recurring cleanup job only after a successful DB connection
    await bookingQueue.upsertJobScheduler(
      'expire-bookings-scheduler',
      { every: 30000 },
      { name: 'expire-bookings', data: {} },
    );

    const worker = new Worker(
      'bookings',
      async (job) => {
        // Recurring cleanup of expired reservations
        if (job.name === 'expire-bookings') {
          let booking = await expireOneBooking();
          while (booking) {
            booking = await expireOneBooking();
          }
          return;
        }

        // Single reservation job ('create-booking')
        const { bookingId, userId, eventId, quantity, totalPriceCents } =
          job.data;

        try {
          await Booking.create({
            _id: bookingId,
            userId,
            eventId,
            quantity,
            totalPriceCents,
            status: 'reserved',
            expiresAt: new Date(Date.now() + 5 * 60 * 1000), // test value, back to 5 * 60 * 1000 after testing
          });

          await redis.del(`booking:${bookingId}`);
        } catch (err) {
          if (err.code === 11000) {
            if (err.keyPattern?._id) {
              // Same booking was already saved (retry)
              await redis.del(`booking:${bookingId}`);
              return;
            }
            // Duplicate user + event: give the ticket back
            await redis.hincrby(
              `event:${eventId}`,
              'availableTickets',
              quantity,
            );
            await redis.set(`booking:${bookingId}`, 'failed', 'EX', 3600);
            return;
          }
          // Unknown error: let BullMQ retry
          throw err;
        }
      },
      { connection: queueConnection },
    );

    worker.on('error', (err) => console.error('Worker error:', err.message));

    worker.on('failed', async (job, err) => {
      if (!job || job.name !== 'create-booking') return;

      const maxAttempts = job.opts?.attempts || 1;
      if (job.attemptsMade < maxAttempts) return;

      const { bookingId, eventId, quantity } = job.data;
      if (!eventId || !quantity) return;

      try {
        await redis.hincrby(`event:${eventId}`, 'availableTickets', quantity);
        await redis.set(`booking:${bookingId}`, 'failed', 'EX', 3600);
        console.log(`Booking ${bookingId} marked as FAILED in Redis.`);
      } catch (rollbackErr) {
        console.error('ROLLBACK FAILED:', rollbackErr);
      }
    });

    console.log('Worker is listening on queue: bookings');
  })
  .catch((err) => {
    console.log('DB connection failed:', err.message);
    process.exit(1);
  });