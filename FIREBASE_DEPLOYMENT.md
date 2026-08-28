# Firebase Deployment Guide

## Prerequisites
1. Firebase CLI installed: `npm install -g firebase-tools`
2. Logged in to Firebase: `firebase login`
3. Firebase project created: `cpq-116e7`

## Setup Steps

### 1. Install Cloud Functions Dependencies
```bash
cd functions
npm install
cd ..
```

### 2. Deploy to Firebase
```bash
firebase deploy
```

This will:
- Deploy the Express API to Cloud Functions
- Host your static frontend files (public directory)
- Set up routing so `/api/**` calls go to the Cloud Function

### 3. Get Your Deployment URL
After deployment completes, you'll see:
```
✔ functions[api]: https://us-central1-cpq-116e7.cloudfunctions.net/api
✔ hosting[cpq-116e7]: https://cpq-116e7.web.app
```

The public app will be at: **https://cpq-116e7.web.app**

## Environment Variables

If you need environment variables in Cloud Functions:
1. Create a `.env.production` file
2. Add variables (e.g., `NODE_ENV=production`)
3. Firebase will inject them automatically

## Monitoring & Logs

View function logs:
```bash
firebase functions:log
```

## Rollback

To redeploy a previous version:
```bash
firebase deploy --only functions
```

## Troubleshooting

**Issue: "Error: Insufficient permissions"**
- Run: `firebase login` and ensure you're logged in to the correct Google account

**Issue: "Functions deployment failed"**
- Check that all dependencies in `functions/package.json` are correct
- Run `npm install` in the functions directory locally to verify

**Issue: API calls 404**
- Ensure firebase.json has correct rewrites configuration
- Check that routes are properly imported in functions/index.js
