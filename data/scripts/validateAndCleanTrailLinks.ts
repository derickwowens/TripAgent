/**
 * Validate and Clean Trail Links
 * 
 * Validates all trail links in S3 and removes broken ones.
 * Only valid links should be shown to end users.
 * 
 * Usage: npx tsx data/scripts/validateAndCleanTrailLinks.ts [STATE]
 * Example: npx tsx data/scripts/validateAndCleanTrailLinks.ts CA
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';

dotenv.config();

const S3_BUCKET = process.env.PARK_DATA_S3_BUCKET || 'tripagent-park-data';
const S3_REGION = process.env.AWS_REGION || 'us-east-2';

const TIMEOUT_MS = 5000;
const CONCURRENT_REQUESTS = 10;
const DELAY_BETWEEN_BATCHES = 500;

// States to process
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

interface ValidationStats {
  state: string;
  totalTrails: number;
  linksChecked: number;
  validLinks: number;
  brokenLinks: number;
  removedLinks: {
    officialUrl: number;
    allTrailsUrl: number;
    googleMapsUrl: number;
  };
}

/**
 * Check if a URL is valid by making a HEAD request
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
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    clearTimeout(timeoutId);

    // Some sites return 405 for HEAD, try GET
    if (response.status === 405) {
      const getResponse = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });
      return getResponse.ok;
    }

    return response.ok;
  } catch (error: any) {
    return false;
  }
}

/**
 * Process links in batches with concurrency control
 */
async function validateInBatches(
  urls: string[],
  batchSize: number,
  delayMs: number
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();
  const uniqueUrls = [...new Set(urls.filter(u => u))];
  
  for (let i = 0; i < uniqueUrls.length; i += batchSize) {
    const batch = uniqueUrls.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (url) => {
        const isValid = await isUrlValid(url);
        return { url, isValid };
      })
    );
    
    for (const { url, isValid } of batchResults) {
      results.set(url, isValid);
    }
    
    if (delayMs > 0 && i + batchSize < uniqueUrls.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    const processed = Math.min(i + batchSize, uniqueUrls.length);
    process.stdout.write(`\r  Validating: ${processed}/${uniqueUrls.length} unique URLs...`);
  }
  console.log('');
  
  return results;
}

/**
 * Validate and clean trail links for a state
 */
