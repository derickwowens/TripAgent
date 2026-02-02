/**
 * Florida DEP Trail Data Fetcher
 * 
 * Fetches trail data from the Florida Department of Environmental Protection
 * Greenways and Trails System and merges with existing S3 trail data.
 * 
 * Data source: https://services1.arcgis.com/nRHtyn3uE1kyzoYc/ArcGIS/rest/services/
 *              2025_FWP_Florida_Greenways_and_Trails_System___Land_Trail_Priorities
 * 
 * Usage:
 *   npx ts-node data/scripts/fetchFLDEPTrails.ts
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

// Florida DEP ArcGIS REST API endpoint for Greenways and Trails
const FL_DEP_TRAILS_URL = 'https://services1.arcgis.com/nRHtyn3uE1kyzoYc/ArcGIS/rest/services/2025_FWP_Florida_Greenways_and_Trails_System___Land_Trail_Priorities/FeatureServer/0/query';

// Florida state parks with their approximate coordinates for matching
const FL_STATE_PARKS: Record<string, { name: string; lat: number; lng: number }> = {
  'myakka-river': { name: 'Myakka River State Park', lat: 27.2333, lng: -82.3167 },
  'jonathan-dickinson': { name: 'Jonathan Dickinson State Park', lat: 27.0167, lng: -80.1167 },
  'paynes-prairie': { name: 'Paynes Prairie Preserve State Park', lat: 29.5333, lng: -82.3000 },
  'wekiwa-springs': { name: 'Wekiwa Springs State Park', lat: 28.7167, lng: -81.4667 },
  'blue-spring': { name: 'Blue Spring State Park', lat: 28.9500, lng: -81.3333 },
  'ocala': { name: 'Ocala National Forest Trails', lat: 29.1833, lng: -81.6667 },
  'bahia-honda': { name: 'Bahia Honda State Park', lat: 24.6667, lng: -81.2833 },
  'ichetucknee': { name: 'Ichetucknee Springs State Park', lat: 29.9833, lng: -82.7667 },
  'rainbow-springs': { name: 'Rainbow Springs State Park', lat: 29.1000, lng: -82.4333 },
  'hillsborough-river': { name: 'Hillsborough River State Park', lat: 28.1500, lng: -82.2333 },
  'big-talbot': { name: 'Big Talbot Island State Park', lat: 30.4667, lng: -81.4333 },
  'st-andrews': { name: 'St. Andrews State Park', lat: 30.1333, lng: -85.7333 },
  'grayton-beach': { name: 'Grayton Beach State Park', lat: 30.3333, lng: -86.1667 },
  'torreya': { name: 'Torreya State Park', lat: 30.5667, lng: -84.9500 },
  'anastasia': { name: 'Anastasia State Park', lat: 29.8667, lng: -81.2667 },
  'john-pennekamp': { name: 'John Pennekamp Coral Reef State Park', lat: 25.1333, lng: -80.4000 },
  'caladesi-island': { name: 'Caladesi Island State Park', lat: 28.0333, lng: -82.8167 },
  'honeymoon-island': { name: 'Honeymoon Island State Park', lat: 28.0667, lng: -82.8333 },
  'highlands-hammock': { name: 'Highlands Hammock State Park', lat: 27.4667, lng: -81.5333 },
  'oscar-scherer': { name: 'Oscar Scherer State Park', lat: 27.1833, lng: -82.4500 },
  'little-talbot': { name: 'Little Talbot Island State Park', lat: 30.4500, lng: -81.4167 },
  'suwannee-river': { name: 'Suwannee River State Park', lat: 30.3833, lng: -83.1667 },
  'manatee-springs': { name: 'Manatee Springs State Park', lat: 29.4833, lng: -82.9667 },
  'fort-clinch': { name: 'Fort Clinch State Park', lat: 30.7000, lng: -81.4333 },
  'fakahatchee': { name: 'Fakahatchee Strand Preserve State Park', lat: 25.9667, lng: -81.3833 },
  'oleta-river': { name: 'Oleta River State Park', lat: 25.9167, lng: -80.1333 },
  'sebastian-inlet': { name: 'Sebastian Inlet State Park', lat: 27.8500, lng: -80.4500 },
  'devils-millhopper': { name: "Devil's Millhopper Geological State Park", lat: 29.7083, lng: -82.3917 },
  'wakulla-springs': { name: 'Edward Ball Wakulla Springs State Park', lat: 30.2333, lng: -84.3000 },
  'homosassa-springs': { name: 'Homosassa Springs Wildlife State Park', lat: 28.8000, lng: -82.5833 },
  'silver-springs': { name: 'Silver Springs State Park', lat: 29.2167, lng: -82.0500 },
  'crystal-river': { name: 'Crystal River Preserve State Park', lat: 28.9000, lng: -82.6333 },
  'alafia-river': { name: 'Alafia River State Park', lat: 27.8667, lng: -82.1500 },
  'lake-louisa': { name: 'Lake Louisa State Park', lat: 28.5000, lng: -81.7333 },
  'ravine-gardens': { name: 'Ravine Gardens State Park', lat: 29.6333, lng: -81.6333 },
  'tomoka': { name: 'Tomoka State Park', lat: 29.2833, lng: -81.0667 },
  'washington-oaks': { name: 'Washington Oaks Gardens State Park', lat: 29.6167, lng: -81.2167 },
  'bulow-creek': { name: 'Bulow Creek State Park', lat: 29.3500, lng: -81.1333 },
  'de-leon-springs': { name: 'De Leon Springs State Park', lat: 29.1333, lng: -81.3667 },
  'lower-wekiva': { name: 'Lower Wekiva River Preserve State Park', lat: 28.8167, lng: -81.4167 },
  'rock-springs-run': { name: 'Rock Springs Run State Reserve', lat: 28.7667, lng: -81.5000 },
  'tosohatchee': { name: 'Tosohatchee Wildlife Management Area', lat: 28.5167, lng: -80.9333 },
  'little-big-econ': { name: 'Little Big Econ State Forest', lat: 28.7000, lng: -81.1500 },
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
  county?: string;
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

function generateGoogleMapsUrl(trailName: string, county: string): string {
  const query = `${trailName} trail ${county} County Florida`;
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
  
  for (const [parkId, park] of Object.entries(FL_STATE_PARKS)) {
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
  
  for (const [parkId, park] of Object.entries(FL_STATE_PARKS)) {
    const distance = haversineDistance(lat, lng, park.lat, park.lng);
    if (distance <= radiusMiles) {
      nearby.push({ parkId, parkName: park.name, distanceMiles: Math.round(distance * 10) / 10 });
    }
  }
  
  // Sort by distance
  return nearby.sort((a, b) => a.distanceMiles - b.distanceMiles);
}

async function fetchFLDEPTrails(): Promise<any[]> {
  console.log('Fetching trails from Florida DEP Greenways and Trails System...');
  
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
    
    const url = `${FL_DEP_TRAILS_URL}?${params}`;
    
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
      console.error(`Error fetching FL DEP data: ${error.message}`);
      break;
    }
  }
  
  console.log(`Total FL DEP trail segments fetched: ${allTrails.length}`);
  return allTrails;
}

async function getExistingS3Data(s3Client: S3Client): Promise<StateTrailOutput | null> {
  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: 'trails/state-parks/FL/trails.json',
    }));
    const body = await response.Body?.transformToString();
    return body ? JSON.parse(body) : null;
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
      console.log('No existing FL data in S3');
      return null;
    }
    console.error(`Error fetching S3 data: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('============================================================');
  console.log('Florida DEP Trail Data Fetcher');
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
  
  // Fetch FL DEP data
  const depTrails = await fetchFLDEPTrails();
  
  // Process and match trails to parks
  console.log('\nProcessing and matching trails to state parks...');
  
  const trailsByPark = new Map<string, Trail[]>();
  let matchedCount = 0;
  let stateTrailCount = 0;
  
  // Group DEP segments by corridor/segment name to consolidate
  const trailSegmentGroups = new Map<string, any[]>();
  
  for (const feature of depTrails) {
    const attrs = feature.attributes;
    // FL DEP uses CORRIDOR and SEGMENT_NA for trail names
    const trailName = attrs.SEGMENT_NA || attrs.CORRIDOR || `Trail_${attrs.FID}`;
    
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
    let county: string | undefined;
    let corridor: string | undefined;
    
    for (const segment of segments) {
      const attrs = segment.attributes;
      
      // Accumulate length
      if (attrs.GIS_MILES) {
        totalLength += parseFloat(attrs.GIS_MILES);
      }
      
      // Get county and corridor from first segment that has them
      if (!county && attrs.COUNTY) {
        county = attrs.COUNTY;
      }
      if (!corridor && attrs.CORRIDOR) {
        corridor = attrs.CORRIDOR;
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
      continue;
    }
    
    // Find nearest state park (within 15 miles)
    const nearestPark = findNearestPark(centroidLat, centroidLng);
    
    // Find all nearby parks within 50 miles for the nearbyParks field
    const nearbyParks = findNearbyParks(centroidLat, centroidLng, 50);
    
    const displayName = segments[0].attributes.SEGMENT_NA || segments[0].attributes.CORRIDOR || `Trail_${segments[0].attributes.FID}`;
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
      // Orphan trail - assign to "Florida State Trails"
      targetParkId = 'fl-state-trails';
      targetParkName = 'Florida State Trails';
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
      id: `fl-${targetParkId}-${displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: displayName,
      parkId: targetParkId,
      parkName: targetParkName,
      stateCode: 'FL',
      lengthMiles: totalLength > 0 ? Math.round(totalLength * 100) / 100 : undefined,
      county: county,
      description: corridor ? `Part of ${corridor}` : undefined,
      googleMapsUrl: generateGoogleMapsUrl(displayName, county || 'Florida'),
      trailheadCoordinates: { latitude: centroidLat, longitude: centroidLng },
      nearbyParks: nearbyParks.length > 0 ? nearbyParks : undefined,
      dataSource: 'fl_dep',
      lastUpdated: new Date().toISOString().split('T')[0],
    };
    
    if (!trailsByPark.has(targetParkId)) {
      trailsByPark.set(targetParkId, []);
    }
    trailsByPark.get(targetParkId)!.push(trail);
  }
  
  console.log(`Matched ${matchedCount} trails to specific state parks`);
  console.log(`Added ${stateTrailCount} trails to Florida State Trails (longer multi-use trails)`);
  
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
    
    // Add new DEP trails for this park
    const depTrailsForPark = trailsByPark.get(parkId) || [];
    let newCount = 0;
    
    for (const trail of depTrailsForPark) {
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
    
    // Handle special "Florida State Trails" category
    if (parkId === 'fl-state-trails') {
      allParks[parkId] = { parkName: 'Florida State Trails', trails };
      totalTrails += trails.length;
      console.log(`  Florida State Trails: ${trails.length} trails (multi-use state trails)`);
      continue;
    }
    
    const parkInfo = FL_STATE_PARKS[parkId];
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
      stateCode: 'FL',
      stateName: 'Florida',
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
  const outputPath = path.join(outputDir, 'fl-trails.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nWrote local copy to: ${outputPath}`);
  
  // Upload to S3
  console.log('\nUploading to S3...');
  const key = 'trails/state-parks/FL/trails.json';
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
