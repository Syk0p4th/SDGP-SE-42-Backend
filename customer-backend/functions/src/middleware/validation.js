const { body, validationResult } = require('express-validator');
const { errorResponse } = require('../utils/response');

/**
 * Validation rules for login
 */
const loginValidationRules = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .trim()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .notEmpty()
    .withMessage('Password is required')
];

/**
 * Validation rules for signup
 */
const signupValidationRules = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .trim()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('displayName')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long')
    .notEmpty()
    .withMessage('Name is required'),
  body('phoneNumber')
    .trim()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number')
    .notEmpty()
    .withMessage('Phone number is required')
];

/**
 * Middleware to check validation results
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path,
      message: error.msg
    }));
    
    return errorResponse(res, 'Validation failed', 400, formattedErrors);
  }
  
  next();
};

module.exports = {
  loginValidationRules,
  signupValidationRules,
  validate
};

/**
 * Validation rules for forgot password
 */
const forgotPasswordValidationRules = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
];

/**
 * Validation rules for password reset
 */
const resetPasswordValidationRules = [
  body('oobCode')
    .trim()
    .notEmpty()
    .withMessage('Reset code is required'),
  body('newPassword')
    .trim()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

/**
 * Validation rules for verify reset code
 */
const verifyResetCodeValidationRules = [
  body('oobCode')
    .trim()
    .notEmpty()
    .withMessage('Reset code is required')
];

/**
 * Validation rules for email verification
 */
const verifyEmailValidationRules = [
  body('oobCode')
    .trim()
    .notEmpty()
    .withMessage('Verification code is required')
];

/**
 * Validation rules for Google Sign-In
 */
const googleSignInValidationRules = [
  body('idToken')
    .trim()
    .notEmpty()
    .withMessage('Google ID token is required')
];

module.exports = {
  loginValidationRules,
  signupValidationRules,
  forgotPasswordValidationRules,
  resetPasswordValidationRules,
  verifyResetCodeValidationRules,
  verifyEmailValidationRules,
  googleSignInValidationRules,
  validate
};