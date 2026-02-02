/**
 * State Parks Trail Fetcher
 * 
 * Fetches trail data from external APIs and uploads to S3.
 * S3 is the authoritative data source - this script only fetches and uploads.
 * 
 * Usage:
 *   npx ts-node data/scripts/fetchStateTrails.ts WI        # Fetch Wisconsin
 *   npx ts-node data/scripts/fetchStateTrails.ts FL        # Fetch Florida
 *   npx ts-node data/scripts/fetchStateTrails.ts all       # Fetch all states
 *   npx ts-node data/scripts/fetchStateTrails.ts --list    # List states
 * 
 * To add a new state:
 *   1. Add park coordinates to STATE_PARKS below
 *   2. Run the script to fetch from TrailAPI and upload to S3
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
const TRAILAPI_KEY = process.env.TRAILAPI_KEY;
const TRAILAPI_HOST = 'trailapi-trailapi.p.rapidapi.com';
const RECREATION_GOV_API_KEY = process.env.RECREATION_GOV_API_KEY;

// ============================================================================
// PARK COORDINATES (needed for TrailAPI location searches)
// Only coordinates here - trail data comes from APIs and lives in S3
// ============================================================================

interface StatePark {
  id: string;
  name: string;
  lat: number;
  lng: number;
  priority: 1 | 2 | 3;
  officialUrl?: string;
}

interface StateDefinition {
  stateCode: string;
  stateName: string;
  estimatedParks: number;
  estimatedTrails: number;
  trailApiRadius: number;
  parks: StatePark[];
}

const STATE_PARKS: Record<string, StateDefinition> = {
  WI: {
    stateCode: 'WI',
    stateName: 'Wisconsin',
    estimatedParks: 50,
    estimatedTrails: 500,
    trailApiRadius: 10,
    parks: [
      { id: 'devils-lake', name: "Devil's Lake State Park", lat: 43.4167, lng: -89.7333, priority: 1, officialUrl: 'https://dnr.wisconsin.gov/topic/parks/devilslake' },
      { id: 'peninsula', name: 'Peninsula State Park', lat: 45.1833, lng: -87.2333, priority: 1, officialUrl: 'https://dnr.wisconsin.gov/topic/parks/peninsula' },
      { id: 'governor-dodge', name: 'Governor Dodge State Park', lat: 43.0167, lng: -90.1167, priority: 1, officialUrl: 'https://dnr.wisconsin.gov/topic/parks/govdodge' },
      { id: 'kettle-moraine-south', name: 'Kettle Moraine State Forest - Southern Unit', lat: 42.8833, lng: -88.5833, priority: 1 },
      { id: 'kettle-moraine-north', name: 'Kettle Moraine State Forest - Northern Unit', lat: 43.5333, lng: -88.1833, priority: 1 },
      { id: 'kohler-andrae', name: 'Kohler-Andrae State Park', lat: 43.6667, lng: -87.7167, priority: 1 },
      { id: 'mirror-lake', name: 'Mirror Lake State Park', lat: 43.5667, lng: -89.8167, priority: 1 },
      { id: 'wyalusing', name: 'Wyalusing State Park', lat: 43.0167, lng: -91.1167, priority: 1 },
      { id: 'blue-mound', name: 'Blue Mound State Park', lat: 43.0333, lng: -89.8333, priority: 1 },
      { id: 'copper-falls', name: 'Copper Falls State Park', lat: 46.3667, lng: -90.6333, priority: 2 },
      { id: 'amnicon-falls', name: 'Amnicon Falls State Park', lat: 46.6167, lng: -91.8833, priority: 2 },
      { id: 'interstate', name: 'Interstate State Park', lat: 45.4000, lng: -92.6500, priority: 2 },
      { id: 'potawatomi', name: 'Potawatomi State Park', lat: 44.8667, lng: -87.3833, priority: 2 },
      { id: 'willow-river', name: 'Willow River State Park', lat: 45.0167, lng: -92.6333, priority: 2 },
      { id: 'pattison', name: 'Pattison State Park', lat: 46.5333, lng: -92.1167, priority: 2 },
      { id: 'rib-mountain', name: 'Rib Mountain State Park', lat: 44.9167, lng: -89.6833, priority: 2 },
      { id: 'rock-island', name: 'Rock Island State Park', lat: 45.4167, lng: -86.8167, priority: 3 },
      { id: 'big-bay', name: 'Big Bay State Park', lat: 46.7833, lng: -90.6667, priority: 3 },
      { id: 'hartman-creek', name: 'Hartman Creek State Park', lat: 44.3333, lng: -89.2167, priority: 3 },
      { id: 'brunet-island', name: 'Brunet Island State Park', lat: 45.1667, lng: -91.1333, priority: 3 },
      { id: 'lake-kegonsa', name: 'Lake Kegonsa State Park', lat: 42.9667, lng: -89.2333, priority: 3 },
      { id: 'perrot', name: 'Perrot State Park', lat: 44.0333, lng: -91.4667, priority: 3 },
      { id: 'tower-hill', name: 'Tower Hill State Park', lat: 43.0833, lng: -90.0667, priority: 3 },
      { id: 'wildcat-mountain', name: 'Wildcat Mountain State Park', lat: 43.7167, lng: -90.5667, priority: 3 },
      { id: 'nelson-dewey', name: 'Nelson Dewey State Park', lat: 42.7167, lng: -90.9500, priority: 3 },
    ],
  },

  FL: {
    stateCode: 'FL',
    stateName: 'Florida',
    estimatedParks: 175,
    estimatedTrails: 1300,
    trailApiRadius: 15,
    parks: [
      { id: 'myakka-river', name: 'Myakka River State Park', lat: 27.2333, lng: -82.3167, priority: 1, officialUrl: 'https://www.floridastateparks.org/parks-and-trails/myakka-river-state-park' },
      { id: 'jonathan-dickinson', name: 'Jonathan Dickinson State Park', lat: 27.0167, lng: -80.1167, priority: 1 },
      { id: 'paynes-prairie', name: 'Paynes Prairie Preserve State Park', lat: 29.5333, lng: -82.3000, priority: 1 },
      { id: 'wekiwa-springs', name: 'Wekiwa Springs State Park', lat: 28.7167, lng: -81.4667, priority: 1 },
      { id: 'blue-spring', name: 'Blue Spring State Park', lat: 28.9500, lng: -81.3333, priority: 1 },
      { id: 'ocala', name: 'Ocala National Forest Trails', lat: 29.1833, lng: -81.6667, priority: 1 },
      { id: 'bahia-honda', name: 'Bahia Honda State Park', lat: 24.6667, lng: -81.2833, priority: 1 },
      { id: 'ichetucknee', name: 'Ichetucknee Springs State Park', lat: 29.9833, lng: -82.7667, priority: 1 },
      { id: 'rainbow-springs', name: 'Rainbow Springs State Park', lat: 29.1000, lng: -82.4333, priority: 1 },
      { id: 'hillsborough-river', name: 'Hillsborough River State Park', lat: 28.1500, lng: -82.2333, priority: 1 },
      { id: 'big-talbot', name: 'Big Talbot Island State Park', lat: 30.4667, lng: -81.4333, priority: 1 },
      { id: 'st-andrews', name: 'St. Andrews State Park', lat: 30.1333, lng: -85.7333, priority: 1 },
      { id: 'grayton-beach', name: 'Grayton Beach State Park', lat: 30.3333, lng: -86.1667, priority: 1 },
      { id: 'torreya', name: 'Torreya State Park', lat: 30.5667, lng: -84.9500, priority: 2 },
      { id: 'anastasia', name: 'Anastasia State Park', lat: 29.8667, lng: -81.2667, priority: 2 },
      { id: 'john-pennekamp', name: 'John Pennekamp Coral Reef State Park', lat: 25.1333, lng: -80.4000, priority: 2 },
      { id: 'caladesi-island', name: 'Caladesi Island State Park', lat: 28.0333, lng: -82.8167, priority: 2 },
      { id: 'honeymoon-island', name: 'Honeymoon Island State Park', lat: 28.0667, lng: -82.8333, priority: 2 },
      { id: 'highlands-hammock', name: 'Highlands Hammock State Park', lat: 27.4667, lng: -81.5333, priority: 2 },
      { id: 'oscar-scherer', name: 'Oscar Scherer State Park', lat: 27.1833, lng: -82.4500, priority: 2 },
      { id: 'little-talbot', name: 'Little Talbot Island State Park', lat: 30.4500, lng: -81.4167, priority: 2 },
      { id: 'suwannee-river', name: 'Suwannee River State Park', lat: 30.3833, lng: -83.1667, priority: 2 },
      { id: 'manatee-springs', name: 'Manatee Springs State Park', lat: 29.4833, lng: -82.9667, priority: 2 },
      { id: 'fort-clinch', name: 'Fort Clinch State Park', lat: 30.7000, lng: -81.4333, priority: 2 },
      { id: 'fakahatchee', name: 'Fakahatchee Strand Preserve State Park', lat: 25.9667, lng: -81.3833, priority: 2 },
      { id: 'fanning-springs', name: 'Fanning Springs State Park', lat: 29.5833, lng: -82.9333, priority: 3 },
      { id: 'gold-head-branch', name: 'Gold Head Branch State Park', lat: 29.8333, lng: -81.9667, priority: 3 },
      { id: 'collier-seminole', name: 'Collier-Seminole State Park', lat: 25.8500, lng: -81.4667, priority: 3 },
      { id: 'long-key', name: 'Long Key State Park', lat: 24.8167, lng: -80.8333, priority: 3 },
      // Additional parks for Phase 1 coverage
      { id: 'oleta-river', name: 'Oleta River State Park', lat: 25.9167, lng: -80.1333, priority: 1 },
      { id: 'sebastian-inlet', name: 'Sebastian Inlet State Park', lat: 27.8500, lng: -80.4500, priority: 2 },
      { id: 'devils-millhopper', name: "Devil's Millhopper Geological State Park", lat: 29.7083, lng: -82.3917, priority: 2 },
      { id: 'wakulla-springs', name: 'Edward Ball Wakulla Springs State Park', lat: 30.2333, lng: -84.3000, priority: 1 },
      { id: 'homosassa-springs', name: 'Homosassa Springs Wildlife State Park', lat: 28.8000, lng: -82.5833, priority: 2 },
      { id: 'silver-springs', name: 'Silver Springs State Park', lat: 29.2167, lng: -82.0500, priority: 1 },
      { id: 'three-rivers', name: 'Three Rivers State Park', lat: 30.7167, lng: -84.8500, priority: 3 },
      { id: 'waccasassa-bay', name: 'Waccasassa Bay Preserve State Park', lat: 29.1667, lng: -82.7833, priority: 3 },
      { id: 'crystal-river', name: 'Crystal River Preserve State Park', lat: 28.9000, lng: -82.6333, priority: 2 },
      { id: 'alafia-river', name: 'Alafia River State Park', lat: 27.8667, lng: -82.1500, priority: 2 },
      { id: 'lake-louisa', name: 'Lake Louisa State Park', lat: 28.5000, lng: -81.7333, priority: 2 },
      { id: 'ocklawaha-prairie', name: 'Ocklawaha Prairie Restoration Area', lat: 29.0000, lng: -81.8333, priority: 3 },
      { id: 'ravine-gardens', name: 'Ravine Gardens State Park', lat: 29.6333, lng: -81.6333, priority: 2 },
      { id: 'tomoka', name: 'Tomoka State Park', lat: 29.2833, lng: -81.0667, priority: 2 },
      { id: 'washington-oaks', name: 'Washington Oaks Gardens State Park', lat: 29.6167, lng: -81.2167, priority: 2 },
      { id: 'gamble-rogers', name: 'Gamble Rogers Memorial State Recreation Area', lat: 29.4667, lng: -81.1167, priority: 3 },
      { id: 'north-peninsula', name: 'North Peninsula State Park', lat: 29.3333, lng: -81.0833, priority: 3 },
      { id: 'bulow-creek', name: 'Bulow Creek State Park', lat: 29.3500, lng: -81.1333, priority: 2 },
      { id: 'de-leon-springs', name: 'De Leon Springs State Park', lat: 29.1333, lng: -81.3667, priority: 2 },
      { id: 'hontoon-island', name: 'Hontoon Island State Park', lat: 28.9833, lng: -81.3500, priority: 3 },
      { id: 'lower-wekiva', name: 'Lower Wekiva River Preserve State Park', lat: 28.8167, lng: -81.4167, priority: 2 },
      { id: 'rock-springs-run', name: 'Rock Springs Run State Reserve', lat: 28.7667, lng: -81.5000, priority: 2 },
      { id: 'tosohatchee', name: 'Tosohatchee Wildlife Management Area', lat: 28.5167, lng: -80.9333, priority: 2 },
      { id: 'little-big-econ', name: 'Little Big Econ State Forest', lat: 28.7000, lng: -81.1500, priority: 2 },
      { id: 'tiger-bay', name: 'Tiger Bay State Forest', lat: 29.2167, lng: -81.1500, priority: 3 },
      { id: 'etoniah-creek', name: 'Etoniah Creek State Forest', lat: 29.5667, lng: -81.7333, priority: 3 },
      { id: 'dunns-creek', name: "Dunns Creek State Park", lat: 29.5500, lng: -81.6167, priority: 3 },
      { id: 'camp-blanding', name: 'Camp Blanding Wildlife Management Area', lat: 29.9000, lng: -82.0000, priority: 3 },
    ],
  },
};

// ============================================================================
// TRAIL DATA TYPES
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
// HELPER FUNCTIONS
// ============================================================================

function generateGoogleMapsUrl(trailName: string, parkName: string, stateName: string): string {
  const query = `${trailName} trail ${parkName} ${stateName}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

async function fetchFromTrailAPI(lat: number, lng: number, radiusMiles: number): Promise<any[]> {
  if (!TRAILAPI_KEY) {
    console.log('  [TrailAPI] No API key - skipping');
    return [];
  }

  try {
    const url = `https://${TRAILAPI_HOST}/trails/explore/?lat=${lat}&lon=${lng}&radius=${radiusMiles}`;
    const response = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': TRAILAPI_KEY,
        'X-RapidAPI-Host': TRAILAPI_HOST,
      },
    });

    if (!response.ok) {
      console.log(`  [TrailAPI] Error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error: any) {
    console.log(`  [TrailAPI] ${error.message}`);
    return [];
  }
}

async function fetchFromRecreationGov(lat: number, lng: number, radiusMiles: number): Promise<any[]> {
  if (!RECREATION_GOV_API_KEY) {
    return [];
  }

  try {
    const url = `https://ridb.recreation.gov/api/v1/facilities?latitude=${lat}&longitude=${lng}&radius=${radiusMiles}&activity=HIKING`;
    const response = await fetch(url, {
      headers: {
        'apikey': RECREATION_GOV_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const facilities = data.RECDATA || [];
    
    // Extract trail-like facilities
    const trails: any[] = [];
    for (const facility of facilities) {
      if (facility.FacilityName && 
          (facility.FacilityName.toLowerCase().includes('trail') ||
           facility.FacilityName.toLowerCase().includes('path') ||
           facility.FacilityName.toLowerCase().includes('loop'))) {
        trails.push({
          name: facility.FacilityName,
          description: facility.FacilityDescription,
          lat: facility.FacilityLatitude,
          lon: facility.FacilityLongitude,
          source: 'recreation_gov',
        });
      }
    }
    
    if (trails.length > 0) {
      console.log(`  [Recreation.gov] Found ${trails.length} trails`);
    }
    return trails;
  } catch (error: any) {
    return [];
  }
}

async function getExistingS3Data(s3Client: S3Client, stateCode: string): Promise<StateTrailOutput | null> {
  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: `trails/state-parks/${stateCode}/trails.json`,
    }));
    const body = await response.Body?.transformToString();
    return body ? JSON.parse(body) : null;
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
      console.log(`  [S3] No existing data for ${stateCode}`);
      return null;
    }
    console.log(`  [S3] Error fetching existing data: ${error.message}`);
    return null;
  }
}

// ============================================================================
// MAIN FETCHER
// ============================================================================

async function fetchStateTrails(stateDef: StateDefinition): Promise<{ totalParks: number; totalTrails: number }> {
  console.log('============================================================');
  console.log(`${stateDef.stateName} State Parks Trail Fetcher`);
  console.log('============================================================\n');

  const s3Client = new S3Client({ region: S3_REGION });
  
  // Get existing S3 data to merge with
  console.log('Fetching existing S3 data...');
  const existingData = await getExistingS3Data(s3Client, stateDef.stateCode);
  const existingParks = existingData?.parks || {};

  const allParks: Record<string, { parkName: string; trails: Trail[] }> = {};
  let totalTrails = 0;
  let parksProcessed = 0;

  // Sort parks by priority
  const sortedParks = [...stateDef.parks].sort((a, b) => a.priority - b.priority);

  for (const park of sortedParks) {
    console.log(`\nProcessing ${park.name} (priority ${park.priority})...`);
    
    const existingParkData = existingParks[park.id];
    const existingTrails = new Map<string, Trail>();
    
    // Index existing trails by normalized name
    if (existingParkData?.trails) {
      for (const trail of existingParkData.trails) {
        existingTrails.set(trail.name.toLowerCase().trim(), trail);
      }
      console.log(`  [S3] Found ${existingParkData.trails.length} existing trails`);
    }

    // Fetch new trails from TrailAPI
    const apiTrails = await fetchFromTrailAPI(park.lat, park.lng, stateDef.trailApiRadius);
    let newTrailCount = 0;

    if (apiTrails.length > 0) {
      console.log(`  [TrailAPI] Found ${apiTrails.length} trails`);
      
      for (const apiTrail of apiTrails) {
        if (!apiTrail.name) continue;
        
        const normalizedName = apiTrail.name.toLowerCase().trim();
        
        // Skip if we already have this trail
        if (existingTrails.has(normalizedName)) {
          continue;
        }
        
        // Add new trail
        const trail: Trail = {
          id: `${stateDef.stateCode.toLowerCase()}-${park.id}-${apiTrail.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          name: apiTrail.name,
          parkId: park.id,
          parkName: park.name,
          stateCode: stateDef.stateCode,
          lengthMiles: apiTrail.length ? parseFloat(apiTrail.length) : undefined,
          difficulty: apiTrail.difficulty?.toLowerCase(),
          description: apiTrail.description,
          googleMapsUrl: generateGoogleMapsUrl(apiTrail.name, park.name, stateDef.stateName),
          trailheadCoordinates: apiTrail.lat && apiTrail.lon
            ? { latitude: apiTrail.lat, longitude: apiTrail.lon }
            : { latitude: park.lat, longitude: park.lng },
          dataSource: 'trailapi',
          lastUpdated: new Date().toISOString().split('T')[0],
        };
        
        existingTrails.set(normalizedName, trail);
        newTrailCount++;
      }
      
      if (newTrailCount > 0) {
        console.log(`  [New] Added ${newTrailCount} new trails from TrailAPI`);
      }
    }

    // Fetch from Recreation.gov as supplementary source
    const recGovTrails = await fetchFromRecreationGov(park.lat, park.lng, stateDef.trailApiRadius);
    let recGovNewCount = 0;
    
    for (const recTrail of recGovTrails) {
      if (!recTrail.name) continue;
      
      const normalizedName = recTrail.name.toLowerCase().trim();
      if (existingTrails.has(normalizedName)) continue;
      
      const trail: Trail = {
        id: `${stateDef.stateCode.toLowerCase()}-${park.id}-${recTrail.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: recTrail.name,
        parkId: park.id,
        parkName: park.name,
        stateCode: stateDef.stateCode,
        description: recTrail.description,
        googleMapsUrl: generateGoogleMapsUrl(recTrail.name, park.name, stateDef.stateName),
        trailheadCoordinates: recTrail.lat && recTrail.lon
          ? { latitude: recTrail.lat, longitude: recTrail.lon }
          : { latitude: park.lat, longitude: park.lng },
        dataSource: 'recreation_gov',
        lastUpdated: new Date().toISOString().split('T')[0],
      };
      
      existingTrails.set(normalizedName, trail);
      recGovNewCount++;
    }
    
    if (recGovNewCount > 0) {
      console.log(`  [New] Added ${recGovNewCount} new trails from Recreation.gov`);
    }

    const parkTrails = Array.from(existingTrails.values());
    
    if (parkTrails.length > 0) {
      allParks[park.id] = { parkName: park.name, trails: parkTrails };
      totalTrails += parkTrails.length;
      parksProcessed++;
      console.log(`  Total: ${parkTrails.length} trails`);
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Preserve any existing parks from S3 that weren't in our configuration
  // (e.g., "Wisconsin State Trails" added by WI DNR fetcher)
  if (existingData?.parks) {
    for (const [parkId, parkData] of Object.entries(existingData.parks)) {
      if (!allParks[parkId]) {
        allParks[parkId] = parkData;
        totalTrails += parkData.trails.length;
        parksProcessed++;
        console.log(`  Preserved ${parkData.parkName}: ${parkData.trails.length} trails (from other data sources)`);
      }
    }
  }

  // Collect sources used
  const sourcesUsed = new Set<string>();
  for (const parkData of Object.values(allParks)) {
    for (const trail of parkData.trails) {
      sourcesUsed.add(trail.dataSource);
    }
  }

  // Build output
  const output: StateTrailOutput = {
    _meta: {
      stateCode: stateDef.stateCode,
      stateName: stateDef.stateName,
      lastUpdated: new Date().toISOString(),
      totalParks: parksProcessed,
      totalTrails: totalTrails,
      sources: Array.from(sourcesUsed),
    },
    parks: allParks,
  };

  // Save locally for reference
  const outputDir = path.join(__dirname, '../sources/trails');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path.join(outputDir, `${stateDef.stateCode.toLowerCase()}-trails.json`);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nWrote local copy to: ${outputPath}`);

  // Upload to S3 (authoritative source)
  console.log('\nUploading to S3 (authoritative source)...');
  const key = `trails/state-parks/${stateDef.stateCode}/trails.json`;
  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: JSON.stringify(output, null, 2),
    ContentType: 'application/json',
  }));
  console.log(`[OK] Uploaded to s3://${S3_BUCKET}/${key}`);

  // Summary
  console.log('\n============================================================');
  console.log('Summary');
  console.log('============================================================');
  console.log(`Parks processed: ${parksProcessed}`);
  console.log(`Total trails in S3: ${totalTrails}`);
  console.log(`Park coverage: ${((parksProcessed / stateDef.estimatedParks) * 100).toFixed(1)}% of ~${stateDef.estimatedParks}`);
  console.log(`Trail coverage: ${((totalTrails / stateDef.estimatedTrails) * 100).toFixed(1)}% of ~${stateDef.estimatedTrails}`);

  return { totalParks: parksProcessed, totalTrails };
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
State Parks Trail Fetcher
=========================

Fetches trail data from TrailAPI and uploads to S3 (authoritative source).

Usage:
  npx ts-node data/scripts/fetchStateTrails.ts <state_code>
  npx ts-node data/scripts/fetchStateTrails.ts all
  npx ts-node data/scripts/fetchStateTrails.ts --list

Available States: ${Object.keys(STATE_PARKS).join(', ')}

S3 is the authoritative data source. This script:
  1. Reads existing trails from S3
  2. Fetches new trails from TrailAPI  
  3. Merges and uploads back to S3
`);
    return;
  }

  if (args.includes('--list')) {
    console.log('\nConfigured States:\n');
    for (const [code, def] of Object.entries(STATE_PARKS)) {
      console.log(`  ${code} - ${def.stateName}`);
      console.log(`      Parks: ${def.parks.length} configured`);
      console.log(`      Estimated: ${def.estimatedParks} parks, ${def.estimatedTrails} trails\n`);
    }
    return;
  }

  const stateArg = args[0].toUpperCase();

  if (stateArg === 'ALL') {
    console.log('Fetching trails for ALL states...\n');
    let grandTotal = { parks: 0, trails: 0 };
    
    for (const def of Object.values(STATE_PARKS)) {
      const { totalParks, totalTrails } = await fetchStateTrails(def);
      grandTotal.parks += totalParks;
      grandTotal.trails += totalTrails;
      console.log('\n');
    }
    
    console.log('============================================================');
    console.log('All States Complete');
    console.log(`Total: ${grandTotal.parks} parks, ${grandTotal.trails} trails in S3`);
    return;
  }

  const stateDef = STATE_PARKS[stateArg];
  if (!stateDef) {
    console.error(`Unknown state: ${stateArg}`);
    console.log(`Available: ${Object.keys(STATE_PARKS).join(', ')}`);
    process.exit(1);
  }

  await fetchStateTrails(stateDef);
}

main().catch(console.error);
