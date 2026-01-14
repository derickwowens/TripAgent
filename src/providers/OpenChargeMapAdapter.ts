/**
 * Open Charge Map API Adapter
 * Fetches EV charging station data including Tesla Superchargers
 * API Docs: https://openchargemap.org/site/develop/api
 */

import { BaseAdapter } from './base/BaseAdapter.js';

interface ChargingStation {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  distance: number; // in miles
  numPoints: number;
  operator: string;
  connectionTypes: string[];
  powerKW: number;
  isFastCharger: boolean;
  isTeslaSupercharger: boolean;
  usageCost: string;
  statusType: string;
}

interface OpenChargeMapResponse {
  ID: number;
  AddressInfo: {
    Title: string;
    AddressLine1: string;
    Town: string;
    StateOrProvince: string;
    Country: { ISOCode: string; Title: string };
    Latitude: number;
    Longitude: number;
    Distance: number;
    DistanceUnit: number;
  };
  NumberOfPoints: number;
  OperatorInfo: {
    ID: number;
    Title: string;
  } | null;
  Connections: Array<{
    ConnectionType: { Title: string };
    PowerKW: number;
    Level: { IsFastChargeCapable: boolean };
  }>;
  UsageCost: string | null;
  StatusType: { IsOperational: boolean; Title: string } | null;
}

export class OpenChargeMapAdapter extends BaseAdapter {
  name = 'openchargemaps';
  private baseUrl = 'https://api.openchargemap.io/v3/poi';
  private apiKey: string | undefined;

  constructor() {
    super();
    this.cacheTTL = 30 * 60 * 1000; // 30 min cache
    this.apiKey = process.env.OPEN_CHARGE_MAP_API_KEY;
  }

  /**
   * Search for charging stations near a location
   */
  async searchNearLocation(
    latitude: number,
    longitude: number,
    radiusMiles: number = 50,
    maxResults: number = 20,
    teslaOnly: boolean = false
  ): Promise<ChargingStation[]> {
    const cacheKey = this.generateCacheKey('ocm-location', { 
      latitude, longitude, radiusMiles, maxResults, teslaOnly 
    });

    return this.fetchWithCache(cacheKey, async () => {
      const params = new URLSearchParams({
        output: 'json',
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        distance: radiusMiles.toString(),
        distanceunit: 'Miles',
        maxresults: maxResults.toString(),
        compact: 'true',
        verbose: 'false',
        levelid: '3', // Level 3 = DC Fast Charging
      });

      // Tesla Supercharger operator ID is 23
      if (teslaOnly) {
        params.append('operatorid', '23');
      }

      // Add API key if available
      if (this.apiKey) {
        params.append('key', this.apiKey);
      }

      const response = await fetch(`${this.baseUrl}?${params}`);
      
      if (!response.ok) {
        throw new Error(`Open Charge Map API error: ${response.status}`);
      }

      const data = await response.json() as OpenChargeMapResponse[];
      return data.map(station => this.transformStation(station));
    });
  }

