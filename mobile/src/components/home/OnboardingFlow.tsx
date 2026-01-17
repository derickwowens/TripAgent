import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Animated,
  Dimensions,
  SafeAreaView,
  Image,
  ImageBackground,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import { useLocation } from '../../hooks';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Background image dimensions for panning effect - extra wide for dramatic panning
const BG_WIDTH = SCREEN_WIDTH * 2.5;
const BG_HEIGHT = SCREEN_HEIGHT * 1.2;

// Profile badge options for onboarding
const TRAVEL_STYLES = [
  { id: 'frugal', label: 'Frugal' },
  { id: 'luxury', label: 'Luxury' },
  { id: 'backpacker', label: 'Backpacker' },
  { id: 'camping', label: 'Camping' },
  { id: 'hotels', label: 'Hotels' },
  { id: 'airbnb', label: 'Airbnb/VRBO' },
  { id: 'rv', label: 'RV/Camper' },
];

const INTERESTS = [
  { id: 'hiking', label: 'Hiking' },
  { id: 'photography', label: 'Photography' },
  { id: 'wildlife', label: 'Wildlife' },
  { id: 'foodie', label: 'Foodie' },
  { id: 'water', label: 'Water sports' },
  { id: 'cycling', label: 'Cycling' },
  { id: 'fishing', label: 'Fishing' },
  { id: 'stargazing', label: 'Stargazing' },
  { id: 'history', label: 'History' },
];

const TRAVEL_WITH = [
  { id: 'solo', label: 'Solo' },
  { id: 'partner', label: 'Partner' },
  { id: 'family', label: 'Family' },
  { id: 'friends', label: 'Friends' },
  { id: 'dog', label: 'With dog' },
];

// Family sub-options
const FAMILY_OPTIONS = [
  { id: 'toddlers', label: 'Kids 1-3 yrs' },
  { id: 'young-kids', label: 'Kids 4-7 yrs' },
  { id: 'older-kids', label: 'Kids 8-12 yrs' },
  { id: 'teens', label: 'Teens 13+' },
  { id: 'seniors', label: 'Seniors' },
  { id: 'accessibility', label: 'Accessibility needs' },
];

// Official US National Parks from NPS API
const NATIONAL_PARKS = [
  'Acadia', 'Arches', 'Badlands', 'Big Bend', 'Biscayne',
  'Black Canyon Of The Gunnison', 'Bryce Canyon', 'Canyonlands', 'Capitol Reef', 'Carlsbad Caverns',
  'Channel Islands', 'Congaree', 'Crater Lake', 'Cuyahoga Valley', 'Death Valley',
  'Dry Tortugas', 'Everglades', 'Gateway Arch', 'Glacier', 'Grand Canyon',
  'Grand Teton', 'Great Basin', 'Great Smoky Mountains', 'Guadalupe Mountains', 'Haleakalā',
  'Hawaiʻi Volcanoes', 'Hot Springs', 'Indiana Dunes', 'Isle Royale', 'Joshua Tree',
  'Kenai Fjords', 'Kobuk Valley', 'Lassen Volcanic', 'Mammoth Cave', 'Mesa Verde',
  'Mount Rainier', 'North Cascades', 'Olympic', 'Petrified Forest', 'Pinnacles',
  'Rocky Mountain', 'Saguaro', 'Shenandoah', 'Theodore Roosevelt', 'Virgin Islands',
  'Voyageurs', 'White Sands', 'Wind Cave', 'Yellowstone', 'Yosemite', 'Zion',
];

const getRandomPark = () => NATIONAL_PARKS[Math.floor(Math.random() * NATIONAL_PARKS.length)];

const QUICK_TRIP_IDEAS = [
  { id: 'national-park', label: 'Plan a national park trip', getPrompt: () => `Help me plan a trip to ${getRandomPark()} National Park` },
  { id: 'weekend', label: 'Weekend getaway', getPrompt: () => 'Help me plan a weekend getaway somewhere nearby' },
  { id: 'road-trip', label: 'Road trip adventure', getPrompt: () => 'Help me plan a road trip adventure' },
  { id: 'beach', label: 'Beach vacation', getPrompt: () => 'Help me find a great beach destination' },
  { id: 'custom', label: 'I have something specific in mind', getPrompt: () => '' },
];

