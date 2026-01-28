const { initializeApp } = require('firebase/app');
const { getAuth } = require('firebase/auth');

// Your Firebase configuration
// Replace these values with your actual Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBjXus8xIr_Cvjtnm3yV5BR9P1lqYGgahQ",
  authDomain: "washxpress-19b94.firebaseapp.com",
  projectId: "washxpress-19b94",
  storageBucket: "washxpress-19b94.firebasestorage.app",
  messagingSenderId: "123456789",  // Replace with your actual value
  appId: "1:123456789:web:abc123def456"  // Replace with your actual value
};

// Initialize Firebase Client SDK
const clientApp = initializeApp(firebaseConfig, 'client');
const clientAuth = getAuth(clientApp);

module.exports = { clientAuth };