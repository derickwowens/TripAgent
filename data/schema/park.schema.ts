/**
 * Normalized Park Data Schema
 * 
 * This schema provides a SOURCE-AGNOSTIC, normalized representation of park data.
 * The database is the single source of truth - data may originate from multiple
 * sources but is normalized into this unified format.
 * 
 * S3 Structure:
 * - parks/{stateCode}/{parkId}/data.json      (park data)
 * - parks/{stateCode}/{parkId}/photos/        (park photos)
 * - parks/{stateCode}/index.json              (state index)
 * - national/{parkCode}/data.json             (national park data)
 * - national/{parkCode}/photos/               (national park photos)
 * - national/index.json                       (national parks index)
 * - index.json                                (master index)
 */

// Park category - high-level classification
export type ParkCategory = 'national' | 'state' | 'local';

// Park type enumeration - covers all federal and state designations
export type ParkType = 
  // National designations
  | 'national_park' 
  | 'national_monument' 
  | 'national_recreation_area' 
  | 'national_seashore'
  | 'national_lakeshore'
  | 'national_preserve' 
  | 'national_historic_site'
  | 'national_historical_park'
  | 'national_memorial'
  | 'national_battlefield'
  | 'national_military_park'
  | 'national_scenic_trail'
  | 'national_wild_scenic_river'
  // State designations
  | 'state_park' 
  | 'state_recreation_area' 
  | 'state_forest' 
  | 'state_beach' 
  | 'state_historic_site'
  | 'state_natural_area'
  | 'state_trail'
  | 'state_reserve'
  // Other
  | 'county_park'
  | 'regional_park'
  | 'wilderness_area';

// Trail difficulty levels
export type TrailDifficulty = 'easy' | 'moderate' | 'difficult' | 'strenuous' | 'expert';

// Trail surface types
export type TrailSurface = 
  | 'paved' 
  | 'gravel' 
  | 'dirt' 
  | 'sand' 
  | 'rock' 
  | 'boardwalk' 
  | 'mixed';

// Trail use types
export type TrailUse = 
  | 'hiking' 
  | 'biking' 
  | 'horseback' 
  | 'cross_country_ski' 
  | 'snowshoe' 
  | 'atv' 
  | 'snowmobile'
  | 'wheelchair_accessible';

// Link type enumeration
export type LinkType = 
  | 'official_website' 
  | 'reservation' 
  | 'map' 
  | 'directions' 
  | 'contact' 
  | 'fees' 
  | 'rules' 
  | 'activities' 
  | 'camping'
  | 'permits'
  | 'alerts'
  | 'webcam'
  | 'social_media' 
  | 'app_store' 
  | 'other';

// Region/area for grouping parks
export type USRegion = 
  | 'northeast' 
  | 'southeast' 
  | 'midwest' 
  | 'southwest' 
  | 'west' 
  | 'pacific' 
  | 'alaska' 
  | 'hawaii';

/**
 * Official Link - Authoritative URLs for the park
 */
export interface OfficialLink {
  type: LinkType;
  url: string;
  title?: string;
  description?: string;
  isPrimary?: boolean;           // Is this the main link of this type?
  lastVerified?: string;         // ISO 8601 timestamp when link was verified working
}

// Operating hours for a specific day
export interface OperatingHours {
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
  description?: string;
  exceptions?: Array<{
    name: string;
    startDate: string;
    endDate: string;
    hours: string;
  }>;
}

// Fee information
export interface Fee {
  title: string;
  description?: string;
  cost: string;
  type: 'entrance' | 'camping' | 'permit' | 'parking' | 'activity' | 'other';
}

// Contact information
export interface ContactInfo {
  phone?: string;
  email?: string;
  website?: string;
  reservationUrl?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
}

// Geographic coordinates
export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Geographic boundary (GeoJSON)
export interface Boundary {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
}

