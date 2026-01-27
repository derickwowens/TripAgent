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
import { 
  generateGoogleMapsLink, 
  generateDirectionsLink, 
  generatePlugShareLink,
  generateTeslaChargerLink,
  generateAllTrailsLink,
  generateRecreationGovLink,
  validateUrl,
} from '../../utils/linkUtils.js';

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

// Deterministic destination cache - stores the current park/destination gateway city
// This is set when a park is searched and used for all subsequent restaurant/reservation lookups
interface DestinationCache {
  parkName: string;
  parkCode: string;
  gatewayCity: string;
  gatewayState: string;
  timestamp: number;
}

let destinationCache: DestinationCache | null = null;

function setDestinationCache(parkName: string, parkCode: string, city: string, state: string): void {
  destinationCache = {
    parkName,
    parkCode,
    gatewayCity: city,
    gatewayState: state,
    timestamp: Date.now(),
  };
  console.log(`[Destination Cache] Set: ${parkName} -> ${city}, ${state}`);
}

function getDestinationCache(): DestinationCache | null {
  if (destinationCache) {
    console.log(`[Destination Cache] Get: ${destinationCache.parkName} -> ${destinationCache.gatewayCity}, ${destinationCache.gatewayState}`);
  } else {
    console.log('[Destination Cache] Empty - no park searched yet');
  }
  return destinationCache;
}

