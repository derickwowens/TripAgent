import { StateParksAdapter, StatePark, StateParksSearchParams } from './StateParksAdapter.js';
import { RecreationGovAdapter, Campground as RIDBCampground } from './RecreationGovAdapter.js';
import { OpenStreetMapAdapter, OSMCampground } from './OpenStreetMapAdapter.js';
import { NationalParksAdapter, ParkCampground } from './NationalParksAdapter.js';

// Photo with caption for display
export interface CampgroundPhoto {
  url: string;
  caption?: string;
  credit?: string;
}

// Unified campground type aggregating all sources
export interface UnifiedCampground {
  id: string;
  name: string;
  source: 'recreation.gov' | 'nps' | 'openstreetmap';
  description?: string;
  state?: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  // Reservation info
  reservable: boolean;
  reservationUrl?: string;
  totalSites?: number;
  reservableSites?: number;
  firstComeFirstServe?: number;
  fees?: string;
  // Amenities
  amenities: {
    tents?: boolean;
    rvs?: boolean;
    toilets?: boolean;
    showers?: boolean;
    drinkingWater?: boolean;
    electricity?: boolean;
    wifi?: boolean;
    firepit?: boolean;
    pets?: boolean;
  };
  // Photos with captions
  photos: CampgroundPhoto[];
  // Contact
  phone?: string;
  website?: string;
  // Metadata
  facilityType?: string;
  managedBy?: string;
}

// Unified State Park with campground data
export interface UnifiedStatePark extends StatePark {
  campgrounds: UnifiedCampground[];
  hasCamping: boolean;
  campgroundCount: number;
  // Computed fields for display
  acresFormatted: string;
  stateDisplayName: string;
}

// State Park Summary for list views
export interface StateParkSummary {
  id: string;
  name: string;
  state: string;
  stateFullName: string;
  designationLabel: string;
  acres: number;
  acresFormatted: string;
  publicAccess: 'Open' | 'Restricted' | 'Closed' | 'Unknown';
  hasCamping: boolean;
  campgroundCount: number;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

// State Overview for state selection
export interface StateParksOverview {
  stateCode: string;
  stateName: string;
  parkCount: number;
  campgroundCount: number;
}

// Search results with metadata
export interface StateParkSearchResults {
  parks: StateParkSummary[];
  totalCount: number;
  hasMore: boolean;
  campgroundsAvailable: boolean;
  error?: string; // Error message if search requirements not met
}

// Campground filter options for UI
export interface CampgroundFilters {
  query?: string;
  radiusMiles?: number;
}

/**
 * StateParkService - Unified service combining PAD-US park data 
 * with aggregated campground data from multiple sources
 */
export class StateParkService {
  private parksAdapter: StateParksAdapter;
  private recreationGovAdapter: RecreationGovAdapter;
  private osmAdapter: OpenStreetMapAdapter;
  private npsAdapter: NationalParksAdapter;

  constructor(recreationGovApiKey?: string, npsApiKey?: string) {
    this.parksAdapter = new StateParksAdapter();
    this.recreationGovAdapter = new RecreationGovAdapter(recreationGovApiKey);
    this.osmAdapter = new OpenStreetMapAdapter();
    this.npsAdapter = new NationalParksAdapter(npsApiKey);
  }

  /**
   * Get all available US states with their park counts
   */
  async getStatesOverview(): Promise<StateParksOverview[]> {
    const states = this.parksAdapter.getStates();
    const parkCounts = await this.parksAdapter.getStateParkCounts();

    return states.map(state => ({
      stateCode: state.code,
      stateName: state.name,
      parkCount: parkCounts[state.code] || 0,
      campgroundCount: 0,
    })).sort((a, b) => b.parkCount - a.parkCount);
  }

