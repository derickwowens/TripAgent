/**
 * State Configuration Schema
 * 
 * Defines the structure for state-specific configuration files.
 * Each state has a JSON config file that defines its data sources,
 * URL patterns, and other state-specific information.
 */

import type { DataSource } from './park.schema.js';

/**
 * Reservation system provider types
 */
export type ReservationProvider = 
  | 'going_to_camp'      // Aspira GoingToCamp (WI, many others)
  | 'reserve_america'    // ACTIVE Network ReserveAmerica
  | 'recreation_gov'     // Federal Recreation.gov
  | 'reserve_california' // California's custom system
  | 'state_custom'       // State-specific custom system
  | 'none';              // No online reservations

/**
 * Data source configuration for a specific type of data
 */
export interface DataSourceConfig {
  type: DataSource;
  url?: string;
  layer?: number;
  filters?: Record<string, string | string[]>;
  queryParams?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  apiKeyEnv?: string;
}

/**
 * Park authority information
 */
export interface ParkAuthority {
  name: string;
  abbreviation: string;
  website: string;
  parentAgency?: string;
}

/**
 * Reservation system configuration
 */
export interface ReservationSystemConfig {
  provider: ReservationProvider;
  providerType?: string;
  baseUrl: string;
  deepLinkPattern?: string;      // Pattern with {parkId}, {campgroundId} placeholders
  searchUrl?: string;
  apiEndpoint?: string;
  apiKeyEnv?: string;
}

/**
 * URL patterns for generating official links
 */
export interface UrlPatterns {
  officialParkPage?: string;     // Pattern with {slug}, {id} placeholders
  parkMap?: string;
  contactPage?: string;
  feesPage?: string;
  rulesPage?: string;
  activitiesPage?: string;
}

/**
 * Designation type mapping
 */
export interface DesignationType {
  code: string;
  name: string;
  pluralName: string;
  parkType?: string;             // Maps to ParkType enum
}

/**
 * Fee structure
 */
export interface FeeStructure {
  vehicleAdmission?: {
    resident?: { daily?: number; annual?: number };
    nonResident?: { daily?: number; annual?: number };
    standard?: { perVehicle?: number; perPerson?: number };
    notes?: string;
  };
  camping?: {
    baseRate?: { min: number; max: number };
    reservationFee?: number;
    notes?: string;
  };
}

/**
 * Contact information for the state park system
 */
export interface StateContact {
  generalPhone?: string;
  reservationPhone?: string;
  email?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
}

/**
 * Seasonal information
 */
export interface SeasonalInfo {
  typicalSeasonStart?: string;   // MM-DD format
  typicalSeasonEnd?: string;     // MM-DD format
  yearRoundOperation?: boolean;
  winterCampingAvailable?: boolean;
  peakSeason?: {
    start: string;
    end: string;
  };
}

/**
 * Complete State Configuration
 */
export interface StateConfig {
  // Identification
  stateCode: string;
  stateName: string;
  
  // Authority
  parkAuthority: ParkAuthority;
  
  // Data sources
  dataSources: {
    boundaries?: DataSourceConfig;
    parkList: DataSourceConfig;
    campgrounds?: DataSourceConfig;
    activities?: DataSourceConfig;
    trails?: DataSourceConfig;
    alerts?: DataSourceConfig;
  };
  
  // Reservation system
  reservationSystem: ReservationSystemConfig;
  
  // URL patterns for generating links
  urlPatterns: UrlPatterns;
  
  // Designation type mappings
  designationTypes: Record<string, DesignationType>;
  
  // Contact
  contact?: StateContact;
  
  // Fees
  fees?: FeeStructure;
  
  // Seasonal info
  seasonalInfo?: SeasonalInfo;
  
  // Special features/keywords for this state
  specialFeatures?: string[];
  
  // Custom enrichment data (popularity scores, descriptions, etc.)
  enrichment?: Record<string, {
    description?: string;
    shortDescription?: string;
    popularity?: number;
    keywords?: string[];
  }>;
}

/**
 * Load a state configuration from the JSON file
 */
export async function loadStateConfig(stateCode: string): Promise<StateConfig> {
  const configPath = `../sources/states/${stateCode.toUpperCase()}.json`;
  const config = await import(configPath, { assert: { type: 'json' } });
  return config.default as StateConfig;
}

/**
 * Validate a state configuration
 */
export function validateStateConfig(config: StateConfig): string[] {
  const errors: string[] = [];
  
  if (!config.stateCode || config.stateCode.length !== 2) {
    errors.push('stateCode must be a 2-letter code');
  }
  
  if (!config.stateName) {
    errors.push('stateName is required');
  }
  
  if (!config.parkAuthority?.name) {
    errors.push('parkAuthority.name is required');
  }
  
  if (!config.dataSources?.parkList) {
    errors.push('dataSources.parkList is required');
  }
  
  if (!config.reservationSystem?.baseUrl) {
    errors.push('reservationSystem.baseUrl is required');
  }
  
  return errors;
}

/**
 * Generate a park URL from a pattern
 */
export function generateParkUrl(pattern: string, park: { 
  id?: string; 
  name?: string;
  slug?: string;
}): string {
  let url = pattern;
  
  // Generate slug from name if not provided
  const slug = park.slug || park.name?.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || '';
  
  url = url.replace('{id}', park.id || '');
  url = url.replace('{slug}', slug);
  url = url.replace('{parkId}', park.id || '');
  url = url.replace('{name}', encodeURIComponent(park.name || ''));
  
  return url;
}