// Photo/image information
export interface ParkImage {
  id: string;                        // Unique photo ID
  url: string;                       // Public URL (S3 or external)
  s3Key?: string;                    // S3 object key if stored in our bucket
  thumbnailUrl?: string;             // Thumbnail version URL
  title?: string;
  altText?: string;
  caption?: string;
  credit?: string;
  license?: string;                  // License info (e.g., "Public Domain", "CC BY 4.0")
  width?: number;
  height?: number;
  sizeBytes?: number;
  contentType?: string;              // MIME type (e.g., "image/jpeg")
  isPrimary?: boolean;               // Is this the main/hero image?
  tags?: string[];                   // Tags for categorization (e.g., ["landscape", "sunset"])
  uploadedAt?: string;               // ISO 8601 timestamp
}

// Photo collection for a park (stored at parks/{stateCode}/{parkId}/photos.json)
export interface ParkPhotoCollection {
  parkId: string;
  parkName: string;
  s3PhotosPath: string;              // e.g., "parks/WI/devilslake/photos/"
  totalPhotos: number;
  primaryPhotoId?: string;
  photos: ParkImage[];
  lastUpdated: string;
}

// Activity available at the park
export interface Activity {
  id: string;
  name: string;
  category?: string;
  description?: string;
  seasonalAvailability?: string;
  reservationRequired?: boolean;
  fee?: Fee;
}

/**
 * Campground - Detailed camping facility information
 */
export interface Campground {
  // Identification
  id: string;
  name: string;
  description?: string;
  
  // Location
  coordinates?: Coordinates;
  parkId?: string;               // Reference to parent park
  
  // Capacity
  totalSites?: number;
  sitesBreakdown?: {
    tent?: number;
    rv?: number;
    cabin?: number;
    group?: number;
    accessible?: number;
    equestrian?: number;
    boat?: number;
  };
  reservableSites?: number;
  firstComeFirstServe?: number;
  maxOccupancy?: number;
  maxRvLength?: number;          // In feet
  
  // Reservations
  reservationUrl?: string;       // Direct link to reserve this campground
  reservationSystem?: {
    provider: string;            // e.g., "GoingToCamp", "ReserveAmerica", "Recreation.gov"
    campgroundId?: string;       // ID in the reservation system
    deepLinkSupported: boolean;
  };
  bookingWindow?: {
    openDays?: number;           // How many days in advance reservations open
    minStay?: number;
    maxStay?: number;
  };
  
  // Fees
  fees?: Fee[];
  priceRange?: {
    min: number;
    max: number;
    currency: string;
  };
  
  // Amenities (detailed)
  amenities?: {
    electricity?: boolean | 'partial';  // Can be partial availability
    water?: boolean | 'partial';
    sewer?: boolean | 'partial';
    showers?: boolean;
    restrooms?: boolean | 'vault' | 'flush';
    wifi?: boolean;
    pets?: boolean;
    campfires?: boolean | 'fire_ring' | 'grill_only';
    rvHookups?: boolean | 'full' | 'partial';
    tentOnly?: boolean;
    cabins?: boolean;
    dump_station?: boolean;
    laundry?: boolean;
    store?: boolean;
    boat_ramp?: boolean;
    swimming?: boolean;
    fishing?: boolean;
    playground?: boolean;
  };
  
  // Operating info
  operatingHours?: OperatingHours;
  seasonalAvailability?: {
    yearRound?: boolean;
    openDate?: string;           // MM-DD format
    closeDate?: string;          // MM-DD format
    notes?: string;
  };
  
  // Media
  images?: ParkImage[];
  
  // Metadata
  lastUpdated?: string;
}

// Trail/hike information
export interface Trail {
  // Identification
  id: string;
  name: string;
  description?: string;
  
  // Distance and elevation
  lengthMiles: number;
  elevationGainFeet?: number;
  elevationLossFeet?: number;
  highestPointFeet?: number;
  lowestPointFeet?: number;
  
