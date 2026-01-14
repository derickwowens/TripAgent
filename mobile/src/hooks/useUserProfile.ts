import { useState, useEffect } from 'react';
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

  const saveProfile = async (profile: string) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, profile);
      setUserProfile(profile);
    } catch (error) {
      console.error('Failed to save user profile:', error);
    }
  };

  const addSuggestion = (suggestion: string) => {
    // Keep the emoji with the text for better readability
    const newProfile = userProfile 
      ? `${userProfile}, ${suggestion}`
      : suggestion;
    saveProfile(newProfile);
  };

  const toggleExpanded = () => setProfileExpanded(!profileExpanded);

  return {
    userProfile,
    profileExpanded,
    saveProfile,
    addSuggestion,
    toggleExpanded,
  };
};
