import { BaseAdapter } from '../base/BaseAdapter.js';

// OpenStreetMap Overpass API response types
interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  version: number;
  generator: string;
  elements: OverpassElement[];
}

// Output types
export interface OSMCampground {
  id: string;
  name: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  type: 'campsite' | 'caravan_site' | 'camp_pitch';
  amenities: {
    tents: boolean;
    caravans: boolean;
    toilets: boolean;
    showers: boolean;
    drinkingWater: boolean;
    electricity: boolean;
    wifi: boolean;
    firepit: boolean;
    picnicTable: boolean;
    dogs: boolean;
  };
  capacity?: number;
  fee?: boolean;
  website?: string;
  phone?: string;
  operator?: string;
  openingHours?: string;
  description?: string;
}

export interface OSMSearchParams {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  includeCaravanSites?: boolean;
}

export interface BoundingBoxParams {
  south: number;
  west: number;
  north: number;
  east: number;
}

export class OpenStreetMapAdapter extends BaseAdapter {
  name = 'openstreetmap';
  private overpassUrl = 'https://overpass-api.de/api/interpreter';

  constructor() {
    super();
    this.cacheTTL = 24 * 60 * 60 * 1000; // 24 hour cache (OSM data doesn't change frequently)
  }

  /**
   * Search for campgrounds near a location
   */
  async searchCampgroundsNearby(params: OSMSearchParams): Promise<OSMCampground[]> {
    const { latitude, longitude, radiusKm = 50, includeCaravanSites = true } = params;
    const cacheKey = this.generateCacheKey('osm-nearby', params);

    return this.fetchWithCache(cacheKey, async () => {
      // Build Overpass QL query
      const radiusMeters = radiusKm * 1000;
      const types = includeCaravanSites 
        ? '["tourism"~"camp_site|caravan_site"]'
        : '["tourism"="camp_site"]';

      const query = `
        [out:json][timeout:30];
        (
          node${types}(around:${radiusMeters},${latitude},${longitude});
          way${types}(around:${radiusMeters},${latitude},${longitude});
        );
        out center tags;
      `;

      return this.executeQuery(query);
    });
  }

  /**
   * Search for campgrounds within a bounding box
   */
  async searchCampgroundsInBounds(bounds: BoundingBoxParams): Promise<OSMCampground[]> {
    const cacheKey = this.generateCacheKey('osm-bounds', bounds);

    return this.fetchWithCache(cacheKey, async () => {
      const { south, west, north, east } = bounds;
      const bbox = `${south},${west},${north},${east}`;

      const query = `
        [out:json][timeout:30];
        (
          node["tourism"~"camp_site|caravan_site"](${bbox});
          way["tourism"~"camp_site|caravan_site"](${bbox});
        );
        out center tags;
      `;

      return this.executeQuery(query);
    });
  }

  /**
   * Search campgrounds by state (uses state bounding boxes)
   */
  async getCampgroundsByState(stateCode: string, limit = 100): Promise<OSMCampground[]> {
    const bounds = STATE_BOUNDING_BOXES[stateCode.toUpperCase()];
    if (!bounds) {
      console.warn(`No bounding box defined for state: ${stateCode}`);
      return [];
    }

    const campgrounds = await this.searchCampgroundsInBounds(bounds);
    return campgrounds.slice(0, limit);
  }

  /**
   * Execute an Overpass API query
   */
  private async executeQuery(query: string): Promise<OSMCampground[]> {
    try {
      const response = await fetch(this.overpassUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.warn('Overpass API rate limited - try again later');
        }
        throw new Error(`Overpass API error: ${response.status}`);
      }

      const data = await response.json() as OverpassResponse;
      return data.elements
        .filter(el => el.tags?.name || el.tags?.tourism) // Filter elements with useful data
        .map(el => this.transformElement(el));
    } catch (error) {
      console.error('OpenStreetMap Overpass API error:', error);
      return [];
    }
  }

  /**
   * Transform an Overpass element to our campground type
   */
  private transformElement(element: OverpassElement): OSMCampground {
    const tags = element.tags || {};
    
    // Get coordinates (nodes have lat/lon, ways have center)
    const lat = element.lat ?? element.center?.lat ?? 0;
    const lon = element.lon ?? element.center?.lon ?? 0;

    // Determine campground type
    let type: OSMCampground['type'] = 'campsite';
    if (tags.tourism === 'caravan_site') {
      type = 'caravan_site';
    } else if (tags.camp_site === 'pitch') {
      type = 'camp_pitch';
    }

    // Parse amenities from tags
    const amenities = {
      tents: tags.tents === 'yes' || tags.tourism === 'camp_site',
      caravans: tags.caravans === 'yes' || tags.tourism === 'caravan_site',
      toilets: tags.toilets === 'yes' || tags['amenity:toilets'] === 'yes',
      showers: tags.shower === 'yes' || tags.showers === 'yes',
      drinkingWater: tags.drinking_water === 'yes' || tags['water:drinking'] === 'yes',
      electricity: tags.power_supply === 'yes' || tags.electricity === 'yes',
      wifi: tags.internet_access === 'yes' || tags.internet_access === 'wlan',
      firepit: tags.fireplace === 'yes' || tags.bbq === 'yes' || tags.fire_pit === 'yes',
      picnicTable: tags.picnic_table === 'yes',
      dogs: tags.dog === 'yes' || tags.dogs === 'yes',
    };

    // Parse capacity
    let capacity: number | undefined;
    if (tags.capacity) {
      capacity = parseInt(tags.capacity, 10);
      if (isNaN(capacity)) capacity = undefined;
    }

    // Parse fee
    const fee = tags.fee === 'yes' || tags.fee === 'true';

    return {
      id: `osm-${element.type}-${element.id}`,
      name: tags.name || tags['name:en'] || 'Unnamed Campground',
      coordinates: {
        latitude: lat,
        longitude: lon,
      },
      type,
      amenities,
      capacity,
      fee: tags.fee ? fee : undefined,
      website: tags.website || tags['contact:website'] || tags.url,
      phone: tags.phone || tags['contact:phone'],
      operator: tags.operator,
      openingHours: tags.opening_hours,
      description: tags.description || tags.note,
    };
  }

  /**
   * Check if adapter is ready (always true - no API key needed)
   */
  isConfigured(): boolean {
    return true;
  }
}

