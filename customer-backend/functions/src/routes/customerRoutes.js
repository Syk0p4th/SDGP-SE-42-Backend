const express = require('express');
const router = express.Router();

const customerAuthController = require('../controllers/customer/customerAuthController');
const customerProfileController = require('../controllers/customer/customerProfileController');
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

module.exports = router;