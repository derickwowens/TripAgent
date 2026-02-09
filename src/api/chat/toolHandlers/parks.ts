/**
 * National Parks Tool Handlers
 * 
 * Handles national park searches, hikes, wildlife, campgrounds, and database lookups
 */

import { TravelFacade } from '../../../domain/facade/TravelFacade.js';
import { parkData } from '../../../providers/parks/parkDataProvider.js';
import { npsTrailAdapter } from '../../../providers/trails/NPSTrailAdapter.js';
import { findParkCode } from '../../../utils/parkCodeLookup.js';
import { generateGoogleMapsLink } from '../../../utils/linkUtils.js';
import { ChatContext, PhotoReference, resolveContextValue } from '../types.js';
import { resolveGatewayCity } from './shared.js';

/**
 * Collect NPS photos for parks
 */
async function collectNpsPhotos(
  parks: any[],
  collectedPhotos: PhotoReference[],
  targetCount: number
): Promise<void> {
  parks.forEach(park => {
    if (park.images && park.images.length > 0 && collectedPhotos.length < targetCount) {
      const isSmokies = park.parkCode === 'grsm' || park.name.toLowerCase().includes('smoky');
      
      if (isSmokies) {
        const smokiesPhotos = [
          'https://www.nps.gov/common/uploads/structured_data/3C80E3F4-1DD8-B71B-0BFF4F2280EF1B52.jpg',
          'https://www.nps.gov/common/uploads/structured_data/3C80E4A2-1DD8-B71B-0B92311ED9BAC3D0.jpg',
        ];
        smokiesPhotos.forEach((url, idx) => {
          if (collectedPhotos.length < targetCount) {
            collectedPhotos.push({
              keyword: idx === 0 ? park.name : `${park.name} photo ${idx + 1}`,
              url: url,
              caption: `${park.name} - National Park`,
              source: 'nps'
            });
          }
        });
      } else {
        const npsPhotos = park.images.slice(0, targetCount - collectedPhotos.length);
        npsPhotos.forEach((imageUrl: string, idx: number) => {
          collectedPhotos.push({
            keyword: idx === 0 ? park.name : `${park.name} photo ${idx + 1}`,
            url: imageUrl,
            caption: `${park.name} - National Park`,
            source: 'nps'
          });
        });
      }
    }
  });
  
  console.log(`[Chat] Park search: collected ${collectedPhotos.length} NPS photos`);
}

/**
 * Handle national park search
 */
