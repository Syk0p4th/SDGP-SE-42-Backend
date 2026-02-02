const { db } = require('../../config/firebase');
const { successResponse, errorResponse } = require('../../utils/response');

// ============================================================
// GET MY NOTIFICATIONS
// GET /notifications?limit=20&page=1&unreadOnly=true
// ============================================================
exports.getNotifications = async (req, res) => {
  try {
    const { uid } = req.user;
    const { limit = 20, page = 1, unreadOnly = 'false' } = req.query;

    let query = db
      .collection('notifications')
      .where('userId', '==', uid)
      .where('userType', '==', 'customer');

    // Filter unread only
    if (unreadOnly === 'true') {
      query = query.where('isRead', '==', false);
    }

    const snapshot = await query.get();

    let notifications = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Sort by createdAt desc (newest first)
    notifications.sort((a, b) => {
      const aTime = a.createdAt?._seconds || 0;
      const bTime = b.createdAt?._seconds || 0;
      return bTime - aTime;
    });

    const totalCount = notifications.length;
    const unreadCount = notifications.filter((n) => !n.isRead).length;

    // Paginate
    const pageSize = Math.min(Number(limit), 50);
    const skip = (Number(page) - 1) * pageSize;
    const paginatedNotifications = notifications.slice(skip, skip + pageSize);

    return successResponse(res, {
      notifications: paginatedNotifications,
      unreadCount,
      pagination: {
        total: totalCount,
        page: Number(page),
        limit: pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
        hasMore: skip + pageSize < totalCount,
      },
    }, 'Notifications retrieved successfully');

  } catch (error) {
    console.error('Get notifications error:', error);
    return errorResponse(res, 'Failed to retrieve notifications', 500);
  }
};

// ============================================================
// MARK NOTIFICATION AS READ
// PATCH /notifications/:notificationId/read
// ============================================================
exports.markAsRead = async (req, res) => {
  try {
    const { uid } = req.user;
    const { notificationId } = req.params;

    const notificationDoc = await db.collection('notifications').doc(notificationId).get();

    if (!notificationDoc.exists) {
      return errorResponse(res, 'Notification not found', 404);
    }

    const notification = notificationDoc.data();

    // Only allow user to mark their own notifications
    if (notification.userId !== uid) {
      return errorResponse(res, 'Notification not found', 404);
    }

    await db.collection('notifications').doc(notificationId).update({
      isRead: true,
      readAt: new Date().toISOString(),
    });

    return successResponse(res, null, 'Notification marked as read');

  } catch (error) {
    console.error('Mark as read error:', error);
    return errorResponse(res, 'Failed to mark notification as read', 500);
  }
};

// ============================================================
// MARK ALL NOTIFICATIONS AS READ
// PATCH /notifications/read-all
// ============================================================
exports.markAllAsRead = async (req, res) => {
  try {
    const { uid } = req.user;

    const snapshot = await db
      .collection('notifications')
      .where('userId', '==', uid)
      .where('userType', '==', 'customer')
      .where('isRead', '==', false)
      .get();

    const batch = db.batch();
    const now = new Date().toISOString();

    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        isRead: true,
        readAt: now,
      });
    });

    await batch.commit();

    return successResponse(res, { count: snapshot.size }, `${snapshot.size} notifications marked as read`);

  } catch (error) {
    console.error('Mark all as read error:', error);
    return errorResponse(res, 'Failed to mark all notifications as read', 500);
  }
};

// ============================================================
// DELETE NOTIFICATION
// DELETE /notifications/:notificationId
// ============================================================
exports.deleteNotification = async (req, res) => {
  try {
    const { uid } = req.user;
    const { notificationId } = req.params;

    const notificationDoc = await db.collection('notifications').doc(notificationId).get();

    if (!notificationDoc.exists) {
      return errorResponse(res, 'Notification not found', 404);
    }

    const notification = notificationDoc.data();

    // Only allow user to delete their own notifications
    if (notification.userId !== uid) {
      return errorResponse(res, 'Notification not found', 404);
    }

    await db.collection('notifications').doc(notificationId).delete();

    return successResponse(res, null, 'Notification deleted successfully');

  } catch (error) {
    console.error('Delete notification error:', error);
    return errorResponse(res, 'Failed to delete notification', 500);
  }
};

// ============================================================
// UPDATE FCM TOKEN
// POST /notifications/fcm-token
// ============================================================
exports.updateFcmToken = async (req, res) => {
  try {
    const { uid } = req.user;
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return errorResponse(res, 'FCM token is required', 400);
    }

    await db.collection('customers').doc(uid).update({
      fcmToken: fcmToken,
      fcmTokenUpdatedAt: new Date().toISOString(),
    });

    return successResponse(res, null, 'FCM token updated successfully');

  } catch (error) {
    console.error('Update FCM token error:', error);
    return errorResponse(res, 'Failed to update FCM token', 500);
  }
};