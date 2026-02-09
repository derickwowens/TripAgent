/**
 * Unified Postgres-Direct Data Sync
 * 
 * Fetches trail + campground data from free public APIs and writes directly
 * to PostgreSQL. No S3 intermediate step.
 * 
 * Sources:
 *   - USFS ArcGIS (US Forest Service trails with geometry)
 *   - OpenStreetMap Overpass API (hiking paths with geometry)
 *   - Recreation.gov RIDB API (campgrounds)
 * 
 * Usage:
 *   npx tsx data/scripts/syncToPostgres.ts trails           # Sync all 50 states trails
 *   npx tsx data/scripts/syncToPostgres.ts trails NC VA     # Sync specific states
 *   npx tsx data/scripts/syncToPostgres.ts campgrounds      # Sync all campgrounds
 *   npx tsx data/scripts/syncToPostgres.ts campgrounds NC   # Sync specific state campgrounds
 *   npx tsx data/scripts/syncToPostgres.ts all              # Sync everything
 *   npx tsx data/scripts/syncToPostgres.ts --list           # List configured states
 */

import { config } from 'dotenv';
config();

import { Pool } from 'pg';

// ============================================================================
// CONFIG
// ============================================================================

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required. Set it in .env');
  process.exit(1);
}

const RIDB_API_KEY = process.env.RECREATION_GOV_API_KEY || '';
const RIDB_BASE = 'https://ridb.recreation.gov/api/v1';
const USFS_ENDPOINT = 'https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_TrailNFSPublish_01/MapServer/0/query';
const OVERPASS_API = 'https://overpass-api.de/api/interpreter';
const BATCH_SIZE = 500;

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('railway.app') ? { rejectUnauthorized: false } : undefined,
  max: 5,
});

// ============================================================================
// TYPES
// ============================================================================

interface SearchArea {
  id: string;
  name: string;
  lat: number;
  lng: number;
  bbox: { south: number; west: number; north: number; east: number };
}

interface StateConfig {
  stateCode: string;
  stateName: string;
  centerLat: number;
  centerLng: number;
  areas: SearchArea[];
}

interface TrailRow {
  id: string;
  parkId: string;
  parkName: string;
  stateCode: string;
  name: string;
  description: string | null;
  lengthMiles: number | null;
  difficulty: string | null;
  trailType: string | null;
  latitude: number;
  longitude: number;
  geometryJson: string | null;
  officialUrl: string | null;
  alltrailsUrl: string | null;
  googleMapsUrl: string | null;
  dataSource: string;
}

interface CampgroundRow {
  id: string;
  name: string;
  stateCode: string;
  parkName: string | null;
  description: string | null;
  latitude: number;
  longitude: number;
  totalSites: number | null;
  reservationUrl: string | null;
  googleMapsUrl: string | null;
  dataSource: string;
}

// ============================================================================
// STATE CONFIGS — All 50 states with USFS/OSM search areas
// ============================================================================

