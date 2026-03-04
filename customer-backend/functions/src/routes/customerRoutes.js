const express = require('express');
const router = express.Router();

const customerAuthController = require('../controllers/customer/customerAuthController');
const customerBookingController = require('../controllers/customer/customerBookingController');
const customerServiceController = require('../controllers/customer/customerServiceController');
const customerProfileController = require('../controllers/customer/customerProfileController');
const customerVehicleController = require('../controllers/customer/customerVehicleController');
const customerReviewController = require('../controllers/customer/customerReviewController');
const {
  // ... existing imports ...
  createReviewValidationRules,
  updateReviewValidationRules,
} = require('../middleware/validation');
const customerSubscriptionController = require('../controllers/customer/customerSubscriptionController');
const { verifyToken, isCustomer } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const {
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
} = require('../middleware/validation');
const {
  // ... existing imports ...
  createBookingValidationRules,
  cancelBookingValidationRules,
  rescheduleBookingValidationRules,
} = require('../middleware/validation');
const {
  // ... existing imports ...
  addVehicleValidationRules,
  updateVehicleValidationRules,
  subscribeValidationRules,
  cancelSubscriptionValidationRules,
} = require('../middleware/validation');
const customerNotificationController = require('../controllers/customer/customerNotificationController');


// ============ PUBLIC ROUTES (No Authentication) ============

// Basic Authentication
router.post(
  '/auth/signup',
  signupValidationRules,
  validate,
  customerAuthController.signUp
);

router.post(
  '/auth/signin',
  loginValidationRules,
  validate,
  customerAuthController.signIn
);

// Google Sign-In
router.post(
  '/auth/google',
  googleSignInValidationRules,
  validate,
  customerAuthController.googleSignIn
);

// Password Reset Flow
router.post(
  '/auth/forgot-password',
  forgotPasswordValidationRules,
  validate,
  customerAuthController.forgotPassword
);

router.post(
  '/auth/verify-reset-code',
  verifyResetCodeValidationRules,
  validate,
  customerAuthController.verifyPasswordResetCode
);

router.post(
  '/auth/confirm-password-reset',
  resetPasswordValidationRules,
  validate,
  customerAuthController.confirmPasswordReset
);

// Email Verification (public - uses code from email)
router.post(
  '/auth/verify-email',
  verifyEmailValidationRules,
  validate,
  customerAuthController.verifyEmail
);

// ============ PROTECTED ROUTES (Require Authentication) ============

// Token Management
router.post(
  '/auth/refresh-token',
  verifyToken,
  customerAuthController.refreshToken
);
//Bookings accept by provider
router.post('/bookings/:id/accept', verifyToken, customerBookingController.acceptBooking);

router.post(
  '/auth/signout',
  verifyToken,
  customerAuthController.signOut
);

// Email Verification (protected)
router.post(
  '/auth/send-verification-email',
  verifyToken,
  customerAuthController.sendEmailVerification
);

router.get(
  '/auth/check-email-verification',
  verifyToken,
  customerAuthController.checkEmailVerificationStatus
);

// Profile Management
router.get(
  '/profile',
  verifyToken,
  customerAuthController.getProfile
);

router.put(
  '/profile',
  verifyToken,
  updateProfileValidationRules,
  validate,
  customerAuthController.updateProfile
);

router.post(
  '/profile/photo',
  verifyToken,
  upload.single('photo'),
  customerAuthController.uploadProfilePhoto
);

// Address Management
router.get(
  '/addresses',
  verifyToken,
  customerProfileController.getAddresses
);

router.post(
  '/addresses',
  verifyToken,
  addressValidationRules,
  validate,
  customerProfileController.addAddress
);

router.put(
  '/addresses/:addressId',
  verifyToken,
  addressValidationRules,
  validate,
  customerProfileController.updateAddress
);

router.delete(
  '/addresses/:addressId',
  verifyToken,
  customerProfileController.deleteAddress
);

router.patch(
  '/addresses/:addressId/default',
  verifyToken,
  customerProfileController.setDefaultAddress
);

// Token Management
router.post(
  '/auth/refresh-token',
  verifyToken,
  customerAuthController.refreshToken
);

router.post(
  '/auth/signout',
  verifyToken,
  customerAuthController.signOut
);

// Email Verification (protected)
router.post(
  '/auth/send-verification-email',
  verifyToken,
  customerAuthController.sendEmailVerification
);

router.get(
  '/auth/check-email-verification',
  verifyToken,
  customerAuthController.checkEmailVerificationStatus
);

// Profile Management
router.get(
  '/profile',
  verifyToken,
  customerAuthController.getProfile
);

router.put(
  '/profile',
  verifyToken,
  updateProfileValidationRules,
  validate,
  customerAuthController.updateProfile
);

router.post(
  '/profile/photo',
  verifyToken,
  upload.single('photo'),
  customerAuthController.uploadProfilePhoto
);

// Address Management
router.get(
  '/addresses',
  verifyToken,
  customerProfileController.getAddresses
);

router.post(
  '/addresses',
  verifyToken,
  addressValidationRules,
  validate,
  customerProfileController.addAddress
);

router.put(
  '/addresses/:addressId',
  verifyToken,
  addressValidationRules,
  validate,
  customerProfileController.updateAddress
);

router.delete(
  '/addresses/:addressId',
  verifyToken,
  customerProfileController.deleteAddress
);

router.patch(
  '/addresses/:addressId/default',
  verifyToken,
  customerProfileController.setDefaultAddress
);
// ============ VEHICLE MANAGEMENT ROUTES (Require Authentication) ============

