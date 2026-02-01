/**
 * State Parks data for mobile app - State Parks 2.0
 * Curated list of notable state parks by state for discovery and trip planning
 */
 
export interface StateParkInfo {
  name: string;
  state: string;
  stateCode: string;
  activities: string[];
  highlights: string[];
}
 
export interface StateInfo {
  code: string;
  name: string;
  parkCount: number;
  topParks: string[];
}
 
// Notable state parks by state (curated selection for discovery)
export const FEATURED_STATE_PARKS: StateParkInfo[] = [
  // California
  { name: 'Anza-Borrego Desert State Park', state: 'California', stateCode: 'CA', activities: ['hiking', 'wildflowers', 'stargazing', 'off-roading'], highlights: ['Largest state park in California', 'Spring wildflower blooms', 'Dark sky preserve'] },
  { name: 'Big Basin Redwoods State Park', state: 'California', stateCode: 'CA', activities: ['hiking', 'camping', 'waterfalls', 'redwoods'], highlights: ['Oldest state park in California', 'Old-growth redwoods', 'Berry Creek Falls'] },
  { name: 'Point Lobos State Natural Reserve', state: 'California', stateCode: 'CA', activities: ['hiking', 'wildlife viewing', 'tide pools', 'photography'], highlights: ['Crown jewel of state parks', 'Sea otters and seals', 'Cypress groves'] },
  { name: 'Julia Pfeiffer Burns State Park', state: 'California', stateCode: 'CA', activities: ['hiking', 'waterfall viewing', 'coastal scenery'], highlights: ['McWay Falls', 'Big Sur coastline', 'Underwater reserve'] },
 
  // Texas
  { name: 'Palo Duro Canyon State Park', state: 'Texas', stateCode: 'TX', activities: ['hiking', 'camping', 'horseback riding', 'mountain biking'], highlights: ['Second largest canyon in US', 'Lighthouse Rock', 'Texas outdoor musical'] },
  { name: 'Enchanted Rock State Natural Area', state: 'Texas', stateCode: 'TX', activities: ['hiking', 'rock climbing', 'stargazing', 'camping'], highlights: ['Giant pink granite dome', 'Dark sky preserve', 'Native American history'] },
  { name: 'Garner State Park', state: 'Texas', stateCode: 'TX', activities: ['swimming', 'hiking', 'camping', 'tubing'], highlights: ['Frio River', 'Summer dance terrace', 'Hill Country scenery'] },
  { name: 'Big Bend Ranch State Park', state: 'Texas', stateCode: 'TX', activities: ['hiking', 'mountain biking', 'stargazing', 'four-wheeling'], highlights: ['Remote desert wilderness', 'Rio Grande access', 'Dark skies'] },
 
  // New York
  { name: 'Letchworth State Park', state: 'New York', stateCode: 'NY', activities: ['hiking', 'waterfalls', 'hot air ballooning', 'whitewater rafting'], highlights: ['Grand Canyon of the East', 'Three major waterfalls', 'Genesee River gorge'] },
  { name: 'Watkins Glen State Park', state: 'New York', stateCode: 'NY', activities: ['hiking', 'waterfalls', 'gorge trail', 'camping'], highlights: ['19 waterfalls', 'Gorge Trail', 'Finger Lakes wine region'] },
  { name: 'Harriman State Park', state: 'New York', stateCode: 'NY', activities: ['hiking', 'swimming', 'camping', 'cross-country skiing'], highlights: ['Second largest state park in NY', 'Appalachian Trail access', 'Historic iron mines'] },
 
  // Florida
  { name: 'Bahia Honda State Park', state: 'Florida', stateCode: 'FL', activities: ['snorkeling', 'kayaking', 'beach', 'camping'], highlights: ['Best beach in Florida Keys', 'Historic bridge', 'Clear waters'] },
  { name: 'Myakka River State Park', state: 'Florida', stateCode: 'FL', activities: ['hiking', 'kayaking', 'wildlife viewing', 'airboat tours'], highlights: ['One of oldest state parks', 'Canopy walkway', 'Alligator viewing'] },
  { name: 'Ichetucknee Springs State Park', state: 'Florida', stateCode: 'FL', activities: ['tubing', 'snorkeling', 'kayaking', 'swimming'], highlights: ['Crystal clear springs', 'Tubing river', 'Manatee sightings'] },
 
  // Colorado
  { name: 'Eldorado Canyon State Park', state: 'Colorado', stateCode: 'CO', activities: ['rock climbing', 'hiking', 'fishing', 'picnicking'], highlights: ['World-class climbing', 'South Boulder Creek', 'Continental Divide views'] },
  { name: 'Roxborough State Park', state: 'Colorado', stateCode: 'CO', activities: ['hiking', 'wildlife viewing', 'photography', 'geology'], highlights: ['Red rock formations', 'No bikes or horses allowed', 'Mule deer and raptors'] },
  { name: 'Cheyenne Mountain State Park', state: 'Colorado', stateCode: 'CO', activities: ['hiking', 'mountain biking', 'camping', 'wildlife viewing'], highlights: ['Views of Cheyenne Mountain', 'Black bear habitat', 'Near Colorado Springs'] },
 
  // Washington
  { name: 'Deception Pass State Park', state: 'Washington', stateCode: 'WA', activities: ['hiking', 'beach', 'fishing', 'scuba diving'], highlights: ['Most visited state park in WA', 'Iconic bridge', 'Tidepools'] },
  { name: 'Palouse Falls State Park', state: 'Washington', stateCode: 'WA', activities: ['hiking', 'photography', 'camping'], highlights: ['State waterfall', '198-foot falls', 'Ice Age floods geology'] },
  { name: 'Sun Lakes-Dry Falls State Park', state: 'Washington', stateCode: 'WA', activities: ['hiking', 'swimming', 'fishing', 'horseback riding'], highlights: ['Ancient waterfall', 'Ice Age floods', 'Lake swimming'] },
 
  // Oregon
  { name: 'Silver Falls State Park', state: 'Oregon', stateCode: 'OR', activities: ['hiking', 'waterfalls', 'camping', 'horseback riding'], highlights: ['Trail of Ten Falls', 'Walk behind waterfalls', 'Largest state park in OR'] },
  { name: 'Smith Rock State Park', state: 'Oregon', stateCode: 'OR', activities: ['rock climbing', 'hiking', 'mountain biking'], highlights: ['Birthplace of American sport climbing', 'Crooked River', 'Monkey Face'] },
  { name: 'Cape Lookout State Park', state: 'Oregon', stateCode: 'OR', activities: ['hiking', 'beach', 'camping', 'whale watching'], highlights: ['Cape trail', 'Old-growth forest', 'Gray whale migration'] },
 
  // Michigan
  { name: 'Tahquamenon Falls State Park', state: 'Michigan', stateCode: 'MI', activities: ['hiking', 'waterfalls', 'canoeing', 'camping'], highlights: ['Upper and Lower Falls', 'Root beer colored water', 'Upper Peninsula'] },
  { name: 'Pictured Rocks National Lakeshore', state: 'Michigan', stateCode: 'MI', activities: ['hiking', 'kayaking', 'camping', 'ice climbing'], highlights: ['Colorful sandstone cliffs', 'Lake Superior', 'Waterfalls'] },
  { name: 'Sleeping Bear Dunes National Lakeshore', state: 'Michigan', stateCode: 'MI', activities: ['hiking', 'dune climbing', 'beach', 'scenic drives'], highlights: ['Perched dunes', 'Lake Michigan views', 'Pierce Stocking Scenic Drive'] },
 
  // Arizona
  { name: 'Slide Rock State Park', state: 'Arizona', stateCode: 'AZ', activities: ['swimming', 'hiking', 'apple picking', 'fishing'], highlights: ['Natural water slide', 'Oak Creek Canyon', 'Historic apple orchard'] },
  { name: 'Dead Horse Point State Park', state: 'Arizona', stateCode: 'AZ', activities: ['hiking', 'mountain biking', 'photography', 'camping'], highlights: ['Colorado River overlook', 'Featured in movies', 'Sunrise views'] },
  { name: 'Kartchner Caverns State Park', state: 'Arizona', stateCode: 'AZ', activities: ['cave tours', 'hiking', 'camping', 'wildlife viewing'], highlights: ['Living cave', 'Preserved formations', 'Bat colony'] },
 
  // Utah
  { name: 'Dead Horse Point State Park', state: 'Utah', stateCode: 'UT', activities: ['hiking', 'mountain biking', 'photography', 'stargazing'], highlights: ['2,000 ft above Colorado River', 'Featured in Thelma & Louise', 'Dark sky park'] },
  { name: 'Goblin Valley State Park', state: 'Utah', stateCode: 'UT', activities: ['hiking', 'photography', 'stargazing', 'camping'], highlights: ['Unique rock formations', 'Galaxy Quest filming location', 'Dark sky park'] },
  { name: 'Snow Canyon State Park', state: 'Utah', stateCode: 'UT', activities: ['hiking', 'rock climbing', 'horseback riding', 'camping'], highlights: ['Red and white sandstone', 'Lava tubes', 'Near St. George'] },
 
  // Alaska
  { name: 'Chugach State Park', state: 'Alaska', stateCode: 'AK', activities: ['hiking', 'wildlife viewing', 'glacier viewing', 'backcountry camping'], highlights: ['Third largest state park in US', 'Near Anchorage', 'Dall sheep'] },
  { name: 'Denali State Park', state: 'Alaska', stateCode: 'AK', activities: ['hiking', 'camping', 'wildlife viewing', 'fishing'], highlights: ['Denali views', 'Less crowded than national park', 'K\'esugi Ridge Trail'] },
 
  // Hawaii  
  { name: 'Waimea Canyon State Park', state: 'Hawaii', stateCode: 'HI', activities: ['hiking', 'scenic viewpoints', 'photography'], highlights: ['Grand Canyon of the Pacific', '10 miles long', 'Kauai'] },
  { name: 'Na Pali Coast State Wilderness Park', state: 'Hawaii', stateCode: 'HI', activities: ['hiking', 'kayaking', 'camping', 'snorkeling'], highlights: ['Kalalau Trail', 'Sea cliffs', 'Remote beaches'] },
];
 
