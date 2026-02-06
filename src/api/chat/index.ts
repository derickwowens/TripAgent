/**
 * Chat module - Main entry point
 * 
 * This module handles Claude AI chat interactions for TripAgent.
 * It orchestrates tool definitions, handlers, and response processing.
 */

import Anthropic from '@anthropic-ai/sdk';
import { TravelFacade } from '../../domain/facade/TravelFacade.js';

// Re-export types explicitly
export type { ChatMessage, ChatContext, ChatResponse, PhotoReference, ToolResult, ToolStatusCallback, TripLeg, ContextDefaults } from './types.js';
export { TOOL_DISPLAY_NAMES, resolveContextValue } from './types.js';

// Import modular components
import { ChatMessage, ChatContext, ChatResponse, PhotoReference, ToolStatusCallback, deduplicatePhotos } from './types.js';
import { SYSTEM_PROMPT, DEFAULT_MODEL, buildContextInfo } from './systemPrompt.js';
import { tools } from './toolDefinitions.js';
import { validateAndCleanResponse } from './responseProcessor.js';

// Import modular tool handlers
import {
  handleSearchNationalParks,
  handlePlanParkTrip,
  handleGetParkHikes,
  handleGetWildlife,
  handleGetCampgrounds,
  handleSearchStateParks,
  handleGetStateParkDetails,
  handleGetStateParkCampgrounds,
  handleGetStateParkHikes,
  handleGetStateTrails,
  handleLookupParkDatabase,
  handleGetParksNearLocation,
  handleGetParkDatabaseStats,
  handleSearchFlights,
  handleGetDrivingDistance,
  handleSearchEvChargingStations,
  handleSearchCarRentals,
  handleSearchHotels,
  handleSearchRestaurants,
  handleGetReservationLink,
  handleSearchActivities,
  resolveGatewayCity,
} from './toolHandlers/index.js';

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
      if (onToolStatus) onToolStatus('__thinking__', 'starting');
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

        if (onToolStatus) onToolStatus('__analyzing__', 'starting');
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
      result = await handleGetParkHikes(toolUse.input as any, facade);
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
      // Set destination from the query/state so photo filter knows what park we're discussing
      if ((toolUse.input as any).query) {
        destination = (toolUse.input as any).query;
        searchQuery = (toolUse.input as any).query;
      }
      break;

    case 'get_state_park_details':
      result = await handleGetStateParkDetails(toolUse.input as any, collectedPhotos, facade);
      destination = (toolUse.input as any).park_name;
      searchQuery = (toolUse.input as any).park_name;
      break;

    case 'get_state_park_campgrounds':
      result = await handleGetStateParkCampgrounds(toolUse.input as any, collectedPhotos);
      destination = (toolUse.input as any).park_name;
      break;

    case 'get_state_park_hikes':
      result = await handleGetStateParkHikes(toolUse.input as any);
      destination = (toolUse.input as any).park_name;
      break;

    case 'get_state_trails':
      result = await handleGetStateTrails(toolUse.input as any);
      break;

    // ============================================
    // S3 PARK DATABASE TOOLS
    // ============================================
    case 'lookup_park_database':
      result = await handleLookupParkDatabase(toolUse.input as any, collectedPhotos, facade);
      break;

    case 'get_parks_near_location':
      result = await handleGetParksNearLocation(toolUse.input as any);
      break;

    case 'get_park_database_stats':
      result = await handleGetParkDatabaseStats();
      break;

    default:
      result = { error: `Unknown tool: ${toolUse.name}` };
  }

  return { result, destination, searchQuery };
}

