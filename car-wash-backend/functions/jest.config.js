module.exports = {
    // Test environment
    testEnvironment: 'node',

    // Setup files
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

    // Coverage configuration
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/index.js',
        '!**/node_modules/**',
        '!**/tests/**'
    ],

    coverageThreshold: {
        global: {
            branches: 0,
            functions: 0,
            lines: 0,
            statements: 0
        }
    },

    coverageReporters: ['text', 'lcov', 'html'],

    // Test match patterns
    testMatch: [
        '**/tests/**/*.test.js'
    ],

    // Module paths
    moduleDirectories: ['node_modules', 'src'],

    // Verbose output
    verbose: true,

    // Test timeout
    testTimeout: 10000,

    // Clear mocks between tests
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true
};
