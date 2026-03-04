/* eslint-disable max-len */
const { auth, db } = require('../config/firebase');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { ROLES, USER_STATUS, WASHER_STATUS, COLLECTIONS } = require('../utils/constants');
const logger = require('../config/logger');
const admin = require('firebase-admin');

/**
 * Register a new customer
 * POST /auth/register
 */
exports.register = async (req, res) => {
  try {
    const { 
      email, 
      password, 
      displayName, 
      phoneNumber, 
      serviceAreas,
      hasExperience,              // NEW
      certificationPath,          // NEW: 'field_certification' | 'training_center'
      professionalExperience      // NEW: if hasExperience = true
    } = req.body;

    // Validate required fields
    if (!email || !password || !displayName || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, display name, and phone number are required',
      });
    }

    // Validate certification path if no experience
    if (hasExperience === false && !certificationPath) {
      return res.status(400).json({
        success: false,
        message: 'Certification path is required for new washers',
      });
    }

    // Create Firebase Auth user
    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
      phoneNumber,
      emailVerified: false
    });

    // Set custom claims for provider
    await auth.setCustomUserClaims(userRecord.uid, {
      role: 'provider',
      userType: 'provider'
    });

    // Determine certification status
    let certificationStatus = 'uncertified';
    let isActive = false;
    
    if (hasExperience === true && professionalExperience) {
      certificationStatus = 'pending_certification';
    } else if (certificationPath) {
      certificationStatus = 'pending_certification';
    }

    // Create provider document
    const providerData = {
      uid: userRecord.uid,
      email,
      displayName,
      phoneNumber,
      role: 'provider',
      
      // Service details
      serviceAreas: serviceAreas || [],
      totalJobs: 0,
      rating: 0,
      reviewCount: 0,
      totalBookings: 0,
      
      // Certification
      certificationStatus: certificationStatus,
      certificationPath: certificationPath || null,
      isActive: isActive,         // Disabled until certified
      isVerified: false,          // Will be true after certification
      availability: false,
      
      // Working hours
      workingHours: {
        monday: { open: '08:00', close: '18:00' },
        tuesday: { open: '08:00', close: '18:00' },
        wednesday: { open: '08:00', close: '18:00' },
        thursday: { open: '08:00', close: '18:00' },
        friday: { open: '08:00', close: '18:00' },
        saturday: { open: '09:00', close: '17:00' },
        sunday: { open: 'closed', close: 'closed' },
      },
      
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Add professional experience if provided
    if (hasExperience === true && professionalExperience) {
      providerData.professionalExperience = {
        hasExperience: true,
        currentWorkplace: professionalExperience.currentWorkplace || null,
        yearsOfExperience: professionalExperience.yearsOfExperience || 0,
        references: professionalExperience.references || [],
        documents: professionalExperience.documents || [],
        submittedAt: new Date().toISOString(),
      };
    } else {
      providerData.professionalExperience = null;
    }

    // Initialize field certification
    if (certificationPath === 'field_certification') {
      providerData.fieldCertification = {
        requiredEvaluations: 6,
        completedEvaluations: 0,
        evaluations: [],
        assignedMentors: [],
        startedAt: new Date().toISOString(),
        status: 'pending_mentor_assignment',
      };
    } else {
      providerData.fieldCertification = null;
    }

    // Initialize training center
    if (certificationPath === 'training_center') {
      providerData.trainingCenter = {
        centerId: null,
        centerName: null,
        assignedAt: null,
        expectedCompletionDate: null,
        status: 'pending_assignment',
        finalEvaluation: null,
      };
    } else {
      providerData.trainingCenter = null;
    }

    // Initialize certification review
    providerData.certificationReview = {
      reviewedBy: null,
      reviewedAt: null,
      status: 'pending',
      adminNotes: null,
    };

    await db.collection('providers').doc(userRecord.uid).set(providerData);

    // Generate custom token for login
    const customToken = await auth.createCustomToken(userRecord.uid, {
      role: 'provider',
      userType: 'provider'
    });

    // Prepare message
    let message = 'Washer registered successfully. ';
    
    if (hasExperience === true) {
      message += 'Your professional experience is under review.';
    } else if (certificationPath === 'field_certification') {
      message += 'You will be assigned mentors for field certification.';
    } else if (certificationPath === 'training_center') {
      message += 'You will be assigned to a training center.';
    }

    res.status(201).json({
      success: true,
      message: message,
      data: {
        uid: userRecord.uid,
        email: providerData.email,
        displayName: providerData.displayName,
        customToken: customToken,
        certificationStatus: providerData.certificationStatus,
        certificationPath: providerData.certificationPath,
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to register washer',
    });
  }
};

