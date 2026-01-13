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
import { createChatHandler } from './chat.js';
import { logError } from './errorLogger.js';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3000;

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
  new NationalParksAdapter(process.env.NPS_API_KEY)
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

let chatHandler: ((messages: any[], context: any, model?: string) => Promise<ChatResponse>) | null = null;

// Initialize chat handler
createChatHandler(facade).then(handler => {
  chatHandler = handler;
  console.log('✅ Claude chat handler initialized');
}).catch(err => {
  console.error('⚠️ Claude chat not available:', err.message);
});

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
    res.json({ response: result.response, photos: result.photos });
  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[Chat] Error after ${duration}s:`, error.message);
    res.status(500).json({ error: error.message, fallback: true });
  }
}));

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('API Error:', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 TripAgent API running on http://localhost:${PORT}`);
  console.log(`📚 Endpoints:`);
  console.log(`   GET  /health`);
  console.log(`   GET  /api/flights/search?origin=LAX&destination=JFK&departureDate=2026-06-15`);
  console.log(`   GET  /api/hotels/search?location=NYC&checkInDate=2026-06-15&checkOutDate=2026-06-18`);
  console.log(`   GET  /api/cars/search?pickupLocation=LAX&pickupDate=2026-06-15&dropoffDate=2026-06-18`);
  console.log(`   GET  /api/activities/search?location=Paris`);
  console.log(`   GET  /api/parks/search?query=yosemite`);
  console.log(`   GET  /api/parks/:parkCode`);
  console.log(`   GET  /api/parks/:parkCode/hikes`);
  console.log(`   POST /api/trips/plan-park-trip`);
  console.log(`   GET  /api/airports/:iataCode`);
});

export default app;
