/* eslint-disable max-len */
const { body, param, validationResult } = require('express-validator');
const { AppError } = require('./errorHandler');

/**
 * Middleware to handle validation results
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((err) => err.msg).join(', ');
    throw new AppError(`Validation failed: ${errorMessages}`, 400, 'VALIDATION_ERROR');
  }

  next();
};

/**
 * User registration validation
 */
const validateRegister = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('displayName').notEmpty().withMessage('Display name is required'),
  body('phoneNumber').optional().isMobilePhone().withMessage('Valid phone number required'),
  validate
];

/**
 * Login validation
 */
const validateLogin = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate
];

/**
 * Booking creation validation
 */
const validateCreateBooking = [
  body('serviceId').notEmpty().withMessage('Service ID is required'),
  body('scheduledAt').isISO8601().withMessage('Valid scheduled time is required'),
  body('vehicleId').optional().isString(),
  body('addressSnapshot').optional().isObject(),
  body('notes').optional().isString(),
  validate
];

/**
 * Service creation validation
 */
const validateCreateService = [
  body('name').notEmpty().withMessage('Service name is required'),
  body('description').optional().isString(),
  body('basePrice').isNumeric().withMessage('Valid base price is required'),
  body('durationMin').isInt({ min: 1 }).withMessage('Valid duration is required'),
  body('category').optional().isString(),
  body('images').optional().isArray(),
  body('vehicleTypePricing').optional().isObject(),
  validate
];

/**
 * Vehicle creation validation
 */
const validateCreateVehicle = [
  body('type').isIn(['car', 'suv', 'van', 'bike']).withMessage('Valid vehicle type is required'),
  body('plateNumber').notEmpty().withMessage('Plate number is required'),
  body('nickname').optional().isString(),
  body('isDefault').optional().isBoolean(),
  validate
];

/**
 * Payment creation validation
 */
const validateCreatePayment = [
  body('bookingId').notEmpty().withMessage('Booking ID is required'),
  body('amount').isNumeric().withMessage('Valid amount is required'),
  body('method').isIn(['cash', 'card']).withMessage('Valid payment method is required'),
  body('currency').optional().isString(),
  validate
];

/**
 * ID parameter validation
 */
const validateId = [
  param('id').notEmpty().withMessage('ID is required'),
  validate
];

/**
 * UID parameter validation
 */
const validateUid = [
  param('uid').notEmpty().withMessage('UID is required'),
  validate
];

module.exports = {
  validate,
  validateRegister,
  validateLogin,
  validateCreateBooking,
  validateCreateService,
  validateCreateVehicle,
  validateCreatePayment,
  validateId,
  validateUid
};