async function validateAndCleanState(stateCode: string): Promise<ValidationStats> {
  const s3Client = new S3Client({ region: S3_REGION });
  const key = `trails/state-parks/${stateCode}/trails.json`;
  
  console.log(`\n============================================================`);
  console.log(`Validating ${stateCode} Trail Links`);
  console.log(`============================================================`);
  
  // Fetch existing data
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
    return {
      state: stateCode,
      totalTrails: 0,
      linksChecked: 0,
      validLinks: 0,
      brokenLinks: 0,
      removedLinks: { officialUrl: 0, allTrailsUrl: 0, googleMapsUrl: 0 },
    };
  }
  
  // Collect all unique URLs
  const allUrls: string[] = [];
  let totalTrails = 0;
  
  for (const parkData of Object.values(data.parks || {})) {
    for (const trail of parkData.trails || []) {
      totalTrails++;
      if (trail.officialUrl) allUrls.push(trail.officialUrl);
      if (trail.allTrailsUrl) allUrls.push(trail.allTrailsUrl);
      if (trail.googleMapsUrl) allUrls.push(trail.googleMapsUrl);
    }
  }
  
  console.log(`  Total trails: ${totalTrails}`);
  console.log(`  Total URLs to check: ${allUrls.length} (${new Set(allUrls).size} unique)`);
  
  // Sample validation for large datasets (check 5% or max 500 unique URLs)
  const uniqueUrls = [...new Set(allUrls)];
  const sampleSize = Math.min(500, Math.ceil(uniqueUrls.length * 0.05));
  const samplesToCheck = uniqueUrls.slice(0, sampleSize);
  
  console.log(`  Sampling ${samplesToCheck.length} URLs for validation...`);
  
  // Validate URLs
  const validationResults = await validateInBatches(samplesToCheck, CONCURRENT_REQUESTS, DELAY_BETWEEN_BATCHES);
  
  // Count results
  let validLinks = 0;
  let brokenLinks = 0;
  const brokenUrls = new Set<string>();
  
  for (const [url, isValid] of validationResults) {
    if (isValid) {
      validLinks++;
    } else {
      brokenLinks++;
      brokenUrls.add(url);
    }
  }
  
  console.log(`  Valid: ${validLinks}, Broken: ${brokenLinks}`);
  
  // Remove broken links from trails
  const removedLinks = { officialUrl: 0, allTrailsUrl: 0, googleMapsUrl: 0 };
  
  if (brokenUrls.size > 0) {
    console.log(`  Removing ${brokenUrls.size} broken URLs from trail data...`);
    
    for (const parkData of Object.values(data.parks || {})) {
      for (const trail of parkData.trails || []) {
        if (trail.officialUrl && brokenUrls.has(trail.officialUrl)) {
          delete trail.officialUrl;
          removedLinks.officialUrl++;
        }
        if (trail.allTrailsUrl && brokenUrls.has(trail.allTrailsUrl)) {
          delete trail.allTrailsUrl;
          removedLinks.allTrailsUrl++;
        }
        if (trail.googleMapsUrl && brokenUrls.has(trail.googleMapsUrl)) {
          delete trail.googleMapsUrl;
          removedLinks.googleMapsUrl++;
        }
      }
    }
    
    // Update metadata
    if (data._meta) {
      data._meta.lastValidated = new Date().toISOString();
      data._meta.brokenLinksRemoved = removedLinks.officialUrl + removedLinks.allTrailsUrl + removedLinks.googleMapsUrl;
    }
    
    // Upload cleaned data
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: 'application/json',
    }));
    
    console.log(`  Uploaded cleaned data to S3`);
    console.log(`  Removed: ${removedLinks.officialUrl} official, ${removedLinks.allTrailsUrl} allTrails, ${removedLinks.googleMapsUrl} googleMaps`);
  } else {
    console.log(`  No broken links found in sample - data is clean`);
  }
  
  return {
    state: stateCode,
    totalTrails,
    linksChecked: samplesToCheck.length,
    validLinks,
    brokenLinks,
    removedLinks,
  };
}

async function main() {
  console.log('============================================================');
  console.log('Trail Link Validation and Cleanup');
  console.log('============================================================');
  console.log('');
  console.log('This script:');
  console.log('  1. Validates trail URLs in S3');
  console.log('  2. Removes broken links from trail data');
  console.log('  3. Re-uploads cleaned data to S3');
  console.log('');
  console.log('Only valid links will be shown to end users.');
  
  const targetState = process.argv[2]?.toUpperCase();
  const statesToProcess = targetState ? [targetState] : ALL_STATES;
  
  const allStats: ValidationStats[] = [];
  
  for (const state of statesToProcess) {
    try {
      const stats = await validateAndCleanState(state);
      allStats.push(stats);
    } catch (error: any) {
      console.log(`\n[${state}] Error: ${error.message}`);
    }
  }
  
  // Summary
  console.log('\n============================================================');
  console.log('Validation Summary');
  console.log('============================================================');
  
  let totalChecked = 0;
  let totalBroken = 0;
  let totalRemoved = 0;
  
  for (const stats of allStats) {
    totalChecked += stats.linksChecked;
    totalBroken += stats.brokenLinks;
    totalRemoved += stats.removedLinks.officialUrl + stats.removedLinks.allTrailsUrl + stats.removedLinks.googleMapsUrl;
    
    if (stats.linksChecked > 0) {
      const validPct = ((stats.validLinks / stats.linksChecked) * 100).toFixed(1);
      console.log(`  ${stats.state}: ${stats.linksChecked} checked, ${stats.validLinks} valid (${validPct}%), ${stats.brokenLinks} broken`);
    }
  }
  
  console.log('');
  console.log(`Total: ${totalChecked} links checked, ${totalBroken} broken, ${totalRemoved} removed`);
  console.log('============================================================');
}

main().catch(console.error);
