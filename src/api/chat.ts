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

interface PhotoReference {
  keyword: string;
  url: string;
  caption?: string;
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

// Clean up formatting artifacts from Claude's response
// IMPORTANT: Preserves markdown links [text](url) for photo/link functionality
function cleanResponseFormatting(text: string): string {
  try {
    let cleaned = text;
    
    // Remove underscore dividers (3+ underscores) but NOT inside URLs
    cleaned = cleaned.replace(/(?<!\()_{3,}(?!\))/g, '---');
    
    // Remove asterisks used for bold/italic (but preserve content)
    // Be careful not to match asterisks that might be in URLs
    cleaned = cleaned.replace(/\*\*([^*\n]+)\*\*/g, '$1');
    cleaned = cleaned.replace(/(?<![a-zA-Z])\*([^*\n]+)\*(?![a-zA-Z])/g, '$1');
    
    // Remove hashtag headers at start of lines
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');
    
    // Replace asterisk bullets with proper bullets (only at line start)
    cleaned = cleaned.replace(/^\s*\*\s+/gm, '• ');
    
    // Remove inline backticks (preserve content)
    cleaned = cleaned.replace(/`([^`\n]+)`/g, '$1');
    
    // Clean up excessive dashes (more than 5)
    cleaned = cleaned.replace(/-{6,}/g, '---');
    
    // Clean up multiple consecutive blank lines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    return cleaned.trim();
  } catch (error) {
    console.warn('[Chat] Error in cleanResponseFormatting, returning original:', error);
    return text;
  }
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
✈️ Flight Options from [origin]
---
• MIA (Miami): $XXX - 1hr drive to park
• FLL (Ft Lauderdale): $XXX - 1.5hr drive (lowest price)
• RSW (Ft Myers): $XXX - 2hr drive
---
💡 Recommendation: [cheapest option with note about drive time tradeoff]

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

IMPORTANT - MENTIONING LOCATIONS BY NAME:
When discussing parks, campgrounds, and activities, ALWAYS mention them by their full official name at least once in your response. This helps users identify and research these locations. For example:
- Say "Great Smoky Mountains National Park" not just "the Smokies"
- Say "Elkmont Campground" not just "the campground"
- Say "Alum Cave Trail" not just "a popular trail"
This ensures users can easily look up and recognize these destinations.

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

IMPORTANT - TEXT FORMATTING FOR MOBILE:
This is a mobile app that displays PLAIN TEXT. Follow these formatting rules strictly:

NEVER USE:
- Asterisks (*) for bold, italics, or bullets
- Hashtags (#) for headers
- Underscores (_) or underscore lines (___) for emphasis or dividers
- Backticks (\`) for code
- ALL CAPS for emphasis (like "GIANT SEQUOIAS" - use "Giant Sequoias" instead)

ALWAYS USE:
- Emojis (✈️ 🏨 🚗 🥾 💰) as visual section markers
- Title Case for section headers (e.g., "Flight Options" not "FLIGHT OPTIONS")
- Bullet points with "•" symbol only
- Simple dashes (---) or line breaks for separation, not underscores
- Proper sentence case for all text
- Natural, conversational tone

IMPORTANT - NEUTRAL PRICING LANGUAGE:
Never use positive affirmation language when describing prices. Avoid phrases like:
- "Great deal", "Amazing price", "Excellent value", "Best value", "Fantastic rate"
- "Steal", "Bargain", "Can't beat this price"
- Any subjective value judgments about pricing

Instead, use neutral, factual language:
- "Lowest price option", "Most affordable", "Budget-friendly option"
- Simply state the price without judgment: "$245 roundtrip"
- "Lower cost alternative", "Price comparison shows..."
Users will decide for themselves if a price is good. Our job is to present accurate information, not make value judgments.

Example of GOOD formatting:
✈️ Flight Options
---
• LAX → Denver: $245 (United)
• LAX → Denver: $289 (Southwest)

🏨 Where to Stay
---
• Elkmont Campground - $25/night
• LeConte Lodge - $150/night

Example of BAD formatting (NEVER do this):
**FLIGHT OPTIONS**
_______________
* LAX -> DEN: $245
# GIANT SEQUOIAS

Keep responses concise and conversational - mobile users prefer shorter, friendly messages.`;

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

interface ChatResponse {
  response: string;
  photos?: PhotoReference[];
}

export async function createChatHandler(facade: TravelFacade) {
  return async (messages: ChatMessage[], context: ChatContext, model?: string): Promise<ChatResponse> => {
    // Collect photos from tool results
    const collectedPhotos: PhotoReference[] = [];
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
                // Collect multiple photos from park results
                parks.slice(0, 3).forEach(park => {
                  if (park.images && park.images.length > 0) {
                    // Add up to 3 photos per park
                    park.images.slice(0, 3).forEach((imageUrl: string, idx: number) => {
                      collectedPhotos.push({
                        keyword: idx === 0 ? park.name : `${park.name} photo ${idx + 1}`,
                        url: imageUrl,
                        caption: `${park.name} - National Park`
                      });
                    });
                    // Also add short name variation for first image
                    const shortName = park.name.replace(' National Park', '');
                    if (shortName !== park.name) {
                      collectedPhotos.push({
                        keyword: shortName,
                        url: park.images[0],
                        caption: park.name
                      });
                    }
                  }
                });
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
                
                // Collect multiple photos from park
                if (result.park?.images && result.park.images.length > 0) {
                  // Add up to 3 photos from park
                  result.park.images.slice(0, 3).forEach((imageUrl: string, idx: number) => {
                    collectedPhotos.push({
                      keyword: idx === 0 ? result.park.name : `${result.park.name} photo ${idx + 1}`,
                      url: imageUrl,
                      caption: `${result.park.name} - National Park`
                    });
                  });
                  // Add shorter keyword variation for first image
                  const shortName = result.park.name.replace(' National Park', '');
                  if (shortName !== result.park.name) {
                    collectedPhotos.push({
                      keyword: shortName,
                      url: result.park.images[0],
                      caption: result.park.name
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
                        caption: activity.images[0].caption || activity.title
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
                        caption: camp.images[0].caption || camp.name
                      });
                    }
                  });
                }
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
      
      // Post-process response to clean up formatting artifacts
      const cleanedResponse = cleanResponseFormatting(rawResponse);
      
      // Log for debugging
      console.log(`[Chat] Raw response length: ${rawResponse.length}, Cleaned: ${cleanedResponse.length}`);
      if (collectedPhotos.length > 0) {
        console.log('[Chat] Collected photos:', collectedPhotos.map(p => ({ keyword: p.keyword, url: p.url.substring(0, 50) + '...' })));
      } else {
        console.log('[Chat] No photos collected from tool results');
      }
      
      // Validate and fix any broken links in the response
      try {
        const validatedResponse = await validateLinksInResponse(cleanedResponse);
        console.log(`[Chat] Returning response with ${collectedPhotos.length} photos`);
        return { 
          response: validatedResponse, 
          photos: collectedPhotos.length > 0 ? collectedPhotos : undefined 
        };
      } catch (linkError) {
        console.warn('[Chat] Link validation failed, returning cleaned response:', linkError);
        return { 
          response: cleanedResponse, 
          photos: collectedPhotos.length > 0 ? collectedPhotos : undefined 
        };
      }
    } catch (error: any) {
      console.error('Claude API error:', error);
      throw new Error(`Chat error: ${error.message}`);
    }
  };
}
