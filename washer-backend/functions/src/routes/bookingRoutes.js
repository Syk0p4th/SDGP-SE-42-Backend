const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { authenticate } = require('../middleware/auth');

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.post('/',       authenticate, bookingController.createBooking);
router.get('/',        authenticate, bookingController.getBookings);
router.get('/stats',   authenticate, bookingController.getBookingStats);
router.get('/:id',     authenticate, bookingController.getBookingById);
router.patch('/:id',   authenticate, bookingController.updateBooking);
router.delete('/:id',  authenticate, bookingController.cancelBooking);

// ── Status transitions ────────────────────────────────────────────────────────
router.patch('/:id/accept',   authenticate, bookingController.acceptBooking);
router.patch('/:id/decline',  authenticate, bookingController.declineBooking);
router.patch('/:id/arrive',   authenticate, bookingController.arriveBooking);
router.patch('/:id/start',    authenticate, bookingController.startService);
router.patch('/:id/complete', authenticate, bookingController.completeService);

// ── Customer cancel (alternative explicit route) ──────────────────────────────
router.patch('/:id/cancel',   authenticate, bookingController.cancelBooking);

module.exports = router;