function clearDestinationCache(): void {
  destinationCache = null;
  console.log('[Destination Cache] Cleared');
}

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
  // Also try without common suffixes/prefixes
  const simplifiedName = normalizedName
    .replace(/^the\s+/i, '')
    .replace(/\s+(restaurant|cafe|bar|grill|bistro|kitchen|eatery)$/i, '');
  
  console.log(`[Cache Lookup] Searching for "${name}" (normalized: "${normalizedName}", simplified: "${simplifiedName}")`);
  console.log(`[Cache Lookup] Cache has ${restaurantCache.restaurants.length} restaurants from "${restaurantCache.searchLocation}"`);
  
  const found = restaurantCache.restaurants.find(r => {
    const rNormalized = r.name.toLowerCase().trim();
    const rSimplified = rNormalized
      .replace(/^the\s+/i, '')
      .replace(/\s+(restaurant|cafe|bar|grill|bistro|kitchen|eatery)$/i, '');
    
    return (
      rNormalized === normalizedName ||
      rSimplified === simplifiedName ||
      rNormalized.includes(normalizedName) ||
      normalizedName.includes(rNormalized) ||
      rSimplified.includes(simplifiedName) ||
      simplifiedName.includes(rSimplified)
    );
  });
  
  if (found) {
    console.log(`[Cache Lookup] FOUND: "${found.name}" at ${found.city}, ${found.state}`);
  } else {
    console.log(`[Cache Lookup] NOT FOUND. Available names:`, restaurantCache.restaurants.map(r => r.name));
  }
  
  return found;
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
    
    // Track which tools were called during this request
    const toolsUsed: string[] = [];
    
    // Create mutable context for storing NPS gateway city deterministically
    // This allows all tools to access the gateway city from context
    const mutableContext: ChatContext = { ...context };
    
    // Use model from tool settings if provided, otherwise use the passed model or default
    const selectedModel = context.toolSettings?.languageModel || model || DEFAULT_MODEL;
    
    // Filter tools based on enabled tools from settings
    const enabledTools = context.toolSettings?.enabledTools;
    const filteredTools = enabledTools && enabledTools.length > 0
      ? tools.filter(t => enabledTools.includes(t.name))
      : tools;
    
    console.log(`[Chat] Using model: ${selectedModel}, enabled tools: ${filteredTools.length}/${tools.length}`);
    
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    // Build context message - include active destination from cache to prevent stale links
    const activeDestCache = getDestinationCache();
    const contextWithActiveDestination = {
      ...context,
      activeDestination: activeDestCache ? {
        name: activeDestCache.parkName,
        city: activeDestCache.gatewayCity,
        airport: undefined, // Will be resolved by gateway lookup if needed
      } : undefined,
    };
    const contextInfo = buildContextInfo(contextWithActiveDestination);
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
        tools: filteredTools,
        messages: anthropicMessages,
      });

      // Check for truncation due to max_tokens
      if (response.stop_reason === 'max_tokens') {
        console.warn('[Chat] Response was truncated due to max_tokens limit');
      }
      console.log(`[Chat] Initial response stop_reason: ${response.stop_reason}`);

      // Handle tool use
      while (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
        );

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const toolUse of toolUseBlocks) {
          let result: any;
          
          try {
            // Track tool usage
            if (!toolsUsed.includes(toolUse.name)) {
              toolsUsed.push(toolUse.name);
            }
            
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
          tools: filteredTools,
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
      
      // Log the final response for debugging truncation issues
      console.log(`[Chat] Final stop_reason: ${response.stop_reason}`);
      console.log(`[Chat] Text blocks: ${textBlocks.length}, Raw response length: ${rawResponse.length}`);
      console.log(`[Chat] Response ends with: "${rawResponse.slice(-100)}"`);
      
      // Deduplicate photos before returning (by URL and one-per-Unsplash-photographer)
      const dedupedPhotos = deduplicatePhotos(collectedPhotos);
      console.log(`[Chat] Photos: ${collectedPhotos.length} collected, ${dedupedPhotos.length} after deduplication`);
      
      // Initialize seenUrls in context if not present (for conversation-level duplicate tracking)
      if (!context.seenUrls) {
        context.seenUrls = new Set<string>();
      }
      
      // Process and validate response
      return validateAndCleanResponse(
        rawResponse,
        dedupedPhotos,
        detectedDestination,
        originalSearchQuery,
        messages,
        context.tripContext?.destination,
        context.seenUrls,
        toolsUsed
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

    // DISABLED: Unsplash tool removed due to unreliable links
    // case 'refresh_photos':
    //   result = await handleRefreshPhotos(toolUse.input as any, collectedPhotos);
    //   break;

    case 'search_restaurants':
      // Use context.npsGatewayCity for deterministic location
      result = await handleSearchRestaurants(toolUse.input as any, collectedPhotos, context);
      break;

    case 'get_reservation_link':
      // Use context.npsGatewayCity for deterministic location
      result = await handleGetReservationLink(toolUse.input as any, context);
      break;

    case 'get_wildlife':
      result = await handleGetWildlife(toolUse.input as any, facade, collectedPhotos);
      break;

    case 'get_campgrounds':
      result = await handleGetCampgrounds(toolUse.input as any, facade, context);
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
  
  // Clear cache if searching for a different park than what's cached
  const currentCache = getDestinationCache();
  if (currentCache) {
    const queryLower = rawQuery.toLowerCase();
    const cacheParkLower = currentCache.parkName.toLowerCase();
    
    // If searching for a different park, clear both caches
    if (!cacheParkLower.includes(queryLower) && !queryLower.includes(cacheParkLower.replace(' national park', ''))) {
      console.log(`[Park Search] New park "${rawQuery}" differs from cached "${currentCache.parkName}" - clearing caches`);
      clearDestinationCache();
      clearRestaurantCache();
    }
  }
  
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
    
    // Collect NPS photos only (Unsplash integration removed)
    await collectNpsPhotos(parksForPhotos, collectedPhotos, TARGET_NPS_PHOTOS);
  } else {
    // No NPS match - no photos will be displayed
    console.log(`[Chat] No NPS parks matched "${cleanQuery}" - no photos will be displayed`);
  }
  
  // Extract gateway city from first park if available
  let npsGateway: { city: string; state: string } | undefined;
  if (parksForPhotos.length > 0) {
    const firstPark = parksForPhotos[0];
    
    // PREFER static lookup over API - the API often returns the park name instead of actual gateway town
    const staticGateway = resolveGatewayCity(firstPark.name);
    if (staticGateway) {
      npsGateway = { city: staticGateway.city, state: staticGateway.state };
      console.log(`[Chat] NPS gateway city from static lookup: ${npsGateway.city}, ${npsGateway.state}`);
    } else if (firstPark.gatewayCity && firstPark.gatewayState) {
      // Only use API gateway if static lookup fails
      npsGateway = { city: firstPark.gatewayCity, state: firstPark.gatewayState };
      console.log(`[Chat] NPS gateway city from API (fallback): ${npsGateway.city}, ${npsGateway.state}`);
    }
    
    // DETERMINISTIC: Store in module-level cache for all subsequent tool calls
    if (npsGateway) {
      setDestinationCache(firstPark.name, firstPark.parkCode, npsGateway.city, npsGateway.state);
    }
  }
  
  // Add officialUrl to each park and log
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

// REMOVED: collectActivityPhotos function - Unsplash integration removed

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
  // Clear and update destination cache when searching flights to a new destination
  // This prevents stale park/restaurant cache from affecting flight searches
  const currentCache = getDestinationCache();
  if (input.destination) {
    const destLower = input.destination.toLowerCase();
    
    if (currentCache) {
      const cacheParkLower = currentCache.parkName.toLowerCase();
      const cacheCityLower = currentCache.gatewayCity.toLowerCase();
      
      // If the flight destination doesn't match the cached park/city, clear and update cache
      if (!cacheParkLower.includes(destLower) && !destLower.includes(cacheParkLower) &&
          !cacheCityLower.includes(destLower) && !destLower.includes(cacheCityLower)) {
        console.log(`[Flight Search] New destination "${input.destination}" differs from cached "${currentCache.parkName}" - updating cache`);
        clearDestinationCache();
        clearRestaurantCache();
        // Set new destination cache with the flight destination (airport code)
        setDestinationCache(input.destination, input.destination, input.destination, '');
      }
    } else {
      // No cache exists, set it to the flight destination
      console.log(`[Flight Search] Setting destination cache to "${input.destination}"`);
      setDestinationCache(input.destination, input.destination, input.destination, '');
    }
  }
  
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
  
  // DETERMINISTIC: Generate booking links directly with exact parameters
  // This ensures Claude uses the correct links without constructing from memory
  
  // Kayak link format
  const kayakLink = input.return_date
    ? `https://www.kayak.com/flights/${origin}-${input.destination}/${input.departure_date}/${input.return_date}`
    : `https://www.kayak.com/flights/${origin}-${input.destination}/${input.departure_date}`;
  
  // Google Flights link format - uses query string for prefilled search
  // Note: Google Flights has no public API for prices, but link prefills the search
  const googleFlightsQuery = input.return_date
    ? `Flights from ${origin} to ${input.destination} on ${input.departure_date} returning ${input.return_date}`
    : `Flights from ${origin} to ${input.destination} on ${input.departure_date} one way`;
  const googleFlightsLink = `https://www.google.com/travel/flights?q=${encodeURIComponent(googleFlightsQuery)}`;
  
  // Generate airport Google Maps links
  const originAirportUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(origin + ' Airport')}`;
  const destAirportUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(input.destination + ' Airport')}`;
  
  console.log(`[LinkGen] Flight search:`);
  console.log(`[LinkGen]   - origin: ${origin}, destination: ${input.destination}`);
  console.log(`[LinkGen]   - kayakLink: ${kayakLink}`);
  console.log(`[LinkGen]   - googleFlightsLink: ${googleFlightsLink}`);
  console.log(`[LinkGen]   - originAirportUrl: ${originAirportUrl}`);
  console.log(`[LinkGen]   - destAirportUrl: ${destAirportUrl}`);
  
  return {
    flights: flightResults.results.slice(0, 5).map(f => ({
      price: `$${f.price.total}`,
      airline: f.validatingAirline,
      duration: f.itineraries[0]?.duration,
    })),
    // Provide pre-built booking links so Claude doesn't need to construct them
    searchParams: {
      origin: origin,
      destination: input.destination,
      departureDate: input.departure_date,
      returnDate: input.return_date,
      travelers: travelers,
    },
    bookingLinks: {
      kayak: kayakLink,
      googleFlights: googleFlightsLink,
    },
    // Airport location links for Google Maps
    airportLinks: {
      origin: {
        code: origin,
        googleMapsUrl: originAirportUrl,
      },
      destination: {
        code: input.destination,
        googleMapsUrl: destAirportUrl,
      },
    },
    // Primary link for Claude to use
    bookingLink: kayakLink,
    bookingLinkText: `Search ${origin} → ${input.destination} flights`,
    // Note about Google Flights
    note: "Google Flights link also available for price comparison (no API prices available, but link prefills the search)",
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
    stations: chargingStations.map(s => {
      // PlugShare provides the most authoritative EV charging info
      const officialUrl = generatePlugShareLink(s.latitude, s.longitude);
      const googleMapsUrl = generateGoogleMapsLink(s.name, s.city, s.state);
      
      console.log(`[LinkGen] EV Station "${s.name}": officialUrl=${officialUrl}`);
      
      return {
        name: s.name,
        location: `${s.city}, ${s.state}`,
        operator: s.operator,
        powerKW: s.powerKW,
        numChargers: s.numPoints,
        isTesla: s.isTeslaSupercharger,
        isFastCharger: s.isFastCharger,
        cost: s.usageCost,
        // AUTHORITATIVE URL from OpenChargeMap - Claude should use this
        officialUrl: officialUrl,
        googleMapsUrl: googleMapsUrl,
        directionsUrl: generateDirectionsLink(`${s.name}, ${s.city}, ${s.state}`),
        plugShareUrl: officialUrl,
        teslaUrl: s.isTeslaSupercharger ? generateTeslaChargerLink(`${s.city}, ${s.state}`) : undefined,
        _linkNote: 'USE officialUrl/plugShareUrl for charging station info - from OpenChargeMap API',
      };
    }),
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
  // Generate booking link for hotels
  const bookingSearchUrl = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(input.location)}&checkin=${input.check_in_date}&checkout=${input.check_out_date}&group_adults=${travelers}&no_rooms=${rooms}`;
  console.log(`[LinkGen] Hotel booking search: ${bookingSearchUrl}`);
  
  return {
    hotels: hotelResults.results.slice(0, 8).map(h => {
      const googleMapsUrl = generateGoogleMapsLink(h.name, input.location);
      const directionsUrl = generateDirectionsLink(`${h.name}, ${input.location}`);
      console.log(`[LinkGen] Hotel "${h.name}": googleMaps=${googleMapsUrl}`);
      return {
        name: h.name,
        price: `$${h.price.total}`,
        pricePerNight: `$${h.price.perNight}`,
        rating: h.rating,
        address: h.address,
        amenities: h.amenities?.slice(0, 5),
        googleMapsUrl,
        directionsUrl,
      };
    }),
    totalFound: hotelResults.totalResults,
    providers: hotelResults.providers,
    bookingLinks: {
      booking: bookingSearchUrl,
    },
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
  
  // Generate car rental booking links
  const kayakCarsUrl = `https://www.kayak.com/cars/${encodeURIComponent(input.pickup_location)}/${input.pickup_date}/${input.dropoff_date}`;
  console.log(`[LinkGen] Car rental: pickup="${input.pickup_location}", dates=${input.pickup_date} to ${input.dropoff_date}`);
  console.log(`[LinkGen] Car rental Kayak: ${kayakCarsUrl}`);
  
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
    bookingLinks: {
      kayak: kayakCarsUrl,
    },
  };
}

