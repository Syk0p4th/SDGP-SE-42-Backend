/* eslint-disable max-len */
const jwt = require('jsonwebtoken');

/**
 * Generate a mock JWT token for testing
 * @param {Object} payload - Token payload
 * @param {string} secret - JWT secret (default: 'test-secret')
 * @return {string} JWT token
 */
const generateMockToken = (payload = {}, secret = 'test-secret') => {
  const defaultPayload = {
    uid: 'test-user-id',
    email: 'test@example.com',
    ...payload
  };
  return jwt.sign(defaultPayload, secret, { expiresIn: '1h' });
};

/**
 * Create mock user data
 * @param {Object} overrides - Override default values
 * @return {Object} Mock user object
 */
const createMockUser = (overrides = {}) => ({
  uid: 'test-user-id',
  email: 'test@example.com',
  displayName: 'Test User',
  phoneNumber: '+1234567890',
  role: 'customer',
  createdAt: new Date().toISOString(),
  ...overrides
});

/**
 * Create mock booking data
 * @param {Object} overrides - Override default values
 * @return {Object} Mock booking object
 */
const createMockBooking = (overrides = {}) => ({
  id: 'test-booking-id',
  userId: 'test-user-id',
  serviceId: 'test-service-id',
  date: new Date().toISOString(),
  time: '10:00 AM',
  status: 'pending',
  vehicleType: 'sedan',
  vehicleNumber: 'ABC123',
  totalPrice: 50.00,
  createdAt: new Date().toISOString(),
  ...overrides
});

/**
 * Create mock service data
 * @param {Object} overrides - Override default values
 * @return {Object} Mock service object
 */
const createMockService = (overrides = {}) => ({
  id: 'test-service-id',
  name: 'Basic Wash',
  description: 'Exterior wash and dry',
  duration: 30,
  price: 25.00,
  category: 'wash',
  isActive: true,
  createdAt: new Date().toISOString(),
  ...overrides
});

/**
 * Create mock washer data
 * @param {Object} overrides - Override default values
 * @return {Object} Mock washer object
 */
const createMockWasher = (overrides = {}) => ({
  uid: 'test-washer-id',
  email: 'washer@example.com',
  displayName: 'Test Washer',
  phoneNumber: '+94771234567',
  role: 'washer',
  status: 'active',
  washerStatus: 'pending_approval',
  experience: 2,
  serviceAreas: ['Colombo', 'Gampaha'],
  totalJobs: 0,
  rating: 0,
  reviewCount: 0,
  availability: true,
  createdAt: new Date().toISOString(),
  ...overrides
});

/**
 * Create mock request object for Express
 * @param {Object} overrides - Override default values
 * @return {Object} Mock request object
 */
const createMockRequest = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: null,
  ...overrides
});

/**
 * Create mock response object for Express
 * @return {Object} Mock response object with spy methods
 */
const createMockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

/**
 * Create mock next function for Express middleware
 * @return {Function} Mock next function
 */
const createMockNext = () => jest.fn();

/**
 * Create mock Firestore document reference
 * @param {Object} data - Document data
 * @return {Object} Mock document reference
 */
const createMockDocRef = (data = {}) => ({
  id: 'mock-doc-id',
  exists: true,
  data: () => data,
  get: jest.fn().mockResolvedValue({
    exists: true,
    id: 'mock-doc-id',
    data: () => data
  }),
  set: jest.fn().mockResolvedValue({}),
  update: jest.fn().mockResolvedValue({}),
  delete: jest.fn().mockResolvedValue({})
});

/**
 * Create mock Firestore collection reference
 * @param {Array} docs - Array of document data
 * @return {Object} Mock collection reference
 */
const createMockCollectionRef = (docs = []) => ({
  doc: jest.fn((id) => createMockDocRef(docs.find((d) => d.id === id) || {})),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  get: jest.fn().mockResolvedValue({
    empty: docs.length === 0,
    size: docs.length,
    docs: docs.map((data) => ({
      id: data.id || 'mock-doc-id',
      exists: true,
      data: () => data
    }))
  }),
  add: jest.fn((data) => Promise.resolve(createMockDocRef({ id: 'new-doc-id', ...data })))
});

/**
 * Wait for a specified time (useful in tests)
 * @param {number} ms - Milliseconds to wait
 * @return {Promise} Promise that resolves after timeout
 */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
  generateMockToken,
  createMockUser,
  createMockWasher,
  createMockBooking,
  createMockService,
  createMockRequest,
  createMockResponse,
  createMockNext,
  createMockDocRef,
  createMockCollectionRef,
  wait
};