// Get all vehicles
router.get(
  '/vehicles',
  verifyToken,
  customerVehicleController.getVehicles
);

// Get vehicle details
router.get(
  '/vehicles/:vehicleId',
  verifyToken,
  customerVehicleController.getVehicleDetails
);

// Add vehicle
router.post(
  '/vehicles',
  verifyToken,
  addVehicleValidationRules,
  validate,
  customerVehicleController.addVehicle
);

// Update vehicle
router.put(
  '/vehicles/:vehicleId',
  verifyToken,
  updateVehicleValidationRules,
  validate,
  customerVehicleController.updateVehicle
);

// Delete vehicle
router.delete(
  '/vehicles/:vehicleId',
  verifyToken,
  customerVehicleController.deleteVehicle
);

// ============ SUBSCRIPTION ROUTES ============

// Get subscription plans (public)
router.get(
  '/subscriptions/plans',
  customerSubscriptionController.getPlans
);

// Get my subscriptions (protected)
router.get(
  '/subscriptions',
  verifyToken,
  customerSubscriptionController.getSubscriptions
);

// Subscribe to plan
router.post(
  '/subscriptions',
  verifyToken,
  subscribeValidationRules,
  validate,
  customerSubscriptionController.subscribe
);

// Cancel subscription
router.patch(
  '/subscriptions/:subscriptionId/cancel',
  verifyToken,
  cancelSubscriptionValidationRules,
  validate,
  customerSubscriptionController.cancelSubscription
);
// ============ NOTIFICATION ROUTES (Require Authentication) ============

// Get my notifications
router.get(
  '/notifications',
  verifyToken,
  customerNotificationController.getNotifications
);

// Mark notification as read
router.patch(
  '/notifications/:notificationId/read',
  verifyToken,
  customerNotificationController.markAsRead
);

// Mark all as read
router.patch(
  '/notifications/read-all',
  verifyToken,
  customerNotificationController.markAllAsRead
);

// Delete notification
router.delete(
  '/notifications/:notificationId',
  verifyToken,
  customerNotificationController.deleteNotification
);

// Update FCM token
router.post(
  '/notifications/fcm-token',
  verifyToken,
  customerNotificationController.updateFcmToken
);



// ============ PUBLIC ROUTES (No Authentication) ============

// Basic Authentication
router.post(
  '/auth/signup',
  signupValidationRules,
  validate,
  customerAuthController.signUp
);

router.post(
  '/auth/signin',
  loginValidationRules,
  validate,
  customerAuthController.signIn
);

// Google Sign-In
router.post(
  '/auth/google',
  googleSignInValidationRules,
  validate,
  customerAuthController.googleSignIn
);

// Password Reset Flow
router.post(
  '/auth/forgot-password',
  forgotPasswordValidationRules,
  validate,
  customerAuthController.forgotPassword
);

router.post(
  '/auth/verify-reset-code',
  verifyResetCodeValidationRules,
  validate,
  customerAuthController.verifyPasswordResetCode
);

router.post(
  '/auth/confirm-password-reset',
  resetPasswordValidationRules,
  validate,
  customerAuthController.confirmPasswordReset
);

// Email Verification (public - uses code from email)
router.post(
  '/auth/verify-email',
  verifyEmailValidationRules,
  validate,
  customerAuthController.verifyEmail
);

// ============ SERVICE BROWSING ROUTES (Public - No Auth) ============

// Get all categories
router.get(
  '/services/categories',
  customerServiceController.getCategories
);

// Get provider public profile
// NOTE: This MUST come before /services/:serviceId
// Otherwise "providers" gets matched as a serviceId
router.get(
  '/services/providers/:providerId',
  customerServiceController.getProviderProfile
);

// Search services by location
// NOTE: This MUST come before /services/:serviceId
// Otherwise "search" gets matched as a serviceId
router.get(
  '/services/search',
  customerServiceController.searchServices
);

// List all services (with filters)
router.get(
  '/services',
  customerServiceController.getServices
);

// Get single service details
router.get(
  '/services/:serviceId',
  customerServiceController.getServiceDetails
);

// ============ BOOKING ROUTES (Require Authentication) ============

// Create booking
router.post(
  '/bookings',
  verifyToken,
  createBookingValidationRules,
  validate,
  customerBookingController.createBooking
);

// Get my bookings
router.get(
  '/bookings',
  verifyToken,
  customerBookingController.getBookings
);

// Get booking details
router.get(
  '/bookings/:bookingId',
  verifyToken,
  customerBookingController.getBookingDetails
);

// Cancel booking
router.patch(
  '/bookings/:bookingId/cancel',
  verifyToken,
  cancelBookingValidationRules,
  validate,
  customerBookingController.cancelBooking
);
// Reschedule booking
router.patch(
  '/bookings/:bookingId/reschedule',
  verifyToken,
  rescheduleBookingValidationRules,
  validate,
  customerBookingController.rescheduleBooking
);

// ============ REVIEW ROUTES ============

// Get provider reviews (public)
router.get(
  '/reviews/provider/:providerId',
  customerReviewController.getProviderReviews
);

// Get my reviews (protected)
router.get(
  '/reviews',
  verifyToken,
  customerReviewController.getMyReviews
);

// Create review
router.post(
  '/reviews',
  verifyToken,
  createReviewValidationRules,
  validate,
  customerReviewController.createReview
);

// Update review
router.put(
  '/reviews/:reviewId',
  verifyToken,
  updateReviewValidationRules,
  validate,
  customerReviewController.updateReview
);

// Delete review
router.delete(
  '/reviews/:reviewId',
  verifyToken,
  customerReviewController.deleteReview
);


module.exports = router;