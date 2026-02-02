/**
 * Fetch trails from NPS API and TrailAPI, then upload to S3
 * 
 * This script:
 * 1. Fetches trails for all 63 national parks from NPS API
 * 2. Fetches trails for Wisconsin state parks from TrailAPI
 * 3. Fetches trails for Florida state parks from TrailAPI
 * 4. Merges with existing curated data
 * 5. Uploads to S3
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';

dotenv.config();

const NPS_API_KEY = process.env.NPS_API_KEY || '';
const TRAILAPI_KEY = process.env.TRAILAPI_KEY || '';
const S3_BUCKET = process.env.PARK_DATA_S3_BUCKET || 'tripagent-park-data';
const S3_REGION = process.env.AWS_REGION || 'us-east-1';

const TRAILAPI_HOST = 'trailapi-trailapi.p.rapidapi.com';

// All 63 National Parks with their codes and coordinates
const NATIONAL_PARKS = [
  { code: 'acad', name: 'Acadia National Park', state: 'Maine', lat: 44.35, lon: -68.21 },
  { code: 'arch', name: 'Arches National Park', state: 'Utah', lat: 38.73, lon: -109.59 },
  { code: 'badl', name: 'Badlands National Park', state: 'South Dakota', lat: 43.75, lon: -102.50 },
  { code: 'bibe', name: 'Big Bend National Park', state: 'Texas', lat: 29.25, lon: -103.25 },
  { code: 'bisc', name: 'Biscayne National Park', state: 'Florida', lat: 25.65, lon: -80.08 },
  { code: 'blca', name: 'Black Canyon of the Gunnison National Park', state: 'Colorado', lat: 38.57, lon: -107.72 },
  { code: 'brca', name: 'Bryce Canyon National Park', state: 'Utah', lat: 37.57, lon: -112.18 },
  { code: 'cany', name: 'Canyonlands National Park', state: 'Utah', lat: 38.20, lon: -109.93 },
  { code: 'care', name: 'Capitol Reef National Park', state: 'Utah', lat: 38.20, lon: -111.17 },
  { code: 'cave', name: 'Carlsbad Caverns National Park', state: 'New Mexico', lat: 32.17, lon: -104.44 },
  { code: 'chis', name: 'Channel Islands National Park', state: 'California', lat: 34.01, lon: -119.42 },
  { code: 'cong', name: 'Congaree National Park', state: 'South Carolina', lat: 33.78, lon: -80.78 },
  { code: 'crla', name: 'Crater Lake National Park', state: 'Oregon', lat: 42.94, lon: -122.10 },
  { code: 'cuva', name: 'Cuyahoga Valley National Park', state: 'Ohio', lat: 41.24, lon: -81.55 },
  { code: 'deva', name: 'Death Valley National Park', state: 'California', lat: 36.24, lon: -116.82 },
  { code: 'dena', name: 'Denali National Park', state: 'Alaska', lat: 63.33, lon: -150.50 },
  { code: 'drto', name: 'Dry Tortugas National Park', state: 'Florida', lat: 24.63, lon: -82.87 },
  { code: 'ever', name: 'Everglades National Park', state: 'Florida', lat: 25.29, lon: -80.90 },
  { code: 'gaar', name: 'Gates of the Arctic National Park', state: 'Alaska', lat: 67.78, lon: -153.30 },
  { code: 'jeff', name: 'Gateway Arch National Park', state: 'Missouri', lat: 38.62, lon: -90.19 },
  { code: 'glac', name: 'Glacier National Park', state: 'Montana', lat: 48.80, lon: -114.00 },
  { code: 'glba', name: 'Glacier Bay National Park', state: 'Alaska', lat: 58.50, lon: -137.00 },
  { code: 'grca', name: 'Grand Canyon National Park', state: 'Arizona', lat: 36.06, lon: -112.14 },
  { code: 'grte', name: 'Grand Teton National Park', state: 'Wyoming', lat: 43.79, lon: -110.68 },
  { code: 'grba', name: 'Great Basin National Park', state: 'Nevada', lat: 38.98, lon: -114.30 },
  { code: 'grsa', name: 'Great Sand Dunes National Park', state: 'Colorado', lat: 37.73, lon: -105.51 },
  { code: 'grsm', name: 'Great Smoky Mountains National Park', state: 'Tennessee', lat: 35.68, lon: -83.53 },
  { code: 'gumo', name: 'Guadalupe Mountains National Park', state: 'Texas', lat: 31.92, lon: -104.87 },
  { code: 'hale', name: 'Haleakala National Park', state: 'Hawaii', lat: 20.72, lon: -156.17 },
  { code: 'havo', name: 'Hawaii Volcanoes National Park', state: 'Hawaii', lat: 19.38, lon: -155.20 },
  { code: 'hosp', name: 'Hot Springs National Park', state: 'Arkansas', lat: 34.51, lon: -93.05 },
  { code: 'indu', name: 'Indiana Dunes National Park', state: 'Indiana', lat: 41.65, lon: -87.05 },
  { code: 'isro', name: 'Isle Royale National Park', state: 'Michigan', lat: 48.10, lon: -88.55 },
  { code: 'jotr', name: 'Joshua Tree National Park', state: 'California', lat: 33.79, lon: -115.90 },
  { code: 'katm', name: 'Katmai National Park', state: 'Alaska', lat: 58.50, lon: -155.00 },
  { code: 'kefj', name: 'Kenai Fjords National Park', state: 'Alaska', lat: 59.92, lon: -149.65 },
  { code: 'kova', name: 'Kobuk Valley National Park', state: 'Alaska', lat: 67.55, lon: -159.28 },
  { code: 'lacl', name: 'Lake Clark National Park', state: 'Alaska', lat: 60.97, lon: -153.42 },
  { code: 'lavo', name: 'Lassen Volcanic National Park', state: 'California', lat: 40.49, lon: -121.51 },
  { code: 'maca', name: 'Mammoth Cave National Park', state: 'Kentucky', lat: 37.18, lon: -86.10 },
  { code: 'meve', name: 'Mesa Verde National Park', state: 'Colorado', lat: 37.18, lon: -108.49 },
  { code: 'mora', name: 'Mount Rainier National Park', state: 'Washington', lat: 46.88, lon: -121.73 },
  { code: 'neri', name: 'New River Gorge National Park', state: 'West Virginia', lat: 38.07, lon: -81.08 },
  { code: 'noca', name: 'North Cascades National Park', state: 'Washington', lat: 48.77, lon: -121.21 },
  { code: 'olym', name: 'Olympic National Park', state: 'Washington', lat: 47.80, lon: -123.60 },
  { code: 'pefo', name: 'Petrified Forest National Park', state: 'Arizona', lat: 35.07, lon: -109.78 },
  { code: 'pinn', name: 'Pinnacles National Park', state: 'California', lat: 36.48, lon: -121.16 },
  { code: 'redw', name: 'Redwood National Park', state: 'California', lat: 41.21, lon: -124.00 },
  { code: 'romo', name: 'Rocky Mountain National Park', state: 'Colorado', lat: 40.34, lon: -105.68 },
  { code: 'sagu', name: 'Saguaro National Park', state: 'Arizona', lat: 32.30, lon: -111.17 },
  { code: 'seki', name: 'Sequoia and Kings Canyon National Parks', state: 'California', lat: 36.49, lon: -118.57 },
  { code: 'shen', name: 'Shenandoah National Park', state: 'Virginia', lat: 38.53, lon: -78.35 },
  { code: 'thro', name: 'Theodore Roosevelt National Park', state: 'North Dakota', lat: 46.97, lon: -103.45 },
  { code: 'viis', name: 'Virgin Islands National Park', state: 'U.S. Virgin Islands', lat: 18.33, lon: -64.73 },
  { code: 'voya', name: 'Voyageurs National Park', state: 'Minnesota', lat: 48.50, lon: -92.88 },
  { code: 'whsa', name: 'White Sands National Park', state: 'New Mexico', lat: 32.78, lon: -106.17 },
  { code: 'wica', name: 'Wind Cave National Park', state: 'South Dakota', lat: 43.57, lon: -103.48 },
  { code: 'wrst', name: 'Wrangell-St. Elias National Park', state: 'Alaska', lat: 61.00, lon: -142.00 },
  { code: 'yell', name: 'Yellowstone National Park', state: 'Wyoming', lat: 44.43, lon: -110.59 },
  { code: 'yose', name: 'Yosemite National Park', state: 'California', lat: 37.87, lon: -119.54 },
  { code: 'zion', name: 'Zion National Park', state: 'Utah', lat: 37.30, lon: -113.05 },
];

// Wisconsin state parks with coordinates
const WISCONSIN_STATE_PARKS = [
  { id: 'devils-lake', name: 'Devils Lake State Park', lat: 43.42, lon: -89.73 },
  { id: 'peninsula', name: 'Peninsula State Park', lat: 45.13, lon: -87.23 },
  { id: 'governor-dodge', name: 'Governor Dodge State Park', lat: 43.02, lon: -90.12 },
  { id: 'wyalusing', name: 'Wyalusing State Park', lat: 43.01, lon: -91.12 },
  { id: 'mirror-lake', name: 'Mirror Lake State Park', lat: 43.55, lon: -89.82 },
  { id: 'blue-mound', name: 'Blue Mound State Park', lat: 43.03, lon: -89.85 },
  { id: 'kettle-moraine-south', name: 'Kettle Moraine State Forest - Southern Unit', lat: 42.88, lon: -88.58 },
  { id: 'kettle-moraine-north', name: 'Kettle Moraine State Forest - Northern Unit', lat: 43.65, lon: -88.15 },
  { id: 'potawatomi', name: 'Potawatomi State Park', lat: 44.87, lon: -87.37 },
  { id: 'willow-river', name: 'Willow River State Park', lat: 45.02, lon: -92.65 },
];

// Florida state parks with coordinates
const FLORIDA_STATE_PARKS = [
  { id: 'myakka-river', name: 'Myakka River State Park', lat: 27.23, lon: -82.31 },
  { id: 'ocala', name: 'Ocala National Forest', lat: 29.19, lon: -81.77 },
  { id: 'paynes-prairie', name: 'Paynes Prairie Preserve State Park', lat: 29.53, lon: -82.30 },
  { id: 'ichetucknee', name: 'Ichetucknee Springs State Park', lat: 29.98, lon: -82.76 },
  { id: 'rainbow-springs', name: 'Rainbow Springs State Park', lat: 29.10, lon: -82.44 },
  { id: 'hillsborough-river', name: 'Hillsborough River State Park', lat: 28.15, lon: -82.23 },
  { id: 'jonathan-dickinson', name: 'Jonathan Dickinson State Park', lat: 27.02, lon: -80.11 },
  { id: 'torreya', name: 'Torreya State Park', lat: 30.57, lon: -84.95 },
  { id: 'big-talbot', name: 'Big Talbot Island State Park', lat: 30.46, lon: -81.43 },
  { id: 'bahia-honda', name: 'Bahia Honda State Park', lat: 24.66, lon: -81.28 },
];

interface NPSThingToDo {
  id: string;
  url: string;
  title: string;
  shortDescription: string;
  duration: string;
  tags: string[];
  images: Array<{ url: string }>;
  relatedParks: Array<{ parkCode: string; fullName: string }>;
}

// TrailAPI response is an object with numeric keys, each containing a place with activities
interface TrailAPIPlace {
  name: string;
  city: string;
  state: string;
  country: string;
  description: string;
  directions: string;
  lat: string;
  lon: string;
  activities: {
    hiking?: {
      url: string;
      length: string;
      description: string;
      name: string;
      rating: string;
      thumbnail: string;
    };
  };
}

// Rate limiting helper
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch trails from NPS API for a park
async function fetchNPSTrails(parkCode: string): Promise<any[]> {
  if (!NPS_API_KEY) {
    console.log('[NPS] API key not configured');
    return [];
  }

  try {
    const url = `https://developer.nps.gov/api/v1/thingstodo?parkCode=${parkCode}&limit=50&api_key=${NPS_API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`[NPS] Error for ${parkCode}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const items = data.data as NPSThingToDo[];
    
    // Filter for hiking-related activities
    const hikingKeywords = ['hike', 'hiking', 'trail', 'walk', 'trek', 'backpack'];
    const trails = items.filter(item => {
      const searchText = `${item.title} ${item.shortDescription} ${item.tags?.join(' ') || ''}`.toLowerCase();
      return hikingKeywords.some(kw => searchText.includes(kw));
    });

    return trails.map(t => ({
      name: t.title,
      description: t.shortDescription,
      duration: t.duration,
      npsUrl: t.url,
      imageUrl: t.images?.[0]?.url,
      source: 'NPS API',
    }));
  } catch (error) {
    console.error(`[NPS] Error fetching ${parkCode}:`, error);
    return [];
  }
}

// Fetch trails from TrailAPI near coordinates using the /activity/ endpoint (legacy but works)
async function fetchTrailAPITrails(lat: number, lon: number, radius: number = 25): Promise<any[]> {
  if (!TRAILAPI_KEY) {
    console.log('[TrailAPI] API key not configured');
    return [];
  }

  try {
    // Use /activity/ endpoint which returns hiking trails
    const url = `https://${TRAILAPI_HOST}/activity/?lat=${lat}&lon=${lon}&radius=${radius}&limit=50&q-activities_activity_type_name_eq=hiking`;
    const response = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': TRAILAPI_KEY,
        'X-RapidAPI-Host': TRAILAPI_HOST,
      },
    });
    
    if (!response.ok) {
      console.error(`[TrailAPI] Error: ${response.status}`);
      return [];
    }

    const data = await response.json() as Record<string, TrailAPIPlace>;
    
    // Response is an object with numeric keys, not an array
    const trails: any[] = [];
    for (const [id, place] of Object.entries(data)) {
      if (place.activities?.hiking) {
        const hiking = place.activities.hiking;
        trails.push({
          name: hiking.name || place.name,
          description: hiking.description || place.description,
          length: hiking.length ? `${hiking.length} mi` : undefined,
          trailUrl: hiking.url,
          rating: parseFloat(hiking.rating) || undefined,
          thumbnail: hiking.thumbnail,
          city: place.city,
          state: place.state,
          coordinates: { lat: parseFloat(place.lat), lon: parseFloat(place.lon) },
          source: 'TrailAPI',
        });
      }
    }

    return trails;
  } catch (error) {
    console.error(`[TrailAPI] Error:`, error);
    return [];
  }
}

async function main() {
  console.log('============================================================');
  console.log('Fetching Trail Data from APIs');
  console.log('============================================================\n');

  const allData: any = {
    _meta: {
      description: 'Trail data from NPS API and TrailAPI',
      lastUpdated: new Date().toISOString().split('T')[0],
      sources: ['NPS API', 'TrailAPI'],
    },
    nationalParks: {},
    stateParks: {
      WI: {},
      FL: {},
    },
  };

  // Fetch National Park trails from NPS API
  console.log('Fetching National Park trails from NPS API...');
  let npsTrailCount = 0;
  
  for (const park of NATIONAL_PARKS) {
    process.stdout.write(`  ${park.code}: `);
    const trails = await fetchNPSTrails(park.code);
    
    if (trails.length > 0) {
      allData.nationalParks[park.code] = {
        parkName: park.name,
        state: park.state,
        coordinates: { lat: park.lat, lon: park.lon },
        trails: trails,
      };
      npsTrailCount += trails.length;
      console.log(`${trails.length} trails`);
    } else {
      console.log('0 trails');
    }
    
    // Rate limit: 1000 requests/hour = ~1 per 3.6 seconds, be safe with 500ms
    await delay(500);
  }
  
  console.log(`\nNPS API: ${Object.keys(allData.nationalParks).length} parks, ${npsTrailCount} trails\n`);

  // Fetch Wisconsin state park trails from TrailAPI
  console.log('Fetching Wisconsin state park trails from TrailAPI...');
  let wiTrailCount = 0;
  
  for (const park of WISCONSIN_STATE_PARKS) {
    process.stdout.write(`  ${park.id}: `);
    const trails = await fetchTrailAPITrails(park.lat, park.lon, 10);
    
    if (trails.length > 0) {
      allData.stateParks.WI[park.id] = {
        parkName: park.name,
        coordinates: { lat: park.lat, lon: park.lon },
        trails: trails,
      };
      wiTrailCount += trails.length;
      console.log(`${trails.length} trails`);
    } else {
      console.log('0 trails');
    }
    
    await delay(1000); // TrailAPI rate limit
  }
  
  console.log(`\nWisconsin: ${Object.keys(allData.stateParks.WI).length} parks, ${wiTrailCount} trails\n`);

  // Fetch Florida state park trails from TrailAPI
  console.log('Fetching Florida state park trails from TrailAPI...');
  let flTrailCount = 0;
  
  for (const park of FLORIDA_STATE_PARKS) {
    process.stdout.write(`  ${park.id}: `);
    const trails = await fetchTrailAPITrails(park.lat, park.lon, 10);
    
    if (trails.length > 0) {
      allData.stateParks.FL[park.id] = {
        parkName: park.name,
        coordinates: { lat: park.lat, lon: park.lon },
        trails: trails,
      };
      flTrailCount += trails.length;
      console.log(`${trails.length} trails`);
    } else {
      console.log('0 trails');
    }
    
    await delay(1000);
  }
  
  console.log(`\nFlorida: ${Object.keys(allData.stateParks.FL).length} parks, ${flTrailCount} trails\n`);

  // Update metadata
  allData._meta.coverage = {
    nationalParks: Object.keys(allData.nationalParks).length,
    nationalParkTrails: npsTrailCount,
    stateParks: {
      WI: { parks: Object.keys(allData.stateParks.WI).length, trails: wiTrailCount },
      FL: { parks: Object.keys(allData.stateParks.FL).length, trails: flTrailCount },
    },
  };

  // Upload to S3
  console.log('Uploading to S3...');
  
  const s3Client = new S3Client({ region: S3_REGION });
  const jsonData = JSON.stringify(allData, null, 2);
  
  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: 'trails/api-trails.json',
    Body: jsonData,
    ContentType: 'application/json',
  }));
  
  console.log(`[OK] Uploaded to s3://${S3_BUCKET}/trails/api-trails.json`);
  
  console.log('\n============================================================');
  console.log('Summary');
  console.log('============================================================');
  console.log(`National Parks: ${Object.keys(allData.nationalParks).length} parks, ${npsTrailCount} trails`);
  console.log(`Wisconsin State Parks: ${Object.keys(allData.stateParks.WI).length} parks, ${wiTrailCount} trails`);
  console.log(`Florida State Parks: ${Object.keys(allData.stateParks.FL).length} parks, ${flTrailCount} trails`);
  console.log(`\nTotal: ${npsTrailCount + wiTrailCount + flTrailCount} trails`);
}

main().catch(console.error);
