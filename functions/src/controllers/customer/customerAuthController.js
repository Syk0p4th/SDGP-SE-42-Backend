const { admin, db, auth } = require('../../config/firebase');
const { successResponse, errorResponse } = require('../../utils/response');
const { handleAuthError } = require('../../utils/errorHandler');

/**
 * Customer Sign In
 * Receives email and password from Flutter app
 * Verifies credentials and checks if user exists in database
 */
exports.signIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log(`Login attempt for email: ${email}`);

    // Step 1: Get user by email from Firebase Auth
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        return errorResponse(res, 'Invalid email or password', 401);
      }
      throw error;
    }

    // Step 2: Verify the user exists in our customers collection
    const customerDoc = await db.collection('customers').doc(userRecord.uid).get();

    if (!customerDoc.exists) {
      return errorResponse(
        res, 
        'Customer account not found. Please sign up first.', 
        404
      );
    }

    const customerData = customerDoc.data();

    // Step 3: Check if customer account is active
    if (customerData.isDisabled) {
      return errorResponse(
        res, 
        'Your account has been disabled. Please contact support.', 
        403
      );
    }

    // Step 4: Create a custom token for the user
    // The Flutter app will use this token to signInWithCustomToken
    const customToken = await auth.createCustomToken(userRecord.uid);

    // Step 5: Update last login timestamp
    await db.collection('customers').doc(userRecord.uid).update({
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Step 6: Return success response with user data and token
    return successResponse(
      res,
      {
        token: customToken,
        user: {
          uid: userRecord.uid,
          email: customerData.email,
          displayName: customerData.displayName,
          phoneNumber: customerData.phoneNumber,
          photoURL: customerData.photoURL || null,
          emailVerified: userRecord.emailVerified,
          userType: 'customer',
          createdAt: customerData.createdAt
        }
      },
      'Login successful',
      200
    );

  } catch (error) {
    console.error('Login error:', error);

    // Handle specific Firebase Auth errors
    if (error.code && error.code.startsWith('auth/')) {
      const { message } = handleAuthError(error);
      return errorResponse(res, message, 401);
    }

    return errorResponse(res, 'Login failed. Please try again.', 500);
  }
};

/**
 * Customer Sign Up
 */
exports.signUp = async (req, res) => {
  try {
    const { email, password, displayName, phoneNumber } = req.body;

    console.log(`Signup attempt for email: ${email}`);

    // Step 1: Create Firebase Auth user
    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
      phoneNumber: phoneNumber || null,
      emailVerified: false
    });

    console.log(`Firebase user created: ${userRecord.uid}`);

    // Step 2: Create customer document in Firestore
    const customerData = {
      uid: userRecord.uid,
      email,
      displayName,
      phoneNumber: phoneNumber || null,
      photoURL: null,
      userType: 'customer',
      addresses: [],
      favoriteProviders: [],
      isDisabled: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: null
    };

    await db.collection('customers').doc(userRecord.uid).set(customerData);

    console.log(`Customer document created in Firestore`);

    // Step 3: Create custom token
    const customToken = await auth.createCustomToken(userRecord.uid);

    // Step 4: Send verification email (optional)
    // You can implement this later with email service

    // Step 5: Return success response
    return successResponse(
      res,
      {
        token: customToken,
        user: {
          uid: userRecord.uid,
          email,
          displayName,
          phoneNumber,
          userType: 'customer',
          emailVerified: false
        }
      },
      'Account created successfully',
      201
    );

  } catch (error) {
    console.error('Signup error:', error);

    // Handle specific errors
    if (error.code === 'auth/email-already-exists') {
      return errorResponse(res, 'Email already in use', 400);
    }

    if (error.code === 'auth/invalid-email') {
      return errorResponse(res, 'Invalid email address', 400);
    }

    if (error.code === 'auth/weak-password') {
      return errorResponse(res, 'Password is too weak', 400);
    }

    return errorResponse(res, 'Signup failed. Please try again.', 500);
  }
};

/**
 * Get Customer Profile
 */
exports.getProfile = async (req, res) => {
  try {
    const customerDoc = await db.collection('customers').doc(req.user.uid).get();

    if (!customerDoc.exists) {
      return errorResponse(res, 'Customer not found', 404);
    }

    return successResponse(res, customerDoc.data(), 'Profile retrieved successfully');

  } catch (error) {
    console.error('Get profile error:', error);
    return errorResponse(res, 'Failed to retrieve profile', 500);
  }
};

/**
 * Logout (optional - mainly handled on client side)
 */
exports.signOut = async (req, res) => {
  try {
    // You can add additional logout logic here if needed
    // like revoking refresh tokens, logging logout activity, etc.

    return successResponse(res, null, 'Logged out successfully');

  } catch (error) {
    console.error('Logout error:', error);
    return errorResponse(res, 'Logout failed', 500);
  }
};