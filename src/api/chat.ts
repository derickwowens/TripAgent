import Anthropic from '@anthropic-ai/sdk';
import { TravelFacade } from '../domain/facade/TravelFacade.js';
import { GoogleMapsAdapter } from '../providers/GoogleMapsAdapter.js';
import { validateLinksInResponse } from '../utils/linkValidator.js';

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

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatContext {
  userLocation?: {
    city: string;
    state: string;
    nearestAirport: string;
  };
  tripContext?: {
    destination?: string;
    parkCode?: string;
    numDays?: number;
    numTravelers?: number;
  };
  userProfile?: string;
}

const SYSTEM_PROMPT = `You are TripAgent, a friendly and knowledgeable AI travel assistant specializing in National Park trips. You help users plan amazing outdoor adventures.

Your personality:
- Enthusiastic about nature and travel
- Concise but informative
- Use emojis sparingly to add warmth
- Focus on practical, actionable advice

When helping plan a trip, gather this information through natural conversation:
1. Destination (which park or area)
2. Trip duration (number of days)
3. Number of travelers
4. Interests (hiking, camping, photography, etc.)

IMPORTANT - FLIGHT OPTIONS:
Do NOT automatically pick a single destination airport. Instead, research and present 3-5 nearby airport options with pricing comparisons. For example, for Everglades:
- MIA (Miami) - closest but often most expensive
- FLL (Fort Lauderdale) - 30 min further, often cheaper
- PBI (Palm Beach) - alternative option
- RSW (Fort Myers) - west coast option

Always show a comparison table like:
✈️ FLIGHT OPTIONS from [origin]
━━━━━━━━━━━━━━━━━━━━━━
• MIA (Miami): $XXX - 1hr drive to park
• FLL (Ft Lauderdale): $XXX - 1.5hr drive ⭐ Best value
• RSW (Ft Myers): $XXX - 2hr drive
━━━━━━━━━━━━━━━━━━━━━━
💡 Recommendation: [cheapest or best value option]

This applies to ALL destinations, including national parks. Search multiple nearby airports and let the user see the price differences so they can make an informed choice.

Once you have enough info, use the available tools to fetch REAL PRICING DATA and provide recommendations for:
- ✈️ Flights (3-5 airports with prices - show the comparison!)
- 🚗 Car rentals (with daily rates)
- 🏕️ Lodging/camping options (with nightly rates)
- 🥾 Top hiking trails (free!)
- 🎫 Park entrance fees

IMPORTANT - DRIVING DISTANCES:
Always use the get_driving_distance tool to get accurate drive times for road trips. Never estimate or guess driving times. The tool provides real distance and duration data. Include driving time when showing airport-to-park comparisons so users can factor in the drive.

IMPORTANT - BUDGET SUMMARY:
Always end trip plans with a clear cost breakdown and total estimate. ALWAYS provide a cost summary even if some data is missing - use estimates and clearly mark them.

💰 ESTIMATED TRIP COST
━━━━━━━━━━━━━━━━━━━━━━
• Flights: $XXX × [travelers] = $XXX
• Car rental: $XX/day × [days] = $XXX
• Lodging: $XX/night × [nights] = $XXX
• Park entrance: $XX
• Food estimate: $XX/day × [days] = $XXX
━━━━━━━━━━━━━━━━━━━━━━
📊 TOTAL: $X,XXX (for [X] travelers, [X] days)

HANDLING MISSING DATA:
- If flight data is unavailable: Use "~$XXX (estimate)" and note "Flight prices vary - click link to see current rates"
- If hotel data is unavailable: Estimate $100-200/night for hotels near national parks, $20-50/night for camping
- If car rental data is unavailable: Estimate $40-80/day for standard rental
- NEVER skip the cost summary - always provide your best estimate with clear labels like "~" or "(est.)"
- Include a note: "⚠️ Some prices are estimates - click booking links for current rates"

You have access to real-time data through tools. When you receive tool results, incorporate the ACTUAL PRICES naturally into your response.

IMPORTANT - BOOKING LINKS (use EXACT formats below, replacing values):

FLIGHTS - Use Kayak format (TESTED & WORKING):
🔗 [Search flights](https://www.kayak.com/flights/LAX-JFK/2026-03-15/2026-03-20)
Format: https://www.kayak.com/flights/{ORIGIN}-{DEST}/{DEPART-DATE}/{RETURN-DATE}

HOTELS - Use Booking.com format (TESTED & WORKING):
🔗 [Find hotels](https://www.booking.com/searchresults.html?ss=Yosemite%20National%20Park&checkin=2026-03-15&checkout=2026-03-20)
Format: https://www.booking.com/searchresults.html?ss={DESTINATION}&checkin={DATE}&checkout={DATE}
Note: Replace spaces with %20 in destination names

CAR RENTALS - Use Kayak format (TESTED & WORKING):
🔗 [Rent a car](https://www.kayak.com/cars/LAX/2026-03-15/2026-03-20)
Format: https://www.kayak.com/cars/{AIRPORT}/{PICKUP-DATE}/{DROPOFF-DATE}

NATIONAL PARKS:
🔗 [Park info](https://www.nps.gov/yose/index.htm)
Format: https://www.nps.gov/{PARK-CODE}/index.htm

CRITICAL: Always use the ACTUAL airport codes, dates, and locations from the conversation. Dates must be YYYY-MM-DD format.

Keep responses concise - mobile users prefer shorter messages. Use line breaks for readability.`;

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

