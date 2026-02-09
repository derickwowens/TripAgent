import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { TravelFacade } from '../domain/facade/TravelFacade.js';
import { AmadeusFlightAdapter } from '../providers/flights/AmadeusFlightAdapter.js';
import { KiwiFlightAdapter } from '../providers/flights/KiwiFlightAdapter.js';
import { AmadeusHotelAdapter } from '../providers/hotels/AmadeusHotelAdapter.js';
import { AmadeusCarAdapter } from '../providers/cars/AmadeusCarAdapter.js';
import { AmadeusActivitiesAdapter } from '../providers/activities/AmadeusActivitiesAdapter.js';
import { NationalParksAdapter } from '../providers/parks/NationalParksAdapter.js';
import { StateParkService } from '../providers/parks/StateParkService.js';
import { parkData, pgParkData } from '../providers/parks/parkDataProvider.js';
import { RecreationGovAdapter } from '../providers/recreation/RecreationGovAdapter.js';
import { INaturalistAdapter } from '../providers/wildlife/INaturalistAdapter.js';
import { createChatHandler, TOOL_DISPLAY_NAMES } from './chat.js';
import { logError } from './errorLogger.js';
import { storeItinerary, getItinerary } from './itineraryHost.js';
import { randomUUID } from 'crypto';

// In-memory store for active chat request statuses (for polling)
const activeRequestStatuses = new Map<string, { status: string; toolName?: string; timestamp: number }>();

// Clean up old statuses after 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [requestId, data] of activeRequestStatuses.entries()) {
    if (now - data.timestamp > 5 * 60 * 1000) {
      activeRequestStatuses.delete(requestId);
    }
  }
}, 60000);

// Load environment variables
config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (privacy policy)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/public', express.static(path.join(__dirname, '../../public')));

// Initialize facade with all providers
const facade = new TravelFacade(
  [new AmadeusFlightAdapter(), new KiwiFlightAdapter()],
  [new AmadeusHotelAdapter()],
  [new AmadeusCarAdapter()],
  [new AmadeusActivitiesAdapter()],
  new NationalParksAdapter(process.env.NPS_API_KEY),
  new RecreationGovAdapter(process.env.RECREATION_GOV_API_KEY),
  new INaturalistAdapter()
);

// Initialize State Park Service (aggregates PAD-US, Recreation.gov, OSM, NPS)
const stateParkService = new StateParkService(
  process.env.RECREATION_GOV_API_KEY,
  process.env.NPS_API_KEY
);

// Error handling middleware
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'tripagent-api', timestamp: new Date().toISOString() });
});

// ============================================
// ERROR LOGGING ENDPOINT
// ============================================
app.post('/api/log-error', asyncHandler(async (req: Request, res: Response) => {
  const { message, stack, endpoint, context } = req.body;
  
  await logError({
    message: message || 'Unknown error',
    stack,
    endpoint,
    userAgent: req.headers['user-agent'],
    timestamp: new Date().toISOString(),
    context,
  });
  
  res.json({ logged: true });
}));

// ============================================
// ITINERARY HOSTING ENDPOINTS
// ============================================
app.post('/api/itinerary/create', asyncHandler(async (req: Request, res: Response) => {
  const { content, destination, photos, links } = req.body;
  
  if (!content) {
    return res.status(400).json({ error: 'Missing required parameter: content' });
  }
  
  const id = storeItinerary(content, destination, photos, links);
  const baseUrl = process.env.API_URL || `https://travel-buddy-api-production.up.railway.app`;
  const url = `${baseUrl}/itinerary/${id}`;
  
  res.json({ id, url });
}));

