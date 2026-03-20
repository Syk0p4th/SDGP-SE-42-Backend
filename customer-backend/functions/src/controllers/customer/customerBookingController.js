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
  ARRIVED: 'arrived',
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
// VEHICLE TYPE PRICE MULTIPLIERS
// Larger/more complex vehicles cost more to wash
// ============================================================
const VEHICLE_TYPE_MULTIPLIERS = {
  'Sedan':       1.0,
  'Hatchback':   1.0,
  'Coupe':       1.0,
  'Convertible': 1.1,
  'Wagon':       1.2,
  'SUV':         1.3,
  'Van':         1.4,
  'Truck':       1.5,
};

function getTypeMultiplier(vehicleType) {
  return VEHICLE_TYPE_MULTIPLIERS[vehicleType] || 1.0;
}

/**
 * Calculate final price based on base service price + vehicle type
 * Returns { totalPrice, multiplier, breakdown }
 */
function calculatePrice(basePrice, vehicleType) {
  const multiplier = getTypeMultiplier(vehicleType);
  const totalPrice = Math.round(basePrice * multiplier);
  return {
    totalPrice,
    multiplier,
    breakdown: {
      basePrice,
      vehicleType: vehicleType || 'Unknown',
      multiplier,
      finalPrice: totalPrice,
    },
  };
}

