/**
 * Validate and Clean All Links (Trails + Campgrounds)
 * 
 * Validates all trail and campground URLs in S3 and removes broken ones.
 * Checks officialUrl, allTrailsUrl, googleMapsUrl on trails and
 * reservationUrl, googleMapsUrl on campgrounds.
 * 
 * Usage: npx tsx data/scripts/validateAndCleanTrailLinks.ts [STATE]
 * Example: npx tsx data/scripts/validateAndCleanTrailLinks.ts CA
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';

dotenv.config();

const S3_BUCKET = process.env.PARK_DATA_S3_BUCKET || 'tripagent-park-data';
const S3_REGION = process.env.AWS_REGION || 'us-east-1';

const TIMEOUT_MS = 5000;
const CONCURRENT_REQUESTS = 10;
const DELAY_BETWEEN_BATCHES = 500;

// States to process
const ALL_STATES = [
  'AR', 'AZ', 'CA', 'CO', 'FL', 'GA', 'ID', 'IL', 'IN', 'KY',
  'MA', 'MD', 'ME', 'MI', 'MN', 'MO', 'MT', 'NC', 'ND', 'NH',
  'NM', 'NV', 'NY', 'OH', 'OR', 'PA', 'SC', 'SD', 'TN', 'TX',
  'UT', 'VA', 'WA', 'WI', 'WV', 'WY',
];

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

interface Campground {
  id: string;
  name: string;
  reservationUrl?: string;
  googleMapsUrl?: string;
  [key: string]: any;
}

interface ValidationStats {
  state: string;
  totalTrails: number;
  trailLinksChecked: number;
  trailValidLinks: number;
  trailBrokenLinks: number;
  removedTrailLinks: {
    officialUrl: number;
    allTrailsUrl: number;
    googleMapsUrl: number;
  };
  totalCampgrounds: number;
  campLinksChecked: number;
  campValidLinks: number;
  campBrokenLinks: number;
  removedCampLinks: {
    reservationUrl: number;
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
      trailLinksChecked: 0,
      trailValidLinks: 0,
      trailBrokenLinks: 0,
      removedTrailLinks: { officialUrl: 0, allTrailsUrl: 0, googleMapsUrl: 0 },
      totalCampgrounds: 0,
      campLinksChecked: 0,
      campValidLinks: 0,
      campBrokenLinks: 0,
      removedCampLinks: { reservationUrl: 0, googleMapsUrl: 0 },
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
  
  // Validate ALL unique URLs
  const uniqueUrls = [...new Set(allUrls)];
  
  console.log(`  Checking all ${uniqueUrls.length} unique URLs...`);
  
  // Validate URLs
  const validationResults = await validateInBatches(uniqueUrls, CONCURRENT_REQUESTS, DELAY_BETWEEN_BATCHES);
  
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
  const removedTrailLinks = { officialUrl: 0, allTrailsUrl: 0, googleMapsUrl: 0 };
  
  if (brokenUrls.size > 0) {
    console.log(`  Removing ${brokenUrls.size} broken URLs from trail data...`);
    
    for (const parkData of Object.values(data.parks || {})) {
      for (const trail of parkData.trails || []) {
        if (trail.officialUrl && brokenUrls.has(trail.officialUrl)) {
          delete trail.officialUrl;
          removedTrailLinks.officialUrl++;
        }
        if (trail.allTrailsUrl && brokenUrls.has(trail.allTrailsUrl)) {
          delete trail.allTrailsUrl;
          removedTrailLinks.allTrailsUrl++;
        }
        if (trail.googleMapsUrl && brokenUrls.has(trail.googleMapsUrl)) {
          delete trail.googleMapsUrl;
          removedTrailLinks.googleMapsUrl++;
        }
      }
    }
    
    // Update metadata
    if (data._meta) {
      data._meta.lastValidated = new Date().toISOString();
      data._meta.brokenLinksRemoved = removedTrailLinks.officialUrl + removedTrailLinks.allTrailsUrl + removedTrailLinks.googleMapsUrl;
    }
    
    // Upload cleaned data
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: 'application/json',
    }));
    
    console.log(`  Uploaded cleaned data to S3`);
    console.log(`  Removed: ${removedTrailLinks.officialUrl} official, ${removedTrailLinks.allTrailsUrl} allTrails, ${removedTrailLinks.googleMapsUrl} googleMaps`);
  } else {
    console.log(`  No broken trail links found - data is clean`);
  }
  
  // --- Campground validation ---
  const campKey = `campgrounds/state-parks/${stateCode}/campgrounds.json`;
  let campgrounds: Campground[] = [];
  let campLinksChecked = 0;
  let campValidLinks = 0;
  let campBrokenLinks = 0;
  const removedCampLinks = { reservationUrl: 0, googleMapsUrl: 0 };
  
  try {
    const campResponse = await s3Client.send(new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: campKey,
    }));
    const campBody = await campResponse.Body?.transformToString();
    const campData = JSON.parse(campBody!);
    campgrounds = Array.isArray(campData) ? campData : (campData.campgrounds || []);
  } catch (error: any) {
    // No campground data for this state - skip
  }
  
  if (campgrounds.length > 0) {
    console.log(`\n  --- Campgrounds (${stateCode}) ---`);
    const campUrls: string[] = [];
    for (const cg of campgrounds) {
      if (cg.reservationUrl) campUrls.push(cg.reservationUrl);
      if (cg.googleMapsUrl) campUrls.push(cg.googleMapsUrl);
    }
    const uniqueCampUrls = [...new Set(campUrls)];
    console.log(`  Total campgrounds: ${campgrounds.length}`);
    console.log(`  Checking all ${uniqueCampUrls.length} unique URLs...`);
    
    const campResults = await validateInBatches(uniqueCampUrls, CONCURRENT_REQUESTS, DELAY_BETWEEN_BATCHES);
    const brokenCampUrls = new Set<string>();
    
    for (const [url, isValid] of campResults) {
      if (isValid) campValidLinks++;
      else { campBrokenLinks++; brokenCampUrls.add(url); }
    }
    campLinksChecked = uniqueCampUrls.length;
    console.log(`  Valid: ${campValidLinks}, Broken: ${campBrokenLinks}`);
    
    if (brokenCampUrls.size > 0) {
      console.log(`  Removing ${brokenCampUrls.size} broken campground URLs...`);
      for (const cg of campgrounds) {
        if (cg.reservationUrl && brokenCampUrls.has(cg.reservationUrl)) {
          delete cg.reservationUrl;
          removedCampLinks.reservationUrl++;
        }
        if (cg.googleMapsUrl && brokenCampUrls.has(cg.googleMapsUrl)) {
          delete cg.googleMapsUrl;
          removedCampLinks.googleMapsUrl++;
        }
      }
      
      await s3Client.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: campKey,
        Body: JSON.stringify(campgrounds, null, 2),
        ContentType: 'application/json',
      }));
      console.log(`  Uploaded cleaned campground data to S3`);
      console.log(`  Removed: ${removedCampLinks.reservationUrl} reservation, ${removedCampLinks.googleMapsUrl} googleMaps`);
    } else {
      console.log(`  No broken campground links found - data is clean`);
    }
  }
  
  return {
    state: stateCode,
    totalTrails,
    trailLinksChecked: uniqueUrls.length,
    trailValidLinks: validLinks,
    trailBrokenLinks: brokenLinks,
    removedTrailLinks,
    totalCampgrounds: campgrounds.length,
    campLinksChecked,
    campValidLinks,
    campBrokenLinks,
    removedCampLinks,
  };
}

async function main() {
  console.log('============================================================');
  console.log('Trail + Campground Link Validation and Cleanup');
  console.log('============================================================');
  console.log('');
  console.log('This script:');
  console.log('  1. Validates trail URLs in S3 (officialUrl, allTrailsUrl, googleMapsUrl)');
  console.log('  2. Validates campground URLs in S3 (reservationUrl, googleMapsUrl)');
  console.log('  3. Removes broken links and re-uploads cleaned data');
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
  
  let totalTrailChecked = 0;
  let totalTrailBroken = 0;
  let totalTrailRemoved = 0;
  let totalCampChecked = 0;
  let totalCampBroken = 0;
  let totalCampRemoved = 0;
  
  for (const stats of allStats) {
    totalTrailChecked += stats.trailLinksChecked;
    totalTrailBroken += stats.trailBrokenLinks;
    totalTrailRemoved += stats.removedTrailLinks.officialUrl + stats.removedTrailLinks.allTrailsUrl + stats.removedTrailLinks.googleMapsUrl;
    totalCampChecked += stats.campLinksChecked;
    totalCampBroken += stats.campBrokenLinks;
    totalCampRemoved += stats.removedCampLinks.reservationUrl + stats.removedCampLinks.googleMapsUrl;
    
    const totalChecked = stats.trailLinksChecked + stats.campLinksChecked;
    const totalValid = stats.trailValidLinks + stats.campValidLinks;
    const totalBroken = stats.trailBrokenLinks + stats.campBrokenLinks;
    if (totalChecked > 0) {
      const validPct = ((totalValid / totalChecked) * 100).toFixed(1);
      console.log(`  ${stats.state}: ${totalChecked} checked, ${totalValid} valid (${validPct}%), ${totalBroken} broken`);
    }
  }
  
  console.log('');
  console.log(`Trails:      ${totalTrailChecked} checked, ${totalTrailBroken} broken, ${totalTrailRemoved} removed`);
  console.log(`Campgrounds: ${totalCampChecked} checked, ${totalCampBroken} broken, ${totalCampRemoved} removed`);
  console.log(`Total:       ${totalTrailChecked + totalCampChecked} checked, ${totalTrailBroken + totalCampBroken} broken, ${totalTrailRemoved + totalCampRemoved} removed`);
  console.log('============================================================');
}

main().catch(console.error);
