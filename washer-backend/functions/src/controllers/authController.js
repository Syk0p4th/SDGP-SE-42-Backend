/* eslint-disable max-len */
const { db } = require('../config/firebase');
const admin = require('firebase-admin');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { ROLES, USER_STATUS, WASHER_STATUS, COLLECTIONS } = require('../utils/constants');
const logger = require('../config/logger');

const getAuth = () => admin.auth();
const getDb = () => db;

// ── Email transporter ─────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // use Gmail App Password if 2FA enabled
  },
});

/**
 * Send verification email with OTP
 * POST /auth/send-verification-email
 * Body: { email }
 */
exports.sendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    await getDb().collection('email_verifications').doc(email).set({
      code,
      expiresAt,
      attempts: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await transporter.sendMail({
      from: `"WashXpress" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your WashXpress Washer Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0d1629; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #fff; font-size: 24px; margin: 0;">WashXpress</h1>
            <p style="color: #64748b; margin: 4px 0 0;">Washer Portal</p>
          </div>
          <div style="background: #1e2d4a; border-radius: 12px; padding: 32px; text-align: center; border: 1px solid rgba(255,255,255,0.06);">
            <h2 style="color: #fff; margin-bottom: 8px;">Verify your email</h2>
            <p style="color: #94a3b8; margin-bottom: 24px;">Enter this code in the app to verify your washer account.</p>
            <div style="background: rgba(37,99,235,0.2); border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid rgba(37,99,235,0.4);">
              <span style="font-size: 40px; font-weight: 800; color: #60a5fa; letter-spacing: 8px;">${code}</span>
            </div>
            <p style="color: #64748b; font-size: 13px;">This code expires in <strong style="color: #94a3b8;">10 minutes</strong>.</p>
            <p style="color: #64748b; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
          </div>
          <p style="text-align: center; color: #374151; font-size: 12px; margin-top: 24px;">© 2025 WashXpress · Sri Lanka</p>
        </div>
      `,
    });

    logger.info('Verification email sent', { email });
    return res.status(200).json({ success: true, message: 'Verification code sent to your email.' });

  } catch (error) {
    console.error('Send verification email error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send verification email.' });
  }
};

/**
 * Verify email OTP code
 * POST /auth/verify-email
 * Body: { email, code }
 */
