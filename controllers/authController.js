const User = require('./../models/userModel');
const mongoose = require('mongoose');
const AppError = require('../utils/appError');
const jwt  = require('jsonwebtoken')
const isValidId = (id) =>
  typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);

exports.signup = async (req, res) => {
  const { name, email, password } = req.body;
  let user = await User.findOne({ email });
  if (user) throw new AppError('this user is already exist !', 400);
  user = await User.create({
    name,
    email,
    password,
  });
  user.password = undefined;
  const token = user.generateAuthToken();
  res.status(201).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError('Please provide email and password!', 400);
  }
  const  user = await User.findOne({ email }).select('+password');

  if (!user) throw new AppError('invalid email or password !', 400);
  if (!await user.matchPassword(password))
    throw new AppError('invalid email or password !', 400);

  user.password = undefined;
  const token = user.generateAuthToken();
  res.status(200).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.protect = async (req,res,next) => 
{
  
  if (
     !req.headers.authorization || 
     !req.headers.authorization.startsWith('Bearer')
  )
  {
    throw new AppError('You must have auth header ', 401);

  }
  const token = req.headers.authorization.split(' ')[1];
  let decoded;
try {
  decoded = jwt.verify(token, process.env.JWT_SECRET);
} catch (err) {
  throw new AppError('Invalid or expired token', 401);
}

   const currentUser = await User.findById(decoded.id);

   if (!currentUser) {
     return next(
       new AppError(
         'The user belonging to this token no longer does exist.',
         401,
       ),
     );
   }

   req.user = currentUser;
   next();


}
