# Washer Backend - Deployment Guide

This guide explains how to deploy the Washer Backend Firebase Functions to production and staging environments.

## Prerequisites

1. **Firebase CLI** installed globally
   ```bash
   npm install -g firebase-tools
   ```

2. **Firebase Project** set up
   - Create a Firebase project at https://console.firebase.google.com
   - Note your project ID

3. **Firebase Authentication** configured
   ```bash
   firebase login
   ```

4. **Environment Variables** configured (see Environment Setup section)

## Environment Setup

### Local Development

1. Copy the `.env.example` to `.env` in the `functions` directory:
   ```bash
   cp functions/.env.example functions/.env
   ```

2. Update the `.env` file with your actual values:
   - `SENTRY_DSN`: Your Sentry DSN for error tracking
   - `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins
   - `JWT_SECRET`: Your JWT secret key (if using custom JWT)

### Firebase Functions Environment

Set Firebase Functions config using the setup script:

```bash
cd washer-backend
./scripts/setup-env.sh
```

Or manually:

```bash
firebase functions:config:set sentry.dsn="YOUR_SENTRY_DSN"
firebase functions:config:set app.environment="production"
```

View current config:
```bash
firebase functions:config:get
```

## Deployment Methods

### Method 1: Manual Deployment (Recommended for First Time)

1. Navigate to the project directory:
   ```bash
   cd washer-backend
   ```

2. Install dependencies:
   ```bash
   cd functions && npm install && cd ..
   ```

3. Run tests:
   ```bash
   cd functions && npm test && cd ..
   ```

4. Deploy to Firebase:
   ```bash
   firebase deploy --only functions
   ```

### Method 2: Using Deployment Script

The deployment script includes pre-deployment validation:

```bash
cd washer-backend
./scripts/deploy.sh
```

The script will:
- ✓ Install dependencies
- ✓ Run linter
- ✓ Run tests
- ✓ Deploy to Firebase
- ✓ List deployed functions

### Method 3: CI/CD with GitHub Actions

Push to the `main` branch to trigger automatic deployment:

```bash
git push origin main
```

The GitHub Actions workflow will:
1. Run tests
2. Run linter
3. Deploy to Firebase (if tests pass)
4. Notify deployment status

#### GitHub Secrets Required

Add these secrets to your GitHub repository settings:

- `FIREBASE_TOKEN`: Firebase CI token (get with `firebase login:ci`)
- `FIREBASE_PROJECT_ID`: Your Firebase project ID
- `SENTRY_DSN`: Your Sentry DSN

## Testing Deployment

### Local Testing with Emulator

1. Start Firebase emulators:
   ```bash
   cd washer-backend
   firebase emulators:start
   ```

2. Access the API:
   - API: http://localhost:5001/[PROJECT-ID]/us-central1/api
   - Emulator UI: http://localhost:4000
   - API Docs: http://localhost:5001/[PROJECT-ID]/us-central1/api/api-docs

### Production Testing

After deployment, test your endpoints:

```bash
# Health check
curl https://us-central1-[PROJECT-ID].cloudfunctions.net/api/health

# API Documentation
https://us-central1-[PROJECT-ID].cloudfunctions.net/api/api-docs
```

## Post-Deployment

### Verify Deployment

```bash
firebase functions:list
```

### View Logs

```bash
# Real-time logs
firebase functions:log

# Recent logs
firebase functions:log --only api
```

### Monitor Performance

1. **Firebase Console**: https://console.firebase.google.com
   - Navigate to Functions → Usage
   - Monitor invocations, errors, and execution time

2. **Sentry**: Check your Sentry dashboard for errors
   - https://sentry.io

3. **Cloud Logging**: View detailed logs in Google Cloud Console

## Rollback

If you need to rollback a deployment:

```bash
cd washer-backend
./scripts/rollback.sh
```

Or manually:
1. Find the commit to rollback to: `git log --oneline`
2. Checkout that commit: `git checkout <commit-hash>`
3. Deploy: `./scripts/deploy.sh`
4. Return to main: `git checkout main`

## Environment-Specific Deployments

### Staging Environment

1. Create a staging Firebase project
2. Add staging configuration:
   ```bash
   firebase use --add
   ```
3. Select staging project when deploying:
   ```bash
   firebase use staging
   firebase deploy --only functions
   ```

### Production Environment

```bash
firebase use production
firebase deploy --only functions
```

## Troubleshooting

### Common Issues

**Issue**: "Functions deployment failed"
- **Solution**: Check logs with `firebase functions:log`
- Verify all dependencies are installed
- Ensure environment variables are configured

**Issue**: "Permission denied"
- **Solution**: Run `firebase login` to re-authenticate
- Verify you have deployment permissions for the project

**Issue**: "Tests failing"
- **Solution**: Run `npm test` locally to identify failures
- Fix failing tests before deploying

**Issue**: "CORS errors"
- **Solution**: Update `ALLOWED_ORIGINS` in functions config
- Redeploy functions after updating config

### Getting Help

- Firebase Documentation: https://firebase.google.com/docs/functions
- GitHub Issues: Open an issue in the repository
- Firebase Support: https://firebase.google.com/support

## Best Practices

1. **Always test locally** before deploying to production
2. **Run tests** as part of the deployment process
3. **Use environment variables** for sensitive data
4. **Monitor logs** after deployment
5. **Set up alerts** in Sentry for critical errors
6. **Use staging environment** for testing changes
7. **Document changes** in commit messages
8. **Review code** before merging to main branch

## Cost Optimization

- Use Firebase Functions pricing calculator
- Monitor function invocations and execution time
- Set up billing alerts in Google Cloud Console
- Optimize cold start times by keeping functions warm
- Use appropriate memory allocation for functions

## Security

- Never commit `.env` files or credentials
- Use Firebase Functions config for secrets
- Implement rate limiting for public endpoints
- Validate all user inputs
- Keep dependencies updated
- Review security rules regularly

---

For more information, see:
- [Firebase Functions Documentation](https://firebase.google.com/docs/functions)
- [API Documentation](https://your-api-url/api-docs)
- [Project README](../README.md)
