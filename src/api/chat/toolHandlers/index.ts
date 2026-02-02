/**
 * Tool Handlers Index
 * 
 * Re-exports all tool handlers for use in the main chat module
 */

// Shared utilities
export { resolveGatewayCity, PARK_GATEWAY_CITIES } from './shared.js';

// Parks handlers
export {
  handleSearchNationalParks,
  handlePlanParkTrip,
  handleGetParkHikes,
  handleGetWildlife,
  handleGetCampgrounds,
} from './parks.js';

// State parks handlers
export {
  handleSearchStateParks,
  handleGetStateParkDetails,
  handleGetStateParkCampgrounds,
  handleGetStateParkHikes,
  handleGetStateTrails,
  STATE_NAMES,
} from './stateParks.js';

// Database handlers
export {
  handleLookupParkDatabase,
  handleGetParksNearLocation,
  handleGetParkDatabaseStats,
} from './database.js';

// Travel handlers
export {
  handleSearchFlights,
  handleGetDrivingDistance,
  handleSearchEvChargingStations,
  handleSearchCarRentals,
} from './travel.js';

// Lodging handlers
export { handleSearchHotels } from './lodging.js';

// Food handlers
export {
  handleSearchRestaurants,
  handleGetReservationLink,
} from './food.js';

// Activities handlers
export { handleSearchActivities } from './activities.js';
