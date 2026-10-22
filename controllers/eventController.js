const AppError = require('../utils/appError');
const Event = require('../models/eventModel');

exports.createEvent = async (req, res) => {
  const { name, totalTickets, priceCents } = req.body;

  const newEvent = await Event.create({
    name,
    totalTickets,
    availableTickets: totalTickets,
    priceCents,
  });

  res.status(201).json({
    status: 'success',
    data: {
      event: newEvent,
    },
  });
};

exports.getEventById = async (req, res) => {
  const event = await Event.findById(req.params.id);

  if (!event) {
    throw new AppError('No event found with that ID', 404);
  }

  res.status(200).json({
    status: 'success',
    data: {
      event,
    },
  });
};