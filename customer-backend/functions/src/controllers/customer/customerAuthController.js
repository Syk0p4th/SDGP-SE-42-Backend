const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { admin, db, auth } = require('../../config/firebase');
const { clientAuth } = require('../../config/firebaseclient');
const {
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
  checkActionCode,
} = require('firebase/auth');
const { successResponse, errorResponse } = require('../../utils/response');
const { handleAuthError } = require('../../utils/errorHandling');

// ── Email transporter ─────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // use Gmail App Password if 2FA enabled
  },
});

// ============================================================
// SIGN IN
// POST /auth/signin
// ============================================================
exports.signIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log(`Login attempt for email: ${email}`);

    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        return errorResponse(res, 'Invalid email or password', 401);
      }
      throw error;
    }

    const customerDoc = await db.collection('customers').doc(userRecord.uid).get();
    if (!customerDoc.exists) {
      return errorResponse(res, 'Customer account not found. Please sign up first.', 404);
    }

    const customerData = customerDoc.data();
    if (customerData.isDisabled) {
      return errorResponse(res, 'Your account has been disabled. Please contact support.', 403);
    }

    const customToken = await auth.createCustomToken(userRecord.uid);

    await db.collection('customers').doc(userRecord.uid).update({
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

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
          createdAt: customerData.createdAt,
        },
      },
      'Login successful',
      200
    );
  } catch (error) {
    console.error('Login error:', error);
    if (error.code && typeof error.code === 'string' && error.code.startsWith('auth/')) {
      const { message } = handleAuthError(error);
      return errorResponse(res, message, 401);
    }
    return errorResponse(res, 'Login failed. Please try again.', 500);
  }
};

// ============================================================
// SIGN UP
// POST /auth/signup
// ============================================================
exports.signUp = async (req, res) => {
  try {
    const { email, password, displayName, phoneNumber } = req.body;

    console.log(`Signup attempt for email: ${email}`);

    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
      phoneNumber: phoneNumber || null,
      emailVerified: false,
    });

    console.log(`Firebase user created: ${userRecord.uid}`);

    const customerData = {
      uid: userRecord.uid,
      email,
      displayName,
      phoneNumber: phoneNumber || null,
      photoURL: null,
      userType: 'customer',
      subscription: 'none',
      isSubscribed: false,
      emailVerified: false,
      addresses: [],
      favoriteProviders: [],
      isDisabled: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: null,
    };

    await db.collection('customers').doc(userRecord.uid).set(customerData);

    console.log('Customer document created in Firestore');

    const customToken = await auth.createCustomToken(userRecord.uid);

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
          emailVerified: false,
        },
      },
      'Account created successfully',
      201
    );
  } catch (error) {
    console.error('Signup error:', error);
    if (error.code === 'auth/email-already-exists') return errorResponse(res, 'Email already in use', 400);
    if (error.code === 'auth/invalid-email') return errorResponse(res, 'Invalid email address', 400);
    if (error.code === 'auth/weak-password') return errorResponse(res, 'Password is too weak', 400);
    return errorResponse(res, 'Signup failed. Please try again.', 500);
  }
};

// ============================================================
// SEND VERIFICATION EMAIL — OTP via Nodemailer
// POST /auth/send-verification-email
// Body: { email }
// No auth required — called during signup before user is logged in
// ============================================================
exports.sendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    // Generate 6-digit OTP
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store in Firestore
    await db.collection('email_verifications').doc(email).set({
      code,
      expiresAt,
      attempts: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Send email
    await transporter.sendMail({
      from: `"WashXpress" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your WashXpress Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #0d1629; font-size: 24px; margin: 0;">WashXpress</h1>
          </div>
          <div style="background: #fff; border-radius: 12px; padding: 32px; text-align: center;">
            <h2 style="color: #0d1629; margin-bottom: 8px;">Verify your email</h2>
            <p style="color: #64748b; margin-bottom: 24px;">Enter this code in the app to verify your email address.</p>
            <div style="background: #eff6ff; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <span style="font-size: 40px; font-weight: 800; color: #0ca6e8; letter-spacing: 8px;">${code}</span>
            </div>
            <p style="color: #94a3b8; font-size: 13px;">This code expires in <strong>10 minutes</strong>.</p>
            <p style="color: #94a3b8; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
          </div>
          <p style="text-align: center; color: #cbd5e1; font-size: 12px; margin-top: 24px;">© 2025 WashXpress · Sri Lanka</p>
        </div>
      `,
    });

    console.log(`Verification email sent to: ${email}`);
    return res.status(200).json({ success: true, message: 'Verification code sent to your email.' });

  } catch (error) {
    console.error('Send verification email error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send verification email.' });
  }
};

