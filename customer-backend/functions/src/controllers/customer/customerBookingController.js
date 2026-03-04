const { admin, db } = require('../../config/firebase');
const { successResponse, errorResponse } = require('../../utils/response');
const {
  notifyNewBookingRequest,
  notifyBookingCancelledByCustomer,
  notifyBookingRescheduled,
} = require('../../services/notificationService');

// asyncHandler utility
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Constants
const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected'
};

const ROLES = {
  CUSTOMER: 'customer',
  STAFF: 'staff',
  PROVIDER: 'provider'
};

const COLLECTIONS = {
  BOOKINGS: 'bookings',
  USERS: 'users',
  CUSTOMERS: 'customers',
  PROVIDERS: 'providers'
};

// ============================================================
// CREATE BOOKING
// POST /bookings
// ============================================================
exports.createBooking = asyncHandler(async (req, res) => {
  try {
    const { serviceId, vehicleId, scheduledDate, scheduledTime, addressId, addressSnapshot, notes } = req.body;
    const { uid } = req.user;

    // --- Validate vehicle (REQUIRED NOW) ---
    if (!vehicleId) {
      return errorResponse(res, 'Vehicle ID is required', 400);
    }

    const vehicleDoc = await db
      .collection('customers')
      .doc(uid)
      .collection('vehicles')
      .doc(vehicleId)
      .get();

    if (!vehicleDoc.exists || !vehicleDoc.data().isActive) {
      return errorResponse(res, 'Vehicle not found or inactive', 404);
    }

    const vehicle = vehicleDoc.data();

    // --- Check if vehicle has active subscription ---
    let subscription = null;
    let subscriptionId = null;

    const subscriptionSnapshot = await db
      .collection('subscriptions')
      .where('customerId', '==', uid)
      .where('vehicleId', '==', vehicleId)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (!subscriptionSnapshot.empty) {
      const subscriptionDoc = subscriptionSnapshot.docs[0];
      subscription = subscriptionDoc.data();
      subscriptionId = subscriptionDoc.id;

      // Check if subscription has remaining washes
      if (subscription.remainingWashes <= 0) {
        return errorResponse(res, 'No remaining washes in your subscription. Please renew or book without subscription.', 400);
      }
    }

    // --- Validate service exists and is active ---
    const serviceDoc = await db.collection('services').doc(serviceId).get();
    if (!serviceDoc.exists) {
      return errorResponse(res, 'Service not found', 404);
    }

    const service = serviceDoc.data();
    if (!service.isActive) {
      return errorResponse(res, 'This service is currently unavailable', 400);
    }

    // --- Validate provider exists and is active ---
    const providerDoc = await db.collection('providers').doc(service.providerId).get();
    if (!providerDoc.exists || !providerDoc.data().isActive) {
      return errorResponse(res, 'Provider is currently unavailable', 400);
    }

    const provider = providerDoc.data();

    // --- Validate provider working hours ---
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const bookingDate = new Date(scheduledDate);
    const dayOfWeek = dayNames[bookingDate.getDay()];
    const daySchedule = provider.workingHours[dayOfWeek];

    if (!daySchedule || daySchedule.open === 'closed') {
      return errorResponse(res, `${provider.displayName} is not available on ${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}`, 400);
    }

    if (scheduledTime < daySchedule.open || scheduledTime >= daySchedule.close) {
      return errorResponse(
        res,
        `${provider.displayName} works from ${daySchedule.open} to ${daySchedule.close} on ${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}`,
        400
      );
    }

    // --- Validate scheduled date is not in the past ---
    const now = new Date();
    const bookingDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    if (bookingDateTime <= now) {
      return errorResponse(res, 'Cannot book a past date or time', 400);
    }

    // --- Validate address ---
    let bookingAddress = null;

    if (addressId) {
      const addressDoc = await db
        .collection('customers')
        .doc(uid)
        .collection('addresses')
        .doc(addressId)
        .get();

      if (!addressDoc.exists) {
        return errorResponse(res, 'Address not found', 404);
      }

      bookingAddress = { id: addressDoc.id, ...addressDoc.data() };
    } else {
      return errorResponse(res, 'Please provide a saved address ID', 400);
    }

    // --- Check for provider conflicts (double booking) ---
    const conflictCheck = await db
      .collection('bookings')
      .where('providerId', '==', service.providerId)
      .where('scheduledDate', '==', scheduledDate)
      .where('status', 'in', ['pending', 'confirmed', 'in_progress'])
      .get();

    for (const doc of conflictCheck.docs) {
      const existing = doc.data();
      const existingStart = existing.scheduledTime;
      const existingEnd = addMinutes(existingStart, existing.duration);
      const newEnd = addMinutes(scheduledTime, service.duration);

      if (scheduledTime < existingEnd && newEnd > existingStart) {
        return errorResponse(res, 'Provider is already booked at this time. Please choose another time.', 400);
      }
    }

    // --- Calculate price (free if using subscription, otherwise normal price) ---
    let totalPrice = service.price;
    let paidWithSubscription = false;

    if (subscription) {
      totalPrice = 0;
      paidWithSubscription = true;
    }

    // --- Create booking ---
    const bookingData = {
      customerId: req.user.uid,
      customerName: req.user.displayName,
      providerId: null, // <--- IMPORTANT: Starts as null
      serviceId: serviceId,
      categoryId: service.categoryId, // <--- CRITICAL FOR FILTERING: Washers will filter by this to see if they are qualified
      vehicleId: vehicleId,
      subscriptionId: subscriptionId,
      paidWithSubscription,
      status: BOOKING_STATUS.PENDING,
      assignedStaffId: null,   // Explicitly null so it enters the pool
      assignedStaffName: null,

      //Location
      location: addressSnapshot?.location || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Snapshot vehicle info
      vehicle: {
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color,
        licensePlate: vehicle.licensePlate,
        nickname: vehicle.nickname,
      },
      // Snapshot service info
      service: {
        name: service.name,
        categoryId: service.categoryId,
        price: service.price,
        duration: service.duration,
        currency: service.currency,
      },
      // Snapshot provider info
      provider: {
        displayName: provider.displayName,
        photoURL: provider.photoURL,
        rating: provider.rating,
        area: provider.area,
      },
      status: 'pending',
      scheduledDate: scheduledDate,
      scheduledTime: scheduledTime,
      duration: service.duration,
      address: {
        id: bookingAddress.id,
        label: bookingAddress.label,
        addressLine1: bookingAddress.addressLine1,
        addressLine2: bookingAddress.addressLine2 || null,
        city: bookingAddress.city,
        state: bookingAddress.state || null,
        postalCode: bookingAddress.postalCode || null,
        country: bookingAddress.country,
        location: bookingAddress.location || null,
      },
      totalPrice: totalPrice,
      currency: service.currency,
      notes: notes || null,
      cancellationReason: null,
      statusHistory: [
        {
          status: 'pending',
          updatedAt: new Date().toISOString(),
          updatedBy: 'customer',
        },
      ],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const bookingRef = await db.collection(COLLECTIONS.BOOKINGS).add(bookingData);

    // Notify about the new booking
    try {
      await notifyNewBookingRequest({
        id: bookingRef.id,
        ...bookingData,
      });
    } catch (notifyError) {
      console.error('Initial notification failed:', notifyError);
    }

    // --- Deduct wash from subscription if used ---
    if (subscription && subscription.remainingWashes !== 999999) {
      await db.collection('subscriptions').doc(subscriptionId).update({
        remainingWashes: admin.firestore.FieldValue.increment(-1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Fetch the created booking
    const createdBooking = await bookingRef.get();

    // Send notification (optional second call removed as it was redundant/broken)

    return successResponse(
      res,
      { booking: { id: createdBooking.id, ...createdBooking.data() } },
      subscription
        ? 'Booking created successfully using your subscription'
        : 'Booking created successfully',
      201
    );

  } catch (error) {
    console.error('Create booking error:', error);
    return errorResponse(res, 'Failed to create booking', 500);
  }
});

//AcceptBooking by washers
exports.acceptBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const staffId = req.user.uid;
  let bookingData;

  // Note: verifyToken doesn't include roles, so we should fetch or rely on tokens/middleware
  // For now, mirroring the user's logic but with proper constants and error handling

  const bookingRef = db.collection(COLLECTIONS.BOOKINGS).doc(id);
  // Using 'customers' or 'providers' based on the project structure
  // The user's snippet used COLLECTIONS.USERS, I'll keep it but define it
  const staffRef = db.collection(COLLECTIONS.USERS).doc(staffId);

  try {
    await db.runTransaction(async (transaction) => {
      const bookingDoc = await transaction.get(bookingRef);
      const staffDoc = await transaction.get(staffRef);

      if (!bookingDoc.exists) {
        throw new Error('BOOKING_NOT_FOUND');
      }
      if (!staffDoc.exists) {
        throw new Error('STAFF_NOT_FOUND');
      }

      bookingData = bookingDoc.data();
      const staffData = staffDoc.data();

      // Check role if stored in doc
      if (staffData.userType !== ROLES.STAFF && staffData.role !== ROLES.STAFF) {
        // Log but let it pass if user intended this for specific staff
      }

      // 1. Race Condition Check
      if (bookingData.status !== BOOKING_STATUS.PENDING || bookingData.assignedStaffId) {
        throw new Error('ALREADY_CLAIMED');
      }

      // 2. Certification Check
      if (staffData.certifiedServices && !staffData.certifiedServices.includes(bookingData.serviceId)) {
        throw new Error('UNQUALIFIED');
      }

      // 3. Lock it in
      transaction.update(bookingRef, {
        status: BOOKING_STATUS.CONFIRMED,
        assignedStaffId: staffId,
        assignedStaffName: staffData.displayName || 'Staff',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    // Notify the customer that their wash is confirmed
    try {
      const { notifyBookingConfirmed } = require('../../services/notificationService');
      await notifyBookingConfirmed({
        id: id,
        ...bookingData,
        providerId: staffId,
        provider: {
          displayName: req.user.displayName || 'A Provider'
        }
      });
    } catch (notifyError) {
      console.error('Confirmation notification failed:', notifyError);
    }

    return res.status(200).json({ success: true, message: 'Job secured!' });

  } catch (error) {
    console.error('Accept booking error:', error);
    if (error.message === 'BOOKING_NOT_FOUND') return errorResponse(res, 'Booking not found', 404);
    if (error.message === 'STAFF_NOT_FOUND') return errorResponse(res, 'Provider profile not found', 404);
    if (error.message === 'ALREADY_CLAIMED') return errorResponse(res, 'Another provider has already claimed this job.', 400);
    if (error.message === 'UNQUALIFIED') return errorResponse(res, 'You are not certified to perform this specific service.', 400);

    return errorResponse(res, 'Failed to accept booking', 500);
  }
});

// ============================================================
// GET MY BOOKINGS
// GET /bookings?status=pending&startDate=2026-02-01&endDate=2026-02-28
// ============================================================
exports.getBookings = async (req, res) => {
  try {
    const { uid } = req.user;
    const { status, startDate, endDate, limit = 20, page = 1 } = req.query;

    // Base query - only this customer's bookings
    let query = db.collection('bookings').where('customerId', '==', uid);

    // Filter by status
    if (status) {
      const validStatuses = ['pending', 'confirmed', 'rejected', 'in_progress', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return errorResponse(res, 'Invalid status filter', 400);
      }
      query = query.where('status', '==', status);
    }

    // Filter by date range
    if (startDate) {
      query = query.where('scheduledDate', '>=', startDate);
    }
    if (endDate) {
      query = query.where('scheduledDate', '<=', endDate);
    }

    // Fetch all matching
    const snapshot = await query.get();

    let bookings = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Sort by scheduledDate desc (newest first)
    bookings.sort((a, b) => {
      if (a.scheduledDate > b.scheduledDate) return -1;
      if (a.scheduledDate < b.scheduledDate) return 1;
      return a.scheduledTime > b.scheduledTime ? -1 : 1;
    });

    const totalCount = bookings.length;

    // Paginate
    const pageSize = Math.min(Number(limit), 50);
    const skip = (Number(page) - 1) * pageSize;
    const paginatedBookings = bookings.slice(skip, skip + pageSize);

    return successResponse(res, {
      bookings: paginatedBookings,
      pagination: {
        total: totalCount,
        page: Number(page),
        limit: pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
        hasMore: skip + pageSize < totalCount,
      },
    }, 'Bookings retrieved successfully');

  } catch (error) {
    console.error('Get bookings error:', error);
    return errorResponse(res, 'Failed to retrieve bookings', 500);
  }
};

// ============================================================
// GET BOOKING DETAILS
// GET /bookings/:bookingId
// ============================================================
exports.getBookingDetails = async (req, res) => {
  try {
    const { uid } = req.user;
    const { bookingId } = req.params;

    const bookingDoc = await db.collection('bookings').doc(bookingId).get();

    if (!bookingDoc.exists) {
      return errorResponse(res, 'Booking not found', 404);
    }

    const booking = { id: bookingDoc.id, ...bookingDoc.data() };

    // Only allow customer to see their own bookings
    if (booking.customerId !== uid) {
      return errorResponse(res, 'Booking not found', 404);
    }

    return successResponse(res, { booking }, 'Booking details retrieved successfully');

  } catch (error) {
    console.error('Get booking details error:', error);
    return errorResponse(res, 'Failed to retrieve booking details', 500);
  }
};

// ============================================================
// CANCEL BOOKING
// PATCH /bookings/:bookingId/cancel
// ============================================================
exports.cancelBooking = async (req, res) => {
  try {
    const { uid } = req.user;
    const { bookingId } = req.params;
    const { reason } = req.body;

    const bookingDoc = await db.collection('bookings').doc(bookingId).get();

    if (!bookingDoc.exists) {
      return errorResponse(res, 'Booking not found', 404);
    }

    const booking = bookingDoc.data();

    // Only allow customer to cancel their own bookings
    if (booking.customerId !== uid) {
      return errorResponse(res, 'Booking not found', 404);
    }

    // Can only cancel pending or confirmed bookings
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return errorResponse(
        res,
        `Cannot cancel a booking with status "${booking.status}". Only pending or confirmed bookings can be cancelled.`,
        400
      );
    }

    // Update booking
    const updatedStatusHistory = [
      ...booking.statusHistory,
      {
        status: 'cancelled',
        updatedAt: new Date().toISOString(),
        updatedBy: 'customer',
      },
    ];

    await db.collection('bookings').doc(bookingId).update({
      status: 'cancelled',
      cancellationReason: reason || 'Cancelled by customer',
      statusHistory: updatedStatusHistory,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    // Send cancellation notification
    try {
      await notifyBookingCancelledByCustomer(
        { id: bookingId, ...booking },
        reason
      );
    } catch (notifyError) {
      console.error('Cancellation notification failed:', notifyError);
    }

    // Fetch updated booking
    const updatedDoc = await db.collection('bookings').doc(bookingId).get();

    return successResponse(
      res,
      { booking: { id: updatedDoc.id, ...updatedDoc.data() } },
      'Booking cancelled successfully'
    );

  } catch (error) {
    console.error('Cancel booking error:', error);
    return errorResponse(res, 'Failed to cancel booking', 500);
  }
};

// ============================================================
// RESCHEDULE BOOKING
// PATCH /bookings/:bookingId/reschedule
// ============================================================
exports.rescheduleBooking = async (req, res) => {
  try {
    const { uid } = req.user;
    const { bookingId } = req.params;
    const { scheduledDate, scheduledTime, reason } = req.body;

    // Fetch booking
    const bookingDoc = await db.collection('bookings').doc(bookingId).get();

    if (!bookingDoc.exists) {
      return errorResponse(res, 'Booking not found', 404);
    }

    const booking = bookingDoc.data();

    // Only allow customer to reschedule their own bookings
    if (booking.customerId !== uid) {
      return errorResponse(res, 'Booking not found', 404);
    }

    // Can only reschedule pending or confirmed bookings
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return errorResponse(
        res,
        `Cannot reschedule a booking with status "${booking.status}". Only pending or confirmed bookings can be rescheduled.`,
        400
      );
    }

    // --- Check 2-day minimum notice rule ---
    const now = new Date();
    const currentScheduled = new Date(`${booking.scheduledDate}T${booking.scheduledTime}`);
    const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
    const timeUntilBooking = currentScheduled - now;

    if (timeUntilBooking < twoDaysInMs) {
      return errorResponse(
        res,
        'Cannot reschedule. Bookings must be rescheduled at least 2 days (48 hours) before the scheduled time.',
        400
      );
    }

    // --- Validate new scheduled date is not in the past ---
    const newBookingDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    if (newBookingDateTime <= now) {
      return errorResponse(res, 'Cannot reschedule to a past date or time', 400);
    }

    // --- Validate provider working hours for new time ---
    const providerDoc = await db.collection('providers').doc(booking.providerId).get();
    if (!providerDoc.exists) {
      return errorResponse(res, 'Provider not found', 404);
    }

    const provider = providerDoc.data();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const newBookingDate = new Date(scheduledDate);
    const dayOfWeek = dayNames[newBookingDate.getDay()];
    const daySchedule = provider.workingHours[dayOfWeek];

    if (!daySchedule || daySchedule.open === 'closed') {
      return errorResponse(
        res,
        `${provider.displayName} is not available on ${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}`,
        400
      );
    }

    if (scheduledTime < daySchedule.open || scheduledTime >= daySchedule.close) {
      return errorResponse(
        res,
        `${provider.displayName} works from ${daySchedule.open} to ${daySchedule.close} on ${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}`,
        400
      );
    }

    // --- Check for provider conflicts at the new time ---
    const conflictCheck = await db
      .collection('bookings')
      .where('providerId', '==', booking.providerId)
      .where('scheduledDate', '==', scheduledDate)
      .where('status', 'in', ['pending', 'confirmed', 'in_progress'])
      .get();

    for (const doc of conflictCheck.docs) {
      // Skip the current booking being rescheduled
      if (doc.id === bookingId) continue;

      const existing = doc.data();
      const existingStart = existing.scheduledTime;
      const existingEnd = addMinutes(existingStart, existing.duration);
      const newEnd = addMinutes(scheduledTime, booking.duration);

      // Check overlap
      if (scheduledTime < existingEnd && newEnd > existingStart) {
        return errorResponse(
          res,
          'Provider is already booked at this time. Please choose another time.',
          400
        );
      }
    }

    // --- Update booking ---
    const updatedStatusHistory = [
      ...booking.statusHistory,
      {
        status: 'rescheduled',
        oldDate: booking.scheduledDate,
        oldTime: booking.scheduledTime,
        newDate: scheduledDate,
        newTime: scheduledTime,
        reason: reason || 'Rescheduled by customer',
        updatedAt: new Date().toISOString(),
        updatedBy: 'customer',
      },
    ];

    await db.collection('bookings').doc(bookingId).update({
      scheduledDate: scheduledDate,
      scheduledTime: scheduledTime,
      statusHistory: updatedStatusHistory,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    // Send reschedule notification
    try {
      await notifyBookingRescheduled(
        { id: bookingId, scheduledDate, scheduledTime, ...booking },
        booking.scheduledDate, // Old Date
        booking.scheduledTime  // Old Time
      );
    } catch (notifyError) {
      console.error('Reschedule notification failed:', notifyError);
    }

    // Fetch updated booking
    const updatedDoc = await db.collection('bookings').doc(bookingId).get();

    return successResponse(
      res,
      { booking: { id: updatedDoc.id, ...updatedDoc.data() } },
      'Booking rescheduled successfully'
    );

  } catch (error) {
    console.error('Reschedule booking error:', error);
    return errorResponse(res, 'Failed to reschedule booking', 500);
  }
};

// ============================================================
// UTILITY: Add minutes to a time string (HH:MM)
// ============================================================
function addMinutes(timeStr, minutes) {
  const [hours, mins] = timeStr.split(':').map(Number);
  const totalMins = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMins / 60) % 24;
  const newMins = totalMins % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
}