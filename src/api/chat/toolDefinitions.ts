/**
 * Claude tool definitions for TripAgent
 */
import Anthropic from '@anthropic-ai/sdk';

export const tools: Anthropic.Tool[] = [
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
