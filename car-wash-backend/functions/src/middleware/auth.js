/* eslint-disable max-len */
const { auth, db } = require('../config/firebase');
const { AppError, asyncHandler } = require('./errorHandler');
const { ROLES, COLLECTIONS } = require('../utils/constants');
const logger = require('../config/logger');

/**
 * Verify Firebase ID token and attach user to request
 */
const authenticate = asyncHandler(async (req, res, next) => {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('No token provided', 401, 'UNAUTHORIZED');
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    // Verify token with Firebase
    const decodedToken = await auth.verifyIdToken(token);

    // Get user document from Firestore
    const userDoc = await db.collection(COLLECTIONS.USERS).doc(decodedToken.uid).get();

    if (!userDoc.exists) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const userData = userDoc.data();

    // Check if user is disabled
    if (userData.status === 'disabled') {
      throw new AppError('Account is disabled', 403, 'ACCOUNT_DISABLED');
    }

    // Attach user to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      ...userData
    };

    logger.logAuth('authenticate', req.user.uid, true);
    next();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.logAuth('authenticate', 'unknown', false);
    throw new AppError('Invalid or expired token', 401, 'INVALID_TOKEN');
  }
});

/**
 * Check if user has required role
 * @param {Array<string>} allowedRoles - Array of allowed roles
 */
const authorize = (...allowedRoles) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Authorization failed', {
        userId: req.user.uid,
        userRole: req.user.role,
        requiredRoles: allowedRoles
      });
      throw new AppError(
        'Insufficient permissions',
        403,
        'FORBIDDEN'
      );
    }

    next();
  });
};

/**
 * Check if user is customer
 */
const isCustomer = authorize(ROLES.CUSTOMER, ROLES.STAFF, ROLES.ADMIN);

/**
 * Check if user is staff or admin
 */
const isStaff = authorize(ROLES.STAFF, ROLES.ADMIN);

/**
 * Check if user is admin
 */
const isAdmin = authorize(ROLES.ADMIN);

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await auth.verifyIdToken(token);
    const userDoc = await db.collection(COLLECTIONS.USERS).doc(decodedToken.uid).get();

    if (userDoc.exists) {
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        ...userDoc.data()
      };
    }
  } catch (error) {
    // Silently fail for optional auth
    logger.debug('Optional auth failed', { error: error.message });
  }

  next();
});

module.exports = {
  authenticate,
  authorize,
  isCustomer,
  isStaff,
  isAdmin,
  optionalAuth
};