// State bounding boxes (approximate) for querying
const STATE_BOUNDING_BOXES: Record<string, BoundingBoxParams> = {
  AL: { south: 30.22, west: -88.47, north: 35.01, east: -84.89 },
  AK: { south: 51.21, west: -179.15, north: 71.39, east: -129.98 },
  AZ: { south: 31.33, west: -114.82, north: 37.00, east: -109.05 },
  AR: { south: 33.00, west: -94.62, north: 36.50, east: -89.64 },
  CA: { south: 32.53, west: -124.42, north: 42.01, east: -114.13 },
  CO: { south: 36.99, west: -109.06, north: 41.00, east: -102.04 },
  CT: { south: 40.95, west: -73.73, north: 42.05, east: -71.79 },
  DE: { south: 38.45, west: -75.79, north: 39.84, east: -75.05 },
  FL: { south: 24.40, west: -87.63, north: 31.00, east: -80.03 },
  GA: { south: 30.36, west: -85.61, north: 35.00, east: -80.84 },
  HI: { south: 18.91, west: -160.25, north: 22.24, east: -154.81 },
  ID: { south: 41.99, west: -117.24, north: 49.00, east: -111.04 },
  IL: { south: 36.97, west: -91.51, north: 42.51, east: -87.02 },
  IN: { south: 37.77, west: -88.10, north: 41.76, east: -84.78 },
  IA: { south: 40.38, west: -96.64, north: 43.50, east: -90.14 },
  KS: { south: 36.99, west: -102.05, north: 40.00, east: -94.59 },
  KY: { south: 36.50, west: -89.57, north: 39.15, east: -81.96 },
  LA: { south: 28.93, west: -94.04, north: 33.02, east: -88.82 },
  ME: { south: 42.98, west: -71.08, north: 47.46, east: -66.95 },
  MD: { south: 37.91, west: -79.49, north: 39.72, east: -75.05 },
  MA: { south: 41.24, west: -73.50, north: 42.89, east: -69.93 },
  MI: { south: 41.70, west: -90.42, north: 48.19, east: -82.42 },
  MN: { south: 43.50, west: -97.24, north: 49.38, east: -89.49 },
  MS: { south: 30.17, west: -91.66, north: 35.00, east: -88.10 },
  MO: { south: 35.99, west: -95.77, north: 40.61, east: -89.10 },
  MT: { south: 44.36, west: -116.05, north: 49.00, east: -104.04 },
  NE: { south: 40.00, west: -104.05, north: 43.00, east: -95.31 },
  NV: { south: 35.00, west: -120.01, north: 42.00, east: -114.04 },
  NH: { south: 42.70, west: -72.56, north: 45.31, east: -70.70 },
  NJ: { south: 38.93, west: -75.56, north: 41.36, east: -73.89 },
  NM: { south: 31.33, west: -109.05, north: 37.00, east: -103.00 },
  NY: { south: 40.50, west: -79.76, north: 45.02, east: -71.86 },
  NC: { south: 33.84, west: -84.32, north: 36.59, east: -75.46 },
  ND: { south: 45.94, west: -104.05, north: 49.00, east: -96.55 },
  OH: { south: 38.40, west: -84.82, north: 42.32, east: -80.52 },
  OK: { south: 33.62, west: -103.00, north: 37.00, east: -94.43 },
  OR: { south: 41.99, west: -124.57, north: 46.29, east: -116.46 },
  PA: { south: 39.72, west: -80.52, north: 42.27, east: -74.69 },
  RI: { south: 41.15, west: -71.86, north: 42.02, east: -71.12 },
  SC: { south: 32.03, west: -83.35, north: 35.22, east: -78.54 },
  SD: { south: 42.48, west: -104.06, north: 45.95, east: -96.44 },
  TN: { south: 34.98, west: -90.31, north: 36.68, east: -81.65 },
  TX: { south: 25.84, west: -106.65, north: 36.50, east: -93.51 },
  UT: { south: 36.99, west: -114.05, north: 42.00, east: -109.04 },
  VT: { south: 42.73, west: -73.44, north: 45.02, east: -71.47 },
  VA: { south: 36.54, west: -83.68, north: 39.47, east: -75.24 },
  WA: { south: 45.54, west: -124.85, north: 49.00, east: -116.92 },
  WV: { south: 37.20, west: -82.64, north: 40.64, east: -77.72 },
  WI: { south: 42.49, west: -92.89, north: 47.08, east: -86.25 },
  WY: { south: 40.99, west: -111.06, north: 45.01, east: -104.05 },
};