  // Difficulty and rating
  difficulty: TrailDifficulty;
  difficultyNotes?: string;           // Explanation of difficulty rating
  technicalRating?: number;           // 1-5 technical difficulty
  fitnessRating?: number;             // 1-5 fitness required
  userRating?: number;                // Average user rating (1-5)
  reviewCount?: number;
  
  // Trail characteristics
  trailType: 'loop' | 'out_and_back' | 'point_to_point' | 'lollipop' | 'figure_eight';
  surface?: TrailSurface[];           // Can have multiple surface types
  allowedUses: TrailUse[];            // What activities are allowed
  
  // Time estimates
  estimatedTimeMinutes?: number;
  estimatedTimeRange?: {
    min: number;
    max: number;
  };
  
  // Location
  trailheadCoordinates?: Coordinates;
  trailheadAddress?: string;
  trailheadParking?: {
    available: boolean;
    fee?: string;
    capacity?: number;
  };
  
  // Features and highlights
  features?: string[];                // e.g., ["waterfall", "scenic_view", "wildlife"]
  highlights?: string[];              // Key attractions on trail
  scenicRating?: number;              // 1-5 scenic beauty
  
  // Seasonal info
  bestSeasons?: ('spring' | 'summer' | 'fall' | 'winter')[];
  seasonalClosures?: string;
  snowCovered?: boolean;              // Typically snow-covered in winter
  
  // Conditions and hazards
  hazards?: string[];                 // e.g., ["steep_cliffs", "river_crossing", "wildlife"]
  cellCoverage?: 'none' | 'limited' | 'good';
  waterSources?: boolean;             // Water available on trail
  restroomsAvailable?: boolean;
  
  // Accessibility
  wheelchairAccessible?: boolean;
  dogFriendly?: boolean;
  dogLeashRequired?: boolean;
  kidFriendly?: boolean;
  strollerFriendly?: boolean;
  
  // Permits and fees
  permitRequired?: boolean;
  feeRequired?: boolean;
  
  // Media
  images?: ParkImage[];
  mapUrl?: string;
  gpxUrl?: string;                    // GPX track file URL
  
  // Metadata
  lastUpdated?: string;
}

// Alert/closure information
export interface Alert {
  id: string;
  title: string;
  description: string;
  category: 'closure' | 'caution' | 'information' | 'danger';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  startDate?: string;
  endDate?: string;
  url?: string;
}

/**
 * Accessibility information
 */
export interface AccessibilityInfo {
  wheelchairAccessible?: boolean;
  accessibleTrails?: boolean;
  accessibleRestrooms?: boolean;
  accessibleCampsites?: boolean;
  accessibleVisitorCenter?: boolean;
  serviceAnimalsAllowed?: boolean;
  assistiveListeningDevices?: boolean;
  signLanguageInterpreters?: boolean;
  braileMaterials?: boolean;
  audioDescriptions?: boolean;
  notes?: string;
}

/**
 * Weather and climate information
 */
export interface ClimateInfo {
  weatherDescription?: string;
  bestTimeToVisit?: string[];        // e.g., ["spring", "fall"]
  peakSeason?: {
    start: string;                   // MM-DD
    end: string;
  };
  averageTemperature?: {
    summerHighF?: number;
    summerLowF?: number;
    winterHighF?: number;
    winterLowF?: number;
  };
  annualPrecipitationInches?: number;
  snowfallInches?: number;
  elevationFeet?: {
    min?: number;
    max?: number;
    average?: number;
  };
}

/**
 * Visitor information and statistics
 */
export interface VisitorInfo {
  annualVisitors?: number;
  visitorRanking?: number;           // Ranking among parks of same type
  averageCrowding?: 'low' | 'moderate' | 'high' | 'very_high';
  bestDaysToVisit?: string[];        // e.g., ["weekdays", "early_morning"]
  typicalVisitDuration?: string;     // e.g., "2-4 hours", "full day", "2-3 days"
  cellCoverage?: 'none' | 'limited' | 'good' | 'excellent';
  wifiAvailable?: boolean;
  petPolicy?: {
    allowed: boolean;
    restrictions?: string;
    petFriendlyTrails?: boolean;
  };
}