/**
 * Login user (returns custom token or instructs client to use Firebase Auth)
 * POST /auth/login
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Note: Password verification happens on client with Firebase Auth
    // This endpoint validates user exists and returns provider data

    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get provider document
    const providerDoc = await db.collection('providers').doc(userRecord.uid).get();

    if (!providerDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found',
      });
    }

    const providerData = providerDoc.data();

    // Generate custom token
    const customToken = await auth.createCustomToken(userRecord.uid, {
      role: 'provider',
      userType: 'provider'
    });

    // Update last login
    await db.collection('providers').doc(userRecord.uid).update({
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        uid: userRecord.uid,
        email: providerData.email,
        displayName: providerData.displayName,
        customToken: customToken,
        certificationStatus: providerData.certificationStatus,
        isActive: providerData.isActive,
        isVerified: providerData.isVerified,
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to login',
    });
  }
};

/**
 * Get current user profile
 * GET /auth/profile
 */
exports.getProfile = async (req, res) => {
  try {
    const { uid } = req.user;

    const providerDoc = await db.collection('providers').doc(uid).get();

    if (!providerDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found',
      });
    }

    const providerData = providerDoc.data();

    res.status(200).json({
      success: true,
      data: {
        provider: providerData
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile',
    });
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

    const updates = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (displayName) {
      updates.displayName = displayName;
      // Update Firebase Auth
      await auth.updateUser(uid, { displayName });
    }

    if (phoneNumber) updates.phoneNumber = phoneNumber;
    if (serviceAreas) updates.serviceAreas = serviceAreas;
    if (workingHours) updates.workingHours = workingHours;

    await db.collection('providers').doc(uid).update(updates);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { updates }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
    });
  }
};

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
/**
 * Register a new washer with certification flow
 * POST /auth/washer/register
 * Saves to 'providers' collection with role 'washer'
 */
exports.registerWasher = asyncHandler(async (req, res) => {
  const { 
    email, 
    password, 
    displayName, 
    phoneNumber, 
    serviceAreas,
    hasExperience,              // NEW: boolean - does washer have professional experience?
    certificationPath,          // NEW: 'field_certification' | 'training_center' | null
    professionalExperience      // NEW: object with workplace details (if hasExperience = true)
  } = req.body;

  // Validate required fields
  if (!email || !password || !displayName || !phoneNumber) {
    throw new AppError('Email, password, display name, and phone number are required', 400, 'VALIDATION_ERROR');
  }

  // Validate certification path if no experience
  if (hasExperience === false && !certificationPath) {
    throw new AppError('Certification path is required for new washers', 400, 'VALIDATION_ERROR');
  }

  if (certificationPath && !['field_certification', 'training_center'].includes(certificationPath)) {
    throw new AppError('Invalid certification path. Must be field_certification or training_center', 400, 'VALIDATION_ERROR');
  }

  // Create Firebase Auth user
  const userRecord = await auth.createUser({
    email,
    password,
    displayName,
    phoneNumber,
    emailVerified: false
  });

  // Determine certification status and washer status
  let certificationStatus = 'uncertified';
  let washerStatus = WASHER_STATUS.PENDING_APPROVAL;
  
  if (hasExperience === true && professionalExperience) {
    // Has experience - goes to admin review for direct approval
    certificationStatus = 'pending_certification';
    washerStatus = WASHER_STATUS.PENDING_APPROVAL;
  } else if (certificationPath) {
    // No experience - needs certification training
    certificationStatus = 'pending_certification';
    washerStatus = WASHER_STATUS.PENDING_APPROVAL;
  }

  // Create provider document in Firestore (providers collection)
  const providerData = {
    uid: userRecord.uid,
    email,
    displayName,
    phoneNumber,
    role: ROLES.WASHER,
    status: USER_STATUS.ACTIVE,
    washerStatus: washerStatus,
    
    // Certification fields
    certificationStatus: certificationStatus,
    certificationPath: certificationPath || null,
    
    // Service details
    serviceAreas: serviceAreas || [],
    totalJobs: 0,
    rating: 0,
    reviewCount: 0,
    totalBookings: 0,
    availability: false, // Disabled until certified
    isActive: false,     // Disabled until certified
    isVerified: false,   // Will be true after certification
    
    // Working hours (default schedule)
    workingHours: {
      monday: { open: '08:00', close: '18:00' },
      tuesday: { open: '08:00', close: '18:00' },
      wednesday: { open: '08:00', close: '18:00' },
      thursday: { open: '08:00', close: '18:00' },
      friday: { open: '08:00', close: '18:00' },
      saturday: { open: '09:00', close: '17:00' },
      sunday: { open: 'closed', close: 'closed' },
    },
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLoginAt: null,
  };

  // Add professional experience if provided
  if (hasExperience === true && professionalExperience) {
    providerData.professionalExperience = {
      hasExperience: true,
      currentWorkplace: professionalExperience.currentWorkplace || null,
      yearsOfExperience: professionalExperience.yearsOfExperience || 0,
      references: professionalExperience.references || [],
      documents: professionalExperience.documents || [],
      submittedAt: new Date().toISOString(),
    };
  } else {
    providerData.professionalExperience = null;
  }

  // Initialize field certification tracking if chosen
  if (certificationPath === 'field_certification') {
    providerData.fieldCertification = {
      requiredEvaluations: 6,
      completedEvaluations: 0,
      evaluations: [],
      assignedMentors: [],
      startedAt: new Date().toISOString(),
      status: 'pending_mentor_assignment',
    };
  } else {
    providerData.fieldCertification = null;
  }

  // Initialize training center tracking if chosen
  if (certificationPath === 'training_center') {
    providerData.trainingCenter = {
      centerId: null,
      centerName: null,
      assignedAt: null,
      expectedCompletionDate: null,
      status: 'pending_assignment',
      finalEvaluation: null,
    };
  } else {
    providerData.trainingCenter = null;
  }

  // Initialize certification review object
  providerData.certificationReview = {
    reviewedBy: null,
    reviewedAt: null,
    status: 'pending',
    adminNotes: null,
  };

  // Save to providers collection
  await db.collection(COLLECTIONS.PROVIDERS).doc(userRecord.uid).set(providerData);

  logger.logAuth('register_washer', userRecord.uid, true);
  logger.info('Washer registered successfully', { 
    uid: userRecord.uid, 
    email, 
    hasExperience,
    certificationPath,
    certificationStatus,
    collection: 'providers' 
  });

  // Prepare response message based on certification path
  let message = 'Washer registered successfully. ';
  
  if (hasExperience === true) {
    message += 'Your professional experience is under review by our admin team.';
  } else if (certificationPath === 'field_certification') {
    message += 'You will be assigned mentors for field certification. Complete 6 job evaluations to get certified.';
  } else if (certificationPath === 'training_center') {
    message += 'You will be assigned to a training center. Our admin team will contact you shortly.';
  } else {
    message += 'Your account is pending approval.';
  }

  res.status(201).json({
    success: true,
    message: message,
    user: {
      uid: userRecord.uid,
      email: providerData.email,
      displayName: providerData.displayName,
      role: providerData.role,
      washerStatus: providerData.washerStatus,
      certificationStatus: providerData.certificationStatus,
      certificationPath: providerData.certificationPath,
    }
  });
});

