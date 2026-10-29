const express = require('express');
const morgan = require('morgan');
const mongoose = require('mongoose');
const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const eventRouter = require('./routes/eventRoute');
const bookingRouter = require('./routes/bookingRoute');
const app = express();

// 1) GLOBAL MIDDLEWARES
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(express.json({ limit: '10kb' }));

// 2) ROUTES (each endpoint gets added here)
app.get('/health', (req, res) => {
  isDbConnected = mongoose.connection.readyState === 1;
  if (isDbConnected) {
    return res.status(200).json({
      status: 'success',
      message: 'Server is healthy and DB is connected',
    });
  }
  return res.status(503).json({
    status: 'erro',
    message: 'DB is disconnected',
  });
});
app.use('/api/v1/events', eventRouter);
app.use('/api/v1/bookings', bookingRouter);
// 3) 404 for any route that doesn't exist
app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
