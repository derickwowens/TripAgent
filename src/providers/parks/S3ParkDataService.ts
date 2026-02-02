/**
 * S3 Park Data Service
 * 
 * Provides access to the authoritative S3 park database.
 * This service fetches park data from our S3 bucket which contains
 * normalized data for 550+ sites including:
 * - 474 NPS sites (parks, monuments, historic sites, memorials)
 * - 76+ state parks (WI, FL, and growing)
 * 
 * The S3 data is the single source of truth for park information.
 */

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

const S3_BUCKET = process.env.PARK_DATA_S3_BUCKET || 'tripagent-park-data';
const S3_REGION = process.env.AWS_REGION || 'us-east-1';
const S3_BASE_URL = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`;

// Cache for frequently accessed data
const cache: Map<string, { data: any; timestamp: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface ParkSummary {
  id: string;
  name: string;
  parkCode?: string;
  stateCode: string;
  stateName: string;
  coordinates: { latitude: number; longitude: number };
  designation?: string;
  category?: 'national' | 'state' | 'local';
  parkType?: string;
  imageUrl?: string;
}

interface ParkDetails {
  id: string;
  name: string;
  category: 'national' | 'state' | 'local';
  parkType: string;
  stateCode: string;
  stateName: string;
  region?: string;
  description?: string;
  shortDescription?: string;
  designation?: string;
  highlights?: string[];
  coordinates: { latitude: number; longitude: number };
  acres?: number;
  timezone?: string;
  officialLinks?: Array<{
    type: string;
    url: string;
    isPrimary?: boolean;
  }>;
  contact?: {
    phone?: string;
    email?: string;
    website?: string;
    address?: {
      line1?: string;
      city?: string;
      state?: string;
      postalCode?: string;
    };
  };
  operatingHours?: Record<string, string>;
  fees?: Array<{
    title: string;
    cost: string;
    description?: string;
  }>;
  climate?: {
    weatherDescription?: string;
  };
  images?: Array<{
    id: string;
    url: string;
    title?: string;
    caption?: string;
    credit?: string;
    isPrimary?: boolean;
  }>;
  activities?: Array<{
    id: string;
    name: string;
  }>;
  trails?: Array<{
    id: string;
    name: string;
    lengthMiles?: number;
    difficulty?: string;
  }>;
  campgrounds?: Array<{
    id: string;
    name: string;
    totalSites?: number;
  }>;
  nationalParkInfo?: {
    parkCode: string;
    npsId?: string;
    region?: string;
  };
  stateParkInfo?: {
    stateSystemId?: string;
    managingAgency?: string;
  };
  quickLinks?: {
    officialWebsite?: string;
    reservations?: string;
    map?: string;
    directions?: string;
  };
  keywords?: string[];
}

interface MasterIndex {
  lastUpdated: string;
  schemaVersion: string;
  nationalParks: {
    totalParks: number;
    indexUrl: string;
    lastSynced: string;
  };
  stateParks: Record<string, {
    stateCode: string;
    stateName: string;
    totalParks: number;
    indexUrl: string;
    lastSynced: string;
  }>;
  statistics: {
    totalParks: number;
    totalPhotos: number;
    lastFullSync: string;
  };
}

interface NationalParkIndex {
  totalParks: number;
  lastSynced: string;
  parks: ParkSummary[];
}

interface StateParkIndex {
  stateCode: string;
  stateName: string;
  totalParks: number;
  lastSynced: string;
  parks: ParkSummary[];
}

export class S3ParkDataService {
  private s3Client: S3Client | null = null;
  private usePublicUrls: boolean = true;
  
  constructor() {
    // Try to initialize S3 client if credentials are available
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      this.s3Client = new S3Client({
        region: S3_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });
      this.usePublicUrls = false;
    }
  }
  
  private async fetchJson<T>(key: string): Promise<T | null> {
    // Check cache first
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data as T;
    }
    
    try {
      let data: any;
      
      if (this.usePublicUrls || !this.s3Client) {
        // Fetch from public URL
        const url = `${S3_BASE_URL}/${key}`;
        const response = await fetch(url);
        if (!response.ok) {
          console.log(`[S3ParkData] Failed to fetch ${key}: ${response.status}`);
          return null;
        }
        data = await response.json();
      } else {
        // Fetch via S3 client
        const command = new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
        });
        const response = await this.s3Client.send(command);
        const body = await response.Body?.transformToString();
        if (!body) return null;
        data = JSON.parse(body);
      }
      
      // Cache the result
      cache.set(key, { data, timestamp: Date.now() });
      return data as T;
      
    } catch (error: any) {
      console.error(`[S3ParkData] Error fetching ${key}: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Get the master index with all available park data
   */
  async getMasterIndex(): Promise<MasterIndex | null> {
    return this.fetchJson<MasterIndex>('index.json');
  }
  
  /**
   * Get the national parks index (all 474 NPS sites)
   */
  async getNationalParksIndex(): Promise<NationalParkIndex | null> {
    return this.fetchJson<NationalParkIndex>('national-parks/index.json');
  }
  
  /**
   * Get state parks index for a specific state
   */
  async getStateParksIndex(stateCode: string): Promise<StateParkIndex | null> {
    return this.fetchJson<StateParkIndex>(`state-parks/${stateCode.toUpperCase()}/index.json`);
  }
  
  /**
   * Get detailed park data by ID
   * @param parkId - Park ID like "np-yell" or "wi-devilslake"
   */
  async getParkById(parkId: string): Promise<ParkDetails | null> {
    // Determine if national or state park
    if (parkId.startsWith('np-')) {
      return this.fetchJson<ParkDetails>(`national-parks/parks/${parkId}.json`);
    } else {
      // Extract state code from ID (e.g., "wi-devilslake" -> "WI")
      const stateCode = parkId.split('-')[0].toUpperCase();
      return this.fetchJson<ParkDetails>(`state-parks/${stateCode}/parks/${parkId}.json`);
    }
  }
  
  /**
   * Get park by NPS park code (e.g., "yell" for Yellowstone)
   */
  async getParkByCode(parkCode: string): Promise<ParkDetails | null> {
    return this.getParkById(`np-${parkCode.toLowerCase()}`);
  }
  
  /**
   * Search parks by name or keyword
   */
  async searchParks(query: string, options?: {
    category?: 'national' | 'state' | 'all';
    stateCode?: string;
    limit?: number;
  }): Promise<ParkSummary[]> {
    const { category = 'all', stateCode, limit = 10 } = options || {};
    const queryLower = query.toLowerCase();
    const results: ParkSummary[] = [];
    
    // Search national parks
    if (category === 'all' || category === 'national') {
      const npIndex = await this.getNationalParksIndex();
      if (npIndex) {
        const matches = npIndex.parks.filter(p => {
          const nameMatch = p.name.toLowerCase().includes(queryLower);
          const codeMatch = p.parkCode?.toLowerCase() === queryLower;
          const stateMatch = !stateCode || p.stateCode === stateCode.toUpperCase();
          return (nameMatch || codeMatch) && stateMatch;
        });
        results.push(...matches.map(p => ({ ...p, category: 'national' as const })));
      }
    }
    
    // Search state parks
    if (category === 'all' || category === 'state') {
      const masterIndex = await this.getMasterIndex();
      if (masterIndex) {
        const statesToSearch = stateCode 
          ? [stateCode.toUpperCase()]
          : Object.keys(masterIndex.stateParks);
        
        for (const state of statesToSearch) {
          const stateIndex = await this.getStateParksIndex(state);
          if (stateIndex) {
            const matches = stateIndex.parks.filter(p => 
              p.name.toLowerCase().includes(queryLower)
            );
            results.push(...matches.map(p => ({ ...p, category: 'state' as const })));
          }
        }
      }
    }
    
    // Sort by relevance (exact matches first)
    results.sort((a, b) => {
      const aExact = a.name.toLowerCase() === queryLower ? 0 : 1;
      const bExact = b.name.toLowerCase() === queryLower ? 0 : 1;
      return aExact - bExact;
    });
    
    return results.slice(0, limit);
  }
  
  /**
   * Get parks near a location
   */
  async getParksNearLocation(
    latitude: number,
    longitude: number,
    radiusMiles: number = 50,
    options?: { category?: 'national' | 'state' | 'all'; limit?: number }
  ): Promise<Array<ParkSummary & { distanceMiles: number }>> {
    const { category = 'all', limit = 10 } = options || {};
    const results: Array<ParkSummary & { distanceMiles: number }> = [];
    
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 3959; // Earth's radius in miles
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };
    
    // Search national parks
    if (category === 'all' || category === 'national') {
      const npIndex = await this.getNationalParksIndex();
      if (npIndex) {
        for (const park of npIndex.parks) {
          if (park.coordinates.latitude && park.coordinates.longitude) {
            const distance = calculateDistance(
              latitude, longitude,
              park.coordinates.latitude, park.coordinates.longitude
            );
            if (distance <= radiusMiles) {
              results.push({
                ...park,
                category: 'national',
                distanceMiles: Math.round(distance * 10) / 10,
              });
            }
          }
        }
      }
    }
    
    // Search state parks
    if (category === 'all' || category === 'state') {
      const masterIndex = await this.getMasterIndex();
      if (masterIndex) {
        for (const stateCode of Object.keys(masterIndex.stateParks)) {
          const stateIndex = await this.getStateParksIndex(stateCode);
          if (stateIndex) {
            for (const park of stateIndex.parks) {
              if (park.coordinates.latitude && park.coordinates.longitude) {
                const distance = calculateDistance(
                  latitude, longitude,
                  park.coordinates.latitude, park.coordinates.longitude
                );
                if (distance <= radiusMiles) {
                  results.push({
                    ...park,
                    category: 'state',
                    distanceMiles: Math.round(distance * 10) / 10,
                  });
                }
              }
            }
          }
        }
      }
    }
    
    // Sort by distance
    results.sort((a, b) => a.distanceMiles - b.distanceMiles);
    
    return results.slice(0, limit);
  }
  
  /**
   * Get all parks in a state (both national and state parks)
   */
  async getParksInState(stateCode: string): Promise<{
    national: ParkSummary[];
    state: ParkSummary[];
  }> {
    const result: { national: ParkSummary[]; state: ParkSummary[] } = {
      national: [],
      state: [],
    };
    
    // Get national parks in state
    const npIndex = await this.getNationalParksIndex();
    if (npIndex) {
      result.national = npIndex.parks.filter(p => 
        p.stateCode === stateCode.toUpperCase()
      );
    }
    
    // Get state parks
    const stateIndex = await this.getStateParksIndex(stateCode);
    if (stateIndex) {
      result.state = stateIndex.parks;
    }
    
    return result;
  }
  
  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalParks: number;
    nationalParks: number;
    stateParks: number;
    statesWithData: string[];
    lastUpdated: string;
  } | null> {
    const masterIndex = await this.getMasterIndex();
    if (!masterIndex) return null;
    
    return {
      totalParks: masterIndex.statistics.totalParks,
      nationalParks: masterIndex.nationalParks.totalParks,
      stateParks: Object.values(masterIndex.stateParks).reduce((sum, s) => sum + s.totalParks, 0),
      statesWithData: Object.keys(masterIndex.stateParks),
      lastUpdated: masterIndex.lastUpdated,
    };
  }
  
  /**
   * Build context string for Claude with park information
   */
  async buildParkContext(parkId: string): Promise<string | null> {
    const park = await this.getParkById(parkId);
    if (!park) return null;
    
    const lines: string[] = [
      `## ${park.name}`,
      `**Category:** ${park.category === 'national' ? 'National Park Service' : 'State Park'}`,
      `**Type:** ${park.designation || park.parkType}`,
      `**Location:** ${park.stateName} (${park.stateCode})`,
    ];
    
    if (park.coordinates.latitude && park.coordinates.longitude) {
      lines.push(`**Coordinates:** ${park.coordinates.latitude}, ${park.coordinates.longitude}`);
    }
    
    if (park.description) {
      lines.push('', `**Description:** ${park.description}`);
    }
    
    if (park.highlights && park.highlights.length > 0) {
      lines.push('', `**Highlights:** ${park.highlights.join(', ')}`);
    }
    
    if (park.quickLinks?.officialWebsite) {
      lines.push('', `**Official Website:** ${park.quickLinks.officialWebsite}`);
    }
    
    if (park.quickLinks?.reservations) {
      lines.push(`**Reservations:** ${park.quickLinks.reservations}`);
    }
    
    if (park.fees && park.fees.length > 0) {
      lines.push('', '**Entrance Fees:**');
      park.fees.slice(0, 3).forEach(fee => {
        lines.push(`- ${fee.title}: $${fee.cost}`);
      });
    }
    
    if (park.activities && park.activities.length > 0) {
      lines.push('', `**Activities:** ${park.activities.slice(0, 10).map(a => a.name).join(', ')}`);
    }
    
    if (park.climate?.weatherDescription) {
      lines.push('', `**Weather:** ${park.climate.weatherDescription.slice(0, 200)}...`);
    }
    
    return lines.join('\n');
  }
  
  /**
   * Get trails for a national park from S3
   * Priority: NPS API data (official URLs) > curated data
   */
  async getTrailsForPark(parkCode: string): Promise<TrailData[]> {
    console.log(`[S3 Trails] Fetching trails for park: ${parkCode}`);
    
    // Try NPS API data first (has official nps.gov URLs)
    const npsData = await this.fetchJson<NPSTrailsIndex>('trails/api-trails.json');
    if (npsData?.nationalParks?.[parkCode.toLowerCase()]) {
      const parkData = npsData.nationalParks[parkCode.toLowerCase()];
      console.log(`[S3 Trails] Found ${parkData.trails.length} NPS API trails for ${parkCode}`);
      
      return parkData.trails.map(t => ({
        name: t.name,
        description: t.description,
        duration: t.duration,
        npsUrl: t.npsUrl,
        trailUrl: t.npsUrl, // NPS URL is primary
        imageUrl: t.imageUrl,
        parkCode: parkCode.toLowerCase(),
        parkName: parkData.parkName,
        source: 'NPS API',
      }));
    }
    
    // Fall back to curated data
    const trailsIndex = await this.fetchJson<TrailsIndex>('trails/all-parks-trails.json');
    if (!trailsIndex || !trailsIndex.parks[parkCode.toLowerCase()]) {
      console.log(`[S3 Trails] No trails found for ${parkCode}`);
      return [];
    }
    
    const parkTrails = trailsIndex.parks[parkCode.toLowerCase()];
    console.log(`[S3 Trails] Found ${parkTrails.trails.length} curated trails for ${parkCode}`);
    
    return parkTrails.trails.map(t => ({
      ...t,
      // AllTrails URLs deprecated - let caller generate Google Maps fallback
      trailUrl: undefined,
      needsEnrichment: true,
      parkCode: parkCode.toLowerCase(),
      parkName: parkTrails.parkName,
      source: 'Curated',
    }));
  }
  
  /**
   * Get trails for a state park from S3
   * Reads from trails/state-parks/{STATE}/trails.json (authoritative source)
   */
  async getTrailsForStatePark(stateCode: 'WI' | 'FL', parkId: string): Promise<TrailData[]> {
    const stateTrails = await this.fetchStateTrailsData(stateCode);
    if (!stateTrails?.parks?.[parkId]) {
      // Fallback to old path for backward compatibility
      const trailsIndex = await this.fetchJson<TrailsIndex>('trails/all-parks-trails.json');
      if (!trailsIndex?.stateParks?.[stateCode]?.[parkId]) {
        return [];
      }
      const parkTrails = trailsIndex.stateParks[stateCode][parkId];
      return parkTrails.trails.map(t => ({
        ...t,
        parkCode: parkId,
        parkName: parkTrails.parkName,
      }));
    }
    
    const parkData = stateTrails.parks[parkId];
    return parkData.trails.map(t => this.mapStateTrailToTrailData(t, parkId, parkData.parkName));
  }

  /**
   * Get state-wide trails (Wisconsin State Trails, Florida State Trails)
   * These are longer multi-use trails that span regions
   */
  async getStateTrails(stateCode: 'WI' | 'FL'): Promise<TrailData[]> {
    const stateTrailsKey = stateCode === 'WI' ? 'wi-state-trails' : 'fl-state-trails';
    const stateTrails = await this.fetchStateTrailsData(stateCode);
    
    if (!stateTrails?.parks?.[stateTrailsKey]) {
      return [];
    }
    
    const parkData = stateTrails.parks[stateTrailsKey];
    return parkData.trails.map(t => this.mapStateTrailToTrailData(t, stateTrailsKey, parkData.parkName));
  }

  /**
   * Get nearby state trails for a given state park
   * Returns trails from the state trails category that pass near the park
   */
  async getNearbyStateTrails(stateCode: 'WI' | 'FL', parkId: string): Promise<TrailData[]> {
    const stateTrailsKey = stateCode === 'WI' ? 'wi-state-trails' : 'fl-state-trails';
    const stateTrails = await this.fetchStateTrailsData(stateCode);
    
    if (!stateTrails?.parks?.[stateTrailsKey]) {
      return [];
    }
    
    const stateTrailsPark = stateTrails.parks[stateTrailsKey];
    const nearbyTrails: TrailData[] = [];
    
    for (const trail of stateTrailsPark.trails) {
      // Check if this trail has the current park in its nearbyParks
      if (trail.nearbyParks?.some(np => np.parkId === parkId)) {
        nearbyTrails.push(this.mapStateTrailToTrailData(trail, stateTrailsKey, stateTrailsPark.parkName));
      }
    }
    
    return nearbyTrails;
  }

  /**
   * Internal: Fetch and cache state trails data
   */
  private async fetchStateTrailsData(stateCode: 'WI' | 'FL'): Promise<StateTrailsData | null> {
    return this.fetchJson<StateTrailsData>(`trails/state-parks/${stateCode}/trails.json`);
  }

  /**
   * Internal: Map state trail data to TrailData format
   */
  private mapStateTrailToTrailData(
    t: StateTrailsData['parks'][string]['trails'][number],
    parkId: string,
    parkName: string
  ): TrailData {
    // URL priority: official > AllTrails > Google Maps
    const trailUrl = t.officialUrl || (t as any).allTrailsUrl || t.googleMapsUrl;
    
    return {
      name: t.name,
      description: t.description,
      length: t.lengthMiles ? `${t.lengthMiles} miles` : undefined,
      difficulty: t.difficulty,
      type: t.trailType,
      trailUrl: trailUrl,
      alltrailsUrl: (t as any).allTrailsUrl,
      googleMapsUrl: t.googleMapsUrl,
      parkCode: parkId,
      parkName: parkName,
      source: t.dataSource,
      nearbyParks: t.nearbyParks,
    };
  }
  
  /**
   * Get a specific trail by name (since we no longer have IDs)
   */
  async getTrailByName(trailName: string, parkCode?: string): Promise<TrailData | null> {
    const trailsIndex = await this.fetchJson<TrailsIndex>('trails/all-parks-trails.json');
    if (!trailsIndex) return null;
    
    const nameLower = trailName.toLowerCase();
    
    // Search national parks
    for (const [code, parkData] of Object.entries(trailsIndex.parks)) {
      if (parkCode && code !== parkCode.toLowerCase()) continue;
      const trail = parkData.trails.find(t => t.name.toLowerCase() === nameLower);
      if (trail) {
        return {
          ...trail,
          parkCode: code,
          parkName: parkData.parkName,
        };
      }
    }
    
    return null;
  }
  
  /**
   * Search trails by name across all parks
   */
  async searchTrails(query: string, options?: { parkCode?: string; limit?: number }): Promise<TrailData[]> {
    const { parkCode, limit = 10 } = options || {};
    const trailsIndex = await this.fetchJson<TrailsIndex>('trails/all-parks-trails.json');
    if (!trailsIndex) return [];
    
    const queryLower = query.toLowerCase();
    const results: TrailData[] = [];
    
    const parksToSearch = parkCode 
      ? { [parkCode.toLowerCase()]: trailsIndex.parks[parkCode.toLowerCase()] }
      : trailsIndex.parks;
    
    for (const [code, parkData] of Object.entries(parksToSearch)) {
      if (!parkData) continue;
      
      for (const trail of parkData.trails) {
        if (trail.name.toLowerCase().includes(queryLower) ||
            trail.difficulty.toLowerCase().includes(queryLower) ||
            trail.type.toLowerCase().includes(queryLower)) {
          results.push({
            ...trail,
            parkCode: code,
            parkName: parkData.parkName,
          });
        }
      }
    }
    
    return results.slice(0, limit);
  }
  
  /**
   * Clear the cache (useful for testing or force refresh)
   */
  clearCache(): void {
    cache.clear();
  }
}

