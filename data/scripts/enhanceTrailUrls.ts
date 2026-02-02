/**
 * Enhance Trail URLs
 * 
 * Adds official state park website URLs and AllTrails URLs to trails
 * that currently only have Google Maps search URLs.
 * 
 * Priority order for trailUrl:
 * 1. Official state park website URL (e.g., dnr.wisconsin.gov, floridastateparks.org)
 * 2. AllTrails URL
 * 3. Google Maps URL (fallback)
 * 
 * Usage:
 *   npx ts-node data/scripts/enhanceTrailUrls.ts
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const S3_BUCKET = process.env.PARK_DATA_S3_BUCKET || 'tripagent-park-data';
const S3_REGION = process.env.AWS_REGION || 'us-east-1';

// Official Wisconsin DNR park URLs
const WI_PARK_URLS: Record<string, string> = {
  'devils-lake': 'https://dnr.wisconsin.gov/topic/parks/devilslake',
  'peninsula': 'https://dnr.wisconsin.gov/topic/parks/peninsula',
  'governor-dodge': 'https://dnr.wisconsin.gov/topic/parks/govdodge',
  'kettle-moraine-south': 'https://dnr.wisconsin.gov/topic/parks/kms',
  'kettle-moraine-north': 'https://dnr.wisconsin.gov/topic/parks/kmn',
  'kohler-andrae': 'https://dnr.wisconsin.gov/topic/parks/kohlerandrae',
  'mirror-lake': 'https://dnr.wisconsin.gov/topic/parks/mirrorlake',
  'wyalusing': 'https://dnr.wisconsin.gov/topic/parks/wyalusing',
  'blue-mound': 'https://dnr.wisconsin.gov/topic/parks/bluemound',
  'copper-falls': 'https://dnr.wisconsin.gov/topic/parks/copperfalls',
  'amnicon-falls': 'https://dnr.wisconsin.gov/topic/parks/amniconfalls',
  'interstate': 'https://dnr.wisconsin.gov/topic/parks/interstate',
  'potawatomi': 'https://dnr.wisconsin.gov/topic/parks/potawatomi',
  'willow-river': 'https://dnr.wisconsin.gov/topic/parks/willowriver',
  'pattison': 'https://dnr.wisconsin.gov/topic/parks/pattison',
  'rib-mountain': 'https://dnr.wisconsin.gov/topic/parks/ribmtn',
  'rock-island': 'https://dnr.wisconsin.gov/topic/parks/rockisland',
  'big-bay': 'https://dnr.wisconsin.gov/topic/parks/bigbay',
  'hartman-creek': 'https://dnr.wisconsin.gov/topic/parks/hartmancreek',
  'brunet-island': 'https://dnr.wisconsin.gov/topic/parks/brunetisland',
  'lake-kegonsa': 'https://dnr.wisconsin.gov/topic/parks/lakekegonsa',
  'perrot': 'https://dnr.wisconsin.gov/topic/parks/perrot',
  'tower-hill': 'https://dnr.wisconsin.gov/topic/parks/towerhill',
  'wildcat-mountain': 'https://dnr.wisconsin.gov/topic/parks/wildcatmtn',
  'nelson-dewey': 'https://dnr.wisconsin.gov/topic/parks/nelsondewey',
};

// Official Florida State Parks URLs
const FL_PARK_URLS: Record<string, string> = {
  'myakka-river': 'https://www.floridastateparks.org/parks-and-trails/myakka-river-state-park',
  'jonathan-dickinson': 'https://www.floridastateparks.org/parks-and-trails/jonathan-dickinson-state-park',
  'paynes-prairie': 'https://www.floridastateparks.org/parks-and-trails/paynes-prairie-preserve-state-park',
  'wekiwa-springs': 'https://www.floridastateparks.org/parks-and-trails/wekiwa-springs-state-park',
  'blue-spring': 'https://www.floridastateparks.org/parks-and-trails/blue-spring-state-park',
  'bahia-honda': 'https://www.floridastateparks.org/parks-and-trails/bahia-honda-state-park',
  'ichetucknee': 'https://www.floridastateparks.org/parks-and-trails/ichetucknee-springs-state-park',
  'rainbow-springs': 'https://www.floridastateparks.org/parks-and-trails/rainbow-springs-state-park',
  'hillsborough-river': 'https://www.floridastateparks.org/parks-and-trails/hillsborough-river-state-park',
  'big-talbot': 'https://www.floridastateparks.org/parks-and-trails/big-talbot-island-state-park',
  'st-andrews': 'https://www.floridastateparks.org/parks-and-trails/st-andrews-state-park',
  'grayton-beach': 'https://www.floridastateparks.org/parks-and-trails/grayton-beach-state-park',
  'torreya': 'https://www.floridastateparks.org/parks-and-trails/torreya-state-park',
  'anastasia': 'https://www.floridastateparks.org/parks-and-trails/anastasia-state-park',
  'john-pennekamp': 'https://www.floridastateparks.org/parks-and-trails/john-pennekamp-coral-reef-state-park',
  'caladesi-island': 'https://www.floridastateparks.org/parks-and-trails/caladesi-island-state-park',
  'honeymoon-island': 'https://www.floridastateparks.org/parks-and-trails/honeymoon-island-state-park',
  'highlands-hammock': 'https://www.floridastateparks.org/parks-and-trails/highlands-hammock-state-park',
  'oscar-scherer': 'https://www.floridastateparks.org/parks-and-trails/oscar-scherer-state-park',
  'little-talbot': 'https://www.floridastateparks.org/parks-and-trails/little-talbot-island-state-park',
  'suwannee-river': 'https://www.floridastateparks.org/parks-and-trails/suwannee-river-state-park',
  'manatee-springs': 'https://www.floridastateparks.org/parks-and-trails/manatee-springs-state-park',
  'fort-clinch': 'https://www.floridastateparks.org/parks-and-trails/fort-clinch-state-park',
  'fakahatchee': 'https://www.floridastateparks.org/parks-and-trails/fakahatchee-strand-preserve-state-park',
  'oleta-river': 'https://www.floridastateparks.org/parks-and-trails/oleta-river-state-park',
  'sebastian-inlet': 'https://www.floridastateparks.org/parks-and-trails/sebastian-inlet-state-park',
  'devils-millhopper': 'https://www.floridastateparks.org/parks-and-trails/devils-millhopper-geological-state-park',
  'wakulla-springs': 'https://www.floridastateparks.org/parks-and-trails/edward-ball-wakulla-springs-state-park',
  'homosassa-springs': 'https://www.floridastateparks.org/parks-and-trails/homosassa-springs-wildlife-state-park',
  'silver-springs': 'https://www.floridastateparks.org/parks-and-trails/silver-springs-state-park',
  'crystal-river': 'https://www.floridastateparks.org/parks-and-trails/crystal-river-preserve-state-park',
  'alafia-river': 'https://www.floridastateparks.org/parks-and-trails/alafia-river-state-park',
  'lake-louisa': 'https://www.floridastateparks.org/parks-and-trails/lake-louisa-state-park',
  'ravine-gardens': 'https://www.floridastateparks.org/parks-and-trails/ravine-gardens-state-park',
  'tomoka': 'https://www.floridastateparks.org/parks-and-trails/tomoka-state-park',
  'washington-oaks': 'https://www.floridastateparks.org/parks-and-trails/washington-oaks-gardens-state-park',
  'bulow-creek': 'https://www.floridastateparks.org/parks-and-trails/bulow-creek-state-park',
  'de-leon-springs': 'https://www.floridastateparks.org/parks-and-trails/de-leon-springs-state-park',
  'lower-wekiva': 'https://www.floridastateparks.org/parks-and-trails/lower-wekiva-river-preserve-state-park',
  'rock-springs-run': 'https://www.floridastateparks.org/parks-and-trails/rock-springs-run-state-reserve',
  'hontoon-island': 'https://www.floridastateparks.org/parks-and-trails/hontoon-island-state-park',
  'fanning-springs': 'https://www.floridastateparks.org/parks-and-trails/fanning-springs-state-park',
  'gold-head-branch': 'https://www.floridastateparks.org/parks-and-trails/mike-roess-gold-head-branch-state-park',
  'collier-seminole': 'https://www.floridastateparks.org/parks-and-trails/collier-seminole-state-park',
  'long-key': 'https://www.floridastateparks.org/parks-and-trails/long-key-state-park',
  'three-rivers': 'https://www.floridastateparks.org/parks-and-trails/three-rivers-state-park',
  'gamble-rogers': 'https://www.floridastateparks.org/parks-and-trails/gamble-rogers-memorial-state-recreation-area',
  'north-peninsula': 'https://www.floridastateparks.org/parks-and-trails/north-peninsula-state-park',
};

// Generate AllTrails URL from trail name and park name
function generateAllTrailsUrl(trailName: string, parkName: string, stateName: string): string {
  // AllTrails URL format: https://www.alltrails.com/trail/us/state/trail-name-slug
  const stateSlug = stateName.toLowerCase().replace(/\s+/g, '-');
  const trailSlug = `${trailName} ${parkName}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80);
  
  return `https://www.alltrails.com/trail/us/${stateSlug}/${trailSlug}`;
}

// Generate coordinate-based Google Maps URL (more reliable than search)
function generateCoordinateGoogleMapsUrl(lat: number, lng: number, trailName: string): string {
  // Use place search with coordinates for more accurate results
  const query = encodeURIComponent(trailName);
  return `https://www.google.com/maps/search/${query}/@${lat},${lng},15z`;
}

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
  nearbyParks?: { parkId: string; parkName: string; distanceMiles: number }[];
  dataSource: string;
  lastUpdated: string;
}

interface StateTrailsData {
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

async function enhanceStateTrails(stateCode: 'WI' | 'FL'): Promise<void> {
  const s3Client = new S3Client({ region: S3_REGION });
  const stateName = stateCode === 'WI' ? 'Wisconsin' : 'Florida';
  const parkUrls = stateCode === 'WI' ? WI_PARK_URLS : FL_PARK_URLS;
  
  console.log(`\n============================================================`);
  console.log(`Enhancing ${stateName} Trail URLs`);
  console.log(`============================================================\n`);
  
  // Fetch existing data
  const key = `trails/state-parks/${stateCode}/trails.json`;
  let data: StateTrailsData;
  
  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    }));
    const body = await response.Body?.transformToString();
    data = JSON.parse(body!);
  } catch (error: any) {
    console.error(`Failed to fetch ${stateCode} data: ${error.message}`);
    return;
  }
  
  let enhancedCount = 0;
  let officialUrlCount = 0;
  let allTrailsUrlCount = 0;
  let coordinateUrlCount = 0;
  
  // Process each park
  for (const [parkId, parkData] of Object.entries(data.parks)) {
    const parkOfficialUrl = parkUrls[parkId];
    
    for (const trail of parkData.trails) {
      let enhanced = false;
      
      // 1. Add official park URL if not already set
      if (!trail.officialUrl && parkOfficialUrl) {
        trail.officialUrl = parkOfficialUrl;
        officialUrlCount++;
        enhanced = true;
      }
      
      // 2. Generate AllTrails URL
      if (!trail.allTrailsUrl) {
        trail.allTrailsUrl = generateAllTrailsUrl(trail.name, parkData.parkName, stateName);
        allTrailsUrlCount++;
        enhanced = true;
      }
      
      // 3. Improve Google Maps URL with coordinates if available
      if (trail.trailheadCoordinates && trail.googleMapsUrl?.includes('search/?api=1')) {
        trail.googleMapsUrl = generateCoordinateGoogleMapsUrl(
          trail.trailheadCoordinates.latitude,
          trail.trailheadCoordinates.longitude,
          `${trail.name} trail`
        );
        coordinateUrlCount++;
        enhanced = true;
      }
      
      if (enhanced) {
        enhancedCount++;
      }
    }
  }
  
  // Update metadata
  data._meta.lastUpdated = new Date().toISOString();
  
  // Save locally
  const outputPath = path.join(__dirname, `../sources/trails/${stateCode.toLowerCase()}-trails.json`);
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`Wrote local copy to: ${outputPath}`);
  
  // Upload to S3
  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json',
  }));
  console.log(`Uploaded to s3://${S3_BUCKET}/${key}`);
  
  console.log(`\nSummary for ${stateName}:`);
  console.log(`  Trails enhanced: ${enhancedCount}`);
  console.log(`  Official URLs added: ${officialUrlCount}`);
  console.log(`  AllTrails URLs added: ${allTrailsUrlCount}`);
  console.log(`  Coordinate-based Google Maps URLs: ${coordinateUrlCount}`);
}

async function main() {
  console.log('============================================================');
  console.log('Trail URL Enhancement Script');
  console.log('============================================================');
  console.log('');
  console.log('This script adds:');
  console.log('  1. Official state park website URLs');
  console.log('  2. AllTrails URLs for trail discovery');
  console.log('  3. Coordinate-based Google Maps URLs');
  console.log('');
  console.log('Priority order: Official URL > AllTrails > Google Maps');
  
  await enhanceStateTrails('WI');
  await enhanceStateTrails('FL');
  
  console.log('\n============================================================');
  console.log('Enhancement Complete');
  console.log('============================================================');
}

main().catch(console.error);