  /**
   * Search for state parks with optional filters.
   * IMPORTANT: State is required for state park searches to limit data volume.
   */
  async searchParks(params: StateParksSearchParams = {}): Promise<StateParkSearchResults> {
    // Enforce state requirement to prevent massive data fetches
    if (!params.state) {
      return {
        parks: [],
        totalCount: 0,
        hasMore: false,
        campgroundsAvailable: false,
        error: 'State is required for state park searches. Please specify a state code (e.g., CA, TX, NY).',
      };
    }

    const limit = params.limit || 30; // Lower default limit for efficiency
    const parks = await this.parksAdapter.searchStateParks({
      ...params,
      limit: limit + 1,
    });

    const hasMore = parks.length > limit;
    const resultParks = hasMore ? parks.slice(0, limit) : parks;
    const campgroundsAvailable = this.recreationGovAdapter.isConfigured() || this.osmAdapter.isConfigured();

    // Return lightweight summaries - campground data is fetched separately via getParkDetails
    const summaries: StateParkSummary[] = resultParks.map(park => ({
      id: park.id,
      name: park.name,
      state: park.state,
      stateFullName: park.stateFullName,
      designationLabel: park.designationLabel,
      acres: park.acres,
      acresFormatted: this.formatAcres(park.acres),
      publicAccess: park.publicAccess,
      hasCamping: false, // Unknown until user requests park details
      campgroundCount: 0,
      coordinates: park.coordinates,
    }));

    return {
      parks: summaries,
      totalCount: resultParks.length,
      hasMore,
      campgroundsAvailable,
    };
  }

  /**
   * Get all parks for a specific state
   */
  async getParksByState(stateCode: string): Promise<StateParkSummary[]> {
    const parks = await this.parksAdapter.getStateParksByState(stateCode);
    
    return parks.map(park => ({
      id: park.id,
      name: park.name,
      state: park.state,
      stateFullName: park.stateFullName,
      designationLabel: park.designationLabel,
      acres: park.acres,
      acresFormatted: this.formatAcres(park.acres),
      publicAccess: park.publicAccess,
      hasCamping: false,
      campgroundCount: 0,
      coordinates: park.coordinates,
    }));
  }

  /**
   * Get detailed park information with aggregated campgrounds from all sources
   */
  async getParkDetails(parkName: string, stateCode: string): Promise<UnifiedStatePark | null> {
    const park = await this.parksAdapter.getStateParkByName(parkName, stateCode);
    
    if (!park) {
      return null;
    }

    // Aggregate campgrounds from all sources
    const campgrounds = await this.getAggregatedCampgrounds(parkName, stateCode);

    return {
      ...park,
      campgrounds,
      hasCamping: campgrounds.length > 0,
      campgroundCount: campgrounds.length,
      acresFormatted: this.formatAcres(park.acres),
      stateDisplayName: park.stateFullName,
    };
  }

  /**
   * Get campgrounds for a SPECIFIC park (lazy-load pattern).
   * This is the preferred method - only fetches campground data when user asks about a specific park.
   */
  async getCampgroundsForPark(parkName: string, stateCode: string): Promise<UnifiedCampground[]> {
    return this.getAggregatedCampgrounds(parkName, stateCode);
  }

  /**
   * Get aggregated campgrounds from all sources for a state.
   * WARNING: This can return large amounts of data. Prefer getCampgroundsForPark for specific parks.
   */
  async getCampgrounds(stateCode: string): Promise<UnifiedCampground[]> {
    if (!stateCode) {
      console.warn('getCampgrounds called without stateCode - returning empty array');
      return [];
    }

    const results: UnifiedCampground[] = [];

    // Fetch from all sources in parallel with reasonable limits
    const [ridbResults, osmResults, npsResults] = await Promise.allSettled([
      this.recreationGovAdapter.isConfigured() 
        ? this.recreationGovAdapter.getCampgroundsByState(stateCode) 
        : Promise.resolve([]),
      this.osmAdapter.getCampgroundsByState(stateCode, 30), // Reduced from 50
      this.npsAdapter.getAllCampgrounds(stateCode),
    ]);

    // Process Recreation.gov results
    if (ridbResults.status === 'fulfilled') {
      results.push(...ridbResults.value.map(c => this.transformRIDBCampground(c)));
    }

    // Process OpenStreetMap results
    if (osmResults.status === 'fulfilled') {
      results.push(...osmResults.value.map(c => this.transformOSMCampground(c)));
    }

    // Process NPS results
    if (npsResults.status === 'fulfilled') {
      results.push(...npsResults.value.map(c => this.transformNPSCampground(c)));
    }

    // Deduplicate by proximity (within ~0.5 miles)
    return this.deduplicateCampgrounds(results);
  }

