import { BaseAdapter } from '../base/BaseAdapter.js';

// NPS API Response Types
interface NPSParkResponse {
  data: NPSPark[];
  total: string;
}

interface NPSPark {
  id: string;
  parkCode: string;
  fullName: string;
  description: string;
  states: string;
  designation: string;
  latitude: string;
  longitude: string;
  entranceFees: { cost: string; description: string; title: string }[];
  entrancePasses: { cost: string; description: string; title: string }[];
  operatingHours: { description: string; standardHours: Record<string, string> }[];
  addresses: { line1: string; city: string; stateCode: string; postalCode: string; type: string }[];
  contacts: { phoneNumbers: { phoneNumber: string; type: string }[]; emailAddresses: { emailAddress: string }[] };
  images: { url: string; caption: string; title: string }[];
  activities: { id: string; name: string }[];
  url: string;
}

interface NPSThingsToDoResponse {
  data: NPSThingToDo[];
}

interface NPSThingToDo {
  id: string;
  title: string;
  shortDescription: string;
  longDescription: string;
  duration: string;
  durationDescription: string;
  activityDescription: string;
  location: string;
  season: string[];
  accessibilityInformation: string;
  isReservationRequired: string;
  feeDescription: string;
  doFeesApply: string;
  images: { url: string; caption: string }[];
  relatedParks: { parkCode: string; fullName: string }[];
  url: string;
}

interface NPSCampgroundResponse {
  data: NPSCampground[];
}

interface NPSCampground {
  id: string;
  name: string;
  parkCode: string;
  description: string;
  latitude: string;
  longitude: string;
  numberOfSitesReservable: string;
  numberOfSitesFirstComeFirstServe: string;
  reservationUrl: string;
  fees: { cost: string; description: string; title: string }[];
  amenities: Record<string, string[]>;
  accessibility: Record<string, string>;
  images: { url: string; caption: string }[];
}

// Output Types
export interface NationalPark {
  id: string;
  parkCode: string;
  name: string;
  description: string;
  states: string[];
  coordinates: { latitude: number; longitude: number };
  nearestAirport: { code: string; name: string; distance: string };
  entranceFee: string;
  activities: string[];
  images: string[];
  url: string;
  address: string;
  // Gateway city info from NPS physical address for restaurant searches
  gatewayCity?: string;
  gatewayState?: string;
}

export interface ParkActivity {
  id: string;
  title: string;
  description: string;
  duration: string;
  season: string[];
  requiresReservation: boolean;
  hasFees: boolean;
  url: string;
}

export interface ParkCampground {
  id: string;
  name: string;
  description: string;
  coordinates: { latitude: number; longitude: number };
  totalSites: number;
  reservableSites: number;
  firstComeFirstServe: number;
  reservationUrl: string;
  fees: string;
}

export interface ParkHike {
  name: string;
  parkCode: string;
  distance: string;
  elevationGain: string;
  difficulty: 'Easy' | 'Moderate' | 'Strenuous' | 'Very Strenuous';
  duration: string;
  description: string;
  highlights: string[];
}

// Nearest airports to major national parks
const PARK_AIRPORTS: Record<string, { code: string; name: string; distance: string }> = {
  'yose': { code: 'FAT', name: 'Fresno Yosemite International', distance: '65 miles' },
  'grca': { code: 'FLG', name: 'Flagstaff Pulliam', distance: '80 miles' },
  'zion': { code: 'SGU', name: 'St. George Regional', distance: '46 miles' },
  'yell': { code: 'WYS', name: 'Yellowstone Airport', distance: '2 miles' },
  'glac': { code: 'FCA', name: 'Glacier Park International', distance: '30 miles' },
  'grte': { code: 'JAC', name: 'Jackson Hole Airport', distance: '10 miles' },
  'romo': { code: 'DEN', name: 'Denver International', distance: '80 miles' },
  'acad': { code: 'BHB', name: 'Bar Harbor Airport', distance: '12 miles' },
  'arch': { code: 'CNY', name: 'Canyonlands Field', distance: '18 miles' },
  'brca': { code: 'SGU', name: 'St. George Regional', distance: '126 miles' },
  'jotr': { code: 'PSP', name: 'Palm Springs International', distance: '45 miles' },
  'seki': { code: 'FAT', name: 'Fresno Yosemite International', distance: '55 miles' },
  'deva': { code: 'LAS', name: 'Las Vegas McCarran', distance: '130 miles' },
  'olym': { code: 'SEA', name: 'Seattle-Tacoma International', distance: '100 miles' },
  'havo': { code: 'ITO', name: 'Hilo International', distance: '30 miles' },
  'ever': { code: 'MIA', name: 'Miami International', distance: '50 miles' },
  'smok': { code: 'TYS', name: 'McGhee Tyson Airport', distance: '45 miles' },
  'bibe': { code: 'MAF', name: 'Midland International', distance: '230 miles' },
};

