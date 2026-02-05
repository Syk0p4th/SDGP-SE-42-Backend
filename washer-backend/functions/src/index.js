/* eslint-disable max-len */
require('dotenv').config();
const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');

// Import configurations
const { initSentry, sentryRequestHandler, sentryTracingHandler, sentryErrorHandler } = require('./config/sentry');
const swaggerSpec = require('./config/swagger');
const logger = require('./config/logger');

// Import middleware
const { requestLogger, errorLogger } = require('./middleware/loggingMiddleware');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/authRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const userRoutes = require('./routes/userRoutes');

// Initialize Sentry
initSentry();

// Create Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sentry request handler (must be first)
app.use(sentryRequestHandler);
app.use(sentryTracingHandler);

// Logging middleware
app.use(requestLogger);

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Car Wash API Documentation'
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes (prefixed with /api/washer for consistency)
app.use('/api/washer/auth', authRoutes);
app.use('/api/washer/bookings', bookingRoutes);
app.use('/api/washer/services', serviceRoutes);
app.use('/api/washer/users', userRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Washer Backend API',
    version: '1.0.0',
    documentation: '/api-docs',
    endpoints: {
      health: '/health',
      auth: '/api/washer/auth',
      bookings: '/api/washer/bookings',
      services: '/api/washer/services',
      users: '/api/washer/users'
    }
  });
});

// 404 handler
app.use(notFound);

// Error logging middleware
app.use(errorLogger);

// Sentry error handler (must be before other error handlers)
app.use(sentryErrorHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Export Firebase Function
exports.api = functions.https.onRequest(app);

// Export Express app for testing (must be after exports.api)
module.exports.app = app;

// Log startup
logger.info('Washer Backend API initialized', {
  environment: process.env.NODE_ENV || 'development',
  version: '1.0.0'
});

// For local testing (standalone server)
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`\n🚀 Washer Backend running on port ${PORT}`);
    console.log(`📍 Health: http://localhost:${PORT}/health`);
    console.log(`📍 Register: POST http://localhost:${PORT}/api/washer/auth/register`);
    console.log(`📍 Login: POST http://localhost:${PORT}/api/washer/auth/login`);
    console.log(`📍 Washer Register: POST http://localhost:${PORT}/api/washer/auth/washer/register`);
    console.log(`📍 Washer Login: POST http://localhost:${PORT}/api/washer/auth/washer/login\n`);
  });
}
