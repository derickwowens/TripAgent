/**
 * Park Database Tool Handlers
 * 
 * Handles S3 park database lookups, nearby parks, and stats
 */

import { TravelFacade } from '../../../domain/facade/TravelFacade.js';
import { parkData } from '../../../providers/parks/parkDataProvider.js';
import { StateParkService } from '../../../providers/parks/StateParkService.js';
import { findParkCode } from '../../../utils/parkCodeLookup.js';
import { PhotoReference } from '../types.js';
import { STATE_NAMES } from './stateParks.js';

// Initialize StateParkService for fallback
const stateParkService = new StateParkService(
  process.env.RECREATION_GOV_API_KEY,
  process.env.NPS_API_KEY
);

/**
 * Handle park database lookup
 */
export async function handleLookupParkDatabase(
  input: { query?: string; park_id?: string; category?: 'national' | 'state' | 'all'; state_code?: string },
  collectedPhotos: PhotoReference[],
  facade?: TravelFacade
): Promise<any> {
  console.log(`[S3 Park DB] Lookup: query="${input.query}", park_id="${input.park_id}", category="${input.category}"`);
  
  let s3Failed = false;
  
  try {
    if (input.park_id) {
      const park = await parkData.getParkById(input.park_id);
      if (park) {
        if (park.images && park.images.length > 0) {
          park.images.slice(0, 5).forEach((img, idx) => {
            collectedPhotos.push({
              keyword: idx === 0 ? park.name : `${park.name} photo ${idx + 1}`,
              url: img.url,
              caption: img.caption || park.name,
              source: park.category === 'national' ? 'nps' : 'other'
            });
          });
        }
        
        const context = await parkData.buildParkContext(input.park_id);
        
        return {
          park: park,
          context: context,
          source: 'TripAgent Database',
          note: 'This data is from our authoritative park database',
        };
      }
      s3Failed = true;
      console.log(`[S3 Park DB] Park ${input.park_id} not found in S3, trying fallback...`);
    }
    
    if (input.query) {
      const results = await parkData.searchParks(input.query, {
        category: input.category || 'all',
        stateCode: input.state_code,
        limit: 10,
      });
      
      if (results.length > 0) {
        const topPark = await parkData.getParkById(results[0].id);
        
        if (topPark?.images && topPark.images.length > 0) {
          topPark.images.slice(0, 3).forEach((img, idx) => {
            collectedPhotos.push({
              keyword: idx === 0 ? topPark.name : `${topPark.name} photo ${idx + 1}`,
              url: img.url,
              caption: img.caption || topPark.name,
              source: topPark.category === 'national' ? 'nps' : 'other'
            });
          });
        }
        
        return {
          parks: results,
          topResult: topPark,
          totalResults: results.length,
          source: 'TripAgent Database',
        };
      }
      s3Failed = true;
      console.log(`[S3 Park DB] No results for "${input.query}" in S3, trying fallback...`);
    }
    
  } catch (error: any) {
    console.error(`[S3 Park DB] S3 error: ${error.message}, trying fallback...`);
    s3Failed = true;
  }
  
  // Fallback to NPS API or State Park Service
  if (s3Failed && facade) {
    console.log(`[S3 Park DB] Using fallback APIs...`);
    
    const query = input.query || input.park_id?.replace('np-', '') || '';
    const category = input.category || 'all';
    
    if (category === 'all' || category === 'national') {
      try {
        const parkCode = findParkCode(query);
        let parks;
        
        if (parkCode) {
          const details = await facade.getParkDetails(parkCode);
          parks = details ? [details.park] : await facade.searchNationalParks(parkCode);
        } else {
          parks = await facade.searchNationalParks(query);
        }
        
        if (parks && parks.length > 0) {
          const firstPark = parks[0];
          if (firstPark.images && firstPark.images.length > 0) {
            firstPark.images.slice(0, 3).forEach((img: string, idx: number) => {
              collectedPhotos.push({
                keyword: idx === 0 ? firstPark.name : `${firstPark.name} photo ${idx + 1}`,
                url: img,
                caption: firstPark.name,
                source: 'nps'
              });
            });
          }
          
          return {
            parks: parks.slice(0, 10).map((p: any) => ({
              id: `np-${p.parkCode}`,
              name: p.name,
              parkCode: p.parkCode,
              stateCode: p.states?.split(',')[0] || '',
              designation: p.designation,
              coordinates: { latitude: parseFloat(p.latitude) || 0, longitude: parseFloat(p.longitude) || 0 },
            })),
            topResult: parks[0],
            totalResults: parks.length,
            source: 'NPS API (fallback)',
            note: 'S3 database unavailable, using NPS API directly',
          };
        }
      } catch (npsError: any) {
        console.error(`[S3 Park DB] NPS fallback failed: ${npsError.message}`);
      }
    }
    
    if (category === 'all' || category === 'state') {
      try {
        const stateCode = input.state_code || '';
        if (stateCode) {
          const stateParks = await stateParkService.searchParks({ state: stateCode, query });
          if (stateParks && stateParks.parks && stateParks.parks.length > 0) {
            return {
              parks: stateParks.parks.slice(0, 10).map((p: any) => ({
                id: `${stateCode.toLowerCase()}-${p.name.toLowerCase().replace(/\s+/g, '-')}`,
                name: p.name,
                stateCode: stateCode,
                category: 'state',
                acres: p.gisAcres,
              })),
              totalResults: stateParks.parks.length,
              source: 'State Park Service (fallback)',
              note: 'S3 database unavailable, using State Park Service directly',
            };
          }
        }
      } catch (stateError: any) {
        console.error(`[S3 Park DB] State park fallback failed: ${stateError.message}`);
      }
    }
  }
  
  if (!input.query && !input.park_id) {
    return { error: 'Please provide either a query or park_id' };
  }
  
  return { 
    parks: [],
    message: `No parks found matching "${input.query || input.park_id}"`,
    source: 'No data available',
  };
}