async function handleSearchActivities(input: any, facade: TravelFacade): Promise<any> {
  console.log(`[LinkGen] Activities search for location: ${input.location}`);
  
  const activityResults = await facade.searchActivities({
    location: input.location,
    radius: 50,
  });
  
  return {
    activities: activityResults.results.slice(0, 10).map(a => {
      // Amadeus provides authoritative booking links
      const officialUrl = a.bookingLink;
      const googleMapsUrl = a.coordinates 
        ? `https://www.google.com/maps/search/?api=1&query=${a.coordinates.latitude},${a.coordinates.longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.name + ' ' + input.location)}`;
      
      console.log(`[LinkGen] Activity "${a.name}": officialUrl=${officialUrl || 'none'}, provider=${a.provider}`);
      
      return {
        name: a.name,
        description: a.shortDescription?.substring(0, 150) + (a.shortDescription && a.shortDescription.length > 150 ? '...' : ''),
        price: a.price?.amount ? `$${a.price.amount}` : 'Price varies',
        rating: a.rating,
        duration: a.duration,
        // AUTHORITATIVE URL from Amadeus - Claude MUST use this
        officialUrl: officialUrl,
        bookingLink: a.bookingLink,
        googleMapsUrl,
        provider: a.provider,
        _linkNote: 'USE officialUrl/bookingLink for activity booking - these are from Amadeus API',
      };
    }),
    totalFound: activityResults.totalResults,
    providers: activityResults.providers,
  };
}

