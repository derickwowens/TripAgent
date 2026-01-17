/**
 * Park Code Lookup - Maps park names/keywords to NPS park codes
 * This allows reliable querying by park code instead of relying on NPS search
 * 
 * Generated from NPS API (https://developer.nps.gov/api/v1/parks)
 * Last updated: 2026-01-17
 */

// All US National Parks - Generated from NPS API
export const NATIONAL_PARKS: Record<string, { code: string; name: string; keywords: string[] }> = {
  'acadia': { code: 'acad', name: 'Acadia National Park', keywords: ['acadia', 'maine', 'acad'] },
  'arches': { code: 'arch', name: 'Arches National Park', keywords: ['arches', 'utah', 'arch'] },
  'badlands': { code: 'badl', name: 'Badlands National Park', keywords: ['badlands', 'south dakota', 'badl'] },
  'big bend': { code: 'bibe', name: 'Big Bend National Park', keywords: ['big bend', 'texas', 'bibe'] },
  'biscayne': { code: 'bisc', name: 'Biscayne National Park', keywords: ['biscayne', 'florida', 'bisc'] },
  'black canyon': { code: 'blca', name: 'Black Canyon Of The Gunnison National Park', keywords: ['black canyon', 'gunnison', 'colorado', 'blca'] },
  'bryce canyon': { code: 'brca', name: 'Bryce Canyon National Park', keywords: ['bryce canyon', 'utah', 'brca'] },
  'canyonlands': { code: 'cany', name: 'Canyonlands National Park', keywords: ['canyonlands', 'utah', 'cany'] },
  'capitol reef': { code: 'care', name: 'Capitol Reef National Park', keywords: ['capitol reef', 'utah', 'care'] },
  'carlsbad caverns': { code: 'cave', name: 'Carlsbad Caverns National Park', keywords: ['carlsbad caverns', 'new mexico', 'cave'] },
  'channel islands': { code: 'chis', name: 'Channel Islands National Park', keywords: ['channel islands', 'california', 'chis'] },
  'congaree': { code: 'cong', name: 'Congaree National Park', keywords: ['congaree', 'south carolina', 'cong'] },
  'crater lake': { code: 'crla', name: 'Crater Lake National Park', keywords: ['crater lake', 'oregon', 'crla'] },
  'cuyahoga valley': { code: 'cuva', name: 'Cuyahoga Valley National Park', keywords: ['cuyahoga valley', 'ohio', 'cuva'] },
  'death valley': { code: 'deva', name: 'Death Valley National Park', keywords: ['death valley', 'california', 'nevada', 'deva'] },
  'denali': { code: 'dena', name: 'Denali National Park & Preserve', keywords: ['denali', 'alaska', 'dena'] },
  'dry tortugas': { code: 'drto', name: 'Dry Tortugas National Park', keywords: ['dry tortugas', 'florida', 'drto'] },
  'everglades': { code: 'ever', name: 'Everglades National Park', keywords: ['everglades', 'florida', 'ever'] },
  'gates of the arctic': { code: 'gaar', name: 'Gates Of The Arctic National Park & Preserve', keywords: ['gates of the arctic', 'alaska', 'gaar'] },
  'gateway arch': { code: 'jeff', name: 'Gateway Arch National Park', keywords: ['gateway arch', 'missouri', 'jeff'] },
  'glacier': { code: 'glac', name: 'Glacier National Park', keywords: ['glacier', 'montana', 'glac'] },
  'glacier bay': { code: 'glba', name: 'Glacier Bay National Park & Preserve', keywords: ['glacier bay', 'alaska', 'glba'] },
  'grand canyon': { code: 'grca', name: 'Grand Canyon National Park', keywords: ['grand canyon', 'arizona', 'grca'] },
  'grand teton': { code: 'grte', name: 'Grand Teton National Park', keywords: ['grand teton', 'wyoming', 'grte'] },
  'great basin': { code: 'grba', name: 'Great Basin National Park', keywords: ['great basin', 'nevada', 'grba'] },
  'great sand dunes': { code: 'grsa', name: 'Great Sand Dunes National Park & Preserve', keywords: ['great sand dunes', 'colorado', 'grsa'] },
  'great smoky mountains': { code: 'grsm', name: 'Great Smoky Mountains National Park', keywords: ['great smoky mountains', 'north carolina', 'tennessee', 'grsm'] },
  'guadalupe mountains': { code: 'gumo', name: 'Guadalupe Mountains National Park', keywords: ['guadalupe mountains', 'texas', 'gumo'] },
  'haleakala': { code: 'hale', name: 'Haleakalā National Park', keywords: ['haleakala', 'hawaii', 'hale'] },
  'hawaii volcanoes': { code: 'havo', name: 'Hawaiʻi Volcanoes National Park', keywords: ['hawaii volcanoes', 'hawaii', 'havo'] },
  'hot springs': { code: 'hosp', name: 'Hot Springs National Park', keywords: ['hot springs', 'arkansas', 'hosp'] },
  'indiana dunes': { code: 'indu', name: 'Indiana Dunes National Park', keywords: ['indiana dunes', 'indiana', 'indu'] },
  'isle royale': { code: 'isro', name: 'Isle Royale National Park', keywords: ['isle royale', 'michigan', 'isro'] },
  'joshua tree': { code: 'jotr', name: 'Joshua Tree National Park', keywords: ['joshua tree', 'california', 'jotr'] },
  'katmai': { code: 'katm', name: 'Katmai National Park & Preserve', keywords: ['katmai', 'alaska', 'katm'] },
  'kenai fjords': { code: 'kefj', name: 'Kenai Fjords National Park', keywords: ['kenai fjords', 'alaska', 'kefj'] },
  'kobuk valley': { code: 'kova', name: 'Kobuk Valley National Park', keywords: ['kobuk valley', 'alaska', 'kova'] },
  'lake clark': { code: 'lacl', name: 'Lake Clark National Park & Preserve', keywords: ['lake clark', 'alaska', 'lacl'] },
  'lassen volcanic': { code: 'lavo', name: 'Lassen Volcanic National Park', keywords: ['lassen volcanic', 'california', 'lavo'] },
  'mammoth cave': { code: 'maca', name: 'Mammoth Cave National Park', keywords: ['mammoth cave', 'kentucky', 'maca'] },
  'mesa verde': { code: 'meve', name: 'Mesa Verde National Park', keywords: ['mesa verde', 'colorado', 'meve'] },
  'mount rainier': { code: 'mora', name: 'Mount Rainier National Park', keywords: ['mount rainier', 'washington', 'mora'] },
  'new river gorge': { code: 'neri', name: 'New River Gorge National Park & Preserve', keywords: ['new river gorge', 'west virginia', 'neri'] },
  'north cascades': { code: 'noca', name: 'North Cascades National Park', keywords: ['north cascades', 'washington', 'noca'] },
  'olympic': { code: 'olym', name: 'Olympic National Park', keywords: ['olympic', 'washington', 'olym'] },
  'petrified forest': { code: 'pefo', name: 'Petrified Forest National Park', keywords: ['petrified forest', 'arizona', 'pefo'] },
  'pinnacles': { code: 'pinn', name: 'Pinnacles National Park', keywords: ['pinnacles', 'california', 'pinn'] },
  'redwood': { code: 'redw', name: 'Redwood National and State Parks', keywords: ['redwood', 'california', 'redw'] },
  'rocky mountain': { code: 'romo', name: 'Rocky Mountain National Park', keywords: ['rocky mountain', 'colorado', 'romo'] },
  'saguaro': { code: 'sagu', name: 'Saguaro National Park', keywords: ['saguaro', 'arizona', 'sagu'] },
  'sequoia': { code: 'seki', name: 'Sequoia & Kings Canyon National Parks', keywords: ['sequoia', 'kings canyon', 'california', 'seki'] },
  'shenandoah': { code: 'shen', name: 'Shenandoah National Park', keywords: ['shenandoah', 'virginia', 'shen'] },
  'theodore roosevelt': { code: 'thro', name: 'Theodore Roosevelt National Park', keywords: ['theodore roosevelt', 'north dakota', 'thro'] },
  'virgin islands': { code: 'viis', name: 'Virgin Islands National Park', keywords: ['virgin islands', 'viis'] },
  'voyageurs': { code: 'voya', name: 'Voyageurs National Park', keywords: ['voyageurs', 'minnesota', 'voya'] },
  'white sands': { code: 'whsa', name: 'White Sands National Park', keywords: ['white sands', 'new mexico', 'whsa'] },
  'wind cave': { code: 'wica', name: 'Wind Cave National Park', keywords: ['wind cave', 'south dakota', 'wica'] },
  'wrangell st elias': { code: 'wrst', name: 'Wrangell - St Elias National Park & Preserve', keywords: ['wrangell', 'st elias', 'alaska', 'wrst'] },
  'yellowstone': { code: 'yell', name: 'Yellowstone National Park', keywords: ['yellowstone', 'idaho', 'montana', 'wyoming', 'yell'] },
  'yosemite': { code: 'yose', name: 'Yosemite National Park', keywords: ['yosemite', 'california', 'yose'] },
  'zion': { code: 'zion', name: 'Zion National Park', keywords: ['zion', 'utah', 'zion'] },
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

/**
 * Extract the best matching park name from text
 * Prioritizes longer/more specific matches to avoid "glacier" matching before "kenai fjords"
 * Returns the full authoritative park name
 */
export function extractParkNameFromText(text: string): string | null {
  const textLower = text.toLowerCase();
  
  // Build a list of all possible matches with their specificity (length)
  const matches: Array<{ name: string; matchLength: number; position: number }> = [];
  
  for (const [key, park] of Object.entries(NATIONAL_PARKS)) {
    // Check the main key (e.g., "kenai fjords")
    const keyPos = textLower.indexOf(key);
    if (keyPos !== -1) {
      matches.push({ name: park.name, matchLength: key.length, position: keyPos });
    }
    
    // Check keywords (but only multi-word ones to avoid false positives like "alaska")
    for (const keyword of park.keywords) {
      if (keyword.includes(' ') || keyword === park.code) {
        const kwPos = textLower.indexOf(keyword);
        if (kwPos !== -1) {
          matches.push({ name: park.name, matchLength: keyword.length, position: kwPos });
        }
      }
    }
  }
  
  if (matches.length === 0) {
    return null;
  }
  
  // Sort by match length (longer = more specific), then by position (earlier = more relevant)
  matches.sort((a, b) => {
    if (b.matchLength !== a.matchLength) {
      return b.matchLength - a.matchLength; // Longer matches first
    }
    return a.position - b.position; // Earlier position wins ties
  });
  
  return matches[0].name;
}

/**
 * Get a display-friendly short name for a park
 * e.g., "Kenai Fjords National Park" -> "Kenai Fjords"
 */
export function getShortParkName(fullName: string): string {
  return fullName
    .replace(/National Park.*$/, '')
    .replace(/National and State Parks.*$/, '')
    .trim();
}
