const crypto = require('crypto');
const { admin, db } = require('../../config/firebase');
const { successResponse, errorResponse } = require('../../utils/response');

const MERCHANT_ID = process.env.PAYHERE_MERCHANT_ID;
const MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET;
const SANDBOX = process.env.PAYHERE_SANDBOX === 'true';

function generateHash(merchantId, orderId, amount, currency, merchantSecret) {
  const hashedSecret = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
  const hashStr = `${merchantId}${orderId}${amount}${currency}${hashedSecret}`;
  return crypto.createHash('md5').update(hashStr).digest('hex').toUpperCase();
}

// ============================================================
// GET ALL SUBSCRIPTION PLANS
// GET /subscriptions/plans
// ============================================================
exports.getPlans = async (req, res) => {
  try {
    const snapshot = await db
      .collection('subscription_plans')
      .where('isActive', '==', true)
      .get();

    const plans = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    plans.sort((a, b) => a.price - b.price);

    return successResponse(res, { plans }, 'Subscription plans retrieved successfully');
  } catch (error) {
    console.error('Get plans error:', error);
    return errorResponse(res, 'Failed to retrieve subscription plans', 500);
  }
};

// ============================================================
// GET MY SUBSCRIPTIONS
// GET /subscriptions
// ============================================================
exports.getSubscriptions = async (req, res) => {
  try {
    const { uid } = req.user;
    const { status } = req.query;

    let query = db.collection('subscriptions').where('customerId', '==', uid);
    if (status) {
      const validStatuses = ['active', 'cancelled', 'expired', 'pending'];
      if (!validStatuses.includes(status)) return errorResponse(res, 'Invalid status filter', 400);
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    const subscriptions = [];

    for (const doc of snapshot.docs) {
      const subscription = { id: doc.id, ...doc.data() };

      const vehicleDoc = await db.collection('customers').doc(uid).collection('vehicles').doc(subscription.vehicleId).get();
      if (vehicleDoc.exists) subscription.vehicle = { id: vehicleDoc.id, ...vehicleDoc.data() };

      const planDoc = await db.collection('subscription_plans').doc(subscription.planId).get();
      if (planDoc.exists) subscription.plan = { id: planDoc.id, ...planDoc.data() };

      subscriptions.push(subscription);
    }

    subscriptions.sort((a, b) => {
      const aTime = a.createdAt?._seconds || 0;
      const bTime = b.createdAt?._seconds || 0;
      return bTime - aTime;
    });

    return successResponse(res, { subscriptions }, 'Subscriptions retrieved successfully');
  } catch (error) {
    console.error('Get subscriptions error:', error);
    return errorResponse(res, 'Failed to retrieve subscriptions', 500);
  }
};

// ============================================================
// INITIATE SUBSCRIPTION — generates PayHere hash
// POST /subscriptions/initiate
// ============================================================
exports.initiateSubscription = async (req, res) => {
  try {
    const { uid } = req.user;
    const { planId, vehicleId } = req.body;

    const planDoc = await db.collection('subscription_plans').doc(planId).get();
    if (!planDoc.exists || !planDoc.data().isActive) {
      return errorResponse(res, 'Subscription plan not found or inactive', 404);
    }
    const plan = planDoc.data();

    const vehicleDoc = await db.collection('customers').doc(uid).collection('vehicles').doc(vehicleId).get();
    if (!vehicleDoc.exists || !vehicleDoc.data().isActive) {
      return errorResponse(res, 'Vehicle not found or inactive', 404);
    }

    // Check for existing active subscription on this vehicle
    const existingSnap = await db.collection('subscriptions')
      .where('customerId', '==', uid)
      .where('vehicleId', '==', vehicleId)
      .where('status', '==', 'active')
      .get();

    if (!existingSnap.empty) {
      return errorResponse(res, 'This vehicle already has an active subscription', 400);
    }

    // Create pending subscription first
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    const subscriptionData = {
      customerId: uid,
      vehicleId,
      planId,
      planName: plan.name,
      status: 'pending', // becomes 'active' after payment
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      autoRenew: true,
      // Service allowances from plan
      remainingWashes: plan.allowances.washes,
      remainingInteriorCleans: plan.allowances.interiorCleans,
      remainingTireCleans: plan.allowances.tireCleans,
      remainingFullDetails: plan.allowances.fullDetails,
      totalWashes: plan.allowances.washes,
      totalInteriorCleans: plan.allowances.interiorCleans,
      totalTireCleans: plan.allowances.tireCleans,
      totalFullDetails: plan.allowances.fullDetails,
      paymentStatus: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const subRef = await db.collection('subscriptions').add(subscriptionData);

    // Generate PayHere hash
    const orderId = `SUB-${subRef.id}`;
    const amount = parseFloat(plan.price).toFixed(2);
    const hash = generateHash(MERCHANT_ID, orderId, amount, 'LKR', MERCHANT_SECRET);

    // Get customer profile for billing
    const customerDoc = await db.collection('customers').doc(uid).get();
    const customer = customerDoc.data() || {};

    return successResponse(res, {
      subscriptionId: subRef.id,
      payment: {
        merchantId: MERCHANT_ID,
        orderId,
        hash,
        amount,
        currency: 'LKR',
        sandbox: SANDBOX,
        notifyUrl: `${process.env.BACKEND_URL}/api/customer/subscriptions/payment-notify`,
        items: `WashXpress ${plan.name} Plan`,
        firstName: (customer.displayName || 'Customer').split(' ')[0],
        lastName: (customer.displayName || 'User').split(' ').slice(1).join(' ') || 'User',
        email: customer.email || '',
        phone: customer.phone || '0771234567',
        address: 'Colombo',
        city: 'Colombo',
        country: 'Sri Lanka',
      },
      plan,
    }, 'Subscription initiated');
  } catch (error) {
    console.error('Initiate subscription error:', error);
    return errorResponse(res, 'Failed to initiate subscription', 500);
  }
};

// ============================================================
// SUBSCRIPTION PAYMENT NOTIFY — called by PayHere server
// POST /subscriptions/payment-notify  (NO auth middleware)
// ============================================================
exports.subscriptionPaymentNotify = async (req, res) => {
  try {
    const { merchant_id, order_id, payment_id, payhere_amount, payhere_currency, status_code, md5sig } = req.body;

    if (merchant_id !== MERCHANT_ID) return res.sendStatus(400);

    // Verify hash
    const hashedSecret = crypto.createHash('md5').update(MERCHANT_SECRET).digest('hex').toUpperCase();
    const localHash = crypto
      .createHash('md5')
      .update(`${merchant_id}${order_id}${payhere_amount}${payhere_currency}${status_code}${hashedSecret}`)
      .digest('hex')
      .toUpperCase();

    if (localHash !== md5sig) return res.sendStatus(400);

    // Extract subscription ID from order_id (format: SUB-{subscriptionId})
    const subscriptionId = order_id.replace('SUB-', '');
    const subRef = db.collection('subscriptions').doc(subscriptionId);
    const subDoc = await subRef.get();
    if (!subDoc.exists) return res.sendStatus(404);

    if (status_code === '2') {
      // Payment successful — activate subscription
      await subRef.update({
        status: 'active',
        paymentStatus: 'paid',
        paymentId: payment_id,
        paymentAmount: parseFloat(payhere_amount),
        activatedAt: new Date().toISOString(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Notify customer via FCM
      const sub = subDoc.data();
      await notifyCustomer(sub.customerId, subscriptionId, sub.planName);
      
      // Update customer document with current subscription status
      await updateCustomerSubscriptionStatus(sub.customerId);
    } else {
      // Payment failed — delete pending subscription
      await subRef.update({
        status: 'payment_failed',
        paymentStatus: 'failed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error('Subscription notify error:', error);
    return res.sendStatus(500);
  }
};

// ============================================================
// MANUAL FALLBACK SUBSCRIPTION ACTIVATION
// PATCH /subscriptions/:subscriptionId/activate
// ============================================================
exports.activateSubscriptionFallback = async (req, res) => {
  try {
    const { uid } = req.user;
    const { subscriptionId } = req.params;

    const subRef = db.collection('subscriptions').doc(subscriptionId);
    const subDoc = await subRef.get();
    
    if (!subDoc.exists) return errorResponse(res, 'Subscription not found', 404);
    
    const subscription = subDoc.data();
    if (subscription.customerId !== uid) return errorResponse(res, 'Subscription not found', 404);
    if (subscription.status === 'active') return successResponse(res, { subscription: { id: subDoc.id, ...subDoc.data() } }, 'Subscription is already active');
    
    // Safety check: is it in pending status?
    if (subscription.status !== 'pending') return errorResponse(res, 'Cannot activate subscription in current state', 400);

    await subRef.update({
      status: 'active',
      paymentStatus: 'paid_fallback', // indicated frontend fallback triggered this
      activatedAt: new Date().toISOString(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Notify customer via FCM
    await notifyCustomer(subscription.customerId, subscriptionId, subscription.planName);

    const updatedDoc = await subRef.get();
    return successResponse(res, { subscription: { id: updatedDoc.id, ...updatedDoc.data() } }, 'Subscription activated successfully');
  } catch (error) {
    console.error('Activate subscription fallback error:', error);
    return errorResponse(res, 'Failed to activate subscription', 500);
  }
};

// ============================================================
// CANCEL SUBSCRIPTION
// PATCH /subscriptions/:subscriptionId/cancel
// ============================================================
exports.cancelSubscription = async (req, res) => {
  try {
    const { uid } = req.user;
    const { subscriptionId } = req.params;
    const { reason } = req.body;

    const subDoc = await db.collection('subscriptions').doc(subscriptionId).get();
    if (!subDoc.exists) return errorResponse(res, 'Subscription not found', 404);

    const subscription = subDoc.data();
    if (subscription.customerId !== uid) return errorResponse(res, 'Subscription not found', 404);
    if (subscription.status !== 'active') return errorResponse(res, 'Only active subscriptions can be cancelled', 400);

    await db.collection('subscriptions').doc(subscriptionId).update({
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancellationReason: reason || 'Cancelled by customer',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update customer document with current subscription status
    await updateCustomerSubscriptionStatus(uid);

    const updatedDoc = await db.collection('subscriptions').doc(subscriptionId).get();
    return successResponse(res, { subscription: { id: updatedDoc.id, ...updatedDoc.data() } }, 'Subscription cancelled successfully');
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return errorResponse(res, 'Failed to cancel subscription', 500);
  }
};

// ============================================================
// AUTO-EXPIRE SUBSCRIPTIONS (called by a scheduled job / cron)
// POST /subscriptions/expire-check  (internal use)
// ============================================================
exports.expireSubscriptions = async (req, res) => {
  try {
    const now = new Date().toISOString();
    const snapshot = await db.collection('subscriptions')
      .where('status', '==', 'active')
      .where('endDate', '<=', now)
      .get();

    const batch = db.batch();
    const customerIdsToUpdate = new Set();
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        status: 'expired',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      customerIdsToUpdate.add(doc.data().customerId);
    });

    await batch.commit();
    
    // Update customer document for each affected customer
    for (const customerId of customerIdsToUpdate) {
      await updateCustomerSubscriptionStatus(customerId);
    }

    return successResponse(res, { expired: snapshot.size }, `${snapshot.size} subscriptions expired`);
  } catch (error) {
    console.error('Expire subscriptions error:', error);
    return errorResponse(res, 'Failed to expire subscriptions', 500);
  }
};

// ── FCM notify customer ────────────────────────────────────────────────────────
async function notifyCustomer(customerId, subscriptionId, planName) {
  try {
    const customerDoc = await db.collection('customers').doc(customerId).get();
    if (!customerDoc.exists) return;
    const fcmToken = customerDoc.data().fcmToken;
    if (!fcmToken) return;

    await admin.messaging().send({
      token: fcmToken,
      notification: {
        title: '🎉 Subscription Activated!',
        body: `Your ${planName} plan is now active. Start booking your washes!`,
      },
      data: { type: 'subscription_activated', subscriptionId, screen: 'subscriptions' },
      android: { priority: 'high', notification: { sound: 'default' } },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    });

    await db.collection('notifications').add({
      userId: customerId,
      userType: 'customer',
      type: 'subscription_activated',
      title: '🎉 Subscription Activated',
      body: `Your ${planName} plan is now active.`,
      subscriptionId,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('Notify customer error:', error);
  }
}

// ── Update Customer Subscription Status ────────────────────────────────────
async function updateCustomerSubscriptionStatus(customerId) {
  try {
    const activeSubsSnap = await db.collection('subscriptions')
      .where('customerId', '==', customerId)
      .where('status', '==', 'active')
      .get();
      
    let isSubscribed = false;
    let subscription = 'none';

    if (!activeSubsSnap.empty) {
      isSubscribed = true;
      // Get the first active subscription's plan name, default to 'active'
      const firstActivePlan = activeSubsSnap.docs[0].data().planName;
      subscription = firstActivePlan ? firstActivePlan.toLowerCase() : 'active';
    }

    await db.collection('customers').doc(customerId).update({
      isSubscribed,
      subscription,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`Updated subscription status for customer ${customerId}: isSubscribed=${isSubscribed}, plan=${subscription}`);
  } catch (error) {
    console.error(`Error updating subscription status for customer ${customerId}:`, error);
  }
}
