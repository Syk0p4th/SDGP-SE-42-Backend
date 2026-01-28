# Car Wash Backend Functions

Firebase Cloud Functions backend for the Car Wash application.

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Setup environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Run tests**:
   ```bash
   npm test
   ```

4. **Start local emulator**:
   ```bash
   cd .. && firebase emulators:start
   ```

5. **Deploy to Firebase**:
   ```bash
   cd .. && ./scripts/deploy.sh
   ```

## NPM Scripts

- `npm test` - Run all tests with coverage
- `npm run test:unit` - Run unit tests only
- `npm run test:integration` - Run integration tests only
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix linting errors automatically
- `npm run serve` - Start Firebase emulator
- `npm run deploy` - Deploy to Firebase

## Project Structure

```
functions/
├── src/
│   ├── config/           # Configuration files
│   │   ├── firebase.js   # Firebase Admin setup
│   │   ├── logger.js     # Winston logger config
│   │   ├── sentry.js     # Sentry error tracking
│   │   └── swagger.js    # Swagger/OpenAPI config
│   ├── controllers/      # Route controllers
│   ├── middleware/       # Express middleware
│   ├── models/          # Data models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   ├── docs/            # API documentation (YAML)
│   └── index.js         # Main entry point
├── tests/
│   ├── unit/            # Unit tests
│   ├── integration/     # Integration tests
│   ├── helpers/         # Test utilities
│   └── setup.js         # Test configuration
├── .env                 # Environment variables
├── package.json         # Dependencies
└── jest.config.js       # Jest configuration
```

## Documentation

- **API Documentation**: Available at `/api-docs` when running
- **Deployment Guide**: See `../DEPLOYMENT.md`
- **Testing Guide**: See tests README (coming soon)

## Features

✅ **Testing**: Jest + Supertest for comprehensive testing
✅ **Logging**: Winston with multiple transports and log rotation
✅ **Error Tracking**: Sentry integration for production monitoring
✅ **API Documentation**: Swagger/OpenAPI with interactive UI
✅ **Security**: Helmet, CORS, input validation
✅ **CI/CD**: GitHub Actions for automated testing and deployment

## Environment Variables

See `.env` for all available configuration options.

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests: `npm test`
4. Run linter: `npm run lint:fix`
5. Create a pull request

## License

MIT
