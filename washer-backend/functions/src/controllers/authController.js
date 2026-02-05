/* eslint-disable max-len */
const { auth, db } = require('../config/firebase');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { ROLES, USER_STATUS, WASHER_STATUS, COLLECTIONS } = require('../utils/constants');
const logger = require('../config/logger');

/**
 * Register a new customer
 * POST /auth/register
 */
exports.register = asyncHandler(async (req, res) => {
  const { email, password, displayName, phoneNumber } = req.body;

  // Validate required fields
  if (!email || !password || !displayName) {
    throw new AppError('Email, password, and display name are required', 400, 'VALIDATION_ERROR');
  }

  // Create Firebase Auth user
  const userRecord = await auth.createUser({
    email,
    password,
    displayName,
    phoneNumber: phoneNumber || null,
    emailVerified: false
  });

  // Create user document in Firestore
  const userData = {
    uid: userRecord.uid,
    email,
    displayName,
    phoneNumber: phoneNumber || null,
    role: ROLES.CUSTOMER,
    status: USER_STATUS.ACTIVE,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    preferences: {
      notifications: {
        email: true,
        sms: false
      }
    }
  };

  await db.collection(COLLECTIONS.USERS).doc(userRecord.uid).set(userData);

  // Send verification email
  const actionCodeSettings = {
    url: process.env.EMAIL_VERIFICATION_REDIRECT_URL || 'http://localhost:3000/verify-email'
  };

  try {
    await auth.generateEmailVerificationLink(email, actionCodeSettings);
    logger.info('Email verification link generated', { uid: userRecord.uid, email });
    // In production, send this link via email service
  } catch (error) {
    logger.warn('Failed to generate email verification link', { error: error.message });
  }

  logger.logAuth('register', userRecord.uid, true);
  logger.info('User registered successfully', { uid: userRecord.uid, email, role: ROLES.CUSTOMER });

  res.status(201).json({
    success: true,
    message: 'User registered successfully. Please verify your email.',
    user: {
      uid: userRecord.uid,
      email: userData.email,
      displayName: userData.displayName,
      role: userData.role
    }
  });
});

/**
 * Login user (returns custom token or instructs client to use Firebase Auth)
 * POST /auth/login
 */
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError('Email and password are required', 400, 'VALIDATION_ERROR');
  }

  // Note: Password verification happens on the client using Firebase Auth SDK
  // This endpoint just validates that the user exists and updates lastLoginAt
  // Client should send ID token after successful Firebase Auth login

  // In actual implementation, client handles auth and sends token
  // This is a placeholder for demonstration

  res.status(200).json({
    success: true,
    message: 'Please authenticate using Firebase Auth SDK on client side',
    instructions: 'Use firebase.auth().signInWithEmailAndPassword(email, password) and send the ID token'
  });
});

/**
 * Get current user profile
 * GET /auth/profile
 */
exports.getProfile = asyncHandler(async (req, res) => {
  const userDoc = await db.collection(COLLECTIONS.USERS).doc(req.user.uid).get();

  if (!userDoc.exists) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  const userData = userDoc.data();

  res.status(200).json({
    success: true,
    user: userData
  });
});

/**
 * Update user profile
 * PATCH /auth/profile
 */
exports.updateProfile = asyncHandler(async (req, res) => {
  const { displayName, phoneNumber, address, preferences } = req.body;

  const updates = {};

  if (displayName) updates.displayName = displayName;
  if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
  if (address) updates.address = address;
  if (preferences) updates.preferences = preferences;

  if (Object.keys(updates).length === 0) {
    throw new AppError('No fields to update', 400, 'VALIDATION_ERROR');
  }

  // Update Firestore
  await db.collection(COLLECTIONS.USERS).doc(req.user.uid).update(updates);

  // Update Firebase Auth if name changed
  if (displayName) {
    await auth.updateUser(req.user.uid, { displayName });
  }

  logger.info('Profile updated', { uid: req.user.uid, fields: Object.keys(updates) });

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    updates
  });
});

/**
 * Create staff or admin user (admin only)
 * POST /auth/create-staff
 */
exports.createStaff = asyncHandler(async (req, res) => {
  const { email, password, displayName, phoneNumber, role } = req.body;

  // Validate inputs
  if (!email || !password || !displayName || !role) {
    throw new AppError('Email, password, displayName, and role are required', 400, 'VALIDATION_ERROR');
  }

  if (![ROLES.STAFF, ROLES.ADMIN].includes(role)) {
    throw new AppError('Invalid role. Must be staff or admin', 400, 'INVALID_ROLE');
  }

  // Create Firebase Auth user
  const userRecord = await auth.createUser({
    email,
    password,
    displayName,
    phoneNumber: phoneNumber || null,
    emailVerified: true // Staff don't need email verification
  });

  // Create user document
  const userData = {
    uid: userRecord.uid,
    email,
    displayName,
    phoneNumber: phoneNumber || null,
    role,
    status: USER_STATUS.ACTIVE,
    createdAt: new Date().toISOString(),
    createdBy: req.user.uid,
    lastLoginAt: null
  };

  await db.collection(COLLECTIONS.USERS).doc(userRecord.uid).set(userData);

  logger.info('Staff user created', {
    uid: userRecord.uid,
    email,
    role,
    createdBy: req.user.uid
  });

  res.status(201).json({
    success: true,
    message: `${role} user created successfully`,
    user: {
      uid: userRecord.uid,
      email: userData.email,
      displayName: userData.displayName,
      role: userData.role
    }
  });
});

