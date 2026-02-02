# Authoritative State Park Data Sources

This document catalogs the authoritative data sources for state park information, organized by data type and state.

## Universal Data Sources (All States)

### 1. PAD-US (Protected Areas Database of the United States)
- **Provider**: USGS
- **Type**: ArcGIS Feature Service
- **Coverage**: All 50 states
- **Data Provided**:
  - Park boundaries (polygons)
  - Park names and designations
  - Acreage
  - Management type (State, Federal, Local, Private)
  - Public access status
- **Update Frequency**: Annual
- **API Endpoint**: `https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Protected_Areas_Database/FeatureServer/0`
- **Authentication**: None required
- **Rate Limits**: Moderate (respect ArcGIS terms)
- **Notes**: Primary source for park boundaries and basic metadata

### 2. RIDB (Recreation Information Database)
- **Provider**: Recreation.gov / USDA
- **Type**: REST API
- **Coverage**: Federal lands + some state partnerships
- **Data Provided**:
  - Recreation areas
  - Facilities (campgrounds)
  - Activities
  - Media (photos)
  - Links
  - Organization info
- **Update Frequency**: Real-time
- **API Endpoint**: `https://ridb.recreation.gov/api/v1`
- **Authentication**: API key required (`RECREATION_GOV_API_KEY`)
- **Rate Limits**: 5 requests/second
- **Notes**: Best for federal recreation areas; limited state park coverage

### 3. ReserveAmerica / ACTIVE Network API
- **Provider**: ACTIVE Network
- **Type**: REST API
- **Coverage**: 97% of US state and national parks
- **Data Provided**:
  - Campground search
  - Campground details
  - Campsite search
  - Amenities
  - Reservation links
- **Update Frequency**: Real-time
- **API Endpoint**: `https://api.amp.active.com/camping/`
- **Authentication**: API key required
- **Rate Limits**: 2 requests/second, 5,000/day
- **Documentation**: https://developer.active.com/docs/read/Campground_APIs
- **Notes**: Primary source for campground reservations; covers most state park systems

---

## State-Specific Data Sources

### Wisconsin (WI)

#### Official Sources
| Source | URL | Data Type | Notes |
|--------|-----|-----------|-------|
| WI DNR Parks | https://dnr.wisconsin.gov/topic/Parks | Official website | Park listings, hours, fees |
| WI DNR Open Data | https://data-wi-dnr.opendata.arcgis.com/ | ArcGIS Portal | Geospatial data, boundaries |
| WI DNR ArcGIS REST | https://dnrmaps.wi.gov/arcgis/rest/services/ | REST API | Direct feature services |
| GoingToCamp | https://wisconsin.goingtocamp.com/ | Reservation system | Campsite reservations |

#### Key ArcGIS Services
- **State Parks**: `https://dnrmaps.wi.gov/arcgis/rest/services/LF_DML/AGOL_LF_DNR_PUBLIC_LAND_WTM_Ext/MapServer`
- **Local Parks**: `https://dnrmaps.wi.gov/arcgis/rest/services/LF_DML/EN_LOCAL_PARKS_WTM_Ext/MapServer`

#### Reservation System
- **Provider**: Aspira (GoingToCamp)
- **URL Pattern**: `https://wisconsin.goingtocamp.com/`
- **Deep Link**: `https://wisconsin.goingtocamp.com/create-booking/results?resourceLocationId={parkId}`

#### Data Mapping
| App Field | WI Source | Field/Endpoint |
|-----------|-----------|----------------|
| Park Name | PAD-US | Unit_Nm |
| Boundaries | WI DNR ArcGIS | Geometry |
| Campgrounds | RIDB + ReserveAmerica | Facilities |
| Reservation URL | GoingToCamp | Static pattern |
| Official Website | WI DNR | `https://dnr.wisconsin.gov/topic/parks/name/{parkSlug}` |

---

### Florida (FL)

