/* eslint-disable max-len */
const admin = require('firebase-admin');
const logger = require('./logger');

// Load service account key
const serviceAccount = require('../../serviceAccountKey.json');

// Initialize Firebase Admin with service account
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: `${serviceAccount.project_id}.appspot.com`
  });
  logger.info('Firebase Admin initialized successfully', {
    projectId: serviceAccount.project_id
  });
} catch (error) {
  logger.error('Firebase Admin initialization failed', { error: error.message });
  throw error;
}

// Export Firestore instance
const db = admin.firestore();

// Export Auth instance
const auth = admin.auth();

// Export Storage instance
const storage = admin.storage();

// Firestore settings
db.settings({
  ignoreUndefinedProperties: true
});

module.exports = {
  admin,
  db,
  auth,
  storage
};
