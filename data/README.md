# Park Data Sync System

A federated park database that normalizes and syncs data from multiple authoritative sources into S3.

## Design Principles

1. **Configuration-Driven**: State-specific logic lives in JSON config files, not code
2. **Authoritative Sources**: Data comes from official APIs (PAD-US, RIDB, state portals)
3. **Normalized Schema**: Unified data model works for all parks (national and state)
4. **Cacheable**: Data is stored in S3 for fast retrieval, reducing live API calls
5. **Scalable**: Adding a new state requires only a JSON config file

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    PAD-US       │     │      RIDB       │     │     NPS API     │
│ (Boundaries)    │     │  (Activities,   │     │ (National Park  │
│                 │     │   Campgrounds)  │     │     Details)    │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────┬───────┴───────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   Sync Scripts      │
              │ (TypeScript/Node)   │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   S3 Bucket         │
              │ (Normalized JSON)   │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   TripAgent App     │
              │ (Fetch & Cache)     │
              └─────────────────────┘
```

## Data Sources

| Source | Data Provided | Update Frequency |
|--------|---------------|------------------|
| PAD-US | Park boundaries, acreage, designation | Monthly |
| RIDB | Activities, campgrounds, photos, contact | Weekly |
| NPS API | National park details, alerts, events | Weekly |
| Manual | Curated descriptions, popularity scores | As needed |

## S3 Bucket Structure

```
tripagent-park-data/
├── state-parks/
│   ├── WI/
│   │   ├── index.json              # Summary of all WI state parks
│   │   └── parks/
│   │       ├── wi-devil-lake-sp.json
│   │       ├── wi-peninsula-sp.json
│   │       └── ...
│   ├── FL/
│   │   ├── index.json
│   │   └── parks/
│   │       └── ...
│   └── .../
├── national-parks/
│   ├── index.json                  # Summary of all national parks
│   └── parks/
│       ├── np-yellowstone.json
│       └── ...
├── sync-metadata/
│   ├── pad_us-WI.json             # Sync status for WI PAD-US
│   ├── pad_us-FL.json
│   └── ...
└── schemas/
    └── park.schema.json            # JSON Schema for validation
```

## Running Sync Scripts

### Prerequisites

```bash
# Install dependencies
npm install

# Set environment variables
export RECREATION_GOV_API_KEY=your-ridb-api-key
export NPS_API_KEY=your-nps-api-key
export AWS_ACCESS_KEY_ID=your-aws-key
export AWS_SECRET_ACCESS_KEY=your-aws-secret
export PARK_DATA_S3_BUCKET=tripagent-park-data
```

### Manual Sync

```bash
# Sync Wisconsin state parks
npx tsx data/sync/runSync.ts state WI

# Sync Florida state parks
npx tsx data/sync/runSync.ts state FL

# Sync all priority states
npx tsx data/sync/runSync.ts state all

# Sync everything (state + national)
npx tsx data/sync/runSync.ts all
```

### Scheduled Sync (GitHub Actions)

The sync runs automatically via GitHub Actions:
- **Schedule**: Weekly on Sunday at 2 AM UTC
- **Manual Trigger**: Available via GitHub Actions UI

Required GitHub Secrets:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `RECREATION_GOV_API_KEY`
- `NPS_API_KEY`
- `PARK_DATA_S3_BUCKET`

## Normalized Park Schema

See `schema/park.schema.ts` for the full TypeScript schema.

Key fields:
- `id`: Unique identifier (e.g., "wi-devil-lake-sp")
- `name`: Display name
- `parkType`: Type of park (state_park, national_park, etc.)
- `stateCode`: Two-letter state code
- `coordinates`: Latitude/longitude
- `activities`: Available activities
- `campgrounds`: Camping facilities
- `metadata.sources`: Data provenance tracking

## Adding a New State

Adding a new state is **configuration-only** - no code changes required!

1. **Research the state's data sources** (see `sources/DATA_SOURCES.md` for guidance)

2. **Create a state configuration file** at `sources/states/{STATE_CODE}.json`:
   ```json
   {
     "stateCode": "CA",
     "stateName": "California",
     "parkAuthority": {
       "name": "California Department of Parks and Recreation",
       "abbreviation": "CA State Parks",
       "website": "https://www.parks.ca.gov/"
     },
     "dataSources": {
       "parkList": {
         "type": "pad_us",
         "filters": {
           "State_Nm": "CA",
           "Mang_Type": "STAT",
           "Des_Tp": ["SP", "SRA", "SB", "SHCA"]
         }
       }
     },
     "reservationSystem": {
       "provider": "reserve_california",
       "baseUrl": "https://www.reservecalifornia.com/",
       "deepLinkPattern": "https://www.reservecalifornia.com/CaliforniaWebHome/Facilities/SearchViewUnitAvailabity.aspx"
     },
     "urlPatterns": {
       "officialParkPage": "https://www.parks.ca.gov/?page_id={id}"
     },
     "designationTypes": {
       "SP": { "code": "SP", "name": "State Park", "pluralName": "State Parks" },
       "SB": { "code": "SB", "name": "State Beach", "pluralName": "State Beaches" }
     }
   }
   ```

3. **Run the sync**:
   ```bash
   npm run sync:state CA
   ```

4. Optionally add to `PRIORITY_STATES` in `config.ts` for scheduled syncs.

## Monitoring

- Sync metadata is stored in S3 at `sync-metadata/{source}-{state}.json`
- Failed syncs create GitHub issues automatically
- Check `lastSynced` timestamps in index files for freshness

## Local Development

For local testing without S3:

```typescript
// Mock S3 client for local development
process.env.MOCK_S3 = 'true';
```

This will write files to `data/local-output/` instead of S3.
