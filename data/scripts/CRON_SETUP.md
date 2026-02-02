# Weekly Data Sync CRON Setup

This document describes how to set up the weekly data sync CRON job on Railway.

## Overview

The weekly sync runs every Sunday at 2:00 AM UTC (8:00 PM CST Saturday) and performs:
1. Trail data validation (checks AllTrails URLs are still working)
2. Park indices refresh
3. Sync report generation

## Railway Setup

### Option 1: Railway Cron Service (Recommended)

1. **Create a new Railway service** for the CRON job:
   - Go to your Railway project
   - Click "New Service" > "Empty Service"
   - Name it `tripagent-weekly-sync`

2. **Configure the service**:
   - Set the **Start Command**: `npx tsx data/scripts/cronWeeklySync.ts`
   - Set **Root Directory**: `/` (or wherever your repo root is)

3. **Add Environment Variables**:
   ```
   AWS_ACCESS_KEY_ID=<your-aws-key>
   AWS_SECRET_ACCESS_KEY=<your-aws-secret>
   AWS_REGION=us-east-1
   PARK_DATA_S3_BUCKET=tripagent-park-data
   SLACK_WEBHOOK_URL=<optional-slack-webhook>
   ```

4. **Configure CRON Schedule**:
   - In Railway service settings, go to "Cron"
   - Set schedule: `0 2 * * 0` (Sunday 2:00 AM UTC)

### Option 2: GitHub Actions

Create `.github/workflows/weekly-sync.yml`:

```yaml
name: Weekly Data Sync

on:
  schedule:
    # Every Sunday at 2:00 AM UTC (8:00 PM CST Saturday)
    - cron: '0 2 * * 0'
  workflow_dispatch: # Allow manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run weekly sync
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_REGION: us-east-1
          PARK_DATA_S3_BUCKET: tripagent-park-data
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
        run: npm run sync:weekly
```

## NPM Scripts

```bash
# Run manual trail sync (validates URLs)
npm run trails:sync

# Run dry-run (no S3 uploads)
npm run trails:sync -- --dry-run

# Skip URL validation (just update timestamps)
npm run trails:sync -- --no-validate

# Run full weekly sync (all tasks)
npm run sync:weekly
```

## Sync Reports

Sync reports are saved to S3 at:
- `s3://tripagent-park-data/sync-reports/weekly-{timestamp}.json`
- `s3://tripagent-park-data/trails/sync-reports/sync-{timestamp}.json`

## Slack Notifications (Optional)

To receive Slack notifications:

1. Create a Slack Incoming Webhook:
   - Go to https://api.slack.com/apps
   - Create a new app or use existing
   - Add "Incoming Webhooks" feature
   - Create a webhook for your channel

2. Add the webhook URL to Railway environment:
   ```
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
   ```

## Monitoring

Check sync status:
1. View Railway logs for the sync service
2. Check S3 for sync reports: `aws s3 ls s3://tripagent-park-data/sync-reports/`
3. Check Slack channel for notifications

## Manual Trigger

To run the sync manually:
```bash
# From local machine (with .env configured)
npm run sync:weekly

# Or just trail validation
npm run trails:sync
```

## Troubleshooting

### AllTrails Rate Limiting
The sync includes 300-500ms delays between URL checks to avoid rate limiting.
If you see many failures, AllTrails may be blocking requests temporarily.

### S3 Access Issues
Verify AWS credentials are correct and have permissions for:
- `s3:GetObject`
- `s3:PutObject`
- `s3:ListObjectsV2`

### Timeout Issues
The full sync can take 5-10 minutes depending on the number of trails.
Ensure Railway service has adequate timeout settings.