/**
 * Permit and reservation requirements
 */
export interface PermitInfo {
  entryPermitRequired?: boolean;
  backcountryPermitRequired?: boolean;
  campingReservationRequired?: boolean;
  timedEntryRequired?: boolean;
  advanceBookingDays?: number;       // How far in advance to book
  permitUrl?: string;
  notes?: string;
}

/**
 * Gateway cities and nearby locations
 */
export interface NearbyLocation {
  name: string;
  type: 'city' | 'airport' | 'park' | 'attraction';
  distanceMiles: number;
  driveTimeMinutes?: number;
  coordinates?: Coordinates;
  airportCode?: string;              // For airports
}

/**
 * National Park specific information
 */
export interface NationalParkInfo {
  parkCode: string;                  // NPS park code (e.g., "yell", "yose")
  npsId?: string;                    // NPS API ID
  ridbFacilityId?: string;           // Recreation.gov facility ID
  region?: USRegion;
  established?: string;              // Date established (YYYY-MM-DD or YYYY)
  congressionalAct?: string;
  worldHeritageSite?: boolean;
  biosphereReserve?: boolean;
}

/**
 * State Park specific information
 */
export interface StateParkInfo {
  stateSystemId?: string;            // ID in state's park system
  managingAgency?: string;           // e.g., "Wisconsin DNR", "Florida DEP"
  reservationSystemId?: string;      // ID in reservation system
  reservationSystem?: {
    provider: string;                // e.g., "GoingToCamp", "ReserveAmerica"
    propertyId?: string;
    deepLinkSupported: boolean;
  };
}

/**
 * Normalized Park - The main unified park entity
 */
export interface NormalizedPark {
  // Core identification
  id: string;                        // Unique ID: e.g., "wi-devilslake" or "np-yellowstone"
  name: string;                      // Display name
  category: ParkCategory;            // High-level: national, state, or local
  parkType: ParkType;                // Specific designation
  stateCode: string;                 // Two-letter state code (e.g., "WI", "FL")
  stateName: string;                 // Full state name
  region?: USRegion;                 // Geographic region
  
  // Description and details
  description?: string;
  shortDescription?: string;         // 1-2 sentence summary
  designation?: string;              // Official designation (e.g., "State Park", "National Park")
  highlights?: string[];             // Key attractions/features
  
  // Geographic data
  coordinates: Coordinates;          // Center point
  boundary?: Boundary;               // GeoJSON boundary (optional, can be large)
  acres?: number;
  timezone?: string;                 // IANA timezone (e.g., "America/Chicago")
  
  // National/State specific data
  nationalParkInfo?: NationalParkInfo;
  stateParkInfo?: StateParkInfo;
  
  // Official links (authoritative URLs)
  officialLinks?: OfficialLink[];
  
  // Contact and logistics
  contact?: ContactInfo;
  operatingHours?: OperatingHours;
  fees?: Fee[];
  
  // Visitor information
  visitorInfo?: VisitorInfo;
  accessibility?: AccessibilityInfo;
  climate?: ClimateInfo;
  permits?: PermitInfo;
  
  // Nearby locations
  nearbyLocations?: NearbyLocation[];
  gatewayCities?: string[];          // Primary gateway cities
  nearestAirport?: {
    code: string;
    name: string;
    distanceMiles: number;
  };
  
  // Media
  images?: ParkImage[];
  
  // Activities and facilities
  activities?: Activity[];
  campgrounds?: Campground[];
  trails?: Trail[];
  
  // Current conditions
  alerts?: Alert[];
  
