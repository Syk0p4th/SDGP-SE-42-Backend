/* eslint-disable max-len */
const admin = require('firebase-admin');
const { db } = require('../config/firebase');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { COLLECTIONS, BOOKING_STATUS, ROLES } = require('../utils/constants');
const logger = require('../config/logger');
const notificationService = require('../services/notificationService');

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: safe notification (non-fatal)
// ─────────────────────────────────────────────────────────────────────────────
async function safeNotify(fn, ...args) {
  try {
    await fn(...args);
  } catch (err) {
    logger.warn('Notification failed (non-fatal)', { error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE BOOKING
// POST /bookings
// ─────────────────────────────────────────────────────────────────────────────
exports.createBooking = asyncHandler(async (req, res) => {
  const { serviceId, vehicleId, scheduledAt, addressSnapshot, notes } = req.body;

  if (!serviceId || !scheduledAt) {
    throw new AppError('Service ID and scheduled time are required', 400, 'VALIDATION_ERROR');
  }

  const serviceDoc = await db.collection(COLLECTIONS.SERVICES).doc(serviceId).get();
  if (!serviceDoc.exists) throw new AppError('Service not found', 404, 'SERVICE_NOT_FOUND');

  const serviceData = serviceDoc.data();
  if (!serviceData.isActive) throw new AppError('Service is currently unavailable', 400, 'SERVICE_UNAVAILABLE');

  let vehicleSnapshot = null;
  if (vehicleId) {
    const vehicleDoc = await db
      .collection(COLLECTIONS.USERS)
      .doc(req.user.uid)
      .collection(COLLECTIONS.VEHICLES)
      .doc(vehicleId)
      .get();

    if (vehicleDoc.exists) {
      const v = vehicleDoc.data();
      vehicleSnapshot = { type: v.type, plateNumber: v.plateNumber, nickname: v.nickname };
    }
  }

  let calculatedPrice = serviceData.basePrice;
  if (vehicleSnapshot && serviceData.vehicleTypePricing?.[vehicleSnapshot.type]) {
    calculatedPrice = serviceData.vehicleTypePricing[vehicleSnapshot.type];
  }

  const bookingData = {
    customerId: req.user.uid,
    customerName: req.user.displayName,
    customerEmail: req.user.email,
    customerPhone: req.user.phoneNumber || null,
    serviceId,
    serviceSnapshot: {
      name: serviceData.name,
      durationMin: serviceData.durationMin,
      priceAtBooking: calculatedPrice,
      description: serviceData.description,
    },
    vehicleId: vehicleId || null,
    vehicleSnapshot,
    scheduledAt,
    addressSnapshot: addressSnapshot || null,
    status: BOOKING_STATUS.PENDING,
    assignedStaffId: null,
    assignedStaffName: null,
    notes: notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    cancellationReason: null,
    cancelledBy: null,
  };

  const bookingRef = await db.collection(COLLECTIONS.BOOKINGS).add(bookingData);

  logger.info('Booking created', { bookingId: bookingRef.id, customerId: req.user.uid, serviceId });

  await safeNotify(notificationService.notifyNewBooking, bookingRef.id, bookingData);

  res.status(201).json({
    success: true,
    message: 'Booking created successfully',
    booking: { id: bookingRef.id, ...bookingData },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL BOOKINGS (with filters)
// GET /bookings
// ─────────────────────────────────────────────────────────────────────────────
exports.getBookings = asyncHandler(async (req, res) => {
  const { status, startDate, endDate } = req.query;

  let query = db.collection(COLLECTIONS.BOOKINGS);

  if (req.user.role === ROLES.CUSTOMER) {
    query = query.where('customerId', '==', req.user.uid);
  }
  if (status) query = query.where('status', '==', status);
  if (startDate) query = query.where('scheduledAt', '>=', startDate);
  if (endDate)   query = query.where('scheduledAt', '<=', endDate);

  query = query.orderBy('scheduledAt', 'desc');

  const snapshot = await query.get();
  const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  res.status(200).json({ success: true, count: bookings.length, bookings });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET SINGLE BOOKING
// GET /bookings/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.getBookingById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const bookingDoc = await db.collection(COLLECTIONS.BOOKINGS).doc(id).get();

  if (!bookingDoc.exists) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');

  const bookingData = bookingDoc.data();

  if (req.user.role === ROLES.CUSTOMER && bookingData.customerId !== req.user.uid) {
    throw new AppError('Not authorized to view this booking', 403, 'FORBIDDEN');
  }

  res.status(200).json({ success: true, booking: { id: bookingDoc.id, ...bookingData } });
});

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE BOOKING (customer cancel, staff status update)
// PATCH /bookings/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.updateBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, assignedStaffId, notes, cancellationReason } = req.body;

  const bookingDoc = await db.collection(COLLECTIONS.BOOKINGS).doc(id).get();
  if (!bookingDoc.exists) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');

  const bookingData = bookingDoc.data();
  const updates = { updatedAt: new Date().toISOString() };

  if (req.user.role === ROLES.CUSTOMER) {
    if (bookingData.customerId !== req.user.uid) {
      throw new AppError('Not authorized to update this booking', 403, 'FORBIDDEN');
    }
    if (status && status !== BOOKING_STATUS.CANCELLED) {
      throw new AppError('Customers can only cancel bookings', 400, 'INVALID_OPERATION');
    }
    if (![BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED].includes(bookingData.status)) {
      throw new AppError('Cannot cancel booking in current status', 400, 'INVALID_STATUS');
    }
    updates.status = BOOKING_STATUS.CANCELLED;
    updates.cancellationReason = cancellationReason || 'Cancelled by customer';
    updates.cancelledBy = req.user.uid;
  }

  if ([ROLES.STAFF, ROLES.ADMIN].includes(req.user.role)) {
    if (status) {
      updates.status = status;
      if (status === BOOKING_STATUS.IN_PROGRESS && !bookingData.startedAt) updates.startedAt = new Date().toISOString();
      if (status === BOOKING_STATUS.COMPLETED && !bookingData.completedAt)  updates.completedAt = new Date().toISOString();
      if (status === BOOKING_STATUS.CANCELLED) {
        updates.cancellationReason = cancellationReason || 'Cancelled by staff';
        updates.cancelledBy = req.user.uid;
      }
    }
    if (assignedStaffId !== undefined) {
      updates.assignedStaffId = assignedStaffId;
      if (assignedStaffId) {
        const staffDoc = await db.collection(COLLECTIONS.USERS).doc(assignedStaffId).get();
        if (staffDoc.exists) updates.assignedStaffName = staffDoc.data().displayName;
      } else {
        updates.assignedStaffName = null;
      }
    }
    if (notes !== undefined) updates.notes = notes;
  }

  await db.collection(COLLECTIONS.BOOKINGS).doc(id).update(updates);

  logger.info('Booking updated', { bookingId: id, updates: Object.keys(updates), updatedBy: req.user.uid });

  if (updates.status) {
    await safeNotify(notificationService.notifyBookingStatusChange, id, bookingData.customerId, updates.status);
  }

  res.status(200).json({ success: true, message: 'Booking updated successfully', updates });
});

// ─────────────────────────────────────────────────────────────────────────────
// CANCEL BOOKING
// DELETE /bookings/:id  (or PATCH /bookings/:id/cancel)
// Refunds subscription wash if applicable
// ─────────────────────────────────────────────────────────────────────────────
exports.cancelBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const bookingDoc = await db.collection(COLLECTIONS.BOOKINGS).doc(id).get();
  if (!bookingDoc.exists) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');

  const bookingData = bookingDoc.data();

  // Authorization check
  if (req.user.role === ROLES.CUSTOMER && bookingData.customerId !== req.user.uid) {
    throw new AppError('Not authorized to cancel this booking', 403, 'FORBIDDEN');
  }

  // Only pending or confirmed bookings can be cancelled
  const cancellableStatuses = [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED];
  if (!cancellableStatuses.includes(bookingData.status)) {
    throw new AppError(
      `Cannot cancel a booking with status "${bookingData.status}". Only pending or confirmed bookings can be cancelled.`,
      400,
      'INVALID_STATUS'
    );
  }

  // ── Subscription refund ───────────────────────────────────────────────────
  // If this booking used a subscription wash, refund the deducted wash count
  if (bookingData.paidWithSubscription && bookingData.subscriptionId) {
    try {
      const subDoc = await db.collection('subscriptions').doc(bookingData.subscriptionId).get();

      if (subDoc.exists) {
        const sub = subDoc.data();

        // Only refund if subscription is still active (not expired/cancelled)
        if (sub.status === 'active') {
          await db.collection('subscriptions').doc(bookingData.subscriptionId).update({
            remainingWashes: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          logger.info('Subscription wash refunded on booking cancellation', {
            bookingId: id,
            subscriptionId: bookingData.subscriptionId,
            customerId: bookingData.customerId,
          });
        } else {
          logger.info('Subscription no longer active — no refund issued', {
            bookingId: id,
            subscriptionId: bookingData.subscriptionId,
            subscriptionStatus: sub.status,
          });
        }
      }
    } catch (refundErr) {
      // Non-fatal: log but still cancel the booking
      logger.error('Subscription refund failed (non-fatal)', {
        bookingId: id,
        subscriptionId: bookingData.subscriptionId,
        error: refundErr.message,
      });
    }
  }

  // ── Update booking ────────────────────────────────────────────────────────
  const cancelUpdate = {
    status: BOOKING_STATUS.CANCELLED,
    cancellationReason: reason || 'Cancelled',
    cancelledBy: req.user.uid,
    cancelledAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.collection(COLLECTIONS.BOOKINGS).doc(id).update(cancelUpdate);

  logger.info('Booking cancelled', { bookingId: id, cancelledBy: req.user.uid, reason });

  await safeNotify(notificationService.notifyBookingCancelled, id, bookingData, req.user.uid);

  res.status(200).json({
    success: true,
    message: bookingData.paidWithSubscription
      ? 'Booking cancelled and your subscription wash has been refunded.'
      : 'Booking cancelled successfully.',
    refunded: !!bookingData.paidWithSubscription,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ACCEPT BOOKING (race mode)
// PATCH /bookings/:id/accept
// Body: { preferredTime?: string }  — washer's chosen arrival time e.g. "09:00"
// ─────────────────────────────────────────────────────────────────────────────
exports.acceptBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { preferredTime } = req.body;

  const bookingDoc = await db.collection(COLLECTIONS.BOOKINGS).doc(id).get();
  if (!bookingDoc.exists) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');

  const booking = bookingDoc.data();

  // Race mode: only the first washer to accept wins
  if (booking.status !== BOOKING_STATUS.PENDING) {
    throw new AppError(
      booking.status === BOOKING_STATUS.CONFIRMED
        ? 'Another washer already accepted this job.'
        : `Cannot accept a booking with status "${booking.status}".`,
      409,
      'RACE_LOST'
    );
  }

  // Verify washer profile
  const providerDoc = await db.collection('providers').doc(req.user.uid).get();
  if (!providerDoc.exists) throw new AppError('Provider profile not found', 404, 'PROVIDER_NOT_FOUND');

  const provider = providerDoc.data();
  if (!provider.isVerified) {
    throw new AppError('Your account is not yet verified by admin.', 403, 'NOT_VERIFIED');
  }

  // Determine arrival time
  const arrivalTime = preferredTime || booking.scheduledTime || booking.scheduledAt;
  const timeAdjusted = !!(preferredTime && preferredTime !== (booking.scheduledTime || booking.scheduledAt));

  const updatedStatusHistory = [
    ...(booking.statusHistory || []),
    {
      status: BOOKING_STATUS.CONFIRMED,
      updatedAt: new Date().toISOString(),
      updatedBy: 'provider',
      providerId: req.user.uid,
    },
  ];

  await db.collection(COLLECTIONS.BOOKINGS).doc(id).update({
    status: BOOKING_STATUS.CONFIRMED,
    providerId: req.user.uid,
    provider: {
      displayName: provider.displayName || '',
      photoURL: provider.photoURL || null,
      rating: provider.rating || 0,
      phone: provider.phone || null,
    },
    washerPreferredTime: arrivalTime,
    timeAdjusted,
    statusHistory: updatedStatusHistory,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.info('Booking accepted', {
    bookingId: id,
    providerId: req.user.uid,
    arrivalTime,
    timeAdjusted,
  });

  const updatedDoc = await db.collection(COLLECTIONS.BOOKINGS).doc(id).get();
  const updatedBooking = { id: updatedDoc.id, ...updatedDoc.data() };

  await safeNotify(notificationService.notifyBookingConfirmed, updatedBooking);

  res.status(200).json({
    success: true,
    message: timeAdjusted
      ? `Booking accepted. Customer notified of your arrival at ${arrivalTime}.`
      : 'Booking accepted successfully.',
    booking: updatedBooking,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DECLINE BOOKING (race mode — does NOT lock the booking)
// PATCH /bookings/:id/decline
// Logs the rejection so this washer won't see it again, but other washers
// can still accept it.
// ─────────────────────────────────────────────────────────────────────────────
exports.declineBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const bookingDoc = await db.collection(COLLECTIONS.BOOKINGS).doc(id).get();
  if (!bookingDoc.exists) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');

  const booking = bookingDoc.data();

  // Can only decline pending bookings
  if (booking.status !== BOOKING_STATUS.PENDING) {
    throw new AppError('Can only decline pending bookings', 400, 'INVALID_STATUS');
  }

  // Log the rejection without touching the booking's status
  // This preserves race mode — other washers can still accept
  await db.collection('booking_rejections').add({
    bookingId: id,
    providerId: req.user.uid,
    reason: reason || 'Not available',
    rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.info('Booking declined by washer (race mode — booking still open)', {
    bookingId: id,
    washerId: req.user.uid,
    reason,
  });

  res.status(200).json({
    success: true,
    message: 'Job skipped.',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// START SERVICE
// PATCH /bookings/:id/start
// ─────────────────────────────────────────────────────────────────────────────
exports.startService = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const bookingDoc = await db.collection(COLLECTIONS.BOOKINGS).doc(id).get();
  if (!bookingDoc.exists) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');

  const booking = bookingDoc.data();

  if (booking.providerId !== req.user.uid) {
    throw new AppError('Not authorized to start this booking', 403, 'FORBIDDEN');
  }

  if (booking.status !== BOOKING_STATUS.CONFIRMED) {
    throw new AppError(
      `Cannot start service. Current status: "${booking.status}".`,
      400,
      'INVALID_STATUS'
    );
  }

  const updatedStatusHistory = [
    ...(booking.statusHistory || []),
    { status: BOOKING_STATUS.IN_PROGRESS, updatedAt: new Date().toISOString(), updatedBy: 'provider' },
  ];

  await db.collection(COLLECTIONS.BOOKINGS).doc(id).update({
    status: BOOKING_STATUS.IN_PROGRESS,
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
    statusHistory: updatedStatusHistory,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.info('Service started', { bookingId: id, providerId: req.user.uid });

  const updatedDoc = await db.collection(COLLECTIONS.BOOKINGS).doc(id).get();
  await safeNotify(notificationService.notifyServiceStarted, { id: updatedDoc.id, ...updatedDoc.data() });

  res.status(200).json({ success: true, message: 'Service started. Customer notified.' });
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETE SERVICE
// PATCH /bookings/:id/complete
// Updates provider earnings and total bookings count
// ─────────────────────────────────────────────────────────────────────────────
exports.completeService = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const bookingDoc = await db.collection(COLLECTIONS.BOOKINGS).doc(id).get();
  if (!bookingDoc.exists) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');

  const booking = bookingDoc.data();

  if (booking.providerId !== req.user.uid) {
    throw new AppError('Not authorized to complete this booking', 403, 'FORBIDDEN');
  }

  if (booking.status !== BOOKING_STATUS.IN_PROGRESS) {
    throw new AppError(
      `Cannot complete service. Current status: "${booking.status}".`,
      400,
      'INVALID_STATUS'
    );
  }

  const updatedStatusHistory = [
    ...(booking.statusHistory || []),
    { status: BOOKING_STATUS.COMPLETED, updatedAt: new Date().toISOString(), updatedBy: 'provider' },
  ];

  // ── Mark booking complete ─────────────────────────────────────────────────
  await db.collection(COLLECTIONS.BOOKINGS).doc(id).update({
    status: BOOKING_STATUS.COMPLETED,
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    statusHistory: updatedStatusHistory,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // ── Update provider stats + earnings ─────────────────────────────────────
  const earningsAmount = booking.totalPrice || booking.serviceSnapshot?.priceAtBooking || 0;

  const providerUpdate = {
    totalBookings: admin.firestore.FieldValue.increment(1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // If paid (not a free subscription job), update earnings
  if (!booking.paidWithSubscription && earningsAmount > 0) {
    providerUpdate.totalEarnings = admin.firestore.FieldValue.increment(earningsAmount);
  }

  await db.collection('providers').doc(req.user.uid).update(providerUpdate);

  // ── Also write to a dedicated earnings ledger ─────────────────────────────
  if (!booking.paidWithSubscription && earningsAmount > 0) {
    const earningsRef = db.collection('provider_earnings').doc(req.user.uid);
    const earningsDoc = await earningsRef.get();

    if (earningsDoc.exists) {
      await earningsRef.update({
        totalEarnings: admin.firestore.FieldValue.increment(earningsAmount),
        completedJobs: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      await earningsRef.set({
        providerId: req.user.uid,
        totalEarnings: earningsAmount,
        completedJobs: 1,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  logger.info('Service completed', {
    bookingId: id,
    providerId: req.user.uid,
    earnings: earningsAmount,
    paidWithSubscription: booking.paidWithSubscription,
  });

  const updatedDoc = await db.collection(COLLECTIONS.BOOKINGS).doc(id).get();
  await safeNotify(notificationService.notifyServiceCompleted, { id: updatedDoc.id, ...updatedDoc.data() });

  res.status(200).json({
    success: true,
    message: 'Service completed. Earnings updated.',
    earned: booking.paidWithSubscription ? 0 : earningsAmount,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING STATS (admin/staff only)
// GET /bookings/stats
// ─────────────────────────────────────────────────────────────────────────────
exports.getBookingStats = asyncHandler(async (req, res) => {
  const bookingsRef = db.collection(COLLECTIONS.BOOKINGS);

  const [pendingSnap, confirmedSnap, inProgressSnap, completedSnap, cancelledSnap] = await Promise.all([
    bookingsRef.where('status', '==', BOOKING_STATUS.PENDING).get(),
    bookingsRef.where('status', '==', BOOKING_STATUS.CONFIRMED).get(),
    bookingsRef.where('status', '==', BOOKING_STATUS.IN_PROGRESS).get(),
    bookingsRef.where('status', '==', BOOKING_STATUS.COMPLETED).get(),
    bookingsRef.where('status', '==', BOOKING_STATUS.CANCELLED).get(),
  ]);

  const stats = {
    pending:    pendingSnap.size,
    confirmed:  confirmedSnap.size,
    inProgress: inProgressSnap.size,
    completed:  completedSnap.size,
    cancelled:  cancelledSnap.size,
  };

  stats.total = Object.values(stats).reduce((a, b) => a + b, 0);

  res.status(200).json({ success: true, stats });
});