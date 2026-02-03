/* eslint-disable max-len */
const { db } = require('../config/firebase');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { COLLECTIONS, BOOKING_STATUS, ROLES } = require('../utils/constants');
const logger = require('../config/logger');
const notificationService = require('../services/notificationService');

/**
 * Create a new booking
 * POST /bookings
 */
exports.createBooking = asyncHandler(async (req, res) => {
  const { serviceId, vehicleId, scheduledAt, addressSnapshot, notes } = req.body;

  // Validate required fields
  if (!serviceId || !scheduledAt) {
    throw new AppError('Service ID and scheduled time are required', 400, 'VALIDATION_ERROR');
  }

  // Get service details
  const serviceDoc = await db.collection(COLLECTIONS.SERVICES).doc(serviceId).get();

  if (!serviceDoc.exists) {
    throw new AppError('Service not found', 404, 'SERVICE_NOT_FOUND');
  }

  const serviceData = serviceDoc.data();

  if (!serviceData.isActive) {
    throw new AppError('Service is currently unavailable', 400, 'SERVICE_UNAVAILABLE');
  }

  // Get vehicle details if provided
  let vehicleSnapshot = null;
  if (vehicleId) {
    const vehicleDoc = await db
      .collection(COLLECTIONS.USERS)
      .doc(req.user.uid)
      .collection(COLLECTIONS.VEHICLES)
      .doc(vehicleId)
      .get();

    if (vehicleDoc.exists) {
      const vehicleData = vehicleDoc.data();
      vehicleSnapshot = {
        type: vehicleData.type,
        plateNumber: vehicleData.plateNumber,
        nickname: vehicleData.nickname
      };
    }
  }

  // Calculate price based on vehicle type if pricing exists
  let calculatedPrice = serviceData.basePrice;
  if (vehicleSnapshot && serviceData.vehicleTypePricing && serviceData.vehicleTypePricing[vehicleSnapshot.type]) {
    calculatedPrice = serviceData.vehicleTypePricing[vehicleSnapshot.type];
  }

  // Create booking
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
      description: serviceData.description
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
    cancelledBy: null
  };

  const bookingRef = await db.collection(COLLECTIONS.BOOKINGS).add(bookingData);

  logger.info('Booking created', {
    bookingId: bookingRef.id,
    customerId: req.user.uid,
    serviceId
  });

  // Notify admins/staff about new booking
  await notificationService.notifyNewBooking(bookingRef.id, bookingData);

  res.status(201).json({
    success: true,
    message: 'Booking created successfully',
    booking: {
      id: bookingRef.id,
      ...bookingData
    }
  });
});

/**
 * Get all bookings (with filters)
 * GET /bookings
 */
exports.getBookings = asyncHandler(async (req, res) => {
  const { status, startDate, endDate } = req.query;

  let query = db.collection(COLLECTIONS.BOOKINGS);

  // Filter by customer ID if not admin/staff
  if (req.user.role === ROLES.CUSTOMER) {
    query = query.where('customerId', '==', req.user.uid);
  }

  // Apply status filter
  if (status) {
    query = query.where('status', '==', status);
  }

  // Apply date range filters
  if (startDate) {
    query = query.where('scheduledAt', '>=', startDate);
  }
  if (endDate) {
    query = query.where('scheduledAt', '<=', endDate);
  }

  // Order by scheduled time
  query = query.orderBy('scheduledAt', 'desc');

  const snapshot = await query.get();

  const bookings = [];
  snapshot.forEach((doc) => {
    bookings.push({
      id: doc.id,
      ...doc.data()
    });
  });

  res.status(200).json({
    success: true,
    count: bookings.length,
    bookings
  });
});

/**
 * Get single booking by ID
 * GET /bookings/:id
 */
