/**
 * Trail Data Sync Script
 * 
 * This script validates and updates trail data in S3. It can:
 * 1. Validate existing AllTrails URLs are still working
 * 2. Update trail metadata from AllTrails (if accessible)
 * 3. Report broken links for manual review
 * 
 * Designed to run as a CRON job on Railway (Sunday evenings)
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const S3_BUCKET = process.env.PARK_DATA_S3_BUCKET || 'tripagent-park-data';
const S3_REGION = process.env.AWS_REGION || 'us-east-1';

const s3Client = new S3Client({
  region: S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

interface TrailInfo {
  id: string;
  name: string;
  lengthMiles: number;
  elevationGainFeet?: number;
  difficulty: string;
  trailType: string;
  estimatedTimeMinutes?: number;
  description?: string;
  highlights?: string[];
  allTrailsUrl: string;
  allTrailsId?: string;
  permitRequired?: boolean;
  lastValidated?: string;
  validationStatus?: 'valid' | 'invalid' | 'unknown';
}

interface TrailsIndex {
  _meta: {
    description: string;
    lastUpdated: string;
    source: string;
    lastSyncRun?: string;
    syncStatus?: string;
  };
  parks: Record<string, {
    parkName: string;
    trails: TrailInfo[];
  }>;
}

interface SyncReport {
  timestamp: string;
  totalTrails: number;
  validatedTrails: number;
  invalidTrails: number;
  skippedTrails: number;
  errors: string[];
  invalidUrls: Array<{ parkCode: string; trailId: string; trailName: string; url: string; reason: string }>;
}

/**
 * Validate an AllTrails URL by checking if it responds with 200
 */
async function validateAllTrailsUrl(url: string): Promise<{ valid: boolean; reason?: string }> {
  try {
    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'TripAgent/1.0 (Trail Data Validator)',
      },
    });
    
    if (response.ok) {
      return { valid: true };
    } else if (response.status === 404) {
      return { valid: false, reason: 'Trail page not found (404)' };
    } else if (response.status === 403) {
      // AllTrails may block HEAD requests, try GET
      const getResponse = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'TripAgent/1.0 (Trail Data Validator)',
        },
      });
      if (getResponse.ok) {
        return { valid: true };
      }
      return { valid: false, reason: `Access forbidden (${response.status})` };
    } else {
      return { valid: false, reason: `HTTP ${response.status}` };
    }
  } catch (error: any) {
    return { valid: false, reason: `Network error: ${error.message}` };
  }
}

/**
 * Fetch current trail data from S3
 */
async function fetchTrailDataFromS3(): Promise<TrailsIndex | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: 'trails/national-parks-trails.json',
    });
    const response = await s3Client.send(command);
    const body = await response.Body?.transformToString();
    if (!body) return null;
    return JSON.parse(body);
  } catch (error: any) {
    console.error(`Failed to fetch from S3: ${error.message}`);
    return null;
  }
}

/**
 * Upload updated trail data to S3
 */
async function uploadTrailDataToS3(data: TrailsIndex): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: 'trails/national-parks-trails.json',
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json',
    CacheControl: 'max-age=3600',
  });
  await s3Client.send(command);
}

/**
 * Upload sync report to S3
 */
async function uploadSyncReportToS3(report: SyncReport): Promise<void> {
  const reportKey = `trails/sync-reports/sync-${report.timestamp.replace(/[:.]/g, '-')}.json`;
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: reportKey,
    Body: JSON.stringify(report, null, 2),
    ContentType: 'application/json',
  });
  await s3Client.send(command);
  console.log(`Sync report uploaded to: s3://${S3_BUCKET}/${reportKey}`);
}

/**
 * Main sync function
 */