// REMOVED: handleRefreshPhotos function - Unsplash integration removed

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
  console.log('[Restaurant] === handleSearchRestaurants called ===');
  console.log('[Restaurant] Input location from Claude:', input.location);
  
  // DETERMINISTIC: Use module-level destination cache (set by park search)
  const destCache = getDestinationCache();
  const staticGateway = resolveGatewayCity(input.location);
  
  console.log('[Restaurant] Destination cache:', destCache);
  console.log('[Restaurant] Static gateway lookup result:', staticGateway);
  
  // Priority: 1) Module-level destination cache, 2) Static gateway lookup, 3) Input location (last resort)
  let searchLocation: string;
  let locationSource: string;
  
  if (destCache) {
    // BEST: Use the deterministic destination cache from park search
    searchLocation = `${destCache.gatewayCity}, ${destCache.gatewayState}`;
    locationSource = 'destination-cache';
  } else if (staticGateway) {
    searchLocation = `${staticGateway.city}, ${staticGateway.state}`;
    locationSource = 'static-gateway-lookup';
  } else {
    searchLocation = input.location;
    locationSource = 'claude-input-fallback';
    console.warn('[Restaurant] WARNING: Using Claude input as fallback - may be incorrect');
  }
  
  console.log(`[Restaurant] Final search location: "${searchLocation}" (source: ${locationSource})`);
  
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
      restaurants: yelpResults.businesses.map(r => {
        const googleMapsUrl = generateGoogleMapsLink(r.name, r.location.city, r.location.state);
        const reservationLink = r.transactions.includes('restaurant_reservation') 
          ? YelpAdapter.generateReservationLink(r) 
          : undefined;
        
        // Yelp provides authoritative URLs
        const officialUrl = r.url;
        console.log(`[LinkGen] Restaurant "${r.name}": officialUrl=${officialUrl}`);
        
        return {
          name: r.name,
          address: r.location.displayAddress.join(', '),
          city: r.location.city,
          state: r.location.state,
          rating: `${r.rating}/5`,
          reviewCount: r.reviewCount,
          reviewsUrl: r.url,               // Verified - from Yelp API
          reviewSource: 'Yelp',
          priceLevel: r.price || 'Price unknown',
          cuisine: YelpAdapter.formatCategories(r.categories),
          phone: r.displayPhone || 'No phone',
          distanceMiles: r.distance ? (r.distance / 1609.34).toFixed(1) : null,
          supportsReservation: r.transactions.includes('restaurant_reservation'),
          reservationLink: reservationLink, // Only included if restaurant supports reservations
          // AUTHORITATIVE URL from Yelp - Claude MUST use this
          officialUrl: officialUrl,
          yelpUrl: r.url,                  // Verified - from Yelp API (PREFER THIS)
          googleMapsUrl: googleMapsUrl,    // Always valid fallback
          directionsUrl: generateDirectionsLink(`${r.name}, ${r.location.city}, ${r.location.state}`),
          imageUrl: r.imageUrl,
          _linkNote: 'USE officialUrl/yelpUrl for restaurant info - from Yelp API',
        };
      }),
      totalFound: yelpResults.total,
      searchLocation: input.location,
      cuisineFilter: input.cuisine || 'all types',
      source: 'yelp',
      photosAdded: yelpResults.businesses.filter(r => r.imageUrl).length,
      linkNote: 'Use yelpUrl or googleMapsUrl for restaurant links. Reservation links may not always be available.',
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
  // IMPORTANT: Use the actual searchLocation (which is the resolved gateway city), NOT the destination cache
  // The destination cache stores the park name, but restaurants are in the gateway town
  const cacheCity = staticGateway?.city || searchLocation.split(',')[0].trim();
  const cacheState = staticGateway?.state || searchLocation.split(',')[1]?.trim() || '';
  
  const cachedGoogleRestaurants = results.results.map(r => ({
    name: r.name,
    city: cacheCity,
    state: cacheState,
    address: r.address,
  }));
  updateRestaurantCache(cachedGoogleRestaurants, input.location);

  return {
    restaurants: results.results.map(r => {
      // Generate Google Maps URL for reviews and navigation
      const googleMapsUrl = generateGoogleMapsLink(r.name, cacheCity, cacheState);
      const directionsUrl = generateDirectionsLink(`${r.name}, ${cacheCity}, ${cacheState}`);
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
        googleMapsUrl: googleMapsUrl,
        directionsUrl: directionsUrl,
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
    city?: string;
    state?: string;
    date?: string;
    time?: string;
    party_size?: number;
  },
  context: ChatContext
): Promise<any> {
  console.log('[Reservation] === handleGetReservationLink called ===');
  console.log('[Reservation] Input:', JSON.stringify(input, null, 2));
  
  // CRITICAL: Look up restaurant in cache to get CORRECT location
  // This is the primary source - the restaurant's actual location from Yelp search results
  const cachedRestaurant = getCachedRestaurant(input.restaurant_name);
  const cacheInfo = getCacheInfo();
  console.log('[Reservation] Cached restaurant:', cachedRestaurant);
  console.log('[Reservation] Cache info:', cacheInfo);
  
  // DETERMINISTIC: Get destination from module-level cache (set by park search)
  const destCache = getDestinationCache();
  console.log('[Reservation] Destination cache:', destCache);

  // Priority: 1) Cached restaurant location, 2) Destination cache, 3) Static gateway lookup
  let city: string | undefined;
  let state: string | undefined;
  let locationSource = 'unknown';
  
  if (cachedRestaurant) {
    // BEST: Use the restaurant's actual location from search results
    city = cachedRestaurant.city;
    state = cachedRestaurant.state;
    locationSource = 'cache';
    console.log(`[Reservation] Using cached location for "${input.restaurant_name}": ${city}, ${state}`);
  } else if (destCache) {
    // GOOD: Use destination cache from park search
    city = destCache.gatewayCity;
    state = destCache.gatewayState;
    locationSource = 'destination-cache';
    console.log(`[Reservation] Using destination cache: ${city}, ${state}`);
  } else if (cacheInfo.location) {
    // OK: Try static gateway city lookup from the search location in cache
    const gatewayFromCache = resolveGatewayCity(cacheInfo.location);
    if (gatewayFromCache) {
      city = gatewayFromCache.city;
      state = gatewayFromCache.state;
      locationSource = 'static-gateway';
      console.log(`[Reservation] Using static gateway city for "${cacheInfo.location}": ${city}, ${state}`);
    }
  }
  
  // NEVER use Claude's input for city/state - it's unreliable (often uses user's home location)
  if (!city || !state) {
    console.error(`[Reservation] ERROR: No trusted location source for "${input.restaurant_name}"`);
    console.error(`[Reservation] Claude provided: ${input.city}, ${input.state} - IGNORED (unreliable)`);
    return {
      error: 'Could not determine restaurant location. Please search for restaurants first.',
      suggestion: 'Try searching for restaurants near the park before requesting a reservation link.',
      debug: {
        searchedFor: input.restaurant_name,
        cacheInfo: cacheInfo,
        destCache: destCache ? `${destCache.gatewayCity}, ${destCache.gatewayState}` : 'not set',
      },
    };
  }

  console.log('[Reservation] Final location resolution:', {
    restaurant: input.restaurant_name,
    city,
    state,
    locationSource,
    date: input.date,
    time: input.time,
    partySize: input.party_size || 2,
  });

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

  // Build formatted links with display labels for clean presentation
  const formattedLinks: Array<{ label: string; url: string; platform: string }> = [];
  
  if (openTableValid) {
    formattedLinks.push({
      label: 'Book on OpenTable',
      url: links.openTable,
      platform: 'OpenTable',
    });
  }
  
  formattedLinks.push({
    label: 'Find on Google',
    url: links.google,
    platform: 'Google',
  });
  
  formattedLinks.push({
    label: 'View on Yelp',
    url: links.yelp,
    platform: 'Yelp',
  });
  
  formattedLinks.push({
    label: 'Check Resy',
    url: links.resy,
    platform: 'Resy',
  });

  // Choose best primary link
  const primaryLink = openTableValid ? links.openTable : links.google;
  const primaryPlatform = openTableValid ? 'OpenTable' : 'Google';
  const primaryLabel = openTableValid ? 'Book on OpenTable' : 'Find on Google';

  return {
    reservationDetails,
    links: formattedLinks,
    primaryLink: {
      label: primaryLabel,
      url: primaryLink,
      platform: primaryPlatform,
    },
    openTableAvailable: openTableValid,
    message: openTableValid 
      ? `Here are reservation options for ${input.restaurant_name}:`
      : `${input.restaurant_name} may not be on OpenTable. Here are other ways to make a reservation:`,
  };
}

async function handleGetWildlife(
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
        message: `No wildlife data available for park code "${parkCode}". This park may not have iNaturalist observations yet.`,
        species: [],
      };
    }

    // Collect wildlife photos for gallery
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

    // Group by category for better display
    const grouped: Record<string, typeof species> = {};
    for (const s of species) {
      const cat = s.category || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(s);
    }

    // Generate links for species with Wikipedia pages
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
      species: species.slice(0, 15).map(s => {
        // iNaturalist provides authoritative Wikipedia links
        const officialUrl = s.wikipediaUrl;
        console.log(`[LinkGen] Wildlife "${s.commonName}": officialUrl=${officialUrl || 'none'}`);
        
        return {
          name: s.commonName,
          scientificName: s.scientificName,
          category: s.category,
          observations: s.count,
          photoUrl: s.photoUrl,
          // AUTHORITATIVE URL from iNaturalist - Claude should use this
          officialUrl: officialUrl,
          wikipediaUrl: s.wikipediaUrl,
          _linkNote: 'USE officialUrl/wikipediaUrl for species info - from iNaturalist API',
        };
      }),
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

