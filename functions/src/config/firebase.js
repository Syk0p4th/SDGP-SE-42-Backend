const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin SDK
const serviceAccount = require('../../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.STORAGE_BUCKET
});

const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();

module.exports = { admin, db, auth, storage };