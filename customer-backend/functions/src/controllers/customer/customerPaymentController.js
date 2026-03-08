const crypto = require('crypto');
const { db, admin } = require('../../config/firebase');
const { successResponse, errorResponse } = require('../../utils/response');

const MERCHANT_ID = process.env.PAYHERE_MERCHANT_ID;
const MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET;
const SANDBOX = process.env.PAYHERE_SANDBOX === 'true';

// ─── Generate MD5 hash for PayHere ───────────────────────────────────────────
function generateHash(merchantId, orderId, amount, currency, merchantSecret) {
  const hashedSecret = crypto
    .createHash('md5')
    .update(merchantSecret)
    .digest('hex')
    .toUpperCase();

  const hashStr = `${merchantId}${orderId}${amount}${currency}${hashedSecret}`;
  return crypto.createHash('md5').update(hashStr).digest('hex').toUpperCase();
}

// ─── POST /payments/hash ──────────────────────────────────────────────────────
// Generate payment hash — called by app before launching PayHere SDK
exports.generatePaymentHash = async (req, res) => {
  try {
    const { bookingId, amount, currency = 'LKR' } = req.body;

    if (!bookingId || !amount) {
      return errorResponse(res, 'Booking ID and amount are required', 400);
    }

    const bookingDoc = await db.collection('bookings').doc(bookingId).get();
    if (!bookingDoc.exists) return errorResponse(res, 'Booking not found', 404);

    const booking = bookingDoc.data();
    if (booking.customerId !== req.user.uid) return errorResponse(res, 'Unauthorized', 403);
    if (booking.paymentStatus === 'paid') return errorResponse(res, 'Already paid', 400);

    const orderId = `WX-${bookingId}`;
    const formattedAmount = parseFloat(amount).toFixed(2);
    const hash = generateHash(MERCHANT_ID, orderId, formattedAmount, currency, MERCHANT_SECRET);

    return successResponse(res, {
      merchantId: MERCHANT_ID,
      orderId,
      hash,
      amount: formattedAmount,
      currency,
      sandbox: SANDBOX,
      notifyUrl: `${process.env.BACKEND_URL}/api/customer/payments/notify`,
    }, 'Hash generated');

  } catch (error) {
    console.error('Generate hash error:', error);
    return errorResponse(res, 'Failed to generate payment hash', 500);
  }
};

// ─── POST /payments/notify ────────────────────────────────────────────────────
// PayHere server callback — NO auth middleware on this route
exports.paymentNotify = async (req, res) => {
  try {
    const { merchant_id, order_id, payment_id, payhere_amount, payhere_currency, status_code, md5sig } = req.body;

    if (merchant_id !== MERCHANT_ID) return res.sendStatus(400);

    // Verify signature
    const hashedSecret = crypto.createHash('md5').update(MERCHANT_SECRET).digest('hex').toUpperCase();
    const localHash = crypto
      .createHash('md5')
      .update(`${merchant_id}${order_id}${payhere_amount}${payhere_currency}${status_code}${hashedSecret}`)
      .digest('hex')
      .toUpperCase();

    if (localHash !== md5sig) return res.sendStatus(400);

    const bookingId = order_id.replace('WX-', '');
    const bookingRef = db.collection('bookings').doc(bookingId);
    const bookingDoc = await bookingRef.get();
    if (!bookingDoc.exists) return res.sendStatus(404);

    const booking = bookingDoc.data();

    // status_code: 2=success, 0=pending, -1=cancelled, -2=failed
    const paymentStatus = status_code === '2' ? 'paid' : status_code === '0' ? 'pending' : 'failed';

    await bookingRef.update({
      paymentStatus,
      paymentId: payment_id,
      paymentAmount: parseFloat(payhere_amount),
      paymentCurrency: payhere_currency,
      paymentDate: new Date().toISOString(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // On successful payment — notify the assigned washer via FCM
    if (status_code === '2') {
      await notifyWasher(bookingId, booking);
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error('Payment notify error:', error);
    return res.sendStatus(500);
  }
};

// ─── GET /payments/status/:bookingId ─────────────────────────────────────────
exports.getPaymentStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const bookingDoc = await db.collection('bookings').doc(bookingId).get();
    if (!bookingDoc.exists) return errorResponse(res, 'Booking not found', 404);

    const booking = bookingDoc.data();
    if (booking.customerId !== req.user.uid) return errorResponse(res, 'Unauthorized', 403);

    return successResponse(res, {
      bookingId,
      paymentStatus: booking.paymentStatus || 'unpaid',
      paymentId: booking.paymentId || null,
      paymentAmount: booking.paymentAmount || null,
      paymentDate: booking.paymentDate || null,
    }, 'Payment status retrieved');
  } catch (error) {
    console.error('Get payment status error:', error);
    return errorResponse(res, 'Failed to get payment status', 500);
  }
};

// ─── FCM notify washer ────────────────────────────────────────────────────────
async function notifyWasher(bookingId, booking) {
  try {
    const washerId = booking.assignedStaffId || booking.providerId;
    if (!washerId) return;

    const washerDoc = await db.collection('providers').doc(washerId).get();
    if (!washerDoc.exists) return;

    const fcmToken = washerDoc.data().fcmToken;
    if (!fcmToken) return;

    await admin.messaging().send({
      token: fcmToken,
      notification: {
        title: '💳 Payment Confirmed!',
        body: `Payment received for booking #${bookingId.slice(-6).toUpperCase()}. Head to the location!`,
      },
      data: {
        type: 'payment_confirmed',
        bookingId,
        screen: 'booking-details',
      },
      android: { priority: 'high', notification: { sound: 'default' } },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    });

    // Save to notifications collection
    await db.collection('notifications').add({
      userId: washerId,
      userType: 'provider',
      type: 'payment_confirmed',
      title: '💳 Payment Confirmed',
      body: `Payment received for booking #${bookingId.slice(-6).toUpperCase()}`,
      bookingId,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ Washer notified for booking:', bookingId);
  } catch (error) {
    console.error('Notify washer error:', error);
  }
}
