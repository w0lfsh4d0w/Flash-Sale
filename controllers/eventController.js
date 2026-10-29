const mongoose = require('mongoose');
const AppError = require('../utils/appError');
const redis = require('./../utils/redis');
const Event = require('../models/eventModel');
const Booking = require('../models/bookingModel');
const RESERVE_SCRIPT = require('../utils/reserveScript');
const bookingQueue = require('../utils/bookingQueue');

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

  // (4.1 set booking in queue

  // Make id
  const bookingId = new mongoose.Types.ObjectId();
  // add job to queu

  try {
    await bookingQueue.add('create-booking', {
      bookingId: bookingId.toString(),
      userId,
      eventId: id,
      quantity,
      totalPriceCents: quantity * priceCents,
    });
    await redis.set(`booking:${bookingId}`, 'processing', 'EX', 3600);
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

  // edit response
  // 5) Respond only after everything succeeded
  res.status(202).json({
    status: 'processing',
    data: { bookingId },
  });
};