  // Metadata
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: number;
    s3Key?: string;                  // S3 object key for this park
    photosPath?: string;             // S3 path to photos directory
  };
  
  // Search optimization
  keywords?: string[];               // Additional search terms
  popularity?: number;               // 0-100 popularity score for sorting
  
  // Quick access URLs (derived from officialLinks for convenience)
  quickLinks?: {
    officialWebsite?: string;
    reservations?: string;
    map?: string;
    directions?: string;
    alerts?: string;
    webcam?: string;
  };
}

/**
 * State Parks Index - Summary of all parks in a state
 */
export interface StateParkIndex {
  stateCode: string;
  stateName: string;
  totalParks: number;
  lastSynced: string;
  s3Prefix: string;                  // S3 prefix for this state's data
  reservationSystem?: {
    provider: string;
    baseUrl: string;
  };
  parkAuthority?: {
    name: string;
    website: string;
  };
  parks: Array<{
    id: string;
    name: string;
    parkType: ParkType;
    coordinates: Coordinates;
    acres?: number;
    hasCamping: boolean;
    hasTrails: boolean;
    imageUrl?: string;
    popularity?: number;
    s3Key?: string;                  // S3 key for full park data
  }>;
}

/**
 * National Parks Index - Summary of all national parks
 */
export interface NationalParkIndex {
  totalParks: number;
  lastSynced: string;
  s3Prefix: string;                  // S3 prefix for national parks data
  parks: Array<{
    id: string;
    name: string;
    parkCode: string;                // NPS park code (e.g., "yell" for Yellowstone)
    stateCode: string;
    stateName: string;
    region: USRegion;
    coordinates: Coordinates;
    acres?: number;
    designation: string;
    imageUrl?: string;
    popularity?: number;
    annualVisitors?: number;
    established?: string;
    s3Key?: string;                  // S3 key for full park data
  }>;
}

/**
 * Sync metadata for tracking data freshness
 */
export interface SyncMetadata {
  stateCode?: string;
  lastSyncStart: string;
  lastSyncEnd: string;
  recordsProcessed: number;
  recordsUpdated: number;
  recordsFailed: number;
  errors?: string[];
  nextScheduledSync?: string;
  s3Objects?: {
    uploaded: string[];
    failed: string[];
  };
}

/**
 * S3 Database Configuration
 */
export interface S3DatabaseConfig {
  bucket: string;
  region: string;
  paths: {
    stateParks: string;              // e.g., "state-parks"
    nationalParks: string;           // e.g., "national-parks"
    syncMetadata: string;            // e.g., "sync-metadata"
    schemas: string;                 // e.g., "schemas"
  };
  publicUrlBase: string;             // e.g., "https://tripagent-park-data.s3.us-east-1.amazonaws.com"
}

/**
 * Master Index - Top-level index of all park data in S3
 */
export interface MasterIndex {
  lastUpdated: string;
  schemaVersion: string;             // Semantic version of schema
  
  // National parks summary
  nationalParks: {
    totalParks: number;
    indexUrl: string;
    lastSynced: string;
  };
  
  // State parks by state
  stateParks: Record<string, {
    stateCode: string;
    stateName: string;
    totalParks: number;
    indexUrl: string;
    lastSynced: string;
  }>;
  
  // Database statistics
  statistics: {
    totalParks: number;
    totalPhotos: number;
    lastFullSync: string;
    databaseSize?: string;
  };
}

/**
 * Link Validation Result - For tracking link health
 */
export interface LinkValidationResult {
  url: string;
  parkId?: string;
  parkName?: string;
  linkType?: LinkType;
  status: 'ok' | 'redirect' | 'broken' | 'timeout' | 'error' | 'browser_only';
  httpStatus?: number;
  redirectUrl?: string;
  responseTime?: number;
  error?: string;
  lastChecked: string;
}

/**
 * Validation Report - Summary of link validation run
 */
export interface ValidationReport {
  timestamp: string;
  stateCode?: string;
  totalLinks: number;
  validLinks: number;
  brokenLinks: number;
  redirects: number;
  browserOnly: number;
  timeouts: number;
  errors: number;
  results: LinkValidationResult[];
}
