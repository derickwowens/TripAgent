import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions, Linking, ScrollView, Image, KeyboardAvoidingView, Platform } from 'react-native';
import Slider from '@react-native-community/slider';
import Constants from 'expo-constants';
import { ProfileSection } from './ProfileSection';
import { ConversationList } from './ConversationList';
import { ToolSettingsPanel } from './ToolSettingsPanel';
import { ThemedLogo } from './ThemedLogo';
import { SavedConversation, useDarkModeContext, ToolSettings, MaxTravelDistance, useParkTheme } from '../../hooks';
import { getWhitelistedParkNames } from '../../utils/parkDistanceFilter';
import { fetchStateParks, StateParkSummary } from '../../services/api';

// Distance slider presets (in miles) - for National Parks mode
const DISTANCE_PRESETS = [
  50, 100, 150, 200, 250, 300, 350, 400, 450, 500,
  600, 700, 800, 900, 1000,
  1500, 2000, 2500, 3000, 4000, 5000,
];

// State Parks distance presets (shorter range - state level, up to 500 miles)
const STATE_DISTANCE_PRESETS = [10, 25, 50, 75, 100, 150, 200, 300, 400, 500];

// State name to code mapping for API calls
const STATE_NAME_TO_CODE: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
  'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
  'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
  'District of Columbia': 'DC',
};

const getStateCode = (stateName: string): string => {
  return STATE_NAME_TO_CODE[stateName] || stateName;
};

const stateSliderValueToDistance = (value: number): number | null => {
  if (value >= STATE_DISTANCE_PRESETS.length) return null;
  return STATE_DISTANCE_PRESETS[Math.round(value)];
};

const stateDistanceToSliderValue = (distance: number | null): number => {
  if (distance === null) return STATE_DISTANCE_PRESETS.length;
  const index = STATE_DISTANCE_PRESETS.indexOf(distance);
  return index >= 0 ? index : STATE_DISTANCE_PRESETS.length;
};

const getStateDistanceDisplayText = (distance: number | null): string => {
  if (distance === null) return 'All';
  return `${distance} miles`;
};

const sliderValueToDistance = (value: number): MaxTravelDistance => {
  if (value >= DISTANCE_PRESETS.length) return null;
  return DISTANCE_PRESETS[Math.round(value)];
};

const distanceToSliderValue = (distance: MaxTravelDistance): number => {
  if (distance === null) return DISTANCE_PRESETS.length;
  const index = DISTANCE_PRESETS.indexOf(distance);
  return index >= 0 ? index : DISTANCE_PRESETS.length;
};

const getDistanceDisplayText = (distance: MaxTravelDistance): string => {
  if (distance === null) return 'Unlimited';
  if (distance >= 1000) return `${(distance / 1000).toFixed(distance % 1000 === 0 ? 0 : 1)}k miles`;
  return `${distance} miles`;
};

const APP_VERSION = Constants.expoConfig?.version || '1.0.0';
const BUILD_SUFFIX = process.env.EXPO_PUBLIC_BUILD_SUFFIX || '';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DarkModeToggle: React.FC<{ theme: any }> = ({ theme }) => {
  const { isDarkMode, toggleDarkMode } = useDarkModeContext();
  
  return (
    <TouchableOpacity 
      style={[styles.darkModeToggle, { backgroundColor: theme.buttonBackgroundLight }]} 
      onPress={toggleDarkMode}
      activeOpacity={0.7}
    >
      <Text style={styles.darkModeIcon}>{isDarkMode ? '☀️' : '🌙'}</Text>
    </TouchableOpacity>
  );
};

// Park mode type
export type ParkMode = 'national' | 'state';

interface SideMenuProps {
  visible: boolean;
  onClose: () => void;
  userProfile: string;
  onSaveProfile: (profile: string) => void;
  onAddProfileSuggestion: (suggestion: string) => void;
  conversations: SavedConversation[];
  currentConversationId: string | null;
  onLoadConversation: (conversation: SavedConversation) => void;
  onDeleteConversation: (id: string) => void;
  onNewConversation: () => void;
  onUpdateConversation: (id: string, updates: { title?: string; description?: string }) => void;
  onToggleFavorite?: (id: string) => void;
  onResetOnboarding?: () => void;
  // Park mode props
  parkMode?: ParkMode;
  onParkModeChange?: (mode: ParkMode) => void;
  // Tool settings props
  toolSettings?: ToolSettings;
  onToggleTool?: (toolId: string) => void;
  onSetLanguageModel?: (model: ToolSettings['languageModel']) => void;
  onEnableAllTools?: () => void;
  onDisableAllTools?: () => void;
  enabledToolCount?: number;
  totalToolCount?: number;
  // Travel distance props
  maxTravelDistance?: MaxTravelDistance;
  onUpdateMaxTravelDistance?: (distance: MaxTravelDistance) => void;
  // Location for park filtering
  userLocation?: { lat: number; lng: number; state?: string } | null;
}

