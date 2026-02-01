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
import { StateParkService } from '../../providers/parks/StateParkService.js';
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

// Initialize StateParkService for state parks tools
const stateParkService = new StateParkService(
  process.env.RECREATION_GOV_API_KEY,
  process.env.NPS_API_KEY
);

// NOTE: Module-level caching removed to prevent stale/broken links
// All link generation now uses fresh context data passed through the request
// This ensures deterministic, reliable link generation

// Helper to resolve gateway city from park name using static lookup
// This is deterministic and doesn't rely on cached state

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

    // Build context message using fresh context data (no caching)
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

    // ============================================
    // STATE PARKS TOOLS
    // ============================================
    case 'search_state_parks':
      result = await handleSearchStateParks(toolUse.input as any, collectedPhotos, facade);
      break;

    case 'get_state_park_details':
      result = await handleGetStateParkDetails(toolUse.input as any, collectedPhotos, facade);
      break;

    case 'get_state_park_campgrounds':
      result = await handleGetStateParkCampgrounds(toolUse.input as any, collectedPhotos);
      break;

    case 'get_state_park_hikes':
      result = handleGetStateParkHikes(toolUse.input as any);
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
    
    // Gateway city is returned in result - no caching needed
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
  // Resolve values with context priority: leg override > conversation override > input > profile default
  const travelers = input.adults || resolveContextValue<number>('numTravelers', context, activeLeg) || 1;
  const origin = input.origin || resolveContextValue<string>('homeAirport', context, activeLeg) || context.userLocation?.nearestAirport;
  
  // Use travel dates from context if not provided in input
  const departureDate = input.departure_date || context.travelDates?.departure;
  const returnDate = input.return_date || context.travelDates?.return;
  
  if (!departureDate) {
    return {
      error: 'Departure date is required. Please specify travel dates in your profile or request.',
      flights: [],
    };
  }
  
  const flightResults = await facade.searchFlights({
    origin: origin,
    destination: input.destination,
    departureDate,
    returnDate,
    adults: travelers,
  });
  
  // DETERMINISTIC: Generate booking links directly with exact parameters
  // This ensures Claude uses the correct links without constructing from memory
  
  // Kayak link format
  const kayakLink = returnDate
    ? `https://www.kayak.com/flights/${origin}-${input.destination}/${departureDate}/${returnDate}`
    : `https://www.kayak.com/flights/${origin}-${input.destination}/${departureDate}`;
  
  // Google Flights link format - uses tfs parameter for structured prefill
  // Format dates as YYYY-MM-DD for Google Flights
  const formatGoogleDate = (date: string) => date; // Already in YYYY-MM-DD format
  
  // Build Google Flights URL with proper parameters
  // tfs format: origin.destination.departure_date*destination.origin.return_date (for round trip)
  const googleFlightsTfs = returnDate
    ? `${origin}.${input.destination}.${formatGoogleDate(departureDate)}*${input.destination}.${origin}.${formatGoogleDate(returnDate)}`
    : `${origin}.${input.destination}.${formatGoogleDate(departureDate)}`;
  
  const googleFlightsLink = `https://www.google.com/travel/flights?tfs=${encodeURIComponent(googleFlightsTfs)}&tfu=EgYIAhAAGAA`;
  
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
  
  // Use travel dates from context if not provided in input
  const checkInDate = input.check_in_date || context.travelDates?.departure;
  const checkOutDate = input.check_out_date || context.travelDates?.return;
  
  if (!checkInDate || !checkOutDate) {
    return {
      error: 'Check-in and check-out dates are required. Please specify travel dates in your profile or request.',
      hotels: [],
    };
  }
  
  const hotelResults = await facade.searchHotels({
    location: input.location,
    checkInDate,
    checkOutDate,
    adults: travelers,
    rooms: rooms,
  });
  // Generate booking link for hotels
  const bookingSearchUrl = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(input.location)}&checkin=${checkInDate}&checkout=${checkOutDate}&group_adults=${travelers}&no_rooms=${rooms}`;
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
  
  // Use travel dates from context if not provided in input
  const pickupDate = input.pickup_date || context.travelDates?.departure;
  const dropoffDate = input.dropoff_date || context.travelDates?.return;
  
  if (!pickupDate || !dropoffDate) {
    return {
      error: 'Pickup and dropoff dates are required. Please specify travel dates in your profile or request.',
      cars: [],
    };
  }
  
  const carResults = await facade.searchCarRentals({
    pickupLocation: input.pickup_location,
    pickupDate,
    dropoffDate,
    pickupTime: input.pickup_time || '10:00',
    dropoffTime: input.dropoff_time || '10:00',
  });
  
  // Generate car rental booking links
  const kayakCarsUrl = `https://www.kayak.com/cars/${encodeURIComponent(input.pickup_location)}/${pickupDate}/${dropoffDate}`;
  console.log(`[LinkGen] Car rental: pickup="${input.pickup_location}", dates=${pickupDate} to ${dropoffDate}`);
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
  
  // DETERMINISTIC: Use static gateway lookup (no caching - always fresh)
  const staticGateway = resolveGatewayCity(input.location);
  console.log('[Restaurant] Static gateway lookup result:', staticGateway);
  
  // Priority: 1) Static gateway lookup, 2) Input location (fallback)
  let searchLocation: string;
  let locationSource: string;
  
  if (staticGateway) {
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
    // No caching - restaurant data returned directly in response

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

  // Use resolved gateway city for location data (no caching)
  const resolvedCity = staticGateway?.city || searchLocation.split(',')[0].trim();
  const resolvedState = staticGateway?.state || searchLocation.split(',')[1]?.trim() || '';

  return {
    restaurants: results.results.map(r => {
      // Generate Google Maps URL for reviews and navigation
      const googleMapsUrl = generateGoogleMapsLink(r.name, resolvedCity, resolvedState);
      const directionsUrl = generateDirectionsLink(`${r.name}, ${resolvedCity}, ${resolvedState}`);
      return {
        name: r.name,
        address: r.address,
        city: resolvedCity,           // Include for reservation links
        state: resolvedState,         // Include for reservation links
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
  
  // DETERMINISTIC: Use static gateway lookup or input city/state (no caching)
  // Priority: 1) Input city/state from tool call, 2) Static gateway lookup
  let city: string | undefined;
  let state: string | undefined;
  let locationSource = 'unknown';
  
  // First try static gateway lookup if a park/destination name is provided
  if (input.city) {
    const staticGateway = resolveGatewayCity(input.city);
    if (staticGateway) {
      city = staticGateway.city;
      state = staticGateway.state;
      locationSource = 'static-gateway';
      console.log(`[Reservation] Using static gateway for "${input.city}": ${city}, ${state}`);
    }
  }
  
  // Fall back to input city/state if provided
  if (!city && input.city) {
    city = input.city;
    state = input.state;
    locationSource = 'input';
    console.log(`[Reservation] Using input location: ${city}, ${state}`);
  }
  
  // If still no location, return error
  if (!city || !state) {
    console.error(`[Reservation] ERROR: No location provided for "${input.restaurant_name}"`);
    return {
      error: 'City and state are required for reservation links. Please provide the restaurant location.',
      suggestion: 'Include the city and state where the restaurant is located.',
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
  // Priority: travelDates (from profile) > tripContext legs > none
  const startDate = context.travelDates?.departure || context.tripContext?.legs?.[context.tripContext?.activeLeg || 0]?.dates?.start;
  const endDate = context.travelDates?.return || context.tripContext?.legs?.[context.tripContext?.activeLeg || 0]?.dates?.end;
  
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

// ============================================
// STATE PARKS TOOL HANDLERS
// ============================================

async function handleSearchStateParks(
  input: { state: string; query?: string },
  collectedPhotos: PhotoReference[],
  facade?: TravelFacade
): Promise<any> {
  console.log(`[State Parks] Searching parks in ${input.state}${input.query ? ` with query "${input.query}"` : ''}`);
  
  try {
    const results = await stateParkService.searchParks({
      state: input.state.toUpperCase(),
      query: input.query,
      limit: 20, // Keep results manageable
    });

    if (results.error) {
      return { error: results.error };
    }

    // Fetch photos from iNaturalist for the first few parks
    if (facade && results.parks.length > 0) {
      const parksToPhoto = results.parks.slice(0, 3);
      for (const park of parksToPhoto) {
        try {
          const observations = await facade.searchWildlifeObservations(park.name, 3);
          observations.forEach(obs => {
            if (obs.photoUrl) {
              collectedPhotos.push({
                keyword: obs.commonName || park.name,
                url: obs.photoUrl,
                caption: `${obs.commonName} at ${park.name} (iNaturalist)`,
                source: 'other',
              });
            }
          });
        } catch (photoError) {
          // Continue without photos for this park
        }
      }
      console.log(`[State Parks] Added ${collectedPhotos.length} iNaturalist photos for state parks search`);
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

async function handleGetStateParkDetails(
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

    // Fetch photos from iNaturalist for the state park
    if (facade) {
      try {
        const observations = await facade.searchWildlifeObservations(input.park_name, 8);
        observations.forEach(obs => {
          if (obs.photoUrl) {
            collectedPhotos.push({
              keyword: obs.commonName || input.park_name,
              url: obs.photoUrl,
              caption: `${obs.commonName} at ${input.park_name} (iNaturalist)`,
              source: 'other',
            });
          }
        });
        console.log(`[State Parks] Added ${observations.filter(o => o.photoUrl).length} iNaturalist photos for ${input.park_name}`);
      } catch (photoError) {
        console.log('[State Parks] Could not fetch iNaturalist photos:', photoError);
      }
    }

    // Add campground photos to gallery
    if (park.campgrounds && park.campgrounds.length > 0) {
      park.campgrounds.forEach(cg => {
        if (cg.photos && cg.photos.length > 0) {
          cg.photos.slice(0, 2).forEach(photo => {
            collectedPhotos.push({
              keyword: cg.name,
              url: photo.url,
              caption: photo.caption || `${cg.name} - Campground`,
              source: 'nps',
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

async function handleGetStateParkCampgrounds(
  input: { park_name: string; state: string },
  collectedPhotos: PhotoReference[]
): Promise<any> {
  console.log(`[State Parks] Getting campgrounds for "${input.park_name}" in ${input.state}`);
  
  try {
    const campgrounds = await stateParkService.getCampgroundsForPark(
      input.park_name, 
      input.state.toUpperCase()
    );

    // Add campground photos to gallery
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

// State name lookup for full names
const STATE_NAMES: Record<string, string> = {
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

function handleGetStateParkHikes(
  input: { park_name: string; state: string }
): any {
  console.log(`[State Parks] Getting hikes for "${input.park_name}" in ${input.state}`);
  
  const stateCode = input.state.toUpperCase();
  const stateName = STATE_NAMES[stateCode] || input.state;
  const parkName = input.park_name;
  
  // Generate AllTrails search URL for the park
  const allTrailsSearchQuery = encodeURIComponent(`${parkName} ${stateName}`);
  const allTrailsUrl = `https://www.alltrails.com/search?q=${allTrailsSearchQuery}`;
  
  // Generate Google Maps hiking search as backup
  const googleMapsQuery = encodeURIComponent(`${parkName} hiking trails`);
  const googleMapsUrl = `https://www.google.com/maps/search/${googleMapsQuery}`;
  
  return {
    parkName: parkName,
    state: stateCode,
    stateName: stateName,
    trailResources: [
      {
        name: 'AllTrails',
        description: 'Browse hiking trails with reviews, photos, difficulty ratings, and trail maps',
        url: allTrailsUrl,
        features: ['Trail maps', 'Difficulty ratings', 'User reviews', 'Photos', 'Offline maps'],
      },
      {
        name: 'Google Maps',
        description: 'View trail locations and get directions',
        url: googleMapsUrl,
        features: ['Directions', 'Satellite view', 'Nearby amenities'],
      },
    ],
    hikingTips: [
      'Check trail conditions before your visit - state park websites often have alerts',
      'Bring plenty of water, especially on longer hikes',
      'Start early to avoid crowds and afternoon heat',
      'Download offline maps before heading out (AllTrails Pro or Google Maps)',
      'Check if permits are required for backcountry trails',
    ],
    searchSuggestions: [
      `Search AllTrails for "${parkName}" to see all available trails`,
      'Filter by difficulty: Easy, Moderate, or Hard',
      'Sort by rating to find the most popular trails',
      'Check recent reviews for current trail conditions',
    ],
    note: `Click the AllTrails link to browse all hiking trails at ${parkName}. You can filter by distance, difficulty, and rating.`,
  };
}
