/* eslint-disable max-len */
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Logging middleware for HTTP requests
 * Logs request details, response status, and timing
 */
const requestLogger = (req, res, next) => {
  // Generate unique request ID
  req.id = uuidv4();

  // Capture start time
  const startTime = Date.now();

  // Log incoming request
  logger.http(`Incoming Request [${req.id}]`, {
    requestId: req.id,
    method: req.method,
    url: req.url,
    path: req.path,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    query: req.query,
    body: sanitizeBody(req.body)
  });

  // Capture response
  const originalSend = res.send;
  res.send = function(data) {
    res.send = originalSend;

    const duration = Date.now() - startTime;
    const level = res.statusCode >= 400 ? 'warn' : 'http';

    logger[level](`Response [${req.id}]`, {
      requestId: req.id,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('content-length')
    });

    return res.send(data);
  };

  next();
};

/**
 * Sanitize request body to remove sensitive information
 * @param {Object} body - Request body
 * @return {Object} Sanitized body
 */
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') {
    return body;
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

  const sanitized = { ...body };

  sensitiveFields.forEach((field) => {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  });

  return sanitized;
}

/**
 * Error logging middleware
 * Should be placed after all routes
 */
const errorLogger = (err, req, res, next) => {
  logger.error(`Error [${req.id || 'Unknown'}]`, {
    requestId: req.id,
    error: {
      message: err.message,
      stack: err.stack,
      code: err.code,
      statusCode: err.statusCode || 500
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: sanitizeBody(req.body)
    }
  });

  next(err);
};

module.exports = {
  requestLogger,
  errorLogger
};
