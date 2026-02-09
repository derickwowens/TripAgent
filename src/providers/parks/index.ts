// State Parks 2.0 - Unified State Parks Module
// Combines PAD-US data with multiple campground data sources

export { NationalParksAdapter } from './NationalParksAdapter.js';
export type { NationalPark, ParkCampground, ParkActivity, ParkHike } from './NationalParksAdapter.js';

// State Parks Adapters
export { StateParksAdapter } from './StateParksAdapter.js';
export type { StatePark, StateParksSearchParams } from './StateParksAdapter.js';

// Recreation.gov Campground Adapter (Federal lands)
export { RecreationGovAdapter } from './RecreationGovAdapter.js';
export type { 
  Campground, 
  CampgroundSearchParams,
  StateRecreationArea,
} from './RecreationGovAdapter.js';

// OpenStreetMap Campground Adapter (Global, crowdsourced)
export { OpenStreetMapAdapter } from './OpenStreetMapAdapter.js';
export type { 
  OSMCampground, 
  OSMSearchParams,
  BoundingBoxParams 
} from './OpenStreetMapAdapter.js';

// Unified State Park Service
export { StateParkService } from './StateParkService.js';
export type {
  UnifiedStatePark,
  StateParkSummary,
  StateParksOverview,
  StateParkSearchResults,
  CampgroundFilters,
} from './StateParkService.js';

// S3 Park Database Service (Authoritative data source)
export { S3ParkDataService, s3ParkData } from './S3ParkDataService.js';

// PostgreSQL + PostGIS Park Database Service (Performance upgrade)
export { PostgresParkDataService } from './PostgresParkDataService.js';
