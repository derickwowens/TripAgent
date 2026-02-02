/**
 * Park Data Sync Module
 * 
 * Exports for the federated park database sync system.
 */

// Schema types
export type {
  NormalizedPark,
  StateParkIndex,
  NationalParkIndex,
  SyncMetadata,
  ParkType,
  DataSource,
  LinkType,
  OfficialLink,
  Activity,
  Campground,
  Trail,
  ParkImage,
  Fee,
  ContactInfo,
  Coordinates,
  OperatingHours,
  Alert,
} from '../schema/park.schema.js';

// Configuration
export { S3_CONFIG, SYNC_CONFIG, PRIORITY_STATES, ALL_STATES, STATE_NAMES } from './config.js';

// S3 Client
export {
  uploadJson,
  downloadJson,
  uploadPark,
  downloadPark,
  uploadStateParkIndex,
  downloadStateParkIndex,
  uploadNationalParkIndex,
  downloadNationalParkIndex,
  uploadSyncMetadata,
  downloadSyncMetadata,
  getPublicUrl,
} from './s3Client.js';

// Base syncer
export { BaseSyncer, createNormalizedPark } from './baseSyncer.js';
export type { SyncResult } from './baseSyncer.js';

// Abstract state syncer (configuration-driven)
export { StateSyncer } from './syncers/stateSyncer.js';

// State configuration schema
export type {
  StateConfig,
  ReservationProvider,
  DataSourceConfig,
  ParkAuthority,
  ReservationSystemConfig,
  UrlPatterns,
  DesignationType,
} from '../schema/stateConfig.schema.js';
export { loadStateConfig, validateStateConfig, generateParkUrl } from '../schema/stateConfig.schema.js';
