const mongoose = require('mongoose');
const AppError = require('../utils/appError');
const Event = require('../models/eventModel');
const Booking = require('../models/bookingModel');

const isValidId = (id) =>
  typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);

exports.createEvent = async (req, res) => {
  const { name, totalTickets, priceCents } = req.body;

  if (!name || totalTickets === undefined || priceCents === undefined) {
    throw new AppError('Please provide name, totalTickets, and priceCents', 400);
  }

  if (!Number.isInteger(totalTickets) || totalTickets < 1) {
    throw new AppError('totalTickets must be an integer >= 1', 400);
  }

  if (!Number.isInteger(priceCents) || priceCents < 0) {
    throw new AppError('priceCents must be an integer >= 0', 400);
  }

  const newEvent = await Event.create({
    name,
    totalTickets,
    availableTickets: totalTickets,
    priceCents,
  });

  res.status(201).json({
    status: 'success',
    data: { event: newEvent },
  });
};

exports.getEventById = async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    throw new AppError('Invalid event ID format', 400);
  }

  const event = await Event.findById(id);

  if (!event) {
    throw new AppError('No event found with that ID', 404);
  }

  res.status(200).json({
    status: 'success',
    data: { event },
  });
};


exports.bookEventById = async (req, res) => {
  const { id } = req.params;
  const { userId, quantity } = req.body;

  if (!isValidId(id)) {
    throw new AppError('Invalid event ID format', 400);
  }

  if (!isValidId(userId)) {
    throw new AppError('A valid userId is required', 400);
  }

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 4) {
    throw new AppError('quantity must be an integer from 1 to 4', 400);
  }

  const event = await Event.findById(id);

  if (!event) {
    throw new AppError('No event found with that ID', 404);
  }

  if (event.availableTickets < quantity) {
    throw new AppError('Not enough tickets available', 400);
  }

  event.availableTickets -= quantity;
  await event.save();

  const newBooking = await Booking.create({
    userId,
    eventId: event._id,
    quantity,
    totalPriceCents: quantity * event.priceCents,
  });

  res.status(201).json({
    status: 'success',
    data: { booking: newBooking },
  });
};