  /**
   * Search for charging stations along a route (between two points)
   */
  async searchAlongRoute(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    corridorWidthMiles: number = 25,
    maxResults: number = 15
  ): Promise<ChargingStation[]> {
    // Calculate midpoint and search radius to cover the route
    const midLat = (originLat + destLat) / 2;
    const midLng = (originLng + destLng) / 2;
    
    // Calculate approximate distance between points (Haversine simplified)
    const latDiff = Math.abs(destLat - originLat);
    const lngDiff = Math.abs(destLng - originLng);
    const approxDistanceMiles = Math.sqrt(latDiff ** 2 + lngDiff ** 2) * 69; // rough conversion
    
    // Search radius should cover half the route plus corridor width
    const searchRadius = Math.max(approxDistanceMiles / 2 + corridorWidthMiles, 50);

    const cacheKey = this.generateCacheKey('ocm-route', { 
      originLat, originLng, destLat, destLng, corridorWidthMiles 
    });

    return this.fetchWithCache(cacheKey, async () => {
      const params = new URLSearchParams({
        output: 'json',
        latitude: midLat.toString(),
        longitude: midLng.toString(),
        distance: searchRadius.toString(),
        distanceunit: 'Miles',
        maxresults: (maxResults * 2).toString(), // Get more, then filter
        compact: 'true',
        verbose: 'false',
        levelid: '3', // DC Fast Charging only
      });

      // Add API key if available
      if (this.apiKey) {
        params.append('key', this.apiKey);
      }

      const response = await fetch(`${this.baseUrl}?${params}`);
      
      if (!response.ok) {
        throw new Error(`Open Charge Map API error: ${response.status}`);
      }

      const data = await response.json() as OpenChargeMapResponse[];
      const stations = data.map(station => this.transformStation(station));
      
      // Filter to stations roughly along the route corridor
      const filteredStations = stations.filter(station => {
        return this.isNearRoute(
          station.latitude, 
          station.longitude,
          originLat, originLng,
          destLat, destLng,
          corridorWidthMiles
        );
      });

      // Sort by distance from origin and return top results
      return filteredStations
        .sort((a, b) => {
          const distA = this.haversineDistance(originLat, originLng, a.latitude, a.longitude);
          const distB = this.haversineDistance(originLat, originLng, b.latitude, b.longitude);
          return distA - distB;
        })
        .slice(0, maxResults);
    });
  }

  /**
   * Search for Tesla Superchargers specifically
   */
  async searchTeslaSuperchargers(
    latitude: number,
    longitude: number,
    radiusMiles: number = 100
  ): Promise<ChargingStation[]> {
    return this.searchNearLocation(latitude, longitude, radiusMiles, 20, true);
  }

  private transformStation(station: OpenChargeMapResponse): ChargingStation {
    const isTesla = station.OperatorInfo?.ID === 23 || 
                    station.OperatorInfo?.Title?.toLowerCase().includes('tesla');
    
    const connectionTypes = station.Connections?.map(c => c.ConnectionType?.Title).filter(Boolean) || [];
    const maxPower = Math.max(...(station.Connections?.map(c => c.PowerKW || 0) || [0]));
    const isFast = station.Connections?.some(c => c.Level?.IsFastChargeCapable) || maxPower >= 50;

    return {
      id: station.ID,
      name: station.AddressInfo?.Title || 'Unknown Station',
      address: station.AddressInfo?.AddressLine1 || '',
      city: station.AddressInfo?.Town || '',
      state: station.AddressInfo?.StateOrProvince || '',
      country: station.AddressInfo?.Country?.ISOCode || 'US',
      latitude: station.AddressInfo?.Latitude || 0,
      longitude: station.AddressInfo?.Longitude || 0,
      distance: station.AddressInfo?.Distance || 0,
      numPoints: station.NumberOfPoints || 1,
      operator: station.OperatorInfo?.Title || 'Unknown',
      connectionTypes,
      powerKW: maxPower,
      isFastCharger: isFast || false,
      isTeslaSupercharger: isTesla || false,
      usageCost: station.UsageCost || 'See station for pricing',
      statusType: station.StatusType?.Title || 'Unknown',
    };
  }

  private isNearRoute(
    pointLat: number, pointLng: number,
    originLat: number, originLng: number,
    destLat: number, destLng: number,
    corridorWidthMiles: number
  ): boolean {
    // Simple check: is the point within corridorWidthMiles of the line between origin and dest
    const distToLine = this.pointToLineDistance(
      pointLat, pointLng,
      originLat, originLng,
      destLat, destLng
    );
    return distToLine <= corridorWidthMiles;
  }

  private pointToLineDistance(
    px: number, py: number,
    x1: number, y1: number,
    x2: number, y2: number
  ): number {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    return this.haversineDistance(px, py, xx, yy);
  }

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

export default OpenChargeMapAdapter;
