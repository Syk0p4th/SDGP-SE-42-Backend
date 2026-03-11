const { admin, db } = require('../../config/firebase');
const { successResponse, errorResponse } = require('../../utils/response');

// ============================================================
// GET ALL VEHICLES
// GET /vehicles
// ============================================================
exports.getVehicles = async (req, res) => {
  try {
    const { uid } = req.user;

    const snapshot = await db
      .collection('customers')
      .doc(uid)
      .collection('vehicles')
      .where('isActive', '==', true)
      .get();

    const vehicles = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Sort by createdAt (newest first)
    vehicles.sort((a, b) => {
      const aTime = a.createdAt?._seconds || 0;
      const bTime = b.createdAt?._seconds || 0;
      return bTime - aTime;
    });

    return successResponse(res, { vehicles }, 'Vehicles retrieved successfully');

  } catch (error) {
    console.error('Get vehicles error:', error);
    return errorResponse(res, 'Failed to retrieve vehicles', 500);
  }
};

// ============================================================
// GET VEHICLE DETAILS
// GET /vehicles/:vehicleId
// ============================================================
exports.getVehicleDetails = async (req, res) => {
  try {
    const { uid } = req.user;
    const { vehicleId } = req.params;

    const vehicleDoc = await db
      .collection('customers')
      .doc(uid)
      .collection('vehicles')
      .doc(vehicleId)
      .get();

    if (!vehicleDoc.exists) {
      return errorResponse(res, 'Vehicle not found', 404);
    }

    const vehicle = { id: vehicleDoc.id, ...vehicleDoc.data() };

    // Get active subscription for this vehicle
    const subscriptionSnapshot = await db
      .collection('subscriptions')
      .where('customerId', '==', uid)
      .where('vehicleId', '==', vehicleId)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (!subscriptionSnapshot.empty) {
      const subscriptionDoc = subscriptionSnapshot.docs[0];
      vehicle.subscription = { id: subscriptionDoc.id, ...subscriptionDoc.data() };

      // Get plan details
      const planDoc = await db.collection('subscription_plans').doc(vehicle.subscription.planId).get();
      if (planDoc.exists) {
        vehicle.subscription.plan = { id: planDoc.id, ...planDoc.data() };
      }
    }

    return successResponse(res, { vehicle }, 'Vehicle details retrieved successfully');

  } catch (error) {
    console.error('Get vehicle details error:', error);
    return errorResponse(res, 'Failed to retrieve vehicle details', 500);
  }
};

// ============================================================
// ADD VEHICLE
// POST /vehicles
// ============================================================
exports.addVehicle = async (req, res) => {
  try {
    const { uid } = req.user;
    const { make, model, year, color, licensePlate, nickname , type } = req.body;

    // Check if license plate already exists for this customer
    const existingSnapshot = await db
      .collection('customers')
      .doc(uid)
      .collection('vehicles')
      .where('licensePlate', '==', licensePlate)
      .where('isActive', '==', true)
      .get();

    if (!existingSnapshot.empty) {
      return errorResponse(res, 'A vehicle with this license plate already exists in your fleet', 400);
    }

    const vehicleData = {
      make,
      model,
      year: Number(year),
      type: type || null,
      color,
      licensePlate,
      nickname: nickname || `${make} ${model}`,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const vehicleRef = await db
      .collection('customers')
      .doc(uid)
      .collection('vehicles')
      .add(vehicleData);

    const createdVehicle = await vehicleRef.get();

    return successResponse(
      res,
      { vehicle: { id: createdVehicle.id, ...createdVehicle.data() } },
      'Vehicle added successfully',
      201
    );

  } catch (error) {
    console.error('Add vehicle error:', error);
    return errorResponse(res, 'Failed to add vehicle', 500);
  }
};

// ============================================================
// UPDATE VEHICLE
// PUT /vehicles/:vehicleId
// ============================================================
exports.updateVehicle = async (req, res) => {
  try {
    const { uid } = req.user;
    const { vehicleId } = req.params;
    const { make, model, year, color, licensePlate, nickname, type } = req.body;

    const vehicleRef = db
      .collection('customers')
      .doc(uid)
      .collection('vehicles')
      .doc(vehicleId);

    const vehicleDoc = await vehicleRef.get();

    if (!vehicleDoc.exists) {
      return errorResponse(res, 'Vehicle not found', 404);
    }

    // If updating license plate, check for duplicates
    if (licensePlate && licensePlate !== vehicleDoc.data().licensePlate) {
      const existingSnapshot = await db
        .collection('customers')
        .doc(uid)
        .collection('vehicles')
        .where('licensePlate', '==', licensePlate)
        .where('isActive', '==', true)
        .get();

      if (!existingSnapshot.empty) {
        return errorResponse(res, 'A vehicle with this license plate already exists in your fleet', 400);
      }
    }

    const updates = {};
    if (make !== undefined) updates.make = make;
    if (model !== undefined) updates.model = model;
    if (year !== undefined) updates.year = Number(year);
    if (color !== undefined) updates.color = color;
    if (licensePlate !== undefined) updates.licensePlate = licensePlate;
    if (nickname !== undefined) updates.nickname = nickname;
    if (type !== undefined) updates.type = type;
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await vehicleRef.update(updates);

    const updatedVehicle = await vehicleRef.get();

    return successResponse(
      res,
      { vehicle: { id: updatedVehicle.id, ...updatedVehicle.data() } },
      'Vehicle updated successfully'
    );

  } catch (error) {
    console.error('Update vehicle error:', error);
    return errorResponse(res, 'Failed to update vehicle', 500);
  }
};

// ============================================================
// DELETE VEHICLE (Soft delete)
// DELETE /vehicles/:vehicleId
// ============================================================
exports.deleteVehicle = async (req, res) => {
  try {
    const { uid } = req.user;
    const { vehicleId } = req.params;

    const vehicleRef = db
      .collection('customers')
      .doc(uid)
      .collection('vehicles')
      .doc(vehicleId);

    const vehicleDoc = await vehicleRef.get();

    if (!vehicleDoc.exists) {
      return errorResponse(res, 'Vehicle not found', 404);
    }

    // Check if vehicle has active subscription
    const activeSubscriptionSnapshot = await db
      .collection('subscriptions')
      .where('customerId', '==', uid)
      .where('vehicleId', '==', vehicleId)
      .where('status', '==', 'active')
      .get();

    if (!activeSubscriptionSnapshot.empty) {
      return errorResponse(
        res,
        'Cannot delete vehicle with active subscription. Please cancel the subscription first.',
        400
      );
    }

    // Soft delete
    await vehicleRef.update({
      isActive: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return successResponse(res, null, 'Vehicle deleted successfully');

  } catch (error) {
    console.error('Delete vehicle error:', error);
    return errorResponse(res, 'Failed to delete vehicle', 500);
  }
};