// ============================================================
// VERIFY EMAIL — OTP code (matches sendVerificationEmail above)
// POST /auth/verify-email
// Body: { email, code }
// No auth required — called during signup before user is logged in
// ============================================================
exports.verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Email and code are required' });
    }

    const verDoc = await db.collection('email_verifications').doc(email).get();
    if (!verDoc.exists) {
      return res.status(400).json({
        success: false,
        message: 'No verification code found. Please request a new one.',
      });
    }

    const data = verDoc.data();

    // Too many attempts
    if (data.attempts >= 5) {
      await db.collection('email_verifications').doc(email).delete();
      return res.status(400).json({
        success: false,
        message: 'Too many attempts. Please request a new code.',
      });
    }

    // Expired
    if (Date.now() > data.expiresAt) {
      await db.collection('email_verifications').doc(email).delete();
      return res.status(400).json({
        success: false,
        message: 'Code has expired. Please request a new one.',
      });
    }

    // Wrong code — increment attempts
    if (data.code !== code) {
      await db.collection('email_verifications').doc(email).update({
        attempts: admin.firestore.FieldValue.increment(1),
      });
      return res.status(400).json({ success: false, message: 'Incorrect code. Please try again.' });
    }

    // ✅ Correct — clean up verification doc
    await db.collection('email_verifications').doc(email).delete();

    // Mark customer as email verified in Firestore
    const usersSnap = await db.collection('customers').where('email', '==', email).limit(1).get();
    if (!usersSnap.empty) {
      await usersSnap.docs[0].ref.update({
        emailVerified: true,
        emailVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Also update Firebase Auth emailVerified flag (best effort)
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      await admin.auth().updateUser(userRecord.uid, { emailVerified: true });
      console.log(`Firebase Auth emailVerified updated for: ${email}`);
    } catch (authErr) {
      console.warn('Failed to update Firebase Auth emailVerified (non-fatal):', authErr.message);
    }

    return res.status(200).json({ success: true, message: 'Email verified successfully.' });

  } catch (error) {
    console.error('Verify email error:', error);
    return res.status(500).json({ success: false, message: 'Verification failed.' });
  }
};

