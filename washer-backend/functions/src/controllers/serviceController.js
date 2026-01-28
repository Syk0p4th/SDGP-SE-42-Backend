/* eslint-disable max-len */
const { db } = require('../config/firebase');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { COLLECTIONS } = require('../utils/constants');
const logger = require('../config/logger');

/**
 * Create a new service (admin only)
 * POST /services
 */
exports.createService = asyncHandler(async (req, res) => {
  const { name, description, basePrice, durationMin, category, images, vehicleTypePricing } = req.body;

  if (!name || !basePrice || !durationMin) {
    throw new AppError('Name, base price, and duration are required', 400, 'VALIDATION_ERROR');
  }

  const serviceData = {
    name,
    description: description || '',
    basePrice,
    durationMin,
    category: category || 'wash',
    images: images || [],
    vehicleTypePricing: vehicleTypePricing || null,
    isActive: true,
    createdAt: new Date().toISOString(),
    createdBy: req.user.uid
  };

  const serviceRef = await db.collection(COLLECTIONS.SERVICES).add(serviceData);

  logger.info('Service created', { serviceId: serviceRef.id, name, createdBy: req.user.uid });

  res.status(201).json({
    success: true,
    message: 'Service created successfully',
    service: {
      id: serviceRef.id,
      ...serviceData
    }
  });
});

/**
 * Get all services (public)
 * GET /services
 */
exports.getServices = asyncHandler(async (req, res) => {
  const { category, isActive } = req.query;

  let query = db.collection(COLLECTIONS.SERVICES);

  // Filter by category
  if (category) {
    query = query.where('category', '==', category);
  }

  // Filter by active status (default to showing only active for non-staff)
  const showInactive = req.user && (req.user.role === 'staff' || req.user.role === 'admin');
  if (isActive !== undefined || !showInactive) {
    const activeFilter = isActive === 'false' ? false : true;
    query = query.where('isActive', '==', activeFilter);
  }

  const snapshot = await query.get();

  const services = [];
  snapshot.forEach((doc) => {
    services.push({
      id: doc.id,
      ...doc.data()
    });
  });

  res.status(200).json({
    success: true,
    count: services.length,
    services
  });
});

/**
 * Get service by ID
 * GET /services/:id
 */
exports.getServiceById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const serviceDoc = await db.collection(COLLECTIONS.SERVICES).doc(id).get();

  if (!serviceDoc.exists) {
    throw new AppError('Service not found', 404, 'SERVICE_NOT_FOUND');
  }

  res.status(200).json({
    success: true,
    service: {
      id: serviceDoc.id,
      ...serviceDoc.data()
    }
  });
});

/**
 * Update service (admin only)
 * PATCH /services/:id
 */
exports.updateService = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, basePrice, durationMin, category, images, vehicleTypePricing, isActive } = req.body;

  const serviceDoc = await db.collection(COLLECTIONS.SERVICES).doc(id).get();

  if (!serviceDoc.exists) {
    throw new AppError('Service not found', 404, 'SERVICE_NOT_FOUND');
  }

  const updates = {};

  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (basePrice !== undefined) updates.basePrice = basePrice;
  if (durationMin !== undefined) updates.durationMin = durationMin;
  if (category !== undefined) updates.category = category;
  if (images !== undefined) updates.images = images;
  if (vehicleTypePricing !== undefined) updates.vehicleTypePricing = vehicleTypePricing;
  if (isActive !== undefined) updates.isActive = isActive;

  if (Object.keys(updates).length === 0) {
    throw new AppError('No fields to update', 400, 'VALIDATION_ERROR');
  }

  await db.collection(COLLECTIONS.SERVICES).doc(id).update(updates);

  logger.info('Service updated', { serviceId: id, updates: Object.keys(updates), updatedBy: req.user.uid });

  res.status(200).json({
    success: true,
    message: 'Service updated successfully',
    updates
  });
});

/**
 * Delete service (admin only)
 * DELETE /services/:id
 */
exports.deleteService = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const serviceDoc = await db.collection(COLLECTIONS.SERVICES).doc(id).get();

  if (!serviceDoc.exists) {
    throw new AppError('Service not found', 404, 'SERVICE_NOT_FOUND');
  }

  // Soft delete by setting isActive to false
  await db.collection(COLLECTIONS.SERVICES).doc(id).update({
    isActive: false
  });

  logger.info('Service deleted (soft delete)', { serviceId: id, deletedBy: req.user.uid });

  res.status(200).json({
    success: true,
    message: 'Service deleted successfully'
  });
});
