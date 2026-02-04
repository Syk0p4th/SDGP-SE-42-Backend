const { admin, db } = require('../../config/firebase');
const { successResponse, errorResponse } = require('../../utils/response');

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

    const plans = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Sort by price (cheapest first)
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
      if (!validStatuses.includes(status)) {
        return errorResponse(res, 'Invalid status filter', 400);
      }
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();

    const subscriptions = [];

    for (const doc of snapshot.docs) {
      const subscription = { id: doc.id, ...doc.data() };

      // Get vehicle info
      const vehicleDoc = await db
        .collection('customers')
        .doc(uid)
        .collection('vehicles')
        .doc(subscription.vehicleId)
        .get();

      if (vehicleDoc.exists) {
        subscription.vehicle = { id: vehicleDoc.id, ...vehicleDoc.data() };
      }

      // Get plan info
      const planDoc = await db.collection('subscription_plans').doc(subscription.planId).get();
      if (planDoc.exists) {
        subscription.plan = { id: planDoc.id, ...planDoc.data() };
      }

      subscriptions.push(subscription);
    }

    // Sort by createdAt (newest first)
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
// SUBSCRIBE TO PLAN
// POST /subscriptions
// ============================================================
exports.subscribe = async (req, res) => {
  try {
    const { uid } = req.user;
    const { planId, vehicleId, autoRenew = true } = req.body;

    // Validate plan exists
    const planDoc = await db.collection('subscription_plans').doc(planId).get();
    if (!planDoc.exists || !planDoc.data().isActive) {
      return errorResponse(res, 'Subscription plan not found or inactive', 404);
    }

    const plan = planDoc.data();

    // Validate vehicle exists and belongs to customer
    const vehicleDoc = await db
      .collection('customers')
      .doc(uid)
      .collection('vehicles')
      .doc(vehicleId)
      .get();

    if (!vehicleDoc.exists || !vehicleDoc.data().isActive) {
      return errorResponse(res, 'Vehicle not found or inactive', 404);
    }

    // Check if vehicle already has active subscription
    const existingSnapshot = await db
      .collection('subscriptions')
      .where('customerId', '==', uid)
      .where('vehicleId', '==', vehicleId)
      .where('status', '==', 'active')
      .get();

    if (!existingSnapshot.empty) {
      return errorResponse(res, 'This vehicle already has an active subscription', 400);
    }

    // Calculate start and end dates
    const startDate = new Date();
    const endDate = new Date();

    if (plan.duration === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (plan.duration === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // Create subscription
    const subscriptionData = {
      customerId: uid,
      vehicleId,
      planId,
      status: 'active', // In production, this would be 'pending' until payment
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      autoRenew,
      remainingWashes: plan.washesPerMonth === 'unlimited' ? 999999 : plan.washesPerMonth,
      totalWashes: plan.washesPerMonth === 'unlimited' ? 999999 : plan.washesPerMonth,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const subscriptionRef = await db.collection('subscriptions').add(subscriptionData);
    const createdSubscription = await subscriptionRef.get();

    return successResponse(
      res,
      {
        subscription: {
          id: createdSubscription.id,
          ...createdSubscription.data(),
          plan,
          vehicle: vehicleDoc.data(),
        },
      },
      'Subscription created successfully',
      201
    );

  } catch (error) {
    console.error('Subscribe error:', error);
    return errorResponse(res, 'Failed to create subscription', 500);
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

    const subscriptionDoc = await db.collection('subscriptions').doc(subscriptionId).get();

    if (!subscriptionDoc.exists) {
      return errorResponse(res, 'Subscription not found', 404);
    }

    const subscription = subscriptionDoc.data();

    if (subscription.customerId !== uid) {
      return errorResponse(res, 'Subscription not found', 404);
    }

    if (subscription.status !== 'active') {
      return errorResponse(res, 'Only active subscriptions can be cancelled', 400);
    }

    await db.collection('subscriptions').doc(subscriptionId).update({
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancellationReason: reason || 'Cancelled by customer',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const updatedDoc = await db.collection('subscriptions').doc(subscriptionId).get();

    return successResponse(
      res,
      { subscription: { id: updatedDoc.id, ...updatedDoc.data() } },
      'Subscription cancelled successfully'
    );

  } catch (error) {
    console.error('Cancel subscription error:', error);
    return errorResponse(res, 'Failed to cancel subscription', 500);
  }
};