// ============================================================
// CHECK EMAIL VERIFICATION STATUS
// GET /auth/check-email-verification
// ============================================================
exports.checkEmailVerificationStatus = async (req, res) => {
  try {
    const uid = req.user.uid;
    const userRecord = await auth.getUser(uid);

    if (userRecord.emailVerified) {
      await db.collection('customers').doc(uid).update({
        emailVerified: true,
        emailVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return successResponse(
      res,
      { emailVerified: userRecord.emailVerified, email: userRecord.email },
      'Email verification status retrieved'
    );
  } catch (error) {
    console.error('Check verification error:', error);
    return errorResponse(res, 'Failed to check verification status', 500);
  }
};

// ============================================================
// GET PROFILE
// GET /auth/profile
// ============================================================
exports.getProfile = async (req, res) => {
  try {
    const uid = req.user.uid;
    const customerRef = db.collection('customers').doc(uid);
    const customerDoc = await customerRef.get();

    if (!customerDoc.exists) return errorResponse(res, 'Customer not found', 404);

    const customerData = customerDoc.data();

    const [addressesSnapshot, vehiclesSnapshot, categoriesSnapshot, servicesSnapshot] = await Promise.all([
      customerRef.collection('addresses').get(),
      customerRef.collection('vehicles').where('isActive', '==', true).get(),
      db.collection('categories').where('isActive', '==', true).get(),
      db.collection('services').where('isActive', '==', true).limit(50).get(),
    ]);

    const addresses = addressesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const vehicles = vehiclesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const categories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const services = servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    return successResponse(res, { ...customerData, uid, addresses, vehicles, categories, services }, 'Profile retrieved successfully');
  } catch (error) {
    console.error('Get profile error:', error);
    return errorResponse(res, 'Failed to retrieve profile', 500);
  }
};

// ============================================================
// UPDATE PROFILE
// PATCH /auth/profile
// ============================================================
exports.updateProfile = async (req, res) => {
  try {
    const uid = req.user.uid;
    const { displayName, phoneNumber, bio } = req.body;

    console.log(`Updating profile for user: ${uid}`);

    const updates = {};

    if (displayName !== undefined) {
      if (displayName.trim().length < 2) return errorResponse(res, 'Display name must be at least 2 characters', 400);
      updates.displayName = displayName.trim();
      await auth.updateUser(uid, { displayName: displayName.trim() });
    }

    if (phoneNumber !== undefined) {
      if (phoneNumber && !/^\+?[1-9]\d{1,14}$/.test(phoneNumber.replace(/[\s-]/g, ''))) {
        return errorResponse(res, 'Invalid phone number format', 400);
      }
      updates.phoneNumber = phoneNumber || null;
      if (phoneNumber) await auth.updateUser(uid, { phoneNumber });
    }

    if (bio !== undefined) {
      if (bio && bio.length > 500) return errorResponse(res, 'Bio must be less than 500 characters', 400);
      updates.bio = bio || null;
    }

    if (req.body.agreement !== undefined) updates.agreement = Boolean(req.body.agreement);

    if (req.body.photoURL !== undefined) {
      updates.photoURL = req.body.photoURL || null;
      await auth.updateUser(uid, { photoURL: req.body.photoURL || null });
    }

    if (Object.keys(updates).length === 0) return errorResponse(res, 'No fields to update', 400);

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await db.collection('customers').doc(uid).update(updates);

    const updatedDoc = await db.collection('customers').doc(uid).get();
    const updatedData = updatedDoc.data();

    console.log(`Profile updated successfully for: ${uid}`);

    return successResponse(
      res,
      {
        uid: updatedData.uid,
        email: updatedData.email,
        displayName: updatedData.displayName,
        phoneNumber: updatedData.phoneNumber,
        photoURL: updatedData.photoURL,
        bio: updatedData.bio,
        emailVerified: updatedData.emailVerified,
        userType: updatedData.userType,
      },
      'Profile updated successfully'
    );
  } catch (error) {
    console.error('Update profile error:', error);
    return errorResponse(res, 'Failed to update profile', 500);
  }
};

// ============================================================
// UPLOAD PROFILE PHOTO
// POST /auth/profile/photo
// ============================================================
exports.uploadProfilePhoto = async (req, res) => {
  try {
    const uid = req.user.uid;

    if (!req.file) return errorResponse(res, 'No file uploaded', 400);

    const file = req.file;
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(file.mimetype)) {
      return errorResponse(res, 'Invalid file type. Only JPEG, PNG, and WebP images are allowed', 400);
    }

    if (file.size > 5 * 1024 * 1024) return errorResponse(res, 'File size must be less than 5MB', 400);

    console.log(`Uploading profile photo for user: ${uid}`);

    const fileName = `profile-photos/${uid}/${Date.now()}-${file.originalname}`;
    const bucket = storage.bucket();
    const fileUpload = bucket.file(fileName);

    const blobStream = fileUpload.createWriteStream({
      metadata: {
        contentType: file.mimetype,
        metadata: { firebaseStorageDownloadTokens: uid },
      },
    });

    blobStream.on('error', (error) => {
      console.error('Upload error:', error);
      return errorResponse(res, 'Failed to upload photo', 500);
    });

    blobStream.on('finish', async () => {
      try {
        await fileUpload.makePublic();
        const photoURL = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

        await db.collection('customers').doc(uid).update({ photoURL, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        await auth.updateUser(uid, { photoURL });

        console.log(`Profile photo uploaded successfully for: ${uid}`);
        return successResponse(res, { photoURL }, 'Profile photo uploaded successfully');
      } catch (error) {
        console.error('Error finalizing upload:', error);
        return errorResponse(res, 'Failed to finalize photo upload', 500);
      }
    });

    blobStream.end(file.buffer);
  } catch (error) {
    console.error('Upload profile photo error:', error);
    return errorResponse(res, 'Failed to upload profile photo', 500);
  }
};

// ============================================================
// REFRESH TOKEN
// POST /auth/refresh
// ============================================================
exports.refreshToken = async (req, res) => {
  try {
    const uid = req.user.uid;
    const customerDoc = await db.collection('customers').doc(uid).get();

    if (!customerDoc.exists) return errorResponse(res, 'Customer not found', 404);

    const customerData = customerDoc.data();
    if (customerData.isDisabled) return errorResponse(res, 'Account has been disabled', 403);

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
          userType: 'customer',
        },
      },
      'Token refreshed successfully'
    );
  } catch (error) {
    console.error('Token refresh error:', error);
    return errorResponse(res, 'Failed to refresh token', 500);
  }
};

// ============================================================
// SIGN OUT
// POST /auth/signout
// ============================================================
exports.signOut = async (req, res) => {
  try {
    const uid = req.user.uid;

    await auth.revokeRefreshTokens(uid);

    await db.collection('customers').doc(uid).update({
      lastLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection('auth_logs').add({
      userId: uid,
      action: 'logout',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: req.headers['user-agent'] || 'unknown',
      ipAddress: req.ip || 'unknown',
    });

    return successResponse(res, null, 'Logged out successfully');
  } catch (error) {
    console.error('Logout error:', error);
    return errorResponse(res, 'Logout failed', 500);
  }
};

// ============================================================
// GOOGLE SIGN-IN
// POST /auth/google
// ============================================================
exports.googleSignIn = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return errorResponse(res, 'Google ID token is required', 400);

    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    console.log(`Google sign-in for user: ${uid}`);

    let userRecord;
    try {
      userRecord = await auth.getUser(uid);
    } catch {
      return errorResponse(res, 'Invalid Google token', 401);
    }

    const customerDoc = await db.collection('customers').doc(uid).get();

    if (customerDoc.exists) {
      const customerData = customerDoc.data();
      if (customerData.isDisabled) return errorResponse(res, 'Account has been disabled', 403);

      await db.collection('customers').doc(uid).update({
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

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
            userType: 'customer',
          },
        },
        'Login successful'
      );
    } else {
      const customerData = {
        uid,
        email: userRecord.email,
        displayName: userRecord.displayName || 'Google User',
        phoneNumber: userRecord.phoneNumber || null,
        photoURL: userRecord.photoURL || null,
        userType: 'customer',
        subscription: 'none',
        isSubscribed: false,
        provider: 'google',
        emailVerified: userRecord.emailVerified,
        addresses: [],
        favoriteProviders: [],
        isDisabled: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await db.collection('customers').doc(uid).set(customerData);
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
            userType: 'customer',
          },
        },
        'Account created successfully',
        201
      );
    }
  } catch (error) {
    console.error('Google sign-in error:', error);
    if (error.code === 'auth/id-token-expired') return errorResponse(res, 'Google token has expired', 401);
    if (error.code === 'auth/invalid-id-token') return errorResponse(res, 'Invalid Google token', 401);
    return errorResponse(res, 'Google sign-in failed', 500);
  }
};

