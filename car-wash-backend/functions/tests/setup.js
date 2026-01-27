/* eslint-disable max-len */
// Global test setup file
require('dotenv').config();

// Mock Firebase Admin
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn(),
    applicationDefault: jest.fn()
  },
  firestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      })),
      where: jest.fn(() => ({
        get: jest.fn()
      })),
      add: jest.fn(),
      get: jest.fn()
    })),
    settings: jest.fn()
  })),
  auth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
    createUser: jest.fn(),
    getUser: jest.fn(),
    getUserByEmail: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    generateEmailVerificationLink: jest.fn()
  })),
  storage: jest.fn(() => ({
    bucket: jest.fn()
  }))
}));

// Mock Firebase Functions
jest.mock('firebase-functions', () => ({
  https: {
    onRequest: jest.fn((handler) => handler)
  },
  config: jest.fn(() => ({
    sentry: {
      dsn: 'https://test@sentry.io/test'
    }
  }))
}));

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.SENTRY_DSN = 'https://test@sentry.io/test';

// Global test timeout
jest.setTimeout(10000);

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Global beforeAll
beforeAll(() => {
  console.log('🧪 Starting test suite...');
});

// Global afterAll
afterAll(() => {
  console.log('✅ Test suite completed');
});
