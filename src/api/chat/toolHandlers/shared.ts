/**
 * Shared utilities and types for tool handlers
 */

import { TravelFacade } from '../../../domain/facade/TravelFacade.js';
import { ChatContext, PhotoReference } from '../types.js';
import { 
  generateGoogleMapsLink, 
  generateDirectionsLink, 
  generatePlugShareLink,
  generateTeslaChargerLink,
  generateRecreationGovLink,
} from '../../../utils/linkUtils.js';

// Re-export utilities for use by handlers
export { 
  generateGoogleMapsLink, 
  generateDirectionsLink, 
  generatePlugShareLink,
  generateTeslaChargerLink,
  generateRecreationGovLink,
};

// Re-export types
export type { TravelFacade, ChatContext, PhotoReference };

/**
 * Common tool handler signature
 */
export type ToolHandlerResult = {
  result: any;
  destination?: string;
  searchQuery?: string;
  npsGateway?: { city: string; state: string };
};

/**
 * Deterministic park gateway cities for restaurant searches
 * Maps park names/keywords to their correct gateway city and state
 */
export const PARK_GATEWAY_CITIES: Array<{ keywords: string[]; city: string; state: string }> = [
  { keywords: ['yellowstone', 'old faithful'], city: 'West Yellowstone', state: 'MT' },
  { keywords: ['grand teton', 'jackson hole'], city: 'Jackson', state: 'WY' },
  { keywords: ['glacier', 'going to the sun'], city: 'West Glacier', state: 'MT' },
  { keywords: ['yosemite', 'half dome', 'el capitan'], city: 'Mariposa', state: 'CA' },
  { keywords: ['grand canyon south rim', 'grand canyon village'], city: 'Tusayan', state: 'AZ' },
  { keywords: ['grand canyon north rim'], city: 'Marble Canyon', state: 'AZ' },
  { keywords: ['grand canyon'], city: 'Tusayan', state: 'AZ' },
  { keywords: ['zion'], city: 'Springdale', state: 'UT' },
  { keywords: ['bryce canyon', 'bryce'], city: 'Bryce Canyon City', state: 'UT' },
  { keywords: ['arches', 'moab'], city: 'Moab', state: 'UT' },
  { keywords: ['canyonlands'], city: 'Moab', state: 'UT' },
  { keywords: ['capitol reef'], city: 'Torrey', state: 'UT' },
  { keywords: ['rocky mountain', 'rmnp'], city: 'Estes Park', state: 'CO' },
  { keywords: ['great smoky', 'smokies', 'smoky mountains'], city: 'Gatlinburg', state: 'TN' },
  { keywords: ['acadia', 'bar harbor'], city: 'Bar Harbor', state: 'ME' },
  { keywords: ['olympic'], city: 'Port Angeles', state: 'WA' },
  { keywords: ['mount rainier', 'mt rainier'], city: 'Ashford', state: 'WA' },
  { keywords: ['crater lake'], city: 'Prospect', state: 'OR' },
  { keywords: ['joshua tree'], city: 'Twentynine Palms', state: 'CA' },
  { keywords: ['death valley'], city: 'Furnace Creek', state: 'CA' },
  { keywords: ['sequoia', 'kings canyon'], city: 'Three Rivers', state: 'CA' },
  { keywords: ['redwood'], city: 'Crescent City', state: 'CA' },
  { keywords: ['shenandoah'], city: 'Luray', state: 'VA' },
  { keywords: ['big bend'], city: 'Terlingua', state: 'TX' },
  { keywords: ['guadalupe mountains'], city: 'Salt Flat', state: 'TX' },
  { keywords: ['carlsbad caverns'], city: 'Carlsbad', state: 'NM' },
  { keywords: ['white sands'], city: 'Alamogordo', state: 'NM' },
  { keywords: ['petrified forest'], city: 'Holbrook', state: 'AZ' },
  { keywords: ['saguaro'], city: 'Tucson', state: 'AZ' },
  { keywords: ['mesa verde'], city: 'Cortez', state: 'CO' },
  { keywords: ['black canyon'], city: 'Montrose', state: 'CO' },
  { keywords: ['great sand dunes'], city: 'Alamosa', state: 'CO' },
  { keywords: ['badlands'], city: 'Wall', state: 'SD' },
  { keywords: ['wind cave'], city: 'Hot Springs', state: 'SD' },
  { keywords: ['theodore roosevelt'], city: 'Medora', state: 'ND' },
  { keywords: ['voyageurs'], city: 'International Falls', state: 'MN' },
  { keywords: ['isle royale'], city: 'Houghton', state: 'MI' },
  { keywords: ['mammoth cave'], city: 'Cave City', state: 'KY' },
  { keywords: ['hot springs'], city: 'Hot Springs', state: 'AR' },
  { keywords: ['everglades'], city: 'Homestead', state: 'FL' },
  { keywords: ['biscayne'], city: 'Homestead', state: 'FL' },
  { keywords: ['dry tortugas'], city: 'Key West', state: 'FL' },
  { keywords: ['congaree'], city: 'Hopkins', state: 'SC' },
  { keywords: ['new river gorge'], city: 'Fayetteville', state: 'WV' },
  { keywords: ['cuyahoga valley'], city: 'Peninsula', state: 'OH' },
  { keywords: ['indiana dunes'], city: 'Porter', state: 'IN' },
  { keywords: ['denali'], city: 'Denali Park', state: 'AK' },
  { keywords: ['kenai fjords'], city: 'Seward', state: 'AK' },
  { keywords: ['glacier bay'], city: 'Gustavus', state: 'AK' },
  { keywords: ['katmai'], city: 'King Salmon', state: 'AK' },
  { keywords: ['wrangell', 'st elias'], city: 'McCarthy', state: 'AK' },
  { keywords: ['gates of the arctic'], city: 'Bettles', state: 'AK' },
  { keywords: ['kobuk valley'], city: 'Kotzebue', state: 'AK' },
  { keywords: ['lake clark'], city: 'Port Alsworth', state: 'AK' },
  { keywords: ['hawaii volcanoes', 'kilauea'], city: 'Volcano', state: 'HI' },
  { keywords: ['haleakala'], city: 'Kula', state: 'HI' },
  { keywords: ['channel islands'], city: 'Ventura', state: 'CA' },
  { keywords: ['pinnacles'], city: 'Soledad', state: 'CA' },
  { keywords: ['lassen volcanic', 'lassen'], city: 'Mineral', state: 'CA' },
  { keywords: ['north cascades'], city: 'Marblemount', state: 'WA' },
  { keywords: ['virgin islands'], city: 'Cruz Bay', state: 'VI' },
  { keywords: ['american samoa'], city: 'Pago Pago', state: 'AS' },
  { keywords: ['great basin'], city: 'Baker', state: 'NV' },
];

/**
 * Resolve park location to gateway city for restaurant searches
 * Returns the correct city/state for a park, or null if not found
 */
export function resolveGatewayCity(location: string): { city: string; state: string } | null {
  const locationLower = location.toLowerCase();
  
  for (const gateway of PARK_GATEWAY_CITIES) {
    for (const keyword of gateway.keywords) {
      if (locationLower.includes(keyword)) {
        console.log(`[Restaurant] Resolved "${location}" to gateway city: ${gateway.city}, ${gateway.state}`);
        return { city: gateway.city, state: gateway.state };
      }
    }
  }
  
  return null;
}