export async function handleSearchNationalParks(
  input: { query: string },
  facade: TravelFacade,
  collectedPhotos: PhotoReference[]
): Promise<{ result: any; destination?: string; searchQuery?: string; npsGateway?: { city: string; state: string } }> {
  const rawQuery = input.query.toLowerCase();
  
  const knownParkCode = findParkCode(rawQuery);
  let parks;
  let searchQueryStr: string;
  
  if (knownParkCode) {
    console.log(`[Chat] NPS search: "${rawQuery}" -> found park code "${knownParkCode}"`);
    const parkDetails = await facade.getParkDetails(knownParkCode);
    parks = parkDetails ? [parkDetails.park] : await facade.searchNationalParks(knownParkCode);
    searchQueryStr = knownParkCode;
  } else {
    searchQueryStr = rawQuery
      .replace(/national park/gi, '')
      .replace(/national/gi, '')
      .replace(/park/gi, '')
      .trim();
    console.log(`[Chat] NPS search: "${rawQuery}" -> keyword search "${searchQueryStr}"`);
    parks = await facade.searchNationalParks(searchQueryStr);
  }
  
  const cleanQuery = rawQuery
    .replace(/national park/gi, '')
    .replace(/national/gi, '')
    .replace(/park/gi, '')
    .trim()
    .toLowerCase();
  
  const relevantParks = parks.filter(park => {
    const parkNameLower = park.name.toLowerCase();
    const parkCodeLower = park.parkCode.toLowerCase();
    
    const coreName = parkNameLower
      .replace(/ national park$/i, '')
      .replace(/ national historical park$/i, '')
      .replace(/ national historic site$/i, '')
      .replace(/ national monument$/i, '')
      .replace(/ national recreation area$/i, '')
      .trim();
    
    if (parkCodeLower === cleanQuery) return true;
    if (coreName === cleanQuery) return true;
    if (cleanQuery.length >= 3 && coreName.includes(cleanQuery)) return true;
    if (coreName.length >= 3 && cleanQuery.includes(coreName)) return true;
    if (cleanQuery.length >= 3 && parkNameLower.includes(cleanQuery)) return true;
    
    const searchWords = cleanQuery.split(/\s+/).filter((w: string) => w.length >= 3);
    if (searchWords.length > 1) {
      const parkWords = coreName.split(/[\s&]+/).filter((w: string) => w.length >= 2);
      const allWordsMatch = searchWords.every((sw: string) => 
        parkWords.some((pw: string) => pw === sw || pw.startsWith(sw) || sw.startsWith(pw))
      );
      if (allWordsMatch) return true;
    }
    
    return false;
  });
  
  console.log(`[Chat] Park filter: query="${searchQueryStr}" -> clean="${cleanQuery}", found=${parks.length}, relevant=${relevantParks.map(p => p.parkCode).join(', ') || 'none'}`);
  
  const parksForPhotos = relevantParks.slice(0, 2);
  const TARGET_NPS_PHOTOS = 16;
  
  let detectedDest: string | undefined;
  
  if (parksForPhotos.length > 0) {
    detectedDest = parksForPhotos[0].name;
    await collectNpsPhotos(parksForPhotos, collectedPhotos, TARGET_NPS_PHOTOS);
  } else {
    console.log(`[Chat] No NPS parks matched "${cleanQuery}" - no photos will be displayed`);
  }
  
  let npsGateway: { city: string; state: string } | undefined;
  if (parksForPhotos.length > 0) {
    const firstPark = parksForPhotos[0];
    const staticGateway = resolveGatewayCity(firstPark.name);
    if (staticGateway) {
      npsGateway = { city: staticGateway.city, state: staticGateway.state };
      console.log(`[Chat] NPS gateway city from static lookup: ${npsGateway.city}, ${npsGateway.state}`);
    } else if (firstPark.gatewayCity && firstPark.gatewayState) {
      npsGateway = { city: firstPark.gatewayCity, state: firstPark.gatewayState };
      console.log(`[Chat] NPS gateway city from API (fallback): ${npsGateway.city}, ${npsGateway.state}`);
    }
  }
  
  const parksWithUrls = parks.slice(0, 3).map(park => {
    const officialUrl = park.url || `https://www.nps.gov/${park.parkCode}/index.htm`;
    console.log(`[LinkGen] Park "${park.name}": officialUrl=${officialUrl}`);
    return {
      ...park,
      officialUrl,
      _linkNote: 'USE officialUrl for park links - do NOT construct subpage URLs',
    };
  });
  
  return {
    result: { parks: parksWithUrls },
    destination: detectedDest,
    searchQuery: cleanQuery,
    npsGateway
  };
}

/**
 * Handle park trip planning
 */
export async function handlePlanParkTrip(
  input: any,
  facade: TravelFacade,
  collectedPhotos: PhotoReference[],
  context: ChatContext
): Promise<any> {
  const travelers = input.adults || resolveContextValue<number>('numTravelers', context) || 1;
  
  const result = await facade.planParkTrip({
    parkCode: input.park_code,
    originAirport: input.origin_airport,
    arrivalDate: input.arrival_date,
    departureDate: input.departure_date,
    adults: travelers,
  });
  
  if (result.park?.images && result.park.images.length > 0) {
    const isSmokies = input.park_code === 'grsm' || result.park.name.toLowerCase().includes('smoky');
    
    if (isSmokies) {
      const smokiesPhotos = [
        'https://www.nps.gov/common/uploads/structured_data/3C80E3F4-1DD8-B71B-0BFF4F2280EF1B52.jpg',
        'https://www.nps.gov/common/uploads/structured_data/3C80E4A2-1DD8-B71B-0B92311ED9BAC3D0.jpg',
      ];
      smokiesPhotos.forEach((url, idx) => {
        collectedPhotos.push({
          keyword: idx === 0 ? result.park.name : `${result.park.name} photo ${idx + 1}`,
          url: url,
          caption: `${result.park.name} - National Park`,
          source: 'nps'
        });
      });
    } else {
      result.park.images.slice(0, 3).forEach((imageUrl: string, idx: number) => {
        collectedPhotos.push({
          keyword: idx === 0 ? result.park.name : `${result.park.name} photo ${idx + 1}`,
          url: imageUrl,
          caption: `${result.park.name} - National Park`,
          source: 'nps'
        });
      });
    }
  }
  
  if (result.activities) {
    result.activities.forEach((activity: any) => {
      if (activity.images && activity.images.length > 0) {
        collectedPhotos.push({
          keyword: activity.title,
          url: activity.images[0].url || activity.images[0],
          caption: activity.images[0].caption || activity.title,
          source: 'nps'
        });
      }
    });
  }
  
  if (result.lodging?.campgrounds) {
    result.lodging.campgrounds.forEach((camp: any) => {
      if (camp.images && camp.images.length > 0) {
        collectedPhotos.push({
          keyword: camp.name,
          url: camp.images[0].url || camp.images[0],
          caption: camp.images[0].caption || camp.name,
          source: 'nps'
        });
      }
    });
  }
  
  return result;
}