// ============================================================
// FORGOT PASSWORD
// POST /auth/forgot-password
// ============================================================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    console.log(`Password reset requested for: ${email}`);

    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch {
      return successResponse(res, null, 'If an account exists with this email, a password reset link has been sent.');
    }

    const customerDoc = await db.collection('customers').doc(userRecord.uid).get();
    if (!customerDoc.exists) {
      return successResponse(res, null, 'If an account exists with this email, a password reset link has been sent.');
    }

    const resetLink = await auth.generatePasswordResetLink(email);
    console.log('Password reset link:', resetLink);

    await db.collection('password_resets').add({
      userId: userRecord.uid,
      email,
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      used: false,
    });

    if (process.env.NODE_ENV === 'development') {
      return successResponse(res, { resetLink }, 'Password reset link generated (DEV MODE)');
    }

    return successResponse(res, null, 'If an account exists with this email, a password reset link has been sent.');
  } catch (error) {
    console.error('Forgot password error:', error);
    return errorResponse(res, 'Failed to process password reset request', 500);
  }
};

// ============================================================
// VERIFY PASSWORD RESET CODE
// POST /auth/verify-reset-code
// ============================================================
exports.verifyPasswordResetCode = async (req, res) => {
  try {
    const { oobCode } = req.body;

    if (!oobCode) return errorResponse(res, 'Reset code is required', 400);
    if (!clientAuth) return errorResponse(res, 'Authentication service not configured', 500);

    const { verifyPasswordResetCode: verifyCode } = require('firebase/auth');
    const email = await verifyCode(clientAuth, oobCode);

    return successResponse(res, { email }, 'Reset code is valid');
  } catch (error) {
    console.error('Verify reset code error:', error.code, error.message);
    if (error.code === 'auth/invalid-action-code') return errorResponse(res, 'Invalid reset code. The code may have expired or already been used.', 400);
    if (error.code === 'auth/expired-action-code') return errorResponse(res, 'Reset code has expired. Please request a new password reset link.', 400);
    if (error.code === 'auth/user-not-found') return errorResponse(res, 'User not found.', 404);
    if (error.code === 'auth/user-disabled') return errorResponse(res, 'This account has been disabled.', 403);
    return errorResponse(res, 'Failed to verify reset code: ' + error.message, 500);
  }
};