// ============================================================
// CREATE BOOKING
// POST /bookings
// ============================================================
exports.createBooking = asyncHandler(async (req, res) => {
  try {
    const { serviceId, vehicleId, scheduledDate, scheduledTime, addressId, notes, paymentPath } = req.body;
    const { uid } = req.user;

    // --- Validate required fields ---
    if (!vehicleId) return errorResponse(res, 'Vehicle ID is required', 400);
    if (!serviceId) return errorResponse(res, 'Service ID is required', 400);
    if (!scheduledDate || !scheduledTime) return errorResponse(res, 'Scheduled date and time are required', 400);
    if (!addressId) return errorResponse(res, 'Please provide a saved address ID', 400);

    // --- Validate vehicle ---
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

    // --- Validate service ---
    const serviceDoc = await db.collection('services').doc(serviceId).get();
    if (!serviceDoc.exists) return errorResponse(res, 'Service not found', 404);

    const service = serviceDoc.data();
    if (!service.isActive) return errorResponse(res, 'This service is currently unavailable', 400);

    // --- Validate scheduled date is not in the past ---


    // --- Validate address ---
    const addressDoc = await db
      .collection('customers')
      .doc(uid)
      .collection('addresses')
      .doc(addressId)
      .get();

    if (!addressDoc.exists) return errorResponse(res, 'Address not found', 404);

    const bookingAddress = { id: addressDoc.id, ...addressDoc.data() };

    // --- Check for active subscription on this vehicle ---
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

      // Only validate subscription if customer chose to pay with it
      if (paymentPath === 'subscription') {
        if (subscription.remainingWashes <= 0) {
          return errorResponse(
            res,
            'No remaining washes in your subscription. Please renew or book without subscription.',
            400
          );
        }
      } else {
        // one_time — ignore subscription entirely
        subscription = null;
        subscriptionId = null;
      }
    }

    // --- Calculate price with vehicle type multiplier ---
    // Subscription overrides to free; otherwise apply type multiplier
    let totalPrice = 0;
    let paidWithSubscription = false;
    let priceBreakdown = null;

    if (subscription) {
      totalPrice = 0;
      paidWithSubscription = true;
      priceBreakdown = {
        basePrice: service.price,
        vehicleType: vehicle.type || 'Unknown',
        multiplier: getTypeMultiplier(vehicle.type),
        finalPrice: 0,
        coveredBySubscription: true,
      };
    } else {
      const pricing = calculatePrice(service.price, vehicle.type);
      totalPrice = pricing.totalPrice;
      priceBreakdown = pricing.breakdown;
    }

    // --- Build booking document ---
    const bookingData = {
      customerId: uid,
      customerName: req.user.displayName || null,

      // Race mode — no provider assigned at creation
      providerId: null,
      assignedStaffId: null,
      assignedStaffName: null,

      serviceId,
      categoryId: service.categoryId, // Washers filter by this for qualification
      vehicleId,
      subscriptionId,
      paidWithSubscription,

      status: BOOKING_STATUS.PENDING,

      scheduledDate,
      scheduledTime,
      duration: service.duration,

      totalPrice,
      currency: service.currency || 'LKR',
      priceBreakdown, // Stored for transparency / admin review

      notes: notes || null,
      cancellationReason: null,

      // Address snapshot
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
        district: bookingAddress.city || null,   // used by washer service-area filter
      },

      // Vehicle snapshot (includes type for washer visibility)
      vehicle: {
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        type: vehicle.type || null,
        color: vehicle.color,
        licensePlate: vehicle.licensePlate,
        nickname: vehicle.nickname,
      },

      // Service snapshot
      service: {
        name: service.name,
        categoryId: service.categoryId,
        price: service.price,
        duration: service.duration,
        currency: service.currency || 'LKR',
      },

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

    // --- Deduct subscription wash ---
    if (subscription && subscription.remainingWashes !== 999999) {
      await db.collection('subscriptions').doc(subscriptionId).update({
        remainingWashes: admin.firestore.FieldValue.increment(-1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // --- Notify available washers ---
    try {
      await notifyNewBookingRequest({ id: bookingRef.id, ...bookingData });
    } catch (notifyError) {
      console.error('Booking notification failed:', notifyError);
    }

    const createdBooking = await bookingRef.get();

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

// ============================================================
// ACCEPT BOOKING (Race mode — washer claims the job)
// POST /bookings/:id/accept
// ============================================================
exports.acceptBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const staffId = req.user.uid;
  let bookingData;

  const bookingRef = db.collection(COLLECTIONS.BOOKINGS).doc(id);
  const staffRef = db.collection(COLLECTIONS.USERS).doc(staffId);

  try {
    await db.runTransaction(async (transaction) => {
      const bookingDoc = await transaction.get(bookingRef);
      const staffDoc = await transaction.get(staffRef);

      if (!bookingDoc.exists) throw new Error('BOOKING_NOT_FOUND');
      if (!staffDoc.exists) throw new Error('STAFF_NOT_FOUND');

      bookingData = bookingDoc.data();
      const staffData = staffDoc.data();

      // Race condition check — first one wins
      if (bookingData.status !== BOOKING_STATUS.PENDING || bookingData.assignedStaffId) {
        throw new Error('ALREADY_CLAIMED');
      }

      // Certification check
      if (staffData.certifiedServices && !staffData.certifiedServices.includes(bookingData.serviceId)) {
        throw new Error('UNQUALIFIED');
      }

      transaction.update(bookingRef, {
        status: BOOKING_STATUS.CONFIRMED,
        assignedStaffId: staffId,
        assignedStaffName: staffData.displayName || 'Staff',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    try {
      const { notifyBookingConfirmed } = require('../../services/notificationService');
      await notifyBookingConfirmed({
        id,
        ...bookingData,
        providerId: staffId,
        provider: { displayName: req.user.displayName || 'A Provider' },
      });
    } catch (notifyError) {
      console.error('Confirmation notification failed:', notifyError);
    }

    return res.status(200).json({ success: true, message: 'Job secured!' });

  } catch (error) {
    if (error.message === 'BOOKING_NOT_FOUND') return errorResponse(res, 'Booking not found', 404);
    if (error.message === 'STAFF_NOT_FOUND') return errorResponse(res, 'Provider profile not found', 404);
    if (error.message === 'ALREADY_CLAIMED') return errorResponse(res, 'Another provider has already claimed this job.', 400);
    if (error.message === 'UNQUALIFIED') return errorResponse(res, 'You are not certified to perform this service.', 400);
    console.error('Accept booking error:', error);
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

    let query = db.collection('bookings').where('customerId', '==', uid);

    if (status) {
      const validStatuses = ['pending', 'confirmed', 'rejected', 'in_progress', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) return errorResponse(res, 'Invalid status filter', 400);
      query = query.where('status', '==', status);
    }

    if (startDate) query = query.where('scheduledDate', '>=', startDate);
    if (endDate) query = query.where('scheduledDate', '<=', endDate);

    const snapshot = await query.get();

    let bookings = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    bookings.sort((a, b) => {
      if (a.scheduledDate > b.scheduledDate) return -1;
      if (a.scheduledDate < b.scheduledDate) return 1;
      return a.scheduledTime > b.scheduledTime ? -1 : 1;
    });

    const totalCount = bookings.length;
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

    if (!bookingDoc.exists) return errorResponse(res, 'Booking not found', 404);

    const booking = { id: bookingDoc.id, ...bookingDoc.data() };

    if (booking.customerId !== uid) return errorResponse(res, 'Booking not found', 404);

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
    if (!bookingDoc.exists) return errorResponse(res, 'Booking not found', 404);

    const booking = bookingDoc.data();

    if (booking.customerId !== uid) return errorResponse(res, 'Booking not found', 404);

    if (!['pending', 'confirmed'].includes(booking.status)) {
      return errorResponse(
        res,
        `Cannot cancel a booking with status "${booking.status}". Only pending or confirmed bookings can be cancelled.`,
        400
      );
    }

    const updatedStatusHistory = [
      ...(booking.statusHistory || []),
      { status: 'cancelled', updatedAt: new Date().toISOString(), updatedBy: 'customer' },
    ];

    await db.collection('bookings').doc(bookingId).update({
      status: 'cancelled',
      cancellationReason: reason || 'Cancelled by customer',
      statusHistory: updatedStatusHistory,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Refund subscription wash if it was used
    if (booking.paidWithSubscription && booking.subscriptionId) {
      try {
        await db.collection('subscriptions').doc(booking.subscriptionId).update({
          remainingWashes: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (refundError) {
        console.error('Subscription refund failed:', refundError);
      }
    }

    try {
      await notifyBookingCancelledByCustomer({ id: bookingId, ...booking }, reason);
    } catch (notifyError) {
      console.error('Cancellation notification failed:', notifyError);
    }

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

    const bookingDoc = await db.collection('bookings').doc(bookingId).get();
    if (!bookingDoc.exists) return errorResponse(res, 'Booking not found', 404);

    const booking = bookingDoc.data();

    if (booking.customerId !== uid) return errorResponse(res, 'Booking not found', 404);

    if (!['pending', 'confirmed'].includes(booking.status)) {
      return errorResponse(
        res,
        `Cannot reschedule a booking with status "${booking.status}". Only pending or confirmed bookings can be rescheduled.`,
        400
      );
    }


    const now = new Date();
    const newBookingDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    if (newBookingDateTime <= now) {
      return errorResponse(res, 'Cannot reschedule to a past date or time', 400);
    }

    const updatedStatusHistory = [
      ...(booking.statusHistory || []),
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
      scheduledDate,
      scheduledTime,
      statusHistory: updatedStatusHistory,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    try {
      await notifyBookingRescheduled(
        { id: bookingId, scheduledDate, scheduledTime, ...booking },
        booking.scheduledDate,
        booking.scheduledTime
      );
    } catch (notifyError) {
      console.error('Reschedule notification failed:', notifyError);
    }

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