// US States with state park systems
export const US_STATES: StateInfo[] = [
  { code: 'AL', name: 'Alabama', parkCount: 21, topParks: ['Gulf State Park', 'DeSoto State Park', 'Cheaha State Park'] },
  { code: 'AK', name: 'Alaska', parkCount: 123, topParks: ['Chugach State Park', 'Denali State Park', 'Kachemak Bay State Park'] },
  { code: 'AZ', name: 'Arizona', parkCount: 35, topParks: ['Slide Rock State Park', 'Dead Horse Point State Park', 'Kartchner Caverns'] },
  { code: 'AR', name: 'Arkansas', parkCount: 52, topParks: ['Devil\'s Den State Park', 'Petit Jean State Park', 'Crater of Diamonds'] },
  { code: 'CA', name: 'California', parkCount: 280, topParks: ['Anza-Borrego Desert', 'Big Basin Redwoods', 'Point Lobos'] },
  { code: 'CO', name: 'Colorado', parkCount: 42, topParks: ['Eldorado Canyon', 'Roxborough', 'Cherry Creek'] },
  { code: 'CT', name: 'Connecticut', parkCount: 139, topParks: ['Sleeping Giant', 'Hammonasset Beach', 'Kent Falls'] },
  { code: 'DE', name: 'Delaware', parkCount: 17, topParks: ['Cape Henlopen', 'Delaware Seashore', 'Killens Pond'] },
  { code: 'FL', name: 'Florida', parkCount: 175, topParks: ['Bahia Honda', 'Myakka River', 'Ichetucknee Springs'] },
  { code: 'GA', name: 'Georgia', parkCount: 63, topParks: ['Tallulah Gorge', 'Cloudland Canyon', 'Amicalola Falls'] },
  { code: 'HI', name: 'Hawaii', parkCount: 52, topParks: ['Waimea Canyon', 'Na Pali Coast', 'Hapuna Beach'] },
  { code: 'ID', name: 'Idaho', parkCount: 30, topParks: ['Bruneau Dunes', 'Farragut', 'Ponderosa'] },
  { code: 'IL', name: 'Illinois', parkCount: 69, topParks: ['Starved Rock', 'Matthiessen', 'Giant City'] },
  { code: 'IN', name: 'Indiana', parkCount: 24, topParks: ['Brown County', 'Turkey Run', 'Indiana Dunes'] },
  { code: 'IA', name: 'Iowa', parkCount: 83, topParks: ['Backbone', 'Maquoketa Caves', 'Pikes Peak'] },
  { code: 'KS', name: 'Kansas', parkCount: 28, topParks: ['Kanopolis', 'Mushroom Rock', 'Tallgrass Prairie'] },
  { code: 'KY', name: 'Kentucky', parkCount: 45, topParks: ['Natural Bridge', 'Cumberland Falls', 'Carter Caves'] },
  { code: 'LA', name: 'Louisiana', parkCount: 21, topParks: ['Fontainebleau', 'Chicot', 'Grand Isle'] },
  { code: 'ME', name: 'Maine', parkCount: 48, topParks: ['Baxter State Park', 'Camden Hills', 'Acadia (state section)'] },
  { code: 'MD', name: 'Maryland', parkCount: 75, topParks: ['Cunningham Falls', 'Assateague', 'Rocks State Park'] },
  { code: 'MA', name: 'Massachusetts', parkCount: 120, topParks: ['Mount Greylock', 'Walden Pond', 'Blue Hills'] },
  { code: 'MI', name: 'Michigan', parkCount: 103, topParks: ['Tahquamenon Falls', 'Pictured Rocks', 'Sleeping Bear Dunes'] },
  { code: 'MN', name: 'Minnesota', parkCount: 75, topParks: ['Itasca', 'Gooseberry Falls', 'Tettegouche'] },
  { code: 'MS', name: 'Mississippi', parkCount: 25, topParks: ['Tishomingo', 'Roosevelt', 'Wall Doxey'] },
  { code: 'MO', name: 'Missouri', parkCount: 92, topParks: ['Ha Ha Tonka', 'Johnson\'s Shut-Ins', 'Elephant Rocks'] },
  { code: 'MT', name: 'Montana', parkCount: 55, topParks: ['Giant Springs', 'Makoshika', 'Lewis and Clark Caverns'] },
  { code: 'NE', name: 'Nebraska', parkCount: 86, topParks: ['Chadron', 'Fort Robinson', 'Indian Cave'] },
  { code: 'NV', name: 'Nevada', parkCount: 24, topParks: ['Valley of Fire', 'Cathedral Gorge', 'Sand Harbor'] },
  { code: 'NH', name: 'New Hampshire', parkCount: 93, topParks: ['Franconia Notch', 'Crawford Notch', 'Mount Monadnock'] },
  { code: 'NJ', name: 'New Jersey', parkCount: 51, topParks: ['High Point', 'Island Beach', 'Wharton State Forest'] },
  { code: 'NM', name: 'New Mexico', parkCount: 35, topParks: ['City of Rocks', 'Elephant Butte Lake', 'Bottomless Lakes'] },
  { code: 'NY', name: 'New York', parkCount: 215, topParks: ['Letchworth', 'Watkins Glen', 'Harriman'] },
  { code: 'NC', name: 'North Carolina', parkCount: 41, topParks: ['Hanging Rock', 'Stone Mountain', 'Jockey\'s Ridge'] },
  { code: 'ND', name: 'North Dakota', parkCount: 13, topParks: ['Theodore Roosevelt (state section)', 'Fort Abraham Lincoln', 'Icelandic'] },
  { code: 'OH', name: 'Ohio', parkCount: 75, topParks: ['Hocking Hills', 'Mohican', 'Salt Fork'] },
  { code: 'OK', name: 'Oklahoma', parkCount: 35, topParks: ['Turner Falls', 'Beavers Bend', 'Natural Falls'] },
  { code: 'OR', name: 'Oregon', parkCount: 254, topParks: ['Silver Falls', 'Smith Rock', 'Cape Lookout'] },
  { code: 'PA', name: 'Pennsylvania', parkCount: 124, topParks: ['Ricketts Glen', 'Ohiopyle', 'Presque Isle'] },
  { code: 'RI', name: 'Rhode Island', parkCount: 26, topParks: ['Beavertail', 'Colt State Park', 'Lincoln Woods'] },
  { code: 'SC', name: 'South Carolina', parkCount: 47, topParks: ['Table Rock', 'Caesars Head', 'Huntington Beach'] },
  { code: 'SD', name: 'South Dakota', parkCount: 13, topParks: ['Custer', 'Bear Butte', 'Palisades'] },
  { code: 'TN', name: 'Tennessee', parkCount: 56, topParks: ['Fall Creek Falls', 'Rock Island', 'Burgess Falls'] },
  { code: 'TX', name: 'Texas', parkCount: 89, topParks: ['Palo Duro Canyon', 'Enchanted Rock', 'Garner'] },
  { code: 'UT', name: 'Utah', parkCount: 45, topParks: ['Dead Horse Point', 'Goblin Valley', 'Snow Canyon'] },
  { code: 'VT', name: 'Vermont', parkCount: 55, topParks: ['Smugglers\' Notch', 'Mount Mansfield', 'Groton State Forest'] },
  { code: 'VA', name: 'Virginia', parkCount: 40, topParks: ['Shenandoah (state section)', 'Natural Bridge', 'First Landing'] },
  { code: 'WA', name: 'Washington', parkCount: 124, topParks: ['Deception Pass', 'Palouse Falls', 'Sun Lakes-Dry Falls'] },
  { code: 'WV', name: 'West Virginia', parkCount: 35, topParks: ['Blackwater Falls', 'Coopers Rock', 'Seneca Rocks'] },
  { code: 'WI', name: 'Wisconsin', parkCount: 66, topParks: ['Devil\'s Lake', 'Peninsula', 'Governor Dodge'] },
  { code: 'WY', name: 'Wyoming', parkCount: 12, topParks: ['Hot Springs', 'Glendo', 'Boysen'] },
];
 
/**
 * Get featured parks for a specific state
 */
export function getFeaturedParksForState(stateCode: string): StateParkInfo[] {
  return FEATURED_STATE_PARKS.filter(p => p.stateCode === stateCode.toUpperCase());
}
 
/**
 * Get state info by code
 */
export function getStateInfo(stateCode: string): StateInfo | undefined {
  return US_STATES.find(s => s.code === stateCode.toUpperCase());
}
 
/**
 * Get random featured state parks for discovery
 */
export function getRandomFeaturedParks(count: number = 5): StateParkInfo[] {
  const shuffled = [...FEATURED_STATE_PARKS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
 
/**
 * Search featured parks by activity
 */
export function searchParksByActivity(activity: string): StateParkInfo[] {
  const searchTerm = activity.toLowerCase();
  return FEATURED_STATE_PARKS.filter(park => 
    park.activities.some(a => a.toLowerCase().includes(searchTerm))
  );
}
 
/**
 * Get states sorted by park count
 */
export function getStatesByParkCount(): StateInfo[] {
  return [...US_STATES].sort((a, b) => b.parkCount - a.parkCount);
}