/**
 * Disable user account (admin only)
 * POST /auth/disable/:uid
 */
exports.disableUser = asyncHandler(async (req, res) => {
  const { uid } = req.params;

  // Cannot disable yourself
  if (uid === req.user.uid) {
    throw new AppError('Cannot disable your own account', 400, 'INVALID_OPERATION');
  }

  // Disable in Firestore
  await db.collection(COLLECTIONS.USERS).doc(uid).update({
    status: USER_STATUS.DISABLED
  });

  // Disable in Firebase Auth
  await auth.updateUser(uid, { disabled: true });

  logger.warn('User disabled', { uid, disabledBy: req.user.uid });

  res.status(200).json({
    success: true,
    message: 'User disabled successfully'
  });
});

/**
 * Enable user account (admin only)
 * POST /auth/enable/:uid
 */
exports.enableUser = asyncHandler(async (req, res) => {
  const { uid } = req.params;

  // Enable in Firestore
  await db.collection(COLLECTIONS.USERS).doc(uid).update({
    status: USER_STATUS.ACTIVE
  });

  // Enable in Firebase Auth
  await auth.updateUser(uid, { disabled: false });

  logger.info('User enabled', { uid, enabledBy: req.user.uid });

  res.status(200).json({
    success: true,
    message: 'User enabled successfully'
  });
});

/**
 * Register a new washer
 * POST /auth/washer/register
 * Saves to 'providers' collection with role 'washer'
 */
exports.registerWasher = asyncHandler(async (req, res) => {
  const { email, password, displayName, phoneNumber, experience, serviceAreas } = req.body;

  // Validate required fields
  if (!email || !password || !displayName || !phoneNumber) {
    throw new AppError('Email, password, display name, and phone number are required', 400, 'VALIDATION_ERROR');
  }

  // Create Firebase Auth user
  const userRecord = await auth.createUser({
    email,
    password,
    displayName,
    phoneNumber,
    emailVerified: false
  });

  // Create provider document in Firestore (providers collection)
  const providerData = {
    uid: userRecord.uid,
    email,
    displayName,
    phoneNumber,
    role: ROLES.WASHER,
    status: USER_STATUS.ACTIVE,
    washerStatus: WASHER_STATUS.PENDING_APPROVAL,
    experience: experience || 0,
    serviceAreas: serviceAreas || [],
    totalJobs: 0,
    rating: 0,
    reviewCount: 0,
    availability: true,
    createdAt: new Date().toISOString(),
    lastLoginAt: null
  };

  // Save to providers collection instead of users
  await db.collection(COLLECTIONS.PROVIDERS).doc(userRecord.uid).set(providerData);

  logger.logAuth('register_washer', userRecord.uid, true);
  logger.info('Washer registered successfully', { uid: userRecord.uid, email, collection: 'providers' });

  res.status(201).json({
    success: true,
    message: 'Washer registered successfully. Your account is pending approval.',
    user: {
      uid: userRecord.uid,
      email: providerData.email,
      displayName: providerData.displayName,
      role: providerData.role,
      washerStatus: providerData.washerStatus
    }
  });
});

/**
 * Login washer (validates washer role and returns status)
 * POST /auth/washer/login
 * Reads from 'providers' collection
 */
exports.loginWasher = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new AppError('Email is required', 400, 'VALIDATION_ERROR');
  }

  // Get user by email
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
  } catch (error) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Get provider document from Firestore (providers collection)
  const providerDoc = await db.collection(COLLECTIONS.PROVIDERS).doc(userRecord.uid).get();

  if (!providerDoc.exists) {
    throw new AppError('Provider profile not found', 404, 'PROVIDER_NOT_FOUND');
  }

  const providerData = providerDoc.data();

  // Verify user is a washer
  if (providerData.role !== ROLES.WASHER) {
    throw new AppError('This endpoint is only for washer accounts', 403, 'INVALID_ROLE');
  }

  res.status(200).json({
    success: true,
    message: 'Please authenticate using Firebase Auth SDK on client side',
    instructions: 'Use firebase.auth().signInWithEmailAndPassword(email, password) and send the ID token',
    washerInfo: {
      uid: userRecord.uid,
      email: providerData.email,
      displayName: providerData.displayName,
      washerStatus: providerData.washerStatus,
      experience: providerData.experience || 0,
      rating: providerData.rating || 0
    }
  });
});

/**
 * Update last login timestamp
 * POST /auth/update-login
 */
exports.updateLastLogin = asyncHandler(async (req, res) => {
  await db.collection(COLLECTIONS.USERS).doc(req.user.uid).update({
    lastLoginAt: new Date().toISOString()
  });

  res.status(200).json({
    success: true,
    message: 'Last login updated'
  });
});
