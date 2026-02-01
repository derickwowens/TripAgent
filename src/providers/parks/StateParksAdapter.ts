import { BaseAdapter } from '../base/BaseAdapter.js';

// PAD-US ArcGIS API Response Types
interface PADUSQueryResponse {
  features: PADUSFeature[];
  exceededTransferLimit?: boolean;
}

interface PADUSFeature {
  attributes: PADUSAttributes;
  geometry?: {
    rings?: number[][][];
    x?: number;
    y?: number;
  };
}

interface PADUSStatisticsResponse {
  features: {
    attributes: Record<string, string | number>;
  }[];
}

interface PADUSAttributes {
  OBJECTID: number;
  FeatClass: string;
  Category: string;
  Own_Type: string;      // STAT = State
  Own_Name: string;
  Loc_Own: string;
  Mang_Type: string;     // STAT = State
  Mang_Name: string;     // e.g., "SDPR" (State Department of Parks and Recreation)
  Loc_Mang: string;
  Des_Tp: string;        // SP = State Park, SRA = State Recreation Area, etc.
  Loc_Ds: string;
  Unit_Nm: string;       // Park name
  Loc_Nm: string;
  State_Nm: string;      // State code (e.g., "CA", "TX")
  Agg_Src: string;
  GIS_Src: string;
  Src_Date: string;
  GIS_Acres: number;
  Pub_Access: string;    // OA = Open Access, RA = Restricted, XA = Closed
  Access_Src: string;
  GAP_Sts: string;
  Date_Est: string;
  Comments: string;
  WebMercAc: number;
  Shape__Area: number;
  Shape__Length: number;
}

// Output Types
export interface StatePark {
  id: string;
  name: string;
  localName?: string;
  state: string;
  stateFullName: string;
  designationType: string;
  designationLabel: string;
  acres: number;
  publicAccess: 'Open' | 'Restricted' | 'Closed' | 'Unknown';
  managerName: string;
  ownerName: string;
  dateEstablished?: string;
  dataSource: string;
  sourceDate: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

export interface StateParksSearchParams {
  state?: string;           // State code (e.g., "CA", "TX")
  query?: string;           // Search by park name
  designationType?: string; // SP, SRA, SHCA, etc.
  publicAccess?: 'OA' | 'RA' | 'XA';
  limit?: number;
  offset?: number;
}

// State code to full name mapping
const STATE_NAMES: Record<string, string> = {
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
  DC: 'District of Columbia', PR: 'Puerto Rico', VI: 'Virgin Islands', GU: 'Guam',
  AS: 'American Samoa', MP: 'Northern Mariana Islands',
};

// Designation type codes to human-readable labels
const DESIGNATION_LABELS: Record<string, string> = {
  SP: 'State Park',
  SRA: 'State Recreation Area',
  SHCA: 'State Historic or Cultural Area',
  SW: 'State Wilderness',
  SRMA: 'State Resource Management Area',
  SREC: 'State Recreation Area',
  SHPA: 'State Historic Preservation Area',
  SCA: 'State Conservation Area',
  SNA: 'State Natural Area',
  SNRA: 'State Natural Reserve Area',
  SFW: 'State Fish and Wildlife Area',
  OTHS: 'State Other or Unknown',
};

// Manager name codes to labels
const MANAGER_LABELS: Record<string, string> = {
  SDPR: 'State Department of Parks and Recreation',
  SDNR: 'State Department of Natural Resources',
  SFW: 'State Fish and Wildlife',
  SDOL: 'State Department of Lands',
  SHPO: 'State Historic Preservation Office',
  OTHS: 'Other State Agency',
};

export class StateParksAdapter extends BaseAdapter {
  name = 'padus';
  
  // PAD-US ArcGIS Feature Service endpoint
  private baseUrl = 'https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/Manager_Name/FeatureServer/0';

  constructor() {
    super();
    this.cacheTTL = 24 * 60 * 60 * 1000; // 24 hour cache - PAD-US data is relatively static
  }

