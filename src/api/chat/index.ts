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
import { YelpAdapter } from '../../providers/YelpAdapter.js';
import { findParkCode } from '../../utils/parkCodeLookup.js';
import { getUnsplashAdapter } from '../../providers/UnsplashAdapter.js';

// Re-export types explicitly
export type { ChatMessage, ChatContext, ChatResponse, PhotoReference, ToolResult, ToolStatusCallback, TripLeg, ContextDefaults } from './types.js';
export { TOOL_DISPLAY_NAMES, resolveContextValue } from './types.js';

// Import modular components
import { ChatMessage, ChatContext, ChatResponse, PhotoReference, ToolStatusCallback, ContextDefaults, resolveContextValue, deduplicatePhotos } from './types.js';
import { SYSTEM_PROMPT, DEFAULT_MODEL, buildContextInfo } from './systemPrompt.js';
import { tools } from './toolDefinitions.js';
import { validateAndCleanResponse } from './responseProcessor.js';
import { PARK_FEATURES } from './parkFeatures.js';

let anthropic: Anthropic | null = null;

// Cache for storing restaurant search results to use correct location for reservations
// This ensures we use the restaurant's actual location, not the user's home location
interface CachedRestaurant {
  name: string;
  city: string;
  state: string;
  address: string;
}

interface RestaurantCache {
  restaurants: CachedRestaurant[];
  searchLocation: string;
  timestamp: number;
}

let restaurantCache: RestaurantCache = {
  restaurants: [],
  searchLocation: '',
  timestamp: 0,
};

// Cache management functions
function clearRestaurantCache(): void {
  restaurantCache = {
    restaurants: [],
    searchLocation: '',
    timestamp: 0,
  };
  console.log('[Restaurant Cache] Cleared');
}

function updateRestaurantCache(restaurants: CachedRestaurant[], searchLocation: string): void {
  // Clear old cache and rebuild with new results
  restaurantCache = {
    restaurants,
    searchLocation,
    timestamp: Date.now(),
  };
  console.log(`[Restaurant Cache] Rebuilt with ${restaurants.length} restaurants from "${searchLocation}"`);
}

function getCachedRestaurant(name: string): CachedRestaurant | undefined {
  const normalizedName = name.toLowerCase().trim();
  return restaurantCache.restaurants.find(r => 
    r.name.toLowerCase().trim() === normalizedName ||
    r.name.toLowerCase().includes(normalizedName) ||
    normalizedName.includes(r.name.toLowerCase())
  );
}

function getCacheInfo(): { count: number; location: string; ageMs: number } {
  return {
    count: restaurantCache.restaurants.length,
    location: restaurantCache.searchLocation,
    ageMs: restaurantCache.timestamp ? Date.now() - restaurantCache.timestamp : 0,
  };
}

