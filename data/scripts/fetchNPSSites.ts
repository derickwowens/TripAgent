/**
 * Fetch All NPS Sites
 * 
 * Fetches all National Park Service managed sites including:
 * - National Parks (63)
 * - National Monuments (~85)
 * - National Historic Sites (~80)
 * - National Memorials (~30)
 * - National Battlefields (~25)
 * - National Seashores/Lakeshores (~15)
 * - National Recreation Areas (~18)
 * - And many more...
 * 
 * Total: 400+ sites managed by NPS
 * 
 * Usage:
 *   npx tsx data/scripts/fetchNPSSites.ts
 *   npx tsx data/scripts/fetchNPSSites.ts --upload  (also uploads to S3)
 */

import 'dotenv/config';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { uploadPark, uploadJson } from '../sync/s3Client.js';
import { S3_CONFIG, STATE_NAMES } from '../sync/config.js';
import type { 
  NormalizedPark, 
  NationalParkIndex,
  ParkType,
  ParkCategory,
  USRegion,
  OfficialLink,
} from '../schema/park.schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const NPS_API_BASE = 'https://developer.nps.gov/api/v1';
const NPS_API_KEY = process.env.NPS_API_KEY;

if (!NPS_API_KEY) {
  console.error('NPS_API_KEY not set in environment');
  process.exit(1);
}

// NPS designation to our ParkType mapping
const DESIGNATION_MAP: Record<string, ParkType> = {
  'National Park': 'national_park',
  'National Monument': 'national_monument',
  'National Historic Site': 'national_historic_site',
  'National Historical Park': 'national_historical_park',
  'National Memorial': 'national_memorial',
  'National Battlefield': 'national_battlefield',
  'National Battlefield Park': 'national_battlefield',
  'National Military Park': 'national_military_park',
  'National Seashore': 'national_seashore',
  'National Lakeshore': 'national_lakeshore',
  'National Recreation Area': 'national_recreation_area',
  'National Preserve': 'national_preserve',
  'National Reserve': 'national_preserve',
  'National Scenic Trail': 'national_scenic_trail',
  'National Wild and Scenic River': 'national_wild_scenic_river',
  'National Parkway': 'national_recreation_area',
  'Park': 'national_park',
  'Other': 'national_historic_site',
};

// State code to region mapping
const STATE_REGIONS: Record<string, USRegion> = {
  // Northeast
  CT: 'northeast', DE: 'northeast', MA: 'northeast', MD: 'northeast', ME: 'northeast',
  NH: 'northeast', NJ: 'northeast', NY: 'northeast', PA: 'northeast', RI: 'northeast', VT: 'northeast',
  // Southeast
  AL: 'southeast', AR: 'southeast', FL: 'southeast', GA: 'southeast', KY: 'southeast',
  LA: 'southeast', MS: 'southeast', NC: 'southeast', SC: 'southeast', TN: 'southeast',
  VA: 'southeast', WV: 'southeast', DC: 'southeast', PR: 'southeast', VI: 'southeast',
  // Midwest
  IA: 'midwest', IL: 'midwest', IN: 'midwest', KS: 'midwest', MI: 'midwest',
  MN: 'midwest', MO: 'midwest', ND: 'midwest', NE: 'midwest', OH: 'midwest',
  SD: 'midwest', WI: 'midwest',
  // Southwest
  AZ: 'southwest', NM: 'southwest', OK: 'southwest', TX: 'southwest',
  // West
  CO: 'west', MT: 'west', UT: 'west', WY: 'west', ID: 'west', NV: 'west',
  // Pacific
  CA: 'pacific', OR: 'pacific', WA: 'pacific',
  // Alaska & Hawaii
  AK: 'alaska', HI: 'hawaii',
  // Territories
  AS: 'pacific', GU: 'pacific', MP: 'pacific',
};

interface NPSPark {
  id: string;
  url: string;
  fullName: string;
  parkCode: string;
  description: string;
  latitude: string;
  longitude: string;
  states: string;
  designation: string;
  images: Array<{
    url: string;
    title: string;
    altText: string;
    caption: string;
    credit: string;
  }>;
  contacts: {
    phoneNumbers: Array<{ phoneNumber: string; type: string }>;
    emailAddresses: Array<{ emailAddress: string }>;
  };
  entranceFees: Array<{
    cost: string;
    description: string;
    title: string;
  }>;
  operatingHours: Array<{
    description: string;
    standardHours: {
      monday: string;
      tuesday: string;
      wednesday: string;
      thursday: string;
      friday: string;
      saturday: string;
      sunday: string;
    };
  }>;
  addresses: Array<{
    type: string;
    line1: string;
    line2: string;
    city: string;
    stateCode: string;
    postalCode: string;
  }>;
  activities: Array<{ id: string; name: string }>;
  topics: Array<{ id: string; name: string }>;
  directionsUrl: string;
  weatherInfo: string;
}