/**
 * Get washer profile with certification progress
 * GET /auth/washer/profile
 */
exports.getWasherProfile = asyncHandler(async (req, res) => {
  const providerDoc = await db.collection(COLLECTIONS.PROVIDERS).doc(req.user.uid).get();

  if (!providerDoc.exists) {
    throw new AppError('Provider profile not found', 404, 'PROVIDER_NOT_FOUND');
  }

  const providerData = providerDoc.data();

  // Verify user is a washer
  if (providerData.role !== ROLES.WASHER) {
    throw new AppError('This endpoint is only for washer accounts', 403, 'INVALID_ROLE');
  }

  // Calculate certification progress if applicable
  let certificationProgress = null;

  if (providerData.certificationPath === 'field_certification' && providerData.fieldCertification) {
    certificationProgress = {
      type: 'field_certification',
      completed: providerData.fieldCertification.completedEvaluations,
      required: providerData.fieldCertification.requiredEvaluations,
      percentage: Math.round(
        (providerData.fieldCertification.completedEvaluations / 
         providerData.fieldCertification.requiredEvaluations) * 100
      ),
      evaluations: providerData.fieldCertification.evaluations,
    };
  } else if (providerData.certificationPath === 'training_center' && providerData.trainingCenter) {
    certificationProgress = {
      type: 'training_center',
      status: providerData.trainingCenter.status,
      centerName: providerData.trainingCenter.centerName,
      expectedCompletion: providerData.trainingCenter.expectedCompletionDate,
    };
  }

  res.status(200).json({
    success: true,
    provider: providerData,
    certificationProgress: certificationProgress,
  });
});

/**
 * Update washer certification status (admin only)
 * PATCH /auth/washer/:uid/certification
 */
exports.updateWasherCertification = asyncHandler(async (req, res) => {
  const { uid } = req.params;
  const { certificationStatus, adminNotes } = req.body;

  if (!certificationStatus) {
    throw new AppError('Certification status is required', 400, 'VALIDATION_ERROR');
  }

  const validStatuses = ['uncertified', 'pending_certification', 'in_training', 'certified', 'rejected'];
  if (!validStatuses.includes(certificationStatus)) {
    throw new AppError('Invalid certification status', 400, 'VALIDATION_ERROR');
  }

  const updates = {
    certificationStatus: certificationStatus,
    'certificationReview.reviewedBy': req.user.uid,
    'certificationReview.reviewedAt': new Date().toISOString(),
    'certificationReview.status': certificationStatus === 'certified' ? 'approved' : 'pending',
    'certificationReview.adminNotes': adminNotes || null,
    updatedAt: new Date().toISOString(),
  };

  // If certified, activate the washer
  if (certificationStatus === 'certified') {
    updates.washerStatus = WASHER_STATUS.AVAILABLE;
    updates.isActive = true;
    updates.isVerified = true;
    updates.availability = true;
  }

  await db.collection(COLLECTIONS.PROVIDERS).doc(uid).update(updates);

  logger.info('Washer certification updated', {
    uid,
    certificationStatus,
    updatedBy: req.user.uid,
  });

  res.status(200).json({
    success: true,
    message: 'Certification status updated successfully',
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
