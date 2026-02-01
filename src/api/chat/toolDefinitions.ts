/**
 * Claude tool definitions for TripAgent
 * 
 * Park codes sourced from NPS API (https://developer.nps.gov/api/v1/parks)
 */
import Anthropic from '@anthropic-ai/sdk';
import { NATIONAL_PARKS } from '../../utils/parkCodeLookup.js';

// Build park code reference for tool descriptions
const PARK_CODE_EXAMPLES = Object.values(NATIONAL_PARKS)
  .slice(0, 10)
  .map((p: { code: string; name: string }) => `"${p.code}" (${p.name.replace(' National Park', '').replace(' National Park & Preserve', '')})`)
  .join(', ');

const ALL_PARK_CODES = Object.values(NATIONAL_PARKS)
  .map((p: { code: string }) => p.code)
  .join(', ');

export const tools: Anthropic.Tool[] = [
  {
    name: 'search_national_parks',
    description: 'Search for US National Parks by name. Returns park info, entrance fees, and activities. Valid park codes: ' + ALL_PARK_CODES,
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Park name to search (e.g., "Yosemite", "Yellowstone", "Grand Canyon")' },
      },
      required: ['query'],
    },
  },
  {
    name: 'plan_park_trip',
    description: `Get a complete trip plan for a National Park including flights, lodging, hikes, and budget tips. Use official NPS park codes: ${PARK_CODE_EXAMPLES}, etc.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        park_code: { type: 'string', description: `NPS park code. Examples: ${PARK_CODE_EXAMPLES}. Full list: ${ALL_PARK_CODES}` },
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
    description: `Get popular hiking trails for a National Park with difficulty, distance, and highlights. Use official NPS park codes: ${ALL_PARK_CODES}`,
    input_schema: {
      type: 'object' as const,
      properties: {
        park_code: { type: 'string', description: `NPS park code. Examples: ${PARK_CODE_EXAMPLES}` },
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
    description: `Search for tours, activities, and experiences near a National Park or destination. Returns bookable activities with prices and descriptions. Use official park names from NPS.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        location: { type: 'string', description: 'National Park or destination (e.g., "Grand Canyon National Park", "Yellowstone National Park", "Yosemite Valley")' },
        latitude: { type: 'number', description: 'Latitude of the location (optional, improves accuracy)' },
        longitude: { type: 'number', description: 'Longitude of the location (optional, improves accuracy)' },
      },
      required: ['location'],
    },
  },
  // DISABLED: Unsplash tool removed due to unreliable links
  // {
  //   name: 'refresh_photos',
  //   description: `Get new/different photos for a National Park...`,
  //   ...
  // },
  {
    name: 'search_restaurants',
    description: `Search for restaurants near a National Park or destination. Use this when users ask about dining options, places to eat, or food recommendations. Use official NPS park names or nearby town names.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        location: { type: 'string', description: 'Location to search near - use park gateway towns (e.g., "Yosemite Valley, CA", "Grand Canyon Village, AZ", "West Yellowstone, MT", "Springdale, UT" for Zion)' },
        cuisine: { type: 'string', description: 'Type of cuisine (e.g., "Mexican", "Italian", "BBQ", "breakfast", "steakhouse"). Leave empty for all types.' },
        price_level: { type: 'number', description: 'Maximum price level 1-4 (1=cheap, 4=expensive). Leave empty for all price ranges.' },
        radius: { type: 'number', description: 'Search radius in meters (default: 5000, max: 50000)' },
      },
      required: ['location'],
    },
  },
  {
    name: 'get_reservation_link',
    description: 'Generate a reservation link for a specific restaurant. The system will automatically use the correct location from the restaurant search results - just provide the restaurant name. Do NOT provide city/state from the user\'s home location.',
    input_schema: {
      type: 'object' as const,
      properties: {
        restaurant_name: { type: 'string', description: 'Exact name of the restaurant from search results' },
        date: { type: 'string', description: 'Reservation date in YYYY-MM-DD format' },
        time: { type: 'string', description: 'Reservation time in HH:MM format (24-hour, e.g., "19:00" for 7pm)' },
        party_size: { type: 'number', description: 'Number of guests (default: 2)' },
      },
      required: ['restaurant_name'],
    },
  },
  {
    name: 'get_wildlife',
    description: `Get wildlife information for a park (National or State Park). Returns common species (mammals, birds, reptiles) observed in the park with photos. Data from iNaturalist research-grade observations. For National Parks, use official NPS park codes: ${ALL_PARK_CODES}. For State Parks, use the full park name (e.g., "Annadel State Park").`,
    input_schema: {
      type: 'object' as const,
      properties: {
        park_code: { type: 'string', description: `For National Parks: NPS park code (e.g., ${PARK_CODE_EXAMPLES}). For State Parks: full park name (e.g., "Big Basin Redwoods State Park", "Annadel State Park").` },
        category: { type: 'string', description: 'Filter by category: "mammals", "birds", "reptiles", "amphibians", "fish", "insects", "plants", "fungi". Leave empty for top species across all categories.' },
      },
      required: ['park_code'],
    },
  },
  {
    name: 'get_campgrounds',
    description: `Get campground and camping facility information for a National Park from Recreation.gov. Returns reservable campgrounds with descriptions and reservation links. Use official NPS park codes: ${ALL_PARK_CODES}`,
    input_schema: {
      type: 'object' as const,
      properties: {
        park_code: { type: 'string', description: `NPS park code. Examples: ${PARK_CODE_EXAMPLES}` },
      },
      required: ['park_code'],
    },
  },
  // ============================================
  // STATE PARKS TOOLS (use when parkMode is 'state')
  // ============================================
  {
    name: 'search_state_parks',
    description: 'Search for state parks in a specific US state. Returns park names, acreage, and designation type. REQUIRES a state code - always ask user which state they want to explore. Use 2-letter state codes (CA, TX, NY, etc).',
    input_schema: {
      type: 'object' as const,
      properties: {
        state: { type: 'string', description: 'Required 2-letter US state code (e.g., "CA", "TX", "NY", "CO")' },
        query: { type: 'string', description: 'Optional search term to filter parks by name (e.g., "beach", "mountain", "forest")' },
      },
      required: ['state'],
    },
  },
  {
    name: 'get_state_park_details',
    description: 'Get detailed information about a specific state park including campground availability. Use this after search_state_parks to get details for a specific park the user is interested in.',
    input_schema: {
      type: 'object' as const,
      properties: {
        park_name: { type: 'string', description: 'Name of the state park (e.g., "Big Basin Redwoods State Park")' },
        state: { type: 'string', description: '2-letter US state code where the park is located (e.g., "CA")' },
      },
      required: ['park_name', 'state'],
    },
  },
  {
    name: 'get_state_park_campgrounds',
    description: 'Get campground information for a specific state park. Returns aggregated campground data from Recreation.gov, OpenStreetMap, and NPS sources with photos, amenities, and reservation links.',
    input_schema: {
      type: 'object' as const,
      properties: {
        park_name: { type: 'string', description: 'Name of the state park' },
        state: { type: 'string', description: '2-letter US state code (e.g., "CA")' },
      },
      required: ['park_name', 'state'],
    },
  },
  {
    name: 'get_state_park_hikes',
    description: 'Get hiking trail information for a state park. Returns AllTrails search links and trail recommendations. Use this when users ask about hiking, trails, or outdoor activities at a state park.',
    input_schema: {
      type: 'object' as const,
      properties: {
        park_name: { type: 'string', description: 'Name of the state park (e.g., "Annadel State Park", "Big Basin Redwoods State Park")' },
        state: { type: 'string', description: '2-letter US state code (e.g., "CA")' },
      },
      required: ['park_name', 'state'],
    },
  },
];
