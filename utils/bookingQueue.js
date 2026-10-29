const { Queue } = require('bullmq');
const queueConnection = require('./queueConnection');
const bookingQueue = new Queue('bookings', {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  },
});

module.exports = bookingQueue;
