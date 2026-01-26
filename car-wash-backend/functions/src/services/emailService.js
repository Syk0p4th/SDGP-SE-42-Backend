/* eslint-disable max-len */
const logger = require('../config/logger');

/**
 * Placeholder for email service
 * In production, integrate with SendGrid, Mailgun, or Firebase Email Extensions
 */
async function sendEmail(to, subject, body) {
  logger.info('Email would be sent', { to, subject });

  // TODO: Implement actual email sending
  // Example with SendGrid:
  // const sgMail = require('@sendgrid/mail');
  // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  // await sgMail.send({ to, from: 'noreply@carwash.com', subject, html: body });

  return { success: true, message: 'Email queued (not implemented yet)' };
}

/**
 * Send booking confirmation email
 */
async function sendBookingConfirmation(userEmail, bookingDetails) {
  const subject = 'Booking Confirmation';
  const body = `
    <h2>Your booking has been confirmed!</h2>
    <p>Service: ${bookingDetails.serviceName}</p>
    <p>Scheduled: ${bookingDetails.scheduledAt}</p>
    <p>Thank you for choosing our service.</p>
  `;

  return sendEmail(userEmail, subject, body);
}

/**
 * Send booking cancellation email
 */
async function sendBookingCancellation(userEmail, bookingDetails) {
  const subject = 'Booking Cancelled';
  const body = `
    <h2>Your booking has been cancelled</h2>
    <p>Service: ${bookingDetails.serviceName}</p>
    <p>If you didn't cancel this, please contact us.</p>
  `;

  return sendEmail(userEmail, subject, body);
}

/**
 * Send email verification
 */
async function sendVerificationEmail(userEmail, verificationLink) {
  const subject = 'Verify Your Email';
  const body = `
    <h2>Welcome!</h2>
    <p>Please verify your email by clicking the link below:</p>
    <a href="${verificationLink}">Verify Email</a>
  `;

  return sendEmail(userEmail, subject, body);
}

module.exports = {
  sendEmail,
  sendBookingConfirmation,
  sendBookingCancellation,
  sendVerificationEmail
};
