require('dotenv').config();

// ─── Initialize Firebase FIRST before any other requires ───────────────────
const path = require('path');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const keyPath = path.resolve(__dirname, '../serviceAccountKey.json');
  const serviceAccount = require(keyPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'washxpress-19b94.appspot.com',
  });
  console.log('✅ Firebase Admin initialized');
}
// ───────────────────────────────────────────────────────────────────────────

const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const logger = require('./config/logger');

const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'washer-backend',
    timestamp: new Date().toISOString()
  });
});

// Routes
try {
  console.log('Loading auth routes...');
  const authRoutes = require('./routes/authRoutes');
  app.use('/api/provider/auth', authRoutes);
  console.log('✅ Auth routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading auth routes:', error);
}

try {
  console.log('Loading booking routes...');
  const bookingRoutes = require('./routes/bookingRoutes');
  app.use('/api/provider/bookings', bookingRoutes);
  console.log('✅ Booking routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading booking routes:', error);
}

try {
  console.log('Loading service routes...');
  const serviceRoutes = require('./routes/serviceRoutes');
  app.use('/api/provider/services', serviceRoutes);
  console.log('✅ Service routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading service routes:', error);
}

// Error handler
try {
  const { errorHandler } = require('./middleware/errorHandler');
  app.use(errorHandler);
} catch (error) {
  console.error('❌ Error loading error handler:', error);
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Export as Firebase Function
exports.washerApi = functions.https.onRequest(app);

// Local development
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Washer Backend running on port ${PORT}`);
  console.log(`📍 Health:   http://0.0.0.0:${PORT}/health`);
  console.log(`📍 Login:    POST http://0.0.0.0:${PORT}/api/provider/auth/signin`);
  console.log(`📍 Register: POST http://0.0.0.0:${PORT}/api/provider/auth/washer/register\n`);
});