  /**
   * Get campgrounds near a location from all sources
   */
  async getCampgroundsNearby(
    latitude: number,
    longitude: number,
    radiusMiles = 50
  ): Promise<UnifiedCampground[]> {
    const results: UnifiedCampground[] = [];
    const radiusKm = radiusMiles * 1.60934;

    const [ridbResults, osmResults] = await Promise.allSettled([
      this.recreationGovAdapter.isConfigured()
        ? this.recreationGovAdapter.getCampgroundsNearLocation(latitude, longitude, radiusMiles)
        : Promise.resolve([]),
      this.osmAdapter.searchCampgroundsNearby({ latitude, longitude, radiusKm }),
    ]);

    if (ridbResults.status === 'fulfilled') {
      results.push(...ridbResults.value.map(c => this.transformRIDBCampground(c)));
    }

    if (osmResults.status === 'fulfilled') {
      results.push(...osmResults.value.map(c => this.transformOSMCampground(c)));
    }

    return this.deduplicateCampgrounds(results);
  }

  /**
   * Search campgrounds by name across all sources
   */
  async searchCampgrounds(query: string, stateCode?: string): Promise<UnifiedCampground[]> {
    const results: UnifiedCampground[] = [];

    const [ridbResults, npsResults] = await Promise.allSettled([
      this.recreationGovAdapter.isConfigured()
        ? this.recreationGovAdapter.searchByName(query, stateCode)
        : Promise.resolve([]),
      this.npsAdapter.searchCampgrounds(query),
    ]);

    if (ridbResults.status === 'fulfilled') {
      results.push(...ridbResults.value.map(c => this.transformRIDBCampground(c)));
    }

    if (npsResults.status === 'fulfilled') {
      results.push(...npsResults.value.map(c => this.transformNPSCampground(c)));
    }

    return this.deduplicateCampgrounds(results);
  }

  /**
   * Get aggregated campgrounds for a specific park
   */
  private async getAggregatedCampgrounds(
    parkName: string,
    stateCode: string
  ): Promise<UnifiedCampground[]> {
    const searchName = this.extractSearchableName(parkName);
    const results: UnifiedCampground[] = [];

    // Fetch from multiple sources in parallel
    const [ridbResults, npsResults] = await Promise.allSettled([
      this.recreationGovAdapter.isConfigured()
        ? this.recreationGovAdapter.searchByName(searchName, stateCode)
        : Promise.resolve([]),
      this.npsAdapter.searchCampgrounds(searchName),
    ]);

    if (ridbResults.status === 'fulfilled') {
      results.push(...ridbResults.value.map(c => this.transformRIDBCampground(c)));
    }

    if (npsResults.status === 'fulfilled') {
      results.push(...npsResults.value.map(c => this.transformNPSCampground(c)));
    }

    return this.deduplicateCampgrounds(results);
  }

  /**
   * Transform Recreation.gov campground to unified format
   */
  private transformRIDBCampground(camp: RIDBCampground): UnifiedCampground {
    return {
      id: camp.id,
      name: camp.name,
      source: 'recreation.gov',
      description: camp.description,
      state: camp.state,
      coordinates: camp.coordinates,
      reservable: camp.reservable,
      reservationUrl: camp.reservationUrl,
      amenities: {},
      photos: camp.photoUrl ? [{ url: camp.photoUrl, caption: camp.name }] : [],
      phone: camp.phone,
      website: camp.reservationUrl,
      facilityType: camp.facilityType,
      managedBy: camp.managedBy,
    };
  }

  /**
   * Transform OpenStreetMap campground to unified format
   */
  private transformOSMCampground(camp: OSMCampground): UnifiedCampground {
    return {
      id: camp.id,
      name: camp.name,
      source: 'openstreetmap',
      description: camp.description,
      coordinates: camp.coordinates,
      reservable: false,
      amenities: {
        tents: camp.amenities.tents,
        rvs: camp.amenities.caravans,
        toilets: camp.amenities.toilets,
        showers: camp.amenities.showers,
        drinkingWater: camp.amenities.drinkingWater,
        electricity: camp.amenities.electricity,
        wifi: camp.amenities.wifi,
        firepit: camp.amenities.firepit,
        pets: camp.amenities.dogs,
      },
      photos: [],
      phone: camp.phone,
      website: camp.website,
      facilityType: camp.type,
    };
  }

