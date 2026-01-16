/**
 * Loading states hook for context-aware loading messages
 */

/**
 * Generate context-aware loading messages based on user's query
 */
export function getLoadingStatesForQuery(query: string): string[] {
  const q = query.toLowerCase();
  const states: string[] = [];
  
  // Detect what the user is asking about
  const isAskingAboutFlights = /flight|fly|airport|airline/i.test(q);
  const isAskingAboutHotels = /hotel|lodging|stay|accommodat|room/i.test(q);
  const isAskingAboutCars = /car|rental|rent|drive/i.test(q);
  const isAskingAboutParks = /park|hike|trail|camping|camp|national|yosemite|yellowstone|zion|glacier|canyon|sequoia|acadia|olympic|everglades|smoky/i.test(q);
  const isAskingAboutActivities = /tour|activity|activities|things to do|experience/i.test(q);
  const isAskingAboutEV = /tesla|ev|charging|electric/i.test(q);
  const isPlanningTrip = /trip|plan|itinerary|vacation|travel|visit|going to|heading to/i.test(q);
  const isAskingForPhotos = /photo|picture|image|background|wallpaper|different photo|new photo|more photo|refresh photo|change photo|show me more|get more/i.test(q);
  
  // plan_park_trip is triggered when asking about parks - it fetches everything
  const isParkTrip = isAskingAboutParks && (isPlanningTrip || /want|like|help|tell me|show me|info|about/i.test(q));
  
  // Add relevant loading states based on detected intent
  if (isAskingAboutParks) {
    states.push('🏞️ Searching national parks...');
    states.push('🥾 Finding hiking trails...');
    states.push('🏕️ Checking campground availability...');
  }
  
  // park trips trigger full plan_park_trip which fetches flights, hotels, cars
  if (isAskingAboutFlights || isPlanningTrip || isParkTrip) {
    states.push('✈️ Searching flight options...');
  }
  
  if (isAskingAboutHotels || isPlanningTrip || isParkTrip) {
    states.push('🏨 Finding hotels & lodging...');
  }
  
  if (isAskingAboutCars || isPlanningTrip || isParkTrip) {
    states.push('🚗 Checking car rental prices...');
  }
  
  if (isAskingAboutActivities) {
    states.push('🎫 Discovering tours & activities...');
  }
  
  if (isAskingAboutEV) {
    states.push('⚡ Locating charging stations...');
  }
  
  if (isAskingForPhotos) {
    states.push('📸 Finding new photos...');
  }
  
  if (isPlanningTrip || isParkTrip) {
    states.push('🗺️ Calculating driving distances...');
    states.push('📝 Compiling your trip plan...');
  }
  
  // Always end with a compilation message if we have multiple steps
  if (states.length > 2) {
    states.push('✨ Putting it all together...');
  }
  
  // Fallback if no specific intent detected
  if (states.length === 0) {
    states.push('🔍 Searching for information...');
  }
  
  return states;
}

/**
 * Hook for managing loading state progression
 */
export function useLoadingStateProgression(
  loadingStates: string[],
  isLoading: boolean,
  setLoadingStatus: (status: string) => void
): void {
  // This hook can be used to manage the interval-based progression
  // of loading states. For now, we export just the generator function.
}
