/* eslint-disable max-len */
const express = require('express');
// eslint-disable-next-line new-cap
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { optionalAuth, authenticate, isAdmin } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Services
 *   description: Service management
 */

// Public routes with optional auth
router.get('/', optionalAuth, serviceController.getServices);
router.get('/:id', serviceController.getServiceById);

// Admin-only routes
router.post('/', authenticate, isAdmin, serviceController.createService);
router.patch('/:id', authenticate, isAdmin, serviceController.updateService);
router.delete('/:id', authenticate, isAdmin, serviceController.deleteService);

module.exports = router;
