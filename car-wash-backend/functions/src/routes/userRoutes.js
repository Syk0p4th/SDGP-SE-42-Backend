/* eslint-disable max-len */
const express = require('express');
// eslint-disable-next-line new-cap
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, isStaff } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management
 */

// All routes require authentication
router.use(authenticate);

// User management (staff/admin only)
router.get('/', isStaff, userController.getAllUsers);
router.get('/:uid', isStaff, userController.getUserById);

// Vehicle management
router.get('/:uid/vehicles', userController.getUserVehicles);
router.post('/:uid/vehicles', userController.addVehicle);
router.patch('/:uid/vehicles/:vehicleId', userController.updateVehicle);
router.delete('/:uid/vehicles/:vehicleId', userController.deleteVehicle);

// Notifications
router.get('/:uid/notifications', userController.getUserNotifications);
router.patch('/:uid/notifications/:notificationId', userController.markNotificationRead);

module.exports = router;
