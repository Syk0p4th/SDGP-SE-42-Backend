/* eslint-disable max-len */
const express = require('express');
// eslint-disable-next-line new-cap
const router = express.Router();

// Import route modules
const authRoutes = require('./authRoutes');
const bookingRoutes = require('./bookingRoutes');
const userRoutes = require('./userRoutes');
const serviceRoutes = require('./serviceRoutes');
const certificationRoutes = require('./certificationRoutes'); // ← ADD



// Register route modules
router.use('/auth', authRoutes);
router.use('/bookings', bookingRoutes);
router.use('/users', userRoutes);
router.use('/services', serviceRoutes);

//Booking routes
router.patch('/bookings/:bookingId/start',    authenticate, bookingController.startBooking);
router.patch('/bookings/:bookingId/complete', authenticate, bookingController.completeBooking);

router.use('/certification', certificationRoutes);            // ← ADD
module.exports = router;