interface OnboardingFlowProps {
  onComplete: (profile: string, firstPrompt?: string) => void;
  onSkip: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete, onSkip }) => {
  const [step, setStep] = useState(0);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  
  // Animated value for horizontal background panning
  const panX = useRef(new Animated.Value(0)).current;
  
  // Pan background horizontally when step changes
  useEffect(() => {
    // Each step moves the background to the left - dramatic pan
    const xOffset = step * -100;
    
    Animated.spring(panX, {
      toValue: xOffset,
      useNativeDriver: true,
      tension: 40,
      friction: 8,
    }).start();
  }, [step]);
  
  // Start location detection immediately when onboarding begins
  const { userLocation, locationLoading } = useLocation();
  const [selectedTravelWith, setSelectedTravelWith] = useState<string[]>([]);
  const [selectedFamilyOptions, setSelectedFamilyOptions] = useState<string[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState('');

  const toggleSelection = (
    id: string,
    selected: string[],
    setSelected: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    if (selected.includes(id)) {
      setSelected(selected.filter(s => s !== id));
    } else {
      setSelected([...selected, id]);
    }
  };

  const buildProfile = (): string => {
    const parts: string[] = [];
    
    // Add travel styles
    TRAVEL_STYLES.forEach(style => {
      if (selectedStyles.includes(style.id)) {
        parts.push(style.label);
      }
    });
    
    // Add interests
    INTERESTS.forEach(interest => {
      if (selectedInterests.includes(interest.id)) {
        parts.push(interest.label);
      }
    });
    
    // Add travel companions
    TRAVEL_WITH.forEach(tw => {
      if (selectedTravelWith.includes(tw.id)) {
        parts.push(tw.label);
      }
    });
    
    // Add family options
    FAMILY_OPTIONS.forEach(fo => {
      if (selectedFamilyOptions.includes(fo.id)) {
        parts.push(fo.label);
      }
    });
    
    return parts.join(', ');
  };

  const getFirstPrompt = (): string | undefined => {
    if (selectedTrip === 'custom' && customPrompt.trim()) {
      return customPrompt.trim();
    }
    const trip = QUICK_TRIP_IDEAS.find(t => t.id === selectedTrip);
    return trip?.getPrompt() || undefined;
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      onComplete(buildProfile(), getFirstPrompt());
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const canProceed = () => {
    // All steps are now optional - user can freely navigate
    return true;
  };

  // Swipe gesture handler
  const swipeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to horizontal swipes
        return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        const SWIPE_THRESHOLD = 50;
        if (gestureState.dx < -SWIPE_THRESHOLD && step < 3) {
          // Swipe left - go to next step
          setStep(prev => prev + 1);
        } else if (gestureState.dx > SWIPE_THRESHOLD && step > 0) {
          // Swipe right - go to previous step
          setStep(prev => prev - 1);
        }
      },
    })
  ).current;

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <View style={styles.logoContainer}>
              <Image 
                source={require('../../../assets/icon.png')} 
                style={styles.logo} 
              />
            </View>
            <Text style={styles.welcomeTitle}>TripAgent</Text>
            <Text style={styles.welcomeSubtitle}>
              AI-powered travel planning
            </Text>
            <View style={styles.featureList}>
              <View style={styles.featureRow}>
                <Text style={styles.featureText}>• National parks & destinations</Text>
              </View>
              <View style={styles.featureRow}>
                <Text style={styles.featureText}>• Flights, hotels & restaurants</Text>
              </View>
              <View style={styles.featureRow}>
                <Text style={styles.featureText}>• Complete itineraries in minutes</Text>
              </View>
            </View>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>How do you like to travel?</Text>
            <Text style={styles.stepSubtitle}>Select all that apply</Text>
            
            <Text style={styles.sectionLabel}>Travel Style</Text>
            <View style={styles.optionsGrid}>
              {TRAVEL_STYLES.map(style => (
                <TouchableOpacity
                  key={style.id}
                  style={[
                    styles.optionChip,
                    selectedStyles.includes(style.id) && styles.optionChipSelected
                  ]}
                  onPress={() => toggleSelection(style.id, selectedStyles, setSelectedStyles)}
                >
                  <Text style={[
                    styles.optionLabel,
                    selectedStyles.includes(style.id) && styles.optionLabelSelected
                  ]}>{style.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Interests</Text>
            <View style={styles.optionsGrid}>
              {INTERESTS.map(interest => (
                <TouchableOpacity
                  key={interest.id}
                  style={[
                    styles.optionChip,
                    selectedInterests.includes(interest.id) && styles.optionChipSelected
                  ]}
                  onPress={() => toggleSelection(interest.id, selectedInterests, setSelectedInterests)}
                >
                  <Text style={[
                    styles.optionLabel,
                    selectedInterests.includes(interest.id) && styles.optionLabelSelected
                  ]}>{interest.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 2:
        const showFamilyOptions = selectedTravelWith.includes('family');
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Who are you traveling with?</Text>
            <Text style={styles.stepSubtitle}>This helps us tailor recommendations</Text>
            
            <View style={styles.optionsGrid}>
              {TRAVEL_WITH.map(tw => (
                <TouchableOpacity
                  key={tw.id}
                  style={[
                    styles.optionChip,
                    selectedTravelWith.includes(tw.id) && styles.optionChipSelected
                  ]}
                  onPress={() => toggleSelection(tw.id, selectedTravelWith, setSelectedTravelWith)}
                >
                  <Text style={[
                    styles.optionLabel,
                    selectedTravelWith.includes(tw.id) && styles.optionLabelSelected
                  ]}>{tw.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {showFamilyOptions && (
              <>
                <Text style={styles.sectionLabel}>Family Details</Text>
                <View style={styles.optionsGrid}>
                  {FAMILY_OPTIONS.map(fo => (
                    <TouchableOpacity
                      key={fo.id}
                      style={[
                        styles.optionChipSmall,
                        selectedFamilyOptions.includes(fo.id) && styles.optionChipSelected
                      ]}
                      onPress={() => toggleSelection(fo.id, selectedFamilyOptions, setSelectedFamilyOptions)}
                    >
                      <Text style={[
                        styles.optionLabelSmall,
                        selectedFamilyOptions.includes(fo.id) && styles.optionLabelSelected
                      ]}>{fo.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Ready to plan your first trip?</Text>
            <Text style={styles.stepSubtitle}>Choose a starting point</Text>
            
            <View style={styles.tripOptions}>
              {QUICK_TRIP_IDEAS.map(trip => (
                <TouchableOpacity
                  key={trip.id}
                  style={[
                    styles.tripOption,
                    selectedTrip === trip.id && styles.tripOptionSelected
                  ]}
                  onPress={() => setSelectedTrip(trip.id)}
                >
                  <Text style={[
                    styles.tripOptionText,
                    selectedTrip === trip.id && styles.tripOptionTextSelected
                  ]}>{trip.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedTrip === 'custom' && (
              <TextInput
                style={styles.customInput}
                placeholder="What kind of trip are you dreaming of?"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={customPrompt}
                onChangeText={setCustomPrompt}
                multiline
              />
            )}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.background}>
      <Animated.Image
        source={{ uri: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=3840&q=80' }}
        style={[
          styles.backgroundImage,
          {
            transform: [
              { translateX: panX },
            ],
          },
        ]}
        resizeMode="cover"
      />
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          {/* Progress indicator */}
          <View style={styles.progressContainer}>
            {[0, 1, 2, 3].map(i => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  i <= step && styles.progressDotActive
                ]}
              />
            ))}
          </View>


          <View style={styles.swipeContainer} {...swipeResponder.panHandlers}>
            <ScrollView 
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {renderStep()}
            </ScrollView>
          </View>

          {/* Navigation buttons */}
          <View style={styles.navButtons}>
            {step > 0 && (
              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.nextButton,
                !canProceed() && styles.nextButtonDisabled
              ]}
              onPress={handleNext}
              disabled={!canProceed()}
            >
              <Text style={styles.nextButtonText}>
                {step === 3 ? "Let's Go!" : step === 0 ? 'Setup Traveler Profile' : 'Next'}
              </Text>
            </TouchableOpacity>
          </View>
          {/* Skip button - shown on all steps */}
          {step === 0 ? (
            <TouchableOpacity style={styles.skipOnboarding} onPress={onSkip}>
              <Text style={styles.skipOnboardingText}>Skip for now</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.skipOnboardingCentered} onPress={onSkip}>
              <Text style={styles.skipOnboardingText}>Skip</Text>
            </TouchableOpacity>
          )}
        </SafeAreaView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    overflow: 'hidden',
  },
  backgroundImage: {
    position: 'absolute',
    width: BG_WIDTH,
    height: BG_HEIGHT,
    top: -(BG_HEIGHT - SCREEN_HEIGHT) / 2,
    left: -(BG_WIDTH - SCREEN_WIDTH) / 2,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  container: {
    flex: 1,
  },
  swipeContainer: {
    flex: 1,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 16,
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressDotActive: {
    backgroundColor: '#22C55E',
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1,
  },
  skipText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 90,
    paddingBottom: 20,
  },
  stepContent: {
    flex: 1,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
  },
  welcomeTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: '#22C55E',
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 32,
  },
  featureList: {
    backgroundColor: 'rgba(22, 101, 52, 0.2)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  featureIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#FFFFFF',
    flex: 1,
  },
  featureItem: {
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: 12,
    lineHeight: 22,
  },
  stepHint: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 16,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  optionChipSelected: {
    backgroundColor: 'rgba(22, 101, 52, 0.6)',
    borderColor: '#22C55E',
  },
  optionIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  optionLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  optionLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  optionChipSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  optionIconSmall: {
    fontSize: 14,
    marginRight: 4,
  },
  optionLabelSmall: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  tripOptions: {
    gap: 12,
  },
  tripOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  tripOptionSelected: {
    backgroundColor: 'rgba(22, 101, 52, 0.6)',
    borderColor: '#22C55E',
  },
  tripOptionText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  tripOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  customInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    color: '#FFFFFF',
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  navButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 12,
  },
  backButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  nextButton: {
    width: '50%',
    backgroundColor: '#166534',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: 'rgba(22, 101, 52, 0.4)',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  skipOnboarding: {
    alignItems: 'center',
    paddingBottom: 74,
  },
  skipOnboardingCentered: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 144,
  },
  skipOnboardingText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
  },
});

export default OnboardingFlow;
