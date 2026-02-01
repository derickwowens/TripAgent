import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import * as Location from 'expo-location';

export interface UserLocation {
  city: string;
  state: string;
  nearestAirport: string;
  lat?: number;
  lng?: number;
}

// Singleton to cache location across the app
let cachedLocation: UserLocation | null = null;
let locationPromise: Promise<UserLocation | null> | null = null;

// Complete mapping of all US states to major airports
const AIRPORT_MAPPING: Record<string, string> = {
  'Alabama': 'BHM',
  'Alaska': 'ANC',
  'Arizona': 'PHX',
  'Arkansas': 'LIT',
  'California': 'LAX',
  'Colorado': 'DEN',
  'Connecticut': 'BDL',
  'Delaware': 'PHL',
  'Florida': 'MIA',
  'Georgia': 'ATL',
  'Hawaii': 'HNL',
  'Idaho': 'BOI',
  'Illinois': 'ORD',
  'Indiana': 'IND',
  'Iowa': 'DSM',
  'Kansas': 'MCI',
  'Kentucky': 'SDF',
  'Louisiana': 'MSY',
  'Maine': 'PWM',
  'Maryland': 'BWI',
  'Massachusetts': 'BOS',
  'Michigan': 'DTW',
  'Minnesota': 'MSP',
  'Mississippi': 'JAN',
  'Missouri': 'STL',
  'Montana': 'BZN',
  'Nebraska': 'OMA',
  'Nevada': 'LAS',
  'New Hampshire': 'MHT',
  'New Jersey': 'EWR',
  'New Mexico': 'ABQ',
  'New York': 'JFK',
  'North Carolina': 'CLT',
  'North Dakota': 'FAR',
  'Ohio': 'CLE',
  'Oklahoma': 'OKC',
  'Oregon': 'PDX',
  'Pennsylvania': 'PHL',
  'Rhode Island': 'PVD',
  'South Carolina': 'CHS',
  'South Dakota': 'FSD',
  'Tennessee': 'BNA',
  'Texas': 'DFW',
  'Utah': 'SLC',
  'Vermont': 'BTV',
  'Virginia': 'IAD',
  'Washington': 'SEA',
  'West Virginia': 'CRW',
  'Wisconsin': 'MKE',
  'Wyoming': 'JAC',
  'District of Columbia': 'DCA',
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

      const state = address.region || '';
      // Use the user's actual state airport, or leave empty if unknown
      // This prevents defaulting to LAX for users not in California
      const nearestAirport = state ? (AIRPORT_MAPPING[state] || '') : '';

      cachedLocation = {
        city: address.city || 'Unknown',
        state: state,
        nearestAirport: nearestAirport,
        lat: location.coords.latitude,
        lng: location.coords.longitude,
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
