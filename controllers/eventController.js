const mongoose = require('mongoose');
const AppError = require('../utils/appError');
const redis = require('./../utils/redis');
const Event = require('../models/eventModel');
const Booking = require('../models/bookingModel');
const RESERVE_SCRIPT = require('../utils/reserveScript');

const isValidId = (id) =>
  typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);

exports.createEvent = async (req, res) => {
  const { name, totalTickets, priceCents } = req.body;

  if (!name || totalTickets === undefined || priceCents === undefined) {
    throw new AppError(
      'Please provide name, totalTickets, and priceCents',
      400,
    );
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
  await redis.hset(`event:${newEvent._id}`, {
    totalTickets: newEvent.totalTickets,
    availableTickets: newEvent.availableTickets,
    priceCents: newEvent.priceCents,
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
  const event = await Event.findById(id).lean();

  if (!event) {
    throw new AppError('No event found with that ID', 404);
  }
  const availableRedis = await redis.hget(`event:${id}`, 'availableTickets');

  if (availableRedis !== null) event.availableTickets = Number(availableRedis);
  res.status(200).json({
    status: 'success',
    data: { event },
  });
};

exports.bookEventById = async (req, res) => {
  const { id } = req.params;
  const { userId, quantity } = req.body;

  // 1) Validate everything before touching the database
  if (!isValidId(id)) {
    throw new AppError('Invalid event ID format', 400);
  }

  if (!isValidId(userId)) {
    throw new AppError('A valid userId is required', 400);
  }

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 4) {
    throw new AppError('quantity must be an integer from 1 to 4', 400);
  }

  // 2) Atomic check + decrement in a single operation
  // const updatedEvent = await Event.findOneAndUpdate(
  //   { _id: id, availableTickets: { $gte: quantity } },
  //   { $inc: { availableTickets: -quantity } },
  //   { returnDocument: 'after' },
  // );

  // 3) atomic with redis
  const [status, priceCents] = await redis.eval(
    RESERVE_SCRIPT,
    1,
    `event:${id}`,
    quantity,
  );

  // 3) Failure path: tell "not found" apart from "sold out"
  if (status === -1) throw new AppError('No event found with that ID', 404);

  if (status === 0) throw new AppError('Not enough tickets available!', 400);

  // 4) Create the booking; if it fails, give the tickets back
  let newBooking;
  try {
    newBooking = await Booking.create({
      userId,
      eventId: id,
      quantity,
      totalPriceCents: quantity * priceCents,
    });
  } catch (err) {
    try {
      await redis.hincrby(`event:${id}`, 'availableTickets', quantity);
    } catch (rollbackErr) {
      console.error(
        'ROLLBACK FAILED, tickets lost:',
        id,
        quantity,
        rollbackErr,
      );
    }
    throw err;
  }

  // 5) Respond only after everything succeeded
  res.status(201).json({
    status: 'success',
    data: { booking: newBooking },
  });
};
