const express = require('express');
const router = express.Router();
const eventController = require('./../controllers/eventController');

router.post('/', eventController.createEvent);
router.get('/:id', eventController.getEventById);
router.post('/:id/book', eventController.bookEventById);

module.exports = router;