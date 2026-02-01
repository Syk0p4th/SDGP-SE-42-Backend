const { admin, db } = require('../../config/firebase');
const { successResponse, errorResponse } = require('../../utils/response');

/**
 * Get All Addresses
 * Get customer's saved addresses
 */
exports.getAddresses = async (req, res) => {
  try {
    const uid = req.user.uid;

    console.log(`Fetching addresses for user: ${uid}`);

    const addressesSnapshot = await db
      .collection('customers')
      .doc(uid)
      .collection('addresses')
      .orderBy('createdAt', 'desc')
      .get();

    const addresses = [];
    addressesSnapshot.forEach(doc => {
      addresses.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return successResponse(
      res,
      { addresses },
      'Addresses retrieved successfully'
    );

  } catch (error) {
    console.error('Get addresses error:', error);
    return errorResponse(res, 'Failed to get addresses', 500);
  }
};

/**
 * Add Address
 * Add a new address to customer's saved addresses
 */
exports.addAddress = async (req, res) => {
  try {
    const uid = req.user.uid;
    const {
      label,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      latitude,
      longitude,
      isDefault
    } = req.body;

    console.log(`Adding address for user: ${uid}`);

    // Validate required fields
    if (!label || !addressLine1 || !city || !country) {
      return errorResponse(
        res,
        'Label, address line 1, city, and country are required',
        400
      );
    }

    // If this is set as default, unset other defaults
    if (isDefault) {
      const addressesSnapshot = await db
        .collection('customers')
        .doc(uid)
        .collection('addresses')
        .where('isDefault', '==', true)
        .get();

      const batch = db.batch();
      addressesSnapshot.forEach(doc => {
        batch.update(doc.ref, { isDefault: false });
      });
      await batch.commit();
    }

    // Create address document
    const addressData = {
      label: label.trim(),
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2 ? addressLine2.trim() : null,
      city: city.trim(),
      state: state ? state.trim() : null,
      postalCode: postalCode ? postalCode.trim() : null,
      country: country.trim(),
      location: latitude && longitude ? {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude)
      } : null,
      isDefault: isDefault || false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Add to Firestore
    const addressRef = await db
      .collection('customers')
      .doc(uid)
      .collection('addresses')
      .add(addressData);

    // Get the created address
    const newAddress = await addressRef.get();

    console.log(`Address added successfully: ${addressRef.id}`);

    return successResponse(
      res,
      {
        id: addressRef.id,
        ...newAddress.data()
      },
      'Address added successfully',
      201
    );

  } catch (error) {
    console.error('Add address error:', error);
    return errorResponse(res, 'Failed to add address', 500);
  }
};

/**
 * Update Address
 * Update an existing address
 */
exports.updateAddress = async (req, res) => {
  try {
    const uid = req.user.uid;
    const { addressId } = req.params;
    const {
      label,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      latitude,
      longitude,
      isDefault
    } = req.body;

    console.log(`Updating address ${addressId} for user: ${uid}`);

    // Check if address exists and belongs to user
    const addressRef = db
      .collection('customers')
      .doc(uid)
      .collection('addresses')
      .doc(addressId);

    const addressDoc = await addressRef.get();

    if (!addressDoc.exists) {
      return errorResponse(res, 'Address not found', 404);
    }

    // Build update object
    const updates = {};

    if (label !== undefined) updates.label = label.trim();
    if (addressLine1 !== undefined) updates.addressLine1 = addressLine1.trim();
    if (addressLine2 !== undefined) updates.addressLine2 = addressLine2 ? addressLine2.trim() : null;
    if (city !== undefined) updates.city = city.trim();
    if (state !== undefined) updates.state = state ? state.trim() : null;
    if (postalCode !== undefined) updates.postalCode = postalCode ? postalCode.trim() : null;
    if (country !== undefined) updates.country = country.trim();

    if (latitude !== undefined && longitude !== undefined) {
      updates.location = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude)
      };
    }

    if (isDefault !== undefined) {
      updates.isDefault = isDefault;

      // If setting as default, unset other defaults
      if (isDefault) {
        const addressesSnapshot = await db
          .collection('customers')
          .doc(uid)
          .collection('addresses')
          .where('isDefault', '==', true)
          .get();

        const batch = db.batch();
        addressesSnapshot.forEach(doc => {
          if (doc.id !== addressId) {
            batch.update(doc.ref, { isDefault: false });
          }
        });
        await batch.commit();
      }
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse(res, 'No fields to update', 400);
    }

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    // Update address
    await addressRef.update(updates);

    // Get updated address
    const updatedAddress = await addressRef.get();

    console.log(`Address updated successfully: ${addressId}`);

    return successResponse(
      res,
      {
        id: addressId,
        ...updatedAddress.data()
      },
      'Address updated successfully'
    );

  } catch (error) {
    console.error('Update address error:', error);
    return errorResponse(res, 'Failed to update address', 500);
  }
};

/**
 * Delete Address
 * Delete an address
 */
exports.deleteAddress = async (req, res) => {
  try {
    const uid = req.user.uid;
    const { addressId } = req.params;

    console.log(`Deleting address ${addressId} for user: ${uid}`);

    // Check if address exists
    const addressRef = db
      .collection('customers')
      .doc(uid)
      .collection('addresses')
      .doc(addressId);

    const addressDoc = await addressRef.get();

    if (!addressDoc.exists) {
      return errorResponse(res, 'Address not found', 404);
    }

    // Delete address
    await addressRef.delete();

    console.log(`Address deleted successfully: ${addressId}`);

    return successResponse(
      res,
      null,
      'Address deleted successfully'
    );

  } catch (error) {
    console.error('Delete address error:', error);
    return errorResponse(res, 'Failed to delete address', 500);
  }
};

/**
 * Set Default Address
 * Set an address as the default
 */
exports.setDefaultAddress = async (req, res) => {
  try {
    const uid = req.user.uid;
    const { addressId } = req.params;

    console.log(`Setting default address ${addressId} for user: ${uid}`);

    // Check if address exists
    const addressRef = db
      .collection('customers')
      .doc(uid)
      .collection('addresses')
      .doc(addressId);

    const addressDoc = await addressRef.get();

    if (!addressDoc.exists) {
      return errorResponse(res, 'Address not found', 404);
    }

    // Unset all other defaults
    const addressesSnapshot = await db
      .collection('customers')
      .doc(uid)
      .collection('addresses')
      .where('isDefault', '==', true)
      .get();

    const batch = db.batch();
    addressesSnapshot.forEach(doc => {
      batch.update(doc.ref, { isDefault: false });
    });

    // Set this address as default
    batch.update(addressRef, { 
      isDefault: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();

    console.log(`Default address set: ${addressId}`);

    return successResponse(
      res,
      null,
      'Default address updated successfully'
    );

  } catch (error) {
    console.error('Set default address error:', error);
    return errorResponse(res, 'Failed to set default address', 500);
  }
};