/**
 * Handle park hikes lookup
 */
export async function handleGetParkHikes(
  input: { park_code: string },
  facade: TravelFacade
): Promise<any> {
  const parkCode = input.park_code.toLowerCase();
  console.log(`[Hikes] Getting hikes for park: ${parkCode}`);
  
  // PRIORITY 1: Try S3 trail data
  const s3Trails = await parkData.getTrailsForPark(parkCode);
  
  if (s3Trails.length > 0) {
    console.log(`[Hikes] Found ${s3Trails.length} trails in S3 for ${parkCode}`);
    const parkName = s3Trails[0].parkName;
    const source = s3Trails[0].source || 'TripAgent Database';
    const isNPSData = source === 'NPS API';
    const hasAllTrailsUrls = s3Trails.some(t => t.alltrailsUrl);
    
    const result: any = {
      parkCode,
      parkName,
      hikes: s3Trails.map(trail => ({
        name: trail.name,
        description: trail.description,
        distance: trail.length,
        duration: trail.duration,
        difficulty: (trail.difficulty || 'moderate').replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
        trailType: trail.type,
        trailUrl: trail.trailUrl || trail.npsUrl || generateGoogleMapsLink(`${trail.name} trailhead ${parkName}`),
        allTrailsUrl: trail.alltrailsUrl,
        npsUrl: trail.npsUrl,
        googleMapsUrl: generateGoogleMapsLink(`${trail.name} trailhead ${parkName}`),
        imageUrl: trail.imageUrl,
      })),
      totalHikes: s3Trails.length,
      npsHikingUrl: `https://www.nps.gov/${parkCode}/planyourvisit/hiking.htm`,
      source: source,
      note: isNPSData 
        ? 'Official NPS trail pages with permits, conditions, and alerts.'
        : 'Use trail links to view details and get directions.',
    };
    
    if (hasAllTrailsUrls) {
      result.allTrailsDisclaimer = 'AllTrails links are search-based and may not find an exact match. Use Google Maps links for reliable navigation.';
    }
    
    return result;
  }
  
  // PRIORITY 2: Try NPS API
  const npsTrails = await npsTrailAdapter.getTrailsForPark(parkCode);
  
  if (npsTrails.length > 0) {
    console.log(`[Hikes] Found ${npsTrails.length} trails from NPS API for ${parkCode}`);
    const parkName = npsTrails[0].parkName || parkCode.toUpperCase();
    
    return {
      parkCode,
      parkName,
      hikes: npsTrails.map(trail => ({
        name: trail.name,
        description: trail.shortDescription,
        duration: trail.duration,
        trailUrl: trail.url,
        npsUrl: trail.url,
        googleMapsUrl: generateGoogleMapsLink(`${trail.name} trailhead ${parkName}`),
        reservationRequired: trail.reservationRequired,
        petsAllowed: trail.petsAllowed,
        imageUrl: trail.imageUrl,
      })),
      totalHikes: npsTrails.length,
      npsHikingUrl: `https://www.nps.gov/${parkCode}/planyourvisit/hiking.htm`,
      source: 'National Park Service API',
      note: 'Official NPS trail pages with permits, conditions, and alerts.',
    };
  }
  
  // PRIORITY 3: Fall back to built-in data
  const hikes = facade.getParkHikes(parkCode);
  const parkDetails = await facade.searchNationalParks(parkCode);
  const parkName = parkDetails?.[0]?.name || parkCode.toUpperCase();
  
  if (hikes.length === 0) {
    return {
      parkCode,
      parkName,
      hikes: [],
      message: `No trail data available for ${parkName}. Use the links below to find trails.`,
      npsHikingUrl: `https://www.nps.gov/${parkCode}/planyourvisit/hiking.htm`,
      googleMapsUrl: `https://www.google.com/maps/search/${encodeURIComponent(parkName + ' hiking trails')}`,
      source: 'Fallback search links',
      note: 'Visit the NPS hiking page for official trail information.',
    };
  }
  
  const hikesWithLinks = hikes.map(hike => ({
    ...hike,
    trailUrl: generateGoogleMapsLink(`${hike.name} trail ${parkName}`),
    googleMapsUrl: generateGoogleMapsLink(`${hike.name} trail ${parkName}`),
  }));
  
  return {
    parkCode,
    parkName,
    hikes: hikesWithLinks,
    totalHikes: hikesWithLinks.length,
    npsHikingUrl: `https://www.nps.gov/${parkCode}/planyourvisit/hiking.htm`,
    source: 'Built-in data (fallback)',
    note: 'Each hike includes a Google Maps link for directions.',
  };
}

