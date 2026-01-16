/**
 * Chat module - Main entry point
 * 
 * This module handles Claude AI chat interactions for TripAgent.
 * It orchestrates tool definitions, handlers, and response processing.
 */

import Anthropic from '@anthropic-ai/sdk';
import { TravelFacade } from '../../domain/facade/TravelFacade.js';
import { GoogleMapsAdapter } from '../../providers/GoogleMapsAdapter.js';
import { OpenChargeMapAdapter } from '../../providers/OpenChargeMapAdapter.js';
import { findParkCode } from '../../utils/parkCodeLookup.js';
import { getUnsplashAdapter } from '../../providers/UnsplashAdapter.js';

// Re-export types
export * from './types.js';

// Import modular components
import { ChatMessage, ChatContext, ChatResponse, PhotoReference } from './types.js';
import { SYSTEM_PROMPT, DEFAULT_MODEL, buildContextInfo } from './systemPrompt.js';
import { tools } from './toolDefinitions.js';
import { validateAndCleanResponse } from './responseProcessor.js';

// Import park features mapping
import { PARK_FEATURES } from './parkFeatures.js';

let anthropic: Anthropic | null = null;

const getAnthropicClient = () => {
  if (!anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not set in environment');
    }
    anthropic = new Anthropic({ apiKey });
  }
  return anthropic;
};

/**
 * Create a chat handler with the given travel facade
 */
export async function createChatHandler(facade: TravelFacade) {
  return async (messages: ChatMessage[], context: ChatContext, model?: string): Promise<ChatResponse> => {
    // Collect photos from tool results
    const collectedPhotos: PhotoReference[] = [];
    let detectedDestination: string | undefined;
    let originalSearchQuery: string | undefined;
    const selectedModel = model || DEFAULT_MODEL;
    
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    // Build context message
    const contextInfo = buildContextInfo(context);
    const systemPrompt = contextInfo ? `${SYSTEM_PROMPT}\n\nCurrent context:\n${contextInfo}` : SYSTEM_PROMPT;

    // Convert messages to Anthropic format
    const anthropicMessages: Anthropic.MessageParam[] = messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    try {
      // Initial API call
      const client = getAnthropicClient();
      let response = await client.messages.create({
        model: selectedModel,
        max_tokens: 1024,
        system: systemPrompt,
        tools,
        messages: anthropicMessages,
      });

      // Handle tool use
      while (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
        );

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const toolUse of toolUseBlocks) {
          let result: any;
          
          try {
            // Process tool calls - delegated to handleToolCall
            const toolResult = await handleToolCall(
              toolUse,
              facade,
              collectedPhotos,
              detectedDestination,
              originalSearchQuery
            );
            
            result = toolResult.result;
            if (toolResult.destination) detectedDestination = toolResult.destination;
            if (toolResult.searchQuery) originalSearchQuery = toolResult.searchQuery;
            
          } catch (error: any) {
            result = { error: error.message };
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          });
        }

        // Continue conversation with tool results
        anthropicMessages.push({
          role: 'assistant',
          content: response.content,
        });
        anthropicMessages.push({
          role: 'user',
          content: toolResults,
        });

        response = await client.messages.create({
          model: selectedModel,
          max_tokens: 1024,
          system: systemPrompt,
          tools,
          messages: anthropicMessages,
        });
      }

      // Extract text response
      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === 'text'
      );

      const rawResponse = textBlocks.map(b => b.text).join('\n');
      
      // Process and validate response
      return validateAndCleanResponse(
        rawResponse,
        collectedPhotos,
        detectedDestination,
        originalSearchQuery,
        messages,
        context.tripContext?.destination
      );
      
    } catch (error: any) {
      console.error('Claude API error:', error);
      throw new Error(`Chat error: ${error.message}`);
    }
  };
}

/**
 * Handle individual tool calls
 */
