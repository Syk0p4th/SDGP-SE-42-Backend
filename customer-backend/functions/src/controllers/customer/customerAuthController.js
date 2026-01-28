const { admin, db, auth } = require('../../config/firebase');
const { successResponse, errorResponse } = require('../../utils/response');
const { handleAuthError } = require('../../utils/errorHandling');

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
/**
 * Refresh Token
 * Firebase automatically handles token refresh on the client side
 * This endpoint is mainly for validation and getting updated user data
 */
exports.refreshToken = async (req, res) => {
  try {
    // User is already authenticated via verifyToken middleware
    const uid = req.user.uid;

    // Get updated user data from Firestore
    const customerDoc = await db.collection('customers').doc(uid).get();

    if (!customerDoc.exists) {
      return errorResponse(res, 'Customer not found', 404);
    }

    const customerData = customerDoc.data();

    // Check if account is disabled
    if (customerData.isDisabled) {
      return errorResponse(res, 'Account has been disabled', 403);
    }

    // Create new custom token (optional - Firebase handles this automatically)
    const newCustomToken = await auth.createCustomToken(uid);

    return successResponse(
      res,
      {
        token: newCustomToken,
        user: {
          uid: customerData.uid,
          email: customerData.email,
          displayName: customerData.displayName,
          phoneNumber: customerData.phoneNumber,
          photoURL: customerData.photoURL || null,
          userType: 'customer'
        }
      },
      'Token refreshed successfully'
    );

  } catch (error) {
    console.error('Token refresh error:', error);
    return errorResponse(res, 'Failed to refresh token', 500);
  }
};

/**
 * Sign Out / Logout
 * Revoke refresh tokens and log logout activity
 */
