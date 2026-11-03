const mongoose = require('mongoose');
const AppError = require('../utils/appError');
const redis = require('./../utils/redis');
const Booking = require('../models/bookingModel');
const isValidId = (id) =>
  typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);

exports.getBookingById = async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    throw new AppError('Invalid booking ID format', 400);
  }

  const state = await redis.get(`booking:${id}`);

  if (state) {
    return res.status(200).json({
      status: 'success',
      data: {
        bookingId: id,
        bookingState: state,
      },
    });
  }

  const booking = await Booking.findOne({ _id: id, userId: req.user.id }).lean();

  if (booking) {
    return res.status(200).json({
      status: 'success',
      data: {
        booking,
      },
    });
  }

  throw new AppError('No booking found with that ID', 404);
};

exports.payBooking = async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) throw new AppError('Invalid booking ID format', 400);
  // atomic update
  const booking = await Booking.findOneAndUpdate(
    {
      _id: id,
      userId: req.user.id,
      status: 'reserved',
      expiresAt: { $gt: new Date() },
    },
    {
      status: 'confirmed',
      expiresAt: null,
    },
    {
      returnDocument: 'after',
    },
  );

  if (!booking) {
    throw new AppError('Reservation has expired or cannot be confirmed', 409);
  }

  res.status(200).json({
    status: 'success',
    data: {
      booking,
    },
  });
};
exports.handlePaymentWebhook = async (req, res) => {
  if (req.headers['x-webhook-secret'] !== process.env.WEBHOOK_SECRET) {
    throw new AppError('Invalid signature', 401);
  }
  const { bookingId, status, paymentIntentId } = req.body;

  if (!paymentIntentId) {
    return res
      .status(400)
      .json({ status: 'fail', message: 'Missing paymentIntentId' });
  }
  //Idempotency
  const isNewEvent = await redis.set(
    `webhook:${paymentIntentId}`,
    'processed',
    'EX',
    86400,
    'NX',
  );

  if (!isNewEvent) {
    return res.status(200).json({
      received: true,
      message: 'Event already processed (Idempotent response)',
    });
  }

  if (status !== 'payment_success') {
    return res.status(200).json({
      received: true,
      message: 'Payment status is not successful',
    });
  }

  const booking = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      status: 'reserved',
      expiresAt: { $gt: new Date() },
    },
    {
      status: 'confirmed',
      expiresAt: null,
    },
    { returnDocument: 'after' },
  );

  if (!booking) {
    return res.status(200).json({
      received: true,
      message: 'Booking not found, expired, or already confirmed',
    });
  }

  res.status(200).json({
    received: true,
    data: {
      bookingId: booking._id,
      status: booking.status,
    },
  });
};
