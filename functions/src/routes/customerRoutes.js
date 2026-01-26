const express = require('express');
const router = express.Router();

const customerAuthController = require('../controllers/customer/customerAuthController');
const { verifyToken, isCustomer } = require('../middleware/auth');
const { 
  loginValidationRules, 
  signupValidationRules, 
  validate 
} = require('../middleware/validation');

// Public routes (no authentication required)
router.post(
  '/auth/signin', 
  loginValidationRules, 
  validate, 
  customerAuthController.signIn
);

router.post(
  '/auth/signup', 
  signupValidationRules, 
  validate, 
  customerAuthController.signUp
);

// Protected routes (authentication required)
router.get(
  '/profile', 
  verifyToken, 
  isCustomer, 
  customerAuthController.getProfile
);

router.post(
  '/auth/signout', 
  verifyToken, 
  customerAuthController.signOut
);

module.exports = router;