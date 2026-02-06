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

  NC: {
    stateCode: 'NC',
    stateName: 'North Carolina',
    estimatedParks: 41,
    estimatedTrails: 400,
    trailApiRadius: 20,
    parks: [
      { id: 'hanging-rock', name: 'Hanging Rock State Park', lat: 36.3922, lng: -80.2589, priority: 1, officialUrl: 'https://www.ncparks.gov/state-parks/hanging-rock-state-park' },
      { id: 'stone-mountain', name: 'Stone Mountain State Park', lat: 36.3867, lng: -81.0281, priority: 1, officialUrl: 'https://www.ncparks.gov/state-parks/stone-mountain-state-park' },
      { id: 'gorges', name: 'Gorges State Park', lat: 35.0928, lng: -82.9528, priority: 1, officialUrl: 'https://www.ncparks.gov/state-parks/gorges-state-park' },
      { id: 'pilot-mountain', name: 'Pilot Mountain State Park', lat: 36.3392, lng: -80.4742, priority: 1, officialUrl: 'https://www.ncparks.gov/state-parks/pilot-mountain-state-park' },
      { id: 'south-mountains', name: 'South Mountains State Park', lat: 35.5886, lng: -81.6233, priority: 1, officialUrl: 'https://www.ncparks.gov/state-parks/south-mountains-state-park' },
      { id: 'chimney-rock', name: 'Chimney Rock State Park', lat: 35.4389, lng: -82.2467, priority: 1, officialUrl: 'https://www.ncparks.gov/state-parks/chimney-rock-state-park' },
      { id: 'eno-river', name: 'Eno River State Park', lat: 36.0744, lng: -79.0053, priority: 1, officialUrl: 'https://www.ncparks.gov/state-parks/eno-river-state-park' },
      { id: 'umstead', name: 'William B. Umstead State Park', lat: 35.8672, lng: -78.7500, priority: 1, officialUrl: 'https://www.ncparks.gov/state-parks/william-b-umstead-state-park' },
      { id: 'crowders-mountain', name: 'Crowders Mountain State Park', lat: 35.2122, lng: -81.2928, priority: 1, officialUrl: 'https://www.ncparks.gov/state-parks/crowders-mountain-state-park' },
      { id: 'raven-rock', name: 'Raven Rock State Park', lat: 35.4617, lng: -79.1831, priority: 1, officialUrl: 'https://www.ncparks.gov/state-parks/raven-rock-state-park' },
      { id: 'mount-mitchell', name: 'Mount Mitchell State Park', lat: 35.7647, lng: -82.2653, priority: 1, officialUrl: 'https://www.ncparks.gov/state-parks/mount-mitchell-state-park' },
      { id: 'linville-falls', name: 'Linville Falls', lat: 35.9531, lng: -81.9264, priority: 1 },
      { id: 'grandfather-mountain', name: 'Grandfather Mountain State Park', lat: 36.0997, lng: -81.8328, priority: 1, officialUrl: 'https://www.ncparks.gov/state-parks/grandfather-mountain-state-park' },
      { id: 'dupont-state-forest', name: 'DuPont State Recreational Forest', lat: 35.1964, lng: -82.6167, priority: 1 },
      { id: 'pisgah-national-forest', name: 'Pisgah National Forest Trails', lat: 35.3500, lng: -82.7500, priority: 1 },
      { id: 'nantahala-national-forest', name: 'Nantahala National Forest Trails', lat: 35.2500, lng: -83.5000, priority: 1 },
      { id: 'falls-lake', name: 'Falls Lake State Recreation Area', lat: 36.0167, lng: -78.7000, priority: 2 },
      { id: 'jordan-lake', name: 'Jordan Lake State Recreation Area', lat: 35.7500, lng: -79.0500, priority: 2 },
      { id: 'morrow-mountain', name: 'Morrow Mountain State Park', lat: 35.3733, lng: -80.0689, priority: 2 },
      { id: 'lake-james', name: 'Lake James State Park', lat: 35.7267, lng: -81.9097, priority: 2 },
      { id: 'lake-norman', name: 'Lake Norman State Park', lat: 35.6667, lng: -80.9333, priority: 2 },
      { id: 'new-river', name: 'New River State Park', lat: 36.4500, lng: -81.3500, priority: 2 },
      { id: 'medoc-mountain', name: 'Medoc Mountain State Park', lat: 36.2500, lng: -77.8833, priority: 2 },
      { id: 'cliffs-of-neuse', name: 'Cliffs of the Neuse State Park', lat: 35.2333, lng: -77.8833, priority: 2 },
      { id: 'elk-knob', name: 'Elk Knob State Park', lat: 36.3333, lng: -81.6833, priority: 2 },
      { id: 'dismal-swamp', name: 'Dismal Swamp State Park', lat: 36.5167, lng: -76.3667, priority: 2 },
      { id: 'jones-lake', name: 'Jones Lake State Park', lat: 34.6833, lng: -78.5967, priority: 3 },
      { id: 'merchants-millpond', name: 'Merchants Millpond State Park', lat: 36.4333, lng: -76.6833, priority: 3 },
      { id: 'hammocks-beach', name: 'Hammocks Beach State Park', lat: 34.6500, lng: -77.1333, priority: 3 },
      { id: 'jockeys-ridge', name: "Jockey's Ridge State Park", lat: 35.9600, lng: -75.6300, priority: 2 },
      { id: 'carolina-beach', name: 'Carolina Beach State Park', lat: 34.0500, lng: -77.9167, priority: 2 },
    ],
  },

  VA: {
    stateCode: 'VA',
    stateName: 'Virginia',
    estimatedParks: 40,
    estimatedTrails: 500,
    trailApiRadius: 20,
    parks: [
      { id: 'shenandoah-river', name: 'Shenandoah River State Park', lat: 38.9167, lng: -78.3167, priority: 1, officialUrl: 'https://www.dcr.virginia.gov/state-parks/shenandoah-river' },
      { id: 'grayson-highlands', name: 'Grayson Highlands State Park', lat: 36.6333, lng: -81.5167, priority: 1, officialUrl: 'https://www.dcr.virginia.gov/state-parks/grayson-highlands' },
      { id: 'hungry-mother', name: 'Hungry Mother State Park', lat: 36.8833, lng: -81.5333, priority: 1, officialUrl: 'https://www.dcr.virginia.gov/state-parks/hungry-mother' },
      { id: 'douthat', name: 'Douthat State Park', lat: 37.8833, lng: -79.8000, priority: 1, officialUrl: 'https://www.dcr.virginia.gov/state-parks/douthat' },
      { id: 'sky-meadows', name: 'Sky Meadows State Park', lat: 38.9833, lng: -77.9667, priority: 1, officialUrl: 'https://www.dcr.virginia.gov/state-parks/sky-meadows' },
      { id: 'first-landing', name: 'First Landing State Park', lat: 36.9167, lng: -76.0333, priority: 1, officialUrl: 'https://www.dcr.virginia.gov/state-parks/first-landing' },
      { id: 'natural-bridge', name: 'Natural Bridge State Park', lat: 37.6283, lng: -79.5436, priority: 1, officialUrl: 'https://www.dcr.virginia.gov/state-parks/natural-bridge' },
      { id: 'breaks-interstate', name: 'Breaks Interstate Park', lat: 37.2833, lng: -82.2833, priority: 1 },
      { id: 'shenandoah-np-central', name: 'Shenandoah National Park Central', lat: 38.5300, lng: -78.4400, priority: 1 },
      { id: 'shenandoah-np-south', name: 'Shenandoah National Park South', lat: 38.2000, lng: -78.7000, priority: 1 },
      { id: 'george-washington-nf-north', name: 'George Washington National Forest North', lat: 38.4000, lng: -79.2000, priority: 1 },
      { id: 'george-washington-nf-south', name: 'George Washington National Forest South', lat: 37.8000, lng: -79.5000, priority: 1 },
      { id: 'jefferson-nf', name: 'Jefferson National Forest', lat: 37.3000, lng: -80.5000, priority: 1 },
      { id: 'mount-rogers', name: 'Mount Rogers National Recreation Area', lat: 36.6583, lng: -81.5444, priority: 1 },
      { id: 'fairy-stone', name: 'Fairy Stone State Park', lat: 36.7833, lng: -80.1167, priority: 2 },
      { id: 'pocahontas', name: 'Pocahontas State Park', lat: 37.3667, lng: -77.5667, priority: 2 },
      { id: 'james-river', name: 'James River State Park', lat: 37.6333, lng: -78.8000, priority: 2 },
      { id: 'new-river-trail', name: 'New River Trail State Park', lat: 36.8500, lng: -80.7500, priority: 1 },
      { id: 'high-bridge-trail', name: 'High Bridge Trail State Park', lat: 37.3833, lng: -78.5333, priority: 2 },
      { id: 'claytor-lake', name: 'Claytor Lake State Park', lat: 37.0500, lng: -80.6333, priority: 2 },
      { id: 'westmoreland', name: 'Westmoreland State Park', lat: 38.1500, lng: -76.8667, priority: 2 },
      { id: 'false-cape', name: 'False Cape State Park', lat: 36.6167, lng: -75.9333, priority: 2 },
      { id: 'kiptopeke', name: 'Kiptopeke State Park', lat: 37.1667, lng: -75.9833, priority: 2 },
      { id: 'lake-anna', name: 'Lake Anna State Park', lat: 38.0667, lng: -77.7833, priority: 2 },
      { id: 'staunton-river', name: 'Staunton River State Park', lat: 36.7000, lng: -78.7000, priority: 3 },
      { id: 'bear-creek-lake', name: 'Bear Creek Lake State Park', lat: 37.5167, lng: -78.2667, priority: 3 },
      { id: 'holliday-lake', name: 'Holliday Lake State Park', lat: 37.4000, lng: -78.6333, priority: 3 },
      { id: 'york-river', name: 'York River State Park', lat: 37.4167, lng: -76.7167, priority: 2 },
    ],
  },

  TN: {
    stateCode: 'TN',
    stateName: 'Tennessee',
    estimatedParks: 56,
    estimatedTrails: 600,
    trailApiRadius: 20,
    parks: [
      { id: 'fall-creek-falls', name: 'Fall Creek Falls State Park', lat: 35.6647, lng: -85.3514, priority: 1, officialUrl: 'https://tnstateparks.com/parks/fall-creek-falls' },
      { id: 'roan-mountain', name: 'Roan Mountain State Park', lat: 36.1622, lng: -82.1028, priority: 1, officialUrl: 'https://tnstateparks.com/parks/roan-mountain' },
      { id: 'savage-gulf', name: 'Savage Gulf State Natural Area', lat: 35.4581, lng: -85.5833, priority: 1, officialUrl: 'https://tnstateparks.com/parks/south-cumberland' },
      { id: 'south-cumberland', name: 'South Cumberland State Park', lat: 35.2417, lng: -85.9333, priority: 1, officialUrl: 'https://tnstateparks.com/parks/south-cumberland' },
      { id: 'cummins-falls', name: 'Cummins Falls State Park', lat: 36.2564, lng: -85.5833, priority: 1, officialUrl: 'https://tnstateparks.com/parks/cummins-falls' },
      { id: 'burgess-falls', name: 'Burgess Falls State Park', lat: 36.0500, lng: -85.6000, priority: 1, officialUrl: 'https://tnstateparks.com/parks/burgess-falls' },
      { id: 'frozen-head', name: 'Frozen Head State Park', lat: 36.1167, lng: -84.4333, priority: 1, officialUrl: 'https://tnstateparks.com/parks/frozen-head' },
      { id: 'pickett', name: 'Pickett CCC Memorial State Park', lat: 36.5500, lng: -84.8000, priority: 1 },
      { id: 'big-south-fork', name: 'Big South Fork State Park', lat: 36.4833, lng: -84.7000, priority: 1 },
      { id: 'radnor-lake', name: 'Radnor Lake State Park', lat: 36.0633, lng: -86.8097, priority: 1, officialUrl: 'https://tnstateparks.com/parks/radnor-lake' },
      { id: 'cherokee-nf-north', name: 'Cherokee National Forest North', lat: 36.2000, lng: -82.5000, priority: 1 },
      { id: 'cherokee-nf-south', name: 'Cherokee National Forest South', lat: 35.2000, lng: -84.3000, priority: 1 },
      { id: 'ocoee-area', name: 'Ocoee River Area Trails', lat: 35.0833, lng: -84.5333, priority: 1 },
      { id: 'prentice-cooper', name: 'Prentice Cooper State Forest', lat: 35.0833, lng: -85.4667, priority: 1 },
      { id: 'virgin-falls', name: 'Virgin Falls State Natural Area', lat: 35.7667, lng: -85.3500, priority: 1 },
      { id: 'fiery-gizzard', name: 'Fiery Gizzard Trail Area', lat: 35.2333, lng: -85.8500, priority: 1 },
      { id: 'natchez-trace', name: 'Natchez Trace State Park', lat: 35.8000, lng: -88.2500, priority: 2 },
      { id: 'rock-island', name: 'Rock Island State Park', lat: 35.8000, lng: -85.6333, priority: 1 },
      { id: 'edgar-evins', name: 'Edgar Evins State Park', lat: 36.0833, lng: -85.8333, priority: 2 },
      { id: 'warrior-path', name: 'Warriors Path State Park', lat: 36.4833, lng: -82.5333, priority: 2 },
      { id: 'long-hunter', name: 'Long Hunter State Park', lat: 36.0833, lng: -86.5333, priority: 2 },
      { id: 'old-stone-fort', name: 'Old Stone Fort State Archaeological Park', lat: 35.4833, lng: -86.0833, priority: 2 },
      { id: 'harrison-bay', name: 'Harrison Bay State Park', lat: 35.1667, lng: -85.1167, priority: 2 },
      { id: 'hiwassee-ocoee', name: 'Hiwassee/Ocoee Scenic River State Park', lat: 35.2167, lng: -84.5833, priority: 2 },
      { id: 'meeman-shelby', name: 'Meeman-Shelby Forest State Park', lat: 35.3500, lng: -90.0167, priority: 2 },
      { id: 'montgomery-bell', name: 'Montgomery Bell State Park', lat: 36.1000, lng: -87.3000, priority: 2 },
      { id: 'cedars-of-lebanon', name: 'Cedars of Lebanon State Park', lat: 36.0833, lng: -86.3167, priority: 2 },
      { id: 'cove-lake', name: 'Cove Lake State Park', lat: 36.3000, lng: -84.2167, priority: 3 },
      { id: 'standing-stone', name: 'Standing Stone State Park', lat: 36.4667, lng: -85.4167, priority: 3 },
      { id: 'panther-creek', name: 'Panther Creek State Park', lat: 36.2000, lng: -83.2500, priority: 3 },
    ],
  },

  WV: {
    stateCode: 'WV',
    stateName: 'West Virginia',
    estimatedParks: 35,
    estimatedTrails: 350,
    trailApiRadius: 20,
    parks: [
      { id: 'coopers-rock', name: 'Coopers Rock State Forest', lat: 39.6522, lng: -79.7772, priority: 1, officialUrl: 'https://wvstateparks.com/park/coopers-rock-state-forest/' },
      { id: 'seneca-rocks', name: 'Seneca Rocks', lat: 38.8339, lng: -79.3728, priority: 1 },
      { id: 'babcock', name: 'Babcock State Park', lat: 38.0167, lng: -80.9500, priority: 1, officialUrl: 'https://wvstateparks.com/park/babcock-state-park/' },
      { id: 'blackwater-falls', name: 'Blackwater Falls State Park', lat: 39.1167, lng: -79.4833, priority: 1, officialUrl: 'https://wvstateparks.com/park/blackwater-falls-state-park/' },
      { id: 'hawks-nest', name: 'Hawks Nest State Park', lat: 38.1333, lng: -81.1167, priority: 1, officialUrl: 'https://wvstateparks.com/park/hawks-nest-state-park/' },
      { id: 'canaan-valley', name: 'Canaan Valley Resort State Park', lat: 39.0000, lng: -79.4500, priority: 1, officialUrl: 'https://wvstateparks.com/park/canaan-valley-resort-state-park/' },
      { id: 'dolly-sods', name: 'Dolly Sods Wilderness', lat: 38.9833, lng: -79.3333, priority: 1 },
      { id: 'cathedral', name: 'Cathedral State Park', lat: 39.3167, lng: -79.5667, priority: 1, officialUrl: 'https://wvstateparks.com/park/cathedral-state-park/' },
      { id: 'beartown', name: 'Beartown State Park', lat: 37.9833, lng: -80.2833, priority: 2 },
      { id: 'lost-river', name: 'Lost River State Park', lat: 39.0000, lng: -79.0333, priority: 2 },
      { id: 'holly-river', name: 'Holly River State Park', lat: 38.6500, lng: -80.3333, priority: 2 },
      { id: 'watoga', name: 'Watoga State Park', lat: 38.0833, lng: -80.1167, priority: 2, officialUrl: 'https://wvstateparks.com/park/watoga-state-park/' },
      { id: 'kumbrabow', name: 'Kumbrabow State Forest', lat: 38.6333, lng: -80.1333, priority: 2 },
      { id: 'north-bend', name: 'North Bend State Park', lat: 39.1167, lng: -80.9333, priority: 2 },
      { id: 'stonewall-jackson-lake', name: 'Stonewall Jackson Lake State Park', lat: 38.9333, lng: -80.3833, priority: 3 },
      { id: 'audra', name: 'Audra State Park', lat: 38.8833, lng: -80.0667, priority: 3 },
      { id: 'twin-falls', name: 'Twin Falls Resort State Park', lat: 37.6167, lng: -81.7667, priority: 3 },
      { id: 'new-river-gorge-north', name: 'New River Gorge Area North', lat: 38.0667, lng: -81.0833, priority: 1 },
      { id: 'new-river-gorge-south', name: 'New River Gorge Area South', lat: 37.8500, lng: -81.0500, priority: 1 },
      { id: 'gauley-river', name: 'Gauley River National Recreation Area', lat: 38.2167, lng: -80.8833, priority: 1 },
      { id: 'spruce-knob', name: 'Spruce Knob-Seneca Rocks NRA', lat: 38.7000, lng: -79.5333, priority: 1 },
      { id: 'monongahela-nf-north', name: 'Monongahela National Forest North', lat: 38.8000, lng: -79.8000, priority: 1 },
      { id: 'monongahela-nf-south', name: 'Monongahela National Forest South', lat: 38.3000, lng: -80.0000, priority: 1 },
      { id: 'greenbrier-river-trail', name: 'Greenbrier River Trail', lat: 37.9500, lng: -80.1500, priority: 2 },
      { id: 'cranberry-wilderness', name: 'Cranberry Wilderness', lat: 38.2333, lng: -80.3333, priority: 1 },
    ],
  },

  KY: {
    stateCode: 'KY',
    stateName: 'Kentucky',
    estimatedParks: 45,
    estimatedTrails: 400,
    trailApiRadius: 20,
    parks: [
      { id: 'natural-bridge', name: 'Natural Bridge State Resort Park', lat: 37.7742, lng: -83.6833, priority: 1, officialUrl: 'https://parks.ky.gov/slade/parks/resort/natural-bridge-state-resort-park' },
      { id: 'cumberland-falls', name: 'Cumberland Falls State Resort Park', lat: 36.8383, lng: -84.3442, priority: 1, officialUrl: 'https://parks.ky.gov/corbin/parks/resort/cumberland-falls-state-resort-park' },
      { id: 'carter-caves', name: 'Carter Caves State Resort Park', lat: 38.3667, lng: -83.1167, priority: 1, officialUrl: 'https://parks.ky.gov/olive-hill/parks/resort/carter-caves-state-resort-park' },
      { id: 'red-river-gorge', name: 'Red River Gorge Geological Area', lat: 37.8000, lng: -83.6167, priority: 1 },
      { id: 'breaks-interstate', name: 'Breaks Interstate Park', lat: 37.2833, lng: -82.2833, priority: 1 },
      { id: 'pine-mountain', name: 'Pine Mountain State Resort Park', lat: 36.7167, lng: -83.7333, priority: 1, officialUrl: 'https://parks.ky.gov/pineville/parks/resort/pine-mountain-state-resort-park' },
      { id: 'kingdom-come', name: 'Kingdom Come State Park', lat: 36.9333, lng: -82.9833, priority: 1 },
      { id: 'daniel-boone-nf-north', name: 'Daniel Boone National Forest North', lat: 38.0000, lng: -83.7000, priority: 1 },
      { id: 'daniel-boone-nf-central', name: 'Daniel Boone National Forest Central', lat: 37.5000, lng: -84.0000, priority: 1 },
      { id: 'daniel-boone-nf-south', name: 'Daniel Boone National Forest South', lat: 36.9000, lng: -84.4000, priority: 1 },
      { id: 'bad-branch', name: 'Bad Branch Falls State Nature Preserve', lat: 37.0833, lng: -82.9500, priority: 1 },
      { id: 'blanton-forest', name: 'Blanton Forest State Nature Preserve', lat: 36.8500, lng: -83.4500, priority: 1 },
      { id: 'jenny-wiley', name: 'Jenny Wiley State Resort Park', lat: 37.7333, lng: -82.7667, priority: 2 },
      { id: 'buckhorn-lake', name: 'Buckhorn Lake State Resort Park', lat: 37.3500, lng: -83.4833, priority: 2 },
      { id: 'levi-jackson', name: 'Levi Jackson Wilderness Road State Park', lat: 37.0833, lng: -84.1167, priority: 2 },
      { id: 'greenbo-lake', name: 'Greenbo Lake State Resort Park', lat: 38.4833, lng: -82.8667, priority: 2 },
      { id: 'pennyrile-forest', name: 'Pennyrile Forest State Resort Park', lat: 37.0667, lng: -87.6333, priority: 2 },
      { id: 'general-butler', name: 'General Butler State Resort Park', lat: 38.7833, lng: -85.1833, priority: 2 },
      { id: 'lake-cumberland', name: 'Lake Cumberland State Resort Park', lat: 36.9500, lng: -85.0167, priority: 2 },
      { id: 'bernheim-arboretum', name: 'Bernheim Arboretum and Research Forest', lat: 37.9167, lng: -85.6667, priority: 2 },
      { id: 'jefferson-memorial-forest', name: 'Jefferson Memorial Forest', lat: 38.0667, lng: -85.8833, priority: 2 },
      { id: 'big-bone-lick', name: 'Big Bone Lick State Historic Site', lat: 38.8833, lng: -84.7500, priority: 3 },
      { id: 'fort-boonesborough', name: 'Fort Boonesborough State Park', lat: 37.8833, lng: -84.2667, priority: 3 },
      { id: 'columbus-belmont', name: 'Columbus-Belmont State Park', lat: 36.7667, lng: -89.1000, priority: 3 },
    ],
  },

  GA: {
    stateCode: 'GA',
    stateName: 'Georgia',
    estimatedParks: 48,
    estimatedTrails: 450,
    trailApiRadius: 20,
    parks: [
      { id: 'cloudland-canyon', name: 'Cloudland Canyon State Park', lat: 34.8367, lng: -85.4811, priority: 1, officialUrl: 'https://gastateparks.org/CloudlandCanyon' },
      { id: 'tallulah-gorge', name: 'Tallulah Gorge State Park', lat: 34.7372, lng: -83.3936, priority: 1, officialUrl: 'https://gastateparks.org/TallulahGorge' },
      { id: 'amicalola-falls', name: 'Amicalola Falls State Park', lat: 34.5700, lng: -84.2481, priority: 1, officialUrl: 'https://gastateparks.org/AmicalolaFalls' },
      { id: 'vogel', name: 'Vogel State Park', lat: 34.7658, lng: -83.9256, priority: 1, officialUrl: 'https://gastateparks.org/Vogel' },
      { id: 'providence-canyon', name: 'Providence Canyon State Park', lat: 32.0667, lng: -84.9167, priority: 1, officialUrl: 'https://gastateparks.org/ProvidenceCanyon' },
      { id: 'sweetwater-creek', name: 'Sweetwater Creek State Park', lat: 33.7500, lng: -84.6333, priority: 1, officialUrl: 'https://gastateparks.org/SweetwaterCreek' },
      { id: 'fort-mountain', name: 'Fort Mountain State Park', lat: 34.7667, lng: -84.7000, priority: 1, officialUrl: 'https://gastateparks.org/FortMountain' },
      { id: 'unicoi', name: 'Unicoi State Park', lat: 34.7333, lng: -83.7167, priority: 1, officialUrl: 'https://gastateparks.org/Unicoi' },
      { id: 'black-rock-mountain', name: 'Black Rock Mountain State Park', lat: 34.9000, lng: -83.4167, priority: 1, officialUrl: 'https://gastateparks.org/BlackRockMountain' },
      { id: 'red-top-mountain', name: 'Red Top Mountain State Park', lat: 34.1500, lng: -84.7000, priority: 1, officialUrl: 'https://gastateparks.org/RedTopMountain' },
      { id: 'chattahoochee-nf-north', name: 'Chattahoochee National Forest North', lat: 34.8500, lng: -84.0000, priority: 1 },
      { id: 'chattahoochee-nf-south', name: 'Chattahoochee National Forest South', lat: 34.6000, lng: -84.2000, priority: 1 },
      { id: 'springer-mountain', name: 'Springer Mountain AT Start', lat: 34.6269, lng: -84.1936, priority: 1 },
      { id: 'cohutta-wilderness', name: 'Cohutta Wilderness', lat: 34.9167, lng: -84.6333, priority: 1 },
      { id: 'panola-mountain', name: 'Panola Mountain State Park', lat: 33.6333, lng: -84.1667, priority: 2 },
      { id: 'victoria-bryant', name: 'Victoria Bryant State Park', lat: 34.3333, lng: -83.2833, priority: 2 },
      { id: 'mistletoe', name: 'Mistletoe State Park', lat: 33.6500, lng: -82.4000, priority: 2 },
      { id: 'indian-springs', name: 'Indian Springs State Park', lat: 33.2500, lng: -83.9167, priority: 2 },
      { id: 'f-d-roosevelt', name: 'F.D. Roosevelt State Park', lat: 32.8500, lng: -84.7500, priority: 1, officialUrl: 'https://gastateparks.org/FDRoosevelt' },
      { id: 'stephen-c-foster', name: 'Stephen C. Foster State Park', lat: 30.8167, lng: -82.3667, priority: 2 },
      { id: 'skidaway-island', name: 'Skidaway Island State Park', lat: 31.9500, lng: -81.0500, priority: 2 },
      { id: 'jekyll-island', name: 'Jekyll Island State Park', lat: 31.0667, lng: -81.4167, priority: 2 },
      { id: 'stone-mountain', name: 'Stone Mountain Park', lat: 33.8083, lng: -84.1453, priority: 1 },
      { id: 'kennesaw-mountain', name: 'Kennesaw Mountain National Battlefield', lat: 33.9833, lng: -84.5783, priority: 1 },
      { id: 'arabia-mountain', name: 'Arabia Mountain National Heritage Area', lat: 33.6667, lng: -84.1167, priority: 2 },
      { id: 'crooked-river', name: 'Crooked River State Park', lat: 30.8167, lng: -81.5500, priority: 3 },
      { id: 'general-coffee', name: 'General Coffee State Park', lat: 31.5333, lng: -82.7833, priority: 3 },
    ],
  },

  NY: {
    stateCode: 'NY',
    stateName: 'New York',
    estimatedParks: 180,
    estimatedTrails: 1200,
    trailApiRadius: 20,
    parks: [
      { id: 'harriman', name: 'Harriman State Park', lat: 41.2500, lng: -74.0833, priority: 1, officialUrl: 'https://parks.ny.gov/parks/harriman/' },
      { id: 'letchworth', name: 'Letchworth State Park', lat: 42.5833, lng: -77.9667, priority: 1, officialUrl: 'https://parks.ny.gov/parks/letchworth/' },
      { id: 'watkins-glen', name: 'Watkins Glen State Park', lat: 42.3667, lng: -76.8667, priority: 1, officialUrl: 'https://parks.ny.gov/parks/watkinsglen/' },
      { id: 'minnewaska', name: 'Minnewaska State Park Preserve', lat: 41.7333, lng: -74.2333, priority: 1, officialUrl: 'https://parks.ny.gov/parks/minnewaska/' },
      { id: 'taughannock-falls', name: 'Taughannock Falls State Park', lat: 42.5472, lng: -76.6000, priority: 1, officialUrl: 'https://parks.ny.gov/parks/taughannockfalls/' },
      { id: 'bear-mountain', name: 'Bear Mountain State Park', lat: 41.3167, lng: -73.9833, priority: 1, officialUrl: 'https://parks.ny.gov/parks/bearmountain/' },
      { id: 'allegany', name: 'Allegany State Park', lat: 42.0833, lng: -78.7500, priority: 1, officialUrl: 'https://parks.ny.gov/parks/allegany/' },
      { id: 'whiteface-mountain', name: 'Whiteface Mountain (Adirondacks)', lat: 44.3650, lng: -73.9028, priority: 1 },
      { id: 'high-peaks', name: 'Adirondack High Peaks Area', lat: 44.1133, lng: -73.9236, priority: 1 },
      { id: 'adirondack-south', name: 'Adirondack Park South', lat: 43.5000, lng: -74.5000, priority: 1 },
      { id: 'adirondack-central', name: 'Adirondack Park Central', lat: 43.8000, lng: -74.3000, priority: 1 },
      { id: 'catskills-north', name: 'Catskill Park North', lat: 42.2000, lng: -74.2000, priority: 1 },
      { id: 'catskills-south', name: 'Catskill Park South', lat: 41.9500, lng: -74.3500, priority: 1 },
      { id: 'buttermilk-falls', name: 'Buttermilk Falls State Park', lat: 42.4167, lng: -76.5167, priority: 1 },
      { id: 'robert-treman', name: 'Robert H. Treman State Park', lat: 42.3833, lng: -76.5667, priority: 1 },
      { id: 'fillmore-glen', name: 'Fillmore Glen State Park', lat: 42.7000, lng: -76.4000, priority: 2 },
      { id: 'chimney-bluffs', name: 'Chimney Bluffs State Park', lat: 43.2833, lng: -76.9167, priority: 2 },
      { id: 'stony-brook', name: 'Stony Brook State Park', lat: 42.3667, lng: -77.6833, priority: 2 },
      { id: 'moreau-lake', name: 'Moreau Lake State Park', lat: 43.2333, lng: -73.7167, priority: 2 },
      { id: 'grafton-lakes', name: 'Grafton Lakes State Park', lat: 42.7667, lng: -73.4500, priority: 2 },
      { id: 'storm-king', name: 'Storm King State Park', lat: 41.4333, lng: -74.0000, priority: 1 },
      { id: 'clarence-fahnestock', name: 'Clarence Fahnestock State Park', lat: 41.4500, lng: -73.8667, priority: 2 },
      { id: 'hither-hills', name: 'Hither Hills State Park', lat: 41.0000, lng: -72.0167, priority: 2 },
      { id: 'green-lakes', name: 'Green Lakes State Park', lat: 43.0500, lng: -75.9667, priority: 2 },
      { id: 'chittenango-falls', name: 'Chittenango Falls State Park', lat: 42.9667, lng: -75.8500, priority: 2 },
      { id: 'thacher', name: 'John Boyd Thacher State Park', lat: 42.6333, lng: -74.0167, priority: 2 },
      { id: 'saratoga-spa', name: 'Saratoga Spa State Park', lat: 43.0500, lng: -73.7833, priority: 3 },
      { id: 'ausable-chasm', name: 'Ausable Chasm Area', lat: 44.5167, lng: -73.4500, priority: 2 },
    ],
  },

  PA: {
    stateCode: 'PA',
    stateName: 'Pennsylvania',
    estimatedParks: 121,
    estimatedTrails: 900,
    trailApiRadius: 20,
    parks: [
      { id: 'ricketts-glen', name: 'Ricketts Glen State Park', lat: 41.3333, lng: -76.2833, priority: 1, officialUrl: 'https://www.dcnr.pa.gov/StateParks/FindAPark/RickettsGlenStatePark/' },
      { id: 'ohiopyle', name: 'Ohiopyle State Park', lat: 39.8667, lng: -79.4833, priority: 1, officialUrl: 'https://www.dcnr.pa.gov/StateParks/FindAPark/OhiopyleStatePark/' },
      { id: 'worlds-end', name: 'Worlds End State Park', lat: 41.4667, lng: -76.5833, priority: 1, officialUrl: 'https://www.dcnr.pa.gov/StateParks/FindAPark/WorldsEndStatePark/' },
      { id: 'pine-grove-furnace', name: 'Pine Grove Furnace State Park', lat: 40.0333, lng: -77.3000, priority: 1, officialUrl: 'https://www.dcnr.pa.gov/StateParks/FindAPark/PineGroveFurnaceStatePark/' },
      { id: 'mcconnells-mill', name: "McConnells Mill State Park", lat: 40.9500, lng: -80.1667, priority: 1, officialUrl: 'https://www.dcnr.pa.gov/StateParks/FindAPark/McConnellsMillStatePark/' },
      { id: 'hickory-run', name: 'Hickory Run State Park', lat: 41.0333, lng: -75.6833, priority: 1, officialUrl: 'https://www.dcnr.pa.gov/StateParks/FindAPark/HickoryRunStatePark/' },
      { id: 'lehigh-gorge', name: 'Lehigh Gorge State Park', lat: 41.0667, lng: -75.7500, priority: 1, officialUrl: 'https://www.dcnr.pa.gov/StateParks/FindAPark/LehighGorgeStatePark/' },
      { id: 'bushkill-falls', name: 'Bushkill Falls Area', lat: 41.1000, lng: -75.0000, priority: 1 },
      { id: 'delaware-water-gap', name: 'Delaware Water Gap NRA', lat: 41.0000, lng: -75.1333, priority: 1 },
      { id: 'allegheny-nf', name: 'Allegheny National Forest', lat: 41.7500, lng: -79.0000, priority: 1 },
      { id: 'allegheny-nf-south', name: 'Allegheny NF South', lat: 41.5000, lng: -79.2000, priority: 1 },
      { id: 'cook-forest', name: 'Cook Forest State Park', lat: 41.3333, lng: -79.2167, priority: 1, officialUrl: 'https://www.dcnr.pa.gov/StateParks/FindAPark/CookForestStatePark/' },
      { id: 'presque-isle', name: 'Presque Isle State Park', lat: 42.1500, lng: -80.1333, priority: 1, officialUrl: 'https://www.dcnr.pa.gov/StateParks/FindAPark/PresqueIsleStatePark/' },
      { id: 'hyner-view', name: 'Hyner View State Park', lat: 41.3333, lng: -77.6333, priority: 1 },
      { id: 'leonard-harrison', name: 'Leonard Harrison State Park (PA Grand Canyon)', lat: 41.7000, lng: -77.4500, priority: 1, officialUrl: 'https://www.dcnr.pa.gov/StateParks/FindAPark/LeonardHarrisonStatePark/' },
      { id: 'colton-point', name: 'Colton Point State Park', lat: 41.6833, lng: -77.4667, priority: 1 },
      { id: 'promised-land', name: 'Promised Land State Park', lat: 41.3000, lng: -75.2000, priority: 2 },
      { id: 'loyalsock-sf', name: 'Loyalsock State Forest', lat: 41.3833, lng: -76.7000, priority: 1 },
      { id: 'rothrock-sf', name: 'Rothrock State Forest', lat: 40.7000, lng: -77.6000, priority: 2 },
      { id: 'tuscarora-sf', name: 'Tuscarora State Forest', lat: 40.4000, lng: -77.4000, priority: 2 },
      { id: 'bald-eagle-sf', name: 'Bald Eagle State Forest', lat: 40.9500, lng: -77.3000, priority: 2 },
      { id: 'french-creek', name: 'French Creek State Park', lat: 40.2000, lng: -75.7833, priority: 2 },
      { id: 'nolde-forest', name: 'Nolde Forest Environmental Education Center', lat: 40.2833, lng: -75.9833, priority: 3 },
      { id: 'ralph-stover', name: 'Ralph Stover State Park', lat: 40.4667, lng: -75.1000, priority: 2 },
      { id: 'ridley-creek', name: 'Ridley Creek State Park', lat: 39.9500, lng: -75.4500, priority: 2 },
    ],
  },

  MN: {
    stateCode: 'MN',
    stateName: 'Minnesota',
    estimatedParks: 75,
    estimatedTrails: 600,
    trailApiRadius: 20,
    parks: [
      { id: 'itasca', name: 'Itasca State Park', lat: 47.2333, lng: -95.1833, priority: 1, officialUrl: 'https://www.dnr.state.mn.us/state_parks/park.html?id=spk00181' },
      { id: 'tettegouche', name: 'Tettegouche State Park', lat: 47.3500, lng: -91.2000, priority: 1, officialUrl: 'https://www.dnr.state.mn.us/state_parks/park.html?id=spk00269' },
      { id: 'gooseberry-falls', name: 'Gooseberry Falls State Park', lat: 47.1400, lng: -91.4667, priority: 1, officialUrl: 'https://www.dnr.state.mn.us/state_parks/park.html?id=spk00154' },
      { id: 'jay-cooke', name: 'Jay Cooke State Park', lat: 46.6500, lng: -92.3667, priority: 1, officialUrl: 'https://www.dnr.state.mn.us/state_parks/park.html?id=spk00187' },
      { id: 'split-rock-lighthouse', name: 'Split Rock Lighthouse State Park', lat: 47.2000, lng: -91.3667, priority: 1, officialUrl: 'https://www.dnr.state.mn.us/state_parks/park.html?id=spk00256' },
      { id: 'cascade-river', name: 'Cascade River State Park', lat: 47.7167, lng: -90.5167, priority: 1, officialUrl: 'https://www.dnr.state.mn.us/state_parks/park.html?id=spk00127' },
      { id: 'temperance-river', name: 'Temperance River State Park', lat: 47.5500, lng: -90.8833, priority: 1 },
      { id: 'judge-cr-magney', name: 'Judge C.R. Magney State Park', lat: 47.8167, lng: -90.0500, priority: 1 },
      { id: 'superior-hiking-north', name: 'Superior Hiking Trail North Shore', lat: 47.5000, lng: -90.7000, priority: 1 },
      { id: 'superior-hiking-south', name: 'Superior Hiking Trail South', lat: 47.0000, lng: -91.6000, priority: 1 },
      { id: 'boundary-waters-west', name: 'BWCA West Entry', lat: 47.9500, lng: -91.5000, priority: 1 },
      { id: 'boundary-waters-east', name: 'BWCA East Entry', lat: 48.0000, lng: -90.5000, priority: 1 },
      { id: 'superior-nf-central', name: 'Superior National Forest Central', lat: 47.8000, lng: -91.0000, priority: 1 },
      { id: 'chippewa-nf', name: 'Chippewa National Forest', lat: 47.3000, lng: -94.3000, priority: 1 },
      { id: 'frontenac', name: 'Frontenac State Park', lat: 44.5167, lng: -92.3167, priority: 2 },
      { id: 'whitewater', name: 'Whitewater State Park', lat: 44.0500, lng: -91.9833, priority: 2 },
      { id: 'afton', name: 'Afton State Park', lat: 44.8333, lng: -92.7833, priority: 2 },
      { id: 'interstate', name: 'Interstate State Park', lat: 45.3833, lng: -92.6333, priority: 2 },
      { id: 'blue-mounds', name: 'Blue Mounds State Park', lat: 43.7333, lng: -96.1833, priority: 2 },
      { id: 'forestville-mystery-cave', name: 'Forestville/Mystery Cave State Park', lat: 43.6333, lng: -92.2333, priority: 2 },
      { id: 'banning', name: 'Banning State Park', lat: 46.1667, lng: -92.8500, priority: 2 },
      { id: 'fort-snelling', name: 'Fort Snelling State Park', lat: 44.8833, lng: -93.1833, priority: 2 },
      { id: 'george-crosby-manitou', name: 'George Crosby Manitou State Park', lat: 47.4333, lng: -91.1000, priority: 2 },
      { id: 'savanna-portage', name: 'Savanna Portage State Park', lat: 46.8500, lng: -93.2000, priority: 3 },
      { id: 'glacial-lakes', name: 'Glacial Lakes State Park', lat: 45.5500, lng: -95.5333, priority: 3 },
    ],
  },

  SC: {
    stateCode: 'SC',
    stateName: 'South Carolina',
    estimatedParks: 47,
    estimatedTrails: 350,
    trailApiRadius: 20,
    parks: [
      { id: 'table-rock', name: 'Table Rock State Park', lat: 35.0258, lng: -82.7072, priority: 1, officialUrl: 'https://southcarolinaparks.com/table-rock' },
      { id: 'caesars-head', name: 'Caesars Head State Park', lat: 35.1083, lng: -82.6250, priority: 1, officialUrl: 'https://southcarolinaparks.com/caesars-head' },
      { id: 'devils-fork', name: 'Devils Fork State Park', lat: 34.9500, lng: -82.9500, priority: 1, officialUrl: 'https://southcarolinaparks.com/devils-fork' },
      { id: 'jones-gap', name: 'Jones Gap State Park', lat: 35.1167, lng: -82.5833, priority: 1, officialUrl: 'https://southcarolinaparks.com/jones-gap' },
      { id: 'hunting-island', name: 'Hunting Island State Park', lat: 32.3667, lng: -80.4333, priority: 1, officialUrl: 'https://southcarolinaparks.com/hunting-island' },
      { id: 'congaree-area', name: 'Congaree National Park Area', lat: 33.7833, lng: -80.7833, priority: 1 },
      { id: 'paris-mountain', name: 'Paris Mountain State Park', lat: 34.9333, lng: -82.3833, priority: 1, officialUrl: 'https://southcarolinaparks.com/paris-mountain' },
      { id: 'sumter-nf-andrew-pickens', name: 'Sumter NF Andrew Pickens District', lat: 34.8500, lng: -83.1000, priority: 1 },
      { id: 'sumter-nf-long-cane', name: 'Sumter NF Long Cane District', lat: 34.1000, lng: -82.3000, priority: 1 },
      { id: 'francis-marion-nf', name: 'Francis Marion National Forest', lat: 33.1500, lng: -79.7500, priority: 1 },
      { id: 'edisto-beach', name: 'Edisto Beach State Park', lat: 32.5000, lng: -80.3000, priority: 2 },
      { id: 'keowee-toxaway', name: 'Keowee-Toxaway State Park', lat: 34.9333, lng: -82.8833, priority: 2 },
      { id: 'oconee', name: 'Oconee State Park', lat: 34.8667, lng: -83.1000, priority: 2, officialUrl: 'https://southcarolinaparks.com/oconee' },
      { id: 'myrtle-beach', name: 'Myrtle Beach State Park', lat: 33.6500, lng: -78.9167, priority: 2 },
      { id: 'croft', name: 'Croft State Park', lat: 34.9333, lng: -81.8000, priority: 2 },
      { id: 'sesquicentennial', name: 'Sesquicentennial State Park', lat: 34.0833, lng: -80.9000, priority: 3 },
    ],
  },

  NM: {
    stateCode: 'NM',
    stateName: 'New Mexico',
    estimatedParks: 35,
    estimatedTrails: 400,
    trailApiRadius: 25,
    parks: [
      { id: 'city-of-rocks', name: 'City of Rocks State Park', lat: 32.6125, lng: -107.9750, priority: 1, officialUrl: 'https://www.emnrd.nm.gov/spd/find-a-park/city-of-rocks-state-park/' },
      { id: 'sugarite-canyon', name: 'Sugarite Canyon State Park', lat: 36.9667, lng: -104.8833, priority: 1, officialUrl: 'https://www.emnrd.nm.gov/spd/find-a-park/sugarite-canyon-state-park/' },
      { id: 'hyde-memorial', name: 'Hyde Memorial State Park', lat: 35.7333, lng: -105.8167, priority: 1, officialUrl: 'https://www.emnrd.nm.gov/spd/find-a-park/hyde-memorial-state-park/' },
      { id: 'bandelier-area', name: 'Bandelier National Monument Area', lat: 35.7789, lng: -106.2708, priority: 1 },
      { id: 'santa-fe-nf', name: 'Santa Fe National Forest', lat: 35.8500, lng: -105.7500, priority: 1 },
      { id: 'gila-nf-north', name: 'Gila National Forest North', lat: 33.4000, lng: -108.5000, priority: 1 },
      { id: 'gila-nf-south', name: 'Gila National Forest South (Gila Wilderness)', lat: 33.2000, lng: -108.2000, priority: 1 },
      { id: 'carson-nf', name: 'Carson National Forest', lat: 36.5000, lng: -105.5000, priority: 1 },
      { id: 'lincoln-nf', name: 'Lincoln National Forest', lat: 33.0000, lng: -105.7000, priority: 1 },
      { id: 'cibola-nf-sandia', name: 'Cibola NF Sandia Mountains', lat: 35.2000, lng: -106.4500, priority: 1 },
      { id: 'cibola-nf-manzano', name: 'Cibola NF Manzano Mountains', lat: 34.6000, lng: -106.4000, priority: 1 },
      { id: 'tent-rocks', name: 'Kasha-Katuwe Tent Rocks Area', lat: 35.6667, lng: -106.4167, priority: 1 },
      { id: 'rio-grande-gorge', name: 'Rio Grande del Norte NM / Gorge', lat: 36.5333, lng: -105.7333, priority: 1 },
      { id: 'oliver-lee', name: 'Oliver Lee Memorial State Park', lat: 32.8000, lng: -105.9667, priority: 2 },
      { id: 'heron-lake', name: 'Heron Lake State Park', lat: 36.6667, lng: -106.7167, priority: 2 },
      { id: 'villanueva', name: 'Villanueva State Park', lat: 35.2667, lng: -105.3500, priority: 2 },
      { id: 'bottomless-lakes', name: 'Bottomless Lakes State Park', lat: 33.3333, lng: -104.3000, priority: 3 },
    ],
  },

  ID: {
    stateCode: 'ID',
    stateName: 'Idaho',
    estimatedParks: 30,
    estimatedTrails: 500,
    trailApiRadius: 25,
    parks: [
      { id: 'harriman', name: 'Harriman State Park', lat: 44.3667, lng: -111.4000, priority: 1, officialUrl: 'https://parksandrecreation.idaho.gov/parks/harriman/' },
      { id: 'bruneau-dunes', name: 'Bruneau Dunes State Park', lat: 42.8833, lng: -115.7000, priority: 1, officialUrl: 'https://parksandrecreation.idaho.gov/parks/bruneau-dunes/' },
      { id: 'ponderosa', name: 'Ponderosa State Park', lat: 44.7500, lng: -116.1000, priority: 1, officialUrl: 'https://parksandrecreation.idaho.gov/parks/ponderosa/' },
      { id: 'hells-gate', name: 'Hells Gate State Park', lat: 46.3833, lng: -117.0000, priority: 1 },
      { id: 'sawtooth-nra', name: 'Sawtooth National Recreation Area', lat: 43.9000, lng: -114.9000, priority: 1 },
      { id: 'sawtooth-nf-south', name: 'Sawtooth National Forest South', lat: 43.5000, lng: -114.5000, priority: 1 },
      { id: 'boise-nf', name: 'Boise National Forest', lat: 44.0000, lng: -115.5000, priority: 1 },
      { id: 'salmon-challis-nf', name: 'Salmon-Challis National Forest', lat: 44.5000, lng: -114.0000, priority: 1 },
      { id: 'caribou-targhee-nf', name: 'Caribou-Targhee National Forest', lat: 43.5000, lng: -111.5000, priority: 1 },
      { id: 'nez-perce-clearwater-nf', name: 'Nez Perce-Clearwater National Forest', lat: 46.5000, lng: -115.5000, priority: 1 },
      { id: 'idaho-panhandle-nf', name: 'Idaho Panhandle National Forests', lat: 47.5000, lng: -116.5000, priority: 1 },
      { id: 'craters-of-moon', name: 'Craters of the Moon NM', lat: 43.4167, lng: -113.5167, priority: 1 },
      { id: 'farragut', name: 'Farragut State Park', lat: 47.9500, lng: -116.5667, priority: 2 },
      { id: 'castle-rocks', name: 'Castle Rocks State Park', lat: 42.3167, lng: -113.7000, priority: 2 },
      { id: 'thousand-springs', name: 'Thousand Springs State Park', lat: 42.7000, lng: -114.8167, priority: 2 },
      { id: 'bear-lake', name: 'Bear Lake State Park', lat: 42.0833, lng: -111.3167, priority: 2 },
      { id: 'heyburn', name: 'Heyburn State Park', lat: 47.3333, lng: -116.7667, priority: 3 },
    ],
  },

  MT: {
    stateCode: 'MT',
    stateName: 'Montana',
    estimatedParks: 55,
    estimatedTrails: 600,
    trailApiRadius: 25,
    parks: [
      { id: 'glacier-area-west', name: 'Glacier NP West Side Area', lat: 48.5000, lng: -113.9000, priority: 1 },
      { id: 'glacier-area-east', name: 'Glacier NP East Side / Many Glacier', lat: 48.8000, lng: -113.6500, priority: 1 },
      { id: 'flathead-lake', name: 'Flathead Lake State Park', lat: 47.9000, lng: -114.1500, priority: 1 },
      { id: 'lone-pine', name: 'Lone Pine State Park', lat: 48.1500, lng: -114.3500, priority: 1 },
      { id: 'flathead-nf', name: 'Flathead National Forest', lat: 48.2000, lng: -113.8000, priority: 1 },
      { id: 'lolo-nf', name: 'Lolo National Forest', lat: 47.0000, lng: -114.0000, priority: 1 },
      { id: 'gallatin-nf-north', name: 'Gallatin / Custer NF North (Absaroka-Beartooth)', lat: 45.3000, lng: -110.0000, priority: 1 },
      { id: 'gallatin-nf-south', name: 'Gallatin NF South (Yellowstone Gateway)', lat: 45.0000, lng: -111.0000, priority: 1 },
      { id: 'helena-nf', name: 'Helena-Lewis and Clark NF', lat: 47.0000, lng: -112.5000, priority: 1 },
      { id: 'bitterroot-nf', name: 'Bitterroot National Forest', lat: 46.0000, lng: -114.0000, priority: 1 },
      { id: 'bob-marshall', name: 'Bob Marshall Wilderness Area', lat: 47.5000, lng: -113.0000, priority: 1 },
      { id: 'makoshika', name: 'Makoshika State Park', lat: 47.0667, lng: -104.7167, priority: 1 },
      { id: 'lewis-clark-caverns', name: 'Lewis and Clark Caverns State Park', lat: 45.8333, lng: -111.9833, priority: 1 },
      { id: 'bannack', name: 'Bannack State Park', lat: 45.1667, lng: -112.9833, priority: 2 },
      { id: 'spring-meadow-lake', name: 'Spring Meadow Lake State Park', lat: 46.6000, lng: -112.0833, priority: 2 },
      { id: 'giant-springs', name: 'Giant Springs State Park', lat: 47.5167, lng: -111.2000, priority: 2 },
      { id: 'painted-rocks', name: 'Painted Rocks State Park', lat: 45.8167, lng: -114.1000, priority: 3 },
      { id: 'lost-creek', name: 'Lost Creek State Park', lat: 46.0500, lng: -112.8500, priority: 3 },
    ],
  },

  NH: {
    stateCode: 'NH',
    stateName: 'New Hampshire',
    estimatedParks: 93,
    estimatedTrails: 800,
    trailApiRadius: 20,
    parks: [
      { id: 'franconia-notch', name: 'Franconia Notch State Park', lat: 44.1433, lng: -71.6819, priority: 1, officialUrl: 'https://www.nhstateparks.org/visit/state-parks/franconia-notch-state-park' },
      { id: 'crawford-notch', name: 'Crawford Notch State Park', lat: 44.1833, lng: -71.3833, priority: 1 },
      { id: 'mount-monadnock', name: 'Monadnock State Park', lat: 42.8611, lng: -72.1083, priority: 1, officialUrl: 'https://www.nhstateparks.org/visit/state-parks/monadnock-state-park' },
      { id: 'mount-washington', name: 'Mount Washington State Park', lat: 44.2706, lng: -71.3033, priority: 1 },
      { id: 'white-mountain-nf-north', name: 'White Mountain NF North (Presidentials)', lat: 44.2700, lng: -71.3000, priority: 1 },
      { id: 'white-mountain-nf-central', name: 'White Mountain NF Central (Pemi Wilderness)', lat: 44.0500, lng: -71.6000, priority: 1 },
      { id: 'white-mountain-nf-south', name: 'White Mountain NF South (Kancamagus)', lat: 43.9500, lng: -71.4000, priority: 1 },
      { id: 'white-mountain-nf-east', name: 'White Mountain NF East (Carter Range)', lat: 44.2500, lng: -71.1500, priority: 1 },
      { id: 'sunapee', name: 'Mount Sunapee State Park', lat: 43.3333, lng: -72.0833, priority: 2 },
      { id: 'pawtuckaway', name: 'Pawtuckaway State Park', lat: 43.1000, lng: -71.1667, priority: 2 },
      { id: 'pillsbury', name: 'Pillsbury State Park', lat: 43.2333, lng: -72.0667, priority: 2 },
      { id: 'cardigan', name: 'Mount Cardigan State Park', lat: 43.6500, lng: -71.9167, priority: 1 },
      { id: 'dixville-notch', name: 'Dixville Notch State Park', lat: 44.8667, lng: -71.3000, priority: 2 },
      { id: 'odiorne-point', name: 'Odiorne Point State Park', lat: 43.0500, lng: -70.7167, priority: 3 },
    ],
  },

  ME: {
    stateCode: 'ME',
    stateName: 'Maine',
    estimatedParks: 48,
    estimatedTrails: 500,
    trailApiRadius: 25,
    parks: [
      { id: 'baxter', name: 'Baxter State Park (Katahdin)', lat: 45.9044, lng: -68.9217, priority: 1 },
      { id: 'acadia-area', name: 'Acadia National Park Area', lat: 44.3386, lng: -68.2733, priority: 1 },
      { id: 'grafton-notch', name: 'Grafton Notch State Park', lat: 44.5833, lng: -70.9667, priority: 1, officialUrl: 'https://www.maine.gov/dacf/parks/find_a_park/grafton_notch.shtml' },
      { id: 'camden-hills', name: 'Camden Hills State Park', lat: 44.2333, lng: -69.0667, priority: 1, officialUrl: 'https://www.maine.gov/dacf/parks/find_a_park/camden_hills.shtml' },
      { id: 'rangeley-lake', name: 'Rangeley Lake State Park', lat: 44.9167, lng: -70.6833, priority: 2 },
      { id: 'lily-bay', name: 'Lily Bay State Park', lat: 45.6833, lng: -69.6333, priority: 2 },
      { id: 'bradbury-mountain', name: 'Bradbury Mountain State Park', lat: 43.8833, lng: -70.1833, priority: 2 },
      { id: 'mount-blue', name: 'Mount Blue State Park', lat: 44.6667, lng: -70.2333, priority: 2 },
      { id: '100-mile-wilderness-south', name: '100-Mile Wilderness South', lat: 45.3000, lng: -69.2000, priority: 1 },
      { id: '100-mile-wilderness-north', name: '100-Mile Wilderness North', lat: 45.7000, lng: -69.0000, priority: 1 },
      { id: 'bigelow-preserve', name: 'Bigelow Preserve', lat: 45.1333, lng: -70.2833, priority: 1 },
      { id: 'white-mountain-nf-me', name: 'White Mountain NF Maine Section', lat: 44.3000, lng: -71.0000, priority: 1 },
      { id: 'aroostook', name: 'Aroostook State Park', lat: 46.7667, lng: -68.0333, priority: 3 },
      { id: 'cobscook-bay', name: 'Cobscook Bay State Park', lat: 44.8667, lng: -67.1667, priority: 3 },
    ],
  },

  WY: {
    stateCode: 'WY',
    stateName: 'Wyoming',
    estimatedParks: 30,
    estimatedTrails: 700,
    trailApiRadius: 25,
    parks: [
      { id: 'yellowstone-south', name: 'Yellowstone Area South', lat: 44.4600, lng: -110.8300, priority: 1 },
      { id: 'yellowstone-north', name: 'Yellowstone Area North', lat: 44.9200, lng: -110.4200, priority: 1 },
      { id: 'grand-teton', name: 'Grand Teton NP Area', lat: 43.7400, lng: -110.8000, priority: 1 },
      { id: 'wind-river-north', name: 'Wind River Range North', lat: 43.2000, lng: -109.7000, priority: 1 },
      { id: 'wind-river-south', name: 'Wind River Range South (Cirque of Towers)', lat: 42.7500, lng: -109.2000, priority: 1 },
      { id: 'bighorn-nf-north', name: 'Bighorn National Forest North', lat: 44.6000, lng: -107.3000, priority: 1 },
      { id: 'bighorn-nf-south', name: 'Bighorn National Forest South', lat: 44.2000, lng: -107.0000, priority: 1 },
      { id: 'bridger-teton-nf', name: 'Bridger-Teton National Forest', lat: 43.5000, lng: -110.2000, priority: 1 },
      { id: 'shoshone-nf', name: 'Shoshone National Forest', lat: 44.0000, lng: -109.5000, priority: 1 },
      { id: 'medicine-bow-nf', name: 'Medicine Bow National Forest', lat: 41.3500, lng: -106.3000, priority: 1 },
      { id: 'devils-tower', name: 'Devils Tower NM Area', lat: 44.5900, lng: -104.7100, priority: 1 },
      { id: 'curt-gowdy', name: 'Curt Gowdy State Park', lat: 41.1333, lng: -105.2167, priority: 2 },
      { id: 'sinks-canyon', name: 'Sinks Canyon State Park', lat: 42.7500, lng: -108.8333, priority: 2 },
      { id: 'boysen', name: 'Boysen State Park', lat: 43.3833, lng: -108.1667, priority: 3 },
    ],
  },

  OH: {
    stateCode: 'OH',
    stateName: 'Ohio',
    estimatedParks: 75,
    estimatedTrails: 500,
    trailApiRadius: 20,
    parks: [
      { id: 'hocking-hills', name: 'Hocking Hills State Park', lat: 39.4333, lng: -82.5333, priority: 1 },
      { id: 'cuyahoga-valley', name: 'Cuyahoga Valley NP Area', lat: 41.2500, lng: -81.5500, priority: 1 },
      { id: 'wayne-nf-north', name: 'Wayne National Forest North', lat: 39.5000, lng: -82.0000, priority: 1 },
      { id: 'wayne-nf-south', name: 'Wayne National Forest South', lat: 38.8000, lng: -82.2000, priority: 1 },
      { id: 'mohican', name: 'Mohican State Park', lat: 40.6167, lng: -82.3167, priority: 1 },
      { id: 'salt-fork', name: 'Salt Fork State Park', lat: 40.1167, lng: -81.5500, priority: 2 },
      { id: 'john-bryan', name: 'John Bryan State Park', lat: 39.7833, lng: -83.8667, priority: 2 },
      { id: 'nelson-ledges', name: 'Nelson-Kennedy Ledges State Park', lat: 41.3333, lng: -81.0333, priority: 2 },
      { id: 'tar-hollow', name: 'Tar Hollow State Park', lat: 39.3500, lng: -82.7500, priority: 2 },
      { id: 'caesar-creek', name: 'Caesar Creek State Park', lat: 39.5000, lng: -84.0667, priority: 2 },
      { id: 'findley', name: 'Findley State Park', lat: 41.1000, lng: -82.2333, priority: 3 },
    ],
  },

  IL: {
    stateCode: 'IL',
    stateName: 'Illinois',
    estimatedParks: 60,
    estimatedTrails: 400,
    trailApiRadius: 20,
    parks: [
      { id: 'starved-rock', name: 'Starved Rock State Park', lat: 41.3167, lng: -88.9833, priority: 1 },
      { id: 'shawnee-nf-east', name: 'Shawnee National Forest East (Garden of the Gods)', lat: 37.6000, lng: -88.3000, priority: 1 },
      { id: 'shawnee-nf-west', name: 'Shawnee National Forest West', lat: 37.5000, lng: -89.1000, priority: 1 },
      { id: 'matthiessen', name: 'Matthiessen State Park', lat: 41.3000, lng: -89.0167, priority: 1 },
      { id: 'giant-city', name: 'Giant City State Park', lat: 37.6000, lng: -89.1833, priority: 1 },
      { id: 'ferne-clyffe', name: 'Ferne Clyffe State Park', lat: 37.5333, lng: -88.9667, priority: 2 },
      { id: 'pere-marquette', name: 'Pere Marquette State Park', lat: 38.9667, lng: -90.5167, priority: 2 },
      { id: 'mississippi-palisades', name: 'Mississippi Palisades State Park', lat: 42.1333, lng: -90.1667, priority: 2 },
      { id: 'trail-of-tears-sf', name: 'Trail of Tears State Forest', lat: 37.4500, lng: -89.4000, priority: 2 },
      { id: 'rock-cut', name: 'Rock Cut State Park', lat: 42.3333, lng: -88.9833, priority: 3 },
    ],
  },

  MA: {
    stateCode: 'MA',
    stateName: 'Massachusetts',
    estimatedParks: 90,
    estimatedTrails: 600,
    trailApiRadius: 20,
    parks: [
      { id: 'mount-greylock', name: 'Mount Greylock State Reservation', lat: 42.6375, lng: -73.1664, priority: 1 },
      { id: 'blue-hills', name: 'Blue Hills Reservation', lat: 42.2167, lng: -71.1000, priority: 1 },
      { id: 'mount-tom', name: 'Mount Tom State Reservation', lat: 42.2500, lng: -72.6333, priority: 1 },
      { id: 'wachusett-mountain', name: 'Wachusett Mountain State Reservation', lat: 42.4833, lng: -71.8833, priority: 1 },
      { id: 'bash-bish-falls', name: 'Bash Bish Falls State Park', lat: 42.1167, lng: -73.4833, priority: 1 },
      { id: 'mohawk-trail-sf', name: 'Mohawk Trail State Forest', lat: 42.6333, lng: -72.9500, priority: 1 },
      { id: 'nickerson', name: 'Nickerson State Park', lat: 41.7667, lng: -70.0167, priority: 2 },
      { id: 'walden-pond', name: 'Walden Pond State Reservation', lat: 42.4389, lng: -71.3350, priority: 2 },
      { id: 'october-mountain-sf', name: 'October Mountain State Forest', lat: 42.3000, lng: -73.2000, priority: 2 },
      { id: 'beartown-sf', name: 'Beartown State Forest', lat: 42.2000, lng: -73.3000, priority: 2 },
      { id: 'harold-parker-sf', name: 'Harold Parker State Forest', lat: 42.6333, lng: -71.1000, priority: 3 },
    ],
  },

  MD: {
    stateCode: 'MD',
    stateName: 'Maryland',
    estimatedParks: 50,
    estimatedTrails: 400,
    trailApiRadius: 20,
    parks: [
      { id: 'patapsco-valley', name: 'Patapsco Valley State Park', lat: 39.2500, lng: -76.7833, priority: 1 },
      { id: 'cunningham-falls', name: 'Cunningham Falls State Park', lat: 39.6333, lng: -77.4667, priority: 1 },
      { id: 'gambrill', name: 'Gambrill State Park', lat: 39.4667, lng: -77.4833, priority: 1 },
      { id: 'green-ridge-sf', name: 'Green Ridge State Forest', lat: 39.6500, lng: -78.4500, priority: 1 },
      { id: 'savage-river-sf', name: 'Savage River State Forest', lat: 39.5667, lng: -79.1000, priority: 1 },
      { id: 'catoctin-mountain', name: 'Catoctin Mountain Park Area', lat: 39.6500, lng: -77.4500, priority: 1 },
      { id: 'c-and-o-canal', name: 'C&O Canal Towpath', lat: 39.6000, lng: -77.8000, priority: 1 },
      { id: 'assateague-island', name: 'Assateague Island / State Park', lat: 38.1667, lng: -75.1500, priority: 1 },
      { id: 'susquehanna', name: 'Susquehanna State Park', lat: 39.6000, lng: -76.1500, priority: 2 },
      { id: 'gunpowder-falls', name: 'Gunpowder Falls State Park', lat: 39.4667, lng: -76.4833, priority: 2 },
      { id: 'calvert-cliffs', name: 'Calvert Cliffs State Park', lat: 38.3833, lng: -76.4333, priority: 2 },
      { id: 'rocks', name: 'Rocks State Park', lat: 39.6333, lng: -76.4167, priority: 2 },
    ],
  },

  NV: {
    stateCode: 'NV',
    stateName: 'Nevada',
    estimatedParks: 25,
    estimatedTrails: 300,
    trailApiRadius: 25,
    parks: [
      { id: 'valley-of-fire', name: 'Valley of Fire State Park', lat: 36.4406, lng: -114.5131, priority: 1, officialUrl: 'https://parks.nv.gov/parks/valley-of-fire' },
      { id: 'red-rock-canyon', name: 'Red Rock Canyon NCA', lat: 36.1350, lng: -115.4294, priority: 1 },
      { id: 'spring-mountains-nra', name: 'Spring Mountains NRA (Mt Charleston)', lat: 36.2700, lng: -115.6900, priority: 1 },
      { id: 'humboldt-toiyabe-nf-south', name: 'Humboldt-Toiyabe NF South', lat: 36.3000, lng: -115.7000, priority: 1 },
      { id: 'humboldt-toiyabe-nf-north', name: 'Humboldt-Toiyabe NF North (Ruby Mountains)', lat: 40.6000, lng: -115.5000, priority: 1 },
      { id: 'lake-tahoe-nv', name: 'Lake Tahoe Nevada State Park', lat: 39.1833, lng: -119.9167, priority: 1, officialUrl: 'https://parks.nv.gov/parks/lake-tahoe-nevada' },
      { id: 'cathedral-gorge', name: 'Cathedral Gorge State Park', lat: 37.8000, lng: -114.4167, priority: 2 },
      { id: 'berlin-ichthyosaur', name: 'Berlin-Ichthyosaur State Park', lat: 38.8833, lng: -117.5833, priority: 2 },
      { id: 'kershaw-ryan', name: 'Kershaw-Ryan State Park', lat: 37.6333, lng: -114.5833, priority: 3 },
      { id: 'ward-charcoal-ovens', name: 'Ward Charcoal Ovens State Park', lat: 39.0667, lng: -114.9333, priority: 3 },
    ],
  },

  SD: {
    stateCode: 'SD',
    stateName: 'South Dakota',
    estimatedParks: 15,
    estimatedTrails: 200,
    trailApiRadius: 25,
    parks: [
      { id: 'badlands-np', name: 'Badlands National Park', lat: 43.8554, lng: -102.3397, priority: 1 },
      { id: 'wind-cave-np', name: 'Wind Cave National Park', lat: 43.5724, lng: -103.4838, priority: 1 },
      { id: 'custer-sp', name: 'Custer State Park', lat: 43.7600, lng: -103.4300, priority: 1 },
      { id: 'black-hills-nf', name: 'Black Hills National Forest', lat: 44.0000, lng: -103.7500, priority: 1 },
      { id: 'mount-rushmore', name: 'Mount Rushmore National Memorial', lat: 43.8791, lng: -103.4591, priority: 2 },
    ],
  },

  AR: {
    stateCode: 'AR',
    stateName: 'Arkansas',
    estimatedParks: 15,
    estimatedTrails: 200,
    trailApiRadius: 25,
    parks: [
      { id: 'hot-springs-np', name: 'Hot Springs National Park', lat: 34.5217, lng: -93.0424, priority: 1 },
      { id: 'devil-den-sp', name: "Devil's Den State Park", lat: 35.7750, lng: -94.2428, priority: 1 },
      { id: 'petit-jean-sp', name: 'Petit Jean State Park', lat: 35.1100, lng: -92.9300, priority: 1 },
      { id: 'pinnacle-mountain-sp', name: 'Pinnacle Mountain State Park', lat: 34.8400, lng: -92.4800, priority: 1 },
      { id: 'ozark-nf', name: 'Ozark National Forest', lat: 35.7000, lng: -93.3000, priority: 1 },
      { id: 'buffalo-national-river', name: 'Buffalo National River', lat: 36.0300, lng: -92.9000, priority: 1 },
    ],
  },

  IN: {
    stateCode: 'IN',
    stateName: 'Indiana',
    estimatedParks: 15,
    estimatedTrails: 150,
    trailApiRadius: 25,
    parks: [
      { id: 'indiana-dunes-np', name: 'Indiana Dunes National Park', lat: 41.6533, lng: -87.0524, priority: 1 },
      { id: 'brown-county-sp', name: 'Brown County State Park', lat: 39.1500, lng: -86.2300, priority: 1 },
      { id: 'turkey-run-sp', name: 'Turkey Run State Park', lat: 39.8800, lng: -87.2100, priority: 1 },
      { id: 'clifty-falls-sp', name: 'Clifty Falls State Park', lat: 38.7500, lng: -85.4200, priority: 2 },
      { id: 'hoosier-nf', name: 'Hoosier National Forest', lat: 38.5000, lng: -86.5000, priority: 1 },
    ],
  },

  MO: {
    stateCode: 'MO',
    stateName: 'Missouri',
    estimatedParks: 15,
    estimatedTrails: 200,
    trailApiRadius: 25,
    parks: [
      { id: 'gateway-arch-np', name: 'Gateway Arch National Park', lat: 38.6247, lng: -90.1848, priority: 1 },
      { id: 'mark-twain-nf', name: 'Mark Twain National Forest', lat: 37.5000, lng: -91.5000, priority: 1 },
      { id: 'ozark-national-scenic-riverways', name: 'Ozark National Scenic Riverways', lat: 37.1500, lng: -91.3500, priority: 1 },
      { id: 'ha-ha-tonka-sp', name: 'Ha Ha Tonka State Park', lat: 37.9700, lng: -92.7700, priority: 1 },
      { id: 'johnson-shut-ins-sp', name: "Johnson's Shut-Ins State Park", lat: 37.5500, lng: -90.8400, priority: 1 },
      { id: 'elephant-rocks-sp', name: 'Elephant Rocks State Park', lat: 37.6500, lng: -90.6900, priority: 2 },
    ],
  },

  ND: {
    stateCode: 'ND',
    stateName: 'North Dakota',
    estimatedParks: 10,
    estimatedTrails: 100,
    trailApiRadius: 25,
    parks: [
      { id: 'theodore-roosevelt-np-south', name: 'Theodore Roosevelt NP South Unit', lat: 46.9790, lng: -103.5387, priority: 1 },
      { id: 'theodore-roosevelt-np-north', name: 'Theodore Roosevelt NP North Unit', lat: 47.5861, lng: -103.3882, priority: 1 },
      { id: 'little-missouri-ng', name: 'Little Missouri National Grassland', lat: 47.0000, lng: -103.5000, priority: 1 },
      { id: 'fort-abraham-lincoln-sp', name: 'Fort Abraham Lincoln State Park', lat: 46.7600, lng: -100.8400, priority: 2 },
      { id: 'maah-daah-hey-trail', name: 'Maah Daah Hey Trail', lat: 47.2000, lng: -103.4000, priority: 1 },
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
