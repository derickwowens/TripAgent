/**
 * Campground Fetcher
 * 
 * Fetches campground data from Recreation.gov RIDB API and saves to S3.
 * Data includes coordinates for map display.
 * 
 * Usage:
 *   npx tsx data/scripts/fetchCampgrounds.ts NC
 *   npx tsx data/scripts/fetchCampgrounds.ts all
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';

dotenv.config();

const S3_BUCKET = process.env.PARK_DATA_S3_BUCKET || 'tripagent-park-data';
const S3_REGION = process.env.AWS_REGION || 'us-east-1';
const RIDB_API_KEY = process.env.RECREATION_GOV_API_KEY || '';
const RIDB_BASE = 'https://ridb.recreation.gov/api/v1';

interface Campground {
  id: string;
  name: string;
  parkName?: string;
  stateCode: string;
  latitude: number;
  longitude: number;
  totalSites?: number;
  description?: string;
  reservationUrl?: string;
  googleMapsUrl: string;
  dataSource: string;
  lastUpdated: string;
}

interface StateCampgroundOutput {
  _meta: {
    stateCode: string;
    lastUpdated: string;
    totalCampgrounds: number;
  };
  campgrounds: Campground[];
}

// State centers for radius-based search
const STATE_CENTERS: Record<string, { lat: number; lng: number; name: string }> = {
  NC: { lat: 35.5, lng: -82.5, name: 'North Carolina' },
  VA: { lat: 37.5, lng: -79.5, name: 'Virginia' },
  TN: { lat: 35.5, lng: -84.0, name: 'Tennessee' },
  WV: { lat: 38.5, lng: -80.5, name: 'West Virginia' },
  KY: { lat: 37.5, lng: -84.0, name: 'Kentucky' },
  GA: { lat: 34.5, lng: -84.0, name: 'Georgia' },
  NY: { lat: 43.0, lng: -74.5, name: 'New York' },
  PA: { lat: 41.0, lng: -77.5, name: 'Pennsylvania' },
  MN: { lat: 47.0, lng: -91.5, name: 'Minnesota' },
  WI: { lat: 44.5, lng: -89.5, name: 'Wisconsin' },
  FL: { lat: 28.5, lng: -81.5, name: 'Florida' },
  CA: { lat: 37.5, lng: -119.5, name: 'California' },
  TX: { lat: 30.5, lng: -98.5, name: 'Texas' },
  CO: { lat: 39.0, lng: -105.5, name: 'Colorado' },
  OR: { lat: 44.0, lng: -121.5, name: 'Oregon' },
  AZ: { lat: 34.5, lng: -111.5, name: 'Arizona' },
  UT: { lat: 38.5, lng: -111.5, name: 'Utah' },
  WA: { lat: 47.5, lng: -121.0, name: 'Washington' },
  MI: { lat: 44.5, lng: -84.5, name: 'Michigan' },
  SC: { lat: 34.0, lng: -81.0, name: 'South Carolina' },
  NM: { lat: 34.5, lng: -106.0, name: 'New Mexico' },
  ID: { lat: 44.5, lng: -114.5, name: 'Idaho' },
  MT: { lat: 47.0, lng: -110.5, name: 'Montana' },
  NH: { lat: 44.0, lng: -71.5, name: 'New Hampshire' },
  ME: { lat: 45.0, lng: -69.0, name: 'Maine' },
  WY: { lat: 43.5, lng: -109.0, name: 'Wyoming' },
  OH: { lat: 40.5, lng: -82.5, name: 'Ohio' },
  IL: { lat: 40.0, lng: -89.0, name: 'Illinois' },
  MA: { lat: 42.3, lng: -72.0, name: 'Massachusetts' },
  MD: { lat: 39.3, lng: -77.0, name: 'Maryland' },
  NV: { lat: 39.0, lng: -117.0, name: 'Nevada' },
};

function generateGoogleMapsUrl(name: string, lat: number, lng: number): string {
  const query = encodeURIComponent(name);
  return `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=&center=${lat},${lng}`;
}

async function fetchRIDBCampgrounds(stateCode: string): Promise<Campground[]> {
  if (!RIDB_API_KEY) {
    console.log('  [RIDB] No API key - skipping');
    return [];
  }

  const center = STATE_CENTERS[stateCode];
  if (!center) return [];

  const campgrounds: Campground[] = [];

  try {
    // Search for campgrounds in the state using RIDB
    const url = `${RIDB_BASE}/facilities?activity=CAMPING&state=${stateCode}&limit=50&offset=0`;
    const response = await fetch(url, {
      headers: { 'apikey': RIDB_API_KEY, 'Accept': 'application/json' },
    });

    if (!response.ok) {
      console.log(`  [RIDB] HTTP ${response.status}`);
      return [];
    }

    const data = await response.json();
    const facilities = data.RECDATA || [];

    for (const facility of facilities) {
      const lat = parseFloat(facility.FacilityLatitude);
      const lng = parseFloat(facility.FacilityLongitude);
      if (!lat || !lng || lat === 0 || lng === 0) continue;

      const name = facility.FacilityName || 'Unknown Campground';
      const id = `ridb-${facility.FacilityID}`;

      campgrounds.push({
        id,
        name,
        stateCode,
        latitude: lat,
        longitude: lng,
        description: facility.FacilityDescription?.replace(/<[^>]*>/g, '').slice(0, 200),
        reservationUrl: facility.FacilityReservationURL || `https://www.recreation.gov/camping/campgrounds/${facility.FacilityID}`,
        googleMapsUrl: generateGoogleMapsUrl(name, lat, lng),
        dataSource: 'recreation.gov',
        lastUpdated: new Date().toISOString().split('T')[0],
      });
    }

    // Also fetch page 2 if available
    if (facilities.length === 50) {
      const url2 = `${RIDB_BASE}/facilities?activity=CAMPING&state=${stateCode}&limit=50&offset=50`;
      const response2 = await fetch(url2, {
        headers: { 'apikey': RIDB_API_KEY, 'Accept': 'application/json' },
      });
      if (response2.ok) {
        const data2 = await response2.json();
        for (const facility of (data2.RECDATA || [])) {
          const lat = parseFloat(facility.FacilityLatitude);
          const lng = parseFloat(facility.FacilityLongitude);
          if (!lat || !lng || lat === 0 || lng === 0) continue;

          const name = facility.FacilityName || 'Unknown Campground';
          campgrounds.push({
            id: `ridb-${facility.FacilityID}`,
            name,
            stateCode,
            latitude: lat,
            longitude: lng,
            reservationUrl: facility.FacilityReservationURL || `https://www.recreation.gov/camping/campgrounds/${facility.FacilityID}`,
            googleMapsUrl: generateGoogleMapsUrl(name, lat, lng),
            dataSource: 'recreation.gov',
            lastUpdated: new Date().toISOString().split('T')[0],
          });
        }
      }
    }

    console.log(`  [RIDB] ${stateCode}: ${campgrounds.length} campgrounds`);
  } catch (error: any) {
    console.log(`  [RIDB] Error: ${error.message}`);
  }

  return campgrounds;
}

async function processState(stateCode: string): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing ${stateCode} campgrounds...`);
  console.log(`${'='.repeat(60)}`);

  const campgrounds = await fetchRIDBCampgrounds(stateCode);

  if (campgrounds.length === 0) {
    console.log(`  No campgrounds found for ${stateCode}`);
    return;
  }

  const output: StateCampgroundOutput = {
    _meta: {
      stateCode,
      lastUpdated: new Date().toISOString(),
      totalCampgrounds: campgrounds.length,
    },
    campgrounds,
  };

  // Upload to S3
  const s3Client = new S3Client({
    region: S3_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  const key = `campgrounds/state-parks/${stateCode}/campgrounds.json`;
  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: JSON.stringify(output, null, 2),
    ContentType: 'application/json',
  }));

  console.log(`  Saved ${campgrounds.length} campgrounds to s3://${S3_BUCKET}/${key}`);
}

// Main
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: npx tsx data/scripts/fetchCampgrounds.ts <STATE|all>');
    process.exit(1);
  }

  const target = args[0].toUpperCase();

  if (target === 'ALL') {
    for (const stateCode of Object.keys(STATE_CENTERS)) {
      await processState(stateCode);
      // Rate limit
      await new Promise(r => setTimeout(r, 1000));
    }
  } else if (STATE_CENTERS[target]) {
    await processState(target);
  } else {
    console.log(`Unknown state: ${target}`);
    console.log(`Available: ${Object.keys(STATE_CENTERS).join(', ')}`);
    process.exit(1);
  }

  console.log('\nDone!');
}

main().catch(console.error);
