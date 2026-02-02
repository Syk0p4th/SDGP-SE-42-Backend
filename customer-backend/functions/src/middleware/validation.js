const { body, validationResult } = require('express-validator');
const { errorResponse } = require('../utils/response');

// ============================================================
// MIDDLEWARE: Check validation results
// ============================================================
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error) => ({
      field: error.path,
      message: error.msg,
    }));

    return errorResponse(res, 'Validation failed', 400, formattedErrors);
  }

  next();
};

// ============================================================
// AUTH VALIDATION
// ============================================================
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
    .withMessage('Password is required'),
];

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
    .withMessage('Phone number is required'),
];

const googleSignInValidationRules = [
  body('idToken')
    .trim()
    .notEmpty()
    .withMessage('Google ID token is required'),
];

// ============================================================
// PASSWORD RESET VALIDATION
// ============================================================
const forgotPasswordValidationRules = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
];

const verifyResetCodeValidationRules = [
  body('oobCode')
    .trim()
    .notEmpty()
    .withMessage('Reset code is required'),
];

const resetPasswordValidationRules = [
  body('oobCode')
    .trim()
    .notEmpty()
    .withMessage('Reset code is required'),
  body('newPassword')
    .trim()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
];

// ============================================================
// EMAIL VERIFICATION VALIDATION
// ============================================================
const verifyEmailValidationRules = [
  body('oobCode')
    .trim()
    .notEmpty()
    .withMessage('Verification code is required'),
];

// ============================================================
// PROFILE VALIDATION
// ============================================================
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
    .withMessage('Bio must be less than 500 characters'),
];

// ============================================================
// ADDRESS VALIDATION
// ============================================================
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
    .withMessage('isDefault must be a boolean'),
];

// ============================================================
// BOOKING VALIDATION
// ============================================================
const createBookingValidationRules = [
  body('serviceId')
    .trim()
    .notEmpty()
    .withMessage('Service ID is required'),
  body('scheduledDate')
    .trim()
    .notEmpty()
    .withMessage('Scheduled date is required')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Date must be in YYYY-MM-DD format'),
  body('scheduledTime')
    .trim()
    .notEmpty()
    .withMessage('Scheduled time is required')
    .matches(/^\d{2}:\d{2}$/)
    .withMessage('Time must be in HH:MM format (24-hour)'),
  body('addressId')
    .trim()
    .notEmpty()
    .withMessage('Address ID is required'),
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes must be under 500 characters'),
];

const cancelBookingValidationRules = [
  body('reason')
    .optional()
    .isLength({ max: 300 })
    .withMessage('Reason must be under 300 characters'),
];
const rescheduleBookingValidationRules = [
  body('scheduledDate')
    .trim()
    .notEmpty()
    .withMessage('New scheduled date is required')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Date must be in YYYY-MM-DD format'),
  body('scheduledTime')
    .trim()
    .notEmpty()
    .withMessage('New scheduled time is required')
    .matches(/^\d{2}:\d{2}$/)
    .withMessage('Time must be in HH:MM format (24-hour)'),
  body('reason')
    .optional()
    .isLength({ max: 300 })
    .withMessage('Reason must be under 300 characters'),
];

// ============================================================
// SINGLE EXPORT — everything in one place
// ============================================================
module.exports = {
  // Auth
  loginValidationRules,
  signupValidationRules,
  googleSignInValidationRules,

  // Password reset
  forgotPasswordValidationRules,
  verifyResetCodeValidationRules,
  resetPasswordValidationRules,

  // Email verification
  verifyEmailValidationRules,

  // Profile
  updateProfileValidationRules,

  // Address
  addressValidationRules,

  // Booking
  createBookingValidationRules,
  cancelBookingValidationRules,
  rescheduleBookingValidationRules,

  // Middleware
  validate,
};