async function fetchAllNPSSites(): Promise<NPSPark[]> {
  const allParks: NPSPark[] = [];
  let start = 0;
  const limit = 50;
  let total = 0;
  
  console.log('Fetching all NPS sites...\n');
  
  do {
    const url = `${NPS_API_BASE}/parks?start=${start}&limit=${limit}&api_key=${NPS_API_KEY}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      total = parseInt(data.total, 10);
      allParks.push(...data.data);
      
      console.log(`  Fetched ${allParks.length} / ${total} sites...`);
      start += limit;
      
      // Rate limiting - be nice to the API
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error: any) {
      console.error(`Error fetching parks: ${error.message}`);
      break;
    }
  } while (start < total);
  
  console.log(`\nTotal sites fetched: ${allParks.length}`);
  return allParks;
}

function mapDesignation(designation: string): ParkType {
  // Try exact match first
  if (DESIGNATION_MAP[designation]) {
    return DESIGNATION_MAP[designation];
  }
  
  // Try partial match
  for (const [key, value] of Object.entries(DESIGNATION_MAP)) {
    if (designation.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  
  return 'national_historic_site'; // Default fallback
}

function getCategory(parkType: ParkType): ParkCategory {
  if (parkType.startsWith('national_')) {
    return 'national';
  }
  if (parkType.startsWith('state_')) {
    return 'state';
  }
  return 'local';
}

function normalizeNPSSite(nps: NPSPark): NormalizedPark {
  const parkType = mapDesignation(nps.designation);
  const primaryState = nps.states.split(',')[0].trim();
  const region = STATE_REGIONS[primaryState] || 'west';
  
  // Build official links
  const officialLinks: OfficialLink[] = [];
  
  if (nps.url) {
    officialLinks.push({
      type: 'official_website',
      url: nps.url,
      isPrimary: true,
    });
  }
  
  if (nps.directionsUrl) {
    officialLinks.push({
      type: 'directions',
      url: nps.directionsUrl,
    });
  }
  
  // Find physical address
  const physicalAddress = nps.addresses.find(a => a.type === 'Physical');
  const mailingAddress = nps.addresses.find(a => a.type === 'Mailing');
  const address = physicalAddress || mailingAddress;
  
  // Get phone
  const phone = nps.contacts.phoneNumbers.find(p => p.type === 'Voice')?.phoneNumber;
  const email = nps.contacts.emailAddresses[0]?.emailAddress;
  
  // Map images
  const images = nps.images.slice(0, 10).map((img, idx) => ({
    id: `${nps.parkCode}-img-${idx}`,
    url: img.url,
    title: img.title,
    altText: img.altText,
    caption: img.caption,
    credit: img.credit,
    isPrimary: idx === 0,
  }));
  
  // Map activities
  const activities = nps.activities.map(a => ({
    id: a.id,
    name: a.name,
  }));
  
  // Map fees
  const fees = nps.entranceFees.map(f => ({
    title: f.title,
    description: f.description,
    cost: f.cost,
    type: 'entrance' as const,
  }));
  
  // Operating hours
  const hours = nps.operatingHours[0];
  const operatingHours = hours ? {
    monday: hours.standardHours.monday,
    tuesday: hours.standardHours.tuesday,
    wednesday: hours.standardHours.wednesday,
    thursday: hours.standardHours.thursday,
    friday: hours.standardHours.friday,
    saturday: hours.standardHours.saturday,
    sunday: hours.standardHours.sunday,
    description: hours.description,
  } : undefined;
  
  const park: NormalizedPark = {
    id: `np-${nps.parkCode}`,
    name: nps.fullName,
    category: getCategory(parkType),
    parkType,
    stateCode: primaryState,
    stateName: STATE_NAMES[primaryState] || primaryState,
    region,
    
    description: nps.description,
    shortDescription: nps.description.slice(0, 200) + (nps.description.length > 200 ? '...' : ''),
    designation: nps.designation,
    
    coordinates: {
      latitude: parseFloat(nps.latitude) || 0,
      longitude: parseFloat(nps.longitude) || 0,
    },
    
    nationalParkInfo: {
      parkCode: nps.parkCode,
      npsId: nps.id,
      region,
    },
    
    officialLinks,
    
    contact: {
      phone,
      email,
      website: nps.url,
      address: address ? {
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        state: address.stateCode,
        postalCode: address.postalCode,
      } : undefined,
    },
    
    operatingHours,
    fees,
    
    climate: nps.weatherInfo ? {
      weatherDescription: nps.weatherInfo,
    } : undefined,
    
    images,
    activities,
    
    quickLinks: {
      officialWebsite: nps.url,
      directions: nps.directionsUrl,
    },
    
    keywords: [
      ...nps.topics.map(t => t.name),
      nps.designation,
      primaryState,
    ],
    
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    },
  };
  
  return park;
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') throw error;
  }
}

async function main() {
  const shouldUpload = process.argv.includes('--upload');
  
  console.log('='.repeat(60));
  console.log('NPS SITES AGGREGATION');
  console.log('Fetching all National Park Service managed sites');
  console.log('='.repeat(60));
  
  // Fetch all sites from NPS API
  const npsSites = await fetchAllNPSSites();
  
  // Group by designation for statistics
  const byDesignation = new Map<string, NPSPark[]>();
  for (const site of npsSites) {
    const designation = site.designation || 'Other';
    if (!byDesignation.has(designation)) {
      byDesignation.set(designation, []);
    }
    byDesignation.get(designation)!.push(site);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('SITES BY DESIGNATION');
  console.log('='.repeat(60));
  
  const sortedDesignations = [...byDesignation.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [designation, sites] of sortedDesignations) {
    console.log(`  ${designation}: ${sites.length}`);
  }
  
  // Normalize all sites
  console.log('\n' + '='.repeat(60));
  console.log('NORMALIZING SITES');
  console.log('='.repeat(60));
  
  const normalizedParks: NormalizedPark[] = [];
  const errors: string[] = [];
  
  for (const site of npsSites) {
    try {
      const normalized = normalizeNPSSite(site);
      normalizedParks.push(normalized);
    } catch (error: any) {
      errors.push(`${site.fullName}: ${error.message}`);
    }
  }
  
  console.log(`Normalized ${normalizedParks.length} sites`);
  if (errors.length > 0) {
    console.log(`Errors: ${errors.length}`);
  }
  
  // Save to local files
  const outputDir = join(__dirname, '../../.park-data/national-parks');
  await ensureDir(join(outputDir, 'parks'));
  
  console.log('\n' + '='.repeat(60));
  console.log('SAVING TO LOCAL FILES');
  console.log('='.repeat(60));
  
  // Save individual park files
  for (const park of normalizedParks) {
    const filePath = join(outputDir, 'parks', `${park.id}.json`);
    await writeFile(filePath, JSON.stringify(park, null, 2));
  }
  console.log(`Saved ${normalizedParks.length} park files`);
  
  // Create and save national parks index
  const index: NationalParkIndex = {
    totalParks: normalizedParks.length,
    lastSynced: new Date().toISOString(),
    s3Prefix: S3_CONFIG.paths.nationalParks,
    parks: normalizedParks.map(p => ({
      id: p.id,
      name: p.name,
      parkCode: p.nationalParkInfo?.parkCode || p.id.replace('np-', ''),
      stateCode: p.stateCode,
      stateName: p.stateName,
      region: p.region || 'west',
      coordinates: p.coordinates,
      designation: p.designation || p.parkType,
      imageUrl: p.images?.[0]?.url,
      s3Key: `${S3_CONFIG.paths.nationalParks}/parks/${p.id}.json`,
    })),
  };
  
  await writeFile(join(outputDir, 'index.json'), JSON.stringify(index, null, 2));
  console.log('Saved national parks index');
  
  // Upload to S3 if requested
  if (shouldUpload) {
    console.log('\n' + '='.repeat(60));
    console.log('UPLOADING TO S3');
    console.log('='.repeat(60));
    
    let uploaded = 0;
    for (const park of normalizedParks) {
      try {
        await uploadPark(park);
        uploaded++;
        if (uploaded % 50 === 0) {
          console.log(`  Uploaded ${uploaded} / ${normalizedParks.length}...`);
        }
      } catch (error: any) {
        console.error(`  Failed to upload ${park.name}: ${error.message}`);
      }
    }
    
    // Upload index
    await uploadJson(`${S3_CONFIG.paths.nationalParks}/index.json`, index);
    console.log(`\nUploaded ${uploaded} parks and index to S3`);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total NPS Sites: ${normalizedParks.length}`);
  console.log(`Output: ${outputDir}`);
  
  // Count by category
  const byCategory = {
    parks: 0,
    monuments: 0,
    historic: 0,
    other: 0,
  };
  
  for (const park of normalizedParks) {
    if (park.parkType === 'national_park') byCategory.parks++;
    else if (park.parkType === 'national_monument') byCategory.monuments++;
    else if (park.parkType.includes('historic') || park.parkType.includes('memorial') || park.parkType.includes('battlefield')) byCategory.historic++;
    else byCategory.other++;
  }
  
  console.log(`\nBreakdown:`);
  console.log(`  National Parks: ${byCategory.parks}`);
  console.log(`  National Monuments: ${byCategory.monuments}`);
  console.log(`  Historic Sites/Memorials/Battlefields: ${byCategory.historic}`);
  console.log(`  Other (Seashores, Trails, etc.): ${byCategory.other}`);
  
  if (!shouldUpload) {
    console.log('\nTo upload to S3, run with --upload flag');
  }
  
  console.log('='.repeat(60));
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
