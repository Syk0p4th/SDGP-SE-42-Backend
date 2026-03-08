/* eslint-disable max-len */
const express = require('express');
// eslint-disable-next-line new-cap
const router = express.Router();

// Import route modules
const authRoutes = require('./authRoutes');
const bookingRoutes = require('./bookingRoutes');
const userRoutes = require('./userRoutes');
const serviceRoutes = require('./serviceRoutes');

// Register route modules
router.use('/auth', authRoutes);
router.use('/bookings', bookingRoutes);
router.use('/users', userRoutes);
router.use('/services', serviceRoutes);

module.exports = router;