async function handleToolCall(
  toolUse: Anthropic.ToolUseBlock,
  facade: TravelFacade,
  collectedPhotos: PhotoReference[],
  detectedDestination: string | undefined,
  originalSearchQuery: string | undefined
): Promise<{ result: any; destination?: string; searchQuery?: string }> {
  let result: any;
  let destination = detectedDestination;
  let searchQuery = originalSearchQuery;

  switch (toolUse.name) {
    case 'search_national_parks':
      const searchResult = await handleSearchNationalParks(
        toolUse.input as any,
        facade,
        collectedPhotos
      );
      result = searchResult.result;
      destination = searchResult.destination;
      searchQuery = searchResult.searchQuery;
      break;

    case 'plan_park_trip':
      result = await handlePlanParkTrip(
        toolUse.input as any,
        facade,
        collectedPhotos
      );
      break;

    case 'get_park_hikes':
      result = { hikes: facade.getParkHikes((toolUse.input as any).park_code) };
      break;

    case 'search_flights':
      result = await handleSearchFlights(toolUse.input as any, facade);
      break;

    case 'get_driving_distance':
      result = await handleGetDrivingDistance(toolUse.input as any);
      break;

    case 'search_ev_charging_stations':
      result = await handleSearchEvChargingStations(toolUse.input as any);
      break;

    case 'search_hotels':
      result = await handleSearchHotels(toolUse.input as any, facade);
      break;

    case 'search_car_rentals':
      result = await handleSearchCarRentals(toolUse.input as any, facade);
      break;

    case 'search_activities':
      result = await handleSearchActivities(toolUse.input as any, facade);
      break;

    case 'refresh_photos':
      result = await handleRefreshPhotos(toolUse.input as any, collectedPhotos);
      break;

    default:
      result = { error: `Unknown tool: ${toolUse.name}` };
  }

  return { result, destination, searchQuery };
}

// Tool handler implementations
async function handleSearchNationalParks(
  input: { query: string },
  facade: TravelFacade,
  collectedPhotos: PhotoReference[]
): Promise<{ result: any; destination?: string; searchQuery?: string }> {
  const rawQuery = input.query.toLowerCase();
  
  // Try to find park code from our lookup table first
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
  
  // Filter parks to match original query
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
    if (searchWords.length > 0) {
      const hasMatch = searchWords.some((sw: string) => 
        coreName.includes(sw) || parkNameLower.includes(sw)
      );
      if (hasMatch) return true;
    }
    
    return false;
  });
  
  console.log(`[Chat] Park filter: query="${searchQueryStr}" -> clean="${cleanQuery}", found=${parks.length}, relevant=${relevantParks.map(p => p.parkCode).join(', ') || 'none'}`);
  
  const parksForPhotos = relevantParks.slice(0, 2);
  
  // Photo targets
  const TARGET_NPS_PHOTOS = 16;
  const TARGET_TOTAL_PHOTOS = 24;
  
  let detectedDest: string | undefined;
  
  if (parksForPhotos.length > 0) {
    detectedDest = parksForPhotos[0].name;
    const parkName = parksForPhotos[0].name.replace(' National Park', '').replace(' National', '');
    const parkCode = parksForPhotos[0].parkCode;
    
    // Collect NPS photos
    await collectNpsPhotos(parksForPhotos, collectedPhotos, TARGET_NPS_PHOTOS);
    
    // Supplement with Unsplash if needed
    const unsplash = getUnsplashAdapter();
    if (collectedPhotos.length < TARGET_NPS_PHOTOS && unsplash.isConfigured()) {
      const needed = TARGET_NPS_PHOTOS - collectedPhotos.length;
      console.log(`[Chat] Supplementing with ${needed} Unsplash landscape photos for "${parkName}"`);
      const unsplashPhotos = await unsplash.searchPhotos(`${parkName} landscape nature`, needed);
      unsplashPhotos.forEach(photo => {
        collectedPhotos.push({
          keyword: parkName,
          url: photo.url,
          caption: `${parkName} - ${photo.caption} (${photo.credit})`,
          source: 'unsplash'
        });
      });
    }
    
    // Fetch activity/event photos
    if (unsplash.isConfigured()) {
      await collectActivityPhotos(facade, parkCode, parkName, collectedPhotos, TARGET_TOTAL_PHOTOS);
    }
  } else {
    // No NPS match - fall back to Unsplash
    console.log(`[Chat] No NPS parks matched "${cleanQuery}", falling back to Unsplash`);
    const unsplash = getUnsplashAdapter();
    if (unsplash.isConfigured()) {
      const searchTerm = cleanQuery.length > 2 ? cleanQuery : rawQuery;
      console.log(`[Chat] Fetching ${TARGET_TOTAL_PHOTOS} Unsplash photos for "${searchTerm}"`);
      const unsplashPhotos = await unsplash.searchPhotos(`${searchTerm} national park landscape`, TARGET_TOTAL_PHOTOS);
      const displayName = searchTerm.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      unsplashPhotos.forEach(photo => {
        collectedPhotos.push({
          keyword: searchTerm,
          url: photo.url,
          caption: `${displayName} - ${photo.caption} (${photo.credit})`,
          source: 'unsplash'
        });
      });
    }
  }
  
  return {
    result: { parks: parks.slice(0, 3) },
    destination: detectedDest,
    searchQuery: cleanQuery
  };
}

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