const STATES: Record<string, StateConfig> = {
  AL: { stateCode: 'AL', stateName: 'Alabama', centerLat: 33.0, centerLng: -87.0, areas: [
    { id: 'bankhead-nf', name: 'Bankhead NF / Sipsey Wilderness', lat: 34.30, lng: -87.40, bbox: { south: 34.0, west: -87.7, north: 34.6, east: -87.1 } },
    { id: 'talladega-nf', name: 'Talladega National Forest / Cheaha', lat: 33.50, lng: -85.80, bbox: { south: 33.2, west: -86.1, north: 33.8, east: -85.5 } },
    { id: 'conecuh-nf', name: 'Conecuh National Forest', lat: 31.15, lng: -86.60, bbox: { south: 30.9, west: -86.9, north: 31.4, east: -86.3 } },
  ]},
  AK: { stateCode: 'AK', stateName: 'Alaska', centerLat: 63.3, centerLng: -150.5, areas: [
    { id: 'chugach-nf', name: 'Chugach National Forest', lat: 60.80, lng: -149.00, bbox: { south: 60.5, west: -149.5, north: 61.1, east: -148.5 } },
    { id: 'tongass-nf-juneau', name: 'Tongass NF / Juneau Area', lat: 58.30, lng: -134.40, bbox: { south: 58.0, west: -134.8, north: 58.6, east: -134.0 } },
    { id: 'denali-area', name: 'Denali NP Area', lat: 63.50, lng: -150.50, bbox: { south: 63.2, west: -151.0, north: 63.8, east: -150.0 } },
  ]},
  AZ: { stateCode: 'AZ', stateName: 'Arizona', centerLat: 34.5, centerLng: -111.5, areas: [
    { id: 'coconino-nf', name: 'Coconino NF / Sedona / Flagstaff', lat: 34.90, lng: -111.70, bbox: { south: 34.6, west: -112.0, north: 35.2, east: -111.4 } },
    { id: 'prescott-nf', name: 'Prescott National Forest', lat: 34.55, lng: -112.50, bbox: { south: 34.3, west: -112.8, north: 34.8, east: -112.2 } },
    { id: 'tonto-nf', name: 'Tonto National Forest', lat: 33.80, lng: -111.30, bbox: { south: 33.5, west: -111.6, north: 34.1, east: -111.0 } },
    { id: 'coronado-nf-south', name: 'Coronado NF / Tucson', lat: 32.40, lng: -110.75, bbox: { south: 32.1, west: -111.1, north: 32.7, east: -110.4 } },
    { id: 'grand-canyon-area', name: 'Grand Canyon NP Area', lat: 36.10, lng: -112.10, bbox: { south: 35.8, west: -112.4, north: 36.4, east: -111.8 } },
    { id: 'superstition-wilderness', name: 'Superstition Wilderness', lat: 33.45, lng: -111.20, bbox: { south: 33.3, west: -111.4, north: 33.6, east: -111.0 } },
  ]},
  AR: { stateCode: 'AR', stateName: 'Arkansas', centerLat: 34.7, centerLng: -92.3, areas: [
    { id: 'ozark-nf', name: 'Ozark National Forest', lat: 35.70, lng: -93.30, bbox: { south: 35.4, west: -93.7, north: 36.0, east: -92.9 } },
    { id: 'buffalo-river', name: 'Buffalo National River', lat: 36.03, lng: -92.90, bbox: { south: 35.8, west: -93.3, north: 36.3, east: -92.5 } },
    { id: 'hot-springs-np', name: 'Hot Springs National Park', lat: 34.52, lng: -93.04, bbox: { south: 34.3, west: -93.3, north: 34.7, east: -92.8 } },
    { id: 'devils-den-area', name: "Devil's Den / NW Arkansas", lat: 35.78, lng: -94.24, bbox: { south: 35.5, west: -94.5, north: 36.0, east: -94.0 } },
  ]},
  CA: { stateCode: 'CA', stateName: 'California', centerLat: 37.5, centerLng: -119.5, areas: [
    { id: 'sierra-nf-yosemite', name: 'Sierra NF / Yosemite', lat: 37.75, lng: -119.60, bbox: { south: 37.4, west: -120.0, north: 38.1, east: -119.2 } },
    { id: 'sequoia-kings-canyon', name: 'Sequoia / Kings Canyon', lat: 36.50, lng: -118.60, bbox: { south: 36.2, west: -119.0, north: 36.8, east: -118.2 } },
    { id: 'inyo-nf-eastern-sierra', name: 'Inyo NF / Eastern Sierra', lat: 37.50, lng: -118.60, bbox: { south: 37.2, west: -119.0, north: 37.8, east: -118.2 } },
    { id: 'lake-tahoe-ca', name: 'Lake Tahoe CA / Desolation', lat: 38.90, lng: -120.10, bbox: { south: 38.7, west: -120.4, north: 39.1, east: -119.8 } },
    { id: 'shasta-trinity-nf', name: 'Shasta-Trinity NF', lat: 41.00, lng: -122.40, bbox: { south: 40.7, west: -122.8, north: 41.3, east: -122.0 } },
    { id: 'los-padres-nf', name: 'Los Padres NF', lat: 34.70, lng: -119.80, bbox: { south: 34.4, west: -120.2, north: 35.0, east: -119.4 } },
    { id: 'angeles-nf', name: 'Angeles NF', lat: 34.30, lng: -118.10, bbox: { south: 34.1, west: -118.4, north: 34.5, east: -117.8 } },
    { id: 'san-bernardino-nf', name: 'San Bernardino NF', lat: 34.15, lng: -116.90, bbox: { south: 33.9, west: -117.2, north: 34.4, east: -116.6 } },
    { id: 'cleveland-nf', name: 'Cleveland NF', lat: 33.40, lng: -116.70, bbox: { south: 33.1, west: -117.0, north: 33.7, east: -116.4 } },
    { id: 'point-reyes-marin', name: 'Point Reyes / Marin', lat: 38.05, lng: -122.80, bbox: { south: 37.8, west: -123.1, north: 38.2, east: -122.5 } },
    { id: 'big-sur-ventana', name: 'Big Sur / Ventana', lat: 36.20, lng: -121.70, bbox: { south: 35.9, west: -122.0, north: 36.5, east: -121.4 } },
    { id: 'redwood-coast', name: 'Redwood NP / North Coast', lat: 41.30, lng: -124.00, bbox: { south: 41.0, west: -124.3, north: 41.6, east: -123.7 } },
  ]},
  CO: { stateCode: 'CO', stateName: 'Colorado', centerLat: 39.0, centerLng: -105.5, areas: [
    { id: 'rmnp-area', name: 'Rocky Mountain NP Area', lat: 40.35, lng: -105.70, bbox: { south: 40.1, west: -106.0, north: 40.6, east: -105.4 } },
    { id: 'white-river-nf', name: 'White River NF / Vail / Aspen', lat: 39.50, lng: -106.60, bbox: { south: 39.2, west: -107.0, north: 39.8, east: -106.2 } },
    { id: 'pike-san-isabel', name: 'Pike / San Isabel NF', lat: 39.00, lng: -105.50, bbox: { south: 38.7, west: -105.9, north: 39.3, east: -105.1 } },
    { id: 'san-juan-nf', name: 'San Juan NF / Durango', lat: 37.60, lng: -107.80, bbox: { south: 37.3, west: -108.2, north: 37.9, east: -107.4 } },
    { id: 'uncompahgre-nf', name: 'Uncompahgre NF / Telluride', lat: 38.00, lng: -107.80, bbox: { south: 37.7, west: -108.2, north: 38.3, east: -107.4 } },
    { id: 'maroon-bells-area', name: 'Maroon Bells / Snowmass', lat: 39.07, lng: -107.00, bbox: { south: 38.9, west: -107.3, north: 39.3, east: -106.7 } },
    { id: 'indian-peaks', name: 'Indian Peaks Wilderness', lat: 40.05, lng: -105.65, bbox: { south: 39.9, west: -105.9, north: 40.2, east: -105.4 } },
  ]},
  CT: { stateCode: 'CT', stateName: 'Connecticut', centerLat: 41.6, centerLng: -72.7, areas: [
    { id: 'at-corridor-ct', name: 'Appalachian Trail CT Section', lat: 41.85, lng: -73.35, bbox: { south: 41.6, west: -73.6, north: 42.1, east: -73.1 } },
    { id: 'sleeping-giant', name: 'Sleeping Giant / Metacomet', lat: 41.42, lng: -72.90, bbox: { south: 41.2, west: -73.2, north: 41.6, east: -72.6 } },
    { id: 'peoples-state-forest', name: "People's SF / Barkhamsted", lat: 41.90, lng: -73.00, bbox: { south: 41.7, west: -73.2, north: 42.1, east: -72.8 } },
  ]},
  DE: { stateCode: 'DE', stateName: 'Delaware', centerLat: 39.0, centerLng: -75.5, areas: [
    { id: 'brandywine-creek', name: 'Brandywine Creek / White Clay', lat: 39.80, lng: -75.58, bbox: { south: 39.6, west: -75.8, north: 40.0, east: -75.4 } },
    { id: 'cape-henlopen', name: 'Cape Henlopen / Rehoboth', lat: 38.78, lng: -75.10, bbox: { south: 38.6, west: -75.3, north: 39.0, east: -74.9 } },
  ]},
  FL: { stateCode: 'FL', stateName: 'Florida', centerLat: 28.5, centerLng: -81.5, areas: [
    { id: 'ocala-nf', name: 'Ocala National Forest', lat: 29.20, lng: -81.70, bbox: { south: 28.9, west: -82.0, north: 29.5, east: -81.4 } },
    { id: 'apalachicola-nf', name: 'Apalachicola NF', lat: 30.20, lng: -84.70, bbox: { south: 29.9, west: -85.0, north: 30.5, east: -84.4 } },
    { id: 'osceola-nf', name: 'Osceola NF', lat: 30.30, lng: -82.50, bbox: { south: 30.1, west: -82.8, north: 30.5, east: -82.2 } },
    { id: 'everglades-area', name: 'Everglades / Big Cypress', lat: 25.80, lng: -80.90, bbox: { south: 25.5, west: -81.3, north: 26.1, east: -80.5 } },
    { id: 'florida-trail-north', name: 'Florida Trail / Panhandle', lat: 30.50, lng: -85.50, bbox: { south: 30.2, west: -85.9, north: 30.8, east: -85.1 } },
  ]},
  GA: { stateCode: 'GA', stateName: 'Georgia', centerLat: 34.5, centerLng: -84.0, areas: [
    { id: 'chattahoochee-nf-north', name: 'Chattahoochee NF North', lat: 34.85, lng: -84.00, bbox: { south: 34.6, west: -84.4, north: 35.1, east: -83.6 } },
    { id: 'chattahoochee-nf-central', name: 'Chattahoochee NF Central', lat: 34.60, lng: -84.20, bbox: { south: 34.4, west: -84.5, north: 34.8, east: -83.9 } },
    { id: 'cohutta-wilderness', name: 'Cohutta Wilderness', lat: 34.92, lng: -84.63, bbox: { south: 34.7, west: -84.8, north: 35.1, east: -84.4 } },
    { id: 'springer-at', name: 'Springer Mountain / AT', lat: 34.63, lng: -84.19, bbox: { south: 34.5, west: -84.4, north: 34.8, east: -84.0 } },
    { id: 'tallulah-area', name: 'Tallulah Gorge / Chattooga', lat: 34.74, lng: -83.39, bbox: { south: 34.5, west: -83.6, north: 34.9, east: -83.2 } },
    { id: 'cloudland-area', name: 'Cloudland Canyon Area', lat: 34.84, lng: -85.48, bbox: { south: 34.7, west: -85.6, north: 35.0, east: -85.3 } },
  ]},
  HI: { stateCode: 'HI', stateName: 'Hawaii', centerLat: 20.7, centerLng: -156.3, areas: [
    { id: 'na-pali-kauai', name: 'Na Pali Coast / Kauai', lat: 22.17, lng: -159.63, bbox: { south: 22.0, west: -159.8, north: 22.3, east: -159.5 } },
    { id: 'volcanoes-np', name: 'Hawaii Volcanoes NP', lat: 19.42, lng: -155.23, bbox: { south: 19.2, west: -155.5, north: 19.6, east: -155.0 } },
    { id: 'haleakala-maui', name: 'Haleakala / Maui', lat: 20.72, lng: -156.17, bbox: { south: 20.5, west: -156.4, north: 20.9, east: -155.9 } },
  ]},
  ID: { stateCode: 'ID', stateName: 'Idaho', centerLat: 44.5, centerLng: -114.5, areas: [
    { id: 'sawtooth-nra', name: 'Sawtooth NRA / Stanley', lat: 43.90, lng: -114.90, bbox: { south: 43.6, west: -115.3, north: 44.2, east: -114.5 } },
    { id: 'boise-nf', name: 'Boise NF', lat: 44.00, lng: -115.50, bbox: { south: 43.7, west: -115.9, north: 44.3, east: -115.1 } },
    { id: 'salmon-challis', name: 'Salmon-Challis NF', lat: 44.50, lng: -114.00, bbox: { south: 44.2, west: -114.4, north: 44.8, east: -113.6 } },
    { id: 'caribou-targhee', name: 'Caribou-Targhee NF / Teton Valley', lat: 43.50, lng: -111.50, bbox: { south: 43.2, west: -111.9, north: 43.8, east: -111.1 } },
    { id: 'nez-perce-clearwater', name: 'Nez Perce-Clearwater NF', lat: 46.50, lng: -115.50, bbox: { south: 46.2, west: -115.9, north: 46.8, east: -115.1 } },
    { id: 'panhandle-nf', name: 'Idaho Panhandle NF', lat: 47.50, lng: -116.50, bbox: { south: 47.2, west: -116.9, north: 47.8, east: -116.1 } },
  ]},
  IL: { stateCode: 'IL', stateName: 'Illinois', centerLat: 40.0, centerLng: -89.0, areas: [
    { id: 'shawnee-nf-east', name: 'Shawnee NF East / Garden of the Gods', lat: 37.60, lng: -88.30, bbox: { south: 37.3, west: -88.6, north: 37.9, east: -88.0 } },
    { id: 'shawnee-nf-west', name: 'Shawnee NF West / Giant City', lat: 37.55, lng: -89.10, bbox: { south: 37.3, west: -89.4, north: 37.8, east: -88.8 } },
    { id: 'starved-rock-area', name: 'Starved Rock / Illinois River', lat: 41.32, lng: -88.98, bbox: { south: 41.1, west: -89.2, north: 41.5, east: -88.7 } },
  ]},
  IN: { stateCode: 'IN', stateName: 'Indiana', centerLat: 41.6, centerLng: -87.0, areas: [
    { id: 'indiana-dunes-np', name: 'Indiana Dunes NP', lat: 41.65, lng: -87.05, bbox: { south: 41.5, west: -87.3, north: 41.8, east: -86.8 } },
    { id: 'hoosier-nf', name: 'Hoosier NF', lat: 38.50, lng: -86.50, bbox: { south: 38.2, west: -86.8, north: 38.8, east: -86.2 } },
    { id: 'brown-county-area', name: 'Brown County / Turkey Run', lat: 39.15, lng: -86.23, bbox: { south: 38.9, west: -86.5, north: 39.4, east: -86.0 } },
  ]},
  IA: { stateCode: 'IA', stateName: 'Iowa', centerLat: 42.0, centerLng: -93.5, areas: [
    { id: 'yellow-river-sf', name: 'Yellow River State Forest / Effigy Mounds', lat: 43.10, lng: -91.30, bbox: { south: 42.9, west: -91.6, north: 43.3, east: -91.0 } },
    { id: 'ledges-sp', name: 'Ledges SP / Des Moines River', lat: 42.00, lng: -93.90, bbox: { south: 41.8, west: -94.2, north: 42.2, east: -93.6 } },
    { id: 'loess-hills', name: 'Loess Hills / Hitchcock Nature', lat: 41.70, lng: -95.80, bbox: { south: 41.5, west: -96.0, north: 41.9, east: -95.6 } },
  ]},
  KS: { stateCode: 'KS', stateName: 'Kansas', centerLat: 38.5, centerLng: -98.0, areas: [
    { id: 'flint-hills', name: 'Flint Hills / Tallgrass Prairie', lat: 38.43, lng: -96.56, bbox: { south: 38.2, west: -96.8, north: 38.7, east: -96.3 } },
    { id: 'kanopolis-sp', name: 'Kanopolis SP / Mushroom Rock', lat: 38.70, lng: -98.15, bbox: { south: 38.5, west: -98.4, north: 38.9, east: -97.9 } },
    { id: 'clinton-lake', name: 'Clinton Lake / Perry Lake', lat: 38.90, lng: -95.40, bbox: { south: 38.7, west: -95.7, north: 39.1, east: -95.1 } },
  ]},
  KY: { stateCode: 'KY', stateName: 'Kentucky', centerLat: 37.5, centerLng: -84.0, areas: [
    { id: 'dbnf-north', name: 'Daniel Boone NF North', lat: 38.00, lng: -83.70, bbox: { south: 37.7, west: -84.1, north: 38.3, east: -83.3 } },
    { id: 'dbnf-central', name: 'Daniel Boone NF Central (Red River Gorge)', lat: 37.80, lng: -83.62, bbox: { south: 37.6, west: -83.9, north: 38.0, east: -83.3 } },
    { id: 'dbnf-south', name: 'Daniel Boone NF South', lat: 37.00, lng: -84.30, bbox: { south: 36.7, west: -84.7, north: 37.3, east: -83.9 } },
    { id: 'cumberland-gap', name: 'Cumberland Gap', lat: 36.60, lng: -83.67, bbox: { south: 36.4, west: -83.9, north: 36.8, east: -83.4 } },
    { id: 'pine-mountain', name: 'Pine Mountain Trail', lat: 36.85, lng: -83.45, bbox: { south: 36.7, west: -83.8, north: 37.0, east: -83.1 } },
    { id: 'mammoth-cave-area', name: 'Mammoth Cave Area', lat: 37.19, lng: -86.10, bbox: { south: 37.0, west: -86.3, north: 37.4, east: -85.9 } },
  ]},
  LA: { stateCode: 'LA', stateName: 'Louisiana', centerLat: 31.0, centerLng: -92.0, areas: [
    { id: 'kisatchie-nf', name: 'Kisatchie National Forest', lat: 31.50, lng: -92.70, bbox: { south: 31.2, west: -93.0, north: 31.8, east: -92.4 } },
    { id: 'tunica-hills', name: 'Tunica Hills / Clark Creek', lat: 30.95, lng: -91.50, bbox: { south: 30.8, west: -91.7, north: 31.1, east: -91.3 } },
    { id: 'chicot-sp', name: 'Chicot SP / Atchafalaya', lat: 30.80, lng: -92.30, bbox: { south: 30.6, west: -92.5, north: 31.0, east: -92.1 } },
  ]},
  ME: { stateCode: 'ME', stateName: 'Maine', centerLat: 45.0, centerLng: -69.0, areas: [
    { id: 'baxter-katahdin', name: 'Baxter SP / Katahdin', lat: 45.90, lng: -68.92, bbox: { south: 45.7, west: -69.2, north: 46.1, east: -68.6 } },
    { id: 'acadia', name: 'Acadia NP', lat: 44.34, lng: -68.27, bbox: { south: 44.2, west: -68.5, north: 44.5, east: -68.0 } },
    { id: '100-mile-wilderness', name: '100-Mile Wilderness', lat: 45.50, lng: -69.10, bbox: { south: 45.2, west: -69.4, north: 45.8, east: -68.8 } },
    { id: 'wmnf-maine', name: 'White Mountain NF Maine', lat: 44.30, lng: -71.00, bbox: { south: 44.1, west: -71.3, north: 44.5, east: -70.7 } },
    { id: 'bigelow-area', name: 'Bigelow Preserve / Flagstaff', lat: 45.13, lng: -70.28, bbox: { south: 44.9, west: -70.6, north: 45.4, east: -70.0 } },
  ]},
  MD: { stateCode: 'MD', stateName: 'Maryland', centerLat: 39.3, centerLng: -77.0, areas: [
    { id: 'catoctin-area', name: 'Catoctin Mountain / Cunningham Falls', lat: 39.65, lng: -77.45, bbox: { south: 39.4, west: -77.7, north: 39.9, east: -77.2 } },
    { id: 'green-ridge-savage', name: 'Green Ridge / Savage River SF', lat: 39.60, lng: -78.80, bbox: { south: 39.3, west: -79.2, north: 39.9, east: -78.4 } },
    { id: 'patapsco-area', name: 'Patapsco Valley / Gunpowder Falls', lat: 39.35, lng: -76.65, bbox: { south: 39.1, west: -76.9, north: 39.6, east: -76.4 } },
  ]},
  MA: { stateCode: 'MA', stateName: 'Massachusetts', centerLat: 42.3, centerLng: -72.0, areas: [
    { id: 'berkshires', name: 'Berkshires / Mount Greylock', lat: 42.50, lng: -73.20, bbox: { south: 42.2, west: -73.5, north: 42.8, east: -72.9 } },
    { id: 'blue-hills', name: 'Blue Hills / SE MA', lat: 42.22, lng: -71.10, bbox: { south: 42.0, west: -71.3, north: 42.4, east: -70.9 } },
    { id: 'conn-valley', name: 'Connecticut River Valley / Mount Tom', lat: 42.25, lng: -72.63, bbox: { south: 42.0, west: -72.9, north: 42.5, east: -72.4 } },
    { id: 'cape-cod', name: 'Cape Cod National Seashore', lat: 41.85, lng: -70.00, bbox: { south: 41.7, west: -70.2, north: 42.0, east: -69.8 } },
  ]},
  MI: { stateCode: 'MI', stateName: 'Michigan', centerLat: 44.5, centerLng: -84.5, areas: [
    { id: 'hiawatha-nf', name: 'Hiawatha NF', lat: 46.30, lng: -86.50, bbox: { south: 46.0, west: -86.8, north: 46.6, east: -86.2 } },
    { id: 'pictured-rocks', name: 'Pictured Rocks NL', lat: 46.55, lng: -86.35, bbox: { south: 46.4, west: -86.6, north: 46.7, east: -86.1 } },
    { id: 'huron-manistee-nf', name: 'Huron-Manistee NF', lat: 44.40, lng: -85.80, bbox: { south: 44.1, west: -86.1, north: 44.7, east: -85.5 } },
    { id: 'porcupine-mountains', name: 'Porcupine Mountains / Western UP', lat: 46.75, lng: -89.80, bbox: { south: 46.5, west: -90.1, north: 47.0, east: -89.5 } },
    { id: 'sleeping-bear-dunes', name: 'Sleeping Bear Dunes', lat: 44.85, lng: -86.05, bbox: { south: 44.7, west: -86.3, north: 45.0, east: -85.8 } },
  ]},
  MN: { stateCode: 'MN', stateName: 'Minnesota', centerLat: 47.0, centerLng: -91.5, areas: [
    { id: 'superior-nf-east', name: 'Superior NF / BWCA East', lat: 48.00, lng: -90.50, bbox: { south: 47.7, west: -90.9, north: 48.3, east: -90.1 } },
    { id: 'superior-nf-west', name: 'Superior NF / BWCA West', lat: 47.95, lng: -91.50, bbox: { south: 47.7, west: -91.9, north: 48.2, east: -91.1 } },
    { id: 'north-shore', name: 'North Shore / Superior Hiking Trail', lat: 47.30, lng: -91.20, bbox: { south: 47.0, west: -91.6, north: 47.6, east: -90.8 } },
    { id: 'north-shore-north', name: 'North Shore Upper', lat: 47.70, lng: -90.40, bbox: { south: 47.5, west: -90.7, north: 47.9, east: -90.1 } },
    { id: 'chippewa-nf', name: 'Chippewa NF', lat: 47.30, lng: -94.30, bbox: { south: 47.0, west: -94.7, north: 47.6, east: -93.9 } },
    { id: 'bluff-country', name: 'SE MN Bluff Country', lat: 43.85, lng: -92.10, bbox: { south: 43.5, west: -92.5, north: 44.2, east: -91.7 } },
  ]},
  MS: { stateCode: 'MS', stateName: 'Mississippi', centerLat: 32.5, centerLng: -89.7, areas: [
    { id: 'de-soto-nf', name: 'De Soto National Forest', lat: 31.10, lng: -89.20, bbox: { south: 30.8, west: -89.5, north: 31.4, east: -88.9 } },
    { id: 'homochitto-nf', name: 'Homochitto NF', lat: 31.30, lng: -91.00, bbox: { south: 31.1, west: -91.3, north: 31.5, east: -90.7 } },
    { id: 'tishomingo-sp', name: 'Tishomingo SP', lat: 34.61, lng: -88.19, bbox: { south: 34.4, west: -88.4, north: 34.8, east: -88.0 } },
  ]},
  MO: { stateCode: 'MO', stateName: 'Missouri', centerLat: 38.6, centerLng: -90.2, areas: [
    { id: 'mark-twain-nf', name: 'Mark Twain NF', lat: 37.50, lng: -91.50, bbox: { south: 37.2, west: -91.8, north: 37.8, east: -91.2 } },
    { id: 'ozark-riverways', name: 'Ozark National Scenic Riverways', lat: 37.15, lng: -91.35, bbox: { south: 36.9, west: -91.7, north: 37.4, east: -91.0 } },
    { id: 'st-louis-area', name: 'Gateway Arch / St Louis', lat: 38.62, lng: -90.18, bbox: { south: 38.4, west: -90.5, north: 38.8, east: -89.9 } },
  ]},
  MT: { stateCode: 'MT', stateName: 'Montana', centerLat: 47.0, centerLng: -110.5, areas: [
    { id: 'glacier-west', name: 'Glacier NP West / Flathead', lat: 48.50, lng: -113.90, bbox: { south: 48.2, west: -114.3, north: 48.8, east: -113.5 } },
    { id: 'glacier-east', name: 'Glacier NP East / Many Glacier', lat: 48.80, lng: -113.65, bbox: { south: 48.5, west: -114.0, north: 49.0, east: -113.3 } },
    { id: 'flathead-nf', name: 'Flathead NF / Bob Marshall', lat: 47.80, lng: -113.50, bbox: { south: 47.5, west: -113.9, north: 48.1, east: -113.1 } },
    { id: 'gallatin-beartooth', name: 'Gallatin / Absaroka-Beartooth', lat: 45.30, lng: -110.00, bbox: { south: 45.0, west: -110.4, north: 45.6, east: -109.6 } },
    { id: 'bitterroot-nf', name: 'Bitterroot NF', lat: 46.00, lng: -114.00, bbox: { south: 45.7, west: -114.4, north: 46.3, east: -113.6 } },
    { id: 'lolo-nf', name: 'Lolo NF / Missoula', lat: 47.00, lng: -114.00, bbox: { south: 46.7, west: -114.4, north: 47.3, east: -113.6 } },
    { id: 'helena-nf', name: 'Helena-Lewis and Clark NF', lat: 47.00, lng: -112.50, bbox: { south: 46.7, west: -112.9, north: 47.3, east: -112.1 } },
  ]},
  NE: { stateCode: 'NE', stateName: 'Nebraska', centerLat: 41.5, centerLng: -100.0, areas: [
    { id: 'pine-ridge', name: 'Pine Ridge / Oglala NGL', lat: 42.80, lng: -103.00, bbox: { south: 42.6, west: -103.3, north: 43.0, east: -102.7 } },
    { id: 'niobrara-nsr', name: 'Niobrara National Scenic River', lat: 42.77, lng: -100.00, bbox: { south: 42.6, west: -100.3, north: 43.0, east: -99.7 } },
    { id: 'indian-cave-sp', name: 'Indian Cave SP / Missouri Bluffs', lat: 40.27, lng: -95.55, bbox: { south: 40.1, west: -95.8, north: 40.5, east: -95.3 } },
  ]},
  NV: { stateCode: 'NV', stateName: 'Nevada', centerLat: 39.0, centerLng: -117.0, areas: [
    { id: 'spring-mountains', name: 'Spring Mountains NRA / Mt Charleston', lat: 36.27, lng: -115.69, bbox: { south: 36.0, west: -116.0, north: 36.5, east: -115.4 } },
    { id: 'red-rock', name: 'Red Rock Canyon NCA', lat: 36.14, lng: -115.43, bbox: { south: 36.0, west: -115.6, north: 36.3, east: -115.2 } },
    { id: 'humboldt-toiyabe-south', name: 'Humboldt-Toiyabe NF South', lat: 36.30, lng: -115.70, bbox: { south: 36.0, west: -116.0, north: 36.6, east: -115.4 } },
    { id: 'lake-tahoe-nv', name: 'Lake Tahoe NV Side', lat: 39.18, lng: -119.92, bbox: { south: 39.0, west: -120.1, north: 39.4, east: -119.7 } },
  ]},
  NH: { stateCode: 'NH', stateName: 'New Hampshire', centerLat: 44.0, centerLng: -71.5, areas: [
    { id: 'wmnf-presidentials', name: 'White Mountain NF / Presidentials', lat: 44.27, lng: -71.30, bbox: { south: 44.0, west: -71.6, north: 44.5, east: -71.0 } },
    { id: 'wmnf-pemi', name: 'White Mountain NF / Pemigewasset', lat: 44.05, lng: -71.60, bbox: { south: 43.8, west: -71.9, north: 44.3, east: -71.3 } },
    { id: 'wmnf-kancamagus', name: 'White Mountain NF / Kancamagus', lat: 43.95, lng: -71.40, bbox: { south: 43.7, west: -71.7, north: 44.2, east: -71.1 } },
    { id: 'franconia-area', name: 'Franconia Notch', lat: 44.14, lng: -71.68, bbox: { south: 44.0, west: -71.8, north: 44.3, east: -71.5 } },
    { id: 'monadnock-area', name: 'Mount Monadnock', lat: 42.86, lng: -72.11, bbox: { south: 42.7, west: -72.3, north: 43.0, east: -71.9 } },
  ]},
  NJ: { stateCode: 'NJ', stateName: 'New Jersey', centerLat: 40.7, centerLng: -74.7, areas: [
    { id: 'at-corridor-nj', name: 'Appalachian Trail NJ / Delaware Water Gap', lat: 41.10, lng: -74.90, bbox: { south: 40.9, west: -75.1, north: 41.3, east: -74.7 } },
    { id: 'wharton-sf', name: 'Wharton State Forest / Pine Barrens', lat: 39.70, lng: -74.70, bbox: { south: 39.5, west: -74.9, north: 39.9, east: -74.5 } },
    { id: 'high-point-sp', name: 'High Point SP / Stokes SF', lat: 41.30, lng: -74.65, bbox: { south: 41.1, west: -74.9, north: 41.5, east: -74.4 } },
  ]},
  NM: { stateCode: 'NM', stateName: 'New Mexico', centerLat: 34.5, centerLng: -106.0, areas: [
    { id: 'santa-fe-nf', name: 'Santa Fe NF', lat: 35.85, lng: -105.75, bbox: { south: 35.5, west: -106.1, north: 36.2, east: -105.4 } },
    { id: 'carson-nf', name: 'Carson NF / Taos', lat: 36.50, lng: -105.50, bbox: { south: 36.2, west: -105.9, north: 36.8, east: -105.1 } },
    { id: 'gila-nf', name: 'Gila NF / Wilderness', lat: 33.30, lng: -108.30, bbox: { south: 33.0, west: -108.7, north: 33.6, east: -107.9 } },
    { id: 'cibola-nf-sandia', name: 'Cibola NF / Sandia Mountains', lat: 35.20, lng: -106.45, bbox: { south: 35.0, west: -106.7, north: 35.4, east: -106.2 } },
    { id: 'lincoln-nf', name: 'Lincoln NF', lat: 33.00, lng: -105.70, bbox: { south: 32.7, west: -106.0, north: 33.3, east: -105.4 } },
    { id: 'rio-grande-gorge', name: 'Rio Grande del Norte / Gorge', lat: 36.53, lng: -105.73, bbox: { south: 36.3, west: -106.0, north: 36.8, east: -105.5 } },
  ]},
  NY: { stateCode: 'NY', stateName: 'New York', centerLat: 43.0, centerLng: -74.5, areas: [
    { id: 'adirondack-high-peaks', name: 'Adirondack High Peaks', lat: 44.11, lng: -73.92, bbox: { south: 43.9, west: -74.2, north: 44.4, east: -73.6 } },
    { id: 'adirondack-central', name: 'Adirondack Central', lat: 43.80, lng: -74.30, bbox: { south: 43.5, west: -74.7, north: 44.1, east: -73.9 } },
    { id: 'adirondack-south', name: 'Adirondack South', lat: 43.40, lng: -74.50, bbox: { south: 43.1, west: -74.9, north: 43.7, east: -74.1 } },
    { id: 'catskills', name: 'Catskill Park', lat: 42.10, lng: -74.25, bbox: { south: 41.8, west: -74.6, north: 42.4, east: -73.9 } },
    { id: 'harriman-bear', name: 'Harriman / Bear Mountain', lat: 41.28, lng: -74.05, bbox: { south: 41.1, west: -74.2, north: 41.5, east: -73.8 } },
    { id: 'shawangunks', name: 'Shawangunk Ridge (Minnewaska/Mohonk)', lat: 41.73, lng: -74.23, bbox: { south: 41.6, west: -74.4, north: 41.9, east: -74.1 } },
    { id: 'finger-lakes', name: 'Finger Lakes Trail Region', lat: 42.45, lng: -76.70, bbox: { south: 42.2, west: -77.2, north: 42.7, east: -76.2 } },
    { id: 'letchworth-area', name: 'Letchworth / Genesee Valley', lat: 42.58, lng: -77.97, bbox: { south: 42.4, west: -78.2, north: 42.8, east: -77.7 } },
  ]},
  NC: { stateCode: 'NC', stateName: 'North Carolina', centerLat: 35.5, centerLng: -82.5, areas: [
    { id: 'pisgah-nf', name: 'Pisgah NF', lat: 35.35, lng: -82.75, bbox: { south: 35.0, west: -83.2, north: 35.7, east: -82.3 } },
    { id: 'nantahala-nf', name: 'Nantahala NF', lat: 35.25, lng: -83.50, bbox: { south: 35.0, west: -83.9, north: 35.5, east: -83.1 } },
    { id: 'uwharrie-nf', name: 'Uwharrie NF', lat: 35.40, lng: -80.05, bbox: { south: 35.2, west: -80.2, north: 35.6, east: -79.9 } },
    { id: 'blue-ridge-nc', name: 'Blue Ridge Parkway NC', lat: 35.70, lng: -82.00, bbox: { south: 35.3, west: -82.5, north: 36.1, east: -81.5 } },
    { id: 'dupont-sf', name: 'DuPont State Forest', lat: 35.20, lng: -82.62, bbox: { south: 35.1, west: -82.7, north: 35.3, east: -82.5 } },
    { id: 'gorges-area', name: 'Gorges / Jocassee', lat: 35.09, lng: -82.95, bbox: { south: 34.9, west: -83.2, north: 35.2, east: -82.7 } },
  ]},
  ND: { stateCode: 'ND', stateName: 'North Dakota', centerLat: 47.0, centerLng: -103.5, areas: [
    { id: 'theodore-roosevelt-south', name: 'Theodore Roosevelt NP South', lat: 46.98, lng: -103.54, bbox: { south: 46.7, west: -103.9, north: 47.2, east: -103.2 } },
    { id: 'theodore-roosevelt-north', name: 'Theodore Roosevelt NP North', lat: 47.59, lng: -103.39, bbox: { south: 47.4, west: -103.7, north: 47.8, east: -103.1 } },
    { id: 'maah-daah-hey', name: 'Maah Daah Hey Trail', lat: 47.20, lng: -103.40, bbox: { south: 46.8, west: -103.8, north: 47.6, east: -103.0 } },
  ]},
  OH: { stateCode: 'OH', stateName: 'Ohio', centerLat: 40.5, centerLng: -82.5, areas: [
    { id: 'wayne-nf', name: 'Wayne NF', lat: 39.30, lng: -82.10, bbox: { south: 39.0, west: -82.5, north: 39.6, east: -81.7 } },
    { id: 'hocking-hills', name: 'Hocking Hills Region', lat: 39.43, lng: -82.53, bbox: { south: 39.2, west: -82.8, north: 39.7, east: -82.3 } },
    { id: 'cuyahoga-valley', name: 'Cuyahoga Valley NP', lat: 41.25, lng: -81.55, bbox: { south: 41.1, west: -81.7, north: 41.4, east: -81.4 } },
  ]},
  OK: { stateCode: 'OK', stateName: 'Oklahoma', centerLat: 35.5, centerLng: -97.5, areas: [
    { id: 'wichita-mountains', name: 'Wichita Mountains NWR', lat: 34.75, lng: -98.70, bbox: { south: 34.6, west: -98.9, north: 34.9, east: -98.5 } },
    { id: 'ouachita-nf-ok', name: 'Ouachita NF Oklahoma', lat: 34.70, lng: -94.80, bbox: { south: 34.5, west: -95.1, north: 34.9, east: -94.5 } },
    { id: 'beavers-bend-area', name: 'Beavers Bend / SE Oklahoma', lat: 34.15, lng: -94.72, bbox: { south: 33.9, west: -95.0, north: 34.4, east: -94.5 } },
  ]},
  OR: { stateCode: 'OR', stateName: 'Oregon', centerLat: 44.0, centerLng: -121.5, areas: [
    { id: 'mt-hood-nf', name: 'Mt Hood NF', lat: 45.35, lng: -121.70, bbox: { south: 45.1, west: -122.0, north: 45.6, east: -121.4 } },
    { id: 'deschutes-nf', name: 'Deschutes NF / Bend', lat: 43.90, lng: -121.70, bbox: { south: 43.6, west: -122.0, north: 44.2, east: -121.4 } },
    { id: 'willamette-nf', name: 'Willamette NF', lat: 43.80, lng: -122.10, bbox: { south: 43.5, west: -122.4, north: 44.1, east: -121.8 } },
    { id: 'crater-lake-area', name: 'Crater Lake / Rogue River NF', lat: 42.90, lng: -122.10, bbox: { south: 42.6, west: -122.4, north: 43.2, east: -121.8 } },
    { id: 'columbia-gorge', name: 'Columbia River Gorge', lat: 45.60, lng: -121.80, bbox: { south: 45.4, west: -122.2, north: 45.8, east: -121.4 } },
    { id: 'eagle-cap-wallowas', name: 'Eagle Cap / Wallowas', lat: 45.20, lng: -117.30, bbox: { south: 44.9, west: -117.7, north: 45.5, east: -116.9 } },
  ]},
  PA: { stateCode: 'PA', stateName: 'Pennsylvania', centerLat: 41.0, centerLng: -77.5, areas: [
    { id: 'allegheny-nf', name: 'Allegheny NF', lat: 41.75, lng: -79.00, bbox: { south: 41.4, west: -79.4, north: 42.0, east: -78.6 } },
    { id: 'poconos', name: 'Poconos / Delaware Water Gap', lat: 41.05, lng: -75.10, bbox: { south: 40.8, west: -75.4, north: 41.3, east: -74.8 } },
    { id: 'pa-grand-canyon', name: 'PA Grand Canyon / Pine Creek Gorge', lat: 41.70, lng: -77.45, bbox: { south: 41.5, west: -77.7, north: 41.9, east: -77.2 } },
    { id: 'loyalsock-worlds-end', name: 'Loyalsock / Worlds End', lat: 41.42, lng: -76.65, bbox: { south: 41.2, west: -76.9, north: 41.6, east: -76.4 } },
    { id: 'ohiopyle-area', name: 'Ohiopyle / Laurel Highlands', lat: 39.87, lng: -79.48, bbox: { south: 39.7, west: -79.7, north: 40.1, east: -79.2 } },
    { id: 'ricketts-glen-area', name: 'Ricketts Glen / North Mountain', lat: 41.33, lng: -76.28, bbox: { south: 41.1, west: -76.5, north: 41.5, east: -76.0 } },
    { id: 'at-corridor-pa', name: 'Appalachian Trail PA', lat: 40.30, lng: -77.10, bbox: { south: 40.0, west: -77.4, north: 40.6, east: -76.8 } },
    { id: 'rothrock-bald-eagle', name: 'Rothrock / Bald Eagle SF', lat: 40.80, lng: -77.50, bbox: { south: 40.6, west: -77.8, north: 41.0, east: -77.2 } },
  ]},
  RI: { stateCode: 'RI', stateName: 'Rhode Island', centerLat: 41.6, centerLng: -71.5, areas: [
    { id: 'arcadia-mgmt', name: 'Arcadia Management Area', lat: 41.58, lng: -71.72, bbox: { south: 41.4, west: -71.9, north: 41.7, east: -71.5 } },
    { id: 'george-washington-mgmt', name: 'George Washington Management Area', lat: 41.93, lng: -71.73, bbox: { south: 41.8, west: -71.9, north: 42.1, east: -71.6 } },
  ]},
  SC: { stateCode: 'SC', stateName: 'South Carolina', centerLat: 34.0, centerLng: -81.0, areas: [
    { id: 'sumter-nf-pickens', name: 'Sumter NF Andrew Pickens', lat: 34.85, lng: -83.10, bbox: { south: 34.6, west: -83.4, north: 35.1, east: -82.8 } },
    { id: 'sumter-nf-long-cane', name: 'Sumter NF Long Cane', lat: 34.10, lng: -82.30, bbox: { south: 33.8, west: -82.6, north: 34.4, east: -82.0 } },
    { id: 'francis-marion-nf', name: 'Francis Marion NF', lat: 33.15, lng: -79.75, bbox: { south: 32.9, west: -80.1, north: 33.4, east: -79.4 } },
    { id: 'jocassee-gorges', name: 'Jocassee Gorges / Blue Ridge', lat: 35.05, lng: -82.80, bbox: { south: 34.8, west: -83.1, north: 35.2, east: -82.5 } },
    { id: 'congaree-area', name: 'Congaree / Midlands', lat: 33.78, lng: -80.78, bbox: { south: 33.6, west: -81.0, north: 34.0, east: -80.5 } },
  ]},
  SD: { stateCode: 'SD', stateName: 'South Dakota', centerLat: 43.8, centerLng: -100.0, areas: [
    { id: 'badlands-np', name: 'Badlands NP', lat: 43.86, lng: -102.34, bbox: { south: 43.6, west: -102.8, north: 44.1, east: -101.9 } },
    { id: 'black-hills-nf', name: 'Black Hills NF', lat: 44.00, lng: -103.75, bbox: { south: 43.5, west: -104.2, north: 44.5, east: -103.3 } },
    { id: 'wind-cave-custer', name: 'Wind Cave NP / Custer SP', lat: 43.60, lng: -103.48, bbox: { south: 43.4, west: -103.8, north: 43.8, east: -103.2 } },
  ]},
  TN: { stateCode: 'TN', stateName: 'Tennessee', centerLat: 35.5, centerLng: -84.0, areas: [
    { id: 'cherokee-nf-north', name: 'Cherokee NF North', lat: 36.20, lng: -82.50, bbox: { south: 35.9, west: -82.9, north: 36.5, east: -82.1 } },
    { id: 'cherokee-nf-south', name: 'Cherokee NF South', lat: 35.20, lng: -84.30, bbox: { south: 35.0, west: -84.7, north: 35.4, east: -83.9 } },
    { id: 'cumberland-plateau', name: 'Cumberland Plateau', lat: 35.50, lng: -85.50, bbox: { south: 35.2, west: -85.9, north: 35.8, east: -85.1 } },
    { id: 'ocoee-hiwassee', name: 'Ocoee / Hiwassee', lat: 35.10, lng: -84.55, bbox: { south: 34.9, west: -84.8, north: 35.3, east: -84.3 } },
    { id: 'smokies-tn', name: 'Great Smokies TN Side', lat: 35.60, lng: -83.50, bbox: { south: 35.4, west: -83.8, north: 35.8, east: -83.2 } },
    { id: 'big-south-fork', name: 'Big South Fork NRRA', lat: 36.48, lng: -84.70, bbox: { south: 36.3, west: -84.9, north: 36.7, east: -84.5 } },
  ]},
  TX: { stateCode: 'TX', stateName: 'Texas', centerLat: 30.5, centerLng: -98.5, areas: [
    { id: 'big-bend-area', name: 'Big Bend NP', lat: 29.25, lng: -103.25, bbox: { south: 29.0, west: -103.6, north: 29.5, east: -102.9 } },
    { id: 'guadalupe-mountains', name: 'Guadalupe Mountains NP', lat: 31.90, lng: -104.85, bbox: { south: 31.7, west: -105.1, north: 32.1, east: -104.6 } },
    { id: 'sam-houston-nf', name: 'Sam Houston NF', lat: 30.55, lng: -95.25, bbox: { south: 30.3, west: -95.5, north: 30.8, east: -95.0 } },
    { id: 'davy-crockett-nf', name: 'Davy Crockett NF', lat: 31.30, lng: -95.10, bbox: { south: 31.1, west: -95.4, north: 31.5, east: -94.8 } },
    { id: 'hill-country', name: 'Hill Country / Enchanted Rock', lat: 30.50, lng: -98.80, bbox: { south: 30.2, west: -99.1, north: 30.8, east: -98.5 } },
    { id: 'palo-duro-caprock', name: 'Palo Duro Canyon / Caprock', lat: 34.95, lng: -101.65, bbox: { south: 34.7, west: -101.9, north: 35.2, east: -101.4 } },
  ]},
  UT: { stateCode: 'UT', stateName: 'Utah', centerLat: 38.5, centerLng: -111.5, areas: [
    { id: 'wasatch-nf', name: 'Wasatch Range / SLC', lat: 40.65, lng: -111.70, bbox: { south: 40.4, west: -112.0, north: 40.9, east: -111.4 } },
    { id: 'uinta-nf', name: 'Uinta Mountains / Mirror Lake', lat: 40.70, lng: -110.90, bbox: { south: 40.4, west: -111.2, north: 41.0, east: -110.6 } },
    { id: 'zion-area', name: 'Zion NP', lat: 37.30, lng: -113.00, bbox: { south: 37.1, west: -113.3, north: 37.5, east: -112.7 } },
    { id: 'bryce-area', name: 'Bryce Canyon / Red Canyon', lat: 37.60, lng: -112.20, bbox: { south: 37.4, west: -112.5, north: 37.8, east: -111.9 } },
    { id: 'arches-canyonlands', name: 'Arches / Canyonlands / Moab', lat: 38.60, lng: -109.60, bbox: { south: 38.3, west: -109.9, north: 38.9, east: -109.3 } },
    { id: 'capitol-reef-area', name: 'Capitol Reef / Grand Staircase', lat: 38.10, lng: -111.20, bbox: { south: 37.8, west: -111.5, north: 38.4, east: -110.9 } },
  ]},
  VT: { stateCode: 'VT', stateName: 'Vermont', centerLat: 44.0, centerLng: -72.7, areas: [
    { id: 'green-mountain-nf-south', name: 'Green Mountain NF South', lat: 43.30, lng: -72.90, bbox: { south: 43.0, west: -73.2, north: 43.6, east: -72.6 } },
    { id: 'green-mountain-nf-north', name: 'Green Mountain NF North / Long Trail', lat: 44.00, lng: -72.80, bbox: { south: 43.7, west: -73.1, north: 44.3, east: -72.5 } },
    { id: 'camels-hump-mansfield', name: "Camel's Hump / Mt Mansfield", lat: 44.40, lng: -72.80, bbox: { south: 44.2, west: -73.0, north: 44.6, east: -72.6 } },
  ]},
  VA: { stateCode: 'VA', stateName: 'Virginia', centerLat: 37.5, centerLng: -79.5, areas: [
    { id: 'gw-nf-north', name: 'George Washington NF North', lat: 38.40, lng: -79.20, bbox: { south: 38.1, west: -79.6, north: 38.7, east: -78.8 } },
    { id: 'gw-nf-south', name: 'George Washington NF South', lat: 37.80, lng: -79.50, bbox: { south: 37.5, west: -79.9, north: 38.1, east: -79.1 } },
    { id: 'jefferson-nf', name: 'Jefferson NF', lat: 37.30, lng: -80.50, bbox: { south: 37.0, west: -80.9, north: 37.6, east: -80.1 } },
    { id: 'shenandoah-np', name: 'Shenandoah NP', lat: 38.53, lng: -78.44, bbox: { south: 38.2, west: -78.7, north: 38.9, east: -78.2 } },
    { id: 'mount-rogers', name: 'Mount Rogers NRA', lat: 36.66, lng: -81.54, bbox: { south: 36.5, west: -81.8, north: 36.8, east: -81.3 } },
    { id: 'blue-ridge-va', name: 'Blue Ridge Parkway VA', lat: 37.50, lng: -79.80, bbox: { south: 37.2, west: -80.2, north: 37.8, east: -79.4 } },
  ]},
  WA: { stateCode: 'WA', stateName: 'Washington', centerLat: 47.5, centerLng: -121.0, areas: [
    { id: 'mt-baker-snoqualmie', name: 'Mt Baker-Snoqualmie NF', lat: 47.80, lng: -121.50, bbox: { south: 47.5, west: -121.8, north: 48.1, east: -121.2 } },
    { id: 'olympic-nf', name: 'Olympic NF / NP', lat: 47.80, lng: -123.50, bbox: { south: 47.5, west: -123.8, north: 48.1, east: -123.2 } },
    { id: 'gifford-pinchot-nf', name: 'Gifford Pinchot NF / Mt St Helens', lat: 46.20, lng: -121.80, bbox: { south: 45.9, west: -122.1, north: 46.5, east: -121.5 } },
    { id: 'okanogan-wenatchee', name: 'Okanogan-Wenatchee NF / N Cascades', lat: 48.00, lng: -120.70, bbox: { south: 47.7, west: -121.0, north: 48.3, east: -120.4 } },
    { id: 'mt-rainier-area', name: 'Mt Rainier NP', lat: 46.85, lng: -121.75, bbox: { south: 46.6, west: -122.0, north: 47.1, east: -121.5 } },
    { id: 'alpine-lakes', name: 'Alpine Lakes Wilderness', lat: 47.50, lng: -121.10, bbox: { south: 47.3, west: -121.4, north: 47.7, east: -120.8 } },
  ]},
  WV: { stateCode: 'WV', stateName: 'West Virginia', centerLat: 38.5, centerLng: -80.5, areas: [
    { id: 'mono-nf-north', name: 'Monongahela NF North', lat: 38.80, lng: -79.80, bbox: { south: 38.5, west: -80.2, north: 39.1, east: -79.4 } },
    { id: 'mono-nf-central', name: 'Monongahela NF Central', lat: 38.40, lng: -80.00, bbox: { south: 38.1, west: -80.4, north: 38.7, east: -79.6 } },
    { id: 'mono-nf-south', name: 'Monongahela NF South', lat: 38.00, lng: -80.20, bbox: { south: 37.7, west: -80.5, north: 38.3, east: -79.9 } },
    { id: 'new-river-gorge', name: 'New River Gorge NP', lat: 38.07, lng: -81.08, bbox: { south: 37.8, west: -81.3, north: 38.3, east: -80.8 } },
    { id: 'dolly-sods', name: 'Dolly Sods Wilderness', lat: 38.98, lng: -79.33, bbox: { south: 38.8, west: -79.5, north: 39.1, east: -79.2 } },
    { id: 'cranberry', name: 'Cranberry Wilderness', lat: 38.23, lng: -80.33, bbox: { south: 38.1, west: -80.5, north: 38.4, east: -80.2 } },
  ]},
  WI: { stateCode: 'WI', stateName: 'Wisconsin', centerLat: 44.5, centerLng: -89.5, areas: [
    { id: 'chequamegon-nicolet-nf', name: 'Chequamegon-Nicolet NF', lat: 45.80, lng: -89.00, bbox: { south: 45.5, west: -89.3, north: 46.1, east: -88.7 } },
    { id: 'ice-age-trail-north', name: 'Ice Age Trail / N Kettle Moraine', lat: 43.70, lng: -88.20, bbox: { south: 43.4, west: -88.5, north: 44.0, east: -87.9 } },
    { id: 'devils-lake-baraboo', name: 'Devils Lake / Baraboo', lat: 43.42, lng: -89.73, bbox: { south: 43.2, west: -90.0, north: 43.6, east: -89.5 } },
    { id: 'apostle-islands', name: 'Apostle Islands / Bayfield', lat: 46.90, lng: -90.70, bbox: { south: 46.7, west: -91.0, north: 47.1, east: -90.4 } },
  ]},
  WY: { stateCode: 'WY', stateName: 'Wyoming', centerLat: 43.5, centerLng: -109.0, areas: [
    { id: 'yellowstone-area', name: 'Yellowstone NP', lat: 44.60, lng: -110.50, bbox: { south: 44.3, west: -110.9, north: 44.9, east: -110.1 } },
    { id: 'grand-teton-area', name: 'Grand Teton / Bridger-Teton NF', lat: 43.70, lng: -110.50, bbox: { south: 43.4, west: -110.9, north: 44.0, east: -110.1 } },
    { id: 'wind-river', name: 'Wind River Range', lat: 42.90, lng: -109.40, bbox: { south: 42.6, west: -109.8, north: 43.2, east: -109.0 } },
    { id: 'bighorn-nf', name: 'Bighorn NF', lat: 44.40, lng: -107.20, bbox: { south: 44.1, west: -107.6, north: 44.7, east: -106.8 } },
    { id: 'shoshone-nf', name: 'Shoshone NF', lat: 44.00, lng: -109.50, bbox: { south: 43.7, west: -109.9, north: 44.3, east: -109.1 } },
    { id: 'medicine-bow', name: 'Medicine Bow NF / Snowy Range', lat: 41.35, lng: -106.30, bbox: { south: 41.1, west: -106.7, north: 41.6, east: -105.9 } },
  ]},
};

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

