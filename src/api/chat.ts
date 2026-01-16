import Anthropic from '@anthropic-ai/sdk';
import { TravelFacade } from '../domain/facade/TravelFacade.js';
import { GoogleMapsAdapter } from '../providers/GoogleMapsAdapter.js';
import { OpenChargeMapAdapter } from '../providers/OpenChargeMapAdapter.js';
import { validateLinksInResponse } from '../utils/linkValidator.js';
import { findParkCode, getParkByCode } from '../utils/parkCodeLookup.js';
import { getUnsplashAdapter } from '../providers/UnsplashAdapter.js';
import { filterPhotosByConfidence, PhotoReference as FilterablePhoto, PhotoFilterContext } from '../utils/photoFilter.js';

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
  confidence?: number;
  source?: 'nps' | 'unsplash' | 'other';
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
- Use gender-neutral language unless the user specifies their gender in their profile

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
ALWAYS use the get_driving_distance tool to get accurate drive times. NEVER estimate or guess driving times - the tool uses Google Maps API for real-time accurate data. Call this tool for:
- Airport to park/destination distances
- Any road trip segments
- Comparing drive times from different airports
- Hotel/lodging to attraction distances
Include driving time when showing airport-to-park comparisons so users can factor in the drive.

IMPORTANT - ELECTRIC VEHICLE CONSIDERATIONS:
Check the user profile for "Tesla" or "Other EV" to determine charging needs:

**Tesla owners:**
- Use search_ev_charging_stations with tesla_only=true to find Tesla Superchargers
- Tesla Supercharger network is extensive and fast (150-250kW, ~20-30 min for 80%)
- Range: ~250-350 miles per charge depending on model
- Charging stops every 200-250 miles on road trips
- Add 25-30 minutes per charging stop to drive times

**Other EV owners (non-Tesla):**
- Use search_ev_charging_stations to find all DC fast chargers (CCS/CHAdeMO)
- Charging network less reliable - recommend having backup options
- Typical DC fast charge: 50-150kW (~30-45 min for 80%)
- Range varies widely: 150-300 miles depending on vehicle
- Add 35-45 minutes per charging stop to drive times
- Recommend apps like PlugShare or ChargePoint for real-time availability

**For both:**
- Use the search_ev_charging_stations tool for long drives (3+ hours)
- Present charging stations clearly:
  ⚡ Charging Stops Along Route
  ---
  • [Station Name] - [City, State] ([Operator], [Power]kW)
- Factor roughly 1 charging stop per 200-250 miles into trip planning

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

