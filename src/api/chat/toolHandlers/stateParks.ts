/**
 * State Parks Tool Handlers
 * 
 * Handles state park searches, details, campgrounds, and hikes
 */

import { TravelFacade } from '../../../domain/facade/TravelFacade.js';
import { StateParkService } from '../../../providers/parks/StateParkService.js';
import { s3ParkData } from '../../../providers/parks/S3ParkDataService.js';
import { generateGoogleMapsLink } from '../../../utils/linkUtils.js';
import { PhotoReference } from '../types.js';

// Initialize StateParkService
const stateParkService = new StateParkService(
  process.env.RECREATION_GOV_API_KEY,
  process.env.NPS_API_KEY
);

// State name lookup
export const STATE_NAMES: Record<string, string> = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
};

/**
 * Handle state park search
 */
export async function handleSearchStateParks(
  input: { state: string; query?: string },
  collectedPhotos: PhotoReference[],
  facade?: TravelFacade
): Promise<any> {
  console.log(`[State Parks] Searching parks in ${input.state}${input.query ? ` with query "${input.query}"` : ''}`);
  
  try {
    const results = await stateParkService.searchParks({
      state: input.state.toUpperCase(),
      query: input.query,
      limit: 20,
    });

    if (results.error) {
      return { error: results.error };
    }

    return {
      state: input.state.toUpperCase(),
      parks: results.parks.map(park => ({
        name: park.name,
        state: park.stateFullName,
        designation: park.designationLabel,
        acres: park.acresFormatted,
        publicAccess: park.publicAccess,
      })),
      totalCount: results.totalCount,
      hasMore: results.hasMore,
      campgroundsAvailable: results.campgroundsAvailable,
      note: 'Use get_state_park_details or get_state_park_campgrounds for more info on a specific park',
    };
  } catch (error: any) {
    console.error('State parks search error:', error.message);
    return { error: `Failed to search state parks: ${error.message}` };
  }
}

/**
 * Handle state park details
 */
export async function handleGetStateParkDetails(
  input: { park_name: string; state: string },
  collectedPhotos: PhotoReference[],
  facade?: TravelFacade
): Promise<any> {
  console.log(`[State Parks] Getting details for "${input.park_name}" in ${input.state}`);
  
  try {
    const park = await stateParkService.getParkDetails(input.park_name, input.state.toUpperCase());

    if (!park) {
      return { 
        error: `Park "${input.park_name}" not found in ${input.state}. Try searching with search_state_parks first.` 
      };
    }

    // Collect RIDB park-level photos (Recreation.gov - authoritative source for state parks)
    if (park.photos && park.photos.length > 0) {
      park.photos.slice(0, 5).forEach((photo, idx) => {
        collectedPhotos.push({
          keyword: idx === 0 ? park.name : `${park.name} photo ${idx + 1}`,
          url: photo.url,
          caption: photo.title || photo.description || `${park.name} - ${park.stateFullName}`,
          source: 'other',
        });
      });
      console.log(`[State Parks] Collected ${Math.min(park.photos.length, 5)} RIDB photos for "${park.name}"`);
    }

    // Collect campground photos (from Recreation.gov / OSM)
    if (park.campgrounds && park.campgrounds.length > 0) {
      park.campgrounds.forEach(cg => {
        if (cg.photos && cg.photos.length > 0) {
          cg.photos.slice(0, 2).forEach(photo => {
            collectedPhotos.push({
              keyword: cg.name,
              url: photo.url,
              caption: photo.caption || `${cg.name} - Campground`,
              source: 'other',
            });
          });
        }
      });
    }

    return {
      name: park.name,
      state: park.stateFullName,
      designation: park.designationLabel,
      acres: park.acresFormatted,
      publicAccess: park.publicAccess,
      manager: park.managerName,
      hasCamping: park.hasCamping,
      campgroundCount: park.campgroundCount,
      campgrounds: park.campgrounds.slice(0, 5).map(cg => ({
        name: cg.name,
        source: cg.source,
        reservable: cg.reservable,
        reservationUrl: cg.reservationUrl,
        totalSites: cg.totalSites,
        amenities: cg.amenities,
        hasPhotos: cg.photos.length > 0,
      })),
    };
  } catch (error: any) {
    console.error('State park details error:', error.message);
    return { error: `Failed to get park details: ${error.message}` };
  }
}