// Popular hikes with difficulty ratings
const PARK_HIKES: ParkHike[] = [
  // Yosemite
  { parkCode: 'yose', name: 'Half Dome', distance: '14-16 miles', elevationGain: '4,800 ft', difficulty: 'Very Strenuous', duration: '10-14 hours', description: 'Iconic granite dome with cable route', highlights: ['Cable climb', 'Valley views', 'Vernal & Nevada Falls'] },
  { parkCode: 'yose', name: 'Mist Trail to Vernal Fall', distance: '5.4 miles', elevationGain: '1,000 ft', difficulty: 'Moderate', duration: '3-4 hours', description: 'Classic waterfall hike with granite staircase', highlights: ['Vernal Fall', 'Rainbow views', 'Emerald Pool'] },
  { parkCode: 'yose', name: 'Mirror Lake Loop', distance: '5 miles', elevationGain: '100 ft', difficulty: 'Easy', duration: '2 hours', description: 'Flat loop with Half Dome reflections', highlights: ['Half Dome views', 'Wildlife', 'Peaceful lake'] },
  
  // Grand Canyon
  { parkCode: 'grca', name: 'Rim to Rim', distance: '21-24 miles', elevationGain: '5,761 ft', difficulty: 'Very Strenuous', duration: '2 days', description: 'Epic cross-canyon journey', highlights: ['Phantom Ranch', 'Colorado River', 'Both rims'] },
  { parkCode: 'grca', name: 'Bright Angel Trail', distance: '12 miles', elevationGain: '4,380 ft', difficulty: 'Strenuous', duration: '6-9 hours', description: 'Most popular corridor trail to river', highlights: ['Indian Garden', 'Rest houses', 'Colorado River'] },
  { parkCode: 'grca', name: 'South Kaibab to Ooh Aah Point', distance: '1.8 miles', elevationGain: '760 ft', difficulty: 'Moderate', duration: '1-2 hours', description: 'Stunning viewpoint hike', highlights: ['Panoramic views', 'Cedar Ridge', 'Photography'] },
  
  // Zion
  { parkCode: 'zion', name: 'Angels Landing', distance: '5.4 miles', elevationGain: '1,488 ft', difficulty: 'Strenuous', duration: '4-5 hours', description: 'Thrilling chain-assisted climb to summit', highlights: ['Chains section', '1,500 ft drop-offs', 'Canyon views'] },
  { parkCode: 'zion', name: 'The Narrows', distance: '9.4 miles', elevationGain: '334 ft', difficulty: 'Strenuous', duration: '6-8 hours', description: 'Wade through Virgin River slot canyon', highlights: ['Slot canyon', 'River hiking', 'Wall Street section'] },
  { parkCode: 'zion', name: 'Emerald Pools Trail', distance: '3 miles', elevationGain: '350 ft', difficulty: 'Easy', duration: '2-3 hours', description: 'Three-tiered waterfall pools', highlights: ['Waterfalls', 'Hanging gardens', 'Family-friendly'] },
  
  // Yellowstone
  { parkCode: 'yell', name: 'Grand Prismatic Overlook', distance: '1.6 miles', elevationGain: '200 ft', difficulty: 'Easy', duration: '1 hour', description: 'View of largest hot spring in US', highlights: ['Prismatic colors', 'Overlook platform', 'Thermal features'] },
  { parkCode: 'yell', name: 'Mount Washburn', distance: '6.4 miles', elevationGain: '1,400 ft', difficulty: 'Moderate', duration: '4-5 hours', description: 'Summit with 360° views', highlights: ['Fire lookout', 'Bighorn sheep', 'Wildflowers'] },
  { parkCode: 'yell', name: 'Uncle Toms Trail', distance: '0.7 miles', elevationGain: '500 ft', difficulty: 'Moderate', duration: '1 hour', description: '328 steel stairs to Lower Falls', highlights: ['Yellowstone Falls', 'Canyon views', 'Mist spray'] },
  
  // Rocky Mountain
  { parkCode: 'romo', name: 'Longs Peak', distance: '14.5 miles', elevationGain: '4,850 ft', difficulty: 'Very Strenuous', duration: '10-15 hours', description: 'Colorado 14er with Keyhole Route', highlights: ['14,259 ft summit', 'Keyhole', 'Alpine tundra'] },
  { parkCode: 'romo', name: 'Sky Pond', distance: '9 miles', elevationGain: '1,660 ft', difficulty: 'Strenuous', duration: '5-7 hours', description: 'Alpine lake beneath cathedral spires', highlights: ['Timberline Falls', 'Lake of Glass', 'The Loch'] },
  { parkCode: 'romo', name: 'Bear Lake Loop', distance: '0.8 miles', elevationGain: '20 ft', difficulty: 'Easy', duration: '30 min', description: 'Accessible alpine lake loop', highlights: ['Mountain reflections', 'Accessible', 'Wildlife'] },
  
  // Glacier
  { parkCode: 'glac', name: 'Highline Trail', distance: '11.8 miles', elevationGain: '830 ft', difficulty: 'Moderate', duration: '5-7 hours', description: 'Cliff-hugging trail along Continental Divide', highlights: ['Logan Pass', 'Mountain goats', 'Grinnell Overlook'] },
  { parkCode: 'glac', name: 'Grinnell Glacier', distance: '11 miles', elevationGain: '1,840 ft', difficulty: 'Strenuous', duration: '6-8 hours', description: 'Hike to active glacier', highlights: ['Glacial lake', 'Waterfalls', 'Bighorn sheep'] },
  { parkCode: 'glac', name: 'Trail of the Cedars', distance: '0.7 miles', elevationGain: '10 ft', difficulty: 'Easy', duration: '30 min', description: 'Accessible boardwalk through ancient cedars', highlights: ['Old growth forest', 'Accessible', 'Avalanche Creek'] },
  
  // Acadia
  { parkCode: 'acad', name: 'Precipice Trail', distance: '1.6 miles', elevationGain: '1,000 ft', difficulty: 'Very Strenuous', duration: '2-3 hours', description: 'Iron rungs and ladders up cliff face', highlights: ['Iron ladders', 'Exposure', 'Champlain summit'] },
  { parkCode: 'acad', name: 'Cadillac Mountain Summit', distance: '4.4 miles', elevationGain: '1,530 ft', difficulty: 'Moderate', duration: '3-4 hours', description: 'Highest point on Atlantic coast', highlights: ['Sunrise views', 'First US sunrise', '360° views'] },
  { parkCode: 'acad', name: 'Jordan Pond Path', distance: '3.3 miles', elevationGain: '100 ft', difficulty: 'Easy', duration: '1.5 hours', description: 'Loop around crystal-clear pond', highlights: ['The Bubbles', 'Popovers at Jordan Pond House', 'Reflections'] },
];