CRITICAL: Always use the ACTUAL airport codes, dates, and locations from the CURRENT query being asked. Dates must be YYYY-MM-DD format.
IMPORTANT: When the user asks about a NEW destination or trip, you MUST generate FRESH booking links with the NEW destination's airport codes and dates. NEVER reuse links from a previous trip discussed in the conversation. Each new trip query requires newly generated links specific to that destination.

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
    let detectedDestination: string | undefined; // Track destination from tool calls
    let originalSearchQuery: string | undefined; // Track original query for confidence scoring
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
- IMPORTANT: "budget" or "budget-conscious" refers to TRAVEL STYLE (affordable, cost-conscious travel) - NOT the "Budget" rental car company. Do not assume a car rental company preference unless they explicitly mention a company name like "I prefer Hertz" or "I like Enterprise"
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
      {
        name: 'search_ev_charging_stations',
        description: 'Search for EV charging stations (including Tesla Superchargers) along a route or near a location. Use this when the user has an EV/Tesla or mentions needing charging stops.',
        input_schema: {
          type: 'object' as const,
          properties: {
            origin_lat: { type: 'number', description: 'Origin latitude' },
            origin_lng: { type: 'number', description: 'Origin longitude' },
            dest_lat: { type: 'number', description: 'Destination latitude' },
            dest_lng: { type: 'number', description: 'Destination longitude' },
            tesla_only: { type: 'boolean', description: 'If true, only return Tesla Superchargers' },
          },
          required: ['origin_lat', 'origin_lng', 'dest_lat', 'dest_lng'],
        },
      },
      {
        name: 'search_hotels',
        description: 'Search for hotels near a location. Returns hotel options with prices, ratings, and amenities.',
        input_schema: {
          type: 'object' as const,
          properties: {
            location: { type: 'string', description: 'City or location to search (e.g., "Yosemite Valley", "Grand Canyon Village")' },
            check_in_date: { type: 'string', description: 'Check-in date YYYY-MM-DD' },
            check_out_date: { type: 'string', description: 'Check-out date YYYY-MM-DD' },
            adults: { type: 'number', description: 'Number of adults (default: 2)' },
            rooms: { type: 'number', description: 'Number of rooms (default: 1)' },
          },
          required: ['location', 'check_in_date', 'check_out_date'],
        },
      },
      {
        name: 'search_car_rentals',
        description: 'Search for rental cars at an airport or location. Returns car options with prices and vehicle details.',
        input_schema: {
          type: 'object' as const,
          properties: {
            pickup_location: { type: 'string', description: 'Airport code or city (e.g., "LAX", "Denver")' },
            pickup_date: { type: 'string', description: 'Pickup date YYYY-MM-DD' },
            dropoff_date: { type: 'string', description: 'Dropoff date YYYY-MM-DD' },
            pickup_time: { type: 'string', description: 'Pickup time HH:MM (default: 10:00)' },
            dropoff_time: { type: 'string', description: 'Dropoff time HH:MM (default: 10:00)' },
          },
          required: ['pickup_location', 'pickup_date', 'dropoff_date'],
        },
      },
      {
        name: 'search_activities',
        description: 'Search for tours, activities, and experiences near a location. Returns bookable activities with prices and descriptions.',
        input_schema: {
          type: 'object' as const,
          properties: {
            location: { type: 'string', description: 'City or destination (e.g., "Grand Canyon", "Yellowstone")' },
            latitude: { type: 'number', description: 'Latitude of the location (optional, improves accuracy)' },
            longitude: { type: 'number', description: 'Longitude of the location (optional, improves accuracy)' },
          },
          required: ['location'],
        },
      },
      {
        name: 'refresh_photos',
        description: 'Get new/different photos for a destination, event, or activity. Use this when the user asks for photos of specific events (wildflowers, wildlife, sunsets, waterfalls, fall colors), activities (hiking, camping, stargazing), or wants different background images for their trip.',
        input_schema: {
          type: 'object' as const,
          properties: {
            destination: { type: 'string', description: 'The destination or location (e.g., "Yosemite National Park", "Grand Canyon", "Yellowstone")' },
            event: { type: 'string', description: 'Specific event or phenomenon to photograph (e.g., "Old Faithful eruption", "wildflower bloom", "fall foliage", "elk rut", "sunset", "northern lights", "waterfall")' },
            style: { type: 'string', description: 'Photo style: "landscape", "wildlife", "hiking", "camping", "scenic", "adventure", "aerial", "night sky"' },
            count: { type: 'number', description: 'Number of photos to return (default: 8, max: 12)' },
          },
          required: ['destination'],
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
                const rawQuery = (toolUse.input as any).query.toLowerCase();
                
                // Try to find park code from our lookup table first
                const knownParkCode = findParkCode(rawQuery);
                let parks;
                let searchQuery: string;
                
                if (knownParkCode) {
                  // Use park code for reliable direct lookup
                  console.log(`[Chat] NPS search: "${rawQuery}" -> found park code "${knownParkCode}"`);
                  const parkDetails = await facade.getParkDetails(knownParkCode);
                  parks = parkDetails ? [parkDetails.park] : await facade.searchNationalParks(knownParkCode);
                  searchQuery = knownParkCode;
                } else {
                  // Fall back to keyword search
                  searchQuery = rawQuery
                    .replace(/national park/gi, '')
                    .replace(/national/gi, '')
                    .replace(/park/gi, '')
                    .trim();
                  console.log(`[Chat] NPS search: "${rawQuery}" -> keyword search "${searchQuery}"`);
                  parks = await facade.searchNationalParks(searchQuery);
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
                  
                  // Strip common suffixes from park name
                  const coreName = parkNameLower
                    .replace(/ national park$/i, '')
                    .replace(/ national historical park$/i, '')
                    .replace(/ national historic site$/i, '')
                    .replace(/ national monument$/i, '')
                    .replace(/ national recreation area$/i, '')
                    .trim();
                  
                  // Direct matches - any of these should pass
                  if (parkCodeLower === cleanQuery) return true;
                  if (coreName === cleanQuery) return true;
                  if (cleanQuery.length >= 3 && coreName.includes(cleanQuery)) return true;
                  if (coreName.length >= 3 && cleanQuery.includes(coreName)) return true;
                  if (cleanQuery.length >= 3 && parkNameLower.includes(cleanQuery)) return true;
                  
                  // Word-based matching for multi-word queries
                  const searchWords = cleanQuery.split(/\s+/).filter((w: string) => w.length >= 3);
                  if (searchWords.length > 0) {
                    const hasMatch = searchWords.some((sw: string) => 
                      coreName.includes(sw) || parkNameLower.includes(sw)
                    );
                    if (hasMatch) return true;
                  }
                  
                  return false;
                });
                
                console.log(`[Chat] Park filter: query="${searchQuery}" -> clean="${cleanQuery}", found=${parks.length}, relevant=${relevantParks.map(p => p.parkCode).join(', ') || 'none'}`);
                
                // CRITICAL FIX: Only use parks that actually match the query
                // Do NOT fall back to first alphabetical park - that causes wrong photos
                const parksForPhotos = relevantParks.slice(0, 2);
                
                // Track destination and query for confidence scoring
                originalSearchQuery = cleanQuery; // Always store the original query
                
                // Photo targets: 24 total (6 rows of 4)
                // - 16 NPS park photos (4 rows)
                // - 8 activity/event photos from Unsplash (2 rows)
                const TARGET_NPS_PHOTOS = 16;
                const TARGET_EVENT_PHOTOS = 8;
                const TARGET_TOTAL_PHOTOS = 24;
                
                if (parksForPhotos.length > 0) {
                  // We have matching NPS parks - collect their photos
                  detectedDestination = parksForPhotos[0].name;
                  const parkName = parksForPhotos[0].name.replace(' National Park', '').replace(' National', '');
                  const parkCode = parksForPhotos[0].parkCode;
                  
                  // STEP 1: Collect NPS park photos (up to 16)
                  parksForPhotos.forEach(park => {
                    if (park.images && park.images.length > 0 && collectedPhotos.length < TARGET_NPS_PHOTOS) {
                      const isSmokies = park.parkCode === 'grsm' || park.name.toLowerCase().includes('smoky');
                      
                      if (isSmokies) {
                        const smokiesPhotos = [
                          'https://www.nps.gov/common/uploads/structured_data/3C80E3F4-1DD8-B71B-0BFF4F2280EF1B52.jpg',
                          'https://www.nps.gov/common/uploads/structured_data/3C80E4A2-1DD8-B71B-0B92311ED9BAC3D0.jpg',
                        ];
                        smokiesPhotos.forEach((url, idx) => {
                          if (collectedPhotos.length < TARGET_NPS_PHOTOS) {
                            collectedPhotos.push({
                              keyword: idx === 0 ? park.name : `${park.name} photo ${idx + 1}`,
                              url: url,
                              caption: `${park.name} - National Park`,
                              source: 'nps'
                            });
                          }
                        });
                      } else {
                        const npsPhotos = park.images.slice(0, TARGET_NPS_PHOTOS - collectedPhotos.length);
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
                  
                  console.log(`[Chat] Park search: collected ${collectedPhotos.length} NPS photos from ${parksForPhotos.map(p => p.parkCode).join(', ')}`);
                  
                  // STEP 2: Supplement NPS photos with generic Unsplash if needed
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
                  
                  // STEP 3: Fetch activities/events and get matching Unsplash photos (8 photos)
                  if (unsplash.isConfigured()) {
                    try {
                      // Get things to do / activities from NPS API
                      const activities = await facade.getParkActivities(parkCode);
                      const hikes = facade.getParkHikes(parkCode);
                      
                      // Build list of interesting features to search for
                      const features: string[] = [];
                      
                      // Add activity titles (hiking, wildlife viewing, etc.)
                      activities.slice(0, 5).forEach((activity: any) => {
                        if (activity.title) {
                          features.push(activity.title);
                        }
                      });
                      
                      // Add hike names as features
                      hikes.slice(0, 3).forEach(hike => {
                        features.push(hike.name);
                      });
                      
                      // Add park-specific features based on common attractions (all 63 national parks)
                      const parkFeatures: Record<string, string[]> = {
                        'acad': ['Cadillac Mountain sunrise', 'rocky coastline', 'Bass Harbor lighthouse'],
                        'arch': ['Delicate Arch', 'Landscape Arch', 'Fiery Furnace'],
                        'badl': ['badlands formations', 'prairie wildlife', 'night sky stars'],
                        'bibe': ['Chisos Mountains', 'Rio Grande river', 'desert wildlife'],
                        'bisc': ['coral reef snorkeling', 'mangroves', 'island kayaking'],
                        'blca': ['canyon overlook', 'Painted Wall', 'Gunnison River'],
                        'brca': ['Bryce Canyon hoodoos', 'Thor\'s Hammer', 'Navajo Loop Trail'],
                        'cany': ['Island in the Sky', 'Mesa Arch sunrise', 'Needles District'],
                        'care': ['Waterpocket Fold', 'Capitol Dome', 'petroglyphs'],
                        'cave': ['Carlsbad Caverns underground', 'bat flight', 'cave formations'],
                        'chis': ['island wildlife', 'sea caves kayaking', 'whale watching'],
                        'cong': ['cypress swamp', 'boardwalk trail', 'fireflies'],
                        'crla': ['Crater Lake blue water', 'Wizard Island', 'Rim Drive'],
                        'cuva': ['Brandywine Falls', 'covered bridges', 'fall foliage'],
                        'dena': ['Denali mountain peak', 'grizzly bears', 'northern lights'],
                        'deva': ['Death Valley sand dunes', 'Badwater Basin salt flats', 'Artists Palette'],
                        'drto': ['Fort Jefferson', 'snorkeling coral', 'sea turtles'],
                        'ever': ['alligators wildlife', 'mangrove kayaking', 'bird watching'],
                        'gaar': ['arctic wilderness', 'caribou migration', 'midnight sun'],
                        'jeff': ['Gateway Arch', 'St Louis skyline', 'riverfront'],
                        'glac': ['Going to the Sun Road', 'mountain goats', 'alpine lakes'],
                        'glba': ['tidewater glaciers', 'whale watching', 'kayaking'],
                        'grba': ['Lehman Caves', 'bristlecone pines', 'Wheeler Peak'],
                        'grca': ['Colorado River rafting', 'South Rim viewpoint', 'Bright Angel Trail'],
                        'grsa': ['sand dunes sunset', 'Medano Creek', 'alpine lakes'],
                        'grsm': ['Cades Cove wildlife', 'Appalachian Trail', 'mountain streams'],
                        'grte': ['Teton Range reflection', 'Jenny Lake', 'moose wildlife'],
                        'gumo': ['El Capitan peak', 'McKittrick Canyon fall colors', 'desert trails'],
                        'hale': ['Haleakala sunrise', 'volcanic crater', 'silversword plants'],
                        'havo': ['Kilauea volcano', 'lava flows', 'volcanic crater'],
                        'hosp': ['historic bathhouses', 'hot springs', 'Bathhouse Row'],
                        'indu': ['Lake Michigan beach', 'sand dunes', 'Chicago skyline'],
                        'isro': ['island wilderness', 'moose', 'lighthouse'],
                        'jotr': ['Joshua trees desert', 'rock climbing boulders', 'Cholla Cactus Garden', 'Keys View sunset'],
                        'katm': ['brown bears fishing', 'Brooks Falls', 'Valley of Ten Thousand Smokes'],
                        'kefj': ['Exit Glacier', 'fjords boat tour', 'sea lions'],
                        'kova': ['Kobuk sand dunes', 'caribou', 'arctic wilderness'],
                        'lacl': ['volcanic landscape', 'brown bears', 'remote wilderness'],
                        'lavo': ['Bumpass Hell', 'volcanic features', 'Lassen Peak'],
                        'maca': ['Mammoth Cave underground', 'cave formations', 'Green River'],
                        'meve': ['cliff dwellings', 'Cliff Palace', 'ancient pueblos'],
                        'mora': ['Mount Rainier peak', 'wildflower meadows', 'Paradise'],
                        'neri': ['New River Gorge Bridge', 'whitewater rafting', 'rock climbing'],
                        'noca': ['North Cascades mountains', 'Diablo Lake', 'glaciers'],
                        'olym': ['Hoh Rainforest', 'Hurricane Ridge', 'tide pools'],
                        'pefo': ['petrified wood', 'Painted Desert', 'ancient fossils'],
                        'pinn': ['rock spires', 'California condors', 'talus caves'],
                        'redw': ['giant redwood trees', 'Fern Canyon', 'foggy forest'],
                        'romo': ['elk wildlife', 'alpine tundra', 'Trail Ridge Road'],
                        'sagu': ['saguaro cactus forest', 'desert sunset', 'Sonoran Desert'],
                        'seki': ['Giant Sequoia trees', 'Moro Rock', 'Crystal Cave'],
                        'shen': ['Skyline Drive', 'Blue Ridge Mountains', 'fall foliage'],
                        'thro': ['badlands formations', 'wild horses', 'prairie'],
                        'viis': ['tropical beaches', 'snorkeling coral reef', 'Trunk Bay'],
                        'voya': ['lakes canoeing', 'northern lights', 'houseboating'],
                        'whsa': ['white sand dunes', 'gypsum desert', 'sunset'],
                        'wica': ['Wind Cave underground', 'boxwork formations', 'bison prairie'],
                        'wrst': ['massive glaciers', 'mountain wilderness', 'Kennecott mines'],
                        'yell': ['Old Faithful geyser', 'Yellowstone bison wildlife', 'Grand Prismatic Spring'],
                        'yose': ['Half Dome', 'Yosemite Falls', 'El Capitan climbing'],
                        'zion': ['Angels Landing', 'The Narrows hiking', 'Zion Canyon'],
                      };
                      
                      if (parkFeatures[parkCode]) {
                        features.push(...parkFeatures[parkCode]);
                      }
                      
                      // Dedupe and limit features
                      const uniqueFeatures = [...new Set(features)].slice(0, 8);
                      
                      console.log(`[Chat] Fetching event/activity photos for: ${uniqueFeatures.join(', ')}`);
                      
                      // Fetch Unsplash photos for each feature
                      for (const feature of uniqueFeatures) {
                        if (collectedPhotos.length >= TARGET_TOTAL_PHOTOS) break;
                        
                        const searchQuery = `${parkName} ${feature}`;
                        const photos = await unsplash.searchPhotos(searchQuery, 1);
                        
                        if (photos.length > 0) {
                          const photo = photos[0];
                          // Check we don't already have this URL
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
                } else {
                  // NO NPS MATCH - Fall back to Unsplash with the original search query
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
                    console.log(`[Chat] Added ${unsplashPhotos.length} Unsplash fallback photos`);
                  } else {
                    console.log(`[Chat] Unsplash not configured, no photos available for "${cleanQuery}"`);
                  }
                }
                
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
                
                // Collect photos from park
                if (result.park?.images && result.park.images.length > 0) {
                  // Great Smoky Mountains - use known good NPS photo URLs
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
                  // Add shorter keyword variation for first image
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

              case 'search_ev_charging_stations':
                const evAdapter = new OpenChargeMapAdapter();
                const evInput = toolUse.input as any;
                const chargingStations = await evAdapter.searchAlongRoute(
                  evInput.origin_lat,
                  evInput.origin_lng,
                  evInput.dest_lat,
                  evInput.dest_lng,
                  25, // corridor width in miles
                  10  // max results
                );
                result = {
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
                break;

              case 'search_hotels':
                const hotelInput = toolUse.input as any;
                const hotelResults = await facade.searchHotels({
                  location: hotelInput.location,
                  checkInDate: hotelInput.check_in_date,
                  checkOutDate: hotelInput.check_out_date,
                  adults: hotelInput.adults || 2,
                  rooms: hotelInput.rooms || 1,
                });
                result = {
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
                break;

              case 'search_car_rentals':
                const carInput = toolUse.input as any;
                const carResults = await facade.searchCarRentals({
                  pickupLocation: carInput.pickup_location,
                  pickupDate: carInput.pickup_date,
                  dropoffDate: carInput.dropoff_date,
                  pickupTime: carInput.pickup_time || '10:00',
                  dropoffTime: carInput.dropoff_time || '10:00',
                });
                result = {
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
                break;

              case 'search_activities':
                const activityInput = toolUse.input as any;
                const activityResults = await facade.searchActivities({
                  location: activityInput.location,
                  radius: 50, // 50km radius
                });
                result = {
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
                break;

              case 'refresh_photos':
                const photoInput = toolUse.input as any;
                const destination = photoInput.destination;
                const event = photoInput.event || '';
                const style = photoInput.style || '';
                const photoCount = Math.min(photoInput.count || 8, 12);
                
                const unsplashAdapter = getUnsplashAdapter();
                if (!unsplashAdapter.isConfigured()) {
                  result = { error: 'Photo service not available' };
                  break;
                }
                
                // Build search query prioritizing event, then style, then generic
                let photoSearchQuery: string;
                let photoCaption: string;
                
                if (event) {
                  // Event-specific search (e.g., "Yellowstone Old Faithful eruption")
                  photoSearchQuery = `${destination} ${event}`;
                  photoCaption = `${event} at ${destination}`;
                } else if (style) {
                  // Style-specific search (e.g., "Yosemite wildlife")
                  photoSearchQuery = `${destination} ${style} nature`;
                  photoCaption = `${destination} - ${style}`;
                } else {
                  // Generic scenic search
                  photoSearchQuery = `${destination} landscape nature scenic`;
                  photoCaption = destination;
                }
                
                console.log(`[Chat] Refreshing photos for "${destination}" with query: "${photoSearchQuery}"`);
                const freshPhotos = await unsplashAdapter.searchPhotos(photoSearchQuery, photoCount);
                
                // Add photos to collected photos for response
                freshPhotos.forEach(photo => {
                  collectedPhotos.push({
                    keyword: event || destination,
                    url: photo.url,
                    caption: photo.caption || photoCaption,
                    source: 'unsplash'
                  });
                });
                
                result = {
                  message: event 
                    ? `Found ${freshPhotos.length} photos of ${event} at ${destination}`
                    : `Found ${freshPhotos.length} new photos for ${destination}`,
                  photoCount: freshPhotos.length,
                  destination: destination,
                  event: event || null,
                  style: style || 'general',
                };
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
      
      // Build context for confidence scoring
      const conversationText = messages.map(m => m.content).join(' ') + ' ' + cleanedResponse;
      const tripDestination = detectedDestination || context.tripContext?.destination;
      const searchQuery = originalSearchQuery || tripDestination?.toLowerCase().replace(/national park/gi, '').trim() || '';
      
      console.log(`[Chat] Photo filtering with query: "${searchQuery}", destination: "${tripDestination || 'none'}"`);
      console.log(`[Chat] Raw response length: ${rawResponse.length}, Cleaned: ${cleanedResponse.length}`);
      
      // IMPROVED FILTERING STRATEGY:
      // - NPS photos: validate park name appears in keyword/caption/URL
      // - Unsplash photos: apply confidence scoring
      const npsPhotos = collectedPhotos.filter(p => p.source === 'nps');
      const unsplashPhotos = collectedPhotos.filter(p => p.source === 'unsplash');
      
      // Validate NPS photos by string matching on park name
      // Require ALL destination words to match (e.g., "joshua" AND "tree")
      const cleanDestWords = (tripDestination || searchQuery || '')
        .toLowerCase()
        .replace(/national park/gi, '')
        .replace(/national/gi, '')
        .split(/\s+/)
        .filter((w: string) => w.length >= 3);
      
      const validatedNpsPhotos = npsPhotos.filter(photo => {
        const keyword = photo.keyword.toLowerCase();
        const caption = (photo.caption || '').toLowerCase();
        const url = photo.url.toLowerCase();
        const combined = `${keyword} ${caption} ${url}`;
        
        // Require ALL destination words to appear (not just any one)
        const allWordsMatch = cleanDestWords.length > 0 && 
          cleanDestWords.every((word: string) => combined.includes(word));
        
        // Also accept if URL is from nps.gov (official source, trusted)
        const isOfficialNps = url.includes('nps.gov');
        
        return allWordsMatch || isOfficialNps;
      });
      
      console.log(`[Chat] NPS validation: kept ${validatedNpsPhotos.length} of ${npsPhotos.length} (all words: "${cleanDestWords.join(' + ')}")`);
      
      let filteredPhotos = [...validatedNpsPhotos];
      
      // Only filter Unsplash photos if we have a search query
      if (unsplashPhotos.length > 0 && searchQuery) {
        const filterContext: PhotoFilterContext = {
          searchQuery: searchQuery,
          destination: tripDestination,
          conversationText: conversationText
        };
        const filteredUnsplash = filterPhotosByConfidence(unsplashPhotos, filterContext, 50);
        filteredPhotos.push(...filteredUnsplash);
        console.log(`[Chat] Unsplash: kept ${filteredUnsplash.length} of ${unsplashPhotos.length} photos`);
      } else {
        filteredPhotos.push(...unsplashPhotos);
      }
      
      console.log(`[Chat] Final: ${npsPhotos.length} NPS + ${filteredPhotos.length - npsPhotos.length} Unsplash = ${filteredPhotos.length} photos`);
      
      if (collectedPhotos.length === 0) {
        console.log('[Chat] No photos collected from tool results');
      }
      
      // Validate and fix any broken links in the response
      try {
        const validatedResponse = await validateLinksInResponse(cleanedResponse);
        console.log(`[Chat] Returning response with ${filteredPhotos.length} photos`);
        return { 
          response: validatedResponse, 
          photos: filteredPhotos.length > 0 ? filteredPhotos : undefined 
        };
      } catch (linkError) {
        console.warn('[Chat] Link validation failed, returning cleaned response:', linkError);
        return { 
          response: cleanedResponse, 
          photos: filteredPhotos.length > 0 ? filteredPhotos : undefined 
        };
      }
    } catch (error: any) {
      console.error('Claude API error:', error);
      throw new Error(`Chat error: ${error.message}`);
    }
  };
}