  /**
   * Transform NPS campground to unified format with photos and captions
   */
  private transformNPSCampground(camp: ParkCampground): UnifiedCampground {
    // Build photos array with captions
    const photos: CampgroundPhoto[] = (camp.images || []).map(url => ({
      url,
      caption: camp.name,
    }));

    // Parse amenities from NPS format
    const amenities: UnifiedCampground['amenities'] = {};
    if (camp.amenities) {
      amenities.toilets = camp.amenities.toilets?.some(t => t !== 'None');
      amenities.showers = camp.amenities.showers?.some(s => s !== 'None');
      amenities.drinkingWater = camp.amenities.potableWater?.some(w => w !== 'No water');
      amenities.electricity = Array.isArray(camp.amenities.electricalHookups) 
        ? camp.amenities.electricalHookups.length > 0 
        : camp.amenities.electricalHookups === 'Yes';
    }

    return {
      id: camp.id,
      name: camp.name,
      source: 'nps',
      description: camp.description,
      coordinates: camp.coordinates,
      reservable: camp.reservableSites > 0,
      reservationUrl: camp.reservationUrl,
      totalSites: camp.totalSites,
      reservableSites: camp.reservableSites,
      firstComeFirstServe: camp.firstComeFirstServe,
      fees: camp.fees,
      amenities,
      photos,
      facilityType: 'National Park Campground',
    };
  }

  /**
   * Deduplicate campgrounds by proximity (within ~0.5 miles / 0.008 degrees)
   */
  private deduplicateCampgrounds(campgrounds: UnifiedCampground[]): UnifiedCampground[] {
    const seen = new Map<string, UnifiedCampground>();
    const PROXIMITY_THRESHOLD = 0.008; // ~0.5 miles

    for (const camp of campgrounds) {
      const key = `${camp.coordinates.latitude.toFixed(3)}-${camp.coordinates.longitude.toFixed(3)}`;
      const existing = seen.get(key);

      if (!existing) {
        seen.set(key, camp);
      } else {
        // Prefer sources with more data (NPS > Recreation.gov > OSM)
        const priority = { 'nps': 3, 'recreation.gov': 2, 'openstreetmap': 1 };
        if (priority[camp.source] > priority[existing.source]) {
          // Merge photos from existing
          camp.photos = [...camp.photos, ...existing.photos];
          seen.set(key, camp);
        } else {
          // Merge photos into existing
          existing.photos = [...existing.photos, ...camp.photos];
        }
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Get all designation types with counts
   */
  async getDesignationTypes(): Promise<{ code: string; label: string; count: number }[]> {
    return this.parksAdapter.getDesignationTypes();
  }

  /**
   * Get list of all states
   */
  getStates(): { code: string; name: string }[] {
    return this.parksAdapter.getStates();
  }

  /**
   * Check if any campground data source is available
   */
  isCampgroundDataAvailable(): boolean {
    return this.recreationGovAdapter.isConfigured() || this.osmAdapter.isConfigured();
  }

  /**
   * Format acres for display
   */
  private formatAcres(acres: number): string {
    if (!acres || acres === 0) {
      return 'Unknown';
    }
    if (acres >= 1000000) {
      return `${(acres / 1000000).toFixed(1)}M acres`;
    }
    if (acres >= 1000) {
      return `${(acres / 1000).toFixed(1)}K acres`;
    }
    return `${acres.toLocaleString()} acres`;
  }

  /**
   * Extract a searchable park name (remove common suffixes)
   */
  private extractSearchableName(name: string): string {
    return name
      .replace(/\s+(State Park|State Recreation Area|State Historic Site|State Natural Area)$/i, '')
      .replace(/\s+SP$/i, '')
      .replace(/\s+SRA$/i, '')
      .trim();
  }
}

// Re-export types for convenience
export type { 
  StatePark, 
  StateParksSearchParams 
} from './StateParksAdapter.js';

export type { 
  Campground as RIDBCampground,
  CampgroundSearchParams 
} from './RecreationGovAdapter.js';

export type { OSMCampground } from './OpenStreetMapAdapter.js';
export type { ParkCampground } from './NationalParksAdapter.js';
