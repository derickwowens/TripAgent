# TripAgent Park Data Schema

## Overview

This document describes the **source-agnostic, normalized** park data schema used by TripAgent. The S3 database is the **single source of truth** for all park data, regardless of where the data originally came from.

## Design Principles

1. **Source-Agnostic**: The schema contains no references to data sources. Data is normalized into a unified format.
2. **Photo Storage**: Photos are stored in S3 alongside park data for fast, reliable access.
3. **Hierarchical Structure**: Data is organized by state/park for efficient querying.
4. **Extensible**: Schema supports both national and state parks with type-specific fields.

## S3 Structure

```
s3://tripagent-park-data/
├── index.json                              # Master index
├── state-parks/
│   ├── WI/
│   │   ├── index.json                      # Wisconsin parks index
│   │   └── parks/
│   │       ├── wi-devilslake.json          # Individual park data
│   │       └── wi-peninsula.json
│   └── FL/
│       ├── index.json                      # Florida parks index
│       └── parks/
│           ├── fl-bahia-honda-state-park.json
│           └── ...
├── national-parks/
│   ├── index.json                          # National parks index
│   └── parks/
│       ├── np-yellowstone.json
│       └── ...
├── photos/
│   ├── state-parks/
│   │   └── WI/
│   │       └── devilslake/
│   │           ├── hero.jpg
│   │           └── trail-view.jpg
│   └── national-parks/
│       └── yellowstone/
│           └── ...
├── sync-metadata/
│   └── sync-WI.json
└── schemas/
    └── info.json
```

## Core Types

### ParkCategory

High-level classification:
- `national` - Federal parks managed by NPS
- `state` - State-managed parks
- `local` - County/regional parks

### ParkType

Covers all federal and state park designations:

**National:**
- `national_park`, `national_monument`, `national_recreation_area`
- `national_seashore`, `national_lakeshore`, `national_preserve`
- `national_historic_site`, `national_historical_park`, `national_memorial`
- `national_battlefield`, `national_military_park`
- `national_scenic_trail`, `national_wild_scenic_river`

**State:**
- `state_park`, `state_recreation_area`, `state_forest`
- `state_beach`, `state_historic_site`, `state_natural_area`
- `state_trail`, `state_reserve`

**Other:**
- `county_park`, `regional_park`, `wilderness_area`

### TrailDifficulty

Trail difficulty ratings:
- `easy` - Flat, well-maintained, suitable for all
- `moderate` - Some elevation, uneven terrain
- `difficult` - Significant elevation, challenging terrain
- `strenuous` - Very challenging, requires fitness
- `expert` - Technical terrain, experienced hikers only

### TrailSurface

Trail surface types:
- `paved`, `gravel`, `dirt`, `sand`, `rock`, `boardwalk`, `mixed`

### TrailUse

Allowed trail activities:
- `hiking`, `biking`, `horseback`, `cross_country_ski`
- `snowshoe`, `atv`, `snowmobile`, `wheelchair_accessible`

### USRegion

Geographic regions for grouping:
- `northeast`, `southeast`, `midwest`, `southwest`
- `west`, `pacific`, `alaska`, `hawaii`

## Main Interfaces

### NormalizedPark

The primary park entity with all data:

```typescript
interface NormalizedPark {
  // Core identification
  id: string;                    // e.g., "wi-devilslake" or "np-yellowstone"
  name: string;
  parkType: ParkType;
  stateCode: string;             // Two-letter state code
  stateName: string;
  region?: USRegion;

  // Description
  description?: string;
  shortDescription?: string;
  designation?: string;
  highlights?: string[];

  // Geographic
  coordinates: Coordinates;
  boundary?: Boundary;           // GeoJSON
  acres?: number;
  timezone?: string;

  // Type-specific data
  nationalParkInfo?: NationalParkInfo;
  stateParkInfo?: StateParkInfo;

  // Links and contact
  officialLinks?: OfficialLink[];
  contact?: ContactInfo;
  operatingHours?: OperatingHours;
  fees?: Fee[];

  // Visitor info
  visitorInfo?: VisitorInfo;
  accessibility?: AccessibilityInfo;
  climate?: ClimateInfo;
  permits?: PermitInfo;

  // Nearby locations
  nearbyLocations?: NearbyLocation[];
  gatewayCities?: string[];
  nearestAirport?: { code, name, distanceMiles };

  // Media
  images?: ParkImage[];

  // Facilities
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
    s3Key?: string;
    photosPath?: string;
  };

  // Search
  keywords?: string[];
  popularity?: number;

  // Quick access
  quickLinks?: {
    officialWebsite?: string;
    reservations?: string;
    map?: string;
    directions?: string;
    alerts?: string;
    webcam?: string;
  };
}
```

### ParkImage

Enhanced photo support with S3 storage:

```typescript
interface ParkImage {
  id: string;
  url: string;                   // Public URL
  s3Key?: string;                // S3 object key if stored locally
  thumbnailUrl?: string;
  title?: string;
  altText?: string;
  caption?: string;
  credit?: string;
  license?: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
  contentType?: string;
  isPrimary?: boolean;
  tags?: string[];
  uploadedAt?: string;
}
```

### StateParkIndex

Summary index for each state:

```typescript
interface StateParkIndex {
  stateCode: string;
  stateName: string;
  totalParks: number;
  lastSynced: string;
  s3Prefix: string;
  reservationSystem?: { provider, baseUrl };
  parkAuthority?: { name, website };
  parks: Array<{
    id: string;
    name: string;
    parkType: ParkType;
    coordinates: Coordinates;
    hasCamping: boolean;
    hasTrails: boolean;
    imageUrl?: string;
    popularity?: number;
    s3Key?: string;
  }>;
}
```

### MasterIndex

Top-level entry point:

```typescript
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
    databaseSize?: string;
  };
}
```

## NPM Scripts

```bash
# Generate curated links files
npm run parks:generate

# Validate all links work
npm run parks:validate

# Export to local JSON (mirrors S3 structure)
npm run parks:export

# Upload to S3
npm run parks:upload
npm run parks:upload:wi
npm run parks:upload:fl

# Upload master index
npm run parks:master-index
```

## Public URLs

Once uploaded, data is publicly accessible:

```
https://tripagent-park-data.s3.us-east-1.amazonaws.com/index.json
https://tripagent-park-data.s3.us-east-1.amazonaws.com/state-parks/WI/index.json
https://tripagent-park-data.s3.us-east-1.amazonaws.com/state-parks/WI/parks/wi-devilslake.json
```

## Adding New Parks

1. Add park to `data/scripts/generateLinks.ts`
2. Run `npm run parks:generate`
3. Run `npm run parks:validate` to verify links
4. Run `npm run parks:upload` to sync to S3

## Adding Photos

Photos should be uploaded to:
```
s3://tripagent-park-data/photos/state-parks/{stateCode}/{parkSlug}/
```

Then update the park's `images` array with the S3 keys.
