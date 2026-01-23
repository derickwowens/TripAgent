import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TRIP_CONTEXT_KEY = 'trip_context_cache';
const MAX_CACHED_TRIPS = 10;

// Structured data types for caching
export interface CachedPark {
  name: string;
  parkCode: string;
  description?: string;
  entranceFee?: string;
  states?: string;
  url?: string;
  gatewayCity?: string;
  gatewayState?: string;
  images?: string[];
  lastUpdated: string;
}

export interface CachedHike {
  name: string;
  difficulty: string;
  distance: string;
  elevationGain?: string;
  duration?: string;
  highlights?: string[];
}

export interface CachedRestaurant {
  name: string;
  address: string;
  city: string;
  state: string;
  rating?: string;
  priceLevel?: string;
  cuisine?: string;
  phone?: string;
  imageUrl?: string;
  reservationLink?: string;
  reviewsUrl?: string;
}

export interface CachedLink {
  text: string;
  url: string;
  category: 'reservation' | 'review' | 'park' | 'lodging' | 'general';
}

export interface CachedEvCharger {
  name: string;
  address: string;
  chargerTypes: string[];
  numChargers?: number;
  network?: string;
}

export interface TripContextData {
  conversationId: string;
  destination?: {
    name: string;
    type: 'national_park' | 'city' | 'other';
  };
  park?: CachedPark;
  hikes?: CachedHike[];
  restaurants?: CachedRestaurant[];
  evChargers?: CachedEvCharger[];
  links?: CachedLink[];
  travelDates?: {
    arrival?: string;
    departure?: string;
  };
  travelers?: number;
  departingFrom?: string;
  createdAt: string;
  updatedAt: string;
}

interface TripContextCache {
  [conversationId: string]: TripContextData;
}