exports.verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Email and code are required' });
    }

    const verDoc = await getDb().collection('email_verifications').doc(email).get();
    if (!verDoc.exists) {
      return res.status(400).json({
        success: false,
        message: 'No verification code found. Please request a new one.',
      });
    }

    const data = verDoc.data();

    if (data.attempts >= 5) {
      await getDb().collection('email_verifications').doc(email).delete();
      return res.status(400).json({ success: false, message: 'Too many attempts. Please request a new code.' });
    }

    if (Date.now() > data.expiresAt) {
      await getDb().collection('email_verifications').doc(email).delete();
      return res.status(400).json({ success: false, message: 'Code has expired. Please request a new one.' });
    }

    if (data.code !== code) {
      await getDb().collection('email_verifications').doc(email).update({
        attempts: admin.firestore.FieldValue.increment(1),
      });
      return res.status(400).json({ success: false, message: 'Incorrect code. Please try again.' });
    }

    // ✅ Correct — clean up
    await getDb().collection('email_verifications').doc(email).delete();

    // Mark provider as email verified
    const providersSnap = await getDb()
      .collection(COLLECTIONS.PROVIDERS)
      .where('email', '==', email)
      .limit(1)
      .get();

    if (!providersSnap.empty) {
      await providersSnap.docs[0].ref.update({
        emailVerified: true,
        emailVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Update Firebase Auth emailVerified flag
    try {
      const userRecord = await getAuth().getUserByEmail(email);
      await getAuth().updateUser(userRecord.uid, { emailVerified: true });
      logger.info('Firebase Auth emailVerified updated', { email, uid: userRecord.uid });
    } catch (authErr) {
      logger.warn('Failed to update Firebase Auth emailVerified (non-fatal)', { email, error: authErr.message });
    }

    logger.info('Email verified successfully', { email });
    return res.status(200).json({ success: true, message: 'Email verified successfully.' });

  } catch (error) {
    console.error('Verify email error:', error);
    return res.status(500).json({ success: false, message: 'Verification failed.' });
  }
};

/**
 * Register a new washer
 * POST /auth/register
 */
exports.register = async (req, res) => {
  try {
    const {
      email, password, displayName, phoneNumber,
      serviceAreas, hasExperience, certificationPath, professionalExperience,
    } = req.body;

    if (!email || !password || !displayName || !phoneNumber) {
      return res.status(400).json({ success: false, message: 'Email, password, display name, and phone number are required' });
    }
    if (hasExperience === false && !certificationPath) {
      return res.status(400).json({ success: false, message: 'Certification path is required for new washers' });
    }

    const userRecord = await getAuth().createUser({ email, password, displayName, phoneNumber, emailVerified: false });
    await getAuth().setCustomUserClaims(userRecord.uid, { role: 'washer', userType: 'washer' });

    let certificationStatus = 'uncertified';
    if (hasExperience === true && professionalExperience) certificationStatus = 'pending_certification';
    else if (certificationPath) certificationStatus = 'pending_certification';

    const providerData = {
      uid: userRecord.uid, email, displayName, phoneNumber, role: 'washer',
      serviceAreas: serviceAreas || [],
      totalJobs: 0, rating: 0, reviewCount: 0, totalBookings: 0,
      certificationStatus, certificationPath: certificationPath || null,
      isActive: false, isVerified: false, availability: false, emailVerified: false,
      workingHours: {
        monday: { open: '08:00', close: '18:00' }, tuesday: { open: '08:00', close: '18:00' },
        wednesday: { open: '08:00', close: '18:00' }, thursday: { open: '08:00', close: '18:00' },
        friday: { open: '08:00', close: '18:00' }, saturday: { open: '09:00', close: '17:00' },
        sunday: { open: 'closed', close: 'closed' },
      },
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };

    providerData.professionalExperience = (hasExperience === true && professionalExperience)
      ? { hasExperience: true, currentWorkplace: professionalExperience.currentWorkplace || null, yearsOfExperience: professionalExperience.yearsOfExperience || 0, references: [], documents: [], submittedAt: new Date().toISOString() }
      : null;

    providerData.fieldCertification = certificationPath === 'field_certification'
      ? { requiredEvaluations: 6, completedEvaluations: 0, evaluations: [], assignedMentors: [], startedAt: new Date().toISOString(), status: 'pending_mentor_assignment' }
      : null;

    providerData.trainingCenter = certificationPath === 'training_center'
      ? { centerId: null, centerName: null, assignedAt: null, expectedCompletionDate: null, status: 'pending_assignment', finalEvaluation: null }
      : null;

    providerData.certificationReview = { reviewedBy: null, reviewedAt: null, status: 'pending', adminNotes: null };

    await getDb().collection(COLLECTIONS.PROVIDERS).doc(userRecord.uid).set(providerData);

    const customToken = await getAuth().createCustomToken(userRecord.uid, { role: 'washer', userType: 'washer' });

    let message = 'Washer registered successfully. ';
    if (hasExperience === true) message += 'Your professional experience is under review.';
    else if (certificationPath === 'field_certification') message += 'You will be assigned mentors for field certification.';
    else if (certificationPath === 'training_center') message += 'You will be assigned to a training center.';

    res.status(201).json({
      success: true, message,
      data: { uid: userRecord.uid, email, displayName, token: customToken, certificationStatus, certificationPath: certificationPath || null },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to register washer' });
  }
};

/**
 * Login user
 * POST /auth/login
 */
exports.login = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    let userRecord;
    try { userRecord = await getAuth().getUserByEmail(email); }
    catch { return res.status(404).json({ success: false, message: 'User not found' }); }

    const providerDoc = await getDb().collection(COLLECTIONS.PROVIDERS).doc(userRecord.uid).get();
    if (!providerDoc.exists) return res.status(404).json({ success: false, message: 'Provider profile not found' });

    const providerData = providerDoc.data();
    const customToken = await getAuth().createCustomToken(userRecord.uid, { role: 'washer', userType: 'washer' });
    await getDb().collection(COLLECTIONS.PROVIDERS).doc(userRecord.uid).update({ lastLoginAt: new Date().toISOString() });

    res.status(200).json({
      success: true, message: 'Login successful',
      data: { token: customToken, user: { uid: userRecord.uid, email: providerData.email, displayName: providerData.displayName, certificationStatus: providerData.certificationStatus, isActive: providerData.isActive, isVerified: providerData.isVerified } },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to login' });
  }
};

/**
 * Register a new washer with certification flow
 * POST /auth/washer/register
 */
exports.registerWasher = asyncHandler(async (req, res) => {
  const { email, password, displayName, phoneNumber, serviceAreas, hasExperience, certificationPath, professionalExperience } = req.body;

  if (!email || !password || !displayName || !phoneNumber) throw new AppError('Email, password, display name, and phone number are required', 400, 'VALIDATION_ERROR');
  if (hasExperience === false && !certificationPath) throw new AppError('Certification path is required for new washers', 400, 'VALIDATION_ERROR');
  if (certificationPath && !['field_certification', 'training_center'].includes(certificationPath)) throw new AppError('Invalid certification path', 400, 'VALIDATION_ERROR');

  const userRecord = await getAuth().createUser({ email, password, displayName, phoneNumber, emailVerified: false });

  let certificationStatus = 'uncertified';
  let washerStatus = WASHER_STATUS.PENDING_APPROVAL;
  if (hasExperience === true && professionalExperience) { certificationStatus = 'pending_certification'; }
  else if (certificationPath) { certificationStatus = 'pending_certification'; }

  const providerData = {
    uid: userRecord.uid, email, displayName, phoneNumber, role: ROLES.WASHER,
    status: USER_STATUS.ACTIVE, washerStatus, certificationStatus,
    certificationPath: certificationPath || null, serviceAreas: serviceAreas || [],
    totalJobs: 0, rating: 0, reviewCount: 0, totalBookings: 0,
    availability: false, isActive: false, isVerified: false, emailVerified: false,
    workingHours: {
      monday: { open: '08:00', close: '18:00' }, tuesday: { open: '08:00', close: '18:00' },
      wednesday: { open: '08:00', close: '18:00' }, thursday: { open: '08:00', close: '18:00' },
      friday: { open: '08:00', close: '18:00' }, saturday: { open: '09:00', close: '17:00' },
      sunday: { open: 'closed', close: 'closed' },
    },
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastLoginAt: null,
  };

  providerData.professionalExperience = (hasExperience === true && professionalExperience)
    ? { hasExperience: true, currentWorkplace: professionalExperience.currentWorkplace || null, yearsOfExperience: professionalExperience.yearsOfExperience || 0, references: [], documents: [], submittedAt: new Date().toISOString() }
    : null;

  providerData.fieldCertification = certificationPath === 'field_certification'
    ? { requiredEvaluations: 6, completedEvaluations: 0, evaluations: [], assignedMentors: [], startedAt: new Date().toISOString(), status: 'pending_mentor_assignment' }
    : null;

  providerData.trainingCenter = certificationPath === 'training_center'
    ? { centerId: null, centerName: null, assignedAt: null, expectedCompletionDate: null, status: 'pending_assignment', finalEvaluation: null }
    : null;

  providerData.certificationReview = { reviewedBy: null, reviewedAt: null, status: 'pending', adminNotes: null };

  await getDb().collection(COLLECTIONS.PROVIDERS).doc(userRecord.uid).set(providerData);

  logger.logAuth('register_washer', userRecord.uid, true);
  logger.info('Washer registered successfully', { uid: userRecord.uid, email, hasExperience, certificationPath, certificationStatus });

  let message = 'Washer registered successfully. ';
  if (hasExperience === true) message += 'Your professional experience is under review by our admin team.';
  else if (certificationPath === 'field_certification') message += 'You will be assigned mentors for field certification. Complete 6 job evaluations to get certified.';
  else if (certificationPath === 'training_center') message += 'You will be assigned to a training center. Our admin team will contact you shortly.';
  else message += 'Your account is pending approval.';

  res.status(201).json({
    success: true, message,
    user: { uid: userRecord.uid, email: providerData.email, displayName: providerData.displayName, role: providerData.role, washerStatus: providerData.washerStatus, certificationStatus: providerData.certificationStatus, certificationPath: providerData.certificationPath },
  });
});

/**
 * Login washer
 * POST /auth/washer/login  &  POST /auth/signin
 */
exports.loginWasher = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new AppError('Email is required', 400, 'VALIDATION_ERROR');

  let userRecord;
  try { userRecord = await getAuth().getUserByEmail(email); }
  catch { throw new AppError('User not found', 404, 'USER_NOT_FOUND'); }

  const providerDoc = await getDb().collection(COLLECTIONS.PROVIDERS).doc(userRecord.uid).get();
  if (!providerDoc.exists) throw new AppError('Provider profile not found', 404, 'PROVIDER_NOT_FOUND');

  const providerData = providerDoc.data();
  if (providerData.role !== ROLES.WASHER) throw new AppError('This endpoint is only for washer accounts', 403, 'INVALID_ROLE');

  const customToken = await getAuth().createCustomToken(userRecord.uid, { role: providerData.role, washerStatus: providerData.washerStatus });
  await getDb().collection(COLLECTIONS.PROVIDERS).doc(userRecord.uid).update({ lastLoginAt: new Date().toISOString() });

  logger.logAuth('login_washer', userRecord.uid, true);

  res.status(200).json({
    success: true,
    data: {
      token: customToken,
      user: { uid: userRecord.uid, email: providerData.email, displayName: providerData.displayName, washerStatus: providerData.washerStatus, certificationStatus: providerData.certificationStatus, isActive: providerData.isActive, isVerified: providerData.isVerified, experience: providerData.experience || 0, rating: providerData.rating || 0 },
    },
  });
});

/**
 * Get washer profile
 * GET /auth/washer/profile
 */
exports.getWasherProfile = asyncHandler(async (req, res) => {
  const providerDoc = await getDb().collection(COLLECTIONS.PROVIDERS).doc(req.user.uid).get();
  if (!providerDoc.exists) throw new AppError('Provider profile not found', 404, 'PROVIDER_NOT_FOUND');

  const providerData = providerDoc.data();
  if (providerData.role !== ROLES.WASHER) throw new AppError('This endpoint is only for washer accounts', 403, 'INVALID_ROLE');

  let certificationProgress = null;
  if (providerData.certificationPath === 'field_certification' && providerData.fieldCertification) {
    certificationProgress = {
      type: 'field_certification',
      completed: providerData.fieldCertification.completedEvaluations,
      required: providerData.fieldCertification.requiredEvaluations,
      percentage: Math.round((providerData.fieldCertification.completedEvaluations / providerData.fieldCertification.requiredEvaluations) * 100),
      evaluations: providerData.fieldCertification.evaluations,
    };
  } else if (providerData.certificationPath === 'training_center' && providerData.trainingCenter) {
    certificationProgress = { type: 'training_center', status: providerData.trainingCenter.status, centerName: providerData.trainingCenter.centerName, expectedCompletion: providerData.trainingCenter.expectedCompletionDate };
  }

  res.status(200).json({ success: true, provider: providerData, certificationProgress });
});

/**
 * Get current user profile
 * GET /auth/profile
 */
exports.getProfile = async (req, res) => {
  try {
    const providerDoc = await getDb().collection(COLLECTIONS.PROVIDERS).doc(req.user.uid).get();
    if (!providerDoc.exists) return res.status(404).json({ success: false, message: 'Provider not found' });
    res.status(200).json({ success: true, data: { provider: providerDoc.data() } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get profile' });
  }
};

/**
 * Update user profile
 * PATCH /auth/profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const { uid } = req.user;
    const { displayName, phoneNumber, serviceAreas, workingHours } = req.body;
    const updates = { updatedAt: new Date().toISOString() };

    if (displayName) { updates.displayName = displayName; await getAuth().updateUser(uid, { displayName }); }
    if (phoneNumber) updates.phoneNumber = phoneNumber;
    if (serviceAreas) updates.serviceAreas = serviceAreas;
    if (workingHours) updates.workingHours = workingHours;
    if (req.body.agreement !== undefined) updates.agreement = Boolean(req.body.agreement);
    if (req.body.photoURL !== undefined) {
      updates.photoURL = req.body.photoURL || null;
      await getAuth().updateUser(uid, { photoURL: req.body.photoURL || null });
    }

    await getDb().collection(COLLECTIONS.PROVIDERS).doc(uid).update(updates);
    res.status(200).json({ success: true, message: 'Profile updated successfully', data: { updates } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};

/**
 * Update last login timestamp
 * POST /auth/update-login
 */
exports.updateLastLogin = asyncHandler(async (req, res) => {
  await getDb().collection(COLLECTIONS.PROVIDERS).doc(req.user.uid).update({ lastLoginAt: new Date().toISOString() });
  res.status(200).json({ success: true, message: 'Last login updated' });
});

/**
 * Sign out washer
 * POST /auth/signout
 */
exports.signOut = asyncHandler(async (req, res) => {
  const { uid } = req.user;
  try { await getAuth().revokeRefreshTokens(uid); }
  catch (revokeErr) { logger.warn('Failed to revoke refresh tokens on signout', { uid, error: revokeErr.message }); }
  await getDb().collection(COLLECTIONS.PROVIDERS).doc(uid).update({ lastSignOutAt: new Date().toISOString() }).catch(() => {});
  logger.logAuth('signout_washer', uid, true);
  res.status(200).json({ success: true, message: 'Signed out successfully' });
});

/**
 * Update washer certification status (admin only)
 * PATCH /auth/washer/:uid/certification
 */
exports.updateWasherCertification = asyncHandler(async (req, res) => {
  const { uid } = req.params;
  const { certificationStatus, adminNotes } = req.body;

  if (!certificationStatus) throw new AppError('Certification status is required', 400, 'VALIDATION_ERROR');
  const validStatuses = ['uncertified', 'pending_certification', 'in_training', 'certified', 'rejected'];
  if (!validStatuses.includes(certificationStatus)) throw new AppError('Invalid certification status', 400, 'VALIDATION_ERROR');

  const updates = {
    certificationStatus,
    'certificationReview.reviewedBy': req.user.uid,
    'certificationReview.reviewedAt': new Date().toISOString(),
    'certificationReview.status': certificationStatus === 'certified' ? 'approved' : 'pending',
    'certificationReview.adminNotes': adminNotes || null,
    updatedAt: new Date().toISOString(),
  };

  if (certificationStatus === 'certified') {
    updates.washerStatus = WASHER_STATUS.AVAILABLE;
    updates.isActive = true; updates.isVerified = true; updates.availability = true;
  }

  await getDb().collection(COLLECTIONS.PROVIDERS).doc(uid).update(updates);
  logger.info('Washer certification updated', { uid, certificationStatus, updatedBy: req.user.uid });
  res.status(200).json({ success: true, message: 'Certification status updated successfully' });
});

/**
 * Create staff or admin user (admin only)
 * POST /auth/create-staff
 */
exports.createStaff = asyncHandler(async (req, res) => {
  const { email, password, displayName, phoneNumber, role } = req.body;
  if (!email || !password || !displayName || !role) throw new AppError('Email, password, displayName, and role are required', 400, 'VALIDATION_ERROR');
  if (![ROLES.STAFF, ROLES.ADMIN].includes(role)) throw new AppError('Invalid role. Must be staff or admin', 400, 'INVALID_ROLE');

  const userRecord = await getAuth().createUser({ email, password, displayName, phoneNumber: phoneNumber || null, emailVerified: true });
  const userData = { uid: userRecord.uid, email, displayName, phoneNumber: phoneNumber || null, role, status: USER_STATUS.ACTIVE, createdAt: new Date().toISOString(), createdBy: req.user.uid, lastLoginAt: null };

  await getDb().collection(COLLECTIONS.USERS).doc(userRecord.uid).set(userData);
  logger.info('Staff user created', { uid: userRecord.uid, email, role, createdBy: req.user.uid });
  res.status(201).json({ success: true, message: `${role} user created successfully`, user: { uid: userRecord.uid, email: userData.email, displayName: userData.displayName, role: userData.role } });
});

/**
 * Disable user account (admin only)
 */
exports.disableUser = asyncHandler(async (req, res) => {
  const { uid } = req.params;
  if (uid === req.user.uid) throw new AppError('Cannot disable your own account', 400, 'INVALID_OPERATION');
  await getDb().collection(COLLECTIONS.USERS).doc(uid).update({ status: USER_STATUS.DISABLED });
  await getAuth().updateUser(uid, { disabled: true });
  logger.warn('User disabled', { uid, disabledBy: req.user.uid });
  res.status(200).json({ success: true, message: 'User disabled successfully' });
});

/**
 * Enable user account (admin only)
 */
exports.enableUser = asyncHandler(async (req, res) => {
  const { uid } = req.params;
  await getDb().collection(COLLECTIONS.USERS).doc(uid).update({ status: USER_STATUS.ACTIVE });
  await getAuth().updateUser(uid, { disabled: false });
  logger.info('User enabled', { uid, enabledBy: req.user.uid });
  res.status(200).json({ success: true, message: 'User enabled successfully' });
});