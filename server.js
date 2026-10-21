const mongoose = require('mongoose');
const dotenv = require('dotenv');

process.on('uncaughtException', (err) => {
  console.log(err.name, err.message);
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  process.exit(1);
});

dotenv.config({ path: './config.env' });
const app = require('./app');

const port = process.env.PORT || 3000;
let server;

mongoose
  .connect(process.env.DATABASE_LOCAL)
  .then(() => {
    console.log('DB connection successful!');
    server = app.listen(port, () => {
      console.log(`App running on port ${port}...`);
    });
  })
  .catch((err) => {
    console.log('DB connection failed:', err.message);
    process.exit(1);
  });

process.on('unhandledRejection', (err) => {
  console.log(err.name, err.message);
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});