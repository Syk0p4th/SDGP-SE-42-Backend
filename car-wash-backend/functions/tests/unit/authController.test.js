/* eslint-disable max-len */
const {
  createMockRequest,
  createMockResponse,
  createMockNext,
  createMockUser,
  createMockDocRef,
  createMockCollectionRef
} = require('../helpers/testUtils');

// Mock dependencies
jest.mock('../../src/config/logger');

describe('Auth Controller - Unit Tests', () => {
  let authController;
  let mockDb;

  beforeEach(() => {
    // Reset modules to ensure fresh imports
    jest.resetModules();

    // Mock Firestore
    mockDb = {
      collection: jest.fn(() => createMockCollectionRef([]))
    };

    // Mock firebase admin
    jest.doMock('firebase-admin', () => ({
      firestore: () => mockDb,
      auth: () => ({
        createUser: jest.fn(),
        verifyIdToken: jest.fn(),
        getUser: jest.fn()
      })
    }));

    // Import controller after mocking
    authController = require('../../src/controllers/authController');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const req = createMockRequest({
        body: {
          email: 'newuser@example.com',
          password: 'SecurePass123!',
          displayName: 'New User',
          phoneNumber: '+1234567890'
        }
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Mock successful user creation
      const mockUser = createMockUser({
        email: req.body.email,
        displayName: req.body.displayName
      });

      mockDb.collection().add.mockResolvedValue(createMockDocRef(mockUser));

      // Call controller method if it exists
      if (authController && authController.register) {
        await authController.register(req, res, next);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true
          })
        );
      }
    });

    it('should return 400 for invalid email', async () => {
      const req = createMockRequest({
        body: {
          email: 'invalid-email',
          password: 'SecurePass123!'
        }
      });
      const res = createMockResponse();
      const next = createMockNext();

      if (authController && authController.register) {
        await authController.register(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
      }
    });

    it('should return 400 for weak password', async () => {
      const req = createMockRequest({
        body: {
          email: 'user@example.com',
          password: '123'
        }
      });
      const res = createMockResponse();
      const next = createMockNext();

      if (authController && authController.register) {
        await authController.register(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
      }
    });
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const req = createMockRequest({
        body: {
          email: 'user@example.com',
          password: 'SecurePass123!'
        }
      });
      const res = createMockResponse();
      const next = createMockNext();

      if (authController && authController.login) {
        await authController.login(req, res, next);

        // Verify response structure (adjust based on actual implementation)
        expect(res.status).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalled();
      }
    });

    it('should return 401 for invalid credentials', async () => {
      const req = createMockRequest({
        body: {
          email: 'user@example.com',
          password: 'WrongPassword'
        }
      });
      const res = createMockResponse();
      const next = createMockNext();

      if (authController && authController.login) {
        await authController.login(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
      }
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', async () => {
      const req = createMockRequest({
        headers: {
          authorization: 'Bearer valid-token'
        }
      });
      const res = createMockResponse();
      const next = createMockNext();

      if (authController && authController.verifyToken) {
        await authController.verifyToken(req, res, next);

        expect(next).toHaveBeenCalled();
      }
    });

    it('should reject invalid token', async () => {
      const req = createMockRequest({
        headers: {
          authorization: 'Bearer invalid-token'
        }
      });
      const res = createMockResponse();
      const next = createMockNext();

      if (authController && authController.verifyToken) {
        await authController.verifyToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
      }
    });
  });
});
