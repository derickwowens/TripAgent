import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions, Linking, ScrollView, Image, KeyboardAvoidingView, Platform } from 'react-native';
import Slider from '@react-native-community/slider';
import Constants from 'expo-constants';
import { ProfileSection } from './ProfileSection';
import { ConversationList } from './ConversationList';
import { ToolSettingsPanel } from './ToolSettingsPanel';
import { SavedConversation, useDarkModeContext, ToolSettings, MaxTravelDistance } from '../../hooks';
import { getWhitelistedParkNames } from '../../utils/parkDistanceFilter';

// Distance slider presets (in miles) - same as ProfileSection
const DISTANCE_PRESETS = [
  50, 100, 150, 200, 250, 300, 350, 400, 450, 500,
  600, 700, 800, 900, 1000,
  1500, 2000, 2500, 3000, 4000, 5000,
];

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

const DarkModeToggle: React.FC = () => {
  const { isDarkMode, toggleDarkMode } = useDarkModeContext();
  
  return (
    <TouchableOpacity 
      style={styles.darkModeToggle} 
      onPress={toggleDarkMode}
      activeOpacity={0.7}
    >
      <Text style={styles.darkModeIcon}>{isDarkMode ? '☀️' : '🌙'}</Text>
    </TouchableOpacity>
  );
};

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
  userLocation?: { lat: number; lng: number } | null;
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
  const [showToolSettings, setShowToolSettings] = useState(false);
  const [parksExpanded, setParksExpanded] = useState(false);
  // Preview value for slider during drag (avoids recalculating parks on every tick)
  const [sliderPreview, setSliderPreview] = useState<MaxTravelDistance | null>(null);

  // Calculate whitelisted parks based on user location and max travel distance
  // Only recalculates when actual maxTravelDistance changes (not during drag)
  const whitelistedParks = useMemo(() => {
    return getWhitelistedParkNames(userLocation?.lat, userLocation?.lng, maxTravelDistance ?? null);
  }, [userLocation?.lat, userLocation?.lng, maxTravelDistance]);
  
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
              <Image 
                source={require('../../../assets/icon.png')} 
                style={styles.logo}
                resizeMode="contain"
              />
              <TouchableOpacity 
                style={styles.feedbackButton} 
                onPress={() => Linking.openURL(`https://travel-buddy-api-production.up.railway.app/public/survey.html?version=${APP_VERSION}`)}
              >
                <Text style={styles.feedbackText}>Feedback</Text>
              </TouchableOpacity>
              <Text style={styles.versionText}>v{APP_VERSION}{BUILD_SUFFIX}</Text>
            </View>
            <View style={styles.headerRight}>
              <DarkModeToggle />
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
            <ProfileSection
              userProfile={userProfile}
              onSaveProfile={onSaveProfile}
              onAddSuggestion={onAddProfileSuggestion}
              onResetOnboarding={onResetOnboarding}
              onOpenToolSettings={toolSettings ? () => setShowToolSettings(true) : undefined}
            />

            {/* Max Travel Distance - standalone slider below profile */}
            {onUpdateMaxTravelDistance && (
              <View style={styles.distanceSection}>
                <View style={styles.distanceHeader}>
                  <Text style={styles.distanceLabel}>Max Travel Distance</Text>
                  <Text style={styles.distanceValue}>{getDistanceDisplayText(displayDistance)}</Text>
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
                  minimumTrackTintColor="#22C55E"
                  maximumTrackTintColor="rgba(255,255,255,0.2)"
                  thumbTintColor="#22C55E"
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
                              <View key={index} style={styles.parkChip}>
                                <Text style={styles.parkChipText}>{park}</Text>
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

            <TouchableOpacity style={styles.newChatButton} onPress={handleNewConversation}>
              <Image 
                source={require('../../../assets/icon.png')} 
                style={styles.newChatIcon}
                resizeMode="contain"
              />
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
});
