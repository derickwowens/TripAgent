#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { config } from 'dotenv';
import { TravelFacade } from '../domain/facade/TravelFacade.js';
import { AmadeusFlightAdapter } from '../providers/flights/AmadeusFlightAdapter.js';
import { KiwiFlightAdapter } from '../providers/flights/KiwiFlightAdapter.js';
import { AmadeusHotelAdapter } from '../providers/hotels/AmadeusHotelAdapter.js';
import { AmadeusCarAdapter } from '../providers/cars/AmadeusCarAdapter.js';
import { AmadeusActivitiesAdapter } from '../providers/activities/AmadeusActivitiesAdapter.js';
import { NationalParksAdapter } from '../providers/parks/NationalParksAdapter.js';
import { tools, executeTool } from './tools/index.js';

// Load environment variables
config();

// Initialize providers
const flightProviders = [
  new AmadeusFlightAdapter(
    process.env.AMADEUS_CLIENT_ID,
    process.env.AMADEUS_CLIENT_SECRET
  ),
  new KiwiFlightAdapter(process.env.KIWI_API_KEY),
];

const hotelProviders = [
  new AmadeusHotelAdapter(
    process.env.AMADEUS_CLIENT_ID,
    process.env.AMADEUS_CLIENT_SECRET
  ),
];

const carProviders = [
  new AmadeusCarAdapter(
    process.env.AMADEUS_CLIENT_ID,
    process.env.AMADEUS_CLIENT_SECRET
  ),
];

const activityProviders = [
  new AmadeusActivitiesAdapter(
    process.env.AMADEUS_CLIENT_ID,
    process.env.AMADEUS_CLIENT_SECRET
  ),
];

// National Parks adapter (optional - works without API key for hikes)
const parksAdapter = new NationalParksAdapter(process.env.NPS_API_KEY);

// Initialize facade
const facade = new TravelFacade(
  flightProviders,
  hotelProviders,
  carProviders,
  activityProviders,
  parksAdapter
);

// Create MCP server
const server = new Server(
  {
    name: 'travel-buddy',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request: { params: { name: string; arguments?: Record<string, any> } }) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await executeTool(facade, name, args || {});

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr so it doesn't interfere with stdio protocol
  console.error('🌍 Travel Buddy MCP Server running on stdio');
  console.error('Available tools: search_flights, search_hotels, search_car_rentals, search_activities, search_national_parks, plan_park_trip, get_airport_info');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
