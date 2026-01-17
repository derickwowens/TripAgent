import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import * as Location from 'expo-location';

export interface UserLocation {
  city: string;
  state: string;
  nearestAirport: string;
}

// Singleton to cache location across the app
let cachedLocation: UserLocation | null = null;
let locationPromise: Promise<UserLocation | null> | null = null;

const AIRPORT_MAPPING: Record<string, string> = {
  'California': 'LAX',
  'New York': 'JFK',
  'Texas': 'DFW',
  'Florida': 'MIA',
  'Illinois': 'ORD',
  'Washington': 'SEA',
  'Colorado': 'DEN',
  'Arizona': 'PHX',
  'Nevada': 'LAS',
  'Georgia': 'ATL',
  'Massachusetts': 'BOS',
  'Pennsylvania': 'PHL',
  'Ohio': 'CLE',
  'Michigan': 'DTW',
  'Oregon': 'PDX',
};

// Fetch location once and cache it
const fetchLocation = async (): Promise<UserLocation | null> => {
  // Return cached location if available
  if (cachedLocation) {
    return cachedLocation;
  }

  // If already fetching, return the existing promise
  if (locationPromise) {
    return locationPromise;
  }

  // Start fetching
  locationPromise = (async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return null;
      }

      const location = await Location.getCurrentPositionAsync({});
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      const state = address.region || 'California';
      const nearestAirport = AIRPORT_MAPPING[state] || 'LAX';

      cachedLocation = {
        city: address.city || 'Unknown',
        state: state,
        nearestAirport: nearestAirport,
      };

      return cachedLocation;
    } catch (error) {
      console.error('Location error:', error);
      return null;
    }
  })();

  return locationPromise;
};

// Start location detection immediately when module loads
fetchLocation();

export const useLocation = () => {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(cachedLocation);
  const [locationLoading, setLocationLoading] = useState(!cachedLocation);

  useEffect(() => {
    // If already cached, use it immediately
    if (cachedLocation) {
      setUserLocation(cachedLocation);
      setLocationLoading(false);
      return;
    }

    // Otherwise wait for the fetch
    fetchLocation().then(location => {
      setUserLocation(location);
      setLocationLoading(false);
    });
  }, []);

  return {
    userLocation,
    locationLoading,
  };
};
