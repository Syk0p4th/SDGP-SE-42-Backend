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

/**
 * Validation rules for update profile
 */
const updateProfileValidationRules = [
  body('displayName')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Display name must be at least 2 characters'),
  body('phoneNumber')
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Invalid phone number format'),
  body('bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bio must be less than 500 characters')
];

/**
 * Validation rules for add/update address
 */
const addressValidationRules = [
  body('label')
    .trim()
    .notEmpty()
    .withMessage('Address label is required')
    .isLength({ max: 50 })
    .withMessage('Label must be less than 50 characters'),
  body('addressLine1')
    .trim()
    .notEmpty()
    .withMessage('Address line 1 is required')
    .isLength({ max: 200 })
    .withMessage('Address line 1 must be less than 200 characters'),
  body('addressLine2')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Address line 2 must be less than 200 characters'),
  body('city')
    .trim()
    .notEmpty()
    .withMessage('City is required')
    .isLength({ max: 100 })
    .withMessage('City must be less than 100 characters'),
  body('state')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('State must be less than 100 characters'),
  body('postalCode')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Postal code must be less than 20 characters'),
  body('country')
    .trim()
    .notEmpty()
    .withMessage('Country is required')
    .isLength({ max: 100 })
    .withMessage('Country must be less than 100 characters'),
  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),
  body('isDefault')
    .optional()
    .isBoolean()
    .withMessage('isDefault must be a boolean')
];

// Export all validation rules
module.exports = {
  loginValidationRules,
  signupValidationRules,
  forgotPasswordValidationRules,
  resetPasswordValidationRules,
  verifyResetCodeValidationRules,
  verifyEmailValidationRules,
  googleSignInValidationRules,
  updateProfileValidationRules,
  addressValidationRules,
  validate
};