#### Official Sources
| Source | URL | Data Type | Notes |
|--------|-----|-----------|-------|
| FL State Parks | https://www.floridastateparks.org/ | Official website | Park info, activities |
| FL Parks Reservation | https://reserve.floridastateparks.org/ | Reservation system | Campsite reservations |
| FL Geographic Data | https://geodata.floridagio.gov/ | GIS Portal | State geospatial data |

#### Reservation System
- **Provider**: Florida DEP (Department of Environmental Protection)
- **URL Pattern**: `https://reserve.floridastateparks.org/`
- **Deep Link**: `https://www.reserve.floridastateparks.org/Web/?parkId={parkId}`

#### Data Mapping
| App Field | FL Source | Field/Endpoint |
|-----------|-----------|----------------|
| Park Name | PAD-US | Unit_Nm |
| Boundaries | PAD-US / FL GIS | Geometry |
| Campgrounds | ReserveAmerica API | Campground Search |
| Reservation URL | FL Reserve | Static pattern |
| Official Website | FL State Parks | `https://www.floridastateparks.org/parks-and-trails/{parkSlug}` |

---

## Data Priority Matrix

When multiple sources provide the same data, use this priority order:

| Data Type | Priority 1 | Priority 2 | Priority 3 |
|-----------|------------|------------|------------|
| Boundaries | State ArcGIS | PAD-US | Manual |
| Park Name | State Official | PAD-US | RIDB |
| Description | State Official | RIDB | Manual Enrichment |
| Coordinates | State ArcGIS | PAD-US | RIDB |
| Activities | RIDB | ReserveAmerica | Manual |
| Campgrounds | ReserveAmerica | RIDB | State Official |
| Reservation URL | State Reservation System | ReserveAmerica | - |
| Photos | RIDB | State Official | Manual |
| Operating Hours | State Official | - | - |
| Fees | State Official | ReserveAmerica | - |

---

## URL Patterns by State

### Reservation Systems (Predictable - No API Needed)
```
WI: https://wisconsin.goingtocamp.com/
FL: https://reserve.floridastateparks.org/
CA: https://www.reservecalifornia.com/
TX: https://texas.reserveworld.com/
NY: https://newyorkstateparks.reserveamerica.com/
```

### Official Park Websites (NOT Predictable - Need Lookup)

**IMPORTANT**: URL slugs are NOT consistently predictable from park names!

Examples of unpredictable slugs:
- "Governor Dodge State Park" → `/govdodge` (not `/governordodge`)
- "Devil's Lake State Park" → `/devilslake` (apostrophe removed)
- "John Pennekamp Coral Reef" → `/john-pennekamp-coral-reef-state-park` (full name with dashes)

**Solutions**:
1. **Store URLs during sync** - When syncing from PAD-US, also fetch/store the official URL
2. **Use search links** - Link to search page with park name pre-filled
3. **Manual curation** - Store known URLs in enrichment config

Base URL patterns (for reference only):
```
WI: https://dnr.wisconsin.gov/topic/parks/{unpredictable_slug}
FL: https://www.floridastateparks.org/parks-and-trails/{unpredictable_slug}
```

---

## API Keys Required

| Service | Environment Variable | How to Obtain |
|---------|---------------------|---------------|
| RIDB | `RECREATION_GOV_API_KEY` | https://ridb.recreation.gov/docs |
| ReserveAmerica | `RESERVE_AMERICA_API_KEY` | https://developer.active.com/apps/register |
| NPS | `NPS_API_KEY` | https://www.nps.gov/subjects/developer/get-started.htm |

---

## Adding a New State

1. Research the state's official park website
2. Identify the reservation system provider (GoingToCamp, ReserveAmerica, custom)
3. Check for state-specific ArcGIS/GIS data portal
4. Document URL patterns for:
   - Official park pages
   - Reservation deep links
   - Contact information
5. Add state configuration to `data/sources/states/{stateCode}.json`
6. Test data retrieval from all sources
