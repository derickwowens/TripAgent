import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBlacklistedParkCodes } from '../utils/parkDistanceFilter';

const STORAGE_KEY = 'user_profile';
const DISTANCE_STORAGE_KEY = 'user_max_travel_distance';

// null = unlimited, otherwise miles
export type MaxTravelDistance = number | null;

export interface UserLocation {
  lat: number;
  lng: number;
}

export const useUserProfile = (userLocation?: UserLocation) => {
  const [userProfile, setUserProfile] = useState<string>('');
  const [profileExpanded, setProfileExpanded] = useState(false);
  const [maxTravelDistance, setMaxTravelDistance] = useState<MaxTravelDistance>(null); // null = unlimited

  useEffect(() => {
    loadProfile();
    loadMaxTravelDistance();
  }, []);

  const loadProfile = async () => {
    try {
      const profile = await AsyncStorage.getItem(STORAGE_KEY);
      if (profile) {
        setUserProfile(profile);
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
    }
  };

  const loadMaxTravelDistance = async () => {
    try {
      const distance = await AsyncStorage.getItem(DISTANCE_STORAGE_KEY);
      if (distance !== null) {
        const parsed = JSON.parse(distance);
        setMaxTravelDistance(parsed);
      }
    } catch (error) {
      console.error('Failed to load max travel distance:', error);
    }
  };

  // Update local state only (no persistence)
  const updateProfile = useCallback((profile: string) => {
    setUserProfile(profile);
  }, []);

  // Persist to AsyncStorage (call when menu closes)
  const persistProfile = useCallback(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, userProfile);
      await AsyncStorage.setItem(DISTANCE_STORAGE_KEY, JSON.stringify(maxTravelDistance));
    } catch (error) {
      console.error('Failed to save user profile:', error);
    }
  }, [userProfile, maxTravelDistance]);

  // Update max travel distance (local state only)
  const updateMaxTravelDistance = useCallback((distance: MaxTravelDistance) => {
    setMaxTravelDistance(distance);
  }, []);

  // Update and persist in one call (for onboarding)
  const updateAndPersistProfile = useCallback(async (profile: string) => {
    setUserProfile(profile);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, profile);
    } catch (error) {
      console.error('Failed to save user profile:', error);
    }
  }, []);

  const addSuggestion = (suggestion: string) => {
    const newProfile = userProfile 
      ? `${userProfile}, ${suggestion}`
      : suggestion;
    updateProfile(newProfile);
  };

  const toggleExpanded = () => setProfileExpanded(!profileExpanded);

  // Calculate blacklisted parks based on user location and max distance
  // This is memoized to avoid recalculating on every render
  const blacklistedParkCodes = useMemo(() => {
    if (!userLocation || maxTravelDistance === null) {
      return []; // No location or unlimited distance = no blacklist
    }
    return getBlacklistedParkCodes(userLocation.lat, userLocation.lng, maxTravelDistance);
  }, [userLocation?.lat, userLocation?.lng, maxTravelDistance]);

  return {
    userProfile,
    profileExpanded,
    maxTravelDistance,
    blacklistedParkCodes,
    updateProfile,
    persistProfile,
    updateAndPersistProfile,
    addSuggestion,
    toggleExpanded,
    updateMaxTravelDistance,
  };
};
