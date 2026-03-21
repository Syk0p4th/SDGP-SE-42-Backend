require('dotenv').config();
const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');

// Initialize Express app
const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[DEBUG] 📨 ${req.method} ${req.originalUrl}`);
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

// Load routes
try {
  console.log('Loading customer routes...');
  const customerRoutes = require('./routes/customerRoutes');
  app.use('/api/customer', customerRoutes);
  console.log('✅ Customer routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading customer routes:');
  console.error(error);
}

// Error handler
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
exports.customerApi = functions.https.onRequest(app);

// For local testing
const startServer = (port) => {
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`\n🚀 Server running on port ${port}`);
    console.log(`📍 Health: http://localhost:${port}/health`);
    // Temporary debug — remove after fixing
    app.post('/api/customer/auth/test', (req, res) => {
      res.json({ success: true, body: req.body, message: 'Test route works' });
    });

    app.get('/api/customer/routes', (req, res) => {
      const routes = [];
      app._router.stack.forEach(middleware => {
        if (middleware.route) {
          routes.push(middleware.route.path);
        } else if (middleware.name === 'router') {
          middleware.handle.stack.forEach(handler => {
            if (handler.route) {
              routes.push(handler.route.path);
            }
          });
        }
      });
      res.json({ routes });
    });
    console.log(`📍 Signup: POST http://localhost:${port}/api/customer/auth/signup`);
    console.log(`📍 Login: POST http://localhost:${port}/api/customer/auth/signin\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`⚠️ Port ${port} is already in use.`);
      console.log(`👉 Attempting to start on port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('❌ Server error:', err);
      process.exit(1);
    }
  });
};

if (require.main === module || process.env.NODE_ENV === 'development') {
  const INITIAL_PORT = parseInt(process.env.PORT) || 3000;
  startServer(INITIAL_PORT);
}