export const SideMenu: React.FC<SideMenuProps> = ({
  visible,
  onClose,
  userProfile,
  onSaveProfile,
  onAddProfileSuggestion,
  conversations,
  currentConversationId,
  onLoadConversation,
  onDeleteConversation,
  onNewConversation,
  onUpdateConversation,
  onToggleFavorite,
  onResetOnboarding,
  parkMode = 'national',
  onParkModeChange,
  toolSettings,
  onToggleTool,
  onSetLanguageModel,
  onEnableAllTools,
  onDisableAllTools,
  enabledToolCount = 0,
  totalToolCount = 0,
  maxTravelDistance,
  onUpdateMaxTravelDistance,
  userLocation,
}) => {
  const { isDarkMode } = useDarkModeContext();
  const { theme, isStateMode } = useParkTheme();
  const [showToolSettings, setShowToolSettings] = useState(false);
  const [parksExpanded, setParksExpanded] = useState(false);
  // Preview value for slider during drag (avoids recalculating parks on every tick)
  const [sliderPreview, setSliderPreview] = useState<MaxTravelDistance | null>(null);
  
  // State parks data and UI state
  const [stateParks, setStateParks] = useState<StateParkSummary[]>([]);
  const [stateParksLoading, setStateParksLoading] = useState(false);
  const [stateParksExpanded, setStateParksExpanded] = useState(false);
  const [stateParksDistance, setStateParksDistance] = useState<number | null>(50); // Default 50 miles

  // Calculate whitelisted parks based on user location and max travel distance (National Parks mode)
  const whitelistedParks = useMemo(() => {
    if (isStateMode) return [];
    return getWhitelistedParkNames(userLocation?.lat, userLocation?.lng, maxTravelDistance ?? null);
  }, [userLocation?.lat, userLocation?.lng, maxTravelDistance, isStateMode]);

  // Fetch state parks when in State Parks mode and user has a state
  useEffect(() => {
    if (isStateMode && userLocation?.state) {
      const stateCode = getStateCode(userLocation.state);
      console.log('Fetching state parks for:', userLocation.state, '-> code:', stateCode);
      setStateParksLoading(true);
      fetchStateParks(stateCode, 30)
        .then(parks => {
          console.log('Fetched state parks:', parks.length);
          setStateParks(parks);
        })
        .finally(() => setStateParksLoading(false));
    }
  }, [isStateMode, userLocation?.state]);
  
  // Display value shows preview during drag, actual value otherwise
  const displayDistance = sliderPreview !== null ? sliderPreview : (maxTravelDistance ?? null);
  
  const handleLoadConversation = (conv: SavedConversation) => {
    onLoadConversation(conv);
    onClose();
  };

  const handleNewConversation = () => {
    onNewConversation();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.overlay}>
          <View style={styles.menu}>
          {/* Fixed Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <ThemedLogo size={36} />
              <TouchableOpacity 
                style={[styles.feedbackButton, { backgroundColor: theme.buttonBackgroundLight, borderColor: theme.primaryMedium }]} 
                onPress={() => Linking.openURL(`https://travel-buddy-api-production.up.railway.app/public/survey.html?version=${APP_VERSION}`)}
              >
                <Text style={styles.feedbackText}>Feedback</Text>
              </TouchableOpacity>
              <Text style={styles.versionText}>v{APP_VERSION}{BUILD_SUFFIX}</Text>
            </View>
            <View style={styles.headerRight}>
              <DarkModeToggle theme={theme} />
              <TouchableOpacity onPress={onClose} style={styles.closeButtonContainer}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Scrollable Content */}
          <ScrollView 
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContentContainer}
            showsVerticalScrollIndicator={true}
            indicatorStyle="white"
            keyboardShouldPersistTaps="handled"
          >
            {/* Park Mode Toggle */}
            {onParkModeChange && (
              <View style={styles.parkModeContainer}>
                <Text style={styles.parkModeLabel}>Park Mode</Text>
                <View style={styles.parkModeButtons}>
                  <TouchableOpacity
                    style={[
                      styles.parkModeButton,
                      parkMode === 'national' && styles.parkModeButtonActive,
                    ]}
                    onPress={() => onParkModeChange('national')}
                  >
                    <Text style={[
                      styles.parkModeButtonText,
                      parkMode === 'national' && styles.parkModeButtonTextActive,
                    ]}>National Parks</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.parkModeButton,
                      parkMode === 'state' && styles.parkModeButtonActiveState,
                    ]}
                    onPress={() => onParkModeChange('state')}
                  >
                    <Text style={[
                      styles.parkModeButtonText,
                      parkMode === 'state' && styles.parkModeButtonTextActiveState,
                    ]}>State Parks</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <ProfileSection
              userProfile={userProfile}
              onSaveProfile={onSaveProfile}
              onAddSuggestion={onAddProfileSuggestion}
              onResetOnboarding={onResetOnboarding}
              onOpenToolSettings={toolSettings ? () => setShowToolSettings(true) : undefined}
            />

            {/* State Parks - show in State Parks mode based on user's state */}
            {isStateMode && (
              <View style={styles.distanceSection}>
                <View style={styles.distanceHeader}>
                  <Text style={styles.distanceLabel}>State Parks Near You</Text>
                  <Text style={[styles.distanceValue, { color: theme.primary }]}>
                    {stateParksLoading ? 'Loading...' : `${stateParks.length} parks`}
                  </Text>
                </View>
                <Slider
                  style={styles.distanceSlider}
                  minimumValue={0}
                  maximumValue={STATE_DISTANCE_PRESETS.length}
                  step={1}
                  value={stateDistanceToSliderValue(stateParksDistance)}
                  onValueChange={(value) => setStateParksDistance(stateSliderValueToDistance(value))}
                  minimumTrackTintColor={theme.sliderTrack}
                  maximumTrackTintColor="rgba(255,255,255,0.2)"
                  thumbTintColor={theme.sliderThumb}
                />
                <View style={styles.distanceLabelsRow}>
                  <Text style={styles.distanceLabelSmall}>10 mi</Text>
                  <Text style={styles.distanceLabelSmall}>500 mi</Text>
                </View>

                {/* State Parks List */}
                {stateParks.length > 0 && (
                  <>
                    <TouchableOpacity 
                      style={styles.parksHeader}
                      onPress={() => setStateParksExpanded(!stateParksExpanded)}
                    >
                      <Text style={styles.parksHeaderText}>
                        {stateParksExpanded ? '▼' : '▶'} {userLocation?.state || 'State'} Parks ({stateParks.length})
                      </Text>
                    </TouchableOpacity>
                    {stateParksExpanded && (
                      <View style={styles.parksContainer}>
                        <View style={styles.parksGrid}>
                          {stateParks.map((park: StateParkSummary, index: number) => (
                            <View 
                              key={park.id || index} 
                              style={[
                                styles.parkChip,
                                { 
                                  backgroundColor: theme.chipBackground,
                                  borderColor: theme.chipBorder,
                                }
                              ]}
                            >
                              <Text style={[styles.parkChipText, { color: theme.chipText }]}>
                                {park.name}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </>
                )}
              </View>
            )}

            {/* Max Travel Distance - only show in National Parks mode */}
            {onUpdateMaxTravelDistance && !isStateMode && (
              <View style={styles.distanceSection}>
                <View style={styles.distanceHeader}>
                  <Text style={styles.distanceLabel}>Max Travel Distance</Text>
                  <Text style={[styles.distanceValue, { color: theme.primary }]}>{getDistanceDisplayText(displayDistance)}</Text>
                </View>
                <Slider
                  style={styles.distanceSlider}
                  minimumValue={0}
                  maximumValue={DISTANCE_PRESETS.length}
                  step={1}
                  value={distanceToSliderValue(maxTravelDistance ?? null)}
                  onValueChange={(value) => setSliderPreview(sliderValueToDistance(value))}
                  onSlidingComplete={(value) => {
                    setSliderPreview(null);
                    onUpdateMaxTravelDistance(sliderValueToDistance(value));
                  }}
                  minimumTrackTintColor={theme.sliderTrack}
                  maximumTrackTintColor="rgba(255,255,255,0.2)"
                  thumbTintColor={theme.sliderThumb}
                />
                <View style={styles.distanceLabelsRow}>
                  <Text style={styles.distanceLabelSmall}>50 mi</Text>
                  <Text style={styles.distanceLabelSmall}>Unlimited</Text>
                </View>

                {/* Parks Included - only show when not unlimited */}
                {maxTravelDistance !== null && maxTravelDistance !== undefined && (
                  <>
                    <TouchableOpacity 
                      style={styles.parksHeader}
                      onPress={() => setParksExpanded(!parksExpanded)}
                    >
                      <Text style={styles.parksHeaderText}>
                        {parksExpanded ? '▼' : '▶'} Parks Included ({whitelistedParks.length})
                      </Text>
                    </TouchableOpacity>
                    {parksExpanded && (
                      <View style={styles.parksContainer}>
                        {whitelistedParks.length > 0 ? (
                          <View style={styles.parksGrid}>
                            {whitelistedParks.map((park, index) => (
                              <View 
                                key={index} 
                                style={[
                                  styles.parkChip,
                                  { 
                                    backgroundColor: theme.chipBackground,
                                    borderColor: theme.chipBorder,
                                  }
                                ]}
                              >
                                <Text style={[styles.parkChipText, { color: theme.chipText }]}>{park}</Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.noParksText}>
                            No parks within {getDistanceDisplayText(maxTravelDistance)}. Try increasing your travel distance.
                          </Text>
                        )}
                      </View>
                    )}
                  </>
                )}
              </View>
            )}

            {/* Separator */}
            <View style={styles.sectionSeparator} />

            <TouchableOpacity 
              style={[styles.newChatButton, { backgroundColor: theme.buttonBackground }]} 
              onPress={handleNewConversation}
            >
              <ThemedLogo size={20} />
              <Text style={styles.newChatText}>New Trip</Text>
            </TouchableOpacity>

            {/* Separator */}
            <View style={styles.sectionSeparator} />

            <ConversationList
              conversations={conversations}
              currentConversationId={currentConversationId}
              onLoadConversation={handleLoadConversation}
              onDeleteConversation={onDeleteConversation}
              onUpdateConversation={onUpdateConversation}
              onToggleFavorite={onToggleFavorite}
            />
          </ScrollView>
          </View>
          <TouchableOpacity 
            style={styles.backdrop} 
            onPress={onClose}
            activeOpacity={1}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Tool Settings Panel - overlays the menu */}
      {toolSettings && onToggleTool && onSetLanguageModel && onEnableAllTools && onDisableAllTools && (
        <ToolSettingsPanel
          visible={showToolSettings}
          onClose={() => setShowToolSettings(false)}
          settings={toolSettings}
          onToggleTool={onToggleTool}
          onSetLanguageModel={onSetLanguageModel}
          onEnableAll={onEnableAllTools}
          onDisableAll={onDisableAllTools}
          enabledCount={enabledToolCount}
          totalCount={totalToolCount}
        />
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingContainer: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  menu: {
    width: SCREEN_WIDTH * 0.8,
    backgroundColor: '#1a1a2e',
    height: '100%',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 40,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  closeButton: {
    fontSize: 24,
    color: 'rgba(255,255,255,0.7)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  darkModeToggle: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(22, 101, 52, 0.4)',
  },
  darkModeIcon: {
    fontSize: 18,
  },
  feedbackButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(22, 101, 52, 0.4)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(22, 101, 52, 0.5)',
  },
  feedbackText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '500',
  },
  versionText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '400',
    marginLeft: 8,
  },
  closeButtonContainer: {
    padding: 4,
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(22, 101, 52, 0.9)',
    borderRadius: 10,
    gap: 8,
  },
  newChatIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  newChatText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionSeparator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 16,
    marginVertical: 8,
  },
  distanceSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  distanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  distanceLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
  },
  distanceValue: {
    color: '#22C55E',
    fontSize: 12,
    fontWeight: '600',
  },
  distanceSlider: {
    width: '100%',
    height: 40,
  },
  distanceLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -8,
  },
  distanceLabelSmall: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
  },
  parksHeader: {
    marginTop: 12,
    paddingVertical: 6,
  },
  parksHeaderText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  parksContainer: {
    marginTop: 6,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
  },
  parksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  parkChip: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  parkChipText: {
    color: 'rgba(34, 197, 94, 0.9)',
    fontSize: 10,
    fontWeight: '500',
  },
  noParksText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  parkModeContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  parkModeLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
  parkModeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  parkModeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  parkModeButtonActive: {
    borderColor: '#22C55E',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  parkModeButtonActiveState: {
    borderColor: '#8B5A2B',
    backgroundColor: 'rgba(139, 90, 43, 0.2)',
  },
  parkModeButtonText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '500',
  },
  parkModeButtonTextActive: {
    color: '#22C55E',
  },
  parkModeButtonTextActiveState: {
    color: '#CD853F',
  },
});