export class NationalParksAdapter extends BaseAdapter {
  name = 'nps';
  private apiKey: string;
  private baseUrl = 'https://developer.nps.gov/api/v1';

  constructor(apiKey?: string) {
    super();
    this.apiKey = apiKey || process.env.NPS_API_KEY || '';
    this.cacheTTL = 60 * 60 * 1000; // 1 hour cache for park data
  }

  async searchParks(query: string): Promise<NationalPark[]> {
    const cacheKey = this.generateCacheKey('nps-parks-search', { query });

    return this.fetchWithCache(cacheKey, async () => {
      if (!this.apiKey) {
        throw new Error('NPS API key not configured. Get one free at https://www.nps.gov/subjects/developer/get-started.htm');
      }

      const response = await fetch(
        `${this.baseUrl}/parks?q=${encodeURIComponent(query)}&limit=10&api_key=${this.apiKey}`
      );

      if (!response.ok) {
        throw new Error(`NPS API error: ${response.status}`);
      }

      const data = await response.json() as NPSParkResponse;
      return data.data.map(park => this.transformPark(park));
    });
  }

  async getParkByCode(parkCode: string): Promise<NationalPark | null> {
    const cacheKey = this.generateCacheKey('nps-park', { parkCode });

    return this.fetchWithCache(cacheKey, async () => {
      if (!this.apiKey) {
        throw new Error('NPS API key not configured.');
      }

      const response = await fetch(
        `${this.baseUrl}/parks?parkCode=${parkCode}&api_key=${this.apiKey}`
      );

      if (!response.ok) {
        throw new Error(`NPS API error: ${response.status}`);
      }

      const data = await response.json() as NPSParkResponse;
      if (data.data.length === 0) return null;
      return this.transformPark(data.data[0]);
    });
  }