// ============================================================
// CONFIRM PASSWORD RESET
// POST /auth/confirm-reset
// ============================================================
exports.confirmPasswordReset = async (req, res) => {
  try {
    const { oobCode, newPassword } = req.body;

    if (!oobCode || !newPassword) return errorResponse(res, 'Reset code and new password are required', 400);
    if (newPassword.length < 6) return errorResponse(res, 'Password must be at least 6 characters', 400);

    await confirmPasswordReset(clientAuth, oobCode, newPassword);

    try {
      const email = await verifyPasswordResetCode(clientAuth, oobCode).catch(() => null);
      if (email) {
        const userRecord = await auth.getUserByEmail(email);
        await db.collection('customers').doc(userRecord.uid).update({
          passwordChangedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (firestoreError) {
      console.warn('Firestore timestamp update failed (non-fatal):', firestoreError.message);
    }

    return successResponse(res, null, 'Password has been reset successfully. Please login with your new password.');
  } catch (error) {
    console.error('Confirm password reset error:', error.code, error.message);
    if (error.code === 'auth/invalid-action-code') return errorResponse(res, 'Invalid or expired reset code.', 400);
    if (error.code === 'auth/expired-action-code') return errorResponse(res, 'Reset code has expired.', 400);
    if (error.code === 'auth/weak-password') return errorResponse(res, 'Password is too weak.', 400);
    if (error.code === 'auth/user-disabled') return errorResponse(res, 'This account has been disabled.', 403);
    return errorResponse(res, 'Failed to reset password: ' + error.message, 500);
  }
};

// ============================================================
// SEND EMAIL VERIFICATION LINK (Firebase-generated link)
// POST /auth/send-email-verification-link
// ============================================================
exports.sendEmailVerificationLink = async (req, res) => {
  try {
    const uid = req.user.uid;
    const userRecord = await auth.getUser(uid);

    if (userRecord.emailVerified) return errorResponse(res, 'Email is already verified', 400);

    const verificationLink = await auth.generateEmailVerificationLink(userRecord.email);
    console.log('Email verification link:', verificationLink);

    await db.collection('email_verifications').add({
      userId: uid,
      email: userRecord.email,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      verified: false,
    });

    if (process.env.NODE_ENV === 'development') {
      return successResponse(res, { verificationLink }, 'Verification link generated (DEV MODE)');
    }

    return successResponse(res, null, 'Verification email sent. Please check your inbox.');
  } catch (error) {
    console.error('Send verification error:', error);
    return errorResponse(res, 'Failed to send verification email', 500);
  }
};