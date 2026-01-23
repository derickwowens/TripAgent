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
 * Gateway cities for parks (used for restaurant/lodging searches)
 */
export const PARK_GATEWAYS: Record<string, { city: string; state: string }> = {
  'yell': { city: 'West Yellowstone', state: 'MT' },
  'grca': { city: 'Tusayan', state: 'AZ' },
  'yose': { city: 'Mariposa', state: 'CA' },
  'zion': { city: 'Springdale', state: 'UT' },
  'glac': { city: 'West Glacier', state: 'MT' },
  'grte': { city: 'Jackson', state: 'WY' },
  'acad': { city: 'Bar Harbor', state: 'ME' },
  'romo': { city: 'Estes Park', state: 'CO' },
  'grsm': { city: 'Gatlinburg', state: 'TN' },
  'jotr': { city: 'Twentynine Palms', state: 'CA' },
  'brca': { city: 'Bryce Canyon City', state: 'UT' },
  'arch': { city: 'Moab', state: 'UT' },
  'cany': { city: 'Moab', state: 'UT' },
  'olym': { city: 'Port Angeles', state: 'WA' },
  'mora': { city: 'Ashford', state: 'WA' },
  'deva': { city: 'Furnace Creek', state: 'CA' },
  'seki': { city: 'Three Rivers', state: 'CA' },
  'dena': { city: 'Denali Park', state: 'AK' },
  'ever': { city: 'Homestead', state: 'FL' },
  'shen': { city: 'Luray', state: 'VA' },
  'bibe': { city: 'Terlingua', state: 'TX' },
  'crla': { city: 'Prospect', state: 'OR' },
  'badl': { city: 'Wall', state: 'SD' },
  'redw': { city: 'Crescent City', state: 'CA' },
  'care': { city: 'Torrey', state: 'UT' },
  'glba': { city: 'Gustavus', state: 'AK' },
  'kefj': { city: 'Seward', state: 'AK' },
  'katm': { city: 'King Salmon', state: 'AK' },
  'lacl': { city: 'Port Alsworth', state: 'AK' },
  'wrst': { city: 'McCarthy', state: 'AK' },
  'gaar': { city: 'Bettles', state: 'AK' },
  'kova': { city: 'Kotzebue', state: 'AK' },
  'havo': { city: 'Volcano', state: 'HI' },
  'hale': { city: 'Kula', state: 'HI' },
  'grsa': { city: 'Alamosa', state: 'CO' },
  'meve': { city: 'Cortez', state: 'CO' },
  'blca': { city: 'Montrose', state: 'CO' },
  'thro': { city: 'Medora', state: 'ND' },
  'voya': { city: 'International Falls', state: 'MN' },
  'isro': { city: 'Houghton', state: 'MI' },
  'maca': { city: 'Cave City', state: 'KY' },
  'hosp': { city: 'Hot Springs', state: 'AR' },
  'jeff': { city: 'St. Louis', state: 'MO' },
  'cong': { city: 'Hopkins', state: 'SC' },
  'neri': { city: 'Fayetteville', state: 'WV' },
  'cuva': { city: 'Peninsula', state: 'OH' },
  'indu': { city: 'Porter', state: 'IN' },
  'bisc': { city: 'Homestead', state: 'FL' },
  'drto': { city: 'Key West', state: 'FL' },
  'viis': { city: 'Cruz Bay', state: 'VI' },
  'chis': { city: 'Ventura', state: 'CA' },
  'pinn': { city: 'Soledad', state: 'CA' },
  'lavo': { city: 'Mineral', state: 'CA' },
  'noca': { city: 'Marblemount', state: 'WA' },
  'sagu': { city: 'Tucson', state: 'AZ' },
  'pefo': { city: 'Holbrook', state: 'AZ' },
  'cave': { city: 'Carlsbad', state: 'NM' },
  'whsa': { city: 'Alamogordo', state: 'NM' },
  'gumo': { city: 'Salt Flat', state: 'TX' },
  'grba': { city: 'Baker', state: 'NV' },
  'wica': { city: 'Hot Springs', state: 'SD' },
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
