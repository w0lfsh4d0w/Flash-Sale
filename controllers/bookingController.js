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

  const booking = await Booking.findById(id).lean();

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
