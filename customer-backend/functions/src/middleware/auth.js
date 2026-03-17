const { admin } = require('../config/firebase');
const { errorResponse } = require('../utils/response');

/**
 * Verify Firebase ID token from request headers
 */
const verifyToken = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'No token provided', 401);
    }

    const token = authHeader.split('Bearer ')[1];

    if (!token) {
      return errorResponse(res, 'No token provided', 401);
    }

    // Verify the token
    const decodedToken = await admin.auth().verifyIdToken(token);
    console.log(`[AUTH] 🔍 Decoded token for UID: ${decodedToken.uid}`);
    
    // Attach user info to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      email_verified: decodedToken.email_verified
    };

    console.log(`[AUTH] ✅ User attached: ${req.user.uid}`);
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return errorResponse(res, 'Token has expired', 401);
    }
    
    if (error.code === 'auth/argument-error') {
      return errorResponse(res, 'Invalid token format', 401);
    }
    
    return errorResponse(res, 'Invalid or expired token', 401);
  }
};

/**
 * Check if user is a customer
 */
const isCustomer = async (req, res, next) => {
  try {
    const { db } = require('../config/firebase');
    const userDoc = await db.collection('customers').doc(req.user.uid).get();
    
    if (!userDoc.exists) {
      return errorResponse(res, 'Customer not found', 404);
    }

    req.customer = userDoc.data();
    next();
  } catch (error) {
    console.error('Customer check error:', error);
    return errorResponse(res, 'Error verifying customer', 500);
  }
};

module.exports = {
  verifyToken,
  isCustomer
};