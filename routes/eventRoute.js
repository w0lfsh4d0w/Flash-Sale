const express = require('express');
const router = express.Router();
const eventController = require('./../controllers/eventController');
const authController = require('./../controllers/authController');
router.post('/', eventController.createEvent);
router.get('/:id', eventController.getEventById);
router.post(
  '/:id/book',
  authController.protect,
  authController.ratelimit,
  eventController.bookEventById,
);

module.exports = router;
