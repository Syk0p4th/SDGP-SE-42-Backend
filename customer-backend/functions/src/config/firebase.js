const admin = require('firebase-admin');

// On Firebase Functions: auto-initialized with built-in credentials
// Locally: uses serviceAccountKey.json
if (!admin.apps.length) {
  // Check if we are in Firebase Functions or running locally
  const isProduction = process.env.NODE_ENV === 'production' && !process.env.FUNCTIONS_EMULATOR;
  
  if (isProduction) {
    // Firebase Functions production environment
    admin.initializeApp({
      storageBucket: 'washxpress-19b94.appspot.com'
    });
  } else {
    // Local development (using nodemon or emulator)
    try {
      const serviceAccount = require('../../../serviceAccountKey.json');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: 'washxpress-19b94.appspot.com'
      });
      console.log('Firebase initialized locally with service account');
    } catch (error) {
      console.error('Error loading service account key:', error.message);
      // Fallback or rethrow depending on needs
      throw error;
    }
  }
}

const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();

module.exports = { admin, db, auth, storage };