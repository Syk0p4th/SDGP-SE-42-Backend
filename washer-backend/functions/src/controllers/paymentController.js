/* eslint-disable max-len */
const { db } = require('../config/firebase');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { COLLECTIONS, PAYMENT_STATUS } = require('../utils/constants');
const logger = require('../config/logger');

/**
 * Create payment record
 * POST /payments
 */
exports.createPayment = asyncHandler(async (req, res) => {
  const { bookingId, amount, method, currency } = req.body;

  if (!bookingId || !amount || !method) {
    throw new AppError('Booking ID, amount, and method are required', 400, 'VALIDATION_ERROR');
  }

  // Verify booking exists and belongs to user (or user is staff/admin)
  const bookingDoc = await db.collection(COLLECTIONS.BOOKINGS).doc(bookingId).get();

  if (!bookingDoc.exists) {
    throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
  }

  const bookingData = bookingDoc.data();

  // Check authorization
  if (req.user.role === 'customer' && bookingData.customerId !== req.user.uid) {
    throw new AppError('Not authorized for this booking', 403, 'FORBIDDEN');
  }

  const paymentData = {
    bookingId,
    customerId: bookingData.customerId,
    amount,
    currency: currency || 'LKR',
    method,
    status: PAYMENT_STATUS.SUCCEEDED, // For MVP, cash/card on delivery is immediate
    providerRef: null,
    createdAt: new Date().toISOString(),
    processedBy: req.user.uid
  };

  const paymentRef = await db.collection(COLLECTIONS.PAYMENTS).add(paymentData);

  logger.info('Payment recorded', {
    paymentId: paymentRef.id,
    bookingId,
    amount,
    method
  });

  res.status(201).json({
    success: true,
    message: 'Payment recorded successfully',
    payment: {
      id: paymentRef.id,
      ...paymentData
    }
  });
});

/**
 * Get payments for a booking
 * GET /payments/booking/:bookingId
 */
exports.getPaymentsByBooking = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  // Verify booking access
  const bookingDoc = await db.collection(COLLECTIONS.BOOKINGS).doc(bookingId).get();

  if (!bookingDoc.exists) {
    throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
  }

  const bookingData = bookingDoc.data();

  if (req.user.role === 'customer' && bookingData.customerId !== req.user.uid) {
    throw new AppError('Not authorized to view these payments', 403, 'FORBIDDEN');
  }

  const snapshot = await db
    .collection(COLLECTIONS.PAYMENTS)
    .where('bookingId', '==', bookingId)
    .get();

  const payments = [];
  snapshot.forEach((doc) => {
    payments.push({
      id: doc.id,
      ...doc.data()
    });
  });

  res.status(200).json({
    success: true,
    count: payments.length,
    payments
  });
});

/**
 * Get payment by ID
 * GET /payments/:id
 */
exports.getPaymentById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const paymentDoc = await db.collection(COLLECTIONS.PAYMENTS).doc(id).get();

  if (!paymentDoc.exists) {
    throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
  }

  const paymentData = paymentDoc.data();

  // Check authorization
  if (req.user.role === 'customer' && paymentData.customerId !== req.user.uid) {
    throw new AppError('Not authorized to view this payment', 403, 'FORBIDDEN');
  }

  res.status(200).json({
    success: true,
    payment: {
      id: paymentDoc.id,
      ...paymentData
    }
  });
});

/**
 * Get all payments (admin/staff only)
 * GET /payments
 */
exports.getAllPayments = asyncHandler(async (req, res) => {
  const { status, method, startDate, endDate } = req.query;

  let query = db.collection(COLLECTIONS.PAYMENTS);

  if (status) {
    query = query.where('status', '==', status);
  }

  if (method) {
    query = query.where('method', '==', method);
  }

  if (startDate) {
    query = query.where('createdAt', '>=', startDate);
  }

  if (endDate) {
    query = query.where('createdAt', '<=', endDate);
  }

  query = query.orderBy('createdAt', 'desc');

  const snapshot = await query.get();

  const payments = [];
  snapshot.forEach((doc) => {
    payments.push({
      id: doc.id,
      ...doc.data()
    });
  });

  res.status(200).json({
    success: true,
    count: payments.length,
    payments
  });
});