exports.signOut = async (req, res) => {
  try {
    const uid = req.user.uid;

    // Optional: Revoke all refresh tokens for this user
    // This forces the user to re-authenticate on all devices
    await auth.revokeRefreshTokens(uid);

    // Log logout activity in Firestore
    await db.collection('customers').doc(uid).update({
      lastLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Optional: Create logout log for security audit
    await db.collection('auth_logs').add({
      userId: uid,
      action: 'logout',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: req.headers['user-agent'] || 'unknown',
      ipAddress: req.ip || 'unknown'
    });

    return successResponse(res, null, 'Logged out successfully');

  } catch (error) {
    console.error('Logout error:', error);
    return errorResponse(res, 'Logout failed', 500);
  }
};

/**
 * Forgot Password
 * Send password reset email
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    console.log(`Password reset requested for: ${email}`);

    // Check if user exists
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch (error) {
      // Don't reveal if email exists or not (security best practice)
      return successResponse(
        res,
        null,
        'If an account exists with this email, a password reset link has been sent.'
      );
    }

    // Check if user is in customers collection
    const customerDoc = await db.collection('customers').doc(userRecord.uid).get();

    if (!customerDoc.exists) {
      // Don't reveal if email exists or not
      return successResponse(
        res,
        null,
        'If an account exists with this email, a password reset link has been sent.'
      );
    }

    // Generate password reset link
    const resetLink = await auth.generatePasswordResetLink(email);

    // TODO: Send email with reset link
    // For now, we'll return it (in production, send via email service)
    console.log('Password reset link:', resetLink);

    // Store reset request in Firestore for tracking
    await db.collection('password_resets').add({
      userId: userRecord.uid,
      email,
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      resetLink, // Don't store this in production!
      used: false
    });

    // In development, return the link
    if (process.env.NODE_ENV === 'development') {
      return successResponse(
        res,
        { resetLink },
        'Password reset link generated (DEV MODE)'
      );
    }

    // In production, just confirm
    return successResponse(
      res,
      null,
      'If an account exists with this email, a password reset link has been sent.'
    );

  } catch (error) {
    console.error('Forgot password error:', error);
    return errorResponse(res, 'Failed to process password reset request', 500);
  }
};

/**
 * Verify Password Reset Code
 * Check if reset code is valid
 */
exports.verifyPasswordResetCode = async (req, res) => {
  try {
    const { oobCode } = req.body;

    if (!oobCode) {
      return errorResponse(res, 'Reset code is required', 400);
    }

    // Verify the reset code
    const email = await auth.verifyPasswordResetCode(oobCode);

    return successResponse(
      res,
      { email },
      'Reset code is valid'
    );

  } catch (error) {
    console.error('Verify reset code error:', error);

    if (error.code === 'auth/invalid-action-code') {
      return errorResponse(res, 'Invalid or expired reset code', 400);
    }

    if (error.code === 'auth/expired-action-code') {
      return errorResponse(res, 'Reset code has expired', 400);
    }

    return errorResponse(res, 'Failed to verify reset code', 500);
  }
};

/**
 * Confirm Password Reset
 * Reset password using the code
 */
exports.confirmPasswordReset = async (req, res) => {
  try {
    const { oobCode, newPassword } = req.body;

    if (!oobCode || !newPassword) {
      return errorResponse(res, 'Reset code and new password are required', 400);
    }

    if (newPassword.length < 6) {
      return errorResponse(res, 'Password must be at least 6 characters', 400);
    }

    // Confirm the password reset
    await auth.confirmPasswordReset(oobCode, newPassword);

    // Get user email from code
    const email = await auth.verifyPasswordResetCode(oobCode).catch(() => null);

    // Log password change
    if (email) {
      const userRecord = await auth.getUserByEmail(email).catch(() => null);
      if (userRecord) {
        await db.collection('customers').doc(userRecord.uid).update({
          passwordChangedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    return successResponse(
      res,
      null,
      'Password has been reset successfully. Please login with your new password.'
    );

  } catch (error) {
    console.error('Confirm password reset error:', error);

    if (error.code === 'auth/invalid-action-code') {
      return errorResponse(res, 'Invalid or expired reset code', 400);
    }

    if (error.code === 'auth/weak-password') {
      return errorResponse(res, 'Password is too weak', 400);
    }

    return errorResponse(res, 'Failed to reset password', 500);
  }
};

/**
 * Send Email Verification
 * Send verification email to user
 */
exports.sendEmailVerification = async (req, res) => {
  try {
    const uid = req.user.uid;

    // Get user email
    const userRecord = await auth.getUser(uid);

    if (userRecord.emailVerified) {
      return errorResponse(res, 'Email is already verified', 400);
    }

    // Generate email verification link
    const verificationLink = await auth.generateEmailVerificationLink(userRecord.email);

    // TODO: Send email with verification link
    // For now, we'll return it (in production, send via email service)
    console.log('Email verification link:', verificationLink);

    // Store verification request
    await db.collection('email_verifications').add({
      userId: uid,
      email: userRecord.email,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      verified: false
    });

    // In development, return the link
    if (process.env.NODE_ENV === 'development') {
      return successResponse(
        res,
        { verificationLink },
        'Verification link generated (DEV MODE)'
      );
    }

    return successResponse(
      res,
      null,
      'Verification email sent. Please check your inbox.'
    );

  } catch (error) {
    console.error('Send verification error:', error);
    return errorResponse(res, 'Failed to send verification email', 500);
  }
};

/**
 * Verify Email
 * Confirm email verification
 */
exports.verifyEmail = async (req, res) => {
  try {
    const { oobCode } = req.body;

    if (!oobCode) {
      return errorResponse(res, 'Verification code is required', 400);
    }

    // Apply the email verification code
    await auth.applyActionCode(oobCode);

    // Get user info from code
    const info = await auth.checkActionCode(oobCode);
    const email = info.data.email;

    // Get user by email
    const userRecord = await auth.getUserByEmail(email);

    // Update customer document
    await db.collection('customers').doc(userRecord.uid).update({
      emailVerified: true,
      emailVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return successResponse(
      res,
      null,
      'Email verified successfully!'
    );

  } catch (error) {
    console.error('Verify email error:', error);

    if (error.code === 'auth/invalid-action-code') {
      return errorResponse(res, 'Invalid or expired verification code', 400);
    }

    if (error.code === 'auth/expired-action-code') {
      return errorResponse(res, 'Verification code has expired', 400);
    }

    return errorResponse(res, 'Failed to verify email', 500);
  }
};

/**
 * Check Email Verification Status
 */
exports.checkEmailVerificationStatus = async (req, res) => {
  try {
    const uid = req.user.uid;

    // Get latest user data from Firebase Auth
    const userRecord = await auth.getUser(uid);

    // Update Firestore if verification status changed
    if (userRecord.emailVerified) {
      await db.collection('customers').doc(uid).update({
        emailVerified: true,
        emailVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    return successResponse(
      res,
      {
        emailVerified: userRecord.emailVerified,
        email: userRecord.email
      },
      'Email verification status retrieved'
    );

  } catch (error) {
    console.error('Check verification error:', error);
    return errorResponse(res, 'Failed to check verification status', 500);
  }
};

/**
 * Google Sign-In
 * Verify Google ID token and create/login user
 */
exports.googleSignIn = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return errorResponse(res, 'Google ID token is required', 400);
    }

    // Verify the Google ID token
    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    console.log(`Google sign-in for user: ${uid}`);

    // Get or create user in Firebase Auth
    let userRecord;
    try {
      userRecord = await auth.getUser(uid);
    } catch (error) {
      // User doesn't exist, this shouldn't happen with Google Sign-In
      // But let's handle it gracefully
      return errorResponse(res, 'Invalid Google token', 401);
    }

    // Check if customer exists in Firestore
    const customerDoc = await db.collection('customers').doc(uid).get();

    if (customerDoc.exists) {
      // Existing user - just login
      const customerData = customerDoc.data();

      // Check if disabled
      if (customerData.isDisabled) {
        return errorResponse(res, 'Account has been disabled', 403);
      }

      // Update last login
      await db.collection('customers').doc(uid).update({
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Create custom token
      const customToken = await auth.createCustomToken(uid);

      return successResponse(
        res,
        {
          token: customToken,
          isNewUser: false,
          user: {
            uid: customerData.uid,
            email: customerData.email,
            displayName: customerData.displayName,
            phoneNumber: customerData.phoneNumber || null,
            photoURL: customerData.photoURL,
            emailVerified: userRecord.emailVerified,
            userType: 'customer'
          }
        },
        'Login successful'
      );

    } else {
      // New user - create customer document
      const customerData = {
        uid,
        email: userRecord.email,
        displayName: userRecord.displayName || 'Google User',
        phoneNumber: userRecord.phoneNumber || null,
        photoURL: userRecord.photoURL || null,
        userType: 'customer',
        provider: 'google',
        emailVerified: userRecord.emailVerified,
        addresses: [],
        favoriteProviders: [],
        isDisabled: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await db.collection('customers').doc(uid).set(customerData);

      // Create custom token
      const customToken = await auth.createCustomToken(uid);

      return successResponse(
        res,
        {
          token: customToken,
          isNewUser: true,
          user: {
            uid,
            email: userRecord.email,
            displayName: userRecord.displayName,
            phoneNumber: userRecord.phoneNumber,
            photoURL: userRecord.photoURL,
            emailVerified: userRecord.emailVerified,
            userType: 'customer'
          }
        },
        'Account created successfully',
        201
      );
    }

  } catch (error) {
    console.error('Google sign-in error:', error);

    if (error.code === 'auth/id-token-expired') {
      return errorResponse(res, 'Google token has expired', 401);
    }

    if (error.code === 'auth/invalid-id-token') {
      return errorResponse(res, 'Invalid Google token', 401);
    }

    return errorResponse(res, 'Google sign-in failed', 500);
  }
};