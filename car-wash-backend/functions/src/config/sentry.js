/* eslint-disable max-len */
const Sentry = require('@sentry/node');
const { ProfilingIntegration } = require('@sentry/profiling-node');

/**
 * Initialize Sentry for error tracking
 * Call this early in your application lifecycle
 */
function initSentry() {
  const environment = process.env.NODE_ENV || 'development';
  const dsn = process.env.SENTRY_DSN;

  // Only initialize if DSN is provided and not in test environment
  if (!dsn || environment === 'test') {
    console.log('Sentry: Skipping initialization (no DSN or test environment)');
    return;
  }

  Sentry.init({
    dsn,
    environment,

    // Performance Monitoring
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,

    // Profiling
    profilesSampleRate: environment === 'production' ? 0.1 : 1.0,
    integrations: [
      new ProfilingIntegration()
    ],

    // Release tracking
    release: process.env.SENTRY_RELEASE || 'car-wash-backend@1.0.0',

    // Before send hook to filter/modify events
    beforeSend(event, hint) {
      // Filter out certain errors in development
      if (environment === 'development') {
        console.log('Sentry Event:', event);
      }

      // Don't send validation errors to Sentry
      const error = hint.originalException;
      if (error && error.name === 'ValidationError') {
        return null;
      }

      // Sanitize sensitive data
      if (event.request && event.request.data) {
        event.request.data = sanitizeSentryData(event.request.data);
      }

      return event;
    },

    // Ignore certain errors
    ignoreErrors: [
      'ValidationError',
      'Unauthorized',
      'NotFoundError'
    ]
  });

  console.log(`Sentry initialized for ${environment} environment`);
}

/**
 * Sanitize sensitive data before sending to Sentry
 * @param {Object} data - Data to sanitize
 * @return {Object} Sanitized data
 */
function sanitizeSentryData(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveFields = [
    'password',
    'token',
    'apiKey',
    'secret',
    'authorization',
    'creditCard',
    'ssn'
  ];

  const sanitized = { ...data };

  sensitiveFields.forEach((field) => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Capture an exception with Sentry
 * @param {Error} error - Error to capture
 * @param {Object} context - Additional context
 */
function captureException(error, context = {}) {
  Sentry.captureException(error, {
    extra: context
  });
}

/**
 * Capture a message with Sentry
 * @param {string} message - Message to capture
 * @param {string} level - Severity level
 * @param {Object} context - Additional context
 */
function captureMessage(message, level = 'info', context = {}) {
  Sentry.captureMessage(message, {
    level,
    extra: context
  });
}

/**
 * Set user context for Sentry
 * @param {Object} user - User information
 */
function setUser(user) {
  Sentry.setUser({
    id: user.uid || user.id,
    email: user.email,
    username: user.displayName || user.username
  });
}

/**
 * Set custom context for Sentry
 * @param {string} key - Context key
 * @param {Object} value - Context value
 */
function setContext(key, value) {
  Sentry.setContext(key, value);
}

/**
 * Add breadcrumb for debugging
 * @param {Object} breadcrumb - Breadcrumb data
 */
function addBreadcrumb(breadcrumb) {
  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Express error handler middleware
 * Should be added after all other middleware and routes
 */
const sentryErrorHandler = Sentry.Handlers.errorHandler({
  shouldHandleError(error) {
    // Capture all errors with status code 500 or higher
    return !error.statusCode || error.statusCode >= 500;
  }
});

/**
 * Express request handler middleware
 * Should be added early in the middleware chain
 */
const sentryRequestHandler = Sentry.Handlers.requestHandler({
  user: ['id', 'email', 'username']
});

/**
 * Express tracing handler for performance monitoring
 */
const sentryTracingHandler = Sentry.Handlers.tracingHandler();

module.exports = {
  initSentry,
  captureException,
  captureMessage,
  setUser,
  setContext,
  addBreadcrumb,
  sentryErrorHandler,
  sentryRequestHandler,
  sentryTracingHandler,
  Sentry
};