// Trail data interfaces - matches all-parks-trails.json structure (curated data)
interface TrailsIndex {
  _meta: {
    description: string;
    lastUpdated: string;
    source: string;
    coverage: {
      nationalParks: number;
      stateParks: {
        WI: number;
        FL: number;
      };
    };
  };
  parks: Record<string, {
    parkName: string;
    trails: TrailInfo[];
  }>;
  stateParks: {
    WI: Record<string, { parkName: string; trails: TrailInfo[] }>;
    FL: Record<string, { parkName: string; trails: TrailInfo[] }>;
  };
}

interface TrailInfo {
  name: string;
  difficulty: string;
  length: string;      // e.g. "3.2 mi"
  type: string;        // e.g. "out-and-back", "loop"
  alltrailsUrl: string;
}

// NPS API trail data structure
interface NPSTrailsIndex {
  _meta: any;
  nationalParks: Record<string, {
    parkName: string;
    state: string;
    coordinates: { lat: number; lon: number };
    trails: NPSTrailInfo[];
  }>;
  stateParks: {
    WI: Record<string, any>;
    FL: Record<string, any>;
  };
}

interface NPSTrailInfo {
  name: string;
  description: string;
  duration: string;
  npsUrl: string;
  imageUrl?: string;
  source: string;
}

export interface TrailData {
  name: string;
  difficulty?: string;
  length?: string;
  type?: string;
  description?: string;
  duration?: string;
  alltrailsUrl?: string;
  npsUrl?: string;
  trailUrl?: string;  // Primary URL to use
  googleMapsUrl?: string;
  imageUrl?: string;
  parkCode: string;
  parkName: string;
  source?: string;
  nearbyParks?: Array<{ parkId: string; parkName: string; distanceMiles: number }>;
}

// State trails data structure from S3
interface StateTrailsData {
  _meta: { stateCode: string; stateName: string; totalParks: number; totalTrails: number };
  parks: Record<string, { 
    parkName: string; 
    trails: Array<{
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
      nearbyParks?: Array<{ parkId: string; parkName: string; distanceMiles: number }>;
      dataSource: string;
      lastUpdated: string;
    }>;
  }>;
}

// Export singleton instance
export const s3ParkData = new S3ParkDataService();
