/**
 * Complete list of US National Parks with activities for random trip generation
 * Generated from NPS API - includes all 63 national parks
 */

export interface NationalParkInfo {
  name: string;
  state: string;
  activities: string[];
}

export const NATIONAL_PARKS: NationalParkInfo[] = [
  { name: 'Acadia National Park', state: 'Maine', activities: ['coastal views', 'hiking', 'bike paths', 'sunrise spots'] },
  { name: 'Arches National Park', state: 'Utah', activities: ['natural arches', 'hiking', 'photography', 'stargazing'] },
  { name: 'Badlands National Park', state: 'South Dakota', activities: ['scenic drives', 'wildlife viewing', 'fossil beds', 'hiking'] },
  { name: 'Big Bend National Park', state: 'Texas', activities: ['desert hiking', 'river canyons', 'stargazing', 'hot springs'] },
  { name: 'Biscayne National Park', state: 'Florida', activities: ['snorkeling', 'kayaking', 'coral reefs', 'island camping'] },
  { name: 'Black Canyon of the Gunnison National Park', state: 'Colorado', activities: ['canyon views', 'hiking', 'rock climbing', 'stargazing'] },
  { name: 'Bryce Canyon National Park', state: 'Utah', activities: ['hoodoos', 'hiking', 'stargazing', 'scenic drives'] },
  { name: 'Canyonlands National Park', state: 'Utah', activities: ['canyons', 'hiking', 'mountain biking', 'four-wheeling'] },
  { name: 'Capitol Reef National Park', state: 'Utah', activities: ['rock formations', 'hiking', 'fruit orchards', 'petroglyphs'] },
  { name: 'Carlsbad Caverns National Park', state: 'New Mexico', activities: ['cave tours', 'bat flights', 'hiking', 'underground formations'] },
  { name: 'Channel Islands National Park', state: 'California', activities: ['island hiking', 'kayaking', 'snorkeling', 'wildlife viewing'] },
  { name: 'Congaree National Park', state: 'South Carolina', activities: ['old-growth forest', 'kayaking', 'hiking', 'birdwatching'] },
  { name: 'Crater Lake National Park', state: 'Oregon', activities: ['lake views', 'hiking', 'boat tours', 'scenic drives'] },
  { name: 'Cuyahoga Valley National Park', state: 'Ohio', activities: ['waterfalls', 'hiking', 'scenic railroad', 'biking'] },
  { name: 'Death Valley National Park', state: 'California/Nevada', activities: ['desert landscapes', 'sand dunes', 'stargazing', 'historic sites'] },
  { name: 'Denali National Park', state: 'Alaska', activities: ['mountain views', 'wildlife viewing', 'backcountry hiking', 'bus tours'] },
  { name: 'Dry Tortugas National Park', state: 'Florida', activities: ['snorkeling', 'historic fort', 'beach camping', 'birdwatching'] },
  { name: 'Everglades National Park', state: 'Florida', activities: ['airboat tours', 'wildlife viewing', 'kayaking', 'hiking'] },
  { name: 'Gates of the Arctic National Park', state: 'Alaska', activities: ['wilderness hiking', 'wildlife viewing', 'northern lights', 'remote camping'] },
  { name: 'Gateway Arch National Park', state: 'Missouri', activities: ['arch tram ride', 'riverboat cruises', 'historic sites', 'city views'] },
  { name: 'Glacier National Park', state: 'Montana', activities: ['glaciers', 'mountain lakes', 'wildlife', 'scenic drives'] },
  { name: 'Glacier Bay National Park', state: 'Alaska', activities: ['glaciers', 'whale watching', 'kayaking', 'cruise tours'] },
  { name: 'Grand Canyon National Park', state: 'Arizona', activities: ['hiking', 'scenic viewpoints', 'river rafting', 'photography'] },
  { name: 'Grand Teton National Park', state: 'Wyoming', activities: ['mountain views', 'hiking', 'wildlife viewing', 'lake activities'] },
  { name: 'Great Basin National Park', state: 'Nevada', activities: ['cave tours', 'stargazing', 'ancient bristlecone pines', 'hiking'] },
  { name: 'Great Sand Dunes National Park', state: 'Colorado', activities: ['sand dunes', 'sandboarding', 'hiking', 'stargazing'] },
  { name: 'Great Smoky Mountains National Park', state: 'Tennessee/North Carolina', activities: ['mountain views', 'hiking', 'wildlife', 'historic buildings'] },
  { name: 'Guadalupe Mountains National Park', state: 'Texas', activities: ['hiking', 'fall foliage', 'historic sites', 'stargazing'] },
  { name: 'Haleakalā National Park', state: 'Hawaii', activities: ['sunrise viewing', 'volcanic crater', 'hiking', 'stargazing'] },
  { name: 'Hawaiʻi Volcanoes National Park', state: 'Hawaii', activities: ['active volcanoes', 'lava viewing', 'hiking', 'crater exploration'] },
  { name: 'Hot Springs National Park', state: 'Arkansas', activities: ['thermal baths', 'bathhouse row', 'hiking', 'historic architecture'] },
  { name: 'Indiana Dunes National Park', state: 'Indiana', activities: ['beach activities', 'hiking', 'birdwatching', 'dune climbing'] },
  { name: 'Isle Royale National Park', state: 'Michigan', activities: ['wilderness hiking', 'kayaking', 'wildlife viewing', 'backpacking'] },
  { name: 'Joshua Tree National Park', state: 'California', activities: ['rock climbing', 'hiking', 'stargazing', 'desert landscapes'] },
  { name: 'Katmai National Park', state: 'Alaska', activities: ['bear viewing', 'fishing', 'volcanic landscapes', 'backcountry camping'] },
  { name: 'Kenai Fjords National Park', state: 'Alaska', activities: ['glaciers', 'whale watching', 'kayaking', 'boat tours'] },
  { name: 'Kobuk Valley National Park', state: 'Alaska', activities: ['sand dunes', 'caribou migration', 'wilderness hiking', 'river floating'] },
  { name: 'Lake Clark National Park', state: 'Alaska', activities: ['bear viewing', 'fishing', 'volcanic landscapes', 'flightseeing'] },
  { name: 'Lassen Volcanic National Park', state: 'California', activities: ['hydrothermal areas', 'hiking', 'volcanic landscapes', 'stargazing'] },
  { name: 'Mammoth Cave National Park', state: 'Kentucky', activities: ['cave tours', 'hiking', 'kayaking', 'camping'] },
  { name: 'Mesa Verde National Park', state: 'Colorado', activities: ['cliff dwellings', 'archaeology', 'hiking', 'cultural history'] },
  { name: 'Mount Rainier National Park', state: 'Washington', activities: ['mountain views', 'hiking', 'wildflower meadows', 'glacier viewing'] },
  { name: 'New River Gorge National Park', state: 'West Virginia', activities: ['whitewater rafting', 'rock climbing', 'hiking', 'bridge views'] },
  { name: 'North Cascades National Park', state: 'Washington', activities: ['mountain lakes', 'hiking', 'glaciers', 'scenic drives'] },
  { name: 'Olympic National Park', state: 'Washington', activities: ['rainforests', 'beaches', 'mountains', 'hot springs'] },
  { name: 'Petrified Forest National Park', state: 'Arizona', activities: ['petrified wood', 'painted desert', 'hiking', 'petroglyphs'] },
  { name: 'Pinnacles National Park', state: 'California', activities: ['rock formations', 'cave exploration', 'hiking', 'condor viewing'] },
  { name: 'Redwood National and State Parks', state: 'California', activities: ['giant redwoods', 'hiking', 'scenic drives', 'wildlife viewing'] },
  { name: 'Rocky Mountain National Park', state: 'Colorado', activities: ['alpine lakes', 'wildlife', 'mountain hiking', 'scenic drives'] },
  { name: 'Saguaro National Park', state: 'Arizona', activities: ['desert hiking', 'saguaro cacti', 'scenic drives', 'wildlife viewing'] },
  { name: 'Sequoia & Kings Canyon National Parks', state: 'California', activities: ['giant sequoias', 'hiking', 'cave tours', 'mountain views'] },
  { name: 'Shenandoah National Park', state: 'Virginia', activities: ['scenic drives', 'hiking', 'waterfalls', 'wildlife viewing'] },
  { name: 'Theodore Roosevelt National Park', state: 'North Dakota', activities: ['badlands scenery', 'wildlife viewing', 'hiking', 'scenic drives'] },
  { name: 'Virgin Islands National Park', state: 'U.S. Virgin Islands', activities: ['snorkeling', 'beaches', 'hiking', 'historic ruins'] },
  { name: 'Voyageurs National Park', state: 'Minnesota', activities: ['boating', 'fishing', 'northern lights', 'kayaking'] },
  { name: 'White Sands National Park', state: 'New Mexico', activities: ['white sand dunes', 'hiking', 'sledding', 'photography'] },
  { name: 'Wind Cave National Park', state: 'South Dakota', activities: ['cave tours', 'wildlife viewing', 'hiking', 'prairie ecosystem'] },
  { name: 'Wrangell-St. Elias National Park', state: 'Alaska', activities: ['glaciers', 'mountain climbing', 'flightseeing', 'wilderness hiking'] },
  { name: 'Yellowstone National Park', state: 'Wyoming/Montana/Idaho', activities: ['geysers', 'wildlife viewing', 'hiking', 'hot springs'] },
  { name: 'Yosemite National Park', state: 'California', activities: ['waterfalls', 'rock climbing', 'giant sequoias', 'valley views'] },
  { name: 'Zion National Park', state: 'Utah', activities: ['canyoneering', 'hiking', 'river walks', 'scenic drives'] },
];

