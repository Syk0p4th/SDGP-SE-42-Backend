const { admin, db } = require('../config/firebase');

// ============================================================
// CREATE NOTIFICATION
// ============================================================
async function createNotification({
  userId,
  userType, // 'customer' or 'provider'
  type,
  title,
  message,
  data = {},
}) {
  try {
    const notification = {
      userId,
      userType,
      type,
      title,
      message,
      data,
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const notificationRef = await db.collection('notifications').add(notification);

    // Send push notification if user has FCM token
    await sendPushNotification(userId, userType, {
      title,
      body: message,
      data: {
        notificationId: notificationRef.id,
        type,
        ...data,
      },
    });

    return { success: true, notificationId: notificationRef.id };

  } catch (error) {
    console.error('Create notification error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================
// SEND PUSH NOTIFICATION (FCM)
// ============================================================
async function sendPushNotification(userId, userType, payload) {
  try {
    // Get user's FCM token from their profile
    const collection = userType === 'customer' ? 'customers' : 'providers';
    const userDoc = await db.collection(collection).doc(userId).get();

    if (!userDoc.exists) {
      console.log(`User ${userId} not found`);
      return { success: false };
    }

    const userData = userDoc.data();
    const fcmToken = userData.fcmToken;

    if (!fcmToken) {
      console.log(`No FCM token for user ${userId}`);
      return { success: false };
    }

    // Send FCM message
    const message = {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      token: fcmToken,
    };

    const response = await admin.messaging().send(message);
    console.log('✅ Push notification sent:', response);
    
    return { success: true, response };

  } catch (error) {
    console.error('Send push notification error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================
// BOOKING NOTIFICATION HELPERS
// ============================================================

// Customer: Booking confirmed by provider
async function notifyBookingConfirmed(booking) {
  return createNotification({
    userId: booking.customerId,
    userType: 'customer',
    type: 'booking_confirmed',
    title: 'Booking Confirmed! 🎉',
    message: `${booking.provider.displayName} confirmed your booking for ${booking.scheduledDate} at ${booking.scheduledTime}`,
    data: {
      bookingId: booking.id,
      providerId: booking.providerId,
      scheduledDate: booking.scheduledDate,
      scheduledTime: booking.scheduledTime,
    },
  });
}

// Customer: Booking rejected by provider
async function notifyBookingRejected(booking, reason) {
  return createNotification({
    userId: booking.customerId,
    userType: 'customer',
    type: 'booking_rejected',
    title: 'Booking Declined',
    message: `${booking.provider.displayName} declined your booking. ${reason || 'Please try another time or provider.'}`,
    data: {
      bookingId: booking.id,
      providerId: booking.providerId,
      reason,
    },
  });
}

// Customer: Service started
async function notifyServiceStarted(booking) {
  return createNotification({
    userId: booking.customerId,
    userType: 'customer',
    type: 'service_started',
    title: 'Service Started 🚗',
    message: `${booking.provider.displayName} has started your ${booking.service.name}`,
    data: {
      bookingId: booking.id,
      providerId: booking.providerId,
    },
  });
}

// Customer: Service completed
async function notifyServiceCompleted(booking) {
  return createNotification({
    userId: booking.customerId,
    userType: 'customer',
    type: 'service_completed',
    title: 'Service Completed! ✨',
    message: `Your ${booking.service.name} is complete! Please rate your experience with ${booking.provider.displayName}`,
    data: {
      bookingId: booking.id,
      providerId: booking.providerId,
    },
  });
}

// Provider: New booking request
async function notifyNewBookingRequest(booking) {
  return createNotification({
    userId: booking.providerId,
    userType: 'provider',
    type: 'new_booking_request',
    title: 'New Booking Request 📋',
    message: `New booking for ${booking.service.name} on ${booking.scheduledDate} at ${booking.scheduledTime}`,
    data: {
      bookingId: booking.id,
      customerId: booking.customerId,
      scheduledDate: booking.scheduledDate,
      scheduledTime: booking.scheduledTime,
    },
  });
}

// Provider: Customer cancelled booking
async function notifyBookingCancelledByCustomer(booking, reason) {
  return createNotification({
    userId: booking.providerId,
    userType: 'provider',
    type: 'booking_cancelled',
    title: 'Booking Cancelled',
    message: `Booking for ${booking.scheduledDate} at ${booking.scheduledTime} was cancelled. ${reason || ''}`,
    data: {
      bookingId: booking.id,
      customerId: booking.customerId,
      reason,
    },
  });
}

// Provider: Customer rescheduled booking
async function notifyBookingRescheduled(booking, oldDate, oldTime) {
  return createNotification({
    userId: booking.providerId,
    userType: 'provider',
    type: 'booking_rescheduled',
    title: 'Booking Rescheduled 📅',
    message: `Booking moved from ${oldDate} ${oldTime} to ${booking.scheduledDate} ${booking.scheduledTime}`,
    data: {
      bookingId: booking.id,
      customerId: booking.customerId,
      oldDate,
      oldTime,
      newDate: booking.scheduledDate,
      newTime: booking.scheduledTime,
    },
  });
}

module.exports = {
  createNotification,
  sendPushNotification,
  // Booking notifications
  notifyBookingConfirmed,
  notifyBookingRejected,
  notifyServiceStarted,
  notifyServiceCompleted,
  notifyNewBookingRequest,
  notifyBookingCancelledByCustomer,
  notifyBookingRescheduled,
};