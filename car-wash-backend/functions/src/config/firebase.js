/* eslint-disable max-len */
const admin = require('firebase-admin');
const logger = require('./logger');

// Initialize Firebase Admin
try {
  admin.initializeApp();
  logger.info('Firebase Admin initialized successfully');
} catch (error) {
  logger.error('Firebase Admin initialization failed', { error: error.message });
  throw error;
}

// Export Firestore instance
const db = admin.firestore();

// Export Auth instance
const auth = admin.auth();

// Firestore settings
db.settings({
  ignoreUndefinedProperties: true
});

module.exports = {
  admin,
  db,
  auth
};