/**
 * Handle state park campgrounds
 */
export async function handleGetStateParkCampgrounds(
  input: { park_name: string; state: string },
  collectedPhotos: PhotoReference[]
): Promise<any> {
  console.log(`[State Parks] Getting campgrounds for "${input.park_name}" in ${input.state}`);
  
  try {
    const campgrounds = await stateParkService.getCampgroundsForPark(
      input.park_name, 
      input.state.toUpperCase()
    );

    campgrounds.forEach(cg => {
      if (cg.photos && cg.photos.length > 0) {
        cg.photos.slice(0, 2).forEach(photo => {
          collectedPhotos.push({
            keyword: cg.name,
            url: photo.url,
            caption: photo.caption || `${cg.name} - ${cg.source}`,
            source: cg.source === 'nps' ? 'nps' : 'other',
          });
        });
      }
    });

    return {
      parkName: input.park_name,
      state: input.state.toUpperCase(),
      campgrounds: campgrounds.map(cg => ({
        name: cg.name,
        source: cg.source,
        description: cg.description,
        reservable: cg.reservable,
        reservationUrl: cg.reservationUrl,
        totalSites: cg.totalSites,
        fees: cg.fees,
        amenities: cg.amenities,
        coordinates: cg.coordinates,
        photos: cg.photos.slice(0, 3).map(p => ({
          url: p.url,
          caption: p.caption,
        })),
      })),
      totalCount: campgrounds.length,
      sources: ['recreation.gov', 'nps'],
      note: campgrounds.length === 0 
        ? 'No campgrounds found for this park. Try a nearby state park or check Recreation.gov directly.'
        : 'Book campgrounds early - popular sites fill up months in advance!',
    };
  } catch (error: any) {
    console.error('State park campgrounds error:', error.message);
    return { error: `Failed to get campgrounds: ${error.message}` };
  }
}

/**
 * Handle state park hikes
 */
