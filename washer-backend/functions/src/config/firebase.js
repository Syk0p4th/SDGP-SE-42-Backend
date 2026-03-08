const admin = require('firebase-admin');

// Reuse app initialized in index.js
// If not yet initialized (edge case), initialize with credentials
if (!admin.apps.length) {
  const path = require('path');
  const keyPath = path.resolve(__dirname, '../../serviceAccountKey.json');
  const serviceAccount = require(keyPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'washxpress-19b94.appspot.com',
  });
}

const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();

db.settings({ ignoreUndefinedProperties: true });

module.exports = { admin, db, auth, storage };