// ============================================================================
// USFS TRAIL FETCHER
// ============================================================================

interface USFSFeature {
  attributes: {
    TRAIL_NAME?: string;
    TRAIL_NO?: string;
    TRAIL_CLASS?: string;
    SEGMENT_LENGTH?: number;
    ALLOWED_TERRA_USE?: string;
  };
  geometry?: { paths?: number[][][] };
}

async function fetchUSFSTrails(area: SearchArea, stateCode: string): Promise<TrailRow[]> {
  const trails: TrailRow[] = [];
  try {
    const geom = encodeURIComponent(JSON.stringify({
      xmin: area.bbox.west, ymin: area.bbox.south,
      xmax: area.bbox.east, ymax: area.bbox.north,
      spatialReference: { wkid: 4326 },
    }));
    const url = `${USFS_ENDPOINT}?where=1%3D1&geometry=${geom}&geometryType=esriGeometryEnvelope&spatialRel=esriSpatialRelIntersects&outFields=TRAIL_NAME,TRAIL_NO,TRAIL_CLASS,SEGMENT_LENGTH,ALLOWED_TERRA_USE&returnGeometry=true&outSR=4326&f=json&resultRecordCount=500`;
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!resp.ok) { console.log(`  [USFS] HTTP ${resp.status} for ${area.name}`); return []; }
    const data = await resp.json();
    const features: USFSFeature[] = data.features || [];
    if (!features.length) return [];

    // Deduplicate by name, merge geometry segments
    const seen = new Map<string, { feat: USFSFeature; allPaths: number[][][] }>();
    for (const f of features) {
      const name = f.attributes.TRAIL_NAME;
      if (!name || name === 'Unknown' || name === 'N/A') continue;
      const key = name.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.set(key, { feat: f, allPaths: f.geometry?.paths ? [...f.geometry.paths] : [] });
      } else {
        const ex = seen.get(key)!;
        if (f.attributes.SEGMENT_LENGTH && ex.feat.attributes.SEGMENT_LENGTH) ex.feat.attributes.SEGMENT_LENGTH += f.attributes.SEGMENT_LENGTH;
        if (f.geometry?.paths) ex.allPaths.push(...f.geometry.paths);
      }
    }

    for (const [, { feat, allPaths }] of seen) {
      const name = feat.attributes.TRAIL_NAME!;
      let lat = area.lat, lng = area.lng;
      if (allPaths[0]?.[0]) { lng = allPaths[0][0][0]; lat = allPaths[0][0][1]; }

      const geometry: Array<{ latitude: number; longitude: number }> = [];
      for (const path of allPaths) for (const pt of path) if (pt.length >= 2) geometry.push({ latitude: pt[1], longitude: pt[0] });

      let lengthMiles: number | null = null;
      if (feat.attributes.SEGMENT_LENGTH) lengthMiles = Math.round((feat.attributes.SEGMENT_LENGTH / 1609.34) * 10) / 10;

      let difficulty: string | null = null;
      switch (feat.attributes.TRAIL_CLASS) {
        case 'TC1': case 'TC2': difficulty = 'easy'; break;
        case 'TC3': difficulty = 'moderate'; break;
        case 'TC4': case 'TC5': difficulty = 'hard'; break;
      }

      trails.push({
        id: `${stateCode.toLowerCase()}-${area.id}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        parkId: area.id, parkName: area.name, stateCode, name,
        description: null, lengthMiles, difficulty,
        trailType: feat.attributes.ALLOWED_TERRA_USE?.includes('HIKE') ? 'hiking' : null,
        latitude: lat, longitude: lng,
        geometryJson: geometry.length >= 2 ? JSON.stringify(geometry) : null,
        officialUrl: null, alltrailsUrl: null,
        googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} trail ${area.name} ${STATES[stateCode].stateName}`)}`,
        dataSource: 'usfs',
      });
    }
    console.log(`  [USFS] ${area.name}: ${trails.length} trails from ${features.length} segments`);
  } catch (e: any) { console.log(`  [USFS] Error ${area.name}: ${e.message}`); }
  return trails;
}

// ============================================================================
// OSM OVERPASS TRAIL FETCHER
// ============================================================================

interface OverpassElement {
  type: string; id: number;
  lat?: number; lon?: number;
  center?: { lat: number; lon: number };
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: { name?: string; highway?: string; sac_scale?: string; route?: string; distance?: string; length?: string; description?: string };
}

function splitBbox(bbox: { south: number; west: number; north: number; east: number }) {
  const midLat = (bbox.south + bbox.north) / 2;
  const midLng = (bbox.west + bbox.east) / 2;
  return [
    { south: bbox.south, west: bbox.west, north: midLat, east: midLng },   // SW
    { south: bbox.south, west: midLng, north: midLat, east: bbox.east },    // SE
    { south: midLat, west: bbox.west, north: bbox.north, east: midLng },    // NW
    { south: midLat, west: midLng, north: bbox.north, east: bbox.east },    // NE
  ];
}

function parseOSMElements(elements: OverpassElement[], area: SearchArea, stateCode: string, seen: Set<string>): TrailRow[] {
  const trails: TrailRow[] = [];
  for (const el of elements) {
    const name = el.tags?.name;
    if (!name) continue;
    const key = name.toLowerCase().trim();
    if (seen.has(key) || name.length < 4 || ['path', 'trail', 'track', 'road', 'unknown'].includes(key)) continue;
    seen.add(key);

    const lat = el.center?.lat || el.lat || el.geometry?.[0]?.lat || area.lat;
    const lng = el.center?.lon || el.lon || el.geometry?.[0]?.lon || area.lng;
    let geom: Array<{ latitude: number; longitude: number }> | undefined;
    if (el.geometry && el.geometry.length >= 2) geom = el.geometry.map(pt => ({ latitude: pt.lat, longitude: pt.lon }));

    let lengthMiles: number | null = null;
    const distStr = el.tags?.distance || el.tags?.length;
    if (distStr) { const m = distStr.match(/[\d.]+/); if (m) { let v = parseFloat(m[0]); if (distStr.includes('km')) v *= 0.621371; lengthMiles = Math.round(v * 10) / 10; } }

    let difficulty: string | null = null;
    switch (el.tags?.sac_scale) {
      case 'hiking': difficulty = 'easy'; break;
      case 'mountain_hiking': difficulty = 'moderate'; break;
      case 'demanding_mountain_hiking': case 'alpine_hiking': case 'demanding_alpine_hiking': case 'difficult_alpine_hiking': difficulty = 'hard'; break;
    }

    trails.push({
      id: `${stateCode.toLowerCase()}-osm-${el.id}`,
      parkId: area.id, parkName: area.name, stateCode, name,
      description: el.tags?.description || null, lengthMiles, difficulty,
      trailType: el.tags?.route === 'hiking' || el.tags?.highway === 'path' ? 'hiking' : null,
      latitude: lat, longitude: lng,
      geometryJson: geom ? JSON.stringify(geom) : null,
      officialUrl: null, alltrailsUrl: null,
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} trail ${area.name} ${STATES[stateCode].stateName}`)}`,
      dataSource: 'openstreetmap',
    });
  }
  return trails;
}

async function queryOverpass(bbox: { south: number; west: number; north: number; east: number }, timeoutSec: number = 90): Promise<{ status: number; elements: OverpassElement[] }> {
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const query = `[out:json][timeout:${timeoutSec}];(way["highway"="path"]["name"](${bboxStr});way["highway"="footway"]["name"](${bboxStr});way["highway"="track"]["name"]["sac_scale"](${bboxStr});relation["route"="hiking"]["name"](${bboxStr}););out geom tags;`;
  const resp = await fetch(OVERPASS_API, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `data=${encodeURIComponent(query)}` });
  if (!resp.ok) return { status: resp.status, elements: [] };
  const data = await resp.json();
  return { status: 200, elements: data.elements || [] };
}

async function fetchOSMTrails(area: SearchArea, stateCode: string): Promise<TrailRow[]> {
  const seen = new Set<string>();
  const allTrails: TrailRow[] = [];

  try {
    // Attempt full bbox with 90s timeout
    let result = await queryOverpass(area.bbox, 90);

    // On 429 (rate limit): wait and retry up to 3 times
    for (let retry = 0; result.status === 429 && retry < 3; retry++) {
      const waitSec = 30 * (retry + 1);
      console.log(`  [OSM] Rate limited for ${area.name}, waiting ${waitSec}s (retry ${retry + 1}/3)`);
      await sleep(waitSec * 1000);
      result = await queryOverpass(area.bbox, 90);
    }

    // On 504 (timeout): split bbox into 4 quadrants
    if (result.status === 504) {
      console.log(`  [OSM] Timeout for ${area.name} — splitting into 4 quadrants`);
      const quads = splitBbox(area.bbox);
      for (let qi = 0; qi < quads.length; qi++) {
        await sleep(2000);
        let qResult = await queryOverpass(quads[qi], 90);

        // Retry 429 on quadrant too
        for (let retry = 0; qResult.status === 429 && retry < 2; retry++) {
          console.log(`  [OSM] Rate limited on Q${qi + 1}, waiting 30s`);
          await sleep(30000);
          qResult = await queryOverpass(quads[qi], 90);
        }

        if (qResult.status === 200 && qResult.elements.length > 0) {
          const parsed = parseOSMElements(qResult.elements, area, stateCode, seen);
          allTrails.push(...parsed);
          console.log(`  [OSM] Q${qi + 1}: ${parsed.length} trails from ${qResult.elements.length} elements`);
        } else if (qResult.status !== 200) {
          console.log(`  [OSM] Q${qi + 1}: HTTP ${qResult.status}`);
        }
      }
    } else if (result.status === 200 && result.elements.length > 0) {
      const parsed = parseOSMElements(result.elements, area, stateCode, seen);
      allTrails.push(...parsed);
    } else if (result.status !== 200) {
      console.log(`  [OSM] HTTP ${result.status} for ${area.name}`);
      return [];
    }

    console.log(`  [OSM] ${area.name}: ${allTrails.length} trails total`);
  } catch (e: any) { console.log(`  [OSM] Error ${area.name}: ${e.message}`); }
  return allTrails;
}

// ============================================================================
// RIDB CAMPGROUND FETCHER
// ============================================================================

async function fetchRIDBCampgrounds(stateCode: string): Promise<CampgroundRow[]> {
  if (!RIDB_API_KEY) { console.log('  [RIDB] No API key (RECREATION_GOV_API_KEY) - skipping'); return []; }
  const campgrounds: CampgroundRow[] = [];
  try {
    for (let offset = 0; offset <= 100; offset += 50) {
      const url = `${RIDB_BASE}/facilities?activity=CAMPING&state=${stateCode}&limit=50&offset=${offset}`;
      const resp = await fetch(url, { headers: { 'apikey': RIDB_API_KEY, 'Accept': 'application/json' } });
      if (!resp.ok) break;
      const data = await resp.json();
      const facilities = data.RECDATA || [];
      for (const f of facilities) {
        const lat = parseFloat(f.FacilityLatitude);
        const lng = parseFloat(f.FacilityLongitude);
        if (!lat || !lng || lat === 0 || lng === 0) continue;
        const name = f.FacilityName || 'Unknown Campground';
        campgrounds.push({
          id: `ridb-${f.FacilityID}`, name, stateCode,
          parkName: null,
          description: f.FacilityDescription?.replace(/<[^>]*>/g, '').slice(0, 200) || null,
          latitude: lat, longitude: lng, totalSites: null,
          reservationUrl: f.FacilityReservationURL || `https://www.recreation.gov/camping/campgrounds/${f.FacilityID}`,
          googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&center=${lat},${lng}`,
          dataSource: 'recreation.gov',
        });
      }
      if (facilities.length < 50) break;
    }
    console.log(`  [RIDB] ${stateCode}: ${campgrounds.length} campgrounds`);
  } catch (e: any) { console.log(`  [RIDB] Error: ${e.message}`); }
  return campgrounds;
}

// ============================================================================
// POSTGRES BATCH UPSERT
// ============================================================================

async function upsertTrails(trails: TrailRow[]): Promise<void> {
  if (!trails.length) return;
  // Deduplicate by id within the input to avoid "cannot affect row a second time"
  const deduped = Array.from(new Map(trails.map(t => [t.id, t])).values());
  const cols = ['id', 'park_id', 'park_name', 'state_code', 'name', 'description',
    'length_miles', 'difficulty', 'trail_type', 'latitude', 'longitude',
    'geometry_json', 'official_url', 'alltrails_url', 'google_maps_url', 'data_source'];
  const colCount = cols.length;

  for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
    const batch = deduped.slice(i, i + BATCH_SIZE);
    const values: any[] = [];
    const placeholders: string[] = [];
    for (let j = 0; j < batch.length; j++) {
      const t = batch[j];
      const offset = j * colCount;
      placeholders.push(`(${cols.map((_, k) => `$${offset + k + 1}`).join(',')})`);
      values.push(t.id, t.parkId, t.parkName, t.stateCode, t.name, t.description,
        t.lengthMiles, t.difficulty, t.trailType, t.latitude, t.longitude,
        t.geometryJson, t.officialUrl, t.alltrailsUrl, t.googleMapsUrl, t.dataSource);
    }
    await pool.query(`
      INSERT INTO trails (${cols.join(',')}) VALUES ${placeholders.join(',')}
      ON CONFLICT (id) DO UPDATE SET
        name=EXCLUDED.name, description=COALESCE(EXCLUDED.description, trails.description),
        difficulty=COALESCE(EXCLUDED.difficulty, trails.difficulty),
        length_miles=COALESCE(EXCLUDED.length_miles, trails.length_miles),
        latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude,
        geometry_json=COALESCE(EXCLUDED.geometry_json, trails.geometry_json),
        google_maps_url=COALESCE(EXCLUDED.google_maps_url, trails.google_maps_url),
        data_source=EXCLUDED.data_source, last_updated=NOW()
    `, values);
  }
}

async function upsertCampgrounds(campgrounds: CampgroundRow[]): Promise<void> {
  if (!campgrounds.length) return;
  const deduped = Array.from(new Map(campgrounds.map(c => [c.id, c])).values());
  const cols = ['id', 'name', 'state_code', 'park_name', 'description',
    'latitude', 'longitude', 'total_sites', 'reservation_url', 'google_maps_url', 'data_source'];
  const colCount = cols.length;

  for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
    const batch = deduped.slice(i, i + BATCH_SIZE);
    const values: any[] = [];
    const placeholders: string[] = [];
    for (let j = 0; j < batch.length; j++) {
      const c = batch[j];
      const offset = j * colCount;
      placeholders.push(`(${cols.map((_, k) => `$${offset + k + 1}`).join(',')})`);
      values.push(c.id, c.name, c.stateCode, c.parkName, c.description,
        c.latitude, c.longitude, c.totalSites, c.reservationUrl, c.googleMapsUrl, c.dataSource);
    }
    await pool.query(`
      INSERT INTO campgrounds (${cols.join(',')}) VALUES ${placeholders.join(',')}
      ON CONFLICT (id) DO UPDATE SET
        name=EXCLUDED.name, latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude,
        reservation_url=COALESCE(EXCLUDED.reservation_url, campgrounds.reservation_url),
        data_source=EXCLUDED.data_source, last_updated=NOW()
    `, values);
  }
}

// ============================================================================
// MAIN PROCESSING
// ============================================================================

async function syncTrailsForState(stateCode: string): Promise<number> {
  const state = STATES[stateCode];
  if (!state) { console.log(`No config for ${stateCode}`); return 0; }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`${state.stateName} (${stateCode}) — Trail Sync`);
  console.log(`${'='.repeat(60)}`);

  let totalTrails = 0;
  for (const area of state.areas) {
    console.log(`\n--- ${area.name} ---`);
    try {
      const usfsTrails = await fetchUSFSTrails(area, stateCode);
      await sleep(500);
      const osmTrails = await fetchOSMTrails(area, stateCode);
      await sleep(3000); // Overpass rate limit

      // Deduplicate by name across sources (prefer USFS for geometry)
      const byName = new Map<string, TrailRow>();
      for (const t of usfsTrails) byName.set(t.name.toLowerCase().trim(), t);
      for (const t of osmTrails) {
        const key = t.name.toLowerCase().trim();
        if (!byName.has(key)) byName.set(key, t);
        else if (t.geometryJson && !byName.get(key)!.geometryJson) byName.set(key, t);
      }

      const merged = Array.from(byName.values());
      if (merged.length > 0) {
        await upsertTrails(merged);
        totalTrails += merged.length;
        console.log(`  Upserted ${merged.length} trails to Postgres`);
      }
    } catch (e: any) {
      console.error(`  [ERROR] ${area.name}: ${e.message}`);
    }
  }

  console.log(`\n[${stateCode}] Total: ${totalTrails} trails synced`);
  return totalTrails;
}

async function syncCampgroundsForState(stateCode: string): Promise<number> {
  const state = STATES[stateCode];
  if (!state) { console.log(`No config for ${stateCode}`); return 0; }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`${state.stateName} (${stateCode}) — Campground Sync`);
  console.log(`${'='.repeat(60)}`);

  const campgrounds = await fetchRIDBCampgrounds(stateCode);
  if (campgrounds.length > 0) {
    await upsertCampgrounds(campgrounds);
    console.log(`  Upserted ${campgrounds.length} campgrounds to Postgres`);
  }
  return campgrounds.length;
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Postgres-Direct Data Sync
=========================
Fetches trails (USFS + OSM) and campgrounds (Recreation.gov) directly to Postgres.

Usage:
  npx tsx data/scripts/syncToPostgres.ts trails              # All 50 states
  npx tsx data/scripts/syncToPostgres.ts trails NC VA WI     # Specific states
  npx tsx data/scripts/syncToPostgres.ts campgrounds         # All states
  npx tsx data/scripts/syncToPostgres.ts campgrounds NC      # Specific state
  npx tsx data/scripts/syncToPostgres.ts all                 # Everything
  npx tsx data/scripts/syncToPostgres.ts --list              # List states

States configured: ${Object.keys(STATES).length}
`);
    return;
  }

  if (args.includes('--list')) {
    console.log(`\nConfigured States (${Object.keys(STATES).length}):\n`);
    for (const [code, s] of Object.entries(STATES).sort(([a], [b]) => a.localeCompare(b))) {
      console.log(`  ${code} - ${s.stateName} (${s.areas.length} search areas)`);
    }
    return;
  }

  const mode = args[0].toLowerCase();
  const stateArgs = args.slice(1).map(s => s.toUpperCase()).filter(s => STATES[s]);
  const stateCodes = stateArgs.length > 0 ? stateArgs : Object.keys(STATES).sort();

  console.log(`Database: ${DATABASE_URL.replace(/:[^@]+@/, ':***@')}`);
  console.log(`States: ${stateCodes.length}`);

  let totalTrails = 0;
  let totalCampgrounds = 0;

  if (mode === 'trails' || mode === 'all') {
    console.log('\n--- TRAIL SYNC ---');
    for (const sc of stateCodes) {
      totalTrails += await syncTrailsForState(sc);
    }
    console.log(`\nTrail sync complete: ${totalTrails} trails across ${stateCodes.length} states`);
  }

  if (mode === 'campgrounds' || mode === 'all') {
    console.log('\n--- CAMPGROUND SYNC ---');
    for (const sc of stateCodes) {
      totalCampgrounds += await syncCampgroundsForState(sc);
      await sleep(1000); // RIDB rate limit
    }
    console.log(`\nCampground sync complete: ${totalCampgrounds} campgrounds across ${stateCodes.length} states`);
  }

  if (mode !== 'trails' && mode !== 'campgrounds' && mode !== 'all') {
    console.log(`Unknown mode: ${mode}. Use 'trails', 'campgrounds', or 'all'.`);
  }

  console.log('\nDone!');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
