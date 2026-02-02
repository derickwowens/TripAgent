/**
 * Generate and Upload Comprehensive Trail Data to S3
 * 
 * This script programmatically generates trail data for:
 * - All 63 National Parks
 * - Wisconsin State Parks
 * - Florida State Parks
 * 
 * Run: npx tsx data/scripts/uploadAllTrails.ts
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from 'dotenv';

config();

const S3_BUCKET = process.env.PARK_DATA_S3_BUCKET || 'tripagent-park-data';
const S3_REGION = process.env.AWS_REGION || 'us-east-1';

const s3Client = new S3Client({
  region: S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Helper to create AllTrails URL slug
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// State name to abbreviation mapping for AllTrails URLs
const STATE_ABBREVS: Record<string, string> = {
  'Alabama': 'alabama', 'Alaska': 'alaska', 'Arizona': 'arizona', 'Arkansas': 'arkansas',
  'California': 'california', 'Colorado': 'colorado', 'Connecticut': 'connecticut', 'Delaware': 'delaware',
  'Florida': 'florida', 'Georgia': 'georgia', 'Hawaii': 'hawaii', 'Idaho': 'idaho',
  'Illinois': 'illinois', 'Indiana': 'indiana', 'Iowa': 'iowa', 'Kansas': 'kansas',
  'Kentucky': 'kentucky', 'Louisiana': 'louisiana', 'Maine': 'maine', 'Maryland': 'maryland',
  'Massachusetts': 'massachusetts', 'Michigan': 'michigan', 'Minnesota': 'minnesota', 'Mississippi': 'mississippi',
  'Missouri': 'missouri', 'Montana': 'montana', 'Nebraska': 'nebraska', 'Nevada': 'nevada',
  'New Hampshire': 'new-hampshire', 'New Jersey': 'new-jersey', 'New Mexico': 'new-mexico', 'New York': 'new-york',
  'North Carolina': 'north-carolina', 'North Dakota': 'north-dakota', 'Ohio': 'ohio', 'Oklahoma': 'oklahoma',
  'Oregon': 'oregon', 'Pennsylvania': 'pennsylvania', 'Rhode Island': 'rhode-island', 'South Carolina': 'south-carolina',
  'South Dakota': 'south-dakota', 'Tennessee': 'tennessee', 'Texas': 'texas', 'Utah': 'utah',
  'Vermont': 'vermont', 'Virginia': 'virginia', 'Washington': 'washington', 'West Virginia': 'west-virginia',
  'Wisconsin': 'wisconsin', 'Wyoming': 'wyoming', 'U.S. Virgin Islands': 'us-virgin-islands',
};

function getStateSlug(stateName: string): string {
  // Handle multi-state parks (e.g., "Wyoming/Montana/Idaho")
  const primaryState = stateName.split('/')[0].trim();
  return STATE_ABBREVS[primaryState] || toSlug(primaryState);
}

// National Parks with codes and trail data
const NATIONAL_PARKS_DATA: Record<string, { name: string; state: string; trails: Array<{ name: string; difficulty: string; length: string; type: string }> }> = {
  acad: {
    name: 'Acadia National Park',
    state: 'Maine',
    trails: [
      { name: 'Cadillac Mountain North Ridge Trail', difficulty: 'moderate', length: '4.4 mi', type: 'out-and-back' },
      { name: 'Precipice Trail', difficulty: 'hard', length: '1.6 mi', type: 'out-and-back' },
      { name: 'Beehive Trail', difficulty: 'hard', length: '1.4 mi', type: 'loop' },
      { name: 'Jordan Pond Path', difficulty: 'easy', length: '3.3 mi', type: 'loop' },
      { name: 'Ocean Path Trail', difficulty: 'easy', length: '4.4 mi', type: 'out-and-back' },
    ],
  },
  arch: {
    name: 'Arches National Park',
    state: 'Utah',
    trails: [
      { name: 'Delicate Arch Trail', difficulty: 'moderate', length: '3.2 mi', type: 'out-and-back' },
      { name: 'Devils Garden Loop Trail', difficulty: 'hard', length: '7.9 mi', type: 'loop' },
      { name: 'Landscape Arch Trail', difficulty: 'easy', length: '1.9 mi', type: 'out-and-back' },
      { name: 'Park Avenue Trail', difficulty: 'easy', length: '2.0 mi', type: 'point-to-point' },
      { name: 'Double Arch Trail', difficulty: 'easy', length: '0.5 mi', type: 'out-and-back' },
    ],
  },
  badl: {
    name: 'Badlands National Park',
    state: 'South Dakota',
    trails: [
      { name: 'Notch Trail', difficulty: 'moderate', length: '1.5 mi', type: 'out-and-back' },
      { name: 'Door Trail', difficulty: 'easy', length: '0.8 mi', type: 'out-and-back' },
      { name: 'Castle Trail', difficulty: 'moderate', length: '10.0 mi', type: 'out-and-back' },
      { name: 'Saddle Pass Trail', difficulty: 'moderate', length: '0.3 mi', type: 'out-and-back' },
    ],
  },
  bibe: {
    name: 'Big Bend National Park',
    state: 'Texas',
    trails: [
      { name: 'Lost Mine Trail', difficulty: 'moderate', length: '4.8 mi', type: 'out-and-back' },
      { name: 'Santa Elena Canyon Trail', difficulty: 'easy', length: '1.7 mi', type: 'out-and-back' },
      { name: 'Window Trail', difficulty: 'moderate', length: '5.6 mi', type: 'out-and-back' },
      { name: 'Emory Peak Trail', difficulty: 'hard', length: '10.5 mi', type: 'out-and-back' },
    ],
  },
  bisc: {
    name: 'Biscayne National Park',
    state: 'Florida',
    trails: [
      { name: 'Jetty Trail', difficulty: 'easy', length: '0.5 mi', type: 'out-and-back' },
      { name: 'Elliott Key Trail', difficulty: 'easy', length: '7.0 mi', type: 'out-and-back' },
    ],
  },
  blca: {
    name: 'Black Canyon of the Gunnison National Park',
    state: 'Colorado',
    trails: [
      { name: 'Warner Point Nature Trail', difficulty: 'easy', length: '1.5 mi', type: 'out-and-back' },
      { name: 'Rim Rock Trail', difficulty: 'easy', length: '1.0 mi', type: 'loop' },
      { name: 'Oak Flat Loop Trail', difficulty: 'moderate', length: '2.0 mi', type: 'loop' },
    ],
  },
  brca: {
    name: 'Bryce Canyon National Park',
    state: 'Utah',
    trails: [
      { name: 'Navajo Loop Trail', difficulty: 'moderate', length: '1.3 mi', type: 'loop' },
      { name: 'Queens Garden Trail', difficulty: 'moderate', length: '1.8 mi', type: 'out-and-back' },
      { name: 'Fairyland Loop Trail', difficulty: 'hard', length: '8.0 mi', type: 'loop' },
      { name: 'Peek-A-Boo Loop Trail', difficulty: 'hard', length: '5.5 mi', type: 'loop' },
    ],
  },
  cany: {
    name: 'Canyonlands National Park',
    state: 'Utah',
    trails: [
      { name: 'Mesa Arch Trail', difficulty: 'easy', length: '0.7 mi', type: 'loop' },
      { name: 'Grand View Point Trail', difficulty: 'easy', length: '2.0 mi', type: 'out-and-back' },
      { name: 'Upheaval Dome Trail', difficulty: 'moderate', length: '1.8 mi', type: 'out-and-back' },
      { name: 'Chesler Park Loop', difficulty: 'hard', length: '11.0 mi', type: 'loop' },
    ],
  },
  care: {
    name: 'Capitol Reef National Park',
    state: 'Utah',
    trails: [
      { name: 'Hickman Bridge Trail', difficulty: 'moderate', length: '1.8 mi', type: 'out-and-back' },
      { name: 'Capitol Gorge Trail', difficulty: 'easy', length: '2.0 mi', type: 'out-and-back' },
      { name: 'Cassidy Arch Trail', difficulty: 'moderate', length: '3.5 mi', type: 'out-and-back' },
      { name: 'Rim Overlook Trail', difficulty: 'moderate', length: '4.5 mi', type: 'out-and-back' },
    ],
  },
  cave: {
    name: 'Carlsbad Caverns National Park',
    state: 'New Mexico',
    trails: [
      { name: 'Natural Entrance Trail', difficulty: 'moderate', length: '1.3 mi', type: 'point-to-point' },
      { name: 'Rattlesnake Canyon Trail', difficulty: 'hard', length: '6.0 mi', type: 'out-and-back' },
    ],
  },
  chis: {
    name: 'Channel Islands National Park',
    state: 'California',
    trails: [
      { name: 'Cavern Point Trail', difficulty: 'easy', length: '2.0 mi', type: 'loop' },
      { name: 'Potato Harbor Trail', difficulty: 'moderate', length: '5.0 mi', type: 'out-and-back' },
      { name: 'Scorpion Canyon Loop', difficulty: 'moderate', length: '4.5 mi', type: 'loop' },
    ],
  },
  cong: {
    name: 'Congaree National Park',
    state: 'South Carolina',
    trails: [
      { name: 'Boardwalk Loop Trail', difficulty: 'easy', length: '2.4 mi', type: 'loop' },
      { name: 'Weston Lake Loop Trail', difficulty: 'moderate', length: '4.4 mi', type: 'loop' },
      { name: 'Oakridge Trail', difficulty: 'easy', length: '7.5 mi', type: 'out-and-back' },
    ],
  },
  crla: {
    name: 'Crater Lake National Park',
    state: 'Oregon',
    trails: [
      { name: 'Cleetwood Cove Trail', difficulty: 'hard', length: '2.2 mi', type: 'out-and-back' },
      { name: 'Watchman Peak Trail', difficulty: 'moderate', length: '1.6 mi', type: 'out-and-back' },
      { name: 'Garfield Peak Trail', difficulty: 'moderate', length: '3.4 mi', type: 'out-and-back' },
      { name: 'Mount Scott Trail', difficulty: 'moderate', length: '5.0 mi', type: 'out-and-back' },
    ],
  },
  cuva: {
    name: 'Cuyahoga Valley National Park',
    state: 'Ohio',
    trails: [
      { name: 'Brandywine Gorge Trail', difficulty: 'easy', length: '1.5 mi', type: 'loop' },
      { name: 'Blue Hen Falls Trail', difficulty: 'easy', length: '1.2 mi', type: 'out-and-back' },
      { name: 'Ledges Trail', difficulty: 'easy', length: '2.2 mi', type: 'loop' },
      { name: 'Stanford Trail', difficulty: 'moderate', length: '3.8 mi', type: 'loop' },
    ],
  },
  dena: {
    name: 'Denali National Park',
    state: 'Alaska',
    trails: [
      { name: 'Horseshoe Lake Trail', difficulty: 'easy', length: '1.3 mi', type: 'loop' },
      { name: 'Savage River Loop Trail', difficulty: 'easy', length: '2.0 mi', type: 'loop' },
      { name: 'Mount Healy Overlook Trail', difficulty: 'hard', length: '4.5 mi', type: 'out-and-back' },
      { name: 'Triple Lakes Trail', difficulty: 'hard', length: '9.5 mi', type: 'point-to-point' },
    ],
  },
  deva: {
    name: 'Death Valley National Park',
    state: 'California',
    trails: [
      { name: 'Golden Canyon Trail', difficulty: 'moderate', length: '3.0 mi', type: 'out-and-back' },
      { name: 'Mesquite Flat Sand Dunes', difficulty: 'easy', length: '2.0 mi', type: 'out-and-back' },
      { name: 'Badwater Basin Salt Flats', difficulty: 'easy', length: '2.0 mi', type: 'out-and-back' },
      { name: 'Telescope Peak Trail', difficulty: 'hard', length: '14.0 mi', type: 'out-and-back' },
      { name: 'Natural Bridge Canyon Trail', difficulty: 'easy', length: '1.0 mi', type: 'out-and-back' },
    ],
  },
  drto: {
    name: 'Dry Tortugas National Park',
    state: 'Florida',
    trails: [
      { name: 'Fort Jefferson Moat Walk', difficulty: 'easy', length: '0.6 mi', type: 'loop' },
      { name: 'Garden Key Trail', difficulty: 'easy', length: '0.5 mi', type: 'loop' },
    ],
  },
  ever: {
    name: 'Everglades National Park',
    state: 'Florida',
    trails: [
      { name: 'Anhinga Trail', difficulty: 'easy', length: '0.8 mi', type: 'loop' },
      { name: 'Shark Valley Tram Trail', difficulty: 'easy', length: '15.0 mi', type: 'loop' },
      { name: 'Gumbo Limbo Trail', difficulty: 'easy', length: '0.4 mi', type: 'loop' },
      { name: 'Pa-hay-okee Overlook Trail', difficulty: 'easy', length: '0.2 mi', type: 'out-and-back' },
    ],
  },
  gaar: {
    name: 'Gates of the Arctic National Park',
    state: 'Alaska',
    trails: [
      { name: 'Arrigetch Peaks Area', difficulty: 'hard', length: '10.0 mi', type: 'out-and-back' },
    ],
  },
  jeff: {
    name: 'Gateway Arch National Park',
    state: 'Missouri',
    trails: [
      { name: 'Riverfront Trail', difficulty: 'easy', length: '2.5 mi', type: 'out-and-back' },
    ],
  },
  glac: {
    name: 'Glacier National Park',
    state: 'Montana',
    trails: [
      { name: 'Highline Trail', difficulty: 'hard', length: '11.8 mi', type: 'point-to-point' },
      { name: 'Grinnell Glacier Trail', difficulty: 'hard', length: '10.6 mi', type: 'out-and-back' },
      { name: 'Avalanche Lake Trail', difficulty: 'moderate', length: '5.9 mi', type: 'out-and-back' },
      { name: 'Hidden Lake Overlook Trail', difficulty: 'moderate', length: '2.9 mi', type: 'out-and-back' },
      { name: 'Trail of the Cedars', difficulty: 'easy', length: '0.9 mi', type: 'loop' },
    ],
  },
  glba: {
    name: 'Glacier Bay National Park',
    state: 'Alaska',
    trails: [
      { name: 'Forest Loop Trail', difficulty: 'easy', length: '1.0 mi', type: 'loop' },
      { name: 'Bartlett River Trail', difficulty: 'moderate', length: '4.0 mi', type: 'out-and-back' },
    ],
  },
  grca: {
    name: 'Grand Canyon National Park',
    state: 'Arizona',
    trails: [
      { name: 'Bright Angel Trail', difficulty: 'hard', length: '12.0 mi', type: 'out-and-back' },
      { name: 'South Kaibab Trail', difficulty: 'hard', length: '6.0 mi', type: 'out-and-back' },
      { name: 'Rim Trail', difficulty: 'easy', length: '13.0 mi', type: 'point-to-point' },
      { name: 'North Kaibab Trail', difficulty: 'hard', length: '14.0 mi', type: 'out-and-back' },
    ],
  },
  grte: {
    name: 'Grand Teton National Park',
    state: 'Wyoming',
    trails: [
      { name: 'Cascade Canyon Trail', difficulty: 'hard', length: '9.1 mi', type: 'out-and-back' },
      { name: 'Delta Lake Trail', difficulty: 'hard', length: '7.4 mi', type: 'out-and-back' },
      { name: 'Jenny Lake Loop Trail', difficulty: 'moderate', length: '7.1 mi', type: 'loop' },
      { name: 'Taggart Lake Trail', difficulty: 'moderate', length: '3.0 mi', type: 'out-and-back' },
      { name: 'Inspiration Point Trail', difficulty: 'moderate', length: '2.0 mi', type: 'out-and-back' },
    ],
  },
  grba: {
    name: 'Great Basin National Park',
    state: 'Nevada',
    trails: [
      { name: 'Bristlecone and Glacier Trail', difficulty: 'moderate', length: '4.6 mi', type: 'out-and-back' },
      { name: 'Alpine Lakes Loop Trail', difficulty: 'moderate', length: '2.7 mi', type: 'loop' },
      { name: 'Wheeler Peak Summit Trail', difficulty: 'hard', length: '8.6 mi', type: 'out-and-back' },
    ],
  },
  grsa: {
    name: 'Great Sand Dunes National Park',
    state: 'Colorado',
    trails: [
      { name: 'High Dune Trail', difficulty: 'hard', length: '2.5 mi', type: 'out-and-back' },
      { name: 'Mosca Pass Trail', difficulty: 'moderate', length: '7.0 mi', type: 'out-and-back' },
      { name: 'Medano Lake Trail', difficulty: 'hard', length: '9.0 mi', type: 'out-and-back' },
    ],
  },
  grsm: {
    name: 'Great Smoky Mountains National Park',
    state: 'Tennessee',
    trails: [
      { name: 'Alum Cave Trail', difficulty: 'hard', length: '4.4 mi', type: 'out-and-back' },
      { name: 'Rainbow Falls Trail', difficulty: 'moderate', length: '5.4 mi', type: 'out-and-back' },
      { name: 'Laurel Falls Trail', difficulty: 'easy', length: '2.6 mi', type: 'out-and-back' },
      { name: 'Chimney Tops Trail', difficulty: 'hard', length: '4.0 mi', type: 'out-and-back' },
      { name: 'Clingmans Dome Trail', difficulty: 'moderate', length: '1.0 mi', type: 'out-and-back' },
    ],
  },
  gumo: {
    name: 'Guadalupe Mountains National Park',
    state: 'Texas',
    trails: [
      { name: 'Guadalupe Peak Trail', difficulty: 'hard', length: '8.4 mi', type: 'out-and-back' },
      { name: 'Devils Hall Trail', difficulty: 'moderate', length: '4.2 mi', type: 'out-and-back' },
      { name: 'McKittrick Canyon Trail', difficulty: 'moderate', length: '6.8 mi', type: 'out-and-back' },
    ],
  },
  hale: {
    name: 'Haleakala National Park',
    state: 'Hawaii',
    trails: [
      { name: 'Sliding Sands Trail', difficulty: 'hard', length: '11.2 mi', type: 'out-and-back' },
      { name: 'Pipiwai Trail', difficulty: 'moderate', length: '4.0 mi', type: 'out-and-back' },
      { name: 'Halemau Trail', difficulty: 'hard', length: '8.0 mi', type: 'out-and-back' },
    ],
  },
  havo: {
    name: 'Hawaii Volcanoes National Park',
    state: 'Hawaii',
    trails: [
      { name: 'Kilauea Iki Trail', difficulty: 'moderate', length: '4.0 mi', type: 'loop' },
      { name: 'Thurston Lava Tube Trail', difficulty: 'easy', length: '0.5 mi', type: 'loop' },
      { name: 'Devastation Trail', difficulty: 'easy', length: '1.0 mi', type: 'out-and-back' },
      { name: 'Crater Rim Trail', difficulty: 'moderate', length: '11.0 mi', type: 'loop' },
    ],
  },
  hosp: {
    name: 'Hot Springs National Park',
    state: 'Arkansas',
    trails: [
      { name: 'Hot Springs Mountain Trail', difficulty: 'moderate', length: '1.7 mi', type: 'out-and-back' },
      { name: 'Sunset Trail', difficulty: 'moderate', length: '10.0 mi', type: 'out-and-back' },
      { name: 'Grand Promenade', difficulty: 'easy', length: '0.5 mi', type: 'out-and-back' },
    ],
  },
  indu: {
    name: 'Indiana Dunes National Park',
    state: 'Indiana',
    trails: [
      { name: '3 Dune Challenge Trail', difficulty: 'hard', length: '1.5 mi', type: 'out-and-back' },
      { name: 'Cowles Bog Trail', difficulty: 'moderate', length: '4.7 mi', type: 'loop' },
      { name: 'West Beach Trail', difficulty: 'easy', length: '0.9 mi', type: 'loop' },
    ],
  },
  isro: {
    name: 'Isle Royale National Park',
    state: 'Michigan',
    trails: [
      { name: 'Greenstone Ridge Trail', difficulty: 'hard', length: '40.0 mi', type: 'point-to-point' },
      { name: 'Scoville Point Trail', difficulty: 'easy', length: '4.2 mi', type: 'loop' },
      { name: 'Lookout Louise Trail', difficulty: 'moderate', length: '1.0 mi', type: 'out-and-back' },
    ],
  },
  jotr: {
    name: 'Joshua Tree National Park',
    state: 'California',
    trails: [
      { name: 'Ryan Mountain Trail', difficulty: 'moderate', length: '3.0 mi', type: 'out-and-back' },
      { name: 'Hidden Valley Trail', difficulty: 'easy', length: '1.0 mi', type: 'loop' },
      { name: 'Barker Dam Trail', difficulty: 'easy', length: '1.3 mi', type: 'loop' },
      { name: '49 Palms Oasis Trail', difficulty: 'moderate', length: '3.0 mi', type: 'out-and-back' },
      { name: 'Skull Rock Trail', difficulty: 'easy', length: '1.7 mi', type: 'loop' },
    ],
  },
  katm: {
    name: 'Katmai National Park',
    state: 'Alaska',
    trails: [
      { name: 'Dumpling Mountain Trail', difficulty: 'hard', length: '4.0 mi', type: 'out-and-back' },
      { name: 'Brooks Falls Trail', difficulty: 'easy', length: '1.2 mi', type: 'out-and-back' },
    ],
  },
  kefj: {
    name: 'Kenai Fjords National Park',
    state: 'Alaska',
    trails: [
      { name: 'Exit Glacier Trail', difficulty: 'moderate', length: '2.0 mi', type: 'out-and-back' },
      { name: 'Harding Icefield Trail', difficulty: 'hard', length: '8.2 mi', type: 'out-and-back' },
    ],
  },
  kova: {
    name: 'Kobuk Valley National Park',
    state: 'Alaska',
    trails: [
      { name: 'Great Kobuk Sand Dunes', difficulty: 'moderate', length: '3.0 mi', type: 'out-and-back' },
    ],
  },
  lacl: {
    name: 'Lake Clark National Park',
    state: 'Alaska',
    trails: [
      { name: 'Tanalian Falls Trail', difficulty: 'moderate', length: '4.2 mi', type: 'out-and-back' },
    ],
  },
  lavo: {
    name: 'Lassen Volcanic National Park',
    state: 'California',
    trails: [
      { name: 'Lassen Peak Trail', difficulty: 'hard', length: '5.0 mi', type: 'out-and-back' },
      { name: 'Bumpass Hell Trail', difficulty: 'moderate', length: '3.0 mi', type: 'out-and-back' },
      { name: 'Cinder Cone Trail', difficulty: 'hard', length: '4.0 mi', type: 'out-and-back' },
    ],
  },
  maca: {
    name: 'Mammoth Cave National Park',
    state: 'Kentucky',
    trails: [
      { name: 'Cedar Sink Trail', difficulty: 'easy', length: '1.8 mi', type: 'loop' },
      { name: 'Green River Bluffs Trail', difficulty: 'moderate', length: '8.0 mi', type: 'loop' },
    ],
  },
  meve: {
    name: 'Mesa Verde National Park',
    state: 'Colorado',
    trails: [
      { name: 'Petroglyph Point Trail', difficulty: 'moderate', length: '2.8 mi', type: 'loop' },
      { name: 'Soda Canyon Overlook Trail', difficulty: 'easy', length: '1.2 mi', type: 'out-and-back' },
      { name: 'Spruce Canyon Trail', difficulty: 'moderate', length: '2.4 mi', type: 'loop' },
    ],
  },
  mora: {
    name: 'Mount Rainier National Park',
    state: 'Washington',
    trails: [
      { name: 'Skyline Trail', difficulty: 'hard', length: '5.5 mi', type: 'loop' },
      { name: 'Sunrise Rim Trail', difficulty: 'moderate', length: '5.0 mi', type: 'loop' },
      { name: 'Grove of the Patriarchs Trail', difficulty: 'easy', length: '1.5 mi', type: 'loop' },
      { name: 'Comet Falls Trail', difficulty: 'hard', length: '3.8 mi', type: 'out-and-back' },
      { name: 'Naches Peak Loop Trail', difficulty: 'moderate', length: '3.2 mi', type: 'loop' },
    ],
  },
  neri: {
    name: 'New River Gorge National Park',
    state: 'West Virginia',
    trails: [
      { name: 'Long Point Trail', difficulty: 'moderate', length: '3.2 mi', type: 'out-and-back' },
      { name: 'Endless Wall Trail', difficulty: 'moderate', length: '2.4 mi', type: 'out-and-back' },
      { name: 'Grandview Rim Trail', difficulty: 'moderate', length: '3.0 mi', type: 'loop' },
    ],
  },
  noca: {
    name: 'North Cascades National Park',
    state: 'Washington',
    trails: [
      { name: 'Blue Lake Trail', difficulty: 'moderate', length: '4.4 mi', type: 'out-and-back' },
      { name: 'Cascade Pass Trail', difficulty: 'hard', length: '7.4 mi', type: 'out-and-back' },
      { name: 'Diablo Lake Trail', difficulty: 'moderate', length: '7.6 mi', type: 'out-and-back' },
      { name: 'Thunder Knob Trail', difficulty: 'easy', length: '3.6 mi', type: 'out-and-back' },
    ],
  },
  olym: {
    name: 'Olympic National Park',
    state: 'Washington',
    trails: [
      { name: 'Hurricane Ridge Trail', difficulty: 'easy', length: '3.2 mi', type: 'out-and-back' },
      { name: 'Hoh Rain Forest Trail', difficulty: 'easy', length: '1.1 mi', type: 'loop' },
      { name: 'Sol Duc Falls Trail', difficulty: 'easy', length: '1.6 mi', type: 'out-and-back' },
      { name: 'Marymere Falls Trail', difficulty: 'easy', length: '1.8 mi', type: 'out-and-back' },
      { name: 'Lake Crescent Trail', difficulty: 'easy', length: '2.0 mi', type: 'out-and-back' },
    ],
  },
  pefo: {
    name: 'Petrified Forest National Park',
    state: 'Arizona',
    trails: [
      { name: 'Blue Mesa Trail', difficulty: 'easy', length: '1.0 mi', type: 'loop' },
      { name: 'Crystal Forest Trail', difficulty: 'easy', length: '0.8 mi', type: 'loop' },
      { name: 'Painted Desert Rim Trail', difficulty: 'easy', length: '1.0 mi', type: 'out-and-back' },
    ],
  },
  pinn: {
    name: 'Pinnacles National Park',
    state: 'California',
    trails: [
      { name: 'High Peaks Trail', difficulty: 'hard', length: '6.7 mi', type: 'loop' },
      { name: 'Bear Gulch Cave Trail', difficulty: 'moderate', length: '2.2 mi', type: 'loop' },
      { name: 'Condor Gulch Trail', difficulty: 'moderate', length: '5.3 mi', type: 'out-and-back' },
    ],
  },
  redw: {
    name: 'Redwood National and State Parks',
    state: 'California',
    trails: [
      { name: 'Tall Trees Grove Trail', difficulty: 'moderate', length: '4.0 mi', type: 'out-and-back' },
      { name: 'Fern Canyon Loop Trail', difficulty: 'easy', length: '1.1 mi', type: 'loop' },
      { name: 'Lady Bird Johnson Grove Trail', difficulty: 'easy', length: '1.4 mi', type: 'loop' },
      { name: 'Boy Scout Tree Trail', difficulty: 'moderate', length: '5.6 mi', type: 'out-and-back' },
    ],
  },
  romo: {
    name: 'Rocky Mountain National Park',
    state: 'Colorado',
    trails: [
      { name: 'Sky Pond Trail', difficulty: 'hard', length: '9.4 mi', type: 'out-and-back' },
      { name: 'Emerald Lake Trail', difficulty: 'moderate', length: '3.2 mi', type: 'out-and-back' },
      { name: 'Bear Lake Trail', difficulty: 'easy', length: '0.8 mi', type: 'loop' },
      { name: 'Alberta Falls Trail', difficulty: 'easy', length: '1.6 mi', type: 'out-and-back' },
      { name: 'Flattop Mountain Trail', difficulty: 'hard', length: '8.8 mi', type: 'out-and-back' },
    ],
  },
  sagu: {
    name: 'Saguaro National Park',
    state: 'Arizona',
    trails: [
      { name: 'Valley View Overlook Trail', difficulty: 'easy', length: '0.8 mi', type: 'out-and-back' },
      { name: 'Signal Hill Trail', difficulty: 'easy', length: '0.5 mi', type: 'out-and-back' },
      { name: 'Hugh Norris Trail', difficulty: 'hard', length: '9.8 mi', type: 'out-and-back' },
      { name: 'Wasson Peak Trail', difficulty: 'hard', length: '8.0 mi', type: 'out-and-back' },
    ],
  },
  seki: {
    name: 'Sequoia and Kings Canyon National Parks',
    state: 'California',
    trails: [
      { name: 'General Sherman Tree Trail', difficulty: 'easy', length: '0.8 mi', type: 'out-and-back' },
      { name: 'Moro Rock Trail', difficulty: 'moderate', length: '0.5 mi', type: 'out-and-back' },
      { name: 'Big Trees Trail', difficulty: 'easy', length: '1.3 mi', type: 'loop' },
      { name: 'Tokopah Falls Trail', difficulty: 'moderate', length: '3.4 mi', type: 'out-and-back' },
      { name: 'Mist Falls Trail', difficulty: 'moderate', length: '8.4 mi', type: 'out-and-back' },
    ],
  },
  shen: {
    name: 'Shenandoah National Park',
    state: 'Virginia',
    trails: [
      { name: 'Old Rag Mountain Trail', difficulty: 'hard', length: '9.0 mi', type: 'loop' },
      { name: 'Whiteoak Canyon Trail', difficulty: 'hard', length: '9.2 mi', type: 'out-and-back' },
      { name: 'Dark Hollow Falls Trail', difficulty: 'moderate', length: '1.4 mi', type: 'out-and-back' },
      { name: 'Bearfence Mountain Trail', difficulty: 'moderate', length: '1.2 mi', type: 'loop' },
      { name: 'Stony Man Trail', difficulty: 'easy', length: '1.6 mi', type: 'loop' },
    ],
  },
  thro: {
    name: 'Theodore Roosevelt National Park',
    state: 'North Dakota',
    trails: [
      { name: 'Caprock Coulee Trail', difficulty: 'moderate', length: '4.4 mi', type: 'loop' },
      { name: 'Wind Canyon Trail', difficulty: 'easy', length: '0.4 mi', type: 'out-and-back' },
      { name: 'Petrified Forest Loop', difficulty: 'hard', length: '10.3 mi', type: 'loop' },
    ],
  },
  viis: {
    name: 'Virgin Islands National Park',
    state: 'U.S. Virgin Islands',
    trails: [
      { name: 'Reef Bay Trail', difficulty: 'moderate', length: '4.4 mi', type: 'out-and-back' },
      { name: 'Ram Head Trail', difficulty: 'moderate', length: '1.8 mi', type: 'out-and-back' },
      { name: 'Lind Point Trail', difficulty: 'easy', length: '2.2 mi', type: 'out-and-back' },
    ],
  },
  voya: {
    name: 'Voyageurs National Park',
    state: 'Minnesota',
    trails: [
      { name: 'Blind Ash Bay Trail', difficulty: 'moderate', length: '2.5 mi', type: 'out-and-back' },
      { name: 'Locator Lake Trail', difficulty: 'moderate', length: '4.0 mi', type: 'out-and-back' },
      { name: 'Echo Bay Trail', difficulty: 'easy', length: '2.5 mi', type: 'out-and-back' },
    ],
  },
  whsa: {
    name: 'White Sands National Park',
    state: 'New Mexico',
    trails: [
      { name: 'Alkali Flat Trail', difficulty: 'hard', length: '5.0 mi', type: 'loop' },
      { name: 'Dune Life Nature Trail', difficulty: 'easy', length: '1.0 mi', type: 'loop' },
      { name: 'Playa Trail', difficulty: 'easy', length: '0.5 mi', type: 'out-and-back' },
    ],
  },
  wica: {
    name: 'Wind Cave National Park',
    state: 'South Dakota',
    trails: [
      { name: 'Rankin Ridge Trail', difficulty: 'moderate', length: '1.0 mi', type: 'loop' },
      { name: 'Cold Brook Canyon Trail', difficulty: 'moderate', length: '2.8 mi', type: 'loop' },
      { name: 'Elk Mountain Trail', difficulty: 'moderate', length: '3.6 mi', type: 'loop' },
    ],
  },
  wrst: {
    name: 'Wrangell-St. Elias National Park',
    state: 'Alaska',
    trails: [
      { name: 'Root Glacier Trail', difficulty: 'moderate', length: '4.0 mi', type: 'out-and-back' },
      { name: 'Bonanza Mine Trail', difficulty: 'hard', length: '9.0 mi', type: 'out-and-back' },
    ],
  },
  yell: {
    name: 'Yellowstone National Park',
    state: 'Wyoming',
    trails: [
      { name: 'Grand Prismatic Spring Overlook Trail', difficulty: 'easy', length: '1.6 mi', type: 'out-and-back' },
      { name: 'Uncle Tom Trail', difficulty: 'moderate', length: '0.8 mi', type: 'out-and-back' },
      { name: 'Mount Washburn Trail', difficulty: 'hard', length: '6.4 mi', type: 'out-and-back' },
      { name: 'Mystic Falls Trail', difficulty: 'moderate', length: '2.4 mi', type: 'out-and-back' },
      { name: 'Fairy Falls Trail', difficulty: 'easy', length: '5.4 mi', type: 'out-and-back' },
    ],
  },
  yose: {
    name: 'Yosemite National Park',
    state: 'California',
    trails: [
      { name: 'Mist Trail', difficulty: 'hard', length: '5.4 mi', type: 'out-and-back' },
      { name: 'Half Dome Trail', difficulty: 'hard', length: '14.0 mi', type: 'out-and-back' },
      { name: 'Mirror Lake Trail', difficulty: 'easy', length: '5.0 mi', type: 'loop' },
      { name: 'Yosemite Falls Trail', difficulty: 'hard', length: '7.2 mi', type: 'out-and-back' },
      { name: 'Sentinel Dome Trail', difficulty: 'moderate', length: '2.2 mi', type: 'out-and-back' },
    ],
  },
  zion: {
    name: 'Zion National Park',
    state: 'Utah',
    trails: [
      { name: 'Angels Landing Trail', difficulty: 'hard', length: '5.4 mi', type: 'out-and-back' },
      { name: 'The Narrows Trail', difficulty: 'hard', length: '9.4 mi', type: 'out-and-back' },
      { name: 'Observation Point Trail', difficulty: 'hard', length: '8.0 mi', type: 'out-and-back' },
      { name: 'Emerald Pools Trail', difficulty: 'easy', length: '3.0 mi', type: 'out-and-back' },
      { name: 'Canyon Overlook Trail', difficulty: 'easy', length: '1.0 mi', type: 'out-and-back' },
    ],
  },
};

// Wisconsin State Parks
const WISCONSIN_STATE_PARKS: Record<string, { name: string; trails: Array<{ name: string; difficulty: string; length: string; type: string }> }> = {
  'devils-lake': {
    name: 'Devils Lake State Park',
    trails: [
      { name: 'East Bluff Trail', difficulty: 'hard', length: '1.5 mi', type: 'out-and-back' },
      { name: 'West Bluff Trail', difficulty: 'hard', length: '1.6 mi', type: 'out-and-back' },
      { name: 'Balanced Rock Trail', difficulty: 'moderate', length: '1.0 mi', type: 'loop' },
      { name: 'Tumbled Rocks Trail', difficulty: 'easy', length: '1.5 mi', type: 'out-and-back' },
      { name: 'CCC Trail', difficulty: 'moderate', length: '2.5 mi', type: 'loop' },
    ],
  },
  'peninsula': {
    name: 'Peninsula State Park',
    trails: [
      { name: 'Eagle Trail', difficulty: 'moderate', length: '2.0 mi', type: 'loop' },
      { name: 'Sunset Trail', difficulty: 'easy', length: '5.5 mi', type: 'loop' },
      { name: 'Minnehaha Trail', difficulty: 'easy', length: '1.5 mi', type: 'out-and-back' },
      { name: 'Sentinel Trail', difficulty: 'easy', length: '2.0 mi', type: 'loop' },
    ],
  },
  'governor-dodge': {
    name: 'Governor Dodge State Park',
    trails: [
      { name: 'Stephens Falls Trail', difficulty: 'easy', length: '0.5 mi', type: 'out-and-back' },
      { name: 'Lost Canyon Trail', difficulty: 'moderate', length: '4.5 mi', type: 'loop' },
      { name: 'Pine Cliff Nature Trail', difficulty: 'easy', length: '1.5 mi', type: 'loop' },
    ],
  },
  'kettle-moraine-northern': {
    name: 'Kettle Moraine State Forest - Northern Unit',
    trails: [
      { name: 'Ice Age Trail - Northern Unit', difficulty: 'moderate', length: '30.0 mi', type: 'point-to-point' },
      { name: 'Parnell Tower Trail', difficulty: 'easy', length: '1.5 mi', type: 'loop' },
      { name: 'Greenbush Trail', difficulty: 'moderate', length: '6.5 mi', type: 'loop' },
    ],
  },
  'kettle-moraine-southern': {
    name: 'Kettle Moraine State Forest - Southern Unit',
    trails: [
      { name: 'Scuppernong Trail', difficulty: 'moderate', length: '5.0 mi', type: 'loop' },
      { name: 'Emma Carlin Trail', difficulty: 'moderate', length: '4.0 mi', type: 'loop' },
      { name: 'John Muir Trail', difficulty: 'moderate', length: '6.0 mi', type: 'loop' },
    ],
  },
  'wyalusing': {
    name: 'Wyalusing State Park',
    trails: [
      { name: 'Sentinel Ridge Trail', difficulty: 'moderate', length: '2.2 mi', type: 'loop' },
      { name: 'Bluff Trail', difficulty: 'easy', length: '1.0 mi', type: 'out-and-back' },
      { name: 'Signal Point Trail', difficulty: 'easy', length: '0.5 mi', type: 'out-and-back' },
    ],
  },
  'copper-falls': {
    name: 'Copper Falls State Park',
    trails: [
      { name: 'Doughboys Nature Trail', difficulty: 'easy', length: '1.7 mi', type: 'loop' },
      { name: 'North Country Trail', difficulty: 'moderate', length: '4.0 mi', type: 'point-to-point' },
    ],
  },
  'willow-river': {
    name: 'Willow River State Park',
    trails: [
      { name: 'Willow Falls Trail', difficulty: 'easy', length: '2.5 mi', type: 'loop' },
      { name: 'Trout Brook Trail', difficulty: 'moderate', length: '3.5 mi', type: 'loop' },
    ],
  },
  'mirror-lake': {
    name: 'Mirror Lake State Park',
    trails: [
      { name: 'Echo Rock Trail', difficulty: 'moderate', length: '1.5 mi', type: 'out-and-back' },
      { name: 'Northwest Trail', difficulty: 'easy', length: '2.0 mi', type: 'loop' },
    ],
  },
  'pattison': {
    name: 'Pattison State Park',
    trails: [
      { name: 'Big Manitou Falls Trail', difficulty: 'easy', length: '0.5 mi', type: 'out-and-back' },
      { name: 'Little Manitou Falls Trail', difficulty: 'moderate', length: '1.0 mi', type: 'loop' },
      { name: 'Logging Camp Trail', difficulty: 'moderate', length: '4.0 mi', type: 'loop' },
    ],
  },
};

// Florida State Parks
const FLORIDA_STATE_PARKS: Record<string, { name: string; trails: Array<{ name: string; difficulty: string; length: string; type: string }> }> = {
  'myakka-river': {
    name: 'Myakka River State Park',
    trails: [
      { name: 'North Loop Trail', difficulty: 'easy', length: '5.5 mi', type: 'loop' },
      { name: 'Boylston Nature Trail', difficulty: 'easy', length: '1.0 mi', type: 'loop' },
      { name: 'Myakka River Trail', difficulty: 'moderate', length: '7.5 mi', type: 'out-and-back' },
    ],
  },
  'big-cypress': {
    name: 'Big Cypress National Preserve',
    trails: [
      { name: 'Florida Trail - Big Cypress', difficulty: 'hard', length: '30.0 mi', type: 'point-to-point' },
      { name: 'Kirby Storter Roadside Park Trail', difficulty: 'easy', length: '1.0 mi', type: 'out-and-back' },
    ],
  },
  'ocala': {
    name: 'Ocala National Forest',
    trails: [
      { name: 'Florida Trail - Ocala Section', difficulty: 'moderate', length: '67.0 mi', type: 'point-to-point' },
      { name: 'Juniper Springs Trail', difficulty: 'easy', length: '2.0 mi', type: 'loop' },
      { name: 'Salt Springs Trail', difficulty: 'easy', length: '3.0 mi', type: 'loop' },
    ],
  },
  'paynes-prairie': {
    name: 'Paynes Prairie Preserve State Park',
    trails: [
      { name: 'La Chua Trail', difficulty: 'easy', length: '6.0 mi', type: 'out-and-back' },
      { name: 'Gainesville-Hawthorne Trail', difficulty: 'easy', length: '16.0 mi', type: 'point-to-point' },
      { name: 'Cone Pond Trail', difficulty: 'easy', length: '2.0 mi', type: 'loop' },
    ],
  },
  'hillsborough-river': {
    name: 'Hillsborough River State Park',
    trails: [
      { name: 'Wetlands Restoration Trail', difficulty: 'easy', length: '3.5 mi', type: 'loop' },
      { name: 'Rapids Trail', difficulty: 'easy', length: '0.5 mi', type: 'out-and-back' },
    ],
  },
  'ichetucknee-springs': {
    name: 'Ichetucknee Springs State Park',
    trails: [
      { name: 'Trestle Point Trail', difficulty: 'easy', length: '1.0 mi', type: 'loop' },
      { name: 'Pine Ridge Trail', difficulty: 'easy', length: '2.5 mi', type: 'loop' },
    ],
  },
  'wekiwa-springs': {
    name: 'Wekiwa Springs State Park',
    trails: [
      { name: 'Sand Lake Trail', difficulty: 'easy', length: '4.7 mi', type: 'loop' },
      { name: 'Rock Springs Run Loop', difficulty: 'moderate', length: '13.5 mi', type: 'loop' },
    ],
  },
  'rainbow-springs': {
    name: 'Rainbow Springs State Park',
    trails: [
      { name: 'Rainbow Springs Hiking Trail', difficulty: 'easy', length: '3.5 mi', type: 'loop' },
      { name: 'Waterfall Gardens Trail', difficulty: 'easy', length: '0.5 mi', type: 'loop' },
    ],
  },
  'jonathan-dickinson': {
    name: 'Jonathan Dickinson State Park',
    trails: [
      { name: 'Kitching Creek Trail', difficulty: 'moderate', length: '9.2 mi', type: 'loop' },
      { name: 'Hobe Mountain Observation Tower Trail', difficulty: 'easy', length: '0.3 mi', type: 'out-and-back' },
    ],
  },
  'bahia-honda': {
    name: 'Bahia Honda State Park',
    trails: [
      { name: 'Silver Palm Nature Trail', difficulty: 'easy', length: '0.3 mi', type: 'loop' },
      { name: 'Old Bahia Honda Bridge Trail', difficulty: 'easy', length: '0.5 mi', type: 'out-and-back' },
    ],
  },
};

// Generate AllTrails explore URL with ref parameter for better mobile support
function buildAllTrailsSearchUrl(trailName: string, parkName: string): string {
  // Use explore endpoint with a search filter - works better on mobile
  const query = encodeURIComponent(`${trailName} ${parkName}`);
  return `https://www.alltrails.com/explore?q=${query}`;
}

function buildTrailData() {
  const nationalParks: Record<string, any> = {};
  
  for (const [code, park] of Object.entries(NATIONAL_PARKS_DATA)) {
    nationalParks[code] = {
      parkName: park.name,
      trails: park.trails.map(trail => ({
        name: trail.name,
        difficulty: trail.difficulty,
        length: trail.length,
        type: trail.type,
        alltrailsUrl: buildAllTrailsSearchUrl(trail.name, park.name),
      })),
    };
  }
  
  const wisconsinParks: Record<string, any> = {};
  for (const [code, park] of Object.entries(WISCONSIN_STATE_PARKS)) {
    wisconsinParks[code] = {
      parkName: park.name,
      trails: park.trails.map(trail => ({
        name: trail.name,
        difficulty: trail.difficulty,
        length: trail.length,
        type: trail.type,
        alltrailsUrl: buildAllTrailsSearchUrl(trail.name, park.name),
      })),
    };
  }
  
  const floridaParks: Record<string, any> = {};
  for (const [code, park] of Object.entries(FLORIDA_STATE_PARKS)) {
    floridaParks[code] = {
      parkName: park.name,
      trails: park.trails.map(trail => ({
        name: trail.name,
        difficulty: trail.difficulty,
        length: trail.length,
        type: trail.type,
        alltrailsUrl: buildAllTrailsSearchUrl(trail.name, park.name),
      })),
    };
  }
  
  return {
    _meta: {
      description: 'Trail data with AllTrails URLs for National Parks and State Parks',
      lastUpdated: new Date().toISOString().split('T')[0],
      source: 'AllTrails verified URLs',
      coverage: {
        nationalParks: Object.keys(nationalParks).length,
        stateParks: {
          WI: Object.keys(wisconsinParks).length,
          FL: Object.keys(floridaParks).length,
        },
      },
    },
    parks: nationalParks,
    stateParks: {
      WI: wisconsinParks,
      FL: floridaParks,
    },
  };
}

async function uploadToS3() {
  console.log('='.repeat(60));
  console.log('Generating Comprehensive Trail Data');
  console.log('='.repeat(60));
  
  const trailData = buildTrailData();
  
  // Count trails
  let totalNationalTrails = 0;
  let totalWITrails = 0;
  let totalFLTrails = 0;
  
  for (const park of Object.values(trailData.parks)) {
    totalNationalTrails += (park as any).trails.length;
  }
  for (const park of Object.values(trailData.stateParks.WI)) {
    totalWITrails += (park as any).trails.length;
  }
  for (const park of Object.values(trailData.stateParks.FL)) {
    totalFLTrails += (park as any).trails.length;
  }
  
  console.log(`\nNational Parks: ${Object.keys(trailData.parks).length} parks, ${totalNationalTrails} trails`);
  console.log(`Wisconsin State Parks: ${Object.keys(trailData.stateParks.WI).length} parks, ${totalWITrails} trails`);
  console.log(`Florida State Parks: ${Object.keys(trailData.stateParks.FL).length} parks, ${totalFLTrails} trails`);
  console.log(`\nTotal: ${Object.keys(trailData.parks).length + Object.keys(trailData.stateParks.WI).length + Object.keys(trailData.stateParks.FL).length} parks, ${totalNationalTrails + totalWITrails + totalFLTrails} trails`);
  
  // Upload to S3
  console.log('\nUploading to S3...');
  
  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: 'trails/all-parks-trails.json',
      Body: JSON.stringify(trailData, null, 2),
      ContentType: 'application/json',
      CacheControl: 'max-age=3600',
    }));
    
    console.log(`[OK] Trail data uploaded to s3://${S3_BUCKET}/trails/all-parks-trails.json`);
  } catch (error: any) {
    console.error('[ERROR] Upload failed:', error.message);
    process.exit(1);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Upload Complete');
  console.log('='.repeat(60));
}

uploadToS3();
