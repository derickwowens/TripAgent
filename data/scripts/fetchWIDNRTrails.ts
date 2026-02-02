/**
 * Wisconsin DNR Trail Data Fetcher
 * 
 * Fetches trail data from the Wisconsin DNR Open Data Portal (ArcGIS)
 * and merges with existing S3 trail data.
 * 
 * Data source: https://data-wi-dnr.opendata.arcgis.com/datasets/wi-dnr::state-trail-segments
 * 
 * Usage:
 *   npx ts-node data/scripts/fetchWIDNRTrails.ts
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

// WI DNR ArcGIS REST API endpoint for State Trails
const WI_DNR_TRAILS_URL = 'https://dnrmaps.wi.gov/arcgis/rest/services/PR_TRAILS/PR_STATE_TRAIL_DISS_WTM_Ext/MapServer/0/query';

// Wisconsin state parks with their approximate coordinates for matching
const WI_STATE_PARKS: Record<string, { name: string; lat: number; lng: number }> = {
  'devils-lake': { name: "Devil's Lake State Park", lat: 43.4167, lng: -89.7333 },
  'peninsula': { name: 'Peninsula State Park', lat: 45.1833, lng: -87.2333 },
  'governor-dodge': { name: 'Governor Dodge State Park', lat: 43.0167, lng: -90.1167 },
  'kettle-moraine-south': { name: 'Kettle Moraine State Forest - Southern Unit', lat: 42.8833, lng: -88.5833 },
  'kettle-moraine-north': { name: 'Kettle Moraine State Forest - Northern Unit', lat: 43.5333, lng: -88.1833 },
  'kohler-andrae': { name: 'Kohler-Andrae State Park', lat: 43.6667, lng: -87.7167 },
  'mirror-lake': { name: 'Mirror Lake State Park', lat: 43.5667, lng: -89.8167 },
  'wyalusing': { name: 'Wyalusing State Park', lat: 43.0167, lng: -91.1167 },
  'blue-mound': { name: 'Blue Mound State Park', lat: 43.0333, lng: -89.8333 },
  'copper-falls': { name: 'Copper Falls State Park', lat: 46.3667, lng: -90.6333 },
  'amnicon-falls': { name: 'Amnicon Falls State Park', lat: 46.6167, lng: -91.8833 },
  'interstate': { name: 'Interstate State Park', lat: 45.4000, lng: -92.6500 },
  'potawatomi': { name: 'Potawatomi State Park', lat: 44.8667, lng: -87.3833 },
  'willow-river': { name: 'Willow River State Park', lat: 45.0167, lng: -92.6333 },
  'pattison': { name: 'Pattison State Park', lat: 46.5333, lng: -92.1167 },
  'rib-mountain': { name: 'Rib Mountain State Park', lat: 44.9167, lng: -89.6833 },
  'rock-island': { name: 'Rock Island State Park', lat: 45.4167, lng: -86.8167 },
  'big-bay': { name: 'Big Bay State Park', lat: 46.7833, lng: -90.6667 },
  'hartman-creek': { name: 'Hartman Creek State Park', lat: 44.3333, lng: -89.2167 },
  'brunet-island': { name: 'Brunet Island State Park', lat: 45.1667, lng: -91.1333 },
  'lake-kegonsa': { name: 'Lake Kegonsa State Park', lat: 42.9667, lng: -89.2333 },
  'perrot': { name: 'Perrot State Park', lat: 44.0333, lng: -91.4667 },
  'tower-hill': { name: 'Tower Hill State Park', lat: 43.0833, lng: -90.0667 },
  'wildcat-mountain': { name: 'Wildcat Mountain State Park', lat: 43.7167, lng: -90.5667 },
  'nelson-dewey': { name: 'Nelson Dewey State Park', lat: 42.7167, lng: -90.9500 },
};

interface Trail {
  id: string;
  name: string;
  parkId: string;
  parkName: string;
  stateCode: string;
  lengthMiles?: number;
  difficulty?: string;
  trailType?: string;
  surfaceType?: string;
  description?: string;
  officialUrl?: string;
  googleMapsUrl: string;
  trailheadCoordinates?: { latitude: number; longitude: number };
  nearbyParks?: { parkId: string; parkName: string; distanceMiles: number }[];
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

function generateGoogleMapsUrl(trailName: string, parkName: string): string {
  const query = `${trailName} trail ${parkName} Wisconsin`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function findNearestPark(lat: number, lng: number): { parkId: string; parkName: string; distance: number } | null {
  let nearest: { parkId: string; parkName: string; distance: number } | null = null;
  
  for (const [parkId, park] of Object.entries(WI_STATE_PARKS)) {
    const distance = haversineDistance(lat, lng, park.lat, park.lng);
    if (!nearest || distance < nearest.distance) {
      nearest = { parkId, parkName: park.name, distance };
    }
  }
  
  // Only match if within 15 miles of a park
  return nearest && nearest.distance <= 15 ? nearest : null;
}

function findNearbyParks(lat: number, lng: number, radiusMiles: number = 50): { parkId: string; parkName: string; distanceMiles: number }[] {
  const nearby: { parkId: string; parkName: string; distanceMiles: number }[] = [];
  
  for (const [parkId, park] of Object.entries(WI_STATE_PARKS)) {
    const distance = haversineDistance(lat, lng, park.lat, park.lng);
    if (distance <= radiusMiles) {
      nearby.push({ parkId, parkName: park.name, distanceMiles: Math.round(distance * 10) / 10 });
    }
  }
  
  // Sort by distance
  return nearby.sort((a, b) => a.distanceMiles - b.distanceMiles);
}

async function fetchWIDNRTrails(): Promise<any[]> {
  console.log('Fetching trails from WI DNR Open Data Portal...');
  
  const allTrails: any[] = [];
  let offset = 0;
  const pageSize = 1000;
  
  while (true) {
    const params = new URLSearchParams({
      where: '1=1',
      outFields: '*',
      outSR: '4326', // Request WGS84 coordinates
      f: 'json',
      resultOffset: offset.toString(),
      resultRecordCount: pageSize.toString(),
    });
    
    const url = `${WI_DNR_TRAILS_URL}?${params}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Error fetching page at offset ${offset}: ${response.status}`);
        break;
      }
      
      const data = await response.json();
      const features = data.features || [];
      
      if (features.length === 0) {
        break;
      }
      
      allTrails.push(...features);
      console.log(`  Fetched ${features.length} records (total: ${allTrails.length})`);
      
      if (features.length < pageSize) {
        break;
      }
      
      offset += pageSize;
    } catch (error: any) {
      console.error(`Error fetching WI DNR data: ${error.message}`);
      break;
    }
  }
  
  console.log(`Total WI DNR trail segments fetched: ${allTrails.length}`);
  return allTrails;
}

async function getExistingS3Data(s3Client: S3Client): Promise<StateTrailOutput | null> {
  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: 'trails/state-parks/WI/trails.json',
    }));
    const body = await response.Body?.transformToString();
    return body ? JSON.parse(body) : null;
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
      console.log('No existing WI data in S3');
      return null;
    }
    console.error(`Error fetching S3 data: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('============================================================');
  console.log('Wisconsin DNR Trail Data Fetcher');
  console.log('============================================================\n');

  const s3Client = new S3Client({ region: S3_REGION });
  
  // Get existing S3 data
  console.log('Fetching existing S3 data...');
  const existingData = await getExistingS3Data(s3Client);
  const existingParks = existingData?.parks || {};
  
  // Build map of existing trails by normalized name per park
  const existingTrailsByPark = new Map<string, Map<string, Trail>>();
  for (const [parkId, parkData] of Object.entries(existingParks)) {
    const trailMap = new Map<string, Trail>();
    for (const trail of parkData.trails) {
      trailMap.set(trail.name.toLowerCase().trim(), trail);
    }
    existingTrailsByPark.set(parkId, trailMap);
  }
  
  // Fetch WI DNR data
  const dnrTrails = await fetchWIDNRTrails();
  
  // Process and match trails to parks
  console.log('\nProcessing and matching trails to state parks...');
  
  const trailsByPark = new Map<string, Trail[]>();
  let matchedCount = 0;
  let unmatchedCount = 0;
  let stateTrailCount = 0;
  
  // Group DNR segments by trail name to consolidate
  const trailSegmentGroups = new Map<string, any[]>();
  
  for (const feature of dnrTrails) {
    const attrs = feature.attributes;
    // WI DNR uses PROP_NAME for trail name
    const trailName = attrs.PROP_NAME || attrs.TRAIL_NAME || attrs.NAME || `Trail_${attrs.OBJECTID}`;
    
    if (!trailName) continue;
    
    const normalizedName = trailName.toLowerCase().trim();
    if (!trailSegmentGroups.has(normalizedName)) {
      trailSegmentGroups.set(normalizedName, []);
    }
    trailSegmentGroups.get(normalizedName)!.push(feature);
  }
  
  console.log(`Found ${trailSegmentGroups.size} unique trail names`);
  
  for (const [trailName, segments] of trailSegmentGroups) {
    // Get centroid from first segment with geometry
    let centroidLat: number | null = null;
    let centroidLng: number | null = null;
    let totalLength = 0;
    let surfaceType: string | undefined;
    let trailType: string | undefined;
    let officialUrl: string | undefined;
    
    for (const segment of segments) {
      const attrs = segment.attributes;
      
      // Accumulate length from SHAPE.LEN (in meters) or other length fields
      if (attrs['SHAPE.LEN']) {
        totalLength += parseFloat(attrs['SHAPE.LEN']) / 1609.34; // meters to miles
      } else if (attrs.MILES) {
        totalLength += parseFloat(attrs.MILES);
      } else if (attrs.LENGTH_MI) {
        totalLength += parseFloat(attrs.LENGTH_MI);
      }
      
      // Get surface and trail type from first segment that has them
      if (!surfaceType && attrs.SURFACE) {
        surfaceType = attrs.SURFACE;
      }
      if (!trailType && attrs.TRAIL_TYPE) {
        trailType = attrs.TRAIL_TYPE;
      }
      if (!officialUrl && attrs.PRIMARY_URL) {
        officialUrl = attrs.PRIMARY_URL;
      }
      
      // Get coordinates from geometry
      if (!centroidLat && segment.geometry) {
        if (segment.geometry.paths && segment.geometry.paths[0]) {
          const path = segment.geometry.paths[0];
          const midIdx = Math.floor(path.length / 2);
          centroidLng = path[midIdx][0];
          centroidLat = path[midIdx][1];
        } else if (segment.geometry.x && segment.geometry.y) {
          centroidLng = segment.geometry.x;
          centroidLat = segment.geometry.y;
        }
      }
    }
    
    if (!centroidLat || !centroidLng) {
      unmatchedCount++;
      continue;
    }
    
    // Find nearest state park (within 15 miles)
    const nearestPark = findNearestPark(centroidLat, centroidLng);
    
    // Find all nearby parks within 50 miles for the nearbyParks field
    const nearbyParks = findNearbyParks(centroidLat, centroidLng, 50);
    
    const displayName = segments[0].attributes.PROP_NAME || segments[0].attributes.TRAIL_NAME || segments[0].attributes.NAME || `Trail_${segments[0].attributes.OBJECTID}`;
    const normalizedDisplayName = displayName.toLowerCase().trim();
    
    // Determine which "park" this trail belongs to
    let targetParkId: string;
    let targetParkName: string;
    
    if (nearestPark) {
      // Trail is within 15 miles of a specific park
      targetParkId = nearestPark.parkId;
      targetParkName = nearestPark.parkName;
      matchedCount++;
    } else {
      // Orphan trail - assign to "Wisconsin State Trails"
      targetParkId = 'wi-state-trails';
      targetParkName = 'Wisconsin State Trails';
      stateTrailCount++;
    }
    
    // Check if we already have this trail
    const existingParkTrails = existingTrailsByPark.get(targetParkId);
    
    if (existingParkTrails?.has(normalizedDisplayName)) {
      // Trail exists, preserve it but update nearbyParks
      const existingTrail = existingParkTrails.get(normalizedDisplayName)!;
      existingTrail.nearbyParks = nearbyParks.length > 0 ? nearbyParks : undefined;
      if (!trailsByPark.has(targetParkId)) {
        trailsByPark.set(targetParkId, []);
      }
      trailsByPark.get(targetParkId)!.push(existingTrail);
      continue;
    }
    
    // Create new trail
    const trail: Trail = {
      id: `wi-${targetParkId}-${displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: displayName,
      parkId: targetParkId,
      parkName: targetParkName,
      stateCode: 'WI',
      lengthMiles: totalLength > 0 ? Math.round(totalLength * 100) / 100 : undefined,
      surfaceType: surfaceType,
      trailType: trailType,
      officialUrl: officialUrl,
      googleMapsUrl: generateGoogleMapsUrl(displayName, targetParkName),
      trailheadCoordinates: { latitude: centroidLat, longitude: centroidLng },
      nearbyParks: nearbyParks.length > 0 ? nearbyParks : undefined,
      dataSource: 'wi_dnr',
      lastUpdated: new Date().toISOString().split('T')[0],
    };
    
    if (!trailsByPark.has(targetParkId)) {
      trailsByPark.set(targetParkId, []);
    }
    trailsByPark.get(targetParkId)!.push(trail);
  }
  
  console.log(`Matched ${matchedCount} trails to specific state parks`);
  console.log(`Added ${stateTrailCount} trails to Wisconsin State Trails (longer multi-use trails)`);
  
  // Merge with existing data
  console.log('\nMerging with existing S3 data...');
  
  const allParks: Record<string, { parkName: string; trails: Trail[] }> = {};
  let totalTrails = 0;
  
  // First, add all existing parks/trails
  for (const [parkId, parkData] of Object.entries(existingParks)) {
    const existingTrails = new Map<string, Trail>();
    for (const trail of parkData.trails) {
      existingTrails.set(trail.name.toLowerCase().trim(), trail);
    }
    
    // Add new DNR trails for this park
    const dnrTrails = trailsByPark.get(parkId) || [];
    let newCount = 0;
    
    for (const trail of dnrTrails) {
      const normalizedName = trail.name.toLowerCase().trim();
      if (!existingTrails.has(normalizedName)) {
        existingTrails.set(normalizedName, trail);
        newCount++;
      }
    }
    
    const trails = Array.from(existingTrails.values());
    allParks[parkId] = { parkName: parkData.parkName, trails };
    totalTrails += trails.length;
    
    if (newCount > 0) {
      console.log(`  ${parkData.parkName}: +${newCount} new trails (total: ${trails.length})`);
    }
  }
  
  // Add any parks that weren't in existing data
  for (const [parkId, trails] of trailsByPark) {
    if (allParks[parkId]) continue;
    
    // Handle special "Wisconsin State Trails" category
    if (parkId === 'wi-state-trails') {
      allParks[parkId] = { parkName: 'Wisconsin State Trails', trails };
      totalTrails += trails.length;
      console.log(`  Wisconsin State Trails: ${trails.length} trails (multi-use state trails)`);
      continue;
    }
    
    const parkInfo = WI_STATE_PARKS[parkId];
    if (!parkInfo) continue;
    
    allParks[parkId] = { parkName: parkInfo.name, trails };
    totalTrails += trails.length;
    console.log(`  ${parkInfo.name}: ${trails.length} trails (new park)`);
  }
  
  // Collect sources
  const sourcesUsed = new Set<string>();
  for (const parkData of Object.values(allParks)) {
    for (const trail of parkData.trails) {
      sourcesUsed.add(trail.dataSource);
    }
  }
  
  // Build output
  const output: StateTrailOutput = {
    _meta: {
      stateCode: 'WI',
      stateName: 'Wisconsin',
      lastUpdated: new Date().toISOString(),
      totalParks: Object.keys(allParks).length,
      totalTrails: totalTrails,
      sources: Array.from(sourcesUsed),
    },
    parks: allParks,
  };
  
  // Save locally
  const outputDir = path.join(__dirname, '../sources/trails');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path.join(outputDir, 'wi-trails.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nWrote local copy to: ${outputPath}`);
  
  // Upload to S3
  console.log('\nUploading to S3...');
  const key = 'trails/state-parks/WI/trails.json';
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
  console.log(`Parks with trails: ${output._meta.totalParks}`);
  console.log(`Total trails: ${output._meta.totalTrails}`);
  console.log(`Data sources: ${output._meta.sources.join(', ')}`);
}

main().catch(console.error);
