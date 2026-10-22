const mongoose = require('mongoose');

const isInt = {
  validator: Number.isInteger,
  message: '{PATH} must be an integer',
};

const bookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A booking must belong to a user'],
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'A booking must belong to an event'],
    },
    quantity: {
      type: Number,
      required: [true, 'A booking must have a quantity'],
      min: [1, 'You can book at least 1 ticket'],
      max: [4, 'You can book at most 4 tickets'],
      validate: isInt,
    },
    totalPriceCents: {
      type: Number,
      required: [true, 'A booking must have a total price'],
      min: [0, 'Total price cannot be negative'],
      validate: isInt,
    },
    status: {
      type: String,
      enum: ['reserved', 'confirmed', 'expired', 'cancelled'],
      default: 'confirmed',
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

bookingSchema.index({ userId: 1 });
bookingSchema.index({ eventId: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
