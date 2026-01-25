/* eslint-disable max-len */
const logger = require('../config/logger');

/**
 * Placeholder for SMS service
 * In production, integrate with Twilio or other SMS provider
 */
async function sendSMS(phoneNumber, message) {
  logger.info('SMS would be sent', { phoneNumber, message });

  // TODO: Implement actual SMS sending
  // Example with Twilio:
  // const twilio = require('twilio');
  // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  // await client.messages.create({
  //   body: message,
  //   from: process.env.TWILIO_PHONE_NUMBER,
  //   to: phoneNumber
  // });

  return { success: true, message: 'SMS queued (not implemented yet)' };
}

/**
 * Send booking reminder SMS
 */
async function sendBookingReminder(phoneNumber, bookingDetails) {
  const message = `Reminder: Your ${bookingDetails.serviceName} is scheduled for ${bookingDetails.scheduledAt}. See you soon!`;

  return sendSMS(phoneNumber, message);
}

/**
 * Send booking confirmation SMS
 */
async function sendBookingConfirmationSMS(phoneNumber, bookingDetails) {
  const message = `Your booking for ${bookingDetails.serviceName} on ${bookingDetails.scheduledAt} has been confirmed!`;

  return sendSMS(phoneNumber, message);
}

module.exports = {
  sendSMS,
  sendBookingReminder,
  sendBookingConfirmationSMS
};
