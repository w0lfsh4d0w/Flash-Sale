const express = require('express');
const os = require('os');
const morgan = require('morgan');
const mongoose = require('mongoose');
const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const eventRouter = require('./routes/eventRoute');
const bookingRouter = require('./routes/bookingRoute');
const authRouter = require('./routes/authRoute');
const redis = require('./utils/redis');
const queueConnection = require('./utils/queueConnection');

const app = express();

// 1) GLOBAL MIDDLEWARES
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(express.json({ limit: '10kb' }));

// 2) ROUTES (each endpoint gets added here)
app.get('/health', async (req, res) => {
  const healthDetails = {
    mongo: false,
    stockRedis: false,
    queueRedis: false,
  };

  // 1) Check MongoDB
  healthDetails.mongo = mongoose.connection.readyState === 1;

  // 2) Check Stock Redis Connection
  try {
    const stockReply = await redis.ping();
    healthDetails.stockRedis = stockReply === 'PONG';
  } catch (err) {
    healthDetails.stockRedis = false;
  }

  // 3) Check Queue Redis Connection
  try {
    const queueReply = await queueConnection.ping();
    healthDetails.queueRedis = queueReply === 'PONG';
  } catch (err) {
    healthDetails.queueRedis = false;
  }

  // Check overall system health
  const isHealthy =
    healthDetails.mongo &&
    healthDetails.stockRedis &&
    healthDetails.queueRedis;

  const statusCode = isHealthy ? 200 : 503;

  return res.status(statusCode).json({
    status: isHealthy ? 'success' : 'error',
    instance: os.hostname(),
    message: isHealthy
      ? 'Server and all services are healthy'
      : 'One or more services are degraded/down',
    timestamp: new Date().toISOString(),
    services: healthDetails,
  });
});

app.use('/api/v1/events', eventRouter);
app.use('/api/v1/bookings', bookingRouter);
app.use('/api/v1/auth', authRouter);

// 3) 404 for any route that doesn't exist
app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;