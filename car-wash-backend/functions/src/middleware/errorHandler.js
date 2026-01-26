/* eslint-disable max-len */
const logger = require('../config/logger');
const { captureException } = require('../config/sentry');

/**
 * Custom error class for application errors
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Centralized error handler middleware
 * Should be the last middleware in the chain
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.stack = err.stack;

  // Log error
  logger.error('Error Handler:', {
    message: error.message,
    statusCode: error.statusCode || 500,
    code: error.code,
    stack: error.stack,
    url: req.url,
    method: req.method,
    requestId: req.id
  });

  // Capture error in Sentry if it's not operational
  if (!error.isOperational || (error.statusCode && error.statusCode >= 500)) {
    captureException(err, {
      requestId: req.id,
      url: req.url,
      method: req.method,
      userId: req.user?.uid
    });
  }

  // Firebase specific errors
  if (err.code && err.code.startsWith('auth/')) {
    error = handleFirebaseAuthError(err);
  }

  // Mongoose/Firestore validation errors
  if (err.name === 'ValidationError') {
    error = handleValidationError(err);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token', 401, 'INVALID_TOKEN');
  }

  if (err.name === 'TokenExpiredError') {
    error = new AppError('Token expired', 401, 'TOKEN_EXPIRED');
  }

  // Default to 500 server error
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code: error.code || 'INTERNAL_ERROR',
      ...(process.env.NODE_ENV === 'development' && {
        stack: error.stack,
        details: error
      })
    },
    requestId: req.id
  });
};

/**
 * Handle Firebase Auth errors
 * @param {Error} err - Firebase error
 * @return {AppError} Formatted app error
 */
function handleFirebaseAuthError(err) {
  const { code, message } = err;

  const errorMap = {
    'auth/user-not-found': new AppError('User not found', 404, 'USER_NOT_FOUND'),
    'auth/wrong-password': new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS'),
    'auth/email-already-exists': new AppError('Email already in use', 400, 'EMAIL_IN_USE'),
    'auth/invalid-email': new AppError('Invalid email address', 400, 'INVALID_EMAIL'),
    'auth/weak-password': new AppError('Password is too weak', 400, 'WEAK_PASSWORD'),
    'auth/too-many-requests': new AppError('Too many requests, try again later', 429, 'TOO_MANY_REQUESTS'),
    'auth/id-token-expired': new AppError('Token expired', 401, 'TOKEN_EXPIRED'),
    'auth/id-token-revoked': new AppError('Token revoked', 401, 'TOKEN_REVOKED'),
    'auth/invalid-id-token': new AppError('Invalid token', 401, 'INVALID_TOKEN')
  };

  return errorMap[code] || new AppError(message, 500, 'AUTH_ERROR');
}

/**
 * Handle validation errors
 * @param {Error} err - Validation error
 * @return {AppError} Formatted app error
 */
function handleValidationError(err) {
  const errors = Object.values(err.errors || {}).map((e) => e.message);
  const message = `Invalid input data: ${errors.join(', ')}`;
  return new AppError(message, 400, 'VALIDATION_ERROR');
}

/**
 * Handle 404 Not Found
 */
const notFound = (req, res, next) => {
  const error = new AppError(
    `Route not found: ${req.originalUrl}`,
    404,
    'NOT_FOUND'
  );
  next(error);
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  AppError,
  errorHandler,
  notFound,
  asyncHandler
};
