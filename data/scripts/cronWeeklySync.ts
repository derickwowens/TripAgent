/**
 * Weekly Data Sync CRON Job
 * 
 * This script is designed to run as a Railway CRON job on Sunday evenings.
 * It performs a holistic data update including:
 * 1. Trail data validation and sync
 * 2. Park index refresh
 * 3. Sync report generation
 * 
 * Railway CRON Schedule: 0 2 * * 0 (Sunday at 2:00 AM UTC / Sunday 8:00 PM CST)
 */

import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { config } from 'dotenv';

// Load environment variables
config();

const S3_BUCKET = process.env.PARK_DATA_S3_BUCKET || 'tripagent-park-data';
const S3_REGION = process.env.AWS_REGION || 'us-east-1';
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL; // Optional: for notifications

const s3Client = new S3Client({
  region: S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

interface WeeklySyncReport {
  runId: string;
  startTime: string;
  endTime?: string;
  status: 'running' | 'success' | 'partial_success' | 'failed';
  tasks: {
    name: string;
    status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
    startTime?: string;
    endTime?: string;
    message?: string;
    details?: any;
  }[];
  summary: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    duration?: number;
  };
}

/**
 * Send notification to Slack (if configured)
 */
async function sendSlackNotification(message: string, isError: boolean = false): Promise<void> {
  if (!SLACK_WEBHOOK_URL) return;
  
  try {
    await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `${isError ? ':x:' : ':white_check_mark:'} *TripAgent Weekly Sync*\n${message}`,
      }),
    });
  } catch (error) {
    console.error('Failed to send Slack notification:', error);
  }
}

/**
 * Validate AllTrails URL
 */
async function validateUrl(url: string): Promise<boolean> {
  try {
    await new Promise(resolve => setTimeout(resolve, 300)); // Rate limiting
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'TripAgent/1.0' },
    });
    return response.ok || response.status === 403; // 403 often means the page exists but blocks HEAD
  } catch {
    return false;
  }
}

/**
 * Task: Validate trail data
 */
async function taskValidateTrailData(report: WeeklySyncReport): Promise<void> {
  const taskIndex = report.tasks.findIndex(t => t.name === 'Validate Trail Data');
  const task = report.tasks[taskIndex];
  task.status = 'running';
  task.startTime = new Date().toISOString();
  
  console.log('[Task] Validating trail data...');
  
  try {
    // Fetch trail data from S3
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: 'trails/national-parks-trails.json',
    });
    const response = await s3Client.send(command);
    const body = await response.Body?.transformToString();
    
    if (!body) {
      throw new Error('Trail data not found in S3');
    }
    
    const trailData = JSON.parse(body);
    let validCount = 0;
    let invalidCount = 0;
    const invalidUrls: string[] = [];
    
    for (const [parkCode, parkData] of Object.entries(trailData.parks)) {
      for (const trail of (parkData as any).trails) {
        if (trail.allTrailsUrl) {
          const isValid = await validateUrl(trail.allTrailsUrl);
          if (isValid) {
            validCount++;
            trail.validationStatus = 'valid';
          } else {
            invalidCount++;
            trail.validationStatus = 'invalid';
            invalidUrls.push(`[${parkCode}] ${trail.name}`);
          }
          trail.lastValidated = new Date().toISOString();
        }
      }
    }
    
    // Update metadata
    trailData._meta.lastSyncRun = new Date().toISOString();
    trailData._meta.syncStatus = invalidCount > 0 ? 'issues_found' : 'healthy';
    
    // Upload updated data
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: 'trails/national-parks-trails.json',
      Body: JSON.stringify(trailData, null, 2),
      ContentType: 'application/json',
    }));
    
    task.status = invalidCount > 0 ? 'success' : 'success';
    task.message = `Validated ${validCount + invalidCount} trails: ${validCount} valid, ${invalidCount} invalid`;
    task.details = { validCount, invalidCount, invalidUrls };
    
    console.log(`[Task] Trail validation complete: ${validCount} valid, ${invalidCount} invalid`);
    
  } catch (error: any) {
    task.status = 'failed';
    task.message = error.message;
    console.error('[Task] Trail validation failed:', error.message);
  }
  
  task.endTime = new Date().toISOString();
}

/**
 * Task: Refresh park indices
 */
