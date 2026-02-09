/**
 * Park Database Tool Handlers
 * 
 * Handles park database lookups, nearby parks, and stats via PostgreSQL.
 */

import { TravelFacade } from '../../../domain/facade/TravelFacade.js';
import { parkData } from '../../../providers/parks/parkDataProvider.js';
import { PhotoReference } from '../types.js';
import { STATE_NAMES } from './stateParks.js';

/**
 * Handle park database lookup
 */
export async function handleLookupParkDatabase(
  input: { query?: string; park_id?: string; category?: 'national' | 'state' | 'all'; state_code?: string },
  collectedPhotos: PhotoReference[],
  facade?: TravelFacade
): Promise<any> {
  console.log(`[Park DB] Lookup: query="${input.query}", park_id="${input.park_id}", category="${input.category}"`);
  
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
        
        return {
          park: park,
          source: 'TripAgent Database',
          note: 'This data is from our authoritative park database',
        };
      }
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
    }
  } catch (error: any) {
    console.error(`[Park DB] Error: ${error.message}`);
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
  console.log(`[Park DB] Parks near (${input.latitude}, ${input.longitude}), radius=${input.radius_miles || 50}mi`);
  
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
      source: 'TripAgent Database',
    };
    
  } catch (error: any) {
    console.error(`[Park DB] Error: ${error.message}`);
    return { error: `Failed to find nearby parks: ${error.message}` };
  }
}

/**
 * Handle park database stats
 */
export async function handleGetParkDatabaseStats(): Promise<any> {
  console.log(`[Park DB] Getting database stats`);
  
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
      source: 'TripAgent Database',
      note: 'This is our authoritative park database',
    };
    
  } catch (error: any) {
    console.error(`[Park DB] Error: ${error.message}`);
    return { error: `Failed to get database stats: ${error.message}` };
  }
}