async function collectActivityPhotos(
  facade: TravelFacade,
  parkCode: string,
  parkName: string,
  collectedPhotos: PhotoReference[],
  targetTotal: number
): Promise<void> {
  try {
    const unsplash = getUnsplashAdapter();
    const activities = await facade.getParkActivities(parkCode);
    const hikes = facade.getParkHikes(parkCode);
    
    const features: string[] = [];
    
    activities.slice(0, 5).forEach((activity: any) => {
      if (activity.title) features.push(activity.title);
    });
    
    hikes.slice(0, 3).forEach(hike => {
      features.push(hike.name);
    });
    
    if (PARK_FEATURES[parkCode]) {
      features.push(...PARK_FEATURES[parkCode]);
    }
    
    const uniqueFeatures = [...new Set(features)].slice(0, 8);
    console.log(`[Chat] Fetching event/activity photos for: ${uniqueFeatures.join(', ')}`);
    
    for (const feature of uniqueFeatures) {
      if (collectedPhotos.length >= targetTotal) break;
      
      const searchQueryStr = `${parkName} ${feature}`;
      const photos = await unsplash.searchPhotos(searchQueryStr, 1);
      
      if (photos.length > 0) {
        const photo = photos[0];
        if (!collectedPhotos.some(p => p.url === photo.url)) {
          collectedPhotos.push({
            keyword: feature,
            url: photo.url,
            caption: `${parkName} - ${feature} (${photo.credit})`,
            source: 'unsplash'
          });
        }
      }
    }
    
    console.log(`[Chat] Total photos after event matching: ${collectedPhotos.length}`);
  } catch (err) {
    console.log(`[Chat] Could not fetch activities for event photos:`, err);
  }
}

async function handlePlanParkTrip(
  input: any,
  facade: TravelFacade,
  collectedPhotos: PhotoReference[]
): Promise<any> {
  const result = await facade.planParkTrip({
    parkCode: input.park_code,
    originAirport: input.origin_airport,
    arrivalDate: input.arrival_date,
    departureDate: input.departure_date,
    adults: input.adults || 1,
  });
  
  // Collect photos from park
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
    
    const shortName = result.park.name.replace(' National Park', '');
    if (shortName !== result.park.name) {
      const firstUrl = isSmokies 
        ? 'https://www.nps.gov/common/uploads/structured_data/3C80E3F4-1DD8-B71B-0BFF4F2280EF1B52.jpg'
        : result.park.images[0];
      collectedPhotos.push({
        keyword: shortName,
        url: firstUrl,
        caption: result.park.name,
        source: 'nps'
      });
    }
  }
  
  // Collect photos from activities
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
  
  // Collect photos from campgrounds
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

async function handleSearchFlights(input: any, facade: TravelFacade): Promise<any> {
  const flightResults = await facade.searchFlights({
    origin: input.origin,
    destination: input.destination,
    departureDate: input.departure_date,
    returnDate: input.return_date,
    adults: input.adults || 1,
  });
  return {
    flights: flightResults.results.slice(0, 5).map(f => ({
      price: `$${f.price.total}`,
      airline: f.validatingAirline,
      duration: f.itineraries[0]?.duration,
    })),
  };
}

async function handleGetDrivingDistance(input: any): Promise<any> {
  const mapsAdapter = new GoogleMapsAdapter();
  const distanceResult = await mapsAdapter.getDistance(input.origin, input.destination);
  return distanceResult ? {
    origin: distanceResult.origin,
    destination: distanceResult.destination,
    distance: distanceResult.distance.text,
    duration: distanceResult.duration.text,
    status: distanceResult.status,
  } : { error: 'Could not calculate driving distance' };
}

