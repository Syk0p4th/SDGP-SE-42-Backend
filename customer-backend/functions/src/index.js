require('dotenv').config();
const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');

// Initialize Express app first
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Car Wash Backend API is running',
    timestamp: new Date().toISOString()
  });
});

// Try to load routes with error handling
try {
  console.log('Loading customer routes...');
  const customerRoutes = require('./routes/customerRoutes');
  app.use('/api/customer', customerRoutes);
  console.log('✅ Customer routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading customer routes:');
  console.error(error);
}

// Try to load error handler
try {
  const { globalErrorHandler } = require('./utils/errorHandling');
  app.use(globalErrorHandler);
} catch (error) {
  console.error('❌ Error loading error handler:');
  console.error(error);
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
exports.api = functions.https.onRequest(app);


// For local testing
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {  // ✅ Single listener with all routes
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📍 Health: http://0.0.0.0:${PORT}/health`);
    console.log(`📍 Signup: POST http://0.0.0.0:${PORT}/api/customer/auth/signup`);
    console.log(`📍 Login: POST http://0.0.0.0:${PORT}/api/customer/auth/signin\n`);
  });
}