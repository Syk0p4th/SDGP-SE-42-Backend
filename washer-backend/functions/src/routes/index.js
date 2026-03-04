const express = require('express');
const router = express.Router();

// Import controllers
const authController = require('../controllers/authController');
const bookingController = require('../controllers/bookingController');
const certificationController = require('../controllers/certificationController');
const earningsController = require('../controllers/earningsController');

// Import middleware
const { verifyToken } = require('../middleware/auth');

// ============ AUTH ROUTES ============
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.get('/auth/profile', verifyToken, authController.getProfile);
router.put('/auth/profile', verifyToken, authController.updateProfile);

// ============ BOOKING ROUTES ============
router.get('/bookings', verifyToken, bookingController.getBookings);
router.get('/bookings/:id', verifyToken, bookingController.getBookingById);
router.patch('/bookings/:id/accept', verifyToken, bookingController.acceptBooking);
router.patch('/bookings/:id/reject', verifyToken, bookingController.rejectBooking);
router.patch('/bookings/:id/start', verifyToken, bookingController.startService);
router.patch('/bookings/:id/complete', verifyToken, bookingController.completeService);

// ============ CERTIFICATION ROUTES ============
router.get('/certification/progress', verifyToken, certificationController.getProgress);
router.get('/certification/training-centers', verifyToken, certificationController.getTrainingCenters);
router.post('/certification/evaluate', verifyToken, certificationController.submitEvaluation);

// ============ EARNINGS ROUTES ============
router.get('/earnings', verifyToken, earningsController.getEarnings);
router.get('/earnings/range', verifyToken, earningsController.getEarningsByDateRange);

module.exports = router;