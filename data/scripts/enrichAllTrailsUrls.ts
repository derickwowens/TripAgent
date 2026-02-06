/**
 * AllTrails URL Enrichment Script
 * 
 * Adds AllTrails search URLs to existing trail data in S3.
 * Does NOT scrape AllTrails - just generates deep search links.
 * 
 * Usage:
 *   npx tsx data/scripts/enrichAllTrailsUrls.ts NC
 *   npx tsx data/scripts/enrichAllTrailsUrls.ts all
 */

import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const S3_BUCKET = process.env.PARK_DATA_S3_BUCKET || 'tripagent-park-data';
const S3_REGION = process.env.AWS_REGION || 'us-east-1';

// ============================================================================
// TYPES
// ============================================================================

interface Trail {
  id: string;
  name: string;
  parkId: string;
  parkName: string;
  stateCode: string;
  lengthMiles?: number;
  difficulty?: string;
  trailType?: string;
  description?: string;
  officialUrl?: string;
  allTrailsUrl?: string;
  googleMapsUrl: string;
  trailheadCoordinates?: { latitude: number; longitude: number };
  dataSource: string;
  lastUpdated: string;
}

interface StateTrailOutput {
  _meta: {
    stateCode: string;
    stateName: string;
    lastUpdated: string;
    totalParks: number;
    totalTrails: number;
    sources: string[];
  };
  parks: Record<string, { parkName: string; trails: Trail[] }>;
}

// ============================================================================
// STATE NAME MAPPING
// ============================================================================

const STATE_NAMES: Record<string, string> = {
  AL: 'alabama', AK: 'alaska', AZ: 'arizona', AR: 'arkansas', CA: 'california',
  CO: 'colorado', CT: 'connecticut', DE: 'delaware', FL: 'florida', GA: 'georgia',
  HI: 'hawaii', ID: 'idaho', IL: 'illinois', IN: 'indiana', IA: 'iowa',
  KS: 'kansas', KY: 'kentucky', LA: 'louisiana', ME: 'maine', MD: 'maryland',
  MA: 'massachusetts', MI: 'michigan', MN: 'minnesota', MS: 'mississippi', MO: 'missouri',
  MT: 'montana', NE: 'nebraska', NV: 'nevada', NH: 'new-hampshire', NJ: 'new-jersey',
  NM: 'new-mexico', NY: 'new-york', NC: 'north-carolina', ND: 'north-dakota', OH: 'ohio',
  OK: 'oklahoma', OR: 'oregon', PA: 'pennsylvania', RI: 'rhode-island', SC: 'south-carolina',
  SD: 'south-dakota', TN: 'tennessee', TX: 'texas', UT: 'utah', VT: 'vermont',
  VA: 'virginia', WA: 'washington', WV: 'west-virginia', WI: 'wisconsin', WY: 'wyoming',
};

// ============================================================================
// URL GENERATION
// ============================================================================

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function generateAllTrailsSearchUrl(trailName: string, parkName: string, stateCode: string): string {
  const query = `${trailName} ${parkName}`;
  return `https://www.alltrails.com/search?q=${encodeURIComponent(query)}`;
}

function generateAllTrailsTrailUrl(trailName: string, stateCode: string): string {
  const state = STATE_NAMES[stateCode] || stateCode.toLowerCase();
  const slug = slugify(trailName);
  // AllTrails uses format: /trail/us/{state}/{trail-slug}
  return `https://www.alltrails.com/trail/us/${state}/${slug}`;
}

// ============================================================================
// S3 HELPERS
// ============================================================================

async function getExistingS3Data(s3Client: S3Client, stateCode: string): Promise<StateTrailOutput | null> {
  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: `trails/state-parks/${stateCode}/trails.json`,
    }));
    const body = await response.Body?.transformToString();
    return body ? JSON.parse(body) : null;
  } catch (error: any) {
    if (error.name === 'NoSuchKey') return null;
    console.log(`  [S3] Error reading ${stateCode}: ${error.message}`);
    return null;
  }
}

async function getAvailableStates(s3Client: S3Client): Promise<string[]> {
  const states: string[] = [];
  try {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: 'trails/state-parks/',
      Delimiter: '/',
    }));
    for (const prefix of response.CommonPrefixes || []) {
      const code = prefix.Prefix?.replace('trails/state-parks/', '').replace('/', '');
      if (code && code.length === 2) {
        states.push(code);
      }
    }
  } catch (error: any) {
    console.log(`  [S3] Error listing states: ${error.message}`);
  }
  return states.sort();
}

// ============================================================================
// MAIN
// ============================================================================

async function enrichState(s3Client: S3Client, stateCode: string): Promise<{ total: number; enriched: number }> {
  console.log(`\n--- ${stateCode} ---`);

  const data = await getExistingS3Data(s3Client, stateCode);
  if (!data) {
    console.log(`  No trail data found for ${stateCode}`);
    return { total: 0, enriched: 0 };
  }

  let total = 0;
  let enriched = 0;

  for (const parkData of Object.values(data.parks)) {
    for (const trail of parkData.trails) {
      total++;
      if (!trail.allTrailsUrl) {
        // Use direct trail URL format for well-known trails, search URL for others
        trail.allTrailsUrl = generateAllTrailsSearchUrl(trail.name, trail.parkName, trail.stateCode);
        enriched++;
      }
    }
  }

  if (enriched === 0) {
    console.log(`  Already enriched (${total} trails)`);
    return { total, enriched: 0 };
  }

  // Update meta
  if (!data._meta.sources.includes('alltrails_links')) {
    data._meta.sources.push('alltrails_links');
  }
  data._meta.lastUpdated = new Date().toISOString();

  // Save local copy
  const outputDir = path.join(__dirname, '../sources/trails');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(outputDir, `${stateCode.toLowerCase()}-trails.json`),
    JSON.stringify(data, null, 2)
  );

  // Upload to S3
  const key = `trails/state-parks/${stateCode}/trails.json`;
  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json',
  }));

  console.log(`  ${enriched}/${total} trails enriched with AllTrails URLs -> S3`);
  return { total, enriched };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
AllTrails URL Enrichment
========================
Adds AllTrails search URLs to existing trail data.

Usage:
  npx tsx data/scripts/enrichAllTrailsUrls.ts <state_code>
  npx tsx data/scripts/enrichAllTrailsUrls.ts all
`);
    return;
  }

  const s3Client = new S3Client({ region: S3_REGION });
  const stateArg = args[0].toUpperCase();

  let states: string[];
  if (stateArg === 'ALL') {
    states = await getAvailableStates(s3Client);
    console.log(`Found ${states.length} states with trail data: ${states.join(', ')}`);
  } else {
    states = [stateArg];
  }

  console.log('\nAllTrails URL Enrichment');
  console.log('========================');

  let grandTotal = 0;
  let grandEnriched = 0;

  for (const state of states) {
    const result = await enrichState(s3Client, state);
    grandTotal += result.total;
    grandEnriched += result.enriched;
  }

  console.log('\n========================');
  console.log(`Total: ${grandEnriched} trails enriched out of ${grandTotal}`);
}

main().catch(console.error);
