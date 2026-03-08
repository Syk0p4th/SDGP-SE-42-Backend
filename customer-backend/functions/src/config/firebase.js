const admin = require('firebase-admin');

// On Firebase Functions: auto-initialized with built-in credentials
// Locally: uses serviceAccountKey.json
if (!admin.apps.length) {
  if (process.env.NODE_ENV === 'production' || !process.env.PORT) {
    // Firebase Functions environment - no service account needed
    admin.initializeApp({
      storageBucket: 'washxpress-19b94.appspot.com'
    });
  } else {
    // Local development
    const serviceAccount = require('../../serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: 'washxpress-19b94.appspot.com'
    });
  }
}

const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();

module.exports = { admin, db, auth, storage };