export const useTripContext = (conversationId: string | null) => {
  const [tripContext, setTripContext] = useState<TripContextData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Refs for debouncing saves
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const tripContextRef = useRef(tripContext);
  
  // Keep ref in sync
  useEffect(() => { tripContextRef.current = tripContext; }, [tripContext]);

  // Load context for current conversation
  useEffect(() => {
    if (!conversationId) {
      setTripContext(null);
      setIsLoading(false);
      return;
    }
    
    loadContext(conversationId);
  }, [conversationId]);

  const loadContext = async (convId: string) => {
    setIsLoading(true);
    try {
      const cached = await AsyncStorage.getItem(TRIP_CONTEXT_KEY);
      if (cached) {
        const allContexts: TripContextCache = JSON.parse(cached);
        if (allContexts[convId]) {
          setTripContext(allContexts[convId]);
        } else {
          setTripContext({
            conversationId: convId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      } else {
        setTripContext({
          conversationId: convId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Failed to load trip context:', error);
      setTripContext({
        conversationId: convId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced save
  const saveContext = useCallback(async () => {
    const currentContext = tripContextRef.current;
    if (!currentContext || !currentContext.conversationId) return;
    
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    
    try {
      const cached = await AsyncStorage.getItem(TRIP_CONTEXT_KEY);
      let allContexts: TripContextCache = cached ? JSON.parse(cached) : {};
      
      allContexts[currentContext.conversationId] = {
        ...currentContext,
        updatedAt: new Date().toISOString(),
      };
      
      // Prune old contexts
      const entries = Object.entries(allContexts);
      if (entries.length > MAX_CACHED_TRIPS) {
        const sorted = entries.sort((a, b) => 
          new Date(b[1].updatedAt).getTime() - new Date(a[1].updatedAt).getTime()
        );
        allContexts = Object.fromEntries(sorted.slice(0, MAX_CACHED_TRIPS));
      }
      
      await AsyncStorage.setItem(TRIP_CONTEXT_KEY, JSON.stringify(allContexts));
    } catch (error) {
      console.error('Failed to save trip context:', error);
    } finally {
      isSavingRef.current = false;
    }
  }, []);

  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(saveContext, 300);
  }, [saveContext]);

  // Dynamic update: Park data
  const updatePark = useCallback((park: CachedPark) => {
    setTripContext(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        park,
        destination: {
          name: park.name,
          type: 'national_park' as const,
        },
      };
    });
    debouncedSave();
  }, [debouncedSave]);

  // Dynamic update: Hikes
  const updateHikes = useCallback((hikes: CachedHike[]) => {
    setTripContext(prev => {
      if (!prev) return prev;
      return { ...prev, hikes };
    });
    debouncedSave();
  }, [debouncedSave]);

  // Dynamic update: Restaurants (merges with existing)
  const updateRestaurants = useCallback((restaurants: CachedRestaurant[]) => {
    setTripContext(prev => {
      if (!prev) return prev;
      const existing = prev.restaurants || [];
      const merged = [...existing];
      
      for (const restaurant of restaurants) {
        const existingIdx = merged.findIndex(
          r => r.name.toLowerCase() === restaurant.name.toLowerCase()
        );
        if (existingIdx >= 0) {
          merged[existingIdx] = { ...merged[existingIdx], ...restaurant };
        } else {
          merged.push(restaurant);
        }
      }
      
      return { ...prev, restaurants: merged.slice(0, 20) };
    });
    debouncedSave();
  }, [debouncedSave]);

  // Dynamic update: EV Chargers
  const updateEvChargers = useCallback((chargers: CachedEvCharger[]) => {
    setTripContext(prev => {
      if (!prev) return prev;
      return { ...prev, evChargers: chargers.slice(0, 10) };
    });
    debouncedSave();
  }, [debouncedSave]);

  // Dynamic update: Links (merges, avoids duplicates)
  const addLinks = useCallback((links: CachedLink[]) => {
    setTripContext(prev => {
      if (!prev) return prev;
      const existing = prev.links || [];
      const merged = [...existing];
      
      for (const link of links) {
        if (!merged.some(l => l.url === link.url)) {
          merged.push(link);
        }
      }
      
      return { ...prev, links: merged.slice(0, 50) };
    });
    debouncedSave();
  }, [debouncedSave]);

  // Dynamic update: Travel details from user input
  const updateTravelDetails = useCallback((details: {
    arrival?: string;
    departure?: string;
    travelers?: number;
    departingFrom?: string;
  }) => {
    setTripContext(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        travelDates: details.arrival || details.departure ? {
          arrival: details.arrival ?? prev.travelDates?.arrival,
          departure: details.departure ?? prev.travelDates?.departure,
        } : prev.travelDates,
        travelers: details.travelers ?? prev.travelers,
        departingFrom: details.departingFrom ?? prev.departingFrom,
      };
    });
    debouncedSave();
  }, [debouncedSave]);

  // Dynamic update: Set destination directly (for non-park destinations)
  const setDestination = useCallback((name: string, type: 'national_park' | 'city' | 'other' = 'other') => {
    setTripContext(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        destination: { name, type },
      };
    });
    debouncedSave();
  }, [debouncedSave]);

  // Get context summary for API requests
  const getContextForApi = useCallback((): Record<string, any> | undefined => {
    if (!tripContext) return undefined;
    
    const context: Record<string, any> = {};
    
    if (tripContext.destination) {
      context.destination = tripContext.destination.name;
      context.destinationType = tripContext.destination.type;
    }
    
    if (tripContext.park) {
      context.parkCode = tripContext.park.parkCode;
      context.parkName = tripContext.park.name;
      if (tripContext.park.gatewayCity) {
        context.npsGatewayCity = {
          city: tripContext.park.gatewayCity,
          state: tripContext.park.gatewayState,
          parkCode: tripContext.park.parkCode,
          parkName: tripContext.park.name,
        };
      }
    }
    
    if (tripContext.restaurants && tripContext.restaurants.length > 0) {
      context.knownRestaurants = tripContext.restaurants.slice(0, 10).map(r => ({
        name: r.name,
        city: r.city,
        state: r.state,
        reservationLink: r.reservationLink,
      }));
    }
    
    if (tripContext.hikes && tripContext.hikes.length > 0) {
      context.knownHikes = tripContext.hikes.slice(0, 5).map(h => h.name);
    }
    
    if (tripContext.travelDates) {
      context.travelDates = tripContext.travelDates;
    }
    
    if (tripContext.travelers) {
      context.numTravelers = tripContext.travelers;
    }
    
    if (tripContext.departingFrom) {
      context.departingFrom = tripContext.departingFrom;
    }
    
    return Object.keys(context).length > 0 ? context : undefined;
  }, [tripContext]);

  // Clear context for current conversation
  const clearContext = useCallback(async () => {
    if (!conversationId) return;
    
    try {
      const cached = await AsyncStorage.getItem(TRIP_CONTEXT_KEY);
      if (cached) {
        const allContexts: TripContextCache = JSON.parse(cached);
        delete allContexts[conversationId];
        await AsyncStorage.setItem(TRIP_CONTEXT_KEY, JSON.stringify(allContexts));
      }
      setTripContext({
        conversationId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to clear trip context:', error);
    }
  }, [conversationId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    tripContext,
    isLoading,
    updatePark,
    updateHikes,
    updateRestaurants,
    updateEvChargers,
    addLinks,
    updateTravelDetails,
    setDestination,
    getContextForApi,
    clearContext,
  };
};
