/**
 * Data Sync Configuration
 * 
 * Configuration for the federated park database sync system.
 */

export const S3_CONFIG = {
  bucket: process.env.PARK_DATA_S3_BUCKET || 'tripagent-park-data',
  region: process.env.AWS_REGION || 'us-east-1',
  
  // S3 key prefixes - source-agnostic structure
  paths: {
    // State parks: parks/{stateCode}/{parkId}/data.json, parks/{stateCode}/{parkId}/photos/
    stateParks: 'state-parks',
    // National parks: national/{parkCode}/data.json, national/{parkCode}/photos/
    nationalParks: 'national-parks',
    // Photos stored alongside park data
    photos: 'photos',
    // Sync metadata
    syncMetadata: 'sync-metadata',
    // Schema definitions
    schemas: 'schemas',
  },
  
  // Public URL base for accessing data
  get publicUrlBase() {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com`;
  },
};

export const SYNC_CONFIG = {
  // Data sources
  sources: {
    nps: {
      baseUrl: 'https://developer.nps.gov/api/v1',
      apiKeyEnv: 'NPS_API_KEY',
    },
    ridb: {
      baseUrl: 'https://ridb.recreation.gov/api/v1',
      apiKeyEnv: 'RECREATION_GOV_API_KEY',
    },
    padUs: {
      baseUrl: 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Protected_Areas_Database/FeatureServer/0',
    },
  },
  
  // State-specific API endpoints
  stateApis: {
    WI: {
      name: 'Wisconsin DNR',
      baseUrl: 'https://dnr.wi.gov',
      hasApi: false, // Will use PAD-US + RIDB
    },
    FL: {
      name: 'Florida State Parks',
      baseUrl: 'https://www.floridastateparks.org',
      hasApi: false, // Will use PAD-US + RIDB
    },
  },
  
  // Sync schedule (cron expressions)
  schedule: {
    stateParks: '0 2 * * 0',  // Weekly on Sunday at 2 AM
    nationalParks: '0 3 * * 0', // Weekly on Sunday at 3 AM
    alerts: '0 */6 * * *',     // Every 6 hours for alerts
  },
  
  // Rate limiting
  rateLimits: {
    nps: { requestsPerSecond: 10 },
    ridb: { requestsPerSecond: 5 },
    padUs: { requestsPerSecond: 2 },
  },
};

// Priority states for initial rollout
export const PRIORITY_STATES = ['WI', 'FL'] as const;

// All US states for future expansion
export const ALL_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
] as const;

export const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};