/**
 * Handle parks near location lookup
 */
export async function handleGetParksNearLocation(
  input: { latitude: number; longitude: number; radius_miles?: number; category?: 'national' | 'state' | 'all'; limit?: number }
): Promise<any> {
  console.log(`[S3 Park DB] Parks near (${input.latitude}, ${input.longitude}), radius=${input.radius_miles || 50}mi`);
  
  try {
    const parks = await parkData.getParksNearLocation(
      input.latitude,
      input.longitude,
      input.radius_miles || 50,
      {
        category: input.category || 'all',
        limit: input.limit || 10,
      }
    );
    
    return {
      location: { latitude: input.latitude, longitude: input.longitude },
      radiusMiles: input.radius_miles || 50,
      parks: parks,
      totalFound: parks.length,
      source: 'TripAgent S3 Database',
    };
    
  } catch (error: any) {
    console.error(`[S3 Park DB] Error: ${error.message}`);
    return { error: `Failed to find nearby parks: ${error.message}` };
  }
}

/**
 * Handle park database stats
 */
export async function handleGetParkDatabaseStats(): Promise<any> {
  console.log(`[S3 Park DB] Getting database stats`);
  
  try {
    const stats = await parkData.getStats();
    
    if (!stats) {
      return { error: 'Could not retrieve database statistics' };
    }
    
    return {
      database: {
        totalParks: stats.totalParks,
        nationalParks: stats.nationalParks,
        stateParks: stats.stateParks,
        statesWithData: stats.statesWithData,
        lastUpdated: stats.lastUpdated,
      },
      coverage: {
        npsDesignations: [
          'National Parks (63)',
          'National Monuments (85+)',
          'National Historic Sites (80+)',
          'National Memorials (30+)',
          'National Battlefields (25+)',
          'National Seashores/Lakeshores (15+)',
          'National Recreation Areas (18+)',
        ],
        stateParks: stats.statesWithData.map(s => `${s} (${STATE_NAMES[s] || s})`),
      },
      source: 'TripAgent S3 Database',
      note: 'This is our authoritative park database',
    };
    
  } catch (error: any) {
    console.error(`[S3 Park DB] Error: ${error.message}`);
    return { error: `Failed to get database stats: ${error.message}` };
  }
}
