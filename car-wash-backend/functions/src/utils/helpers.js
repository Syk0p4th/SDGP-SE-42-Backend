/* eslint-disable max-len */

/**
 * Format timestamp to readable date string
 */
function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Format timestamp to readable datetime string
 */
function formatDateTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Sanitize user input
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input.trim();
}

/**
 * Generate random ID
 */
function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Calculate pagination offset
 */
function getPaginationOffset(page, limit) {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  return (pageNum - 1) * limitNum;
}

/**
 * Check if email is valid
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if phone number is valid (basic check)
 */
function isValidPhoneNumber(phone) {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
}

/**
 * Calculate duration between two timestamps
 */
function calculateDuration(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMs = end - start;
  const minutes = Math.floor(durationMs / 60000);
  return minutes;
}

/**
 * Check if date is in the future
 */
function isFutureDate(dateString) {
  const date = new Date(dateString);
  return date > new Date();
}

/**
 * Format currency
 */
function formatCurrency(amount, currency = 'LKR') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
}

/**
 * Mask sensitive data (e.g., phone number, email)
 */
function maskSensitiveData(data, type = 'email') {
  if (!data) return '';

  if (type === 'email') {
    const [username, domain] = data.split('@');
    if (!username || !domain) return data;
    const maskedUsername = username.charAt(0) + '***' + username.charAt(username.length - 1);
    return `${maskedUsername}@${domain}`;
  }

  if (type === 'phone') {
    return data.substring(0, 3) + '****' + data.substring(data.length - 2);
  }

  return data;
}

module.exports = {
  formatDate,
  formatDateTime,
  sanitizeInput,
  generateId,
  getPaginationOffset,
  isValidEmail,
  isValidPhoneNumber,
  calculateDuration,
  isFutureDate,
  formatCurrency,
  maskSensitiveData
};
