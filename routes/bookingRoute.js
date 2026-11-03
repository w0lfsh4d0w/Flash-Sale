const express = require('express');
const router = express.Router();
const bookingController = require('./../controllers/bookingController');
const authController = require('./../controllers/authController');
router.get('/:id', authController.protect,bookingController.getBookingById);
router.post('/:id/pay',authController.protect,bookingController.payBooking);

// webhoook 

router.post('/webhook',bookingController.handlePaymentWebhook)
module.exports = router;
