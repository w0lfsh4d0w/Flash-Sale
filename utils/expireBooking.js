const Booking = require('../models/bookingModel');
const redis = require('./redis');

exports.expireOneBooking = async () => {
  const booking = await Booking.findOneAndUpdate(
    { status: 'reserved', expiresAt: { $lte: new Date() } },
    { status: 'expired' },
    { returnDocument: 'after' },
  );

  if (!booking) return null;

  await redis.hincrby(
    `event:${booking.eventId}`,
    'availableTickets',
    booking.quantity,
  );

  return booking;
};