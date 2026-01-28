module.exports = {
    env: {
        es6: true,
        node: true,
        jest: true
    },
    parserOptions: {
        ecmaVersion: 2020
    },
    extends: [
        'eslint:recommended',
        'google'
    ],
    rules: {
        'no-restricted-globals': ['error', 'name', 'length'],
        'prefer-arrow-callback': 'error',
        'quotes': ['error', 'single'],
        'max-len': ['error', { code: 100 }],
        'object-curly-spacing': ['error', 'always'],
        'comma-dangle': ['error', 'never'],
        'indent': ['error', 2],
        'require-jsdoc': 'off',
        'valid-jsdoc': 'off'
    },
    overrides: [
        {
            files: ['**/*.spec.*'],
            env: {
                mocha: true
            },
            rules: {}
        }
    ],
    globals: {}
};
