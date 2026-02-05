/**
 * Full Trail Link Validation
 * 
 * Validates ALL trail URLs individually (not sampling).
 * Only removes URLs that are actually tested and found broken.
 * 
 * This script is designed to run for extended periods.
 * Progress is saved periodically so it can be resumed.
 * 
 * Usage: npx tsx data/scripts/validateAllTrailLinks.ts [STATE]
 * Example: npx tsx data/scripts/validateAllTrailLinks.ts CA
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const S3_BUCKET = process.env.PARK_DATA_S3_BUCKET || 'tripagent-park-data';
const S3_REGION = process.env.AWS_REGION || 'us-east-2';

const TIMEOUT_MS = 8000;
const CONCURRENT_REQUESTS = 20;  // Parallel requests
const DELAY_BETWEEN_BATCHES = 200;  // ms between batches
const PROGRESS_SAVE_INTERVAL = 1000;  // Save progress every N URLs

const ALL_STATES = ['WI', 'FL', 'CA', 'TX', 'CO', 'AZ', 'UT', 'OR', 'WA', 'MI'];

interface Trail {
  id: string;
  name: string;
  parkId?: string;
  parkName?: string;
  officialUrl?: string;
  allTrailsUrl?: string;
  googleMapsUrl?: string;
  [key: string]: any;
}

interface StateTrailsData {
  _meta?: any;
  parks: Record<string, { parkName: string; trails: Trail[] }>;
}

interface ValidationProgress {
  state: string;
  totalUrls: number;
  validatedCount: number;
  validUrls: string[];
  brokenUrls: string[];
  lastUpdated: string;
}

/**
 * Check if a URL is valid
 */
async function isUrlValid(url: string): Promise<boolean> {
  if (!url || !url.startsWith('http')) return false;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    clearTimeout(timeoutId);

    // Some sites return 405 for HEAD, try GET
    if (response.status === 405) {
      const getController = new AbortController();
      const getTimeoutId = setTimeout(() => getController.abort(), TIMEOUT_MS);
      
      const getResponse = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: getController.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });
      
      clearTimeout(getTimeoutId);
      return getResponse.ok;
    }

    return response.ok;
  } catch (error: any) {
    return false;
  }
}

/**
 * Load progress file if it exists
 */
function loadProgress(stateCode: string): ValidationProgress | null {
  const progressPath = path.join(__dirname, `../validation-progress-${stateCode}.json`);
  if (fs.existsSync(progressPath)) {
    return JSON.parse(fs.readFileSync(progressPath, 'utf-8'));
  }
  return null;
}

/**
 * Save progress to file
 */
function saveProgress(progress: ValidationProgress): void {
  const progressPath = path.join(__dirname, `../validation-progress-${progress.state}.json`);
  fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
}

/**
 * Validate all URLs for a state
 */