/**
 * Park detection patterns for parsing text (sorted by key length for priority matching)
 */
export const PARK_DETECTION_PATTERNS: Array<{ pattern: RegExp; name: string; code: string }> = [
  { pattern: /great\s*smoky\s*mountains|smokies/i, name: 'Great Smoky Mountains National Park', code: 'grsm' },
  { pattern: /wrangell[\s-]*st\.?\s*elias/i, name: 'Wrangell-St. Elias National Park', code: 'wrst' },
  { pattern: /gates\s*of\s*the\s*arctic/i, name: 'Gates of the Arctic National Park', code: 'gaar' },
  { pattern: /guadalupe\s*mountains/i, name: 'Guadalupe Mountains National Park', code: 'gumo' },
  { pattern: /carlsbad\s*caverns/i, name: 'Carlsbad Caverns National Park', code: 'cave' },
  { pattern: /theodore\s*roosevelt/i, name: 'Theodore Roosevelt National Park', code: 'thro' },
  { pattern: /great\s*sand\s*dunes/i, name: 'Great Sand Dunes National Park', code: 'grsa' },
  { pattern: /petrified\s*forest/i, name: 'Petrified Forest National Park', code: 'pefo' },
  { pattern: /hawaii\s*volcanoes/i, name: 'Hawaiʻi Volcanoes National Park', code: 'havo' },
  { pattern: /cuyahoga\s*valley/i, name: 'Cuyahoga Valley National Park', code: 'cuva' },
  { pattern: /channel\s*islands/i, name: 'Channel Islands National Park', code: 'chis' },
  { pattern: /lassen\s*volcanic/i, name: 'Lassen Volcanic National Park', code: 'lavo' },
  { pattern: /rocky\s*mountain/i, name: 'Rocky Mountain National Park', code: 'romo' },
  { pattern: /north\s*cascades/i, name: 'North Cascades National Park', code: 'noca' },
  { pattern: /new\s*river\s*gorge/i, name: 'New River Gorge National Park', code: 'neri' },
  { pattern: /indiana\s*dunes/i, name: 'Indiana Dunes National Park', code: 'indu' },
  { pattern: /black\s*canyon/i, name: 'Black Canyon of the Gunnison National Park', code: 'blca' },
  { pattern: /mount\s*rainier|mt\.?\s*rainier/i, name: 'Mount Rainier National Park', code: 'mora' },
  { pattern: /virgin\s*islands/i, name: 'Virgin Islands National Park', code: 'viis' },
  { pattern: /kenai\s*fjords/i, name: 'Kenai Fjords National Park', code: 'kefj' },
  { pattern: /kobuk\s*valley/i, name: 'Kobuk Valley National Park', code: 'kova' },
  { pattern: /death\s*valley/i, name: 'Death Valley National Park', code: 'deva' },
  { pattern: /crater\s*lake/i, name: 'Crater Lake National Park', code: 'crla' },
  { pattern: /bryce\s*canyon/i, name: 'Bryce Canyon National Park', code: 'brca' },
  { pattern: /grand\s*canyon/i, name: 'Grand Canyon National Park', code: 'grca' },
  { pattern: /joshua\s*tree/i, name: 'Joshua Tree National Park', code: 'jotr' },
  { pattern: /mammoth\s*cave/i, name: 'Mammoth Cave National Park', code: 'maca' },
  { pattern: /isle\s*royale/i, name: 'Isle Royale National Park', code: 'isro' },
  { pattern: /dry\s*tortugas/i, name: 'Dry Tortugas National Park', code: 'drto' },
  { pattern: /glacier\s*bay/i, name: 'Glacier Bay National Park', code: 'glba' },
  { pattern: /grand\s*teton/i, name: 'Grand Teton National Park', code: 'grte' },
  { pattern: /great\s*basin/i, name: 'Great Basin National Park', code: 'grba' },
  { pattern: /hot\s*springs/i, name: 'Hot Springs National Park', code: 'hosp' },
  { pattern: /lake\s*clark/i, name: 'Lake Clark National Park', code: 'lacl' },
  { pattern: /mesa\s*verde/i, name: 'Mesa Verde National Park', code: 'meve' },
  { pattern: /white\s*sands/i, name: 'White Sands National Park', code: 'whsa' },
  { pattern: /capitol\s*reef/i, name: 'Capitol Reef National Park', code: 'care' },
  { pattern: /gateway\s*arch/i, name: 'Gateway Arch National Park', code: 'jeff' },
  { pattern: /canyonlands/i, name: 'Canyonlands National Park', code: 'cany' },
  { pattern: /wind\s*cave/i, name: 'Wind Cave National Park', code: 'wica' },
  { pattern: /everglades/i, name: 'Everglades National Park', code: 'ever' },
  { pattern: /voyageurs/i, name: 'Voyageurs National Park', code: 'voya' },
  { pattern: /shenandoah/i, name: 'Shenandoah National Park', code: 'shen' },
  { pattern: /yellowstone/i, name: 'Yellowstone National Park', code: 'yell' },
  { pattern: /pinnacles/i, name: 'Pinnacles National Park', code: 'pinn' },
  { pattern: /biscayne/i, name: 'Biscayne National Park', code: 'bisc' },
  { pattern: /congaree/i, name: 'Congaree National Park', code: 'cong' },
  { pattern: /haleakala/i, name: 'Haleakalā National Park', code: 'hale' },
  { pattern: /big\s*bend/i, name: 'Big Bend National Park', code: 'bibe' },
  { pattern: /badlands/i, name: 'Badlands National Park', code: 'badl' },
  { pattern: /yosemite/i, name: 'Yosemite National Park', code: 'yose' },
  { pattern: /sequoia|kings\s*canyon/i, name: 'Sequoia & Kings Canyon National Parks', code: 'seki' },
  { pattern: /olympic/i, name: 'Olympic National Park', code: 'olym' },
  { pattern: /saguaro/i, name: 'Saguaro National Park', code: 'sagu' },
  { pattern: /redwood/i, name: 'Redwood National and State Parks', code: 'redw' },
  { pattern: /glacier(?!\s*bay)/i, name: 'Glacier National Park', code: 'glac' },
  { pattern: /arches/i, name: 'Arches National Park', code: 'arch' },
  { pattern: /acadia/i, name: 'Acadia National Park', code: 'acad' },
  { pattern: /katmai/i, name: 'Katmai National Park', code: 'katm' },
  { pattern: /denali/i, name: 'Denali National Park', code: 'dena' },
  { pattern: /zion/i, name: 'Zion National Park', code: 'zion' },
];

