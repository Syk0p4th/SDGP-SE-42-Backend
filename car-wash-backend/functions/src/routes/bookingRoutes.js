/* eslint-disable max-len */
const express = require('express');
// eslint-disable-next-line new-cap
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { authenticate, isStaff } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Bookings
 *   description: Booking management
 */

// All booking routes require authentication
router.use(authenticate);

// Get booking statistics (staff/admin only)
router.get('/stats', isStaff, bookingController.getBookingStats);

// CRUD operations
router.post('/', bookingController.createBooking);
router.get('/', bookingController.getBookings);
router.get('/:id', bookingController.getBookingById);
router.patch('/:id', bookingController.updateBooking);
router.delete('/:id', bookingController.cancelBooking);

module.exports = router;