  async getThingsToDo(parkCode: string): Promise<ParkActivity[]> {
    const cacheKey = this.generateCacheKey('nps-thingstodo', { parkCode });

    return this.fetchWithCache(cacheKey, async () => {
      if (!this.apiKey) {
        throw new Error('NPS API key not configured.');
      }

      const response = await fetch(
        `${this.baseUrl}/thingstodo?parkCode=${parkCode}&limit=20&api_key=${this.apiKey}`
      );

      if (!response.ok) {
        throw new Error(`NPS API error: ${response.status}`);
      }

      const data = await response.json() as NPSThingsToDoResponse;
      return data.data.map(item => ({
        id: item.id,
        title: item.title,
        description: item.shortDescription || item.longDescription?.substring(0, 200) || '',
        duration: item.durationDescription || item.duration || 'Varies',
        season: item.season || [],
        requiresReservation: item.isReservationRequired === 'true',
        hasFees: item.doFeesApply === 'true',
        url: item.url,
      }));
    });
  }

  async getCampgrounds(parkCode: string): Promise<ParkCampground[]> {
    const cacheKey = this.generateCacheKey('nps-campgrounds', { parkCode });

    return this.fetchWithCache(cacheKey, async () => {
      if (!this.apiKey) {
        throw new Error('NPS API key not configured.');
      }

      const response = await fetch(
        `${this.baseUrl}/campgrounds?parkCode=${parkCode}&limit=20&api_key=${this.apiKey}`
      );

      if (!response.ok) {
        throw new Error(`NPS API error: ${response.status}`);
      }

      const data = await response.json() as NPSCampgroundResponse;
      return data.data.map(camp => ({
        id: camp.id,
        name: camp.name,
        description: camp.description?.substring(0, 200) || '',
        coordinates: {
          latitude: parseFloat(camp.latitude) || 0,
          longitude: parseFloat(camp.longitude) || 0,
        },
        totalSites: (parseInt(camp.numberOfSitesReservable) || 0) + (parseInt(camp.numberOfSitesFirstComeFirstServe) || 0),
        reservableSites: parseInt(camp.numberOfSitesReservable) || 0,
        firstComeFirstServe: parseInt(camp.numberOfSitesFirstComeFirstServe) || 0,
        reservationUrl: camp.reservationUrl || 'https://www.recreation.gov',
        fees: camp.fees?.[0]?.cost ? `$${camp.fees[0].cost}` : 'Free',
      }));
    });
  }

  getHikes(parkCode: string): ParkHike[] {
    return PARK_HIKES.filter(hike => hike.parkCode === parkCode.toLowerCase());
  }

  getAllHikes(): ParkHike[] {
    return PARK_HIKES;
  }

  getNearestAirport(parkCode: string): { code: string; name: string; distance: string } | null {
    return PARK_AIRPORTS[parkCode.toLowerCase()] || null;
  }

  private transformPark(park: NPSPark): NationalPark {
    const physicalAddress = park.addresses?.find(a => a.type === 'Physical') || park.addresses?.[0];
    const airport = PARK_AIRPORTS[park.parkCode.toLowerCase()];

    return {
      id: park.id,
      parkCode: park.parkCode,
      name: park.fullName,
      description: park.description,
      states: park.states.split(','),
      coordinates: {
        latitude: parseFloat(park.latitude) || 0,
        longitude: parseFloat(park.longitude) || 0,
      },
      nearestAirport: airport || { code: 'N/A', name: 'See regional airports', distance: 'Varies' },
      entranceFee: park.entranceFees?.[0]?.cost ? `$${park.entranceFees[0].cost}` : 'Free',
      activities: park.activities?.map(a => a.name) || [],
      images: park.images?.map(i => i.url) || [],
      url: park.url,
      address: physicalAddress ? `${physicalAddress.line1}, ${physicalAddress.city}, ${physicalAddress.stateCode} ${physicalAddress.postalCode}` : '',
      // Gateway city from NPS physical address for restaurant searches
      gatewayCity: physicalAddress?.city,
      gatewayState: physicalAddress?.stateCode,
    };
  }
}
