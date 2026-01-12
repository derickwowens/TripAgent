# TripAgent - Production Deployment Guide

## Overview

This guide covers deploying the TripAgent API server and building the mobile app for the Google Play Store.

---

## Part 1: Deploy API Server

### Option A: Railway (Recommended)

1. **Create Railway Account**
   - Go to https://railway.app
   - Sign up with GitHub

2. **Deploy from GitHub**
   ```bash
   # Push your code to GitHub first
   git add .
   git commit -m "Prepare for production deployment"
   git push origin main
   ```

3. **Connect Repository**
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your `TripAgent` repository
   - Railway will auto-detect the Dockerfile

4. **Set Environment Variables**
   In Railway dashboard → Variables:
   ```
   ANTHROPIC_API_KEY=sk-ant-api03-xxx
   AMADEUS_API_KEY=your-amadeus-key
   AMADEUS_API_SECRET=your-amadeus-secret
   NODE_ENV=production
   ```

5. **Get Your API URL**
   - Railway provides a URL like: `https://tripagent-production.up.railway.app`
   - Copy this URL for the mobile app configuration

### Option B: Render

1. **Create Render Account**
   - Go to https://render.com
   - Sign up with GitHub

2. **New Web Service**
   - Click "New" → "Web Service"
   - Connect your GitHub repo
   - Render will use `render.yaml` automatically

3. **Set Environment Variables**
   Same as Railway above.

---

## Part 2: Configure Mobile App for Production

### Step 1: Update Production API URL

Edit `mobile/.env.production`:
```bash
EXPO_PUBLIC_API_URL=https://your-api.railway.app
```

### Step 2: Update EAS Configuration

Edit `mobile/eas.json` production env:
```json
"production": {
  "android": {
    "buildType": "app-bundle"
  },
  "env": {
    "APP_ENV": "production",
    "EXPO_PUBLIC_API_URL": "https://your-api.railway.app"
  }
}
```

---

## Part 3: Build for Play Store

### Step 1: Login to EAS

```bash
cd mobile
eas login
```

### Step 2: Configure Project (First Time Only)

```bash
eas build:configure
```

This links your project to Expo's build service.

### Step 3: Build Production AAB

```bash
eas build --platform android --profile production
```

- Build takes ~10-15 minutes
- You'll get a download link for the `.aab` file

### Step 4: Download AAB

- Click the link in terminal or visit https://expo.dev
- Download the `.aab` file

---

## Part 4: Upload to Play Store

### Step 1: Create App in Play Console

1. Go to https://play.google.com/console
2. Click "Create app"
3. Fill in:
   - App name: TripAgent
   - Default language: English
   - App type: App
   - Free or paid: Free
   - Category: Travel & Local

### Step 2: Complete Store Listing

Use content from `mobile/STORE_LISTING.md`:
- Short description (80 chars)
- Full description (4000 chars)
- Screenshots (phone required)
- Feature graphic (1024x500)
- App icon (512x512)

### Step 3: Set Up Content Rating

1. Go to "Content rating"
2. Complete the questionnaire
3. For TripAgent, select:
   - No violence
   - No mature content
   - Location data used

### Step 4: Upload AAB

1. Go to "Production" → "Create new release"
2. Upload the `.aab` file
3. Add release notes:
   ```
   Initial release of TripAgent!
   
   Features:
   - AI-powered National Park trip planning
   - Real-time flight pricing with 3-5 airport options
   - Hiking trail recommendations
   - Complete budget breakdowns
   - Conversation history
   - Multiple AI model options
   ```

### Step 5: Submit for Review

1. Complete all required sections (checkmarks)
2. Click "Review release"
3. Click "Start rollout to Production"

---

## Checklist

### Before Deployment
- [ ] API server deployed and accessible
- [ ] Environment variables set in production
- [ ] Mobile app configured with production API URL
- [ ] App icons created (1024x1024, adaptive)
- [ ] Screenshots taken (at least 2)
- [ ] Privacy policy URL created

### Play Store Submission
- [ ] Store listing complete
- [ ] Content rating complete
- [ ] AAB uploaded
- [ ] Release notes added
- [ ] App review submitted

---

## Troubleshooting

### API Connection Issues
```bash
# Test your production API
curl https://your-api.railway.app/health
```

### Build Failures
```bash
# Check EAS build logs
eas build:list
eas build:view [BUILD_ID]
```

### App Crashes
- Check Play Console for crash reports
- Review Expo error logs
- Verify API URL is correct in production build

---

## Updating the App

### Version Bump
1. Update `mobile/app.config.js`:
   - `version`: "1.0.1" (for Play Store)
   - Increment `android.versionCode`: 2

2. Rebuild:
   ```bash
   eas build --platform android --profile production
   ```

3. Upload new AAB to Play Console

---

## Cost Estimates

| Service | Cost |
|---------|------|
| Railway | Free tier available, ~$5/mo for always-on |
| Render | Free tier available (spins down after 15min) |
| Google Play | $25 one-time fee |
| Anthropic API | Pay per use (~$0.003-0.015 per message) |
| Amadeus API | Free tier: 2000 calls/month |