export async function createChatHandler(facade: TravelFacade) {
  return async (messages: ChatMessage[], context: ChatContext, model?: string): Promise<string> => {
    const selectedModel = model || DEFAULT_MODEL;
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    // Build context message
    let contextInfo = '';
    if (context.userLocation) {
      contextInfo += `User is located in ${context.userLocation.city}, ${context.userLocation.state}. Nearest airport: ${context.userLocation.nearestAirport}.\n`;
    }
    if (context.tripContext?.destination) {
      contextInfo += `Current trip planning: ${context.tripContext.destination}`;
      if (context.tripContext.numDays) contextInfo += `, ${context.tripContext.numDays} days`;
      if (context.tripContext.numTravelers) contextInfo += `, ${context.tripContext.numTravelers} travelers`;
      contextInfo += '\n';
    }
    if (context.userProfile) {
      contextInfo += `\nUser profile/preferences:\n${context.userProfile}\n\nIMPORTANT: Use these preferences to personalize recommendations:
- If they mention "family of four", assume 4 travelers
- If they prefer warm destinations, suggest accordingly
- If they have accessibility needs, prioritize accessible options
- If they're traveling with a dog or service animal, provide pet-friendly lodging options, airline pet policies, and note any park restrictions on pets (most national parks restrict pets on trails but allow them in campgrounds and on paved roads)
- For service animals specifically, note they are allowed in more areas than regular pets under ADA guidelines
\n`;
    }

    const systemPrompt = contextInfo ? `${SYSTEM_PROMPT}\n\nCurrent context:\n${contextInfo}` : SYSTEM_PROMPT;

    // Define tools for Claude
    const tools: Anthropic.Tool[] = [
      {
        name: 'search_national_parks',
        description: 'Search for US National Parks by name. Returns park info, entrance fees, and activities.',
        input_schema: {
          type: 'object' as const,
          properties: {
            query: { type: 'string', description: 'Park name to search (e.g., "Yosemite", "Yellowstone")' },
          },
          required: ['query'],
        },
      },
      {
        name: 'plan_park_trip',
        description: 'Get a complete trip plan for a National Park including flights, lodging, hikes, and budget tips.',
        input_schema: {
          type: 'object' as const,
          properties: {
            park_code: { type: 'string', description: 'Park code (e.g., "yose", "yell", "grca", "zion")' },
            origin_airport: { type: 'string', description: 'Departure airport code (e.g., "LAX", "JFK")' },
            arrival_date: { type: 'string', description: 'Arrival date YYYY-MM-DD' },
            departure_date: { type: 'string', description: 'Departure date YYYY-MM-DD' },
            adults: { type: 'number', description: 'Number of travelers' },
          },
          required: ['park_code', 'origin_airport', 'arrival_date', 'departure_date'],
        },
      },
      {
        name: 'get_park_hikes',
        description: 'Get popular hiking trails for a National Park with difficulty, distance, and highlights.',
        input_schema: {
          type: 'object' as const,
          properties: {
            park_code: { type: 'string', description: 'Park code (e.g., "yose", "yell", "grca")' },
          },
          required: ['park_code'],
        },
      },
      {
        name: 'search_flights',
        description: 'Search for flights between airports.',
        input_schema: {
          type: 'object' as const,
          properties: {
            origin: { type: 'string', description: 'Origin airport code' },
            destination: { type: 'string', description: 'Destination airport code' },
            departure_date: { type: 'string', description: 'Departure date YYYY-MM-DD' },
            return_date: { type: 'string', description: 'Return date YYYY-MM-DD' },
            adults: { type: 'number', description: 'Number of passengers' },
          },
          required: ['origin', 'destination', 'departure_date'],
        },
      },
      {
        name: 'get_driving_distance',
        description: 'Get accurate driving distance and time between two locations. Use this for road trips and to calculate drive time from airports to national parks or destinations.',
        input_schema: {
          type: 'object' as const,
          properties: {
            origin: { type: 'string', description: 'Starting location (e.g., "LAX Airport", "Los Angeles, CA")' },
            destination: { type: 'string', description: 'Destination (e.g., "Yosemite National Park", "Grand Canyon Village, AZ")' },
          },
          required: ['origin', 'destination'],
        },
      },
    ];

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
            switch (toolUse.name) {
              case 'search_national_parks':
                const parks = await facade.searchNationalParks((toolUse.input as any).query);
                result = { parks: parks.slice(0, 3) };
                break;

              case 'plan_park_trip':
                const input = toolUse.input as any;
                result = await facade.planParkTrip({
                  parkCode: input.park_code,
                  originAirport: input.origin_airport,
                  arrivalDate: input.arrival_date,
                  departureDate: input.departure_date,
                  adults: input.adults || 1,
                });
                break;

              case 'get_park_hikes':
                const hikes = facade.getParkHikes((toolUse.input as any).park_code);
                result = { hikes };
                break;

              case 'search_flights':
                const flightInput = toolUse.input as any;
                const flightResults = await facade.searchFlights({
                  origin: flightInput.origin,
                  destination: flightInput.destination,
                  departureDate: flightInput.departure_date,
                  returnDate: flightInput.return_date,
                  adults: flightInput.adults || 1,
                });
                result = {
                  flights: flightResults.results.slice(0, 5).map(f => ({
                    price: `$${f.price.total}`,
                    airline: f.validatingAirline,
                    duration: f.itineraries[0]?.duration,
                  })),
                };
                break;

              case 'get_driving_distance':
                const mapsAdapter = new GoogleMapsAdapter();
                const distanceInput = toolUse.input as any;
                const distanceResult = await mapsAdapter.getDistance(
                  distanceInput.origin,
                  distanceInput.destination
                );
                result = distanceResult ? {
                  origin: distanceResult.origin,
                  destination: distanceResult.destination,
                  distance: distanceResult.distance.text,
                  duration: distanceResult.duration.text,
                  status: distanceResult.status,
                } : { error: 'Could not calculate driving distance' };
                break;

              default:
                result = { error: `Unknown tool: ${toolUse.name}` };
            }
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
      
      // Validate and fix any broken links in the response
      try {
        const validatedResponse = await validateLinksInResponse(rawResponse);
        return validatedResponse;
      } catch (linkError) {
        console.warn('[Chat] Link validation failed, returning raw response:', linkError);
        return rawResponse;
      }
    } catch (error: any) {
      console.error('Claude API error:', error);
      throw new Error(`Chat error: ${error.message}`);
    }
  };
}