exports.getBookingById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const bookingDoc = await db.collection(COLLECTIONS.BOOKINGS).doc(id).get();

  if (!bookingDoc.exists) {
    throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
  }

  const bookingData = bookingDoc.data();

  // Customers can only view their own bookings
  if (req.user.role === ROLES.CUSTOMER && bookingData.customerId !== req.user.uid) {
    throw new AppError('Not authorized to view this booking', 403, 'FORBIDDEN');
  }

  res.status(200).json({
    success: true,
    booking: {
      id: bookingDoc.id,
      ...bookingData
    }
  });
});

/**
 * Update booking (customers can cancel, staff can update status)
 * PATCH /bookings/:id
 */
exports.updateBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, assignedStaffId, notes, cancellationReason } = req.body;

  const bookingDoc = await db.collection(COLLECTIONS.BOOKINGS).doc(id).get();

  if (!bookingDoc.exists) {
    throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
  }

  const bookingData = bookingDoc.data();

  const updates = {
    updatedAt: new Date().toISOString()
  };

  // Customers can only cancel their own pending/confirmed bookings
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

  // Staff/Admin can update status and assign staff
  if ([ROLES.STAFF, ROLES.ADMIN].includes(req.user.role)) {
    if (status) {
      updates.status = status;

      if (status === BOOKING_STATUS.IN_PROGRESS && !bookingData.startedAt) {
        updates.startedAt = new Date().toISOString();
      }

      if (status === BOOKING_STATUS.COMPLETED && !bookingData.completedAt) {
        updates.completedAt = new Date().toISOString();
      }

      if (status === BOOKING_STATUS.CANCELLED) {
        updates.cancellationReason = cancellationReason || 'Cancelled by staff';
        updates.cancelledBy = req.user.uid;
      }
    }

    if (assignedStaffId !== undefined) {
      updates.assignedStaffId = assignedStaffId;

      // Get staff name
      if (assignedStaffId) {
        const staffDoc = await db.collection(COLLECTIONS.USERS).doc(assignedStaffId).get();
        if (staffDoc.exists) {
          updates.assignedStaffName = staffDoc.data().displayName;
        }
      } else {
        updates.assignedStaffName = null;
      }
    }

    if (notes !== undefined) {
      updates.notes = notes;
    }
  }

  await db.collection(COLLECTIONS.BOOKINGS).doc(id).update(updates);

  logger.info('Booking updated', {
    bookingId: id,
    updates: Object.keys(updates),
    updatedBy: req.user.uid
  });

  // Notify customer of status changes
  if (updates.status) {
    await notificationService.notifyBookingStatusChange(
      id,
      bookingData.customerId,
      updates.status
    );
  }

  res.status(200).json({
    success: true,
    message: 'Booking updated successfully',
    updates
  });
});

/**
 * Cancel booking
 * DELETE /bookings/:id
 */
exports.cancelBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const bookingDoc = await db.collection(COLLECTIONS.BOOKINGS).doc(id).get();

  if (!bookingDoc.exists) {
    throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
  }

  const bookingData = bookingDoc.data();

  // Check authorization
  if (req.user.role === ROLES.CUSTOMER && bookingData.customerId !== req.user.uid) {
    throw new AppError('Not authorized to cancel this booking', 403, 'FORBIDDEN');
  }

  // Check if booking can be cancelled
  if (![BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED].includes(bookingData.status)) {
    throw new AppError('Cannot cancel booking in current status', 400, 'INVALID_STATUS');
  }

  await db.collection(COLLECTIONS.BOOKINGS).doc(id).update({
    status: BOOKING_STATUS.CANCELLED,
    cancellationReason: reason || 'Cancelled',
    cancelledBy: req.user.uid,
    updatedAt: new Date().toISOString()
  });

  logger.info('Booking cancelled', {
    bookingId: id,
    cancelledBy: req.user.uid,
    reason
  });

  // Notify relevant parties
  await notificationService.notifyBookingCancelled(id, bookingData, req.user.uid);

  res.status(200).json({
    success: true,
    message: 'Booking cancelled successfully'
  });
});

