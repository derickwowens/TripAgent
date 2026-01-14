import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'user_profile';

export const useUserProfile = () => {
  const [userProfile, setUserProfile] = useState<string>('');
  const [profileExpanded, setProfileExpanded] = useState(false);

  useEffect(() => {
    loadProfile();
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

  // Update local state only (no persistence)
  const updateProfile = useCallback((profile: string) => {
    setUserProfile(profile);
  }, []);

  // Persist to AsyncStorage (call when menu closes)
  const persistProfile = useCallback(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, userProfile);
    } catch (error) {
      console.error('Failed to save user profile:', error);
    }
  }, [userProfile]);

  const addSuggestion = (suggestion: string) => {
    const newProfile = userProfile 
      ? `${userProfile}, ${suggestion}`
      : suggestion;
    updateProfile(newProfile);
  };

  const toggleExpanded = () => setProfileExpanded(!profileExpanded);

  return {
    userProfile,
    profileExpanded,
    updateProfile,
    persistProfile,
    addSuggestion,
    toggleExpanded,
  };
};
