/* eslint-disable max-len */
const express = require('express');
// eslint-disable-next-line new-cap
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, isAdmin } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and management
 */

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Washer routes
router.post('/washer/register', authController.registerWasher);
router.post('/washer/login', authController.loginWasher);

// Protected routes (require authentication)
router.get('/profile', authenticate, authController.getProfile);
router.patch('/profile', authenticate, authController.updateProfile);
router.post('/update-login', authenticate, authController.updateLastLogin);

// Admin-only routes
router.post('/create-staff', authenticate, isAdmin, authController.createStaff);
router.post('/disable/:uid', authenticate, isAdmin, authController.disableUser);
router.post('/enable/:uid', authenticate, isAdmin, authController.enableUser);

module.exports = router;