// Deterministic park gateway cities for restaurant searches
// Maps park names/keywords to their correct gateway city and state
const PARK_GATEWAY_CITIES: Array<{ keywords: string[]; city: string; state: string }> = [
  { keywords: ['yellowstone', 'old faithful'], city: 'West Yellowstone', state: 'MT' },
  { keywords: ['grand teton', 'jackson hole'], city: 'Jackson', state: 'WY' },
  { keywords: ['glacier', 'going to the sun'], city: 'West Glacier', state: 'MT' },
  { keywords: ['yosemite', 'half dome', 'el capitan'], city: 'Mariposa', state: 'CA' },
  { keywords: ['grand canyon south rim', 'grand canyon village'], city: 'Tusayan', state: 'AZ' },
  { keywords: ['grand canyon north rim'], city: 'Marble Canyon', state: 'AZ' },
  { keywords: ['grand canyon'], city: 'Tusayan', state: 'AZ' },
  { keywords: ['zion'], city: 'Springdale', state: 'UT' },
  { keywords: ['bryce canyon', 'bryce'], city: 'Bryce Canyon City', state: 'UT' },
  { keywords: ['arches', 'moab'], city: 'Moab', state: 'UT' },
  { keywords: ['canyonlands'], city: 'Moab', state: 'UT' },
  { keywords: ['capitol reef'], city: 'Torrey', state: 'UT' },
  { keywords: ['rocky mountain', 'rmnp'], city: 'Estes Park', state: 'CO' },
  { keywords: ['great smoky', 'smokies', 'smoky mountains'], city: 'Gatlinburg', state: 'TN' },
  { keywords: ['acadia', 'bar harbor'], city: 'Bar Harbor', state: 'ME' },
  { keywords: ['olympic'], city: 'Port Angeles', state: 'WA' },
  { keywords: ['mount rainier', 'mt rainier'], city: 'Ashford', state: 'WA' },
  { keywords: ['crater lake'], city: 'Prospect', state: 'OR' },
  { keywords: ['joshua tree'], city: 'Twentynine Palms', state: 'CA' },
  { keywords: ['death valley'], city: 'Furnace Creek', state: 'CA' },
  { keywords: ['sequoia', 'kings canyon'], city: 'Three Rivers', state: 'CA' },
  { keywords: ['redwood'], city: 'Crescent City', state: 'CA' },
  { keywords: ['shenandoah'], city: 'Luray', state: 'VA' },
  { keywords: ['big bend'], city: 'Terlingua', state: 'TX' },
  { keywords: ['guadalupe mountains'], city: 'Salt Flat', state: 'TX' },
  { keywords: ['carlsbad caverns'], city: 'Carlsbad', state: 'NM' },
  { keywords: ['white sands'], city: 'Alamogordo', state: 'NM' },
  { keywords: ['petrified forest'], city: 'Holbrook', state: 'AZ' },
  { keywords: ['saguaro'], city: 'Tucson', state: 'AZ' },
  { keywords: ['mesa verde'], city: 'Cortez', state: 'CO' },
  { keywords: ['black canyon'], city: 'Montrose', state: 'CO' },
  { keywords: ['great sand dunes'], city: 'Alamosa', state: 'CO' },
  { keywords: ['badlands'], city: 'Wall', state: 'SD' },
  { keywords: ['wind cave'], city: 'Hot Springs', state: 'SD' },
  { keywords: ['theodore roosevelt'], city: 'Medora', state: 'ND' },
  { keywords: ['voyageurs'], city: 'International Falls', state: 'MN' },
  { keywords: ['isle royale'], city: 'Houghton', state: 'MI' },
  { keywords: ['mammoth cave'], city: 'Cave City', state: 'KY' },
  { keywords: ['hot springs'], city: 'Hot Springs', state: 'AR' },
  { keywords: ['everglades'], city: 'Homestead', state: 'FL' },
  { keywords: ['biscayne'], city: 'Homestead', state: 'FL' },
  { keywords: ['dry tortugas'], city: 'Key West', state: 'FL' },
  { keywords: ['congaree'], city: 'Hopkins', state: 'SC' },
  { keywords: ['new river gorge'], city: 'Fayetteville', state: 'WV' },
  { keywords: ['cuyahoga valley'], city: 'Peninsula', state: 'OH' },
  { keywords: ['indiana dunes'], city: 'Porter', state: 'IN' },
  { keywords: ['denali'], city: 'Denali Park', state: 'AK' },
  { keywords: ['kenai fjords'], city: 'Seward', state: 'AK' },
  { keywords: ['glacier bay'], city: 'Gustavus', state: 'AK' },
  { keywords: ['katmai'], city: 'King Salmon', state: 'AK' },
  { keywords: ['wrangell', 'st elias'], city: 'McCarthy', state: 'AK' },
  { keywords: ['gates of the arctic'], city: 'Bettles', state: 'AK' },
  { keywords: ['kobuk valley'], city: 'Kotzebue', state: 'AK' },
  { keywords: ['lake clark'], city: 'Port Alsworth', state: 'AK' },
  { keywords: ['hawaii volcanoes', 'kilauea'], city: 'Volcano', state: 'HI' },
  { keywords: ['haleakala'], city: 'Kula', state: 'HI' },
  { keywords: ['channel islands'], city: 'Ventura', state: 'CA' },
  { keywords: ['pinnacles'], city: 'Soledad', state: 'CA' },
  { keywords: ['lassen volcanic', 'lassen'], city: 'Mineral', state: 'CA' },
  { keywords: ['north cascades'], city: 'Marblemount', state: 'WA' },
  { keywords: ['virgin islands'], city: 'Cruz Bay', state: 'VI' },
  { keywords: ['american samoa'], city: 'Pago Pago', state: 'AS' },
  { keywords: ['great basin'], city: 'Baker', state: 'NV' },
];

