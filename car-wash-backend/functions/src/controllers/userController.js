/* eslint-disable max-len */
const { db } = require('../config/firebase');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { COLLECTIONS, ROLES } = require('../utils/constants');
const logger = require('../config/logger');

/**
 * Get user by ID (admin/staff only)
 * GET /users/:uid
 */
exports.getUserById = asyncHandler(async (req, res) => {
  const { uid } = req.params;

  const userDoc = await db.collection(COLLECTIONS.USERS).doc(uid).get();

  if (!userDoc.exists) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  res.status(200).json({
    success: true,
    user: {
      uid: userDoc.id,
      ...userDoc.data()
    }
  });
});

/**
 * Get all users (admin/staff only)
 * GET /users
 */
exports.getAllUsers = asyncHandler(async (req, res) => {
  const { role, status } = req.query;

  let query = db.collection(COLLECTIONS.USERS);

  if (role) {
    query = query.where('role', '==', role);
  }

  if (status) {
    query = query.where('status', '==', status);
  }

  const snapshot = await query.get();

  const users = [];
  snapshot.forEach((doc) => {
    users.push({
      uid: doc.id,
      ...doc.data()
    });
  });

  res.status(200).json({
    success: true,
    count: users.length,
    users
  });
});

/**
 * Get user vehicles
 * GET /users/:uid/vehicles
 */
exports.getUserVehicles = asyncHandler(async (req, res) => {
  const { uid } = req.params;

  // Users can only view their own vehicles unless admin/staff
  if (req.user.role === ROLES.CUSTOMER && req.user.uid !== uid) {
    throw new AppError('Not authorized to view these vehicles', 403, 'FORBIDDEN');
  }

  const snapshot = await db
    .collection(COLLECTIONS.USERS)
    .doc(uid)
    .collection(COLLECTIONS.VEHICLES)
    .get();

  const vehicles = [];
  snapshot.forEach((doc) => {
    vehicles.push({
      id: doc.id,
      ...doc.data()
    });
  });

  res.status(200).json({
    success: true,
    count: vehicles.length,
    vehicles
  });
});

/**
 * Add vehicle
 * POST /users/:uid/vehicles
 */
exports.addVehicle = asyncHandler(async (req, res) => {
  const { uid } = req.params;
  const { type, plateNumber, nickname, isDefault } = req.body;

  // Users can only add to their own vehicles unless admin/staff
  if (req.user.role === ROLES.CUSTOMER && req.user.uid !== uid) {
    throw new AppError('Not authorized to add vehicles for this user', 403, 'FORBIDDEN');
  }

  if (!type || !plateNumber) {
    throw new AppError('Vehicle type and plate number are required', 400, 'VALIDATION_ERROR');
  }

  const vehicleData = {
    type,
    plateNumber,
    nickname: nickname || '',
    isDefault: isDefault || false,
    createdAt: new Date().toISOString()
  };

  const vehicleRef = await db
    .collection(COLLECTIONS.USERS)
    .doc(uid)
    .collection(COLLECTIONS.VEHICLES)
    .add(vehicleData);

  logger.info('Vehicle added', { uid, vehicleId: vehicleRef.id, type });

  res.status(201).json({
    success: true,
    message: 'Vehicle added successfully',
    vehicle: {
      id: vehicleRef.id,
      ...vehicleData
    }
  });
});

/**
 * Update vehicle
 * PATCH /users/:uid/vehicles/:vehicleId
 */
exports.updateVehicle = asyncHandler(async (req, res) => {
  const { uid, vehicleId } = req.params;
  const { type, plateNumber, nickname, isDefault } = req.body;

  if (req.user.role === ROLES.CUSTOMER && req.user.uid !== uid) {
    throw new AppError('Not authorized to update this vehicle', 403, 'FORBIDDEN');
  }

  const updates = {};
  if (type !== undefined) updates.type = type;
  if (plateNumber !== undefined) updates.plateNumber = plateNumber;
  if (nickname !== undefined) updates.nickname = nickname;
  if (isDefault !== undefined) updates.isDefault = isDefault;

  if (Object.keys(updates).length === 0) {
    throw new AppError('No fields to update', 400, 'VALIDATION_ERROR');
  }

  await db
    .collection(COLLECTIONS.USERS)
    .doc(uid)
    .collection(COLLECTIONS.VEHICLES)
    .doc(vehicleId)
    .update(updates);

  logger.info('Vehicle updated', { uid, vehicleId, updates: Object.keys(updates) });

  res.status(200).json({
    success: true,
    message: 'Vehicle updated successfully',
    updates
  });
});

/**
 * Delete vehicle
 * DELETE /users/:uid/vehicles/:vehicleId
 */
exports.deleteVehicle = asyncHandler(async (req, res) => {
  const { uid, vehicleId } = req.params;

  if (req.user.role === ROLES.CUSTOMER && req.user.uid !== uid) {
    throw new AppError('Not authorized to delete this vehicle', 403, 'FORBIDDEN');
  }

  await db
    .collection(COLLECTIONS.USERS)
    .doc(uid)
    .collection(COLLECTIONS.VEHICLES)
    .doc(vehicleId)
    .delete();

  logger.info('Vehicle deleted', { uid, vehicleId });

  res.status(200).json({
    success: true,
    message: 'Vehicle deleted successfully'
  });
});

/**
 * Get user notifications
 * GET /users/:uid/notifications
 */
exports.getUserNotifications = asyncHandler(async (req, res) => {
  const { uid } = req.params;

  if (req.user.role === ROLES.CUSTOMER && req.user.uid !== uid) {
    throw new AppError('Not authorized to view these notifications', 403, 'FORBIDDEN');
  }

  const snapshot = await db
    .collection(COLLECTIONS.USERS)
    .doc(uid)
    .collection(COLLECTIONS.NOTIFICATIONS)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  const notifications = [];
  snapshot.forEach((doc) => {
    notifications.push({
      id: doc.id,
      ...doc.data()
    });
  });

  res.status(200).json({
    success: true,
    count: notifications.length,
    notifications
  });
});

/**
 * Mark notification as read
 * PATCH /users/:uid/notifications/:notificationId
 */
exports.markNotificationRead = asyncHandler(async (req, res) => {
  const { uid, notificationId } = req.params;

  if (req.user.role === ROLES.CUSTOMER && req.user.uid !== uid) {
    throw new AppError('Not authorized to update this notification', 403, 'FORBIDDEN');
  }

  await db
    .collection(COLLECTIONS.USERS)
    .doc(uid)
    .collection(COLLECTIONS.NOTIFICATIONS)
    .doc(notificationId)
    .update({
      readAt: new Date().toISOString()
    });

  res.status(200).json({
    success: true,
    message: 'Notification marked as read'
  });
});