async function handleSearchEvChargingStations(input: any): Promise<any> {
  const evAdapter = new OpenChargeMapAdapter();
  const chargingStations = await evAdapter.searchAlongRoute(
    input.origin_lat,
    input.origin_lng,
    input.dest_lat,
    input.dest_lng,
    25,
    10
  );
  return {
    stations: chargingStations.map(s => ({
      name: s.name,
      location: `${s.city}, ${s.state}`,
      operator: s.operator,
      powerKW: s.powerKW,
      numChargers: s.numPoints,
      isTesla: s.isTeslaSupercharger,
      isFastCharger: s.isFastCharger,
      cost: s.usageCost,
    })),
    note: chargingStations.length > 0 
      ? `Found ${chargingStations.length} DC fast charging stations along your route`
      : 'No charging stations found along this route',
  };
}

async function handleSearchHotels(input: any, facade: TravelFacade): Promise<any> {
  const hotelResults = await facade.searchHotels({
    location: input.location,
    checkInDate: input.check_in_date,
    checkOutDate: input.check_out_date,
    adults: input.adults || 2,
    rooms: input.rooms || 1,
  });
  return {
    hotels: hotelResults.results.slice(0, 8).map(h => ({
      name: h.name,
      price: `$${h.price.total}`,
      pricePerNight: `$${h.price.perNight}`,
      rating: h.rating,
      address: h.address,
      amenities: h.amenities?.slice(0, 5),
    })),
    totalFound: hotelResults.totalResults,
    providers: hotelResults.providers,
  };
}

async function handleSearchCarRentals(input: any, facade: TravelFacade): Promise<any> {
  const carResults = await facade.searchCarRentals({
    pickupLocation: input.pickup_location,
    pickupDate: input.pickup_date,
    dropoffDate: input.dropoff_date,
    pickupTime: input.pickup_time || '10:00',
    dropoffTime: input.dropoff_time || '10:00',
  });
  return {
    cars: carResults.results.slice(0, 8).map(c => ({
      vendor: c.vendor,
      vehicle: `${c.vehicle.category} (${c.vehicle.transmission})`,
      seats: c.vehicle.seats,
      pricePerDay: `$${c.price.perDay}`,
      totalPrice: `$${c.price.total}`,
      features: [
        c.vehicle.airConditioning ? 'A/C' : null,
        c.mileage?.unlimited ? 'Unlimited miles' : null,
      ].filter(Boolean),
    })),
    totalFound: carResults.totalResults,
    providers: carResults.providers,
  };
}

async function handleSearchActivities(input: any, facade: TravelFacade): Promise<any> {
  const activityResults = await facade.searchActivities({
    location: input.location,
    radius: 50,
  });
  return {
    activities: activityResults.results.slice(0, 10).map(a => ({
      name: a.name,
      description: a.shortDescription?.substring(0, 150) + (a.shortDescription && a.shortDescription.length > 150 ? '...' : ''),
      price: a.price?.amount ? `$${a.price.amount}` : 'Price varies',
      rating: a.rating,
      duration: a.duration,
      bookingLink: a.bookingLink,
    })),
    totalFound: activityResults.totalResults,
    providers: activityResults.providers,
  };
}

async function handleRefreshPhotos(
  input: any,
  collectedPhotos: PhotoReference[]
): Promise<any> {
  const destination = input.destination;
  const event = input.event || '';
  const style = input.style || '';
  const photoCount = Math.min(input.count || 8, 12);
  
  const unsplashAdapter = getUnsplashAdapter();
  if (!unsplashAdapter.isConfigured()) {
    return { error: 'Photo service not available' };
  }
  
  let photoSearchQuery: string;
  let photoCaption: string;
  
  if (event) {
    photoSearchQuery = `${destination} ${event}`;
    photoCaption = `${event} at ${destination}`;
  } else if (style) {
    photoSearchQuery = `${destination} ${style} nature`;
    photoCaption = `${destination} - ${style}`;
  } else {
    photoSearchQuery = `${destination} landscape nature scenic`;
    photoCaption = destination;
  }
  
  console.log(`[Chat] Refreshing photos for "${destination}" with query: "${photoSearchQuery}"`);
  const freshPhotos = await unsplashAdapter.searchPhotos(photoSearchQuery, photoCount);
  
  freshPhotos.forEach(photo => {
    collectedPhotos.push({
      keyword: event || destination,
      url: photo.url,
      caption: photo.caption || photoCaption,
      source: 'unsplash'
    });
  });
  
  return {
    message: event 
      ? `Found ${freshPhotos.length} photos of ${event} at ${destination}`
      : `Found ${freshPhotos.length} new photos for ${destination}`,
    photoCount: freshPhotos.length,
    destination: destination,
    event: event || null,
    style: style || 'general',
  };
}