/**
 * Get booking statistics (admin/staff only)
 * GET /bookings/stats
 */
exports.getBookingStats = asyncHandler(async (req, res) => {
  const bookingsRef = db.collection(COLLECTIONS.BOOKINGS);

  const [pendingSnapshot, confirmedSnapshot, completedSnapshot, cancelledSnapshot] = await Promise.all([
    bookingsRef.where('status', '==', BOOKING_STATUS.PENDING).get(),
    bookingsRef.where('status', '==', BOOKING_STATUS.CONFIRMED).get(),
    bookingsRef.where('status', '==', BOOKING_STATUS.COMPLETED).get(),
    bookingsRef.where('status', '==', BOOKING_STATUS.CANCELLED).get()
  ]);

  const stats = {
    total: 0,
    pending: pendingSnapshot.size,
    confirmed: confirmedSnapshot.size,
    inProgress: 0,
    completed: completedSnapshot.size,
    cancelled: cancelledSnapshot.size
  };

  stats.total = stats.pending + stats.confirmed + stats.inProgress + stats.completed + stats.cancelled;

  res.status(200).json({
    success: true,
    stats
  });
});

/**
 * Washer accepts a wash request
 * POST /bookings/:id/accept
 */
exports.acceptWash = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const bookingDoc = await db.collection(COLLECTIONS.BOOKINGS).doc(id).get();

  if (!bookingDoc.exists) {
    throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
  }

  const bookingData = bookingDoc.data();

  // Check if booking is in pending status
  if (bookingData.status !== BOOKING_STATUS.PENDING) {
    throw new AppError('Can only accept pending bookings', 400, 'INVALID_STATUS');
  }

  // Check if booking already has an assigned washer
  if (bookingData.assignedStaffId && bookingData.assignedStaffId !== req.user.uid) {
    throw new AppError('This booking is already assigned to another washer', 400, 'ALREADY_ASSIGNED');
  }

  const updates = {
    status: BOOKING_STATUS.ACCEPTED,
    assignedStaffId: req.user.uid,
    assignedStaffName: req.user.displayName,
    acceptedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await db.collection(COLLECTIONS.BOOKINGS).doc(id).update(updates);

  logger.info('Wash request accepted', {
    bookingId: id,
    washerId: req.user.uid
  });

  // Notify customer that washer accepted
  await notificationService.notifyBookingAccepted(
    id,
    bookingData.customerId,
    req.user.displayName
  );

  res.status(200).json({
    success: true,
    message: 'Wash request accepted successfully',
    booking: {
      id,
      ...bookingData,
      ...updates
    }
  });
});

/**
 * Washer declines a wash request
 * POST /bookings/:id/decline
 */
exports.declineWash = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const bookingDoc = await db.collection(COLLECTIONS.BOOKINGS).doc(id).get();

  if (!bookingDoc.exists) {
    throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
  }

  const bookingData = bookingDoc.data();

  // Check if booking is in pending status
  if (bookingData.status !== BOOKING_STATUS.PENDING) {
    throw new AppError('Can only decline pending bookings', 400, 'INVALID_STATUS');
  }

  // If washer was assigned, they can decline
  // If not assigned, this washer is declining the request offered to them
  const updates = {
    status: BOOKING_STATUS.DECLINED,
    declinedBy: req.user.uid,
    declinedByName: req.user.displayName,
    declineReason: reason || null,
    declinedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await db.collection(COLLECTIONS.BOOKINGS).doc(id).update(updates);

  logger.info('Wash request declined', {
    bookingId: id,
    washerId: req.user.uid,
    reason
  });

  // Notify customer that washer declined
  await notificationService.notifyBookingDeclined(
    id,
    bookingData.customerId,
    reason
  );

  res.status(200).json({
    success: true,
    message: 'Wash request declined',
    booking: {
      id,
      ...bookingData,
      ...updates
    }
  });
});