/**
 * Handle wildlife lookup
 */
export async function handleGetWildlife(
  input: { park_code: string; category?: string },
  facade: TravelFacade,
  collectedPhotos: PhotoReference[]
): Promise<any> {
  const parkCode = input.park_code.toLowerCase();
  console.log(`[Chat] Wildlife query for park: ${parkCode}, category: ${input.category || 'all'}`);

  try {
    const species = await facade.getCommonWildlife(parkCode, input.category);
    
    if (species.length === 0) {
      return {
        parkCode,
        message: `No wildlife data available for park code "${parkCode}".`,
        species: [],
      };
    }

    species.slice(0, 12).forEach(s => {
      if (s.photoUrl) {
        collectedPhotos.push({
          keyword: s.commonName,
          url: s.photoUrl,
          caption: `${s.commonName} - ${s.count} observations (iNaturalist)`,
          source: 'other',
        });
      }
    });

    const grouped: Record<string, typeof species> = {};
    for (const s of species) {
      const cat = s.category || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(s);
    }

    const links: Array<{ label: string; url: string }> = [];
    species.slice(0, 5).forEach(s => {
      if (s.wikipediaUrl) {
        links.push({
          label: `${s.commonName} on Wikipedia`,
          url: s.wikipediaUrl,
        });
      }
    });

    return {
      parkCode,
      totalSpecies: species.length,
      wildlife: grouped,
      species: species.slice(0, 15).map(s => ({
        name: s.commonName,
        scientificName: s.scientificName,
        category: s.category,
        observations: s.count,
        photoUrl: s.photoUrl,
        officialUrl: s.wikipediaUrl,
        wikipediaUrl: s.wikipediaUrl,
        _linkNote: 'USE officialUrl/wikipediaUrl for species info',
      })),
      links: links.length > 0 ? links : undefined,
      dataSource: 'iNaturalist (research-grade observations)',
    };
  } catch (error: any) {
    console.error('Wildlife fetch error:', error.message);
    return {
      parkCode,
      error: `Failed to fetch wildlife data: ${error.message}`,
      species: [],
    };
  }
}

/**
 * Handle campgrounds lookup
 */