async function handleGetCampgrounds(
  input: { park_code: string },
  facade: TravelFacade,
  context: ChatContext
): Promise<any> {
  const parkCode = input.park_code.toLowerCase();
  console.log(`[Chat] Campgrounds query for park: ${parkCode}`);
  
  // Extract travel dates from context for prefilled links
  const tripContext = context.tripContext;
  const activeLeg = tripContext?.activeLeg;
  const leg = activeLeg !== undefined ? tripContext?.legs?.[activeLeg] : tripContext?.legs?.[0];
  const startDate = leg?.dates?.start;
  const endDate = leg?.dates?.end;
  
  console.log(`[LinkGen] Campground dates from context: startDate=${startDate || 'none'}, endDate=${endDate || 'none'}`);

  try {
    const campgrounds = await facade.getCampgroundsFromRecreationGov(parkCode);
    
    if (campgrounds.length === 0) {
      return {
        parkCode,
        message: `No campground data found for park code "${parkCode}" on Recreation.gov. Try checking the NPS website directly.`,
        campgrounds: [],
        npsUrl: `https://www.nps.gov/${parkCode}/planyourvisit/camping.htm`,
      };
    }

    // Generate reservation links for campgrounds
    const links: Array<{ label: string; url: string }> = [];
    campgrounds.slice(0, 5).forEach(c => {
      if (c.reservable && c.reservationUrl) {
        links.push({
          label: `Reserve ${c.name}`,
          url: c.reservationUrl,
        });
      }
    });
    
    // Add general NPS camping page
    links.push({
      label: 'NPS Camping Information',
      url: `https://www.nps.gov/${parkCode}/planyourvisit/camping.htm`,
    });

    return {
      parkCode,
      totalCampgrounds: campgrounds.length,
      campgrounds: campgrounds.map(c => {
        // Generate Google Maps link using coordinates or address
        let googleMapsUrl: string;
        let directionsUrl: string;
        
        if (c.coordinates.latitude && c.coordinates.longitude) {
          // Use coordinates for precise location
          googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${c.coordinates.latitude},${c.coordinates.longitude}`;
          directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${c.coordinates.latitude},${c.coordinates.longitude}`;
          console.log(`[LinkGen] Campground "${c.name}" - Using coords: lat=${c.coordinates.latitude}, lng=${c.coordinates.longitude}`);
        } else if (c.address) {
          // Fallback to address search - address is an object, need to stringify
          const addressStr = [c.address.street, c.address.city, c.address.state, c.address.zip]
            .filter(Boolean)
            .join(', ');
          const addressQuery = encodeURIComponent(`${c.name}, ${addressStr}`);
          googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${addressQuery}`;
          directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${addressQuery}`;
          console.log(`[LinkGen] Campground "${c.name}" - Using address: ${addressStr}`);
        } else {
          // Fallback to name search
          const nameQuery = encodeURIComponent(c.name);
          googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${nameQuery}`;
          directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${nameQuery}`;
          console.log(`[LinkGen] Campground "${c.name}" - Using name only (no coords/address)`);
        }
        
        // Generate Recreation.gov search link WITH DESTINATION AND DATE PREFILL
        // Recreation.gov URL format: /search?q=campground+name&inventory_type=camping&start_date=...&end_date=...
        // The campground name is the primary prefill - this is what users want to search for
        const campgroundSearchTerm = c.name;
        let recGovSearchUrl = `https://www.recreation.gov/search?q=${encodeURIComponent(campgroundSearchTerm)}&inventory_type=camping`;
        if (startDate && endDate) {
          recGovSearchUrl += `&start_date=${startDate}&end_date=${endDate}`;
        }
        
        // Also generate a direct campground page URL if we have the facility ID
        // Recreation.gov camping URLs: /camping/campgrounds/{FACILITY_ID}
        const facilityId = c.id; // From RIDB API
        let directCampgroundUrl = facilityId 
          ? `https://www.recreation.gov/camping/campgrounds/${facilityId}`
          : null;
        if (directCampgroundUrl && startDate && endDate) {
          directCampgroundUrl += `?start_date=${startDate}&end_date=${endDate}`;
        }
        
        // If we have a direct reservation URL from the API, add dates to it too
        let prefilledReservationUrl = c.reservationUrl;
        if (c.reservationUrl && startDate && endDate) {
          // Recreation.gov camping pages accept date params
          const separator = c.reservationUrl.includes('?') ? '&' : '?';
          prefilledReservationUrl = `${c.reservationUrl}${separator}start_date=${startDate}&end_date=${endDate}`;
        }
        
        // Priority: direct campground URL > API reservation URL > search URL
        // Direct URL with facility ID is most reliable for taking user directly to campground
        const officialUrl = directCampgroundUrl || prefilledReservationUrl || recGovSearchUrl;
        
        console.log(`[LinkGen] Campground "${c.name}" (ID: ${facilityId || 'none'}):`);
        console.log(`[LinkGen]   - OFFICIAL URL (use this!): ${officialUrl}`);
        console.log(`[LinkGen]   - destination prefilled: ${c.name}`);
        console.log(`[LinkGen]   - dates prefilled: ${startDate && endDate ? `${startDate} to ${endDate}` : 'NO'}`);
        console.log(`[LinkGen]   - directCampgroundUrl: ${directCampgroundUrl || 'none'}`);
        console.log(`[LinkGen]   - googleMapsUrl: ${googleMapsUrl}`);
        
        return {
          name: c.name,
          description: c.description,
          type: c.type,
          reservable: c.reservable,
          facilityId: facilityId, // Include facility ID for reference
          // AUTHORITATIVE URL with destination and dates prefilled - Claude MUST use this
          officialUrl: officialUrl,
          // Direct link to campground page on Recreation.gov
          directCampgroundUrl: directCampgroundUrl,
          reservationUrl: prefilledReservationUrl,
          recGovSearchUrl,
          // Include dates for reference
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
          // Instruction for Claude
          _linkNote: 'USE officialUrl for campground booking - do NOT construct your own URL',
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
