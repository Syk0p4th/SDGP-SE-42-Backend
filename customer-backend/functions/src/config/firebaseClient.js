const { initializeApp } = require('firebase/app');
const { getAuth } = require('firebase/auth');

const firebaseConfig = {
  apiKey: "AIzaSyBjXus8xIr_Cvjtnm3yV5BR9P1lqYGgahQ",
  authDomain: "washxpress-19b94.firebaseapp.com",
  projectId: "washxpress-19b94",
  storageBucket: "washxpress-19b94.firebasestorage.app",
  messagingSenderId: "1080986101352",
  appId: "1:1080986101352:web:93a4a68b81b75c7e377ddd"
};

const clientApp = initializeApp(firebaseConfig, 'client');
const clientAuth = getAuth(clientApp);

module.exports = { clientAuth };