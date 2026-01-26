const { errorResponse } = require('./response');

/**
 * Handle Firebase Auth errors
 */
const handleAuthError = (error) => {
  const errorMessages = {
    'auth/user-not-found': 'No user found with this email',
    'auth/wrong-password': 'Incorrect password',
    'auth/invalid-email': 'Invalid email address',
    'auth/user-disabled': 'This account has been disabled',
    'auth/too-many-requests': 'Too many failed login attempts. Please try again later',
    'auth/email-already-exists': 'Email already in use',
    'auth/invalid-password': 'Password must be at least 6 characters',
    'auth/weak-password': 'Password is too weak',
    'auth/invalid-credential': 'Invalid email or password'
  };

  return {
    message: errorMessages[error.code] || error.message || 'Authentication failed',
    code: error.code
  };
};

/**
 * Global error handler middleware
 */
const globalErrorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Handle Firebase Auth errors
  if (err.code && err.code.startsWith('auth/')) {
    const { message } = handleAuthError(err);
    return errorResponse(res, message, 401);
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    return errorResponse(res, 'Validation failed', 400, err.details);
  }

  // Default error
  return errorResponse(res, err.message || 'Internal server error', err.statusCode || 500);
};

module.exports = {
  handleAuthError,
  globalErrorHandler
};