  /**
   * Search for state parks using the PAD-US database
   */
  async searchStateParks(params: StateParksSearchParams = {}): Promise<StatePark[]> {
    const { state, query, designationType, publicAccess, limit = 100, offset = 0 } = params;
    
    const cacheKey = this.generateCacheKey('padus-state-parks', params);

    return this.fetchWithCache(cacheKey, async () => {
      // Build WHERE clause for state-managed parks
      const whereClauses: string[] = [
        "Mang_Type = 'STAT'",  // State managed
      ];

      // Filter by state
      if (state) {
        whereClauses.push(`State_Nm = '${state.toUpperCase()}'`);
      }

      // Filter by designation type (SP = State Park, SRA = State Recreation Area, etc.)
      if (designationType) {
        whereClauses.push(`Des_Tp = '${designationType}'`);
      } else {
        // Default to common state park designations
        whereClauses.push("(Des_Tp = 'SP' OR Des_Tp = 'SRA' OR Des_Tp = 'SHCA' OR Des_Tp = 'SREC')");
      }

      // Filter by public access
      if (publicAccess) {
        whereClauses.push(`Pub_Access = '${publicAccess}'`);
      }

      // Search by name
      if (query) {
        whereClauses.push(`(Unit_Nm LIKE '%${query}%' OR Loc_Nm LIKE '%${query}%')`);
      }

      const whereClause = whereClauses.join(' AND ');

      // Build query URL
      const queryParams = new URLSearchParams({
        where: whereClause,
        outFields: '*',
        returnGeometry: 'true',
        returnCentroid: 'true',
        outSR: '4326', // WGS84 for lat/lng coordinates
        resultOffset: offset.toString(),
        resultRecordCount: limit.toString(),
        orderByFields: 'Unit_Nm ASC',
        f: 'json',
      });

      const url = `${this.baseUrl}/query?${queryParams}`;
      
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`PAD-US API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as PADUSQueryResponse;
      
      if (!data.features) {
        return [];
      }

      return data.features.map(feature => this.transformPark(feature));
    });
  }

  /**
   * Get all state parks for a specific state
   */
  async getStateParksByState(stateCode: string): Promise<StatePark[]> {
    return this.searchStateParks({ state: stateCode, limit: 500 });
  }

  /**
   * Get a specific state park by name
   */
  async getStateParkByName(name: string, stateCode?: string): Promise<StatePark | null> {
    const results = await this.searchStateParks({
      query: name,
      state: stateCode,
      limit: 1,
    });
    return results[0] || null;
  }

  /**
   * Get count of state parks by state
   */
  async getStateParkCounts(): Promise<Record<string, number>> {
    const cacheKey = this.generateCacheKey('padus-state-park-counts', {});

    return this.fetchWithCache(cacheKey, async () => {
      // Query for count grouped by state
      const queryParams = new URLSearchParams({
        where: "Mang_Type = 'STAT' AND (Des_Tp = 'SP' OR Des_Tp = 'SRA' OR Des_Tp = 'SHCA' OR Des_Tp = 'SREC')",
        outFields: 'State_Nm',
        returnGeometry: 'false',
        returnCountOnly: 'false',
        groupByFieldsForStatistics: 'State_Nm',
        outStatistics: JSON.stringify([{
          statisticType: 'count',
          onStatisticField: 'OBJECTID',
          outStatisticFieldName: 'park_count',
        }]),
        f: 'json',
      });

      const url = `${this.baseUrl}/query?${queryParams}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`PAD-US API error: ${response.status}`);
      }

      const data = await response.json() as PADUSStatisticsResponse;
      const counts: Record<string, number> = {};

      if (data.features) {
        for (const feature of data.features) {
          const state = feature.attributes.State_Nm as string;
          const count = feature.attributes.park_count as number;
          if (state) {
            counts[state] = count;
          }
        }
      }

      return counts;
    });
  }

  /**
   * Get all unique designation types for state parks
   */
  async getDesignationTypes(): Promise<{ code: string; label: string; count: number }[]> {
    const cacheKey = this.generateCacheKey('padus-designation-types', {});

    return this.fetchWithCache(cacheKey, async () => {
      const queryParams = new URLSearchParams({
        where: "Mang_Type = 'STAT'",
        outFields: 'Des_Tp',
        returnGeometry: 'false',
        groupByFieldsForStatistics: 'Des_Tp',
        outStatistics: JSON.stringify([{
          statisticType: 'count',
          onStatisticField: 'OBJECTID',
          outStatisticFieldName: 'type_count',
        }]),
        f: 'json',
      });

      const url = `${this.baseUrl}/query?${queryParams}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`PAD-US API error: ${response.status}`);
      }

      const data = await response.json() as PADUSStatisticsResponse;
      const types: { code: string; label: string; count: number }[] = [];

      if (data.features) {
        for (const feature of data.features) {
          const code = feature.attributes.Des_Tp as string;
          if (code) {
            types.push({
              code,
              label: DESIGNATION_LABELS[code] || code,
              count: feature.attributes.type_count as number,
            });
          }
        }
      }

      return types.sort((a, b) => b.count - a.count);
    });
  }

  /**
   * Get list of all US states with state parks
   */
  getStates(): { code: string; name: string }[] {
    return Object.entries(STATE_NAMES)
      .filter(([code]) => code.length === 2 && !['DC', 'PR', 'VI', 'GU', 'AS', 'MP'].includes(code))
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get state full name from code
   */
  getStateName(code: string): string {
    return STATE_NAMES[code.toUpperCase()] || code;
  }

  /**
   * Get designation label from code
   */
  getDesignationLabel(code: string): string {
    return DESIGNATION_LABELS[code] || code;
  }

  private transformPark(feature: PADUSFeature): StatePark {
    const attrs = feature.attributes;

    // Determine public access level
    let publicAccess: 'Open' | 'Restricted' | 'Closed' | 'Unknown' = 'Unknown';
    switch (attrs.Pub_Access) {
      case 'OA': publicAccess = 'Open'; break;
      case 'RA': publicAccess = 'Restricted'; break;
      case 'XA': publicAccess = 'Closed'; break;
    }

    // Calculate centroid from geometry
    let latitude = 0;
    let longitude = 0;
    if (feature.geometry) {
      if (feature.geometry.x !== undefined && feature.geometry.y !== undefined) {
        // Point geometry
        longitude = feature.geometry.x;
        latitude = feature.geometry.y;
      } else if (feature.geometry.rings && feature.geometry.rings.length > 0) {
        // Polygon - calculate centroid from first ring
        const ring = feature.geometry.rings[0];
        let sumX = 0, sumY = 0;
        for (const point of ring) {
          sumX += point[0];
          sumY += point[1];
        }
        longitude = sumX / ring.length;
        latitude = sumY / ring.length;
      }
    }

    return {
      id: `padus-${attrs.OBJECTID}`,
      name: attrs.Unit_Nm || attrs.Loc_Nm || 'Unknown',
      localName: attrs.Loc_Nm || undefined,
      state: attrs.State_Nm || '',
      stateFullName: STATE_NAMES[attrs.State_Nm] || attrs.State_Nm || '',
      designationType: attrs.Des_Tp || '',
      designationLabel: DESIGNATION_LABELS[attrs.Des_Tp] || attrs.Des_Tp || 'Unknown',
      acres: attrs.GIS_Acres || 0,
      publicAccess,
      managerName: MANAGER_LABELS[attrs.Mang_Name] || attrs.Loc_Mang || attrs.Mang_Name || '',
      ownerName: attrs.Loc_Own || attrs.Own_Name || '',
      dateEstablished: attrs.Date_Est || undefined,
      dataSource: attrs.Agg_Src || 'PAD-US',
      sourceDate: attrs.Src_Date || '',
      coordinates: { latitude, longitude },
    };
  }
}