export async function handleGetCampgrounds(
  input: { park_code: string },
  facade: TravelFacade,
  context: ChatContext
): Promise<any> {
  const parkCode = input.park_code.toLowerCase();
  console.log(`[Chat] Campgrounds query for park: ${parkCode}`);
  
  const startDate = context.travelDates?.departure || context.tripContext?.legs?.[context.tripContext?.activeLeg || 0]?.dates?.start;
  const endDate = context.travelDates?.return || context.tripContext?.legs?.[context.tripContext?.activeLeg || 0]?.dates?.end;
  
  console.log(`[LinkGen] Campground dates from context: startDate=${startDate || 'none'}, endDate=${endDate || 'none'}`);

  try {
    const campgrounds = await facade.getCampgroundsFromRecreationGov(parkCode);
    
    if (campgrounds.length === 0) {
      return {
        parkCode,
        message: `No campground data found for park code "${parkCode}" on Recreation.gov.`,
        campgrounds: [],
        npsUrl: `https://www.nps.gov/${parkCode}/planyourvisit/camping.htm`,
      };
    }

    const links: Array<{ label: string; url: string }> = [];
    campgrounds.slice(0, 5).forEach(c => {
      if (c.reservable && c.reservationUrl) {
        links.push({
          label: `Reserve ${c.name}`,
          url: c.reservationUrl,
        });
      }
    });
    
    links.push({
      label: 'NPS Camping Information',
      url: `https://www.nps.gov/${parkCode}/planyourvisit/camping.htm`,
    });

    return {
      parkCode,
      totalCampgrounds: campgrounds.length,
      campgrounds: campgrounds.map(c => {
        let googleMapsUrl: string;
        let directionsUrl: string;
        
        if (c.coordinates.latitude && c.coordinates.longitude) {
          googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${c.coordinates.latitude},${c.coordinates.longitude}`;
          directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${c.coordinates.latitude},${c.coordinates.longitude}`;
        } else if (c.address) {
          const addressStr = [c.address.street, c.address.city, c.address.state, c.address.zip]
            .filter(Boolean)
            .join(', ');
          const addressQuery = encodeURIComponent(`${c.name}, ${addressStr}`);
          googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${addressQuery}`;
          directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${addressQuery}`;
        } else {
          const nameQuery = encodeURIComponent(c.name);
          googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${nameQuery}`;
          directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${nameQuery}`;
        }
        
        const campgroundSearchTerm = c.name;
        let recGovSearchUrl = `https://www.recreation.gov/search?q=${encodeURIComponent(campgroundSearchTerm)}&inventory_type=camping`;
        if (startDate && endDate) {
          recGovSearchUrl += `&start_date=${startDate}&end_date=${endDate}`;
        }
        
        const facilityId = c.id;
        let directCampgroundUrl = facilityId 
          ? `https://www.recreation.gov/camping/campgrounds/${facilityId}`
          : null;
        if (directCampgroundUrl && startDate && endDate) {
          directCampgroundUrl += `?start_date=${startDate}&end_date=${endDate}`;
        }
        
        let prefilledReservationUrl = c.reservationUrl;
        if (c.reservationUrl && startDate && endDate) {
          const separator = c.reservationUrl.includes('?') ? '&' : '?';
          prefilledReservationUrl = `${c.reservationUrl}${separator}start_date=${startDate}&end_date=${endDate}`;
        }
        
        const officialUrl = directCampgroundUrl || prefilledReservationUrl || recGovSearchUrl;
        
        return {
          name: c.name,
          description: c.description,
          type: c.type,
          reservable: c.reservable,
          facilityId: facilityId,
          officialUrl: officialUrl,
          directCampgroundUrl: directCampgroundUrl,
          reservationUrl: prefilledReservationUrl,
          recGovSearchUrl,
          travelDates: startDate && endDate ? { start: startDate, end: endDate } : undefined,
          phone: c.phone,
          email: c.email,
          feeDescription: c.feeDescription,
          coordinates: c.coordinates.latitude ? c.coordinates : undefined,
          address: c.address,
          directions: c.directions,
          adaAccess: c.adaAccess,
          activities: c.activities,
          amenities: c.amenities,
          campsiteTypes: c.campsiteTypes,
          totalCampsites: c.totalCampsites,
          equipmentAllowed: c.equipmentAllowed,
          googleMapsUrl,
          directionsUrl,
          _linkNote: 'USE officialUrl for campground booking',
        };
      }),
      links: links.length > 0 ? links : undefined,
      dataSource: 'Recreation.gov RIDB API',
      bookingNote: 'Book campgrounds at recreation.gov - popular sites fill months in advance!',
    };
  } catch (error: any) {
    console.error('Campgrounds fetch error:', error.message);
    return {
      parkCode,
      error: `Failed to fetch campground data: ${error.message}`,
      campgrounds: [],
      npsUrl: `https://www.nps.gov/${parkCode}/planyourvisit/camping.htm`,
    };
  }
}