/**
 * Resolve park location to gateway city for restaurant searches
 * Returns the correct city/state for a park, or null if not found
 */
function resolveGatewayCity(location: string): { city: string; state: string } | null {
  const locationLower = location.toLowerCase();
  
  for (const gateway of PARK_GATEWAY_CITIES) {
    for (const keyword of gateway.keywords) {
      if (locationLower.includes(keyword)) {
        console.log(`[Restaurant] Resolved "${location}" to gateway city: ${gateway.city}, ${gateway.state}`);
        return { city: gateway.city, state: gateway.state };
      }
    }
  }
  
  return null;
}

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
  return async (messages: ChatMessage[], context: ChatContext, model?: string, onToolStatus?: ToolStatusCallback): Promise<ChatResponse> => {
    // Collect photos from tool results
    const collectedPhotos: PhotoReference[] = [];
    let detectedDestination: string | undefined;
    let originalSearchQuery: string | undefined;
    
    // Create mutable context for storing NPS gateway city deterministically
    // This allows all tools to access the gateway city from context
    const mutableContext: ChatContext = { ...context };
    
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
        max_tokens: 8192,
        system: systemPrompt,
        tools,
        messages: anthropicMessages,
      });

      // Check for truncation due to max_tokens
      if (response.stop_reason === 'max_tokens') {
        console.warn('[Chat] Response was truncated due to max_tokens limit');
      }

      // Handle tool use
      while (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
        );

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const toolUse of toolUseBlocks) {
          let result: any;
          
          try {
            // Notify about tool starting
            if (onToolStatus) {
              onToolStatus(toolUse.name, 'starting');
            }
            
            // Process tool calls - delegated to handleToolCall with mutableContext
            // mutableContext.npsGatewayCity is updated deterministically by park lookups
            const toolResult = await handleToolCall(
              toolUse,
              facade,
              collectedPhotos,
              detectedDestination,
              originalSearchQuery,
              mutableContext
            );
            
            result = toolResult.result;
            if (toolResult.destination) detectedDestination = toolResult.destination;
            if (toolResult.searchQuery) originalSearchQuery = toolResult.searchQuery;
            // NPS gateway is now stored directly in mutableContext by the tool handlers
            
            // Notify about tool completion
            if (onToolStatus) {
              onToolStatus(toolUse.name, 'complete');
            }
            
          } catch (error: any) {
            result = { error: error.message };
            if (onToolStatus) {
              onToolStatus(toolUse.name, 'complete');
            }
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
          max_tokens: 8192,
          system: systemPrompt,
          tools,
          messages: anthropicMessages,
        });
        
        // Check for truncation after tool use continuation
        if (response.stop_reason === 'max_tokens') {
          console.warn('[Chat] Response was truncated due to max_tokens limit after tool use');
        }
      }

      // Extract text response
      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === 'text'
      );

      const rawResponse = textBlocks.map(b => b.text).join('\n');
      
      // Deduplicate photos before returning (by URL and one-per-Unsplash-photographer)
      const dedupedPhotos = deduplicatePhotos(collectedPhotos);
      console.log(`[Chat] Photos: ${collectedPhotos.length} collected, ${dedupedPhotos.length} after deduplication`);
      
      // Process and validate response
      return validateAndCleanResponse(
        rawResponse,
        dedupedPhotos,
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
 * Handle individual tool calls with full context
 */
async function handleToolCall(
  toolUse: Anthropic.ToolUseBlock,
  facade: TravelFacade,
  collectedPhotos: PhotoReference[],
  detectedDestination: string | undefined,
  originalSearchQuery: string | undefined,
  context: ChatContext
): Promise<{ result: any; destination?: string; searchQuery?: string }> {
  let result: any;
  let destination = detectedDestination;
  let searchQuery = originalSearchQuery;
  
  // Get active leg index for leg-specific context resolution
  const activeLeg = context.tripContext?.activeLeg;

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
      // Store NPS gateway city in context for all tools to use deterministically
      if (searchResult.npsGateway) {
        context.npsGatewayCity = {
          city: searchResult.npsGateway.city,
          state: searchResult.npsGateway.state,
          parkCode: searchResult.result?.parks?.[0]?.parkCode,
          parkName: searchResult.destination,
        };
        console.log(`[Context] Stored NPS gateway: ${context.npsGatewayCity.city}, ${context.npsGatewayCity.state}`);
      }
      break;

    case 'plan_park_trip':
      result = await handlePlanParkTrip(
        toolUse.input as any,
        facade,
        collectedPhotos,
        context
      );
      break;

    case 'get_park_hikes':
      result = { hikes: facade.getParkHikes((toolUse.input as any).park_code) };
      break;

    case 'search_flights':
      result = await handleSearchFlights(toolUse.input as any, facade, context, activeLeg);
      break;

    case 'get_driving_distance':
      result = await handleGetDrivingDistance(toolUse.input as any);
      break;

    case 'search_ev_charging_stations':
      result = await handleSearchEvChargingStations(toolUse.input as any, context);
      break;

    case 'search_hotels':
      result = await handleSearchHotels(toolUse.input as any, facade, context, activeLeg);
      break;

    case 'search_car_rentals':
      result = await handleSearchCarRentals(toolUse.input as any, facade, context);
      break;

    case 'search_activities':
      result = await handleSearchActivities(toolUse.input as any, facade);
      break;

    case 'refresh_photos':
      result = await handleRefreshPhotos(toolUse.input as any, collectedPhotos);
      break;

    case 'search_restaurants':
      // Use context.npsGatewayCity for deterministic location
      result = await handleSearchRestaurants(toolUse.input as any, collectedPhotos, context);
      break;

    case 'get_reservation_link':
      // Use context.npsGatewayCity for deterministic location
      result = await handleGetReservationLink(toolUse.input as any, context);
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
): Promise<{ result: any; destination?: string; searchQuery?: string; npsGateway?: { city: string; state: string } }> {
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
          source: 'unsplash',
          photographerId: photo.photographerId,
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
          source: 'unsplash',
          photographerId: photo.photographerId,
        });
      });
    }
  }
  
  // Extract gateway city from first park if available
  let npsGateway: { city: string; state: string } | undefined;
  if (parksForPhotos.length > 0) {
    const firstPark = parksForPhotos[0];
    if (firstPark.gatewayCity && firstPark.gatewayState) {
      npsGateway = { city: firstPark.gatewayCity, state: firstPark.gatewayState };
      console.log(`[Chat] NPS gateway city from API: ${npsGateway.city}, ${npsGateway.state}`);
    }
  }
  
  return {
    result: { parks: parks.slice(0, 3) },
    destination: detectedDest,
    searchQuery: cleanQuery,
    npsGateway
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
            source: 'unsplash',
            photographerId: photo.photographerId,
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
  collectedPhotos: PhotoReference[],
  context: ChatContext
): Promise<any> {
  // Resolve travelers from context (override > input > default)
  const travelers = input.adults || resolveContextValue<number>('numTravelers', context) || 1;
  
  const result = await facade.planParkTrip({
    parkCode: input.park_code,
    originAirport: input.origin_airport,
    arrivalDate: input.arrival_date,
    departureDate: input.departure_date,
    adults: travelers,
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

async function handleSearchFlights(
  input: any,
  facade: TravelFacade,
  context: ChatContext,
  activeLeg?: number
): Promise<any> {
  // Resolve values with context priority: leg override > conversation override > input > profile default
  const travelers = input.adults || resolveContextValue<number>('numTravelers', context, activeLeg) || 1;
  const origin = input.origin || resolveContextValue<string>('homeAirport', context, activeLeg) || context.userLocation?.nearestAirport;
  
  const flightResults = await facade.searchFlights({
    origin: origin,
    destination: input.destination,
    departureDate: input.departure_date,
    returnDate: input.return_date,
    adults: travelers,
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

async function handleSearchEvChargingStations(input: any, context: ChatContext): Promise<any> {
  // Check if user has Tesla preference from profile
  const isTeslaOwner = context.userProfile?.toLowerCase().includes('tesla') || 
                       context.defaults?.vehicle === 'tesla';
  const teslaOnly = input.tesla_only ?? isTeslaOwner;
  
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

async function handleSearchHotels(
  input: any,
  facade: TravelFacade,
  context: ChatContext,
  activeLeg?: number
): Promise<any> {
  // Resolve travelers and rooms from context
  const travelers = input.adults || resolveContextValue<number>('numTravelers', context, activeLeg) || 2;
  const rooms = input.rooms || Math.ceil(travelers / 2); // Estimate rooms needed
  
  const hotelResults = await facade.searchHotels({
    location: input.location,
    checkInDate: input.check_in_date,
    checkOutDate: input.check_out_date,
    adults: travelers,
    rooms: rooms,
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

async function handleSearchCarRentals(input: any, facade: TravelFacade, context: ChatContext): Promise<any> {
  // Check if user prefers EV rentals from profile
  const prefersEV = context.userProfile?.toLowerCase().includes('ev') ||
                    context.userProfile?.toLowerCase().includes('electric') ||
                    context.defaults?.vehicle === 'ev';
  
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
      source: 'unsplash',
      photographerId: photo.photographerId,
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

async function handleSearchRestaurants(
  input: {
    location: string;
    cuisine?: string;
    price_level?: number;
    radius?: number;
  },
  collectedPhotos: PhotoReference[],
  context: ChatContext
): Promise<any> {
  // DETERMINISTIC: Use context.npsGatewayCity if available, otherwise resolve from static lookup
  const npsGateway = context.npsGatewayCity;
  const gatewayCity = npsGateway || resolveGatewayCity(input.location);
  const searchLocation = gatewayCity 
    ? `${gatewayCity.city}, ${gatewayCity.state}`
    : input.location;
  
  console.log(`[Restaurant] Search location: "${input.location}" -> "${searchLocation}"`);
  
  // Try Yelp first for richer data (reviews, photos, reservation info)
  const yelpAdapter = new YelpAdapter();
  
  // Resolve price level from context if user has budget preference
  let priceLevel = input.price_level;
  if (!priceLevel && context.defaults?.budget) {
    // Map budget preference to price level
    const budgetToPrice: Record<string, number> = {
      'frugal': 1,
      'moderate': 2,
      'luxury': 4,
    };
    priceLevel = budgetToPrice[context.defaults.budget];
  }
  
  // Convert price_level (1-4) to Yelp format
  let yelpPrice: string | undefined;
  if (priceLevel) {
    yelpPrice = Array.from({ length: priceLevel }, (_, i) => i + 1).join(',');
  }

  // Extract park name from location for captions
  const parkName = input.location.replace(/\s*(National Park|Valley|Village|Area)\s*/gi, '').trim();

  const yelpResults = await yelpAdapter.searchRestaurants(searchLocation, {
    term: input.cuisine,
    price: yelpPrice,
    radius: input.radius || 8000, // Default 8km for better coverage
    sortBy: 'best_match',
    limit: 10,
  });

  if (yelpResults.status === 'OK' && yelpResults.businesses.length > 0) {
    // Add restaurant photos to gallery with distance captions
    yelpResults.businesses.forEach(r => {
      if (r.imageUrl) {
        const distanceMiles = r.distance ? (r.distance / 1609.34).toFixed(1) : null;
        const caption = distanceMiles 
          ? `${r.name} • ${distanceMiles} miles to ${parkName}`
          : `${r.name} near ${parkName}`;
        
        collectedPhotos.push({
          keyword: r.name,
          url: r.imageUrl,
          caption: caption,
          source: 'other' as const,
        });
      }
    });

    // Cache restaurant locations for reservation link lookups
    // This clears any previous cache and rebuilds with new search results
    const cachedRestaurants = yelpResults.businesses.map(r => ({
      name: r.name,
      city: r.location.city,
      state: r.location.state,
      address: r.location.displayAddress.join(', '),
    }));
    updateRestaurantCache(cachedRestaurants, input.location);

    return {
      restaurants: yelpResults.businesses.map(r => ({
        name: r.name,
        address: r.location.displayAddress.join(', '),
        city: r.location.city,           // Include for reservation links
        state: r.location.state,         // Include for reservation links
        rating: `${r.rating}/5`,
        reviewCount: r.reviewCount,
        reviewsUrl: r.url,               // Link to read reviews on Yelp
        reviewSource: 'Yelp',
        priceLevel: r.price || 'Price unknown',
        cuisine: YelpAdapter.formatCategories(r.categories),
        phone: r.displayPhone || 'No phone',
        distanceMiles: r.distance ? (r.distance / 1609.34).toFixed(1) : null,
        supportsReservation: r.transactions.includes('restaurant_reservation'),
        reservationLink: YelpAdapter.generateReservationLink(r),
        yelpUrl: r.url,
        imageUrl: r.imageUrl,
      })),
      totalFound: yelpResults.total,
      searchLocation: input.location,
      cuisineFilter: input.cuisine || 'all types',
      source: 'yelp',
      photosAdded: yelpResults.businesses.filter(r => r.imageUrl).length,
    };
  }

  // Fallback to Google Places if Yelp fails
  console.log('[Restaurant] Yelp returned no results, falling back to Google Places');
  const mapsAdapter = new GoogleMapsAdapter();
  const results = await mapsAdapter.searchRestaurants(
    searchLocation,
    input.cuisine,
    input.price_level,
    input.radius || 5000
  );

  if (results.status !== 'OK' || results.results.length === 0) {
    return {
      restaurants: [],
      message: `No restaurants found near ${input.location}. Try expanding your search or checking nearby towns.`,
    };
  }

  // Add Google restaurant photos to gallery
  const locationName = input.location.split(',')[0].trim();
  results.results.forEach(r => {
    if (r.photoUrl) {
      collectedPhotos.push({
        keyword: r.name,
        url: r.photoUrl,
        caption: `${r.name} near ${locationName}`,
        source: 'other' as const,
      });
    }
  });

  // Cache Google Places results for reservation lookups
  // Use gateway city if resolved, otherwise parse from search input
  const cacheCity = gatewayCity?.city || searchLocation.split(',')[0].trim();
  const cacheState = gatewayCity?.state || searchLocation.split(',')[1]?.trim() || '';
  
  const cachedGoogleRestaurants = results.results.map(r => ({
    name: r.name,
    city: cacheCity,
    state: cacheState,
    address: r.address,
  }));
  updateRestaurantCache(cachedGoogleRestaurants, input.location);

  return {
    restaurants: results.results.map(r => {
      // Generate Google Maps URL for reviews
      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name + ' ' + r.address)}`;
      return {
        name: r.name,
        address: r.address,
        city: cacheCity,           // Include for reservation links
        state: cacheState,         // Include for reservation links
        rating: r.rating ? `${r.rating}/5` : 'No rating',
        reviewCount: r.userRatingsTotal || 0,
        reviewsUrl: googleMapsUrl,          // Link to read reviews on Google Maps
        reviewSource: 'Google',
        priceLevel: GoogleMapsAdapter.formatPriceLevel(r.priceLevel),
        cuisine: r.types?.slice(0, 3).join(', ') || 'Restaurant',
        openNow: r.openNow !== undefined ? (r.openNow ? 'Open now' : 'Closed') : 'Hours unknown',
        imageUrl: r.photoUrl,
      };
    }),
    totalFound: results.results.length,
    searchLocation: input.location,
    cuisineFilter: input.cuisine || 'all types',
    source: 'google',
    photosAdded: results.results.filter(r => r.photoUrl).length,
  };
}

async function validateOpenTableLink(url: string): Promise<boolean> {
  try {
    // Make a request to check if OpenTable returns results
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TripAgent/1.0)',
      },
    });
    
    if (!response.ok) return false;
    
    const html = await response.text();
    
    // Check for indicators that no results were found
    const noResultsIndicators = [
      'No results found',
      'no restaurants matched',
      '0 results',
      'couldn\'t find any',
      'no matching restaurants',
    ];
    
    const htmlLower = html.toLowerCase();
    for (const indicator of noResultsIndicators) {
      if (htmlLower.includes(indicator.toLowerCase())) {
        return false;
      }
    }
    
    // Check for positive indicators (restaurant cards/listings)
    const hasResults = html.includes('data-test="restaurant-card"') || 
                       html.includes('RestaurantCard') ||
                       html.includes('restaurant-name');
    
    return hasResults || !noResultsIndicators.some(i => htmlLower.includes(i.toLowerCase()));
  } catch (error) {
    console.log('[OpenTable] Validation failed, defaulting to alternative links:', error);
    return false;
  }
}

async function handleGetReservationLink(
  input: {
    restaurant_name: string;
    city: string;
    state: string;
    date?: string;
    time?: string;
    party_size?: number;
  },
  context: ChatContext
): Promise<any> {
  // CRITICAL FIX: Look up restaurant in cache to get CORRECT location
  // This ensures we use the restaurant's actual location, not the user's home location
  const cachedRestaurant = getCachedRestaurant(input.restaurant_name);
  const cacheInfo = getCacheInfo();
  
  // Get NPS gateway from context (set deterministically by park lookups)
  const npsGateway = context.npsGatewayCity;

  // Priority: 1) Cached restaurant location, 2) NPS gateway city, 3) Static gateway lookup, 4) Input
  let city = input.city;
  let state = input.state;
  let locationSource = 'input';
  
  if (cachedRestaurant) {
    city = cachedRestaurant.city;
    state = cachedRestaurant.state;
    locationSource = 'cache';
    console.log(`[Reservation] Using cached location for "${input.restaurant_name}": ${city}, ${state}`);
  } else if (npsGateway) {
    // Use NPS gateway city from context (deterministically set by park lookup)
    city = npsGateway.city;
    state = npsGateway.state;
    locationSource = 'nps-gateway';
    console.log(`[Reservation] Using NPS gateway city from context: ${city}, ${state}`);
  } else {
    // Try static gateway city lookup from the search location in cache
    const gatewayFromCache = cacheInfo.location ? resolveGatewayCity(cacheInfo.location) : null;
    if (gatewayFromCache) {
      city = gatewayFromCache.city;
      state = gatewayFromCache.state;
      locationSource = 'static-gateway';
      console.log(`[Reservation] Using static gateway city for "${cacheInfo.location}": ${city}, ${state}`);
    } else {
      console.warn(`[Reservation] Restaurant "${input.restaurant_name}" not found in cache (${cacheInfo.count} cached from "${cacheInfo.location}"). Using provided location: ${city}, ${state}`);
    }
  }

  const links = YelpAdapter.generateReservationLinks(
    input.restaurant_name,
    city,
    state,
    input.date,
    input.time,
    input.party_size || 2
  );

  // Validate OpenTable link before recommending it
  // Add timeout and rate limit protection
  let openTableValid = false;
  try {
    openTableValid = await Promise.race([
      validateOpenTableLink(links.openTable),
      new Promise<boolean>((_, reject) => 
        setTimeout(() => reject(new Error('OpenTable validation timeout')), 5000)
      )
    ]) as boolean;
  } catch (error) {
    console.log('[Reservation] OpenTable validation skipped due to timeout or error');
    openTableValid = false;
  }
  
  // Format the reservation details for display
  // IMPORTANT: Use the corrected city/state (from cache), not input values
  const reservationDetails = {
    restaurant: input.restaurant_name,
    location: `${city}, ${state}`,
    date: input.date || 'Not specified',
    time: input.time || '7:00 PM',
    partySize: input.party_size || 2,
  };

  // Only include OpenTable if it returns results AND validation succeeded
  const availableLinks: Record<string, string> = {
    yelp: links.yelp,
    google: links.google,
  };
  
  if (openTableValid) {
    availableLinks.openTable = links.openTable;
  }
  
  // Add Resy as an option
  availableLinks.resy = links.resy;

  // Choose best primary link - prefer Google search which always works
  // Only use OpenTable as primary if we confirmed it works
  const primaryLink = openTableValid ? links.openTable : links.google;
  const primaryPlatform = openTableValid ? 'OpenTable' : 'Google';

  return {
    reservationDetails,
    links: availableLinks,
    primaryLink,
    primaryPlatform,
    openTableAvailable: openTableValid,
    message: openTableValid 
      ? `Reservation links generated for ${input.restaurant_name}. OpenTable has this restaurant available for booking.`
      : `${input.restaurant_name} is not on OpenTable. Use Google or Yelp to find reservation options or call the restaurant directly.`,
  };
}
