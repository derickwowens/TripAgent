/**
 * USFS + OpenStreetMap Trail Fetcher
 * 
 * Supplements existing trail data with:
 *   1. USFS (US Forest Service) trails via ArcGIS REST endpoint
 *   2. OpenStreetMap hiking paths via Overpass API
 * 
 * Reads existing S3 trail data and merges new trails (delta updates only).
 * 
 * Usage:
 *   npx tsx data/scripts/fetchUSFSAndOSMTrails.ts NC
 *   npx tsx data/scripts/fetchUSFSAndOSMTrails.ts all
 *   npx tsx data/scripts/fetchUSFSAndOSMTrails.ts --list
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

// ============================================================================
// TYPES (must match fetchStateTrails.ts)
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
  geometry?: Array<{ latitude: number; longitude: number }>;
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
// STATE SEARCH AREAS
// Each area has a bounding box for OSM and center point for USFS
// ============================================================================

interface SearchArea {
  id: string;
  name: string;
  lat: number;
  lng: number;
  // Bounding box for OSM Overpass queries
  bbox: { south: number; west: number; north: number; east: number };
}

interface StateSearchConfig {
  stateCode: string;
  stateName: string;
  areas: SearchArea[];
}

const STATE_SEARCH_CONFIGS: Record<string, StateSearchConfig> = {
  NC: {
    stateCode: 'NC',
    stateName: 'North Carolina',
    areas: [
      { id: 'pisgah-nf', name: 'Pisgah National Forest', lat: 35.35, lng: -82.75, bbox: { south: 35.0, west: -83.2, north: 35.7, east: -82.3 } },
      { id: 'nantahala-nf', name: 'Nantahala National Forest', lat: 35.25, lng: -83.50, bbox: { south: 35.0, west: -83.9, north: 35.5, east: -83.1 } },
      { id: 'uwharrie-nf', name: 'Uwharrie National Forest', lat: 35.40, lng: -80.05, bbox: { south: 35.2, west: -80.2, north: 35.6, east: -79.9 } },
      { id: 'blue-ridge-nc', name: 'Blue Ridge Parkway NC Section', lat: 35.70, lng: -82.00, bbox: { south: 35.3, west: -82.5, north: 36.1, east: -81.5 } },
      { id: 'dupont-sf', name: 'DuPont State Forest', lat: 35.20, lng: -82.62, bbox: { south: 35.1, west: -82.7, north: 35.3, east: -82.5 } },
      { id: 'gorges-area', name: 'Gorges / Jocassee Area', lat: 35.09, lng: -82.95, bbox: { south: 34.9, west: -83.2, north: 35.2, east: -82.7 } },
    ],
  },
  VA: {
    stateCode: 'VA',
    stateName: 'Virginia',
    areas: [
      { id: 'gw-nf-north', name: 'George Washington NF North', lat: 38.40, lng: -79.20, bbox: { south: 38.1, west: -79.6, north: 38.7, east: -78.8 } },
      { id: 'gw-nf-south', name: 'George Washington NF South', lat: 37.80, lng: -79.50, bbox: { south: 37.5, west: -79.9, north: 38.1, east: -79.1 } },
      { id: 'jefferson-nf', name: 'Jefferson National Forest', lat: 37.30, lng: -80.50, bbox: { south: 37.0, west: -80.9, north: 37.6, east: -80.1 } },
      { id: 'shenandoah-np', name: 'Shenandoah National Park Area', lat: 38.53, lng: -78.44, bbox: { south: 38.2, west: -78.7, north: 38.9, east: -78.2 } },
      { id: 'mount-rogers', name: 'Mount Rogers NRA', lat: 36.66, lng: -81.54, bbox: { south: 36.5, west: -81.8, north: 36.8, east: -81.3 } },
      { id: 'blue-ridge-va', name: 'Blue Ridge Parkway VA Section', lat: 37.50, lng: -79.80, bbox: { south: 37.2, west: -80.2, north: 37.8, east: -79.4 } },
    ],
  },
  TN: {
    stateCode: 'TN',
    stateName: 'Tennessee',
    areas: [
      { id: 'cherokee-nf-north', name: 'Cherokee NF North', lat: 36.20, lng: -82.50, bbox: { south: 35.9, west: -82.9, north: 36.5, east: -82.1 } },
      { id: 'cherokee-nf-south', name: 'Cherokee NF South', lat: 35.20, lng: -84.30, bbox: { south: 35.0, west: -84.7, north: 35.4, east: -83.9 } },
      { id: 'cumberland-plateau', name: 'Cumberland Plateau', lat: 35.50, lng: -85.50, bbox: { south: 35.2, west: -85.9, north: 35.8, east: -85.1 } },
      { id: 'ocoee-hiwassee', name: 'Ocoee / Hiwassee Area', lat: 35.10, lng: -84.55, bbox: { south: 34.9, west: -84.8, north: 35.3, east: -84.3 } },
      { id: 'smokies-tn', name: 'Great Smokies TN Side', lat: 35.60, lng: -83.50, bbox: { south: 35.4, west: -83.8, north: 35.8, east: -83.2 } },
      { id: 'big-south-fork', name: 'Big South Fork NRRA', lat: 36.48, lng: -84.70, bbox: { south: 36.3, west: -84.9, north: 36.7, east: -84.5 } },
    ],
  },
  WV: {
    stateCode: 'WV',
    stateName: 'West Virginia',
    areas: [
      { id: 'mono-nf-north', name: 'Monongahela NF North', lat: 38.80, lng: -79.80, bbox: { south: 38.5, west: -80.2, north: 39.1, east: -79.4 } },
      { id: 'mono-nf-central', name: 'Monongahela NF Central', lat: 38.40, lng: -80.00, bbox: { south: 38.1, west: -80.4, north: 38.7, east: -79.6 } },
      { id: 'mono-nf-south', name: 'Monongahela NF South', lat: 38.00, lng: -80.20, bbox: { south: 37.7, west: -80.5, north: 38.3, east: -79.9 } },
      { id: 'new-river-gorge', name: 'New River Gorge NP', lat: 38.07, lng: -81.08, bbox: { south: 37.8, west: -81.3, north: 38.3, east: -80.8 } },
      { id: 'dolly-sods', name: 'Dolly Sods Wilderness', lat: 38.98, lng: -79.33, bbox: { south: 38.8, west: -79.5, north: 39.1, east: -79.2 } },
      { id: 'cranberry', name: 'Cranberry Wilderness', lat: 38.23, lng: -80.33, bbox: { south: 38.1, west: -80.5, north: 38.4, east: -80.2 } },
    ],
  },
  KY: {
    stateCode: 'KY',
    stateName: 'Kentucky',
    areas: [
      { id: 'dbnf-north', name: 'Daniel Boone NF North', lat: 38.00, lng: -83.70, bbox: { south: 37.7, west: -84.1, north: 38.3, east: -83.3 } },
      { id: 'dbnf-central', name: 'Daniel Boone NF Central (Red River Gorge)', lat: 37.80, lng: -83.62, bbox: { south: 37.6, west: -83.9, north: 38.0, east: -83.3 } },
      { id: 'dbnf-south', name: 'Daniel Boone NF South', lat: 37.00, lng: -84.30, bbox: { south: 36.7, west: -84.7, north: 37.3, east: -83.9 } },
      { id: 'cumberland-gap', name: 'Cumberland Gap Area', lat: 36.60, lng: -83.67, bbox: { south: 36.4, west: -83.9, north: 36.8, east: -83.4 } },
      { id: 'pine-mountain', name: 'Pine Mountain Trail Area', lat: 36.85, lng: -83.45, bbox: { south: 36.7, west: -83.8, north: 37.0, east: -83.1 } },
      { id: 'mammoth-cave-area', name: 'Mammoth Cave Area', lat: 37.19, lng: -86.10, bbox: { south: 37.0, west: -86.3, north: 37.4, east: -85.9 } },
    ],
  },
  GA: {
    stateCode: 'GA',
    stateName: 'Georgia',
    areas: [
      { id: 'chattahoochee-nf-north', name: 'Chattahoochee NF North', lat: 34.85, lng: -84.00, bbox: { south: 34.6, west: -84.4, north: 35.1, east: -83.6 } },
      { id: 'chattahoochee-nf-central', name: 'Chattahoochee NF Central', lat: 34.60, lng: -84.20, bbox: { south: 34.4, west: -84.5, north: 34.8, east: -83.9 } },
      { id: 'cohutta-wilderness', name: 'Cohutta Wilderness', lat: 34.92, lng: -84.63, bbox: { south: 34.7, west: -84.8, north: 35.1, east: -84.4 } },
      { id: 'springer-at', name: 'Springer Mountain / AT Start', lat: 34.63, lng: -84.19, bbox: { south: 34.5, west: -84.4, north: 34.8, east: -84.0 } },
      { id: 'tallulah-area', name: 'Tallulah Gorge / Chattooga Area', lat: 34.74, lng: -83.39, bbox: { south: 34.5, west: -83.6, north: 34.9, east: -83.2 } },
      { id: 'cloudland-area', name: 'Cloudland Canyon Area', lat: 34.84, lng: -85.48, bbox: { south: 34.7, west: -85.6, north: 35.0, east: -85.3 } },
    ],
  },
  NY: {
    stateCode: 'NY',
    stateName: 'New York',
    areas: [
      { id: 'adirondack-high-peaks', name: 'Adirondack High Peaks', lat: 44.11, lng: -73.92, bbox: { south: 43.9, west: -74.2, north: 44.4, east: -73.6 } },
      { id: 'adirondack-central', name: 'Adirondack Park Central', lat: 43.80, lng: -74.30, bbox: { south: 43.5, west: -74.7, north: 44.1, east: -73.9 } },
      { id: 'adirondack-south', name: 'Adirondack Park South', lat: 43.40, lng: -74.50, bbox: { south: 43.1, west: -74.9, north: 43.7, east: -74.1 } },
      { id: 'catskills', name: 'Catskill Park', lat: 42.10, lng: -74.25, bbox: { south: 41.8, west: -74.6, north: 42.4, east: -73.9 } },
      { id: 'harriman-bear', name: 'Harriman / Bear Mountain Area', lat: 41.28, lng: -74.05, bbox: { south: 41.1, west: -74.2, north: 41.5, east: -73.8 } },
      { id: 'shawangunks', name: 'Shawangunk Ridge (Minnewaska/Mohonk)', lat: 41.73, lng: -74.23, bbox: { south: 41.6, west: -74.4, north: 41.9, east: -74.1 } },
      { id: 'finger-lakes', name: 'Finger Lakes Trail Region', lat: 42.45, lng: -76.70, bbox: { south: 42.2, west: -77.2, north: 42.7, east: -76.2 } },
      { id: 'letchworth-area', name: 'Letchworth / Genesee Valley', lat: 42.58, lng: -77.97, bbox: { south: 42.4, west: -78.2, north: 42.8, east: -77.7 } },
    ],
  },
  PA: {
    stateCode: 'PA',
    stateName: 'Pennsylvania',
    areas: [
      { id: 'allegheny-nf', name: 'Allegheny National Forest', lat: 41.75, lng: -79.00, bbox: { south: 41.4, west: -79.4, north: 42.0, east: -78.6 } },
      { id: 'poconos', name: 'Pocono Mountains / Delaware Water Gap', lat: 41.05, lng: -75.10, bbox: { south: 40.8, west: -75.4, north: 41.3, east: -74.8 } },
      { id: 'pa-grand-canyon', name: 'PA Grand Canyon / Pine Creek Gorge', lat: 41.70, lng: -77.45, bbox: { south: 41.5, west: -77.7, north: 41.9, east: -77.2 } },
      { id: 'loyalsock-worlds-end', name: 'Loyalsock / Worlds End Area', lat: 41.42, lng: -76.65, bbox: { south: 41.2, west: -76.9, north: 41.6, east: -76.4 } },
      { id: 'ohiopyle-area', name: 'Ohiopyle / Laurel Highlands', lat: 39.87, lng: -79.48, bbox: { south: 39.7, west: -79.7, north: 40.1, east: -79.2 } },
      { id: 'ricketts-glen-area', name: 'Ricketts Glen / North Mountain', lat: 41.33, lng: -76.28, bbox: { south: 41.1, west: -76.5, north: 41.5, east: -76.0 } },
      { id: 'at-corridor-pa', name: 'Appalachian Trail PA Corridor', lat: 40.30, lng: -77.10, bbox: { south: 40.0, west: -77.4, north: 40.6, east: -76.8 } },
      { id: 'rothrock-bald-eagle', name: 'Rothrock / Bald Eagle State Forests', lat: 40.80, lng: -77.50, bbox: { south: 40.6, west: -77.8, north: 41.0, east: -77.2 } },
    ],
  },
  MN: {
    stateCode: 'MN',
    stateName: 'Minnesota',
    areas: [
      { id: 'superior-nf-east', name: 'Superior NF / BWCA East', lat: 48.00, lng: -90.50, bbox: { south: 47.7, west: -90.9, north: 48.3, east: -90.1 } },
      { id: 'superior-nf-west', name: 'Superior NF / BWCA West', lat: 47.95, lng: -91.50, bbox: { south: 47.7, west: -91.9, north: 48.2, east: -91.1 } },
      { id: 'north-shore', name: 'North Shore / Superior Hiking Trail', lat: 47.30, lng: -91.20, bbox: { south: 47.0, west: -91.6, north: 47.6, east: -90.8 } },
      { id: 'north-shore-north', name: 'North Shore Upper (Cascade/Magney)', lat: 47.70, lng: -90.40, bbox: { south: 47.5, west: -90.7, north: 47.9, east: -90.1 } },
      { id: 'chippewa-nf', name: 'Chippewa National Forest', lat: 47.30, lng: -94.30, bbox: { south: 47.0, west: -94.7, north: 47.6, east: -93.9 } },
      { id: 'bluff-country', name: 'SE MN Bluff Country (Whitewater/Forestville)', lat: 43.85, lng: -92.10, bbox: { south: 43.5, west: -92.5, north: 44.2, east: -91.7 } },
    ],
  },
  SC: {
    stateCode: 'SC',
    stateName: 'South Carolina',
    areas: [
      { id: 'sumter-nf-pickens', name: 'Sumter NF Andrew Pickens District', lat: 34.85, lng: -83.10, bbox: { south: 34.6, west: -83.4, north: 35.1, east: -82.8 } },
      { id: 'sumter-nf-long-cane', name: 'Sumter NF Long Cane District', lat: 34.10, lng: -82.30, bbox: { south: 33.8, west: -82.6, north: 34.4, east: -82.0 } },
      { id: 'francis-marion-nf', name: 'Francis Marion National Forest', lat: 33.15, lng: -79.75, bbox: { south: 32.9, west: -80.1, north: 33.4, east: -79.4 } },
      { id: 'jocassee-gorges', name: 'Jocassee Gorges / Blue Ridge Escarpment', lat: 35.05, lng: -82.80, bbox: { south: 34.8, west: -83.1, north: 35.2, east: -82.5 } },
      { id: 'congaree-area', name: 'Congaree / Midlands Area', lat: 33.78, lng: -80.78, bbox: { south: 33.6, west: -81.0, north: 34.0, east: -80.5 } },
    ],
  },
  NM: {
    stateCode: 'NM',
    stateName: 'New Mexico',
    areas: [
      { id: 'santa-fe-nf', name: 'Santa Fe National Forest', lat: 35.85, lng: -105.75, bbox: { south: 35.5, west: -106.1, north: 36.2, east: -105.4 } },
      { id: 'carson-nf', name: 'Carson National Forest / Taos', lat: 36.50, lng: -105.50, bbox: { south: 36.2, west: -105.9, north: 36.8, east: -105.1 } },
      { id: 'gila-nf', name: 'Gila National Forest / Wilderness', lat: 33.30, lng: -108.30, bbox: { south: 33.0, west: -108.7, north: 33.6, east: -107.9 } },
      { id: 'cibola-nf-sandia', name: 'Cibola NF / Sandia Mountains', lat: 35.20, lng: -106.45, bbox: { south: 35.0, west: -106.7, north: 35.4, east: -106.2 } },
      { id: 'lincoln-nf', name: 'Lincoln National Forest', lat: 33.00, lng: -105.70, bbox: { south: 32.7, west: -106.0, north: 33.3, east: -105.4 } },
      { id: 'rio-grande-gorge', name: 'Rio Grande del Norte / Gorge', lat: 36.53, lng: -105.73, bbox: { south: 36.3, west: -106.0, north: 36.8, east: -105.5 } },
    ],
  },
  ID: {
    stateCode: 'ID',
    stateName: 'Idaho',
    areas: [
      { id: 'sawtooth-nra', name: 'Sawtooth NRA / Stanley Area', lat: 43.90, lng: -114.90, bbox: { south: 43.6, west: -115.3, north: 44.2, east: -114.5 } },
      { id: 'boise-nf', name: 'Boise National Forest', lat: 44.00, lng: -115.50, bbox: { south: 43.7, west: -115.9, north: 44.3, east: -115.1 } },
      { id: 'salmon-challis', name: 'Salmon-Challis NF / Frank Church Wilderness', lat: 44.50, lng: -114.00, bbox: { south: 44.2, west: -114.4, north: 44.8, east: -113.6 } },
      { id: 'caribou-targhee', name: 'Caribou-Targhee NF / Teton Valley', lat: 43.50, lng: -111.50, bbox: { south: 43.2, west: -111.9, north: 43.8, east: -111.1 } },
      { id: 'nez-perce-clearwater', name: 'Nez Perce-Clearwater NF', lat: 46.50, lng: -115.50, bbox: { south: 46.2, west: -115.9, north: 46.8, east: -115.1 } },
      { id: 'panhandle-nf', name: 'Idaho Panhandle NF / Coeur d Alene', lat: 47.50, lng: -116.50, bbox: { south: 47.2, west: -116.9, north: 47.8, east: -116.1 } },
    ],
  },
  MT: {
    stateCode: 'MT',
    stateName: 'Montana',
    areas: [
      { id: 'glacier-west', name: 'Glacier NP West / Flathead', lat: 48.50, lng: -113.90, bbox: { south: 48.2, west: -114.3, north: 48.8, east: -113.5 } },
      { id: 'glacier-east', name: 'Glacier NP East / Many Glacier', lat: 48.80, lng: -113.65, bbox: { south: 48.5, west: -114.0, north: 49.0, east: -113.3 } },
      { id: 'flathead-nf', name: 'Flathead National Forest / Bob Marshall', lat: 47.80, lng: -113.50, bbox: { south: 47.5, west: -113.9, north: 48.1, east: -113.1 } },
      { id: 'gallatin-beartooth', name: 'Gallatin / Absaroka-Beartooth', lat: 45.30, lng: -110.00, bbox: { south: 45.0, west: -110.4, north: 45.6, east: -109.6 } },
      { id: 'bitterroot-nf', name: 'Bitterroot NF / Selway-Bitterroot', lat: 46.00, lng: -114.00, bbox: { south: 45.7, west: -114.4, north: 46.3, east: -113.6 } },
      { id: 'lolo-nf', name: 'Lolo National Forest / Missoula', lat: 47.00, lng: -114.00, bbox: { south: 46.7, west: -114.4, north: 47.3, east: -113.6 } },
      { id: 'helena-nf', name: 'Helena-Lewis and Clark NF', lat: 47.00, lng: -112.50, bbox: { south: 46.7, west: -112.9, north: 47.3, east: -112.1 } },
    ],
  },
  NH: {
    stateCode: 'NH',
    stateName: 'New Hampshire',
    areas: [
      { id: 'wmnf-presidentials', name: 'White Mountain NF / Presidentials', lat: 44.27, lng: -71.30, bbox: { south: 44.0, west: -71.6, north: 44.5, east: -71.0 } },
      { id: 'wmnf-pemi', name: 'White Mountain NF / Pemigewasset Wilderness', lat: 44.05, lng: -71.60, bbox: { south: 43.8, west: -71.9, north: 44.3, east: -71.3 } },
      { id: 'wmnf-kancamagus', name: 'White Mountain NF / Kancamagus', lat: 43.95, lng: -71.40, bbox: { south: 43.7, west: -71.7, north: 44.2, east: -71.1 } },
      { id: 'franconia-area', name: 'Franconia Notch Area', lat: 44.14, lng: -71.68, bbox: { south: 44.0, west: -71.8, north: 44.3, east: -71.5 } },
      { id: 'monadnock-area', name: 'Mount Monadnock Area', lat: 42.86, lng: -72.11, bbox: { south: 42.7, west: -72.3, north: 43.0, east: -71.9 } },
    ],
  },
  ME: {
    stateCode: 'ME',
    stateName: 'Maine',
    areas: [
      { id: 'baxter-katahdin', name: 'Baxter State Park / Katahdin', lat: 45.90, lng: -68.92, bbox: { south: 45.7, west: -69.2, north: 46.1, east: -68.6 } },
      { id: 'acadia', name: 'Acadia National Park Area', lat: 44.34, lng: -68.27, bbox: { south: 44.2, west: -68.5, north: 44.5, east: -68.0 } },
      { id: '100-mile-wilderness', name: '100-Mile Wilderness', lat: 45.50, lng: -69.10, bbox: { south: 45.2, west: -69.4, north: 45.8, east: -68.8 } },
      { id: 'wmnf-maine', name: 'White Mountain NF Maine Section', lat: 44.30, lng: -71.00, bbox: { south: 44.1, west: -71.3, north: 44.5, east: -70.7 } },
      { id: 'bigelow-area', name: 'Bigelow Preserve / Flagstaff', lat: 45.13, lng: -70.28, bbox: { south: 44.9, west: -70.6, north: 45.4, east: -70.0 } },
    ],
  },
  WY: {
    stateCode: 'WY',
    stateName: 'Wyoming',
    areas: [
      { id: 'yellowstone-area', name: 'Yellowstone NP Area', lat: 44.60, lng: -110.50, bbox: { south: 44.3, west: -110.9, north: 44.9, east: -110.1 } },
      { id: 'grand-teton-area', name: 'Grand Teton / Bridger-Teton NF', lat: 43.70, lng: -110.50, bbox: { south: 43.4, west: -110.9, north: 44.0, east: -110.1 } },
      { id: 'wind-river', name: 'Wind River Range', lat: 42.90, lng: -109.40, bbox: { south: 42.6, west: -109.8, north: 43.2, east: -109.0 } },
      { id: 'bighorn-nf', name: 'Bighorn National Forest', lat: 44.40, lng: -107.20, bbox: { south: 44.1, west: -107.6, north: 44.7, east: -106.8 } },
      { id: 'shoshone-nf', name: 'Shoshone National Forest', lat: 44.00, lng: -109.50, bbox: { south: 43.7, west: -109.9, north: 44.3, east: -109.1 } },
      { id: 'medicine-bow', name: 'Medicine Bow NF / Snowy Range', lat: 41.35, lng: -106.30, bbox: { south: 41.1, west: -106.7, north: 41.6, east: -105.9 } },
    ],
  },
  OH: {
    stateCode: 'OH',
    stateName: 'Ohio',
    areas: [
      { id: 'wayne-nf', name: 'Wayne National Forest', lat: 39.30, lng: -82.10, bbox: { south: 39.0, west: -82.5, north: 39.6, east: -81.7 } },
      { id: 'hocking-hills', name: 'Hocking Hills Region', lat: 39.43, lng: -82.53, bbox: { south: 39.2, west: -82.8, north: 39.7, east: -82.3 } },
      { id: 'cuyahoga-valley', name: 'Cuyahoga Valley NP', lat: 41.25, lng: -81.55, bbox: { south: 41.1, west: -81.7, north: 41.4, east: -81.4 } },
    ],
  },
  IL: {
    stateCode: 'IL',
    stateName: 'Illinois',
    areas: [
      { id: 'shawnee-nf-east', name: 'Shawnee NF East / Garden of the Gods', lat: 37.60, lng: -88.30, bbox: { south: 37.3, west: -88.6, north: 37.9, east: -88.0 } },
      { id: 'shawnee-nf-west', name: 'Shawnee NF West / Giant City', lat: 37.55, lng: -89.10, bbox: { south: 37.3, west: -89.4, north: 37.8, east: -88.8 } },
      { id: 'starved-rock-area', name: 'Starved Rock / Illinois River Valley', lat: 41.32, lng: -88.98, bbox: { south: 41.1, west: -89.2, north: 41.5, east: -88.7 } },
    ],
  },
  MA: {
    stateCode: 'MA',
    stateName: 'Massachusetts',
    areas: [
      { id: 'berkshires', name: 'Berkshires / Mount Greylock', lat: 42.50, lng: -73.20, bbox: { south: 42.2, west: -73.5, north: 42.8, east: -72.9 } },
      { id: 'blue-hills', name: 'Blue Hills / SE MA', lat: 42.22, lng: -71.10, bbox: { south: 42.0, west: -71.3, north: 42.4, east: -70.9 } },
      { id: 'conn-valley', name: 'Connecticut River Valley / Mount Tom', lat: 42.25, lng: -72.63, bbox: { south: 42.0, west: -72.9, north: 42.5, east: -72.4 } },
      { id: 'cape-cod', name: 'Cape Cod National Seashore', lat: 41.85, lng: -70.00, bbox: { south: 41.7, west: -70.2, north: 42.0, east: -69.8 } },
    ],
  },
  MD: {
    stateCode: 'MD',
    stateName: 'Maryland',
    areas: [
      { id: 'catoctin-area', name: 'Catoctin Mountain / Cunningham Falls', lat: 39.65, lng: -77.45, bbox: { south: 39.4, west: -77.7, north: 39.9, east: -77.2 } },
      { id: 'green-ridge-savage', name: 'Green Ridge / Savage River SF', lat: 39.60, lng: -78.80, bbox: { south: 39.3, west: -79.2, north: 39.9, east: -78.4 } },
      { id: 'patapsco-area', name: 'Patapsco Valley / Gunpowder Falls', lat: 39.35, lng: -76.65, bbox: { south: 39.1, west: -76.9, north: 39.6, east: -76.4 } },
    ],
  },
  NV: {
    stateCode: 'NV',
    stateName: 'Nevada',
    areas: [
      { id: 'spring-mountains', name: 'Spring Mountains NRA / Mt Charleston', lat: 36.27, lng: -115.69, bbox: { south: 36.0, west: -116.0, north: 36.5, east: -115.4 } },
      { id: 'red-rock', name: 'Red Rock Canyon NCA', lat: 36.14, lng: -115.43, bbox: { south: 36.0, west: -115.6, north: 36.3, east: -115.2 } },
      { id: 'humboldt-toiyabe-south', name: 'Humboldt-Toiyabe NF South', lat: 36.30, lng: -115.70, bbox: { south: 36.0, west: -116.0, north: 36.6, east: -115.4 } },
      { id: 'lake-tahoe-nv', name: 'Lake Tahoe NV Side', lat: 39.18, lng: -119.92, bbox: { south: 39.0, west: -120.1, north: 39.4, east: -119.7 } },
    ],
  },
  CA: {
    stateCode: 'CA',
    stateName: 'California',
    areas: [
      { id: 'sierra-nf-yosemite', name: 'Sierra NF / Yosemite Area', lat: 37.75, lng: -119.60, bbox: { south: 37.4, west: -120.0, north: 38.1, east: -119.2 } },
      { id: 'sequoia-kings-canyon', name: 'Sequoia / Kings Canyon', lat: 36.50, lng: -118.60, bbox: { south: 36.2, west: -119.0, north: 36.8, east: -118.2 } },
      { id: 'inyo-nf-eastern-sierra', name: 'Inyo NF / Eastern Sierra', lat: 37.50, lng: -118.60, bbox: { south: 37.2, west: -119.0, north: 37.8, east: -118.2 } },
      { id: 'lake-tahoe-ca', name: 'Lake Tahoe CA / Desolation Wilderness', lat: 38.90, lng: -120.10, bbox: { south: 38.7, west: -120.4, north: 39.1, east: -119.8 } },
      { id: 'shasta-trinity-nf', name: 'Shasta-Trinity National Forest', lat: 41.00, lng: -122.40, bbox: { south: 40.7, west: -122.8, north: 41.3, east: -122.0 } },
      { id: 'los-padres-nf', name: 'Los Padres National Forest', lat: 34.70, lng: -119.80, bbox: { south: 34.4, west: -120.2, north: 35.0, east: -119.4 } },
      { id: 'angeles-nf', name: 'Angeles National Forest', lat: 34.30, lng: -118.10, bbox: { south: 34.1, west: -118.4, north: 34.5, east: -117.8 } },
      { id: 'san-bernardino-nf', name: 'San Bernardino National Forest', lat: 34.15, lng: -116.90, bbox: { south: 33.9, west: -117.2, north: 34.4, east: -116.6 } },
      { id: 'cleveland-nf', name: 'Cleveland National Forest', lat: 33.40, lng: -116.70, bbox: { south: 33.1, west: -117.0, north: 33.7, east: -116.4 } },
      { id: 'point-reyes-marin', name: 'Point Reyes / Marin Headlands', lat: 38.05, lng: -122.80, bbox: { south: 37.8, west: -123.1, north: 38.2, east: -122.5 } },
      { id: 'big-sur-ventana', name: 'Big Sur / Ventana Wilderness', lat: 36.20, lng: -121.70, bbox: { south: 35.9, west: -122.0, north: 36.5, east: -121.4 } },
      { id: 'redwood-coast', name: 'Redwood NP / North Coast', lat: 41.30, lng: -124.00, bbox: { south: 41.0, west: -124.3, north: 41.6, east: -123.7 } },
    ],
  },
  FL: {
    stateCode: 'FL',
    stateName: 'Florida',
    areas: [
      { id: 'ocala-nf', name: 'Ocala National Forest', lat: 29.20, lng: -81.70, bbox: { south: 28.9, west: -82.0, north: 29.5, east: -81.4 } },
      { id: 'apalachicola-nf', name: 'Apalachicola National Forest', lat: 30.20, lng: -84.70, bbox: { south: 29.9, west: -85.0, north: 30.5, east: -84.4 } },
      { id: 'osceola-nf', name: 'Osceola National Forest', lat: 30.30, lng: -82.50, bbox: { south: 30.1, west: -82.8, north: 30.5, east: -82.2 } },
      { id: 'everglades-area', name: 'Everglades / Big Cypress', lat: 25.80, lng: -80.90, bbox: { south: 25.5, west: -81.3, north: 26.1, east: -80.5 } },
      { id: 'florida-trail-north', name: 'Florida Trail / Panhandle', lat: 30.50, lng: -85.50, bbox: { south: 30.2, west: -85.9, north: 30.8, east: -85.1 } },
    ],
  },
  TX: {
    stateCode: 'TX',
    stateName: 'Texas',
    areas: [
      { id: 'big-bend-area', name: 'Big Bend NP Area', lat: 29.25, lng: -103.25, bbox: { south: 29.0, west: -103.6, north: 29.5, east: -102.9 } },
      { id: 'guadalupe-mountains', name: 'Guadalupe Mountains NP Area', lat: 31.90, lng: -104.85, bbox: { south: 31.7, west: -105.1, north: 32.1, east: -104.6 } },
      { id: 'sam-houston-nf', name: 'Sam Houston National Forest', lat: 30.55, lng: -95.25, bbox: { south: 30.3, west: -95.5, north: 30.8, east: -95.0 } },
      { id: 'davy-crockett-nf', name: 'Davy Crockett National Forest', lat: 31.30, lng: -95.10, bbox: { south: 31.1, west: -95.4, north: 31.5, east: -94.8 } },
      { id: 'hill-country', name: 'Texas Hill Country / Enchanted Rock', lat: 30.50, lng: -98.80, bbox: { south: 30.2, west: -99.1, north: 30.8, east: -98.5 } },
      { id: 'palo-duro-caprock', name: 'Palo Duro Canyon / Caprock', lat: 34.95, lng: -101.65, bbox: { south: 34.7, west: -101.9, north: 35.2, east: -101.4 } },
    ],
  },
  CO: {
    stateCode: 'CO',
    stateName: 'Colorado',
    areas: [
      { id: 'rmnp-area', name: 'Rocky Mountain NP Area', lat: 40.35, lng: -105.70, bbox: { south: 40.1, west: -106.0, north: 40.6, east: -105.4 } },
      { id: 'white-river-nf', name: 'White River NF / Vail / Aspen', lat: 39.50, lng: -106.60, bbox: { south: 39.2, west: -107.0, north: 39.8, east: -106.2 } },
      { id: 'pike-san-isabel', name: 'Pike / San Isabel NF', lat: 39.00, lng: -105.50, bbox: { south: 38.7, west: -105.9, north: 39.3, east: -105.1 } },
      { id: 'san-juan-nf', name: 'San Juan National Forest / Durango', lat: 37.60, lng: -107.80, bbox: { south: 37.3, west: -108.2, north: 37.9, east: -107.4 } },
      { id: 'uncompahgre-nf', name: 'Uncompahgre NF / Telluride', lat: 38.00, lng: -107.80, bbox: { south: 37.7, west: -108.2, north: 38.3, east: -107.4 } },
      { id: 'maroon-bells-area', name: 'Maroon Bells / Snowmass Wilderness', lat: 39.07, lng: -107.00, bbox: { south: 38.9, west: -107.3, north: 39.3, east: -106.7 } },
      { id: 'indian-peaks', name: 'Indian Peaks Wilderness', lat: 40.05, lng: -105.65, bbox: { south: 39.9, west: -105.9, north: 40.2, east: -105.4 } },
    ],
  },
  OR: {
    stateCode: 'OR',
    stateName: 'Oregon',
    areas: [
      { id: 'mt-hood-nf', name: 'Mt Hood National Forest', lat: 45.35, lng: -121.70, bbox: { south: 45.1, west: -122.0, north: 45.6, east: -121.4 } },
      { id: 'deschutes-nf', name: 'Deschutes NF / Bend Area', lat: 43.90, lng: -121.70, bbox: { south: 43.6, west: -122.0, north: 44.2, east: -121.4 } },
      { id: 'willamette-nf', name: 'Willamette National Forest', lat: 43.80, lng: -122.10, bbox: { south: 43.5, west: -122.4, north: 44.1, east: -121.8 } },
      { id: 'crater-lake-area', name: 'Crater Lake / Rogue River NF', lat: 42.90, lng: -122.10, bbox: { south: 42.6, west: -122.4, north: 43.2, east: -121.8 } },
      { id: 'columbia-gorge', name: 'Columbia River Gorge', lat: 45.60, lng: -121.80, bbox: { south: 45.4, west: -122.2, north: 45.8, east: -121.4 } },
      { id: 'eagle-cap-wallowas', name: 'Eagle Cap / Wallowa Mountains', lat: 45.20, lng: -117.30, bbox: { south: 44.9, west: -117.7, north: 45.5, east: -116.9 } },
    ],
  },
  AZ: {
    stateCode: 'AZ',
    stateName: 'Arizona',
    areas: [
      { id: 'coconino-nf', name: 'Coconino NF / Sedona / Flagstaff', lat: 34.90, lng: -111.70, bbox: { south: 34.6, west: -112.0, north: 35.2, east: -111.4 } },
      { id: 'prescott-nf', name: 'Prescott National Forest', lat: 34.55, lng: -112.50, bbox: { south: 34.3, west: -112.8, north: 34.8, east: -112.2 } },
      { id: 'tonto-nf', name: 'Tonto National Forest', lat: 33.80, lng: -111.30, bbox: { south: 33.5, west: -111.6, north: 34.1, east: -111.0 } },
      { id: 'coronado-nf-south', name: 'Coronado NF / Santa Catalina / Tucson', lat: 32.40, lng: -110.75, bbox: { south: 32.1, west: -111.1, north: 32.7, east: -110.4 } },
      { id: 'grand-canyon-area', name: 'Grand Canyon NP Area', lat: 36.10, lng: -112.10, bbox: { south: 35.8, west: -112.4, north: 36.4, east: -111.8 } },
      { id: 'superstition-wilderness', name: 'Superstition Wilderness', lat: 33.45, lng: -111.20, bbox: { south: 33.3, west: -111.4, north: 33.6, east: -111.0 } },
    ],
  },
  UT: {
    stateCode: 'UT',
    stateName: 'Utah',
    areas: [
      { id: 'wasatch-nf', name: 'Wasatch Range / Salt Lake Area', lat: 40.65, lng: -111.70, bbox: { south: 40.4, west: -112.0, north: 40.9, east: -111.4 } },
      { id: 'uinta-nf', name: 'Uinta Mountains / Mirror Lake', lat: 40.70, lng: -110.90, bbox: { south: 40.4, west: -111.2, north: 41.0, east: -110.6 } },
      { id: 'zion-area', name: 'Zion NP Area', lat: 37.30, lng: -113.00, bbox: { south: 37.1, west: -113.3, north: 37.5, east: -112.7 } },
      { id: 'bryce-area', name: 'Bryce Canyon / Red Canyon', lat: 37.60, lng: -112.20, bbox: { south: 37.4, west: -112.5, north: 37.8, east: -111.9 } },
      { id: 'arches-canyonlands', name: 'Arches / Canyonlands / Moab', lat: 38.60, lng: -109.60, bbox: { south: 38.3, west: -109.9, north: 38.9, east: -109.3 } },
      { id: 'capitol-reef-area', name: 'Capitol Reef / Grand Staircase', lat: 38.10, lng: -111.20, bbox: { south: 37.8, west: -111.5, north: 38.4, east: -110.9 } },
    ],
  },
  WA: {
    stateCode: 'WA',
    stateName: 'Washington',
    areas: [
      { id: 'mt-baker-snoqualmie', name: 'Mt Baker-Snoqualmie NF', lat: 47.80, lng: -121.50, bbox: { south: 47.5, west: -121.8, north: 48.1, east: -121.2 } },
      { id: 'olympic-nf', name: 'Olympic National Forest / Park', lat: 47.80, lng: -123.50, bbox: { south: 47.5, west: -123.8, north: 48.1, east: -123.2 } },
      { id: 'gifford-pinchot-nf', name: 'Gifford Pinchot NF / Mt St Helens', lat: 46.20, lng: -121.80, bbox: { south: 45.9, west: -122.1, north: 46.5, east: -121.5 } },
      { id: 'okanogan-wenatchee', name: 'Okanogan-Wenatchee NF / North Cascades', lat: 48.00, lng: -120.70, bbox: { south: 47.7, west: -121.0, north: 48.3, east: -120.4 } },
      { id: 'mt-rainier-area', name: 'Mt Rainier NP Area', lat: 46.85, lng: -121.75, bbox: { south: 46.6, west: -122.0, north: 47.1, east: -121.5 } },
      { id: 'alpine-lakes', name: 'Alpine Lakes Wilderness', lat: 47.50, lng: -121.10, bbox: { south: 47.3, west: -121.4, north: 47.7, east: -120.8 } },
    ],
  },
  MI: {
    stateCode: 'MI',
    stateName: 'Michigan',
    areas: [
      { id: 'hiawatha-nf', name: 'Hiawatha National Forest', lat: 46.30, lng: -86.50, bbox: { south: 46.0, west: -86.8, north: 46.6, east: -86.2 } },
      { id: 'pictured-rocks', name: 'Pictured Rocks National Lakeshore', lat: 46.55, lng: -86.35, bbox: { south: 46.4, west: -86.6, north: 46.7, east: -86.1 } },
      { id: 'huron-manistee-nf', name: 'Huron-Manistee National Forest', lat: 44.40, lng: -85.80, bbox: { south: 44.1, west: -86.1, north: 44.7, east: -85.5 } },
      { id: 'porcupine-mountains', name: 'Porcupine Mountains / Western UP', lat: 46.75, lng: -89.80, bbox: { south: 46.5, west: -90.1, north: 47.0, east: -89.5 } },
      { id: 'sleeping-bear-dunes', name: 'Sleeping Bear Dunes Area', lat: 44.85, lng: -86.05, bbox: { south: 44.7, west: -86.3, north: 45.0, east: -85.8 } },
    ],
  },
  WI: {
    stateCode: 'WI',
    stateName: 'Wisconsin',
    areas: [
      { id: 'chequamegon-nicolet-nf', name: 'Chequamegon-Nicolet NF', lat: 45.80, lng: -89.00, bbox: { south: 45.5, west: -89.3, north: 46.1, east: -88.7 } },
      { id: 'ice-age-trail-north', name: 'Ice Age Trail / Northern Kettle Moraine', lat: 43.70, lng: -88.20, bbox: { south: 43.4, west: -88.5, north: 44.0, east: -87.9 } },
      { id: 'devils-lake-baraboo', name: 'Devils Lake / Baraboo Range', lat: 43.42, lng: -89.73, bbox: { south: 43.2, west: -90.0, north: 43.6, east: -89.5 } },
      { id: 'apostle-islands', name: 'Apostle Islands / Bayfield', lat: 46.90, lng: -90.70, bbox: { south: 46.7, west: -91.0, north: 47.1, east: -90.4 } },
    ],
  },
  SD: {
    stateCode: 'SD',
    stateName: 'South Dakota',
    areas: [
      { id: 'badlands-np', name: 'Badlands National Park', lat: 43.86, lng: -102.34, bbox: { south: 43.6, west: -102.8, north: 44.1, east: -101.9 } },
      { id: 'black-hills-nf', name: 'Black Hills National Forest', lat: 44.00, lng: -103.75, bbox: { south: 43.5, west: -104.2, north: 44.5, east: -103.3 } },
      { id: 'wind-cave-custer', name: 'Wind Cave NP / Custer SP', lat: 43.60, lng: -103.48, bbox: { south: 43.4, west: -103.8, north: 43.8, east: -103.2 } },
    ],
  },
  AR: {
    stateCode: 'AR',
    stateName: 'Arkansas',
    areas: [
      { id: 'hot-springs-np', name: 'Hot Springs National Park', lat: 34.52, lng: -93.04, bbox: { south: 34.3, west: -93.3, north: 34.7, east: -92.8 } },
      { id: 'ozark-nf', name: 'Ozark National Forest', lat: 35.70, lng: -93.30, bbox: { south: 35.4, west: -93.7, north: 36.0, east: -92.9 } },
      { id: 'buffalo-river', name: 'Buffalo National River', lat: 36.03, lng: -92.90, bbox: { south: 35.8, west: -93.3, north: 36.3, east: -92.5 } },
      { id: 'devils-den-area', name: "Devil's Den / NW Arkansas", lat: 35.78, lng: -94.24, bbox: { south: 35.5, west: -94.5, north: 36.0, east: -94.0 } },
    ],
  },
  IN: {
    stateCode: 'IN',
    stateName: 'Indiana',
    areas: [
      { id: 'indiana-dunes-np', name: 'Indiana Dunes National Park', lat: 41.65, lng: -87.05, bbox: { south: 41.5, west: -87.3, north: 41.8, east: -86.8 } },
      { id: 'hoosier-nf', name: 'Hoosier National Forest', lat: 38.50, lng: -86.50, bbox: { south: 38.2, west: -86.8, north: 38.8, east: -86.2 } },
      { id: 'brown-county-area', name: 'Brown County / Turkey Run', lat: 39.15, lng: -86.23, bbox: { south: 38.9, west: -86.5, north: 39.4, east: -86.0 } },
    ],
  },
  MO: {
    stateCode: 'MO',
    stateName: 'Missouri',
    areas: [
      { id: 'mark-twain-nf', name: 'Mark Twain National Forest', lat: 37.50, lng: -91.50, bbox: { south: 37.2, west: -91.8, north: 37.8, east: -91.2 } },
      { id: 'ozark-riverways', name: 'Ozark National Scenic Riverways', lat: 37.15, lng: -91.35, bbox: { south: 36.9, west: -91.7, north: 37.4, east: -91.0 } },
      { id: 'st-louis-area', name: 'Gateway Arch / St Louis Area', lat: 38.62, lng: -90.18, bbox: { south: 38.4, west: -90.5, north: 38.8, east: -89.9 } },
    ],
  },
  ND: {
    stateCode: 'ND',
    stateName: 'North Dakota',
    areas: [
      { id: 'theodore-roosevelt-south', name: 'Theodore Roosevelt NP South', lat: 46.98, lng: -103.54, bbox: { south: 46.7, west: -103.9, north: 47.2, east: -103.2 } },
      { id: 'theodore-roosevelt-north', name: 'Theodore Roosevelt NP North', lat: 47.59, lng: -103.39, bbox: { south: 47.4, west: -103.7, north: 47.8, east: -103.1 } },
      { id: 'maah-daah-hey', name: 'Maah Daah Hey Trail', lat: 47.20, lng: -103.40, bbox: { south: 46.8, west: -103.8, north: 47.6, east: -103.0 } },
    ],
  },
};

// ============================================================================
// USFS TRAIL FETCHER
// ============================================================================

const USFS_TRAIL_ENDPOINT = 'https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_TrailNFSPublish_01/MapServer/0/query';

interface USFSTrailFeature {
  attributes: {
    TRAIL_NAME?: string;
    TRAIL_NO?: string;
    TRAIL_TYPE?: string;
    TRAIL_CLASS?: string;
    SEGMENT_LENGTH?: number;
    MANAGING_ORG?: string;
    ACCESSIBILITY_STATUS?: string;
    TRAIL_SURFACE?: string;
    ALLOWED_TERRA_USE?: string;
  };
  geometry?: {
    paths?: number[][][];
  };
}

async function fetchUSFSTrails(area: SearchArea, stateCode: string): Promise<Trail[]> {
  const trails: Trail[] = [];
  const { bbox } = area;

  try {
    const geometryParam = encodeURIComponent(JSON.stringify({
      xmin: bbox.west, ymin: bbox.south,
      xmax: bbox.east, ymax: bbox.north,
      spatialReference: { wkid: 4326 },
    }));

    const url = `${USFS_TRAIL_ENDPOINT}?` +
      `where=1%3D1` +
      `&geometry=${geometryParam}` +
      `&geometryType=esriGeometryEnvelope` +
      `&spatialRel=esriSpatialRelIntersects` +
      `&outFields=TRAIL_NAME,TRAIL_NO,TRAIL_TYPE,TRAIL_CLASS,SEGMENT_LENGTH,MANAGING_ORG,TRAIL_SURFACE,ALLOWED_TERRA_USE` +
      `&returnGeometry=true` +
      `&outSR=4326` +
      `&f=json` +
      `&resultRecordCount=500`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      console.log(`  [USFS] HTTP ${response.status} for ${area.name}`);
      return [];
    }

    const data = await response.json();
    const features: USFSTrailFeature[] = data.features || [];

    if (features.length === 0) {
      return [];
    }

    // Deduplicate by trail name (USFS returns segments, not unique trails)
    // Merge geometry paths from all segments for the same trail
    const seen = new Map<string, { feature: USFSTrailFeature; allPaths: number[][][] }>();
    for (const feature of features) {
      const name = feature.attributes.TRAIL_NAME;
      if (!name || name === 'Unknown' || name === 'N/A') continue;

      const key = name.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.set(key, {
          feature,
          allPaths: feature.geometry?.paths ? [...feature.geometry.paths] : [],
        });
      } else {
        const existing = seen.get(key)!;
        // Accumulate length from segments
        if (feature.attributes.SEGMENT_LENGTH && existing.feature.attributes.SEGMENT_LENGTH) {
          existing.feature.attributes.SEGMENT_LENGTH += feature.attributes.SEGMENT_LENGTH;
        }
        // Merge geometry paths
        if (feature.geometry?.paths) {
          existing.allPaths.push(...feature.geometry.paths);
        }
      }
    }

    for (const [, { feature, allPaths }] of seen) {
      const name = feature.attributes.TRAIL_NAME!;
      let lat = area.lat;
      let lng = area.lng;

      // Get coordinates from first path point if available
      if (allPaths[0]?.[0]) {
        lng = allPaths[0][0][0];
        lat = allPaths[0][0][1];
      }

      // Build polyline geometry from all path segments
      // USFS paths are [lng, lat] arrays - convert to {latitude, longitude}
      const geometry: Array<{ latitude: number; longitude: number }> = [];
      for (const path of allPaths) {
        for (const point of path) {
          if (point.length >= 2) {
            geometry.push({ latitude: point[1], longitude: point[0] });
          }
        }
      }

      // Convert segment length from meters to miles
      let lengthMiles: number | undefined;
      if (feature.attributes.SEGMENT_LENGTH) {
        lengthMiles = Math.round((feature.attributes.SEGMENT_LENGTH / 1609.34) * 10) / 10;
      }

      // Map USFS trail class to difficulty
      let difficulty: string | undefined;
      switch (feature.attributes.TRAIL_CLASS) {
        case 'TC1': difficulty = 'easy'; break;
        case 'TC2': difficulty = 'easy'; break;
        case 'TC3': difficulty = 'moderate'; break;
        case 'TC4': difficulty = 'hard'; break;
        case 'TC5': difficulty = 'hard'; break;
      }

      const trailId = `${stateCode.toLowerCase()}-${area.id}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

      trails.push({
        id: trailId,
        name: name,
        parkId: area.id,
        parkName: area.name,
        stateCode: stateCode,
        lengthMiles,
        difficulty,
        trailType: feature.attributes.ALLOWED_TERRA_USE?.includes('HIKE') ? 'hiking' : undefined,
        googleMapsUrl: generateGoogleMapsUrl(name, area.name, STATE_SEARCH_CONFIGS[stateCode].stateName),
        trailheadCoordinates: { latitude: lat, longitude: lng },
        geometry: geometry.length >= 2 ? geometry : undefined,
        dataSource: 'usfs',
        lastUpdated: new Date().toISOString().split('T')[0],
      });
    }

    console.log(`  [USFS] ${area.name}: ${trails.length} unique trails from ${features.length} segments`);
  } catch (error: any) {
    console.log(`  [USFS] Error for ${area.name}: ${error.message}`);
  }

  return trails;
}

// ============================================================================
// OSM OVERPASS TRAIL FETCHER
// ============================================================================

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: Array<{ lat: number; lon: number }>;
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  tags?: {
    name?: string;
    highway?: string;
    sac_scale?: string;
    trail_visibility?: string;
    surface?: string;
    'mtb:scale'?: string;
    route?: string;
    distance?: string;
    length?: string;
    description?: string;
    operator?: string;
    network?: string;
  };
}

async function fetchOSMTrails(area: SearchArea, stateCode: string): Promise<Trail[]> {
  const trails: Trail[] = [];
  const { bbox } = area;
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;

  try {
    // Query for named hiking paths and routes - request geometry for polylines
    const query = `
[out:json][timeout:45];
(
  way["highway"="path"]["name"](${bboxStr});
  way["highway"="footway"]["name"](${bboxStr});
  way["highway"="track"]["name"]["sac_scale"](${bboxStr});
  relation["route"="hiking"]["name"](${bboxStr});
);
out geom tags;
`;

    const response = await fetch(OVERPASS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      console.log(`  [OSM] HTTP ${response.status} for ${area.name}`);
      return [];
    }

    const data = await response.json();
    const elements: OverpassElement[] = data.elements || [];

    if (elements.length === 0) {
      return [];
    }

    // Deduplicate by name
    const seen = new Set<string>();
    for (const element of elements) {
      const name = element.tags?.name;
      if (!name) continue;

      const key = name.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);

      // Skip very generic names
      if (name.length < 4) continue;
      if (['path', 'trail', 'track', 'road', 'unknown'].includes(key)) continue;

      const lat = element.center?.lat || element.lat || (element.geometry?.[0]?.lat) || area.lat;
      const lng = element.center?.lon || element.lon || (element.geometry?.[0]?.lon) || area.lng;

      // Build polyline geometry from way nodes
      let trailGeometry: Array<{ latitude: number; longitude: number }> | undefined;
      if (element.geometry && element.geometry.length >= 2) {
        trailGeometry = element.geometry.map(pt => ({
          latitude: pt.lat,
          longitude: pt.lon,
        }));
      }

      // Parse distance if available
      let lengthMiles: number | undefined;
      const distStr = element.tags?.distance || element.tags?.length;
      if (distStr) {
        const numMatch = distStr.match(/[\d.]+/);
        if (numMatch) {
          let val = parseFloat(numMatch[0]);
          // If tagged in km, convert
          if (distStr.includes('km')) {
            val = val * 0.621371;
          }
          lengthMiles = Math.round(val * 10) / 10;
        }
      }

      // Map sac_scale to difficulty
      let difficulty: string | undefined;
      switch (element.tags?.sac_scale) {
        case 'hiking': difficulty = 'easy'; break;
        case 'mountain_hiking': difficulty = 'moderate'; break;
        case 'demanding_mountain_hiking': difficulty = 'hard'; break;
        case 'alpine_hiking': difficulty = 'hard'; break;
        case 'demanding_alpine_hiking': difficulty = 'hard'; break;
        case 'difficult_alpine_hiking': difficulty = 'hard'; break;
      }

      const trailId = `${stateCode.toLowerCase()}-osm-${element.id}`;

      trails.push({
        id: trailId,
        name: name,
        parkId: area.id,
        parkName: area.name,
        stateCode: stateCode,
        lengthMiles,
        difficulty,
        trailType: element.tags?.route === 'hiking' ? 'hiking' : (element.tags?.highway === 'path' ? 'hiking' : undefined),
        description: element.tags?.description,
        googleMapsUrl: generateGoogleMapsUrl(name, area.name, STATE_SEARCH_CONFIGS[stateCode].stateName),
        trailheadCoordinates: { latitude: lat, longitude: lng },
        geometry: trailGeometry,
        dataSource: 'openstreetmap',
        lastUpdated: new Date().toISOString().split('T')[0],
      });
    }

    console.log(`  [OSM] ${area.name}: ${trails.length} unique named trails from ${elements.length} elements`);
  } catch (error: any) {
    console.log(`  [OSM] Error for ${area.name}: ${error.message}`);
  }

  return trails;
}

// ============================================================================
// HELPERS
// ============================================================================

function generateGoogleMapsUrl(trailName: string, parkName: string, stateName: string): string {
  const query = `${trailName} trail ${parkName} ${stateName}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
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
    if (error.name === 'NoSuchKey') return null;
    console.log(`  [S3] Error: ${error.message}`);
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// MAIN
// ============================================================================

async function fetchForState(stateCode: string): Promise<{ usfsTrails: number; osmTrails: number; totalNew: number }> {
  const config = STATE_SEARCH_CONFIGS[stateCode];
  if (!config) {
    console.error(`No search config for state: ${stateCode}`);
    return { usfsTrails: 0, osmTrails: 0, totalNew: 0 };
  }

  console.log('============================================================');
  console.log(`${config.stateName} - USFS + OSM Trail Fetcher`);
  console.log('============================================================\n');

  const s3Client = new S3Client({ region: S3_REGION });

  // Load existing data
  console.log('Loading existing S3 trail data...');
  const existing = await getExistingS3Data(s3Client, stateCode);
  const existingParks = existing?.parks || {};

  // Build global name index for deduplication against existing trails
  const existingNames = new Set<string>();
  for (const parkData of Object.values(existingParks)) {
    for (const trail of parkData.trails) {
      existingNames.add(trail.name.toLowerCase().trim());
    }
  }
  console.log(`Existing: ${existingNames.size} unique trail names in S3\n`);

  let totalUSFS = 0;
  let totalOSM = 0;
  let totalNew = 0;

  for (const area of config.areas) {
    console.log(`\n--- ${area.name} ---`);

    // Fetch from both sources
    const usfsTrails = await fetchUSFSTrails(area, stateCode);
    await sleep(500); // Be polite to USFS
    const osmTrails = await fetchOSMTrails(area, stateCode);
    await sleep(1500); // Be polite to Overpass API

    // Merge new trails and backfill geometry on existing trails
    const newTrails: Trail[] = [];
    let geoBackfilled = 0;

    // Build a lookup of fetched trails by normalized name for geometry backfill
    const fetchedByName = new Map<string, Trail>();
    for (const trail of [...usfsTrails, ...osmTrails]) {
      const key = trail.name.toLowerCase().trim();
      // Prefer trail with longer geometry
      const existing = fetchedByName.get(key);
      if (!existing || (trail.geometry && trail.geometry.length > (existing.geometry?.length || 0))) {
        fetchedByName.set(key, trail);
      }
    }

    for (const [key, trail] of fetchedByName) {
      if (!existingNames.has(key)) {
        existingNames.add(key);
        newTrails.push(trail);
      } else if (trail.geometry && trail.geometry.length >= 2) {
        // Backfill geometry on existing trails that lack it
        for (const parkData of Object.values(existingParks)) {
          for (const existingTrail of parkData.trails) {
            if (existingTrail.name.toLowerCase().trim() === key && (!existingTrail.geometry || existingTrail.geometry.length < 2)) {
              existingTrail.geometry = trail.geometry;
              geoBackfilled++;
              break;
            }
          }
        }
      }
    }

    if (newTrails.length > 0) {
      // Group by parkId and add to existing data
      for (const trail of newTrails) {
        if (!existingParks[trail.parkId]) {
          existingParks[trail.parkId] = { parkName: trail.parkName, trails: [] };
        }
        existingParks[trail.parkId].trails.push(trail);
      }
      console.log(`  [New] ${newTrails.length} unique trails added (${usfsTrails.length} USFS candidates, ${osmTrails.length} OSM candidates)`);
    } else {
      console.log(`  [Skip] No new unique trails (all duplicates of existing data)`);
    }
    if (geoBackfilled > 0) {
      console.log(`  [Geo] ${geoBackfilled} existing trails backfilled with geometry`);
    }

    totalUSFS += usfsTrails.length;
    totalOSM += osmTrails.length;
    totalNew += newTrails.length;
  }

  // Count totals
  let totalTrails = 0;
  let totalParks = 0;
  const sourcesUsed = new Set<string>();
  for (const parkData of Object.values(existingParks)) {
    if (parkData.trails.length > 0) {
      totalParks++;
      totalTrails += parkData.trails.length;
      for (const trail of parkData.trails) {
        sourcesUsed.add(trail.dataSource);
      }
    }
  }

  // Build output
  const output: StateTrailOutput = {
    _meta: {
      stateCode: config.stateCode,
      stateName: config.stateName,
      lastUpdated: new Date().toISOString(),
      totalParks: totalParks,
      totalTrails: totalTrails,
      sources: Array.from(sourcesUsed),
    },
    parks: existingParks,
  };

  // Save local copy
  const outputDir = path.join(__dirname, '../sources/trails');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path.join(outputDir, `${stateCode.toLowerCase()}-trails.json`);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nWrote local copy to: ${outputPath}`);

  // Upload to S3
  console.log('Uploading to S3...');
  const key = `trails/state-parks/${stateCode}/trails.json`;
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
  console.log(`USFS candidates: ${totalUSFS}`);
  console.log(`OSM candidates:  ${totalOSM}`);
  console.log(`New unique:      ${totalNew}`);
  console.log(`Total in S3:     ${totalTrails} trails across ${totalParks} parks`);
  console.log(`Sources:         ${Array.from(sourcesUsed).join(', ')}`);

  return { usfsTrails: totalUSFS, osmTrails: totalOSM, totalNew };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
USFS + OpenStreetMap Trail Fetcher
===================================

Supplements existing trail data with USFS and OSM trails.
Merges into existing S3 data (delta updates only).

Usage:
  npx tsx data/scripts/fetchUSFSAndOSMTrails.ts <state_code>
  npx tsx data/scripts/fetchUSFSAndOSMTrails.ts all
  npx tsx data/scripts/fetchUSFSAndOSMTrails.ts --list

Available States: ${Object.keys(STATE_SEARCH_CONFIGS).join(', ')}
`);
    return;
  }

  if (args.includes('--list')) {
    console.log('\nConfigured States:\n');
    for (const [code, config] of Object.entries(STATE_SEARCH_CONFIGS)) {
      console.log(`  ${code} - ${config.stateName}`);
      console.log(`      Search areas: ${config.areas.length}`);
      console.log(`      Areas: ${config.areas.map(a => a.name).join(', ')}\n`);
    }
    return;
  }

  const stateArg = args[0].toUpperCase();

  if (stateArg === 'ALL') {
    console.log('Fetching USFS + OSM trails for ALL Appalachian states...\n');
    let grandTotal = { usfs: 0, osm: 0, newTrails: 0 };

    for (const code of Object.keys(STATE_SEARCH_CONFIGS)) {
      const result = await fetchForState(code);
      grandTotal.usfs += result.usfsTrails;
      grandTotal.osm += result.osmTrails;
      grandTotal.newTrails += result.totalNew;
      console.log('\n');
      // Wait between states to be polite to Overpass API
      await sleep(3000);
    }

    console.log('============================================================');
    console.log('ALL STATES COMPLETE');
    console.log(`USFS candidates: ${grandTotal.usfs}`);
    console.log(`OSM candidates:  ${grandTotal.osm}`);
    console.log(`New unique:      ${grandTotal.newTrails}`);
    return;
  }

  if (!STATE_SEARCH_CONFIGS[stateArg]) {
    console.error(`Unknown state: ${stateArg}`);
    console.log(`Available: ${Object.keys(STATE_SEARCH_CONFIGS).join(', ')}`);
    process.exit(1);
  }

  await fetchForState(stateArg);
}

main().catch(console.error);