async function taskRefreshParkIndices(report: WeeklySyncReport): Promise<void> {
  const taskIndex = report.tasks.findIndex(t => t.name === 'Refresh Park Indices');
  const task = report.tasks[taskIndex];
  task.status = 'running';
  task.startTime = new Date().toISOString();
  
  console.log('[Task] Refreshing park indices...');
  
  try {
    // List all park indices
    const listCommand = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: 'national-parks/',
    });
    const listResponse = await s3Client.send(listCommand);
    
    const indexCount = listResponse.Contents?.length || 0;
    
    // Update master index timestamp
    const masterIndexCommand = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: 'index.json',
    });
    
    try {
      const masterResponse = await s3Client.send(masterIndexCommand);
      const masterBody = await masterResponse.Body?.transformToString();
      
      if (masterBody) {
        const masterIndex = JSON.parse(masterBody);
        masterIndex.lastUpdated = new Date().toISOString();
        
        await s3Client.send(new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: 'index.json',
          Body: JSON.stringify(masterIndex, null, 2),
          ContentType: 'application/json',
        }));
      }
    } catch {
      // Master index may not exist, that's okay
    }
    
    task.status = 'success';
    task.message = `Found ${indexCount} park data files`;
    task.details = { parkCount: indexCount };
    
    console.log(`[Task] Park indices refreshed: ${indexCount} files`);
    
  } catch (error: any) {
    task.status = 'failed';
    task.message = error.message;
    console.error('[Task] Park index refresh failed:', error.message);
  }
  
  task.endTime = new Date().toISOString();
}

/**
 * Task: Generate sync report
 */
async function taskGenerateSyncReport(report: WeeklySyncReport): Promise<void> {
  const taskIndex = report.tasks.findIndex(t => t.name === 'Generate Sync Report');
  const task = report.tasks[taskIndex];
  task.status = 'running';
  task.startTime = new Date().toISOString();
  
  console.log('[Task] Generating sync report...');
  
  try {
    // Calculate summary
    report.summary.completedTasks = report.tasks.filter(t => t.status === 'success').length;
    report.summary.failedTasks = report.tasks.filter(t => t.status === 'failed').length;
    
    // Upload report
    const reportKey = `sync-reports/weekly-${report.runId}.json`;
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: reportKey,
      Body: JSON.stringify(report, null, 2),
      ContentType: 'application/json',
    }));
    
    task.status = 'success';
    task.message = `Report saved to ${reportKey}`;
    
    console.log(`[Task] Sync report generated: ${reportKey}`);
    
  } catch (error: any) {
    task.status = 'failed';
    task.message = error.message;
    console.error('[Task] Report generation failed:', error.message);
  }
  
  task.endTime = new Date().toISOString();
}

/**
 * Main weekly sync function
 */
async function runWeeklySync(): Promise<void> {
  const runId = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  
  const report: WeeklySyncReport = {
    runId,
    startTime: new Date().toISOString(),
    status: 'running',
    tasks: [
      { name: 'Validate Trail Data', status: 'pending' },
      { name: 'Refresh Park Indices', status: 'pending' },
      { name: 'Generate Sync Report', status: 'pending' },
    ],
    summary: {
      totalTasks: 3,
      completedTasks: 0,
      failedTasks: 0,
    },
  };
  
  console.log('='.repeat(60));
  console.log('TripAgent Weekly Data Sync');
  console.log('='.repeat(60));
  console.log(`Run ID: ${runId}`);
  console.log(`Start Time: ${report.startTime}`);
  console.log(`S3 Bucket: ${S3_BUCKET}`);
  console.log('');
  
  await sendSlackNotification(`Weekly sync started (Run ID: ${runId})`);
  
  try {
    // Run tasks
    await taskValidateTrailData(report);
    await taskRefreshParkIndices(report);
    await taskGenerateSyncReport(report);
    
    // Finalize report
    report.endTime = new Date().toISOString();
    report.summary.completedTasks = report.tasks.filter(t => t.status === 'success').length;
    report.summary.failedTasks = report.tasks.filter(t => t.status === 'failed').length;
    report.summary.duration = new Date(report.endTime).getTime() - new Date(report.startTime).getTime();
    
    if (report.summary.failedTasks === 0) {
      report.status = 'success';
    } else if (report.summary.completedTasks > 0) {
      report.status = 'partial_success';
    } else {
      report.status = 'failed';
    }
    
    // Final report upload
    const finalReportKey = `sync-reports/weekly-${runId}.json`;
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: finalReportKey,
      Body: JSON.stringify(report, null, 2),
      ContentType: 'application/json',
    }));
    
    console.log('');
    console.log('='.repeat(60));
    console.log('Weekly Sync Complete');
    console.log('='.repeat(60));
    console.log(`Status: ${report.status.toUpperCase()}`);
    console.log(`Duration: ${Math.round((report.summary.duration || 0) / 1000)}s`);
    console.log(`Tasks: ${report.summary.completedTasks}/${report.summary.totalTasks} completed`);
    console.log(`Report: s3://${S3_BUCKET}/${finalReportKey}`);
    
    const summaryMessage = `Status: ${report.status}\nDuration: ${Math.round((report.summary.duration || 0) / 1000)}s\nTasks: ${report.summary.completedTasks}/${report.summary.totalTasks} completed`;
    await sendSlackNotification(summaryMessage, report.status === 'failed');
    
    if (report.status === 'failed') {
      process.exit(1);
    }
    
  } catch (error: any) {
    report.status = 'failed';
    report.endTime = new Date().toISOString();
    console.error('Weekly sync failed:', error.message);
    await sendSlackNotification(`Weekly sync FAILED: ${error.message}`, true);
    process.exit(1);
  }
}

// Run the sync
runWeeklySync();