export async function handleGetStateParkHikes(
  input: { park_name: string; state: string }
): Promise<any> {
  console.log(`[State Parks] Getting hikes for "${input.park_name}" in ${input.state}`);
  
  const stateCode = input.state.toUpperCase() as 'WI' | 'FL' | 'CA' | 'TX' | 'CO' | 'OR' | 'AZ' | 'UT' | 'WA' | 'MI';
  const stateName = STATE_NAMES[stateCode] || input.state;
  const parkName = input.park_name;
  
  const googleMapsQuery = encodeURIComponent(`${parkName} hiking trails ${stateName}`);
  const googleMapsUrl = `https://www.google.com/maps/search/${googleMapsQuery}`;
  
  // States with S3 trail data
  const supportedStates = ['WI', 'FL', 'CA', 'TX', 'CO', 'OR', 'AZ', 'UT', 'WA', 'MI'];
  if (supportedStates.includes(stateCode)) {
    const parkId = parkName
      .toLowerCase()
      .replace(/\s*(state\s*park|state\s*forest|national\s*preserve|national\s*forest)\s*/gi, '')
      .trim()
      .replace(/\s+/g, '-');
    
    console.log(`[State Parks] Looking up S3 trail data for ${stateCode}/${parkId}`);
    const supportedState = stateCode as 'WI' | 'FL' | 'CA' | 'TX' | 'CO' | 'OR' | 'AZ' | 'UT' | 'WA' | 'MI';
    const s3Trails = await s3ParkData.getTrailsForStatePark(supportedState, parkId);
    
    // Also get nearby state trails that pass near this park
    const nearbyStateTrails = await s3ParkData.getNearbyStateTrails(supportedState, parkId);
    
    if (s3Trails.length > 0 || nearbyStateTrails.length > 0) {
      console.log(`[State Parks] Found ${s3Trails.length} park trails and ${nearbyStateTrails.length} nearby state trails`);
      
      // Check if any trails have AllTrails URLs
      const hasAllTrailsUrls = s3Trails.some(t => t.alltrailsUrl);
      
      const result: any = {
        parkName: parkName,
        state: stateCode,
        stateName: stateName,
        hikes: s3Trails.map(trail => ({
          name: trail.name,
          distance: trail.length,
          difficulty: (trail.difficulty || 'moderate').replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
          trailType: trail.type,
          trailUrl: trail.trailUrl || generateGoogleMapsLink(`${trail.name} trail ${parkName} ${stateName}`),
          allTrailsUrl: trail.alltrailsUrl,
          googleMapsUrl: trail.googleMapsUrl || generateGoogleMapsLink(`${trail.name} trail ${parkName} ${stateName}`),
        })),
        totalHikes: s3Trails.length,
        googleMapsUrl: googleMapsUrl,
        source: 'TripAgent Database',
        note: 'Trail data from our curated database.',
        allTrailsDisclaimer: hasAllTrailsUrls 
          ? 'AllTrails links are search-based and may not find an exact match. Use Google Maps links for reliable navigation.'
          : undefined,
      };
      
      // Add nearby state trails if available
      if (nearbyStateTrails.length > 0) {
        result.nearbyStateTrails = nearbyStateTrails.slice(0, 5).map(trail => ({
          name: trail.name,
          distance: trail.length,
          trailUrl: trail.trailUrl,
          googleMapsUrl: trail.googleMapsUrl,
          nearbyParks: trail.nearbyParks?.slice(0, 3),
        }));
        result.nearbyStateTrailsNote = `${nearbyStateTrails.length} longer multi-use trails pass within 50 miles of this park.`;
      }
      
      return result;
    }
  }
  
  return {
    parkName: parkName,
    state: stateCode,
    stateName: stateName,
    hikes: [],
    trailResources: [
      {
        name: 'Google Maps',
        description: 'View trail locations, get directions, and see satellite imagery',
        url: googleMapsUrl,
        features: ['Directions', 'Satellite view', 'Nearby amenities', 'Trail photos'],
      },
    ],
    googleMapsUrl: googleMapsUrl,
    hikingTips: [
      'Check trail conditions before your visit',
      'Bring plenty of water, especially on longer hikes',
      'Start early to avoid crowds and afternoon heat',
      'Download offline maps in Google Maps before heading out',
    ],
    note: `Use Google Maps to explore hiking trails at ${parkName}.`,
    source: 'Search links (park not in trail database)',
  };
}

/**
 * Handle state-wide trails lookup (Wisconsin State Trails, Florida State Trails)
 */
export async function handleGetStateTrails(
  input: { state: string }
): Promise<any> {
  const stateCode = input.state.toUpperCase() as 'WI' | 'FL';
  const stateName = STATE_NAMES[stateCode] || input.state;
  
  if (stateCode !== 'WI' && stateCode !== 'FL') {
    return {
      state: stateCode,
      stateName: stateName,
      trails: [],
      note: `State trail data is currently available for Wisconsin and Florida.`,
    };
  }
  
  console.log(`[State Parks] Getting state-wide trails for ${stateCode}`);
  const stateTrails = await s3ParkData.getStateTrails(stateCode);
  
  return {
    state: stateCode,
    stateName: stateName,
    categoryName: stateCode === 'WI' ? 'Wisconsin State Trails' : 'Florida State Trails',
    trails: stateTrails.map(trail => ({
      name: trail.name,
      distance: trail.length,
      trailUrl: trail.trailUrl,
      googleMapsUrl: trail.googleMapsUrl,
      nearbyParks: trail.nearbyParks?.slice(0, 3),
    })),
    totalTrails: stateTrails.length,
    note: `These are longer multi-use trails that span regions of ${stateName}. Each trail shows nearby state parks.`,
    source: 'TripAgent Database',
  };
}
