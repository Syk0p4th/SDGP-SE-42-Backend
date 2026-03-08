const express = require('express');
const router = express.Router();

const customerAuthController = require('../controllers/customer/customerAuthController');
const customerBookingController = require('../controllers/customer/customerBookingController');
const customerServiceController = require('../controllers/customer/customerServiceController');
const customerProfileController = require('../controllers/customer/customerProfileController');
const customerVehicleController = require('../controllers/customer/customerVehicleController');
const customerReviewController = require('../controllers/customer/customerReviewController');
const customerSubscriptionController = require('../controllers/customer/customerSubscriptionController');
const customerNotificationController = require('../controllers/customer/customerNotificationController');
const customerPaymentController = require('../controllers/customer/customerPaymentController'); // NEW
const { verifyToken } = require('../middleware/auth');
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
  createBookingValidationRules,
  cancelBookingValidationRules,
  rescheduleBookingValidationRules,
  addVehicleValidationRules,
  updateVehicleValidationRules,
  subscribeValidationRules,
  cancelSubscriptionValidationRules,
  createReviewValidationRules,
  updateReviewValidationRules,
  validate,
} = require('../middleware/validation');

// ─── PayHere notify (NO auth — called by PayHere server) ─────────────────────
router.post('/payments/notify', customerPaymentController.paymentNotify);
router.post('/subscriptions/payment-notify', customerSubscriptionController.subscriptionPaymentNotify);

// ============ PUBLIC ROUTES ============

router.post('/auth/signup', signupValidationRules, validate, customerAuthController.signUp);
router.post('/auth/signin', loginValidationRules, validate, customerAuthController.signIn);
router.post('/auth/google', googleSignInValidationRules, validate, customerAuthController.googleSignIn);
router.post('/auth/forgot-password', forgotPasswordValidationRules, validate, customerAuthController.forgotPassword);
router.post('/auth/verify-reset-code', verifyResetCodeValidationRules, validate, customerAuthController.verifyPasswordResetCode);
router.post('/auth/confirm-password-reset', resetPasswordValidationRules, validate, customerAuthController.confirmPasswordReset);
router.post('/auth/verify-email', verifyEmailValidationRules, validate, customerAuthController.verifyEmail);



// ─── Internal/Cron endpoints (NO auth — called by internal services) ──────────
router.post('/subscriptions/expire-check', customerSubscriptionController.expireSubscriptions);

// ============ PROTECTED ROUTES ============

router.post('/auth/refresh-token', verifyToken, customerAuthController.refreshToken);
router.post('/auth/signout', verifyToken, customerAuthController.signOut);
router.post('/auth/send-verification-email', verifyToken, customerAuthController.sendEmailVerification);
router.get('/auth/check-email-verification', verifyToken, customerAuthController.checkEmailVerificationStatus);

// Profile
router.get('/profile', verifyToken, customerAuthController.getProfile);
router.put('/profile', verifyToken, updateProfileValidationRules, validate, customerAuthController.updateProfile);
router.post('/profile/photo', verifyToken, upload.single('photo'), customerAuthController.uploadProfilePhoto);

// Addresses
router.get('/addresses', verifyToken, customerProfileController.getAddresses);
router.post('/addresses', verifyToken, addressValidationRules, validate, customerProfileController.addAddress);
router.put('/addresses/:addressId', verifyToken, addressValidationRules, validate, customerProfileController.updateAddress);
router.delete('/addresses/:addressId', verifyToken, customerProfileController.deleteAddress);
router.patch('/addresses/:addressId/default', verifyToken, customerProfileController.setDefaultAddress);

// Vehicles
router.get('/vehicles', verifyToken, customerVehicleController.getVehicles);
router.get('/vehicles/:vehicleId', verifyToken, customerVehicleController.getVehicleDetails);
router.post('/vehicles', verifyToken, addVehicleValidationRules, validate, customerVehicleController.addVehicle);
router.put('/vehicles/:vehicleId', verifyToken, updateVehicleValidationRules, validate, customerVehicleController.updateVehicle);
router.delete('/vehicles/:vehicleId', verifyToken, customerVehicleController.deleteVehicle);

// Subscriptions
router.get('/subscriptions/plans', customerSubscriptionController.getPlans);
router.get('/subscriptions', verifyToken, customerSubscriptionController.getSubscriptions);
router.post('/subscriptions', verifyToken, subscribeValidationRules, validate, customerSubscriptionController.initiateSubscription);
router.patch('/subscriptions/:subscriptionId/cancel', verifyToken, cancelSubscriptionValidationRules, validate, customerSubscriptionController.cancelSubscription);

// Notifications
router.get('/notifications', verifyToken, customerNotificationController.getNotifications);
router.patch('/notifications/:notificationId/read', verifyToken, customerNotificationController.markAsRead);
router.patch('/notifications/read-all', verifyToken, customerNotificationController.markAllAsRead);
router.delete('/notifications/:notificationId', verifyToken, customerNotificationController.deleteNotification);
router.post('/notifications/fcm-token', verifyToken, customerNotificationController.updateFcmToken);

// Services (public)
router.get('/services/categories', customerServiceController.getCategories);
router.get('/services/providers/:providerId', customerServiceController.getProviderProfile);
router.get('/services/search', customerServiceController.searchServices);
router.get('/services', customerServiceController.getServices);
router.get('/services/:serviceId', customerServiceController.getServiceDetails);

// Bookings
router.post('/bookings', verifyToken, createBookingValidationRules, validate, customerBookingController.createBooking);
router.post('/bookings/:id/accept', verifyToken, customerBookingController.acceptBooking);
router.get('/bookings', verifyToken, customerBookingController.getBookings);
router.get('/bookings/:bookingId', verifyToken, customerBookingController.getBookingDetails);
router.patch('/bookings/:bookingId/cancel', verifyToken, cancelBookingValidationRules, validate, customerBookingController.cancelBooking);
router.patch('/bookings/:bookingId/reschedule', verifyToken, rescheduleBookingValidationRules, validate, customerBookingController.rescheduleBooking);

// ─── Payment routes ───────────────────────────────────────────────────────────
router.post('/payments/hash', verifyToken, customerPaymentController.generatePaymentHash);
router.get('/payments/status/:bookingId', verifyToken, customerPaymentController.getPaymentStatus);
router.post('/subscriptions/initiate', verifyToken, customerSubscriptionController.initiateSubscription);

// Reviews
router.get('/reviews/provider/:providerId', customerReviewController.getProviderReviews);
router.get('/reviews', verifyToken, customerReviewController.getMyReviews);
router.post('/reviews', verifyToken, createReviewValidationRules, validate, customerReviewController.createReview);
router.put('/reviews/:reviewId', verifyToken, updateReviewValidationRules, validate, customerReviewController.updateReview);
router.delete('/reviews/:reviewId', verifyToken, customerReviewController.deleteReview);

module.exports = router;