/**
 * Gateway cities and park coordinates for all 63+ national parks.
 * Single source of truth for park geospatial data across the project.
 * - city/state: gateway city for restaurant/lodging searches
 * - lat/lng: park center coordinates for map centering
 */
export const PARK_GATEWAYS: Record<string, { city: string; state: string; lat: number; lng: number }> = {
  'acad': { city: 'Bar Harbor', state: 'ME', lat: 44.35, lng: -68.21 },
  'arch': { city: 'Moab', state: 'UT', lat: 38.73, lng: -109.59 },
  'badl': { city: 'Wall', state: 'SD', lat: 43.75, lng: -102.50 },
  'bibe': { city: 'Terlingua', state: 'TX', lat: 29.25, lng: -103.25 },
  'bisc': { city: 'Homestead', state: 'FL', lat: 25.65, lng: -80.08 },
  'blca': { city: 'Montrose', state: 'CO', lat: 38.57, lng: -107.72 },
  'brca': { city: 'Bryce Canyon City', state: 'UT', lat: 37.57, lng: -112.18 },
  'cany': { city: 'Moab', state: 'UT', lat: 38.20, lng: -109.93 },
  'care': { city: 'Torrey', state: 'UT', lat: 38.20, lng: -111.17 },
  'cave': { city: 'Carlsbad', state: 'NM', lat: 32.17, lng: -104.44 },
  'chis': { city: 'Ventura', state: 'CA', lat: 34.01, lng: -119.42 },
  'cong': { city: 'Hopkins', state: 'SC', lat: 33.78, lng: -80.78 },
  'crla': { city: 'Prospect', state: 'OR', lat: 42.87, lng: -122.17 },
  'cuva': { city: 'Peninsula', state: 'OH', lat: 41.24, lng: -81.55 },
  'dena': { city: 'Denali Park', state: 'AK', lat: 63.33, lng: -150.50 },
  'deva': { city: 'Furnace Creek', state: 'CA', lat: 36.24, lng: -116.82 },
  'drto': { city: 'Key West', state: 'FL', lat: 24.63, lng: -82.87 },
  'ever': { city: 'Homestead', state: 'FL', lat: 25.29, lng: -80.90 },
  'gaar': { city: 'Bettles', state: 'AK', lat: 67.78, lng: -153.30 },
  'glac': { city: 'West Glacier', state: 'MT', lat: 48.80, lng: -114.00 },
  'glba': { city: 'Gustavus', state: 'AK', lat: 58.50, lng: -137.00 },
  'grba': { city: 'Baker', state: 'NV', lat: 38.98, lng: -114.30 },
  'grca': { city: 'Tusayan', state: 'AZ', lat: 36.06, lng: -112.14 },
  'grsa': { city: 'Alamosa', state: 'CO', lat: 37.73, lng: -105.51 },
  'grsm': { city: 'Gatlinburg', state: 'TN', lat: 35.68, lng: -83.53 },
  'grte': { city: 'Jackson', state: 'WY', lat: 43.73, lng: -110.80 },
  'gumo': { city: 'Salt Flat', state: 'TX', lat: 31.92, lng: -104.87 },
  'hale': { city: 'Kula', state: 'HI', lat: 20.72, lng: -156.17 },
  'havo': { city: 'Volcano', state: 'HI', lat: 19.48, lng: -155.23 },
  'hosp': { city: 'Hot Springs', state: 'AR', lat: 34.51, lng: -93.05 },
  'indu': { city: 'Porter', state: 'IN', lat: 41.65, lng: -87.05 },
  'isro': { city: 'Houghton', state: 'MI', lat: 48.10, lng: -88.55 },
  'jeff': { city: 'St. Louis', state: 'MO', lat: 38.62, lng: -90.19 },
  'jotr': { city: 'Twentynine Palms', state: 'CA', lat: 33.88, lng: -115.90 },
  'katm': { city: 'King Salmon', state: 'AK', lat: 58.50, lng: -155.00 },
  'kefj': { city: 'Seward', state: 'AK', lat: 59.92, lng: -149.65 },
  'kova': { city: 'Kotzebue', state: 'AK', lat: 67.55, lng: -159.28 },
  'lacl': { city: 'Port Alsworth', state: 'AK', lat: 60.97, lng: -153.42 },
  'lavo': { city: 'Mineral', state: 'CA', lat: 40.49, lng: -121.51 },
  'maca': { city: 'Cave City', state: 'KY', lat: 37.19, lng: -86.10 },
  'meve': { city: 'Cortez', state: 'CO', lat: 37.18, lng: -108.49 },
  'mora': { city: 'Ashford', state: 'WA', lat: 46.85, lng: -121.75 },
  'neri': { city: 'Fayetteville', state: 'WV', lat: 38.07, lng: -81.08 },
  'noca': { city: 'Marblemount', state: 'WA', lat: 48.77, lng: -121.21 },
  'npsa': { city: 'Pago Pago', state: 'AS', lat: -14.25, lng: -170.68 },
  'olym': { city: 'Port Angeles', state: 'WA', lat: 47.97, lng: -123.50 },
  'pefo': { city: 'Holbrook', state: 'AZ', lat: 35.07, lng: -109.78 },
  'pinn': { city: 'Soledad', state: 'CA', lat: 36.48, lng: -121.16 },
  'redw': { city: 'Crescent City', state: 'CA', lat: 41.30, lng: -124.00 },
  'romo': { city: 'Estes Park', state: 'CO', lat: 40.34, lng: -105.68 },
  'sagu': { city: 'Tucson', state: 'AZ', lat: 32.25, lng: -111.17 },
  'seki': { city: 'Three Rivers', state: 'CA', lat: 36.43, lng: -118.68 },
  'shen': { city: 'Luray', state: 'VA', lat: 38.53, lng: -78.35 },
  'thro': { city: 'Medora', state: 'ND', lat: 46.97, lng: -103.45 },
  'viis': { city: 'Cruz Bay', state: 'VI', lat: 18.33, lng: -64.73 },
  'voya': { city: 'International Falls', state: 'MN', lat: 48.50, lng: -92.88 },
  'whsa': { city: 'Alamogordo', state: 'NM', lat: 32.78, lng: -106.17 },
  'wica': { city: 'Hot Springs', state: 'SD', lat: 43.57, lng: -103.48 },
  'wrst': { city: 'McCarthy', state: 'AK', lat: 61.00, lng: -142.00 },
  'yell': { city: 'West Yellowstone', state: 'MT', lat: 44.60, lng: -110.50 },
  'yose': { city: 'Mariposa', state: 'CA', lat: 37.87, lng: -119.54 },
  'zion': { city: 'Springdale', state: 'UT', lat: 37.30, lng: -113.05 },
};

/**
 * Get all park names for display/selection
 */
export function getAllParkNames(): string[] {
  return NATIONAL_PARKS.map(p => p.name);
}

/**
 * Get a random park from the full list
 */
export function getRandomPark(): NationalParkInfo {
  return NATIONAL_PARKS[Math.floor(Math.random() * NATIONAL_PARKS.length)];
}

/**
 * Get parks filtered by state proximity
 */
export function getParksByStateProximity(userState: string): NationalParkInfo[] {
  const stateProximity: Record<string, string[]> = {
    'california': ['california', 'nevada', 'arizona', 'oregon'],
    'arizona': ['arizona', 'california', 'nevada', 'utah', 'new mexico'],
    'utah': ['utah', 'arizona', 'colorado', 'new mexico', 'nevada', 'idaho', 'wyoming'],
    'colorado': ['colorado', 'utah', 'wyoming', 'new mexico', 'nebraska', 'kansas'],
    'wyoming': ['wyoming', 'colorado', 'utah', 'idaho', 'montana', 'south dakota'],
    'montana': ['montana', 'wyoming', 'idaho', 'north dakota', 'south dakota'],
    'idaho': ['idaho', 'montana', 'wyoming', 'utah', 'washington', 'oregon', 'nevada'],
    'washington': ['washington', 'oregon', 'idaho', 'montana'],
    'oregon': ['oregon', 'washington', 'california', 'idaho', 'nevada'],
    'nevada': ['nevada', 'california', 'arizona', 'utah', 'idaho', 'oregon'],
    'tennessee': ['tennessee', 'north carolina', 'kentucky', 'virginia', 'georgia', 'alabama'],
    'north carolina': ['north carolina', 'tennessee', 'virginia', 'south carolina', 'georgia'],
    'virginia': ['virginia', 'north carolina', 'west virginia', 'maryland', 'kentucky'],
    'maine': ['maine', 'new hampshire', 'vermont', 'massachusetts'],
    'florida': ['florida', 'georgia', 'alabama'],
    'texas': ['texas', 'new mexico', 'oklahoma', 'louisiana', 'arkansas'],
    'alaska': ['alaska'],
    'hawaii': ['hawaii'],
    'new york': ['new york', 'new jersey', 'pennsylvania', 'connecticut', 'massachusetts', 'vermont'],
    'ohio': ['ohio', 'indiana', 'michigan', 'pennsylvania', 'west virginia', 'kentucky'],
    'michigan': ['michigan', 'ohio', 'indiana', 'wisconsin', 'minnesota'],
    'minnesota': ['minnesota', 'wisconsin', 'michigan', 'north dakota', 'south dakota', 'iowa'],
    'south dakota': ['south dakota', 'north dakota', 'minnesota', 'iowa', 'nebraska', 'wyoming', 'montana'],
    'new mexico': ['new mexico', 'texas', 'arizona', 'colorado', 'utah', 'oklahoma'],
    'arkansas': ['arkansas', 'missouri', 'oklahoma', 'texas', 'louisiana', 'mississippi', 'tennessee'],
    'missouri': ['missouri', 'arkansas', 'illinois', 'iowa', 'kansas', 'kentucky', 'nebraska', 'oklahoma', 'tennessee'],
    'kentucky': ['kentucky', 'tennessee', 'virginia', 'west virginia', 'ohio', 'indiana', 'illinois', 'missouri'],
    'south carolina': ['south carolina', 'north carolina', 'georgia'],
    'indiana': ['indiana', 'ohio', 'michigan', 'illinois', 'kentucky'],
    'west virginia': ['west virginia', 'virginia', 'ohio', 'pennsylvania', 'maryland', 'kentucky'],
  };
  
  const userStateLower = userState.toLowerCase();
  const nearbyStates = stateProximity[userStateLower] || [];
  
  return NATIONAL_PARKS.filter(park => 
    nearbyStates.some(state => park.state.toLowerCase().includes(state))
  );
}
