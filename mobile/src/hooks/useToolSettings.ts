import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOOL_SETTINGS_KEY = '@tripagent_tool_settings';

export interface ToolConfig {
  id: string;
  name: string;
  description: string;
  category: 'parks' | 'travel' | 'lodging' | 'food' | 'activities';
  enabled: boolean;
}

export interface ToolSettings {
  languageModel: 'claude-sonnet-4-20250514' | 'claude-3-5-haiku-20241022';
  tools: ToolConfig[];
}

const DEFAULT_TOOLS: ToolConfig[] = [
  // National Parks category
  { id: 'search_national_parks', name: 'National Park Search', description: 'Search for US National Parks', category: 'parks', enabled: true },
  { id: 'plan_park_trip', name: 'Trip Planner', description: 'Complete park trip planning', category: 'parks', enabled: true },
  { id: 'get_park_hikes', name: 'Hiking Trails', description: 'Get hiking trail info', category: 'parks', enabled: true },
  { id: 'get_wildlife', name: 'Wildlife Info', description: 'Wildlife species in parks', category: 'parks', enabled: true },
  { id: 'get_campgrounds', name: 'NPS Campgrounds', description: 'National Park campgrounds', category: 'parks', enabled: true },
  
  // State Parks category
  { id: 'search_state_parks', name: 'State Park Search', description: 'Search state parks by state', category: 'parks', enabled: true },
  { id: 'get_state_park_details', name: 'State Park Details', description: 'Get state park info', category: 'parks', enabled: true },
  { id: 'get_state_park_campgrounds', name: 'State Park Campgrounds', description: 'State park camping info', category: 'parks', enabled: true },
  
  // Travel category
  { id: 'search_flights', name: 'Flight Search', description: 'Search for flights', category: 'travel', enabled: true },
  { id: 'search_car_rentals', name: 'Car Rentals', description: 'Search rental cars', category: 'travel', enabled: true },
  { id: 'get_driving_distance', name: 'Driving Distance', description: 'Calculate drive times', category: 'travel', enabled: true },
  { id: 'search_ev_charging_stations', name: 'EV Charging', description: 'Find charging stations', category: 'travel', enabled: true },
  
  // Lodging category
  { id: 'search_hotels', name: 'Hotel Search', description: 'Search for hotels', category: 'lodging', enabled: true },
  
  // Food category
  { id: 'search_restaurants', name: 'Restaurant Search', description: 'Find restaurants nearby', category: 'food', enabled: true },
  { id: 'get_reservation_link', name: 'Reservations', description: 'Restaurant reservation links', category: 'food', enabled: true },
  
  // Activities category
  { id: 'search_activities', name: 'Activities & Tours', description: 'Tours and experiences', category: 'activities', enabled: true },
];

const DEFAULT_SETTINGS: ToolSettings = {
  languageModel: 'claude-sonnet-4-20250514',
  tools: DEFAULT_TOOLS,
};

export const useToolSettings = () => {
  const [settings, setSettings] = useState<ToolSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(TOOL_SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ToolSettings;
        // Merge with defaults to handle new tools added in updates
        const mergedTools = DEFAULT_TOOLS.map(defaultTool => {
          const savedTool = parsed.tools.find(t => t.id === defaultTool.id);
          return savedTool ? { ...defaultTool, enabled: savedTool.enabled } : defaultTool;
        });
        setSettings({
          languageModel: parsed.languageModel || DEFAULT_SETTINGS.languageModel,
          tools: mergedTools,
        });
      }
    } catch (error) {
      console.error('Error loading tool settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: ToolSettings) => {
    try {
      await AsyncStorage.setItem(TOOL_SETTINGS_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving tool settings:', error);
    }
  };

  const toggleTool = useCallback((toolId: string) => {
    setSettings(prev => {
      const newSettings = {
        ...prev,
        tools: prev.tools.map(tool =>
          tool.id === toolId ? { ...tool, enabled: !tool.enabled } : tool
        ),
      };
      AsyncStorage.setItem(TOOL_SETTINGS_KEY, JSON.stringify(newSettings)).catch(console.error);
      return newSettings;
    });
  }, []);

  const setLanguageModel = useCallback((model: ToolSettings['languageModel']) => {
    setSettings(prev => {
      const newSettings = { ...prev, languageModel: model };
      AsyncStorage.setItem(TOOL_SETTINGS_KEY, JSON.stringify(newSettings)).catch(console.error);
      return newSettings;
    });
  }, []);

  const enableAllTools = useCallback(() => {
    setSettings(prev => {
      const newSettings = {
        ...prev,
        tools: prev.tools.map(tool => ({ ...tool, enabled: true })),
      };
      AsyncStorage.setItem(TOOL_SETTINGS_KEY, JSON.stringify(newSettings)).catch(console.error);
      return newSettings;
    });
  }, []);

  const disableAllTools = useCallback(() => {
    setSettings(prev => {
      const newSettings = {
        ...prev,
        tools: prev.tools.map(tool => ({ ...tool, enabled: false })),
      };
      AsyncStorage.setItem(TOOL_SETTINGS_KEY, JSON.stringify(newSettings)).catch(console.error);
      return newSettings;
    });
  }, []);

  const getEnabledToolIds = useCallback(() => {
    return settings.tools.filter(t => t.enabled).map(t => t.id);
  }, [settings.tools]);

  const enabledToolCount = settings.tools.filter(t => t.enabled).length;
  const totalToolCount = settings.tools.length;

  return {
    settings,
    isLoading,
    toggleTool,
    setLanguageModel,
    enableAllTools,
    disableAllTools,
    getEnabledToolIds,
    enabledToolCount,
    totalToolCount,
  };
};
