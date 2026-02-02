# Trail Coverage Expansion Plan

## Current State (Feb 2026)

### National Parks
- **55 parks** with trail data from NPS API
- **800 trails** with official NPS URLs
- Coverage: ~87% of 63 national parks

### State Parks

| State | Parks | Trails | Est. Total Parks | Est. Total Trails | Coverage |
|-------|-------|--------|------------------|-------------------|----------|
| Wisconsin | 10 | 29 | 50 | 500+ | ~6% |
| Florida | 9 | 100 | 175 | 1,300+ | ~8% |

---

## Data Sources

### 1. Wisconsin DNR (Priority: HIGH)
- **Website**: https://dnr.wisconsin.gov/topic/parks
- **Data**: 44 State Trails, 50+ State Parks, 1,700+ miles
- **Method**: 
  - DNR provides GeoJSON/KML trail data
  - Web scraping park pages for trail lists
  - Recreation.gov API for campground-adjacent trails

### 2. Florida State Parks (Priority: HIGH)
- **Website**: https://www.floridastateparks.org
- **Data**: 175 parks, 1,300+ trails
- **Method**:
  - Florida DEP Online Trail Guide
  - Recreation.gov API
  - Individual park page scraping

### 3. Recreation.gov RIDB API (Already Integrated)
- **Coverage**: Federal lands, some state partnerships
- **Data Quality**: Good coordinates, reservation info
- **Expansion**: Query more facility types

### 4. TrailAPI (RapidAPI) - Current Source
- **Coverage**: Variable by region
- **Limitations**: Rate limits, incomplete data
- **Optimization**: Better coordinate searches

### 5. Google Maps Places API (Fallback)
- **Use Case**: Generate search URLs when no official data
- **Already Implemented**: generateGoogleMapsLink()

---

## Phase 1: Foundation (Q1 2026)

### Goals
- Wisconsin: 25 parks / 150 trails (30% coverage)
- Florida: 50 parks / 400 trails (30% coverage)

### Tasks
1. [ ] Create Wisconsin DNR data fetcher script
2. [ ] Create Florida State Parks data fetcher script
3. [ ] Enhance TrailAPI queries with better coordinates
4. [ ] Build coverage tracking dashboard
5. [ ] Set up automated weekly data refresh

### Priority Parks (Wisconsin)
1. Devil's Lake State Park (most visited)
2. Peninsula State Park
3. Governor Dodge State Park
4. Kohler-Andrae State Park
5. Mirror Lake State Park
6. Wyalusing State Park
7. Blue Mound State Park
8. Copper Falls State Park
9. Amnicon Falls State Park
10. Interstate State Park

### Priority Parks (Florida)
1. Myakka River State Park
2. Jonathan Dickinson State Park
3. Paynes Prairie Preserve
4. Ichetucknee Springs State Park
5. Rainbow Springs State Park
6. Hillsborough River State Park
7. Big Talbot Island State Park
8. Bahia Honda State Park
9. St. Andrews State Park
10. Grayton Beach State Park

---

## Phase 2: Expansion (Q2 2026)

### Goals
- Wisconsin: 40 parks / 300 trails (60% coverage)
- Florida: 100 parks / 800 trails (60% coverage)

### Tasks
1. [ ] Add remaining major state parks
2. [ ] Cross-reference with AllTrails data (manual verification)
3. [ ] Add trail difficulty ratings
4. [ ] Add seasonal availability info
5. [ ] Integrate user feedback for data quality

---

## Phase 3: Comprehensive (Q3 2026)

### Goals
- Wisconsin: 50 parks / 400 trails (80% coverage)
- Florida: 150 parks / 1,000 trails (80% coverage)

### Tasks
1. [ ] Complete park coverage
2. [ ] Add trail photos from official sources
3. [ ] Add real-time trail conditions (where available)
4. [ ] Add accessibility information
5. [ ] Multi-state expansion (consider TX, CA, CO)

---

## Data Schema

Each trail should have:

```typescript
interface StateParkTrail {
  id: string;                    // e.g., "wi-devils-lake-ice-age"
  name: string;
  parkId: string;
  parkName: string;
  stateCode: string;
  
  // Distance & Difficulty
  lengthMiles?: number;
  elevationGainFeet?: number;
  difficulty?: 'easy' | 'moderate' | 'strenuous' | 'very_strenuous';
  trailType?: 'loop' | 'out_and_back' | 'point_to_point';
  
  // Time
  estimatedTimeMinutes?: number;
  
  // Content
  description?: string;
  highlights?: string[];
  
  // URLs
  officialUrl?: string;          // State park website
  googleMapsUrl: string;         // Always generated as fallback
  trailheadCoordinates?: {
    latitude: number;
    longitude: number;
  };
  
  // Enrichment tracking
  dataSource: 'dnr' | 'state_parks' | 'recreation_gov' | 'trailapi' | 'manual';
  lastUpdated: string;
  dataCompleteness: {
    hasDescription: boolean;
    hasDistance: boolean;
    hasElevation: boolean;
    hasDifficulty: boolean;
    hasOfficialUrl: boolean;
    hasCoordinates: boolean;
  };
}
```

---

## Scripts to Create

1. **`fetchWisconsinTrails.ts`** - Fetch from WI DNR sources
2. **`fetchFloridaTrails.ts`** - Fetch from FL State Parks
3. **`generateCoverageReport.ts`** - Track progress against goals
4. **`mergeTrailData.ts`** - Combine data from multiple sources
5. **`validateTrailData.ts`** - Check data quality and completeness

---

## Success Metrics

| Metric | Current | Phase 1 | Phase 2 | Phase 3 |
|--------|---------|---------|---------|---------|
| WI Parks | 10 | 25 | 40 | 50 |
| WI Trails | 29 | 150 | 300 | 400 |
| FL Parks | 9 | 50 | 100 | 150 |
| FL Trails | 100 | 400 | 800 | 1,000 |
| Trails with Official URL | 0% | 50% | 75% | 90% |
| Trails with Coordinates | ~50% | 75% | 90% | 95% |
| Data Freshness | Manual | Weekly | Weekly | Daily |