async function syncTrailData(options: { 
  validateUrls?: boolean; 
  dryRun?: boolean;
  verbose?: boolean;
} = {}): Promise<SyncReport> {
  const { validateUrls = true, dryRun = false, verbose = true } = options;
  
  const report: SyncReport = {
    timestamp: new Date().toISOString(),
    totalTrails: 0,
    validatedTrails: 0,
    invalidTrails: 0,
    skippedTrails: 0,
    errors: [],
    invalidUrls: [],
  };
  
  console.log('='.repeat(60));
  console.log('Trail Data Sync');
  console.log('='.repeat(60));
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`URL Validation: ${validateUrls ? 'ENABLED' : 'DISABLED'}`);
  console.log('');
  
  // Fetch current data from S3
  console.log('Fetching trail data from S3...');
  let trailData = await fetchTrailDataFromS3();
  
  if (!trailData) {
    // Fall back to local file
    console.log('S3 fetch failed, loading from local file...');
    const localPath = join(__dirname, '../sources/trails/national-parks-trails.json');
    try {
      const content = await readFile(localPath, 'utf-8');
      trailData = JSON.parse(content);
    } catch (error: any) {
      report.errors.push(`Failed to load trail data: ${error.message}`);
      console.error('[ERROR]', report.errors[0]);
      return report;
    }
  }
  
  if (!trailData) {
    report.errors.push('No trail data available');
    return report;
  }
  
  // Count total trails
  for (const parkData of Object.values(trailData.parks)) {
    report.totalTrails += parkData.trails.length;
  }
  console.log(`Found ${report.totalTrails} trails across ${Object.keys(trailData.parks).length} parks`);
  console.log('');
  
  // Validate each trail
  if (validateUrls) {
    console.log('Validating AllTrails URLs...');
    console.log('');
    
    for (const [parkCode, parkData] of Object.entries(trailData.parks)) {
      if (verbose) {
        console.log(`[${parkCode.toUpperCase()}] ${parkData.parkName}`);
      }
      
      for (const trail of parkData.trails) {
        if (!trail.allTrailsUrl) {
          report.skippedTrails++;
          if (verbose) {
            console.log(`  - ${trail.name}: SKIPPED (no URL)`);
          }
          continue;
        }
        
        const validation = await validateAllTrailsUrl(trail.allTrailsUrl);
        
        if (validation.valid) {
          report.validatedTrails++;
          trail.validationStatus = 'valid';
          trail.lastValidated = report.timestamp;
          if (verbose) {
            console.log(`  - ${trail.name}: OK`);
          }
        } else {
          report.invalidTrails++;
          trail.validationStatus = 'invalid';
          trail.lastValidated = report.timestamp;
          report.invalidUrls.push({
            parkCode,
            trailId: trail.id,
            trailName: trail.name,
            url: trail.allTrailsUrl,
            reason: validation.reason || 'Unknown',
          });
          if (verbose) {
            console.log(`  - ${trail.name}: INVALID (${validation.reason})`);
          }
        }
      }
      
      if (verbose) {
        console.log('');
      }
    }
  } else {
    report.skippedTrails = report.totalTrails;
    console.log('URL validation skipped');
  }
  
  // Update metadata
  trailData._meta.lastSyncRun = report.timestamp;
  trailData._meta.syncStatus = report.invalidTrails > 0 ? 'issues_found' : 'healthy';
  
  // Upload updated data (unless dry run)
  if (!dryRun) {
    console.log('Uploading updated trail data to S3...');
    try {
      await uploadTrailDataToS3(trailData);
      console.log('[OK] Trail data updated');
      
      await uploadSyncReportToS3(report);
      console.log('[OK] Sync report uploaded');
    } catch (error: any) {
      report.errors.push(`Upload failed: ${error.message}`);
      console.error('[ERROR]', error.message);
    }
  } else {
    console.log('[DRY RUN] Would upload trail data and sync report');
  }
  
  // Summary
  console.log('');
  console.log('='.repeat(60));
  console.log('Sync Summary');
  console.log('='.repeat(60));
  console.log(`Total trails: ${report.totalTrails}`);
  console.log(`Validated: ${report.validatedTrails}`);
  console.log(`Invalid: ${report.invalidTrails}`);
  console.log(`Skipped: ${report.skippedTrails}`);
  console.log(`Errors: ${report.errors.length}`);
  
  if (report.invalidUrls.length > 0) {
    console.log('');
    console.log('Invalid URLs requiring attention:');
    for (const invalid of report.invalidUrls) {
      console.log(`  - [${invalid.parkCode}] ${invalid.trailName}: ${invalid.reason}`);
      console.log(`    URL: ${invalid.url}`);
    }
  }
  
  console.log('');
  console.log('='.repeat(60));
  console.log('Sync Complete');
  console.log('='.repeat(60));
  
  return report;
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const noValidate = args.includes('--no-validate');
const quiet = args.includes('--quiet');

// Run sync
syncTrailData({
  validateUrls: !noValidate,
  dryRun,
  verbose: !quiet,
}).then(report => {
  if (report.errors.length > 0 || report.invalidTrails > 0) {
    process.exit(1);
  }
}).catch(error => {
  console.error('Sync failed:', error);
  process.exit(1);
});
