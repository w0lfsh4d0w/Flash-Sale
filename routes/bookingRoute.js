const express = require('express');
const router = express.Router();
const bookingController = require('./../controllers/bookingController');
router.get('/:id',bookingController.getBookingById);

module.exports = router;