async function validateState(stateCode: string): Promise<void> {
  const s3Client = new S3Client({ region: S3_REGION });
  const key = `trails/state-parks/${stateCode}/trails.json`;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Validating ALL ${stateCode} Trail URLs`);
  console.log(`${'='.repeat(60)}`);
  
  // Fetch data from S3
  let data: StateTrailsData;
  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    }));
    const body = await response.Body?.transformToString();
    data = JSON.parse(body!);
  } catch (error: any) {
    console.log(`  No trail data found for ${stateCode}`);
    return;
  }
  
  // Collect all unique AllTrails URLs (focus on AllTrails since those are the ones to validate)
  const urlToTrailIds = new Map<string, string[]>();
  let totalTrails = 0;
  
  for (const [parkId, parkData] of Object.entries(data.parks || {})) {
    for (const trail of parkData.trails || []) {
      totalTrails++;
      if (trail.allTrailsUrl) {
        const existing = urlToTrailIds.get(trail.allTrailsUrl) || [];
        existing.push(trail.id);
        urlToTrailIds.set(trail.allTrailsUrl, existing);
      }
    }
  }
  
  const uniqueUrls = [...urlToTrailIds.keys()];
  console.log(`  Total trails: ${totalTrails}`);
  console.log(`  Unique AllTrails URLs to validate: ${uniqueUrls.length}`);
  
  // Check for existing progress
  let progress = loadProgress(stateCode);
  const alreadyValidated = new Set<string>();
  
  if (progress) {
    console.log(`  Resuming from previous progress: ${progress.validatedCount}/${progress.totalUrls}`);
    progress.validUrls.forEach(u => alreadyValidated.add(u));
    progress.brokenUrls.forEach(u => alreadyValidated.add(u));
  } else {
    progress = {
      state: stateCode,
      totalUrls: uniqueUrls.length,
      validatedCount: 0,
      validUrls: [],
      brokenUrls: [],
      lastUpdated: new Date().toISOString(),
    };
  }
  
  // Filter to only URLs we haven't validated yet
  const urlsToValidate = uniqueUrls.filter(u => !alreadyValidated.has(u));
  console.log(`  URLs remaining to validate: ${urlsToValidate.length}`);
  
  if (urlsToValidate.length === 0) {
    console.log(`  All URLs already validated!`);
  } else {
    // Validate in batches
    const startTime = Date.now();
    let validated = 0;
    
    for (let i = 0; i < urlsToValidate.length; i += CONCURRENT_REQUESTS) {
      const batch = urlsToValidate.slice(i, i + CONCURRENT_REQUESTS);
      
      const results = await Promise.all(
        batch.map(async (url) => {
          const isValid = await isUrlValid(url);
          return { url, isValid };
        })
      );
      
      for (const { url, isValid } of results) {
        if (isValid) {
          progress.validUrls.push(url);
        } else {
          progress.brokenUrls.push(url);
        }
        progress.validatedCount++;
        validated++;
      }
      
      // Progress update
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = validated / elapsed;
      const remaining = urlsToValidate.length - validated;
      const eta = remaining / rate;
      
      process.stdout.write(
        `\r  Progress: ${progress.validatedCount}/${uniqueUrls.length} ` +
        `(${((progress.validatedCount / uniqueUrls.length) * 100).toFixed(1)}%) ` +
        `| Rate: ${rate.toFixed(1)}/s | ETA: ${formatTime(eta)}    `
      );
      
      // Save progress periodically
      if (validated % PROGRESS_SAVE_INTERVAL === 0) {
        progress.lastUpdated = new Date().toISOString();
        saveProgress(progress);
      }
      
      // Small delay between batches
      if (i + CONCURRENT_REQUESTS < urlsToValidate.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }
    
    console.log('');
    
    // Save final progress
    progress.lastUpdated = new Date().toISOString();
    saveProgress(progress);
  }
  
  // Report results
  const validCount = progress.validUrls.length;
  const brokenCount = progress.brokenUrls.length;
  const validPct = uniqueUrls.length > 0 ? ((validCount / uniqueUrls.length) * 100).toFixed(1) : '0';
  
  console.log(`\n  Results:`);
  console.log(`    Valid URLs: ${validCount} (${validPct}%)`);
  console.log(`    Broken URLs: ${brokenCount}`);
  
  // Remove broken URLs from trail data
  if (brokenCount > 0) {
    console.log(`\n  Removing ${brokenCount} broken AllTrails URLs from trail data...`);
    
    const brokenSet = new Set(progress.brokenUrls);
    let removedCount = 0;
    
    for (const parkData of Object.values(data.parks || {})) {
      for (const trail of parkData.trails || []) {
        if (trail.allTrailsUrl && brokenSet.has(trail.allTrailsUrl)) {
          delete trail.allTrailsUrl;
          removedCount++;
        }
      }
    }
    
    // Update metadata
    if (data._meta) {
      data._meta.lastValidated = new Date().toISOString();
      data._meta.brokenLinksRemoved = removedCount;
      data._meta.validationMethod = 'full-individual-validation';
    }
    
    // Upload cleaned data
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: 'application/json',
    }));
    
    console.log(`  Removed ${removedCount} broken URLs from ${stateCode} trails`);
    console.log(`  Uploaded cleaned data to S3`);
  } else {
    console.log(`\n  No broken URLs found - data is clean!`);
  }
  
  // Clean up progress file
  const progressPath = path.join(__dirname, `../validation-progress-${stateCode}.json`);
  if (fs.existsSync(progressPath)) {
    fs.unlinkSync(progressPath);
  }
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Full Trail Link Validation');
  console.log('='.repeat(60));
  console.log('');
  console.log('This script validates ALL AllTrails URLs individually.');
  console.log('Only URLs that are actually tested and found broken are removed.');
  console.log('Progress is saved so the script can be resumed if interrupted.');
  console.log('');
  
  const targetState = process.argv[2]?.toUpperCase();
  const statesToProcess = targetState ? [targetState] : ALL_STATES;
  
  console.log(`States to process: ${statesToProcess.join(', ')}`);
  
  for (const state of statesToProcess) {
    try {
      await validateState(state);
    } catch (error: any) {
      console.log(`\n[${state}] Error: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Validation Complete');
  console.log('='.repeat(60));
}

main().catch(console.error);
