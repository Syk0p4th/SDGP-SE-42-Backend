const express = require('express');
const router = express.Router();

const customerAuthController = require('../controllers/customer/customerAuthController');
const { verifyToken, isCustomer } = require('../middleware/auth');
const { 
  loginValidationRules, 
  signupValidationRules, 
  forgotPasswordValidationRules,
  resetPasswordValidationRules,
  verifyResetCodeValidationRules,
  verifyEmailValidationRules,
  googleSignInValidationRules,
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

// ============ PROTECTED ROUTES (Authentication Required) ============

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

// Email Verification
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

// Profile
router.get(
  '/profile', 
  verifyToken, 
  isCustomer, 
  customerAuthController.getProfile
);

module.exports = router;