const mongoose = require('mongoose');

const isInt = {
  validator: Number.isInteger,
  message: '{PATH} must be an integer',
};

const eventSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'An event must have a name'],
      trim: true,
    },
    totalTickets: {
      type: Number,
      required: [true, 'An event must have total tickets'],
      min: [1, 'Total tickets must be at least 1'],
      validate: isInt,
    },
    availableTickets: {
      type: Number,
      required: [true, 'An event must have available tickets'],
      min: [0, 'Available tickets cannot be negative'],
      validate: [
        isInt,
        {
          validator: function (value) {
            return value <= this.totalTickets;
          },
          message: 'Available tickets cannot exceed total tickets',
        },
      ],
    },
    priceCents: {
      type: Number,
      required: [true, 'An event must have a price'],
      min: [0, 'Price cannot be negative'],
      validate: isInt,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Event', eventSchema);