/**
 * Park Code Lookup - Maps park names/keywords to NPS park codes
 * This allows reliable querying by park code instead of relying on NPS search
 * 
 * Generated from NPS API - contains all national parks and major sites
 */

// Primary National Parks (designated "National Park")
export const NATIONAL_PARKS: Record<string, { code: string; name: string; keywords: string[] }> = {
  'acadia': { code: 'acad', name: 'Acadia National Park', keywords: ['acadia', 'maine', 'bar harbor'] },
  'arches': { code: 'arch', name: 'Arches National Park', keywords: ['arches', 'delicate arch', 'moab'] },
  'badlands': { code: 'badl', name: 'Badlands National Park', keywords: ['badlands', 'south dakota'] },
  'big bend': { code: 'bibe', name: 'Big Bend National Park', keywords: ['big bend', 'texas', 'chisos'] },
  'biscayne': { code: 'bisc', name: 'Biscayne National Park', keywords: ['biscayne', 'florida', 'keys'] },
  'black canyon': { code: 'blca', name: 'Black Canyon Of The Gunnison National Park', keywords: ['black canyon', 'gunnison', 'colorado'] },
  'bryce canyon': { code: 'brca', name: 'Bryce Canyon National Park', keywords: ['bryce', 'hoodoos', 'utah'] },
  'canyonlands': { code: 'cany', name: 'Canyonlands National Park', keywords: ['canyonlands', 'island in the sky', 'needles', 'moab'] },
  'capitol reef': { code: 'care', name: 'Capitol Reef National Park', keywords: ['capitol reef', 'utah', 'waterpocket'] },
  'carlsbad caverns': { code: 'cave', name: 'Carlsbad Caverns National Park', keywords: ['carlsbad', 'caverns', 'caves', 'new mexico'] },
  'channel islands': { code: 'chis', name: 'Channel Islands National Park', keywords: ['channel islands', 'california', 'santa cruz', 'anacapa'] },
  'congaree': { code: 'cong', name: 'Congaree National Park', keywords: ['congaree', 'south carolina', 'swamp'] },
  'crater lake': { code: 'crla', name: 'Crater Lake National Park', keywords: ['crater lake', 'oregon', 'wizard island'] },
  'cuyahoga valley': { code: 'cuva', name: 'Cuyahoga Valley National Park', keywords: ['cuyahoga', 'ohio', 'cleveland'] },
  'death valley': { code: 'deva', name: 'Death Valley National Park', keywords: ['death valley', 'california', 'badwater', 'zabriskie'] },
  'denali': { code: 'dena', name: 'Denali National Park & Preserve', keywords: ['denali', 'mckinley', 'alaska'] },
  'dry tortugas': { code: 'drto', name: 'Dry Tortugas National Park', keywords: ['dry tortugas', 'fort jefferson', 'florida keys'] },
  'everglades': { code: 'ever', name: 'Everglades National Park', keywords: ['everglades', 'florida', 'gators', 'swamp'] },
  'gates of the arctic': { code: 'gaar', name: 'Gates Of The Arctic National Park & Preserve', keywords: ['gates of the arctic', 'alaska', 'brooks range'] },
  'gateway arch': { code: 'jeff', name: 'Gateway Arch National Park', keywords: ['gateway arch', 'st louis', 'missouri', 'arch'] },
  'glacier': { code: 'glac', name: 'Glacier National Park', keywords: ['glacier', 'montana', 'going to the sun', 'logan pass'] },
  'glacier bay': { code: 'glba', name: 'Glacier Bay National Park & Preserve', keywords: ['glacier bay', 'alaska', 'juneau'] },
  'grand canyon': { code: 'grca', name: 'Grand Canyon National Park', keywords: ['grand canyon', 'arizona', 'south rim', 'north rim'] },
  'grand teton': { code: 'grte', name: 'Grand Teton National Park', keywords: ['grand teton', 'teton', 'jackson', 'wyoming'] },
  'great basin': { code: 'grba', name: 'Great Basin National Park', keywords: ['great basin', 'nevada', 'lehman caves', 'wheeler peak'] },
  'great sand dunes': { code: 'grsa', name: 'Great Sand Dunes National Park & Preserve', keywords: ['great sand dunes', 'sand dunes', 'colorado'] },
  'great smoky mountains': { code: 'grsm', name: 'Great Smoky Mountains National Park', keywords: ['smoky', 'smokies', 'great smoky', 'tennessee', 'north carolina', 'clingmans dome', 'cades cove'] },
  'guadalupe mountains': { code: 'gumo', name: 'Guadalupe Mountains National Park', keywords: ['guadalupe', 'texas', 'el capitan'] },
  'haleakala': { code: 'hale', name: 'Haleakalā National Park', keywords: ['haleakala', 'maui', 'hawaii', 'volcano'] },
  'hawaii volcanoes': { code: 'havo', name: 'Hawaiʻi Volcanoes National Park', keywords: ['hawaii volcanoes', 'kilauea', 'big island', 'volcano'] },
  'hot springs': { code: 'hosp', name: 'Hot Springs National Park', keywords: ['hot springs', 'arkansas', 'bathhouse'] },
  'indiana dunes': { code: 'indu', name: 'Indiana Dunes National Park', keywords: ['indiana dunes', 'lake michigan', 'indiana'] },
  'isle royale': { code: 'isro', name: 'Isle Royale National Park', keywords: ['isle royale', 'michigan', 'lake superior', 'wolves'] },
  'joshua tree': { code: 'jotr', name: 'Joshua Tree National Park', keywords: ['joshua tree', 'california', 'mojave', 'desert'] },
  'katmai': { code: 'katm', name: 'Katmai National Park & Preserve', keywords: ['katmai', 'alaska', 'bears', 'brooks falls'] },
  'kenai fjords': { code: 'kefj', name: 'Kenai Fjords National Park', keywords: ['kenai fjords', 'alaska', 'seward', 'exit glacier'] },
  'kobuk valley': { code: 'kova', name: 'Kobuk Valley National Park', keywords: ['kobuk', 'alaska', 'sand dunes'] },
  'lake clark': { code: 'lacl', name: 'Lake Clark National Park & Preserve', keywords: ['lake clark', 'alaska'] },
  'lassen volcanic': { code: 'lavo', name: 'Lassen Volcanic National Park', keywords: ['lassen', 'california', 'volcanic', 'bumpass hell'] },
  'mammoth cave': { code: 'maca', name: 'Mammoth Cave National Park', keywords: ['mammoth cave', 'kentucky', 'caves'] },
  'mesa verde': { code: 'meve', name: 'Mesa Verde National Park', keywords: ['mesa verde', 'colorado', 'cliff dwellings', 'anasazi'] },
  'mount rainier': { code: 'mora', name: 'Mount Rainier National Park', keywords: ['rainier', 'mount rainier', 'washington', 'paradise'] },
  'new river gorge': { code: 'neri', name: 'New River Gorge National Park & Preserve', keywords: ['new river gorge', 'west virginia', 'bridge'] },
  'north cascades': { code: 'noca', name: 'North Cascades National Park', keywords: ['north cascades', 'washington', 'cascades'] },
  'olympic': { code: 'olym', name: 'Olympic National Park', keywords: ['olympic', 'washington', 'hoh rainforest', 'hurricane ridge'] },
  'petrified forest': { code: 'pefo', name: 'Petrified Forest National Park', keywords: ['petrified forest', 'arizona', 'painted desert'] },
  'pinnacles': { code: 'pinn', name: 'Pinnacles National Park', keywords: ['pinnacles', 'california', 'condors'] },
  'redwood': { code: 'redw', name: 'Redwood National and State Parks', keywords: ['redwood', 'redwoods', 'california', 'sequoia sempervirens'] },
  'rocky mountain': { code: 'romo', name: 'Rocky Mountain National Park', keywords: ['rocky mountain', 'colorado', 'estes park', 'trail ridge'] },
  'saguaro': { code: 'sagu', name: 'Saguaro National Park', keywords: ['saguaro', 'arizona', 'tucson', 'cactus'] },
  'sequoia': { code: 'seki', name: 'Sequoia & Kings Canyon National Parks', keywords: ['sequoia', 'kings canyon', 'california', 'general sherman'] },
  'shenandoah': { code: 'shen', name: 'Shenandoah National Park', keywords: ['shenandoah', 'virginia', 'skyline drive', 'blue ridge'] },
  'theodore roosevelt': { code: 'thro', name: 'Theodore Roosevelt National Park', keywords: ['theodore roosevelt', 'north dakota', 'badlands'] },
  'virgin islands': { code: 'viis', name: 'Virgin Islands National Park', keywords: ['virgin islands', 'st john', 'caribbean'] },
  'voyageurs': { code: 'voya', name: 'Voyageurs National Park', keywords: ['voyageurs', 'minnesota', 'boundary waters'] },
  'white sands': { code: 'whsa', name: 'White Sands National Park', keywords: ['white sands', 'new mexico', 'gypsum'] },
  'wind cave': { code: 'wica', name: 'Wind Cave National Park', keywords: ['wind cave', 'south dakota', 'boxwork'] },
  'wrangell st elias': { code: 'wrst', name: 'Wrangell - St Elias National Park & Preserve', keywords: ['wrangell', 'st elias', 'alaska'] },
  'yellowstone': { code: 'yell', name: 'Yellowstone National Park', keywords: ['yellowstone', 'wyoming', 'old faithful', 'geyser', 'bison'] },
  'yosemite': { code: 'yose', name: 'Yosemite National Park', keywords: ['yosemite', 'california', 'half dome', 'el capitan', 'waterfall'] },
  'zion': { code: 'zion', name: 'Zion National Park', keywords: ['zion', 'utah', 'angels landing', 'narrows'] },
};

// All keywords mapped to park codes for fast lookup
const KEYWORD_TO_CODE: Map<string, string> = new Map();

// Build the keyword lookup map
Object.entries(NATIONAL_PARKS).forEach(([key, park]) => {
  KEYWORD_TO_CODE.set(key, park.code);
  KEYWORD_TO_CODE.set(park.code, park.code);
  park.keywords.forEach(kw => KEYWORD_TO_CODE.set(kw.toLowerCase(), park.code));
});

/**
 * Find park code from a search query
 * Returns the park code if found, null otherwise
 */
export function findParkCode(query: string): string | null {
  const q = query.toLowerCase().trim();
  
  // Direct lookup
  if (KEYWORD_TO_CODE.has(q)) {
    return KEYWORD_TO_CODE.get(q)!;
  }
  
  // Check if query contains any keyword
  for (const [keyword, code] of KEYWORD_TO_CODE.entries()) {
    if (keyword.length >= 4 && q.includes(keyword)) {
      return code;
    }
    if (q.length >= 4 && keyword.includes(q)) {
      return code;
    }
  }
  
  // Word-by-word search
  const words = q.split(/\s+/).filter(w => w.length >= 4);
  for (const word of words) {
    if (KEYWORD_TO_CODE.has(word)) {
      return KEYWORD_TO_CODE.get(word)!;
    }
  }
  
  return null;
}

/**
 * Get park info by code
 */
export function getParkByCode(code: string): { code: string; name: string; keywords: string[] } | null {
  const entry = Object.values(NATIONAL_PARKS).find(p => p.code === code.toLowerCase());
  return entry || null;
}

/**
 * Get all park codes
 */
export function getAllParkCodes(): string[] {
  return Object.values(NATIONAL_PARKS).map(p => p.code);
}
