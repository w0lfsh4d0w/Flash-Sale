const mongoose = require('mongoose');
const validator = require('validator');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A user must have a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'A user must have an email'],
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, 'Please provide a valid email'],
    },
    passwordHash: {
      type: String,
      required: [true, 'A user must have a password hash'],
      select: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);