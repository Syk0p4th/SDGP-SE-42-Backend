/* eslint-disable max-len */
const { db } = require('../config/firebase');
const { COLLECTIONS, NOTIFICATION_TYPES, ROLES } = require('../utils/constants');
const logger = require('../config/logger');

/**
 * Create notification for a user
 */
async function createNotification(userId, type, title, message, ref = null) {
  try {
    const notificationData = {
      type,
      title,
      message,
      ref,
      createdAt: new Date().toISOString(),
      readAt: null
    };

    await db
      .collection(COLLECTIONS.USERS)
      .doc(userId)
      .collection(COLLECTIONS.NOTIFICATIONS)
      .add(notificationData);

    logger.info('Notification created', { userId, type });
  } catch (error) {
    logger.error('Failed to create notification', { userId, type, error: error.message });
  }
}

/**
 * Notify admin and staff about new booking
 */
async function notifyNewBooking(bookingId, bookingData) {
  try {
    // Get all admin and staff users
    const usersSnapshot = await db
      .collection(COLLECTIONS.USERS)
      .where('role', 'in', [ROLES.ADMIN, ROLES.STAFF])
      .get();

    const promises = [];
    usersSnapshot.forEach((doc) => {
      promises.push(
        createNotification(
          doc.id,
          NOTIFICATION_TYPES.BOOKING_CREATED,
          'New Booking',
          `New booking from ${bookingData.customerName} for ${bookingData.serviceSnapshot.name}`,
          bookingId
        )
      );
    });

    await Promise.all(promises);
    logger.info('Staff/Admin notified of new booking', { bookingId });
  } catch (error) {
    logger.error('Failed to notify about new booking', { bookingId, error: error.message });
  }
}

/**
 * Notify customer about booking status change
 */
async function notifyBookingStatusChange(bookingId, customerId, newStatus) {
  try {
    const statusMessages = {
      confirmed: 'Your booking has been confirmed',
      in_progress: 'Your service is now in progress',
      completed: 'Your service has been completed',
      cancelled: 'Your booking has been cancelled'
    };

    const message = statusMessages[newStatus] || 'Your booking status has changed';

    await createNotification(
      customerId,
      NOTIFICATION_TYPES.BOOKING_CONFIRMED,
      'Booking Status Update',
      message,
      bookingId
    );

    logger.info('Customer notified of status change', { bookingId, customerId, newStatus });
  } catch (error) {
    logger.error('Failed to notify status change', { bookingId, error: error.message });
  }
}

/**
 * Notify relevant parties about booking cancellation
 */
async function notifyBookingCancelled(bookingId, bookingData, cancelledBy) {
  try {
    // If cancelled by customer, notify staff/admin
    if (cancelledBy === bookingData.customerId) {
      const usersSnapshot = await db
        .collection(COLLECTIONS.USERS)
        .where('role', 'in', [ROLES.ADMIN, ROLES.STAFF])
        .get();

      const promises = [];
      usersSnapshot.forEach((doc) => {
        promises.push(
          createNotification(
            doc.id,
            NOTIFICATION_TYPES.BOOKING_CANCELLED,
            'Booking Cancelled',
            `${bookingData.customerName} cancelled their booking`,
            bookingId
          )
        );
      });

      await Promise.all(promises);
    } else {
      // If cancelled by staff/admin, notify customer
      await createNotification(
        bookingData.customerId,
        NOTIFICATION_TYPES.BOOKING_CANCELLED,
        'Booking Cancelled',
        'Your booking has been cancelled',
        bookingId
      );
    }

    logger.info('Cancellation notifications sent', { bookingId, cancelledBy });
  } catch (error) {
    logger.error('Failed to send cancellation notifications', { bookingId, error: error.message });
  }
}

/**
 * Notify customer to leave a review after completion
 */
async function notifyReviewRequest(bookingId, customerId) {
  try {
    await createNotification(
      customerId,
      NOTIFICATION_TYPES.REVIEW_REQUEST,
      'How was your experience?',
      'Please take a moment to rate your recent service',
      bookingId
    );

    logger.info('Review request sent', { bookingId, customerId });
  } catch (error) {
    logger.error('Failed to send review request', { bookingId, error: error.message });
  }
}

/**
 * Notify customer when staff is assigned
 */
async function notifyStaffAssigned(bookingId, customerId, staffName) {
  try {
    await createNotification(
      customerId,
      NOTIFICATION_TYPES.STAFF_ASSIGNED,
      'Staff Assigned',
      `${staffName} has been assigned to your booking`,
      bookingId
    );

    logger.info('Staff assignment notification sent', { bookingId, customerId });
  } catch (error) {
    logger.error('Failed to send staff assignment notification', { bookingId, error: error.message });
  }
}

module.exports = {
  createNotification,
  notifyNewBooking,
  notifyBookingStatusChange,
  notifyBookingCancelled,
  notifyReviewRequest,
  notifyStaffAssigned
};
