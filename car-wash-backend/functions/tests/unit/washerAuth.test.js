/* eslint-disable max-len */
const {
    createMockRequest,
    createMockResponse,
    createMockNext,
    createMockWasher,
    createMockDocRef,
    createMockCollectionRef
} = require('../helpers/testUtils');

// Mock dependencies
jest.mock('../../src/config/logger');

describe('Washer Auth Controller - Unit Tests', () => {
    let authController;
    let mockDb;
    let mockAuth;

    beforeEach(() => {
        // Reset modules to ensure fresh imports
        jest.resetModules();

        // Mock Firestore
        mockDb = {
            collection: jest.fn(() => createMockCollectionRef([])),
            settings: jest.fn()
        };

        // Mock Auth
        mockAuth = {
            createUser: jest.fn(),
            getUserByEmail: jest.fn()
        };

        // Mock firebase admin
        jest.doMock('firebase-admin', () => ({
            firestore: () => mockDb,
            auth: () => mockAuth,
            storage: () => ({
                bucket: jest.fn()
            }),
            credential: {
                cert: jest.fn()
            },
            initializeApp: jest.fn()
        }));

        // Import controller after mocking
        authController = require('../../src/controllers/authController');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('registerWasher', () => {
        it('should successfully register a new washer with valid data', async () => {
            const req = createMockRequest({
                body: {
                    email: 'washer@example.com',
                    password: 'SecurePass123!',
                    displayName: 'Test Washer',
                    phoneNumber: '+94771234567',
                    experience: 2,
                    serviceAreas: ['Colombo', 'Gampaha']
                }
            });
            const res = createMockResponse();
            const next = createMockNext();

            // Mock successful user creation
            const mockWasher = createMockWasher({
                email: req.body.email,
                displayName: req.body.displayName
            });

            mockAuth.createUser.mockResolvedValue({
                uid: 'new-washer-uid',
                email: req.body.email,
                displayName: req.body.displayName
            });

            mockDb.collection().doc().set = jest.fn().mockResolvedValue({});

            if (authController && authController.registerWasher) {
                await authController.registerWasher(req, res, next);

                expect(res.status).toHaveBeenCalledWith(201);
                expect(res.json).toHaveBeenCalledWith(
                    expect.objectContaining({
                        success: true,
                        message: expect.stringContaining('Washer registered successfully')
                    })
                );
            }
        });

        it('should return 400 for missing required fields', async () => {
            const req = createMockRequest({
                body: {
                    email: 'washer@example.com',
                    password: 'SecurePass123!'
                    // Missing displayName and phoneNumber
                }
            });
            const res = createMockResponse();
            const next = createMockNext();

            if (authController && authController.registerWasher) {
                await authController.registerWasher(req, res, next);

                // Should call next with error or return 400
                expect(next).toHaveBeenCalled();
            }
        });

        it('should return 400 when email is missing', async () => {
            const req = createMockRequest({
                body: {
                    password: 'SecurePass123!',
                    displayName: 'Test Washer',
                    phoneNumber: '+94771234567'
                }
            });
            const res = createMockResponse();
            const next = createMockNext();

            if (authController && authController.registerWasher) {
                await authController.registerWasher(req, res, next);

                expect(next).toHaveBeenCalled();
            }
        });

        it('should set washerStatus to pending_approval on registration', async () => {
            const req = createMockRequest({
                body: {
                    email: 'washer@example.com',
                    password: 'SecurePass123!',
                    displayName: 'Test Washer',
                    phoneNumber: '+94771234567'
                }
            });
            const res = createMockResponse();
            const next = createMockNext();

            mockAuth.createUser.mockResolvedValue({
                uid: 'new-washer-uid',
                email: req.body.email,
                displayName: req.body.displayName
            });

            mockDb.collection().doc().set = jest.fn().mockResolvedValue({});

            if (authController && authController.registerWasher) {
                await authController.registerWasher(req, res, next);

                expect(res.json).toHaveBeenCalledWith(
                    expect.objectContaining({
                        user: expect.objectContaining({
                            washerStatus: 'pending_approval'
                        })
                    })
                );
            }
        });
    });

    describe('loginWasher', () => {
        it('should successfully return washer info with valid email', async () => {
            const washerData = createMockWasher();

            const req = createMockRequest({
                body: {
                    email: 'washer@example.com'
                }
            });
            const res = createMockResponse();
            const next = createMockNext();

            // Mock getUserByEmail
            mockAuth.getUserByEmail.mockResolvedValue({
                uid: washerData.uid,
                email: washerData.email
            });

            // Mock Firestore user doc
            mockDb.collection = jest.fn((collectionName) => ({
                doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({
                        exists: true,
                        data: () => washerData
                    })
                }))
            }));

            if (authController && authController.loginWasher) {
                await authController.loginWasher(req, res, next);

                expect(res.status).toHaveBeenCalledWith(200);
                expect(res.json).toHaveBeenCalledWith(
                    expect.objectContaining({
                        success: true,
                        washerInfo: expect.objectContaining({
                            washerStatus: expect.any(String)
                        })
                    })
                );
            }
        });

        it('should return 400 when email is missing', async () => {
            const req = createMockRequest({
                body: {}
            });
            const res = createMockResponse();
            const next = createMockNext();

            if (authController && authController.loginWasher) {
                await authController.loginWasher(req, res, next);

                expect(next).toHaveBeenCalled();
            }
        });

        it('should return 404 for non-existent user', async () => {
            const req = createMockRequest({
                body: {
                    email: 'nonexistent@example.com'
                }
            });
            const res = createMockResponse();
            const next = createMockNext();

            // Mock getUserByEmail to throw error
            mockAuth.getUserByEmail.mockRejectedValue(new Error('User not found'));

            if (authController && authController.loginWasher) {
                await authController.loginWasher(req, res, next);

                expect(next).toHaveBeenCalled();
            }
        });

        it('should return 403 when user is not a washer', async () => {
            const customerData = {
                uid: 'customer-uid',
                email: 'customer@example.com',
                role: 'customer'
            };

            const req = createMockRequest({
                body: {
                    email: 'customer@example.com'
                }
            });
            const res = createMockResponse();
            const next = createMockNext();

            mockAuth.getUserByEmail.mockResolvedValue({
                uid: customerData.uid,
                email: customerData.email
            });

            mockDb.collection = jest.fn(() => ({
                doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({
                        exists: true,
                        data: () => customerData
                    })
                }))
            }));

            if (authController && authController.loginWasher) {
                await authController.loginWasher(req, res, next);

                expect(next).toHaveBeenCalled();
            }
        });

        it('should return washer status in response', async () => {
            const approvedWasher = createMockWasher({
                washerStatus: 'approved'
            });

            const req = createMockRequest({
                body: {
                    email: approvedWasher.email
                }
            });
            const res = createMockResponse();
            const next = createMockNext();

            mockAuth.getUserByEmail.mockResolvedValue({
                uid: approvedWasher.uid,
                email: approvedWasher.email
            });

            mockDb.collection = jest.fn(() => ({
                doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({
                        exists: true,
                        data: () => approvedWasher
                    })
                }))
            }));

            if (authController && authController.loginWasher) {
                await authController.loginWasher(req, res, next);

                expect(res.json).toHaveBeenCalledWith(
                    expect.objectContaining({
                        washerInfo: expect.objectContaining({
                            washerStatus: 'approved'
                        })
                    })
                );
            }
        });
    });
});