app.get('/itinerary/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const itinerary = getItinerary(id);
  
  if (!itinerary) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Itinerary Not Found</title>
        <style>
          body { font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #1a1a2e; color: white; }
          .container { text-align: center; padding: 40px; }
          h1 { color: #166534; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Itinerary Not Found</h1>
          <p>This itinerary may have expired or the link is invalid.</p>
          <p style="margin-top: 20px; opacity: 0.7;">Itineraries are available for 7 days after creation.</p>
        </div>
      </body>
      </html>
    `);
  }
  
  res.setHeader('Content-Type', 'text/html');
  res.send(itinerary.html);
}));

// ============================================
// PARK DATABASE ENDPOINTS (S3)
// ============================================
app.get('/api/parks/stats', asyncHandler(async (req: Request, res: Response) => {
  const stats = await parkData.getStats();
  if (!stats) {
    return res.status(503).json({ error: 'Park database unavailable' });
  }
  res.json(stats);
}));

app.get('/api/parks/search', asyncHandler(async (req: Request, res: Response) => {
  const { query, category, state, limit = '10' } = req.query;
  
  if (!query) {
    return res.status(400).json({ error: 'Missing required parameter: query' });
  }
  
  const results = await parkData.searchParks(query as string, {
    category: category as 'national' | 'state' | 'all',
    stateCode: state as string,
    limit: parseInt(limit as string),
  });
  
  res.json({ parks: results, totalResults: results.length });
}));

app.get('/api/parks/nearby', asyncHandler(async (req: Request, res: Response) => {
  const { latitude, longitude, radius = '50', category, limit = '10' } = req.query;
  
  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'Missing required parameters: latitude, longitude' });
  }
  
  const parks = await parkData.getParksNearLocation(
    parseFloat(latitude as string),
    parseFloat(longitude as string),
    parseFloat(radius as string),
    {
      category: category as 'national' | 'state' | 'all',
      limit: parseInt(limit as string),
    }
  );
  
  res.json({ parks, totalFound: parks.length });
}));

app.get('/api/parks/:parkId', asyncHandler(async (req: Request, res: Response) => {
  const { parkId } = req.params;
  
  const park = await parkData.getParkById(parkId);
  if (!park) {
    return res.status(404).json({ error: `Park not found: ${parkId}` });
  }
  
  res.json(park);
}));

app.get('/api/parks/state/:stateCode', asyncHandler(async (req: Request, res: Response) => {
  const { stateCode } = req.params;
  
  const parks = await parkData.getParksInState(stateCode);
  res.json({
    stateCode: stateCode.toUpperCase(),
    national: parks.national,
    state: parks.state,
    totalParks: parks.national.length + parks.state.length,
  });
}));

// ============================================
// FLIGHT ENDPOINTS
// ============================================
app.get('/api/flights/search', asyncHandler(async (req: Request, res: Response) => {
  const { origin, destination, departureDate, returnDate, adults = '1', cabinClass, maxPrice } = req.query;

  if (!origin || !destination || !departureDate) {
    return res.status(400).json({ error: 'Missing required parameters: origin, destination, departureDate' });
  }

  const results = await facade.searchFlights({
    origin: origin as string,
    destination: destination as string,
    departureDate: departureDate as string,
    returnDate: returnDate as string | undefined,
    adults: parseInt(adults as string),
    cabinClass: cabinClass as any,
    maxPrice: maxPrice ? parseInt(maxPrice as string) : undefined,
  });

  res.json(results);
}));

// ============================================
// HOTEL ENDPOINTS
// ============================================
app.get('/api/hotels/search', asyncHandler(async (req: Request, res: Response) => {
  const { location, checkInDate, checkOutDate, adults = '1', rooms = '1' } = req.query;

  if (!location || !checkInDate || !checkOutDate) {
    return res.status(400).json({ error: 'Missing required parameters: location, checkInDate, checkOutDate' });
  }

  const results = await facade.searchHotels({
    location: location as string,
    checkInDate: checkInDate as string,
    checkOutDate: checkOutDate as string,
    adults: parseInt(adults as string),
    rooms: parseInt(rooms as string),
  });

  res.json(results);
}));

// ============================================
// CAR RENTAL ENDPOINTS
// ============================================
app.get('/api/cars/search', asyncHandler(async (req: Request, res: Response) => {
  const { pickupLocation, pickupDate, dropoffDate, dropoffLocation } = req.query;

  if (!pickupLocation || !pickupDate || !dropoffDate) {
    return res.status(400).json({ error: 'Missing required parameters: pickupLocation, pickupDate, dropoffDate' });
  }

  const results = await facade.searchCarRentals({
    pickupLocation: pickupLocation as string,
    dropoffLocation: (dropoffLocation || pickupLocation) as string,
    pickupDate: pickupDate as string,
    dropoffDate: dropoffDate as string,
  });

  res.json(results);
}));

// ============================================
// ACTIVITIES ENDPOINTS
// ============================================
app.get('/api/activities/search', asyncHandler(async (req: Request, res: Response) => {
  const { location, radius = '20' } = req.query;

  if (!location) {
    return res.status(400).json({ error: 'Missing required parameter: location' });
  }

  const results = await facade.searchActivities({
    location: location as string,
    radius: parseInt(radius as string),
  });

  res.json(results);
}));

// ============================================
// NATIONAL PARKS ENDPOINTS
// ============================================
app.get('/api/parks/search', asyncHandler(async (req: Request, res: Response) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Missing required parameter: query' });
  }

  const parks = await facade.searchNationalParks(query as string);
  res.json({ parks, totalResults: parks.length });
}));

app.get('/api/parks/:parkCode', asyncHandler(async (req: Request, res: Response) => {
  const { parkCode } = req.params;

  const details = await facade.getParkDetails(parkCode);
  if (!details) {
    return res.status(404).json({ error: `Park not found: ${parkCode}` });
  }

  res.json(details);
}));

app.get('/api/parks/:parkCode/hikes', asyncHandler(async (req: Request, res: Response) => {
  const { parkCode } = req.params;

  const hikes = facade.getParkHikes(parkCode);
  res.json({ parkCode, hikes, totalResults: hikes.length });
}));

// ============================================
// STATE PARKS ENDPOINTS
// ============================================
app.get('/api/state-parks/states', asyncHandler(async (req: Request, res: Response) => {
  const states = stateParkService.getStates();
  res.json({ states, totalResults: states.length });
}));

app.get('/api/state-parks/overview', asyncHandler(async (req: Request, res: Response) => {
  const overview = await stateParkService.getStatesOverview();
  res.json({ states: overview, totalResults: overview.length });
}));

app.get('/api/state-parks/search', asyncHandler(async (req: Request, res: Response) => {
  const { state, query, limit } = req.query;

  // State is required to limit data volume
  if (!state) {
    return res.status(400).json({ 
      error: 'State is required for state park searches. Please specify a state code (e.g., CA, TX, NY).',
      example: '/api/state-parks/search?state=CA&query=beach'
    });
  }

  const results = await stateParkService.searchParks({
    state: state as string,
    query: query as string | undefined,
    limit: limit ? parseInt(limit as string) : 30,
  });

  res.json(results);
}));

app.get('/api/state-parks/state/:stateCode', asyncHandler(async (req: Request, res: Response) => {
  const { stateCode } = req.params;

  const parks = await stateParkService.getParksByState(stateCode.toUpperCase());
  res.json({ stateCode, parks, totalResults: parks.length });
}));

app.get('/api/state-parks/campgrounds/:stateCode', asyncHandler(async (req: Request, res: Response) => {
  const { stateCode } = req.params;

  const campgrounds = await stateParkService.getCampgrounds(stateCode.toUpperCase());
  res.json({ 
    stateCode, 
    campgrounds, 
    totalResults: campgrounds.length,
    sources: ['recreation.gov', 'openstreetmap', 'nps'],
    note: 'For better performance, use /api/state-parks/park/:stateCode/:parkName/campgrounds for specific parks',
  });
}));

// Lazy-load endpoint: Get campgrounds for a SPECIFIC park (preferred method)
app.get('/api/state-parks/park/:stateCode/:parkName/campgrounds', asyncHandler(async (req: Request, res: Response) => {
  const { stateCode, parkName } = req.params;

  const campgrounds = await stateParkService.getCampgroundsForPark(
    decodeURIComponent(parkName),
    stateCode.toUpperCase()
  );
  
  res.json({ 
    stateCode,
    parkName: decodeURIComponent(parkName),
    campgrounds, 
    totalResults: campgrounds.length,
    sources: ['recreation.gov', 'nps'],
  });
}));

app.get('/api/state-parks/campgrounds/nearby', asyncHandler(async (req: Request, res: Response) => {
  const { lat, lng, radius } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'Missing required parameters: lat, lng' });
  }

  const campgrounds = await stateParkService.getCampgroundsNearby(
    parseFloat(lat as string),
    parseFloat(lng as string),
    radius ? parseInt(radius as string) : 50
  );

  res.json({ 
    campgrounds, 
    totalResults: campgrounds.length,
    sources: ['recreation.gov', 'openstreetmap'],
  });
}));

app.get('/api/state-parks/designations', asyncHandler(async (req: Request, res: Response) => {
  const designations = await stateParkService.getDesignationTypes();
  res.json({ designations, totalResults: designations.length });
}));

// ============================================
// TRAIL MAP ENDPOINTS
// ============================================
app.get('/api/trails/map/:stateCode', asyncHandler(async (req: Request, res: Response) => {
  const { stateCode } = req.params;
  const { parkId, includeGeometry } = req.query;

  const result = await parkData.getTrailsForMap(
    stateCode.toUpperCase(),
    parkId ? String(parkId) : undefined,
    includeGeometry === 'true'
  );

  res.set('Cache-Control', 'public, max-age=900'); // 15 min
  res.json(result);
}));

app.get('/api/map/parks/:stateCode', asyncHandler(async (req: Request, res: Response) => {
  const { stateCode } = req.params;

  // Get parks with coordinates from park data provider (Postgres or S3)
  const result = await parkData.getParksInState(stateCode.toUpperCase());
  const allParks = [...(result?.national || []), ...(result?.state || [])];
  const mapParks = allParks
    .filter(p => p.coordinates?.latitude && p.coordinates?.longitude)
    .map(p => ({
      id: p.id,
      name: p.name,
      latitude: p.coordinates.latitude,
      longitude: p.coordinates.longitude,
      stateCode: p.stateCode,
      category: p.category || p.parkType,
      designation: p.designation,
      stateName: p.stateName,
    }));

  res.set('Cache-Control', 'public, max-age=900'); // 15 min
  res.json({ stateCode: stateCode.toUpperCase(), parks: mapParks, totalParks: mapParks.length });
}));

app.get('/api/map/campgrounds/:stateCode', asyncHandler(async (req: Request, res: Response) => {
  const { stateCode } = req.params;

  const campData = await parkData.getCampgroundsForMap(stateCode.toUpperCase());
  res.set('Cache-Control', 'public, max-age=900'); // 15 min
  res.json(campData);
}));

// Spatial: trails by bounding box (Postgres only, falls back to state-based)
app.get('/api/trails/bbox', asyncHandler(async (req: Request, res: Response) => {
  const { minLat, minLng, maxLat, maxLng, limit, difficulty } = req.query;

  if (!minLat || !minLng || !maxLat || !maxLng) {
    return res.status(400).json({ error: 'Missing required parameters: minLat, minLng, maxLat, maxLng' });
  }

  const trails = await parkData.getTrailsInBoundingBox(
    parseFloat(minLat as string), parseFloat(minLng as string),
    parseFloat(maxLat as string), parseFloat(maxLng as string),
    { limit: limit ? parseInt(limit as string) : 300, difficulty: difficulty as string }
  );

  res.set('Cache-Control', 'public, max-age=300'); // 5 min — bbox queries vary more
  res.json({ trails, totalTrails: trails.length });
}));

// Spatial: campgrounds near a point (Postgres only)
app.get('/api/campgrounds/nearby', asyncHandler(async (req: Request, res: Response) => {
  const { latitude, longitude, radius = '50', limit = '20' } = req.query;

  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'Missing required parameters: latitude, longitude' });
  }

  const campgrounds = await parkData.getCampgroundsNearLocation(
    parseFloat(latitude as string), parseFloat(longitude as string),
    parseFloat(radius as string), parseInt(limit as string)
  );

  res.set('Cache-Control', 'public, max-age=300'); // 5 min
  res.json({ campgrounds, totalFound: campgrounds.length });
}));

// ============================================
// TRIP PLANNING ENDPOINTS
// ============================================
app.post('/api/trips/plan-park-trip', asyncHandler(async (req: Request, res: Response) => {
  const { parkCode, originAirport, arrivalDate, departureDate, adults = 1 } = req.body;

  if (!parkCode || !originAirport || !arrivalDate || !departureDate) {
    return res.status(400).json({ 
      error: 'Missing required parameters: parkCode, originAirport, arrivalDate, departureDate' 
    });
  }

  const tripPlan = await facade.planParkTrip({
    parkCode,
    originAirport,
    arrivalDate,
    departureDate,
    adults,
  });

  res.json(tripPlan);
}));

// ============================================
// UTILITY ENDPOINTS
// ============================================
app.get('/api/airports/:iataCode', (req: Request, res: Response) => {
  const { iataCode } = req.params;
  
  const airport = facade.getAirportInfo(iataCode);
  if (!airport) {
    return res.status(404).json({ error: `Airport not found: ${iataCode}` });
  }

  res.json(airport);
});

// ============================================
// CHAT ENDPOINT (Claude AI)
// ============================================
interface ChatResponse {
  response: string;
  photos?: { keyword: string; url: string; caption?: string }[];
}

let chatHandler: ((messages: any[], context: any, model?: string, onToolStatus?: (toolName: string, status: 'starting' | 'complete') => void) => Promise<ChatResponse>) | null = null;

// Initialize chat handler
createChatHandler(facade).then(handler => {
  chatHandler = handler;
  console.log('✅ Claude chat handler initialized');
}).catch(err => {
  console.error('⚠️ Claude chat not available:', err.message);
});

// Start a chat request and get a request ID for polling
app.post('/api/chat/start', asyncHandler(async (req: Request, res: Response) => {
  const { messages, context, model } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing required parameter: messages (array)' });
  }

  if (!chatHandler) {
    return res.status(503).json({ 
      error: 'Chat service not available. Set ANTHROPIC_API_KEY in .env',
      fallback: true 
    });
  }

  // Generate a unique request ID
  const requestId = randomUUID();
  
  // Initialize status
  activeRequestStatuses.set(requestId, { status: 'thinking', timestamp: Date.now() });
  
  // Return request ID immediately so client can start polling
  res.json({ requestId });
  
  // Process the chat request asynchronously
  const startTime = Date.now();
  console.log(`[Chat] Request ${requestId} started - ${messages?.length || 0} messages`);
  
  try {
    // Tool status callback to update the polling status
    const onToolStatus = (toolName: string, status: 'starting' | 'complete') => {
      if (status === 'starting') {
        const displayName = TOOL_DISPLAY_NAMES[toolName] || `Using ${toolName}...`;
        activeRequestStatuses.set(requestId, { 
          status: 'tool', 
          toolName: displayName, 
          timestamp: Date.now() 
        });
        // Don't log internal status markers as tool calls
        if (!toolName.startsWith('__')) {
          console.log(`[Chat] Request ${requestId} tool: ${displayName}`);
        }
      } else if (status === 'complete') {
        // After a tool finishes, briefly show transition status
        // This gets overwritten quickly by the next tool's 'starting' or '__analyzing__'
        activeRequestStatuses.set(requestId, { 
          status: 'tool', 
          toolName: 'Processing...', 
          timestamp: Date.now() 
        });
      }
    };
    
    const result = await chatHandler(messages, context || {}, model, onToolStatus);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Chat] Request ${requestId} complete in ${duration}s - ${result.photos?.length || 0} photos`);
    
    // Store the result
    activeRequestStatuses.set(requestId, { 
      status: 'complete', 
      timestamp: Date.now(),
      result: { response: result.response, photos: result.photos, toolsUsed: (result as any).toolsUsed }
    } as any);
  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[Chat] Request ${requestId} error after ${duration}s:`, error.message);
    activeRequestStatuses.set(requestId, { 
      status: 'error', 
      timestamp: Date.now(),
      error: error.message
    } as any);
  }
}));

// Poll for chat request status
app.get('/api/chat/status/:requestId', (req: Request, res: Response) => {
  const { requestId } = req.params;
  const statusData = activeRequestStatuses.get(requestId);
  
  if (!statusData) {
    return res.status(404).json({ error: 'Request not found' });
  }
  
  const { status, toolName, ...rest } = statusData as any;
  
  if (status === 'complete') {
    // Clean up after delivering result
    activeRequestStatuses.delete(requestId);
    return res.json({ status: 'complete', ...rest.result });
  }
  
  if (status === 'error') {
    activeRequestStatuses.delete(requestId);
    return res.status(500).json({ status: 'error', error: rest.error, fallback: true });
  }
  
  // Still processing
  res.json({ status, toolName });
});

// Legacy synchronous chat endpoint (kept for backwards compatibility)
app.post('/api/chat', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { messages, context, model } = req.body;

  console.log(`[Chat] Request received - ${messages?.length || 0} messages, model: ${model || 'default'}`);

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing required parameter: messages (array)' });
  }

  if (!chatHandler) {
    return res.status(503).json({ 
      error: 'Chat service not available. Set ANTHROPIC_API_KEY in .env',
      fallback: true 
    });
  }

  try {
    const result = await chatHandler(messages, context || {}, model);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Chat] Response ready in ${duration}s - ${result.photos?.length || 0} photos`);
    res.json({ response: result.response, photos: result.photos, toolsUsed: (result as any).toolsUsed });
  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[Chat] Error after ${duration}s:`, error.message);
    res.status(500).json({ error: error.message, fallback: true });
  }
}));

// Streaming chat endpoint with real-time tool status updates
app.post('/api/chat/stream', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { messages, context, model } = req.body;

  console.log(`[Chat Stream] Request received - ${messages?.length || 0} messages`);

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing required parameter: messages (array)' });
  }

  if (!chatHandler) {
    return res.status(503).json({ 
      error: 'Chat service not available. Set ANTHROPIC_API_KEY in .env',
      fallback: true 
    });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    // Tool status callback to send SSE events
    const onToolStatus = (toolName: string, status: 'starting' | 'complete') => {
      const displayName = TOOL_DISPLAY_NAMES[toolName] || `Using ${toolName}...`;
      const event = { type: 'tool_status', tool: toolName, status, message: displayName };
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    const result = await chatHandler(messages, context || {}, model, onToolStatus);
    
    // Send final result
    const finalEvent = { 
      type: 'complete', 
      response: result.response, 
      photos: result.photos,
      segments: (result as any).segments,
    };
    res.write(`data: ${JSON.stringify(finalEvent)}\n\n`);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Chat Stream] Complete in ${duration}s - ${result.photos?.length || 0} photos`);
    
    res.end();
  } catch (error: any) {
    const errorEvent = { type: 'error', error: error.message };
    res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
    res.end();
  }
}));

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('API Error:', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`TripAgent API running on http://localhost:${PORT}`);
  console.log(`Endpoints:`);
  console.log(`   GET  /health`);
  console.log(`   GET  /api/flights/search?origin={origin}&destination={destination}&departureDate={YYYY-MM-DD}`);
  console.log(`   GET  /api/hotels/search?location={location}&checkInDate={YYYY-MM-DD}&checkOutDate={YYYY-MM-DD}`);
  console.log(`   GET  /api/cars/search?pickupLocation={location}&pickupDate={YYYY-MM-DD}&dropoffDate={YYYY-MM-DD}`);
  console.log(`   GET  /api/activities/search?location={location}`);
  console.log(`   GET  /api/parks/search?query={parkName}`);
  console.log(`   GET  /api/parks/:parkCode`);
  console.log(`   GET  /api/parks/:parkCode/hikes`);
  console.log(`   GET  /api/state-parks/states`);
  console.log(`   GET  /api/state-parks/overview`);
  console.log(`   GET  /api/state-parks/search?state={stateCode}&query={query}`);
  console.log(`   GET  /api/state-parks/campgrounds/:stateCode`);
  console.log(`   POST /api/trips/plan-park-trip`);
  console.log(`   GET  /api/airports/:iataCode`);
});

export default app;
