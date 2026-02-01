import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Pressable, Alert, Platform } from 'react-native';
import Slider from '@react-native-community/slider';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { MaxTravelDistance, useParkTheme } from '../../hooks';
import { APP_NAME } from '../../utils/appName';

// Define mutually exclusive groups
const EXCLUSIVE_GROUPS = {
  gender: ['Male', 'Female'],
  vehicle: ['Gas vehicle', 'Tesla', 'Other EV'],
  climate: ['Warm destinations', 'Cold destinations'],
  airline: ['Delta', 'Southwest', 'United', 'American', 'JetBlue', 'Alaska'],
  carRental: ['Hertz', 'Enterprise', 'National', 'Budget'],
  hotel: ['Marriott', 'Hilton', 'IHG', 'Hyatt', 'Airbnb/VRBO'],
};

// Foodie-specific preferences
const FOODIE_PREFERENCES = [
  // Cuisine types
  'Local cuisine lover',
  'Fine dining',
  'Casual eats',
  'Street food fan',
  'Farm-to-table',
  // Dietary
  'Vegetarian',
  'Vegan',
  'Gluten-free',
  'No dietary restrictions',
  // Meal preferences
  'Breakfast enthusiast',
  'Brunch lover',
  'Dinner reservations',
  // Experience
  'Food tours',
  'Cooking classes',
  'Wine/beer tastings',
  // Budget
  'Budget eats',
  'Splurge-worthy meals',
  // Style
  'Instagram-worthy spots',
  'Hidden gems',
  'Historic restaurants',
  'Scenic dining',
];

// Coffee hound preferences
const COFFEE_PREFERENCES = [
  'Local roasters',
  'Specialty coffee',
  'Cozy cafe vibes',
  'Coffee with a view',
  'Early morning coffee runs',
  'Espresso lover',
  'Cold brew fan',
  'Coffee shop workspaces',
];

// Book worm preferences
const BOOKWORM_PREFERENCES = [
  'Independent bookshops',
  'Used bookstores',
  'Library visits',
  'Literary landmarks',
  'Author home tours',
  'Reading cafes',
  'Book festivals',
  'Quiet reading spots',
];

// Historian preferences
const HISTORIAN_PREFERENCES = [
  'Battlefields & monuments',
  'Historic homes & estates',
  'Museums & exhibits',
  'Archaeological sites',
  'Historic districts',
  'Ghost towns',
  'Native American heritage',
  'Colonial history',
  'Civil War sites',
  'Pioneer & frontier history',
  'Industrial heritage',
  'Maritime history',
];

// Profile suggestions with display labels and clear profile text for Claude
const PROFILE_SUGGESTIONS: Array<{ label: string; profileText: string }> = [
  // Gender (mutually exclusive)
  { label: 'Male', profileText: 'I am male' },
  { label: 'Female', profileText: 'I am female' },
  // Family/Kids
  { label: 'Kids 1-3 yrs', profileText: 'I have toddlers (ages 1-3) and need kid-friendly, stroller-accessible options' },
  { label: 'Kids 4-7 yrs', profileText: 'I have young children (ages 4-7) who need engaging but manageable activities' },
  { label: 'Kids 8-12 yrs', profileText: 'I have older kids (ages 8-12) who can handle moderate hikes and activities' },
  { label: 'Kids 13+', profileText: 'I have teenagers who can participate in more challenging activities' },
  // Vehicle (mutually exclusive)
  { label: 'Gas vehicle', profileText: 'I drive a gas-powered vehicle' },
  { label: 'Tesla', profileText: 'I drive a Tesla and need Supercharger stations along my route' },
  { label: 'Other EV', profileText: 'I drive an electric vehicle (non-Tesla) and need EV charging stations' },
  // Climate preference (mutually exclusive)
  { label: 'Warm destinations', profileText: 'I prefer warm weather destinations' },
  { label: 'Cold destinations', profileText: 'I prefer cold weather destinations' },
  // Travel style
  { label: 'Avoid crowds', profileText: 'I prefer to avoid crowded tourist areas and seek quieter experiences' },
  { label: 'Frugal traveler', profileText: 'I am a budget-conscious traveler who prefers affordable options' },
  { label: 'Luxury travel', profileText: 'I prefer luxury travel experiences and upscale accommodations' },
  { label: 'Backpacker', profileText: 'I am a backpacker who enjoys adventure travel and budget accommodations' },
  { label: 'Love camping', profileText: 'I love camping and prefer campgrounds over hotels when possible' },
  { label: 'Hotels only', profileText: 'I only stay in hotels, not campgrounds or hostels' },
  // Interests
  { label: 'Hiking/outdoors', profileText: 'I am an outdoor enthusiast who loves hiking' },
  { label: 'Photography', profileText: 'I am a photography enthusiast interested in scenic viewpoints and photo opportunities' },
  { label: 'Wildlife viewing', profileText: 'I enjoy wildlife viewing and want to see animals in their natural habitat' },
  { label: 'Cycling', profileText: 'I enjoy cycling and biking trails' },
  { label: 'Fishing', profileText: 'I enjoy fishing and want fishing spot recommendations' },
  { label: 'Skiing/snowboard', profileText: 'I enjoy skiing and snowboarding' },
  { label: 'Water sports', profileText: 'I enjoy water sports like kayaking, swimming, and water activities' },
  { label: 'Sunrise/sunset', profileText: 'I love watching sunrises and sunsets and want the best viewpoints' },
  { label: 'Foodie', profileText: 'I am a foodie who loves exploring local cuisine and notable restaurants' },
  { label: 'Coffee hound', profileText: 'I am a coffee enthusiast who seeks out local coffee shops and roasters' },
  { label: 'Book worm', profileText: 'I am a book lover interested in bookshops and literary destinations' },
  { label: 'Historian', profileText: 'I am a history enthusiast interested in historical sites and museums' },
  // Physical/Accessibility
  { label: 'Traveling with dog', profileText: 'I am traveling with my dog and need pet-friendly accommodations and activities' },
  { label: 'Accessible needs', profileText: 'I have accessibility requirements and need ADA-compliant facilities' },
  { label: 'Limited mobility', profileText: 'Someone in my group has limited mobility and needs easier walking options' },
  { label: 'With seniors', profileText: 'I am traveling with seniors who may need easier trails and accessible facilities' },
  { label: 'Educational trips', profileText: 'I want educational experiences for learning opportunities' },
  // Airlines (mutually exclusive)
  { label: 'Delta', profileText: 'I prefer Delta Air Lines for flights' },
  { label: 'Southwest', profileText: 'I prefer Southwest Airlines for flights' },
  { label: 'United', profileText: 'I prefer United Airlines for flights' },
  { label: 'American', profileText: 'I prefer American Airlines for flights' },
  { label: 'JetBlue', profileText: 'I prefer JetBlue Airways for flights' },
  { label: 'Alaska', profileText: 'I prefer Alaska Airlines for flights' },
  // Car rentals (mutually exclusive)
  { label: 'Hertz', profileText: 'I prefer Hertz for car rentals' },
  { label: 'Enterprise', profileText: 'I prefer Enterprise Rent-A-Car' },
  { label: 'National', profileText: 'I prefer National Car Rental' },
  { label: 'Budget', profileText: 'I prefer Budget Car Rental' },
  // Hotels (mutually exclusive)
  { label: 'Marriott', profileText: 'I prefer Marriott hotels' },
  { label: 'Hilton', profileText: 'I prefer Hilton hotels' },
  { label: 'IHG', profileText: 'I prefer IHG hotels (Holiday Inn, InterContinental, etc.)' },
  { label: 'Hyatt', profileText: 'I prefer Hyatt hotels' },
  { label: 'Airbnb/VRBO', profileText: 'I prefer vacation rentals like Airbnb or VRBO over traditional hotels' },
];

// Distance slider presets (in miles)
// Below 500: 50mi increments, 500-1000: 100mi increments, above 1000: larger steps
// Max ~5000 miles covers continental US to Hawaii/Alaska
const DISTANCE_PRESETS = [
  // 50mi increments below 500
  { value: 50, label: '50 mi' },
  { value: 100, label: '100 mi' },
  { value: 150, label: '150 mi' },
  { value: 200, label: '200 mi' },
  { value: 250, label: '250 mi' },
  { value: 300, label: '300 mi' },
  { value: 350, label: '350 mi' },
  { value: 400, label: '400 mi' },
  { value: 450, label: '450 mi' },
  { value: 500, label: '500 mi' },
  // 100mi increments from 500-1000
  { value: 600, label: '600 mi' },
  { value: 700, label: '700 mi' },
  { value: 800, label: '800 mi' },
  { value: 900, label: '900 mi' },
  { value: 1000, label: '1,000 mi' },
  // Larger increments above 1000
  { value: 1500, label: '1,500 mi' },
  { value: 2000, label: '2,000 mi' },
  { value: 2500, label: '2,500 mi' },
  { value: 3000, label: '3,000 mi' },
  { value: 4000, label: '4,000 mi' },
  { value: 5000, label: '5,000 mi' },
];

export interface TravelDates {
  departure?: string; // ISO date string YYYY-MM-DD
  return?: string;    // ISO date string YYYY-MM-DD
}

// Helper functions for date handling
const formatDateForDisplay = (isoDate: string): string => {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${month}/${day}/${year}`;
};

const parseDateInput = (input: string): string | null => {
  // Handle MM/DD/YYYY format
  const parts = input.replace(/[^0-9/]/g, '').split('/');
  if (parts.length === 3 && parts[0].length <= 2 && parts[1].length <= 2 && parts[2].length === 4) {
    const month = parts[0].padStart(2, '0');
    const day = parts[1].padStart(2, '0');
    const year = parts[2];
    const monthNum = parseInt(month);
    const dayNum = parseInt(day);
    if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
      return `${year}-${month}-${day}`;
    }
  }
  return null;
};

const calculateTripDuration = (departure: string, returnDate: string): string => {
  const start = new Date(departure);
  const end = new Date(returnDate);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'Invalid dates';
  if (diffDays === 0) return 'Same day trip';
  if (diffDays === 1) return '1 night';
  return `${diffDays} nights`;
};

interface ProfileSectionProps {
  userProfile: string;
  onSaveProfile: (profile: string) => void;
  onAddSuggestion: (suggestion: string) => void;
  onResetOnboarding?: () => void;
  onOpenToolSettings?: () => void;
  maxTravelDistance?: MaxTravelDistance;
  onUpdateMaxTravelDistance?: (distance: MaxTravelDistance) => void;
  travelDates?: TravelDates;
  onUpdateTravelDates?: (dates: TravelDates) => void;
}

export const ProfileSection: React.FC<ProfileSectionProps> = ({
  userProfile,
  onSaveProfile,
  onAddSuggestion,
  onResetOnboarding,
  onOpenToolSettings,
  maxTravelDistance,
  onUpdateMaxTravelDistance,
  travelDates,
  onUpdateTravelDates,
}) => {
  const { theme } = useParkTheme();
  // Always start collapsed
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [foodieExpanded, setFoodieExpanded] = useState(false);
  const [coffeeExpanded, setCoffeeExpanded] = useState(false);
  const [bookwormExpanded, setBookwormExpanded] = useState(false);
  const [historianExpanded, setHistorianExpanded] = useState(false);
  
  // Date picker state
  const [showDeparturePicker, setShowDeparturePicker] = useState(false);
  const [showReturnPicker, setShowReturnPicker] = useState(false);

  // Check if user has special badges selected
  const isFoodie = userProfile.toLowerCase().includes('foodie');
  const isCoffeeHound = userProfile.toLowerCase().includes('coffee hound');
  const isBookWorm = userProfile.toLowerCase().includes('book worm');
  const isHistorian = userProfile.toLowerCase().includes('historian');

  // Convert slider value (0-7) to distance (null for unlimited, or preset value)
  const sliderValueToDistance = (value: number): MaxTravelDistance => {
    if (value >= DISTANCE_PRESETS.length) return null; // Unlimited
    return DISTANCE_PRESETS[Math.round(value)].value;
  };

  // Convert distance to slider value
  const distanceToSliderValue = (distance: MaxTravelDistance): number => {
    if (distance === null) return DISTANCE_PRESETS.length; // Unlimited is at the end
    const index = DISTANCE_PRESETS.findIndex(p => p.value === distance);
    return index >= 0 ? index : DISTANCE_PRESETS.length;
  };

  // Get display text for current distance
  const getDistanceDisplayText = (distance: MaxTravelDistance): string => {
    if (distance === null) return 'Unlimited';
    if (distance >= 1000) return `${(distance / 1000).toFixed(distance % 1000 === 0 ? 0 : 1)}k miles`;
    return `${distance} miles`;
  };

  // Count lines in profile (for clear button visibility)
  const profileLineCount = userProfile.trim() ? userProfile.trim().split(',').length : 0;
  const showClearButton = profileLineCount > 3;

  // Filter out foodie preferences already in profile
  const availableFoodiePrefs = useMemo(() => {
    const profileLower = userProfile.toLowerCase();
    return FOODIE_PREFERENCES.filter(pref => !profileLower.includes(pref.toLowerCase()));
  }, [userProfile]);

  // Filter out coffee preferences already in profile
  const availableCoffeePrefs = useMemo(() => {
    const profileLower = userProfile.toLowerCase();
    return COFFEE_PREFERENCES.filter(pref => !profileLower.includes(pref.toLowerCase()));
  }, [userProfile]);

  // Filter out bookworm preferences already in profile
  const availableBookwormPrefs = useMemo(() => {
    const profileLower = userProfile.toLowerCase();
    return BOOKWORM_PREFERENCES.filter(pref => !profileLower.includes(pref.toLowerCase()));
  }, [userProfile]);

  // Filter out historian preferences already in profile
  const availableHistorianPrefs = useMemo(() => {
    const profileLower = userProfile.toLowerCase();
    return HISTORIAN_PREFERENCES.filter(pref => !profileLower.includes(pref.toLowerCase()));
  }, [userProfile]);

  // Filter out suggestions that are already in the user's profile OR are mutually exclusive with selected options
  const availableSuggestions = useMemo(() => {
    const profileLower = userProfile.toLowerCase();
    
    // Check which exclusive groups have a selection
    const selectedExclusiveGroups: string[] = [];
    Object.entries(EXCLUSIVE_GROUPS).forEach(([groupName, options]) => {
      options.forEach(option => {
        if (profileLower.includes(option.toLowerCase())) {
          selectedExclusiveGroups.push(groupName);
        }
      });
    });
    
    return PROFILE_SUGGESTIONS.filter(suggestion => {
      // Check if the label or profileText is already in the profile
      if (profileLower.includes(suggestion.label.toLowerCase())) return false;
      if (profileLower.includes(suggestion.profileText.toLowerCase())) return false;
      
      // Check if this suggestion belongs to a mutually exclusive group that already has a selection
      for (const [groupName, options] of Object.entries(EXCLUSIVE_GROUPS)) {
        if (selectedExclusiveGroups.includes(groupName) && options.includes(suggestion.label)) {
          return false;
        }
      }
      
      return true;
    });
  }, [userProfile]);

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Traveler Profile</Text>
        <View style={styles.titleButtons}>
          <TouchableOpacity onPress={() => setPrivacyModalVisible(true)} style={styles.infoButton}>
            <Text style={styles.infoIcon}>ⓘ</Text>
          </TouchableOpacity>
          {onResetOnboarding && (
            <TouchableOpacity 
              onPress={() => {
                Alert.alert(
                  'Restart Profile Setup',
                  'This will reset your profile and take you through the setup process again. Your saved trips will not be affected.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Restart', style: 'destructive', onPress: onResetOnboarding },
                  ]
                );
              }} 
              style={styles.resetButton}
            >
              <Text style={styles.resetIcon}>↻</Text>
            </TouchableOpacity>
          )}
          {onOpenToolSettings && (
            <TouchableOpacity 
              onPress={onOpenToolSettings} 
              style={styles.toolSettingsButton}
            >
              <Text style={styles.toolSettingsIcon}>🔧</Text>
            </TouchableOpacity>
          )}
          {showClearButton && (
            <TouchableOpacity onPress={() => onSaveProfile('')} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <TextInput
        style={styles.input}
        placeholder="Add details about yourself to improve trip recommendations..."
        placeholderTextColor="rgba(255,255,255,0.5)"
        value={userProfile}
        onChangeText={onSaveProfile}
        multiline
        numberOfLines={6}
        scrollEnabled
      />
      
      {/* Travel Dates */}
      {onUpdateTravelDates && (
        <View style={styles.travelDatesContainer}>
          <Text style={styles.travelDatesLabel}>Travel Dates</Text>
          <View style={styles.travelDatesRow}>
            <TouchableOpacity 
              style={styles.datePickerButton}
              onPress={() => setShowDeparturePicker(true)}
            >
              <Text style={styles.datePickerLabel}>Departure</Text>
              <Text style={[
                styles.datePickerValue,
                !travelDates?.departure && styles.datePickerPlaceholder
              ]}>
                {travelDates?.departure ? formatDateForDisplay(travelDates.departure) : 'Select date'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.datePickerButton}
              onPress={() => setShowReturnPicker(true)}
            >
              <Text style={styles.datePickerLabel}>Return</Text>
              <Text style={[
                styles.datePickerValue,
                !travelDates?.return && styles.datePickerPlaceholder
              ]}>
                {travelDates?.return ? formatDateForDisplay(travelDates.return) : 'Select date'}
              </Text>
            </TouchableOpacity>
          </View>
          {travelDates?.departure && travelDates?.return && (
            <Text style={[styles.tripDuration, { color: theme.primary }]}>
              {calculateTripDuration(travelDates.departure, travelDates.return)}
            </Text>
          )}
          {(travelDates?.departure || travelDates?.return) && (
            <TouchableOpacity 
              style={styles.clearDatesButton}
              onPress={() => onUpdateTravelDates({})}
            >
              <Text style={styles.clearDatesText}>Clear dates</Text>
            </TouchableOpacity>
          )}
          
          {/* iOS Date Picker Modal - Calendar Style */}
          {Platform.OS === 'ios' && showDeparturePicker && (
            <Modal transparent animationType="slide">
              <View style={styles.datePickerModal}>
                <View style={styles.datePickerModalContent}>
                  <View style={styles.datePickerModalHeader}>
                    <Text style={styles.datePickerModalTitle}>Select Departure Date</Text>
                    <TouchableOpacity onPress={() => setShowDeparturePicker(false)}>
                      <Text style={[styles.datePickerModalDone, { color: theme.primary }]}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={travelDates?.departure ? new Date(travelDates.departure + 'T12:00:00') : new Date()}
                    mode="date"
                    display="inline"
                    minimumDate={new Date()}
                    onChange={(event: DateTimePickerEvent, date?: Date) => {
                      if (date) {
                        const isoDate = date.toISOString().split('T')[0];
                        onUpdateTravelDates({ ...travelDates, departure: isoDate });
                      }
                    }}
                    accentColor={theme.primary}
                    themeVariant="dark"
                    style={styles.inlineCalendar}
                  />
                </View>
              </View>
            </Modal>
          )}
          
          {Platform.OS === 'ios' && showReturnPicker && (
            <Modal transparent animationType="slide">
              <View style={styles.datePickerModal}>
                <View style={styles.datePickerModalContent}>
                  <View style={styles.datePickerModalHeader}>
                    <Text style={styles.datePickerModalTitle}>Select Return Date</Text>
                    <TouchableOpacity onPress={() => setShowReturnPicker(false)}>
                      <Text style={[styles.datePickerModalDone, { color: theme.primary }]}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={travelDates?.return ? new Date(travelDates.return + 'T12:00:00') : (travelDates?.departure ? new Date(travelDates.departure + 'T12:00:00') : new Date())}
                    mode="date"
                    display="inline"
                    minimumDate={travelDates?.departure ? new Date(travelDates.departure + 'T12:00:00') : new Date()}
                    onChange={(event: DateTimePickerEvent, date?: Date) => {
                      if (date) {
                        const isoDate = date.toISOString().split('T')[0];
                        onUpdateTravelDates({ ...travelDates, return: isoDate });
                      }
                    }}
                    accentColor={theme.primary}
                    themeVariant="dark"
                    style={styles.inlineCalendar}
                  />
                </View>
              </View>
            </Modal>
          )}
          
          {/* Android Date Picker - Calendar Style */}
          {Platform.OS === 'android' && showDeparturePicker && (
            <DateTimePicker
              value={travelDates?.departure ? new Date(travelDates.departure + 'T12:00:00') : new Date()}
              mode="date"
              display="calendar"
              minimumDate={new Date()}
              onChange={(event: DateTimePickerEvent, date?: Date) => {
                setShowDeparturePicker(false);
                if (event.type === 'set' && date) {
                  const isoDate = date.toISOString().split('T')[0];
                  onUpdateTravelDates({ ...travelDates, departure: isoDate });
                }
              }}
            />
          )}
          
          {Platform.OS === 'android' && showReturnPicker && (
            <DateTimePicker
              value={travelDates?.return ? new Date(travelDates.return + 'T12:00:00') : (travelDates?.departure ? new Date(travelDates.departure + 'T12:00:00') : new Date())}
              mode="date"
              display="calendar"
              minimumDate={travelDates?.departure ? new Date(travelDates.departure + 'T12:00:00') : new Date()}
              onChange={(event: DateTimePickerEvent, date?: Date) => {
                setShowReturnPicker(false);
                if (event.type === 'set' && date) {
                  const isoDate = date.toISOString().split('T')[0];
                  onUpdateTravelDates({ ...travelDates, return: isoDate });
                }
              }}
            />
          )}
        </View>
      )}

      {/* Travel Distance Slider */}
      {onUpdateMaxTravelDistance && (
        <View style={styles.distanceContainer}>
          <View style={styles.distanceHeader}>
            <Text style={styles.distanceLabel}>Max Travel Distance</Text>
            <Text style={styles.distanceValue}>{getDistanceDisplayText(maxTravelDistance ?? null)}</Text>
          </View>
          <Slider
            style={styles.distanceSlider}
            minimumValue={0}
            maximumValue={DISTANCE_PRESETS.length}
            step={1}
            value={distanceToSliderValue(maxTravelDistance ?? null)}
            onValueChange={(value) => onUpdateMaxTravelDistance(sliderValueToDistance(value))}
            minimumTrackTintColor="#22C55E"
            maximumTrackTintColor="rgba(255,255,255,0.2)"
            thumbTintColor="#22C55E"
          />
          <View style={styles.distanceLabels}>
            <Text style={styles.distanceLabelSmall}>50 mi</Text>
            <Text style={styles.distanceLabelSmall}>Unlimited</Text>
          </View>
        </View>
      )}

      {availableSuggestions.length > 0 && (
        <>
          <TouchableOpacity 
            style={styles.suggestionsHeader}
            onPress={() => setSuggestionsExpanded(!suggestionsExpanded)}
          >
            <Text style={styles.suggestionsTitle}>
              {suggestionsExpanded ? '▼' : '▶'} Quick preferences ({availableSuggestions.length})
            </Text>
          </TouchableOpacity>
          {suggestionsExpanded && (
            <View style={styles.suggestions}>
              {availableSuggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.suggestionChip, { backgroundColor: theme.chipBackground, borderColor: theme.chipBorder }]}
                  onPress={() => onAddSuggestion(suggestion.profileText)}
                >
                  <Text style={[styles.suggestionText, { color: theme.chipText }]}>{suggestion.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}

      {/* Foodie Sub-Profile - appears when Foodie badge is selected */}
      {isFoodie && availableFoodiePrefs.length > 0 && (
        <>
          <TouchableOpacity 
            style={styles.foodieHeader}
            onPress={() => setFoodieExpanded(!foodieExpanded)}
          >
            <Text style={styles.foodieTitle}>
              {foodieExpanded ? '▼' : '▶'} Foodie Preferences ({availableFoodiePrefs.length})
            </Text>
          </TouchableOpacity>
          {foodieExpanded && (
            <View style={styles.suggestions}>
              {availableFoodiePrefs.map((pref, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.foodieChip}
                  onPress={() => onAddSuggestion(pref)}
                >
                  <Text style={styles.suggestionText}>{pref}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}

      {/* Coffee Hound Sub-Profile - appears when Coffee hound badge is selected */}
      {isCoffeeHound && availableCoffeePrefs.length > 0 && (
        <>
          <TouchableOpacity 
            style={styles.coffeeHeader}
            onPress={() => setCoffeeExpanded(!coffeeExpanded)}
          >
            <Text style={styles.coffeeTitle}>
              {coffeeExpanded ? '▼' : '▶'} Coffee Preferences ({availableCoffeePrefs.length})
            </Text>
          </TouchableOpacity>
          {coffeeExpanded && (
            <View style={styles.suggestions}>
              {availableCoffeePrefs.map((pref, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.coffeeChip}
                  onPress={() => onAddSuggestion(pref)}
                >
                  <Text style={styles.suggestionText}>{pref}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}

      {/* Book Worm Sub-Profile - appears when Book worm badge is selected */}
      {isBookWorm && availableBookwormPrefs.length > 0 && (
        <>
          <TouchableOpacity 
            style={styles.bookwormHeader}
            onPress={() => setBookwormExpanded(!bookwormExpanded)}
          >
            <Text style={styles.bookwormTitle}>
              {bookwormExpanded ? '▼' : '▶'} Book Worm Preferences ({availableBookwormPrefs.length})
            </Text>
          </TouchableOpacity>
          {bookwormExpanded && (
            <View style={styles.suggestions}>
              {availableBookwormPrefs.map((pref, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.bookwormChip}
                  onPress={() => onAddSuggestion(pref)}
                >
                  <Text style={styles.suggestionText}>{pref}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}

      {/* Historian Sub-Profile - appears when Historian badge is selected */}
      {isHistorian && availableHistorianPrefs.length > 0 && (
        <>
          <TouchableOpacity 
            style={styles.historianHeader}
            onPress={() => setHistorianExpanded(!historianExpanded)}
          >
            <Text style={styles.historianTitle}>
              {historianExpanded ? '▼' : '▶'} Historian Preferences ({availableHistorianPrefs.length})
            </Text>
          </TouchableOpacity>
          {historianExpanded && (
            <View style={styles.suggestions}>
              {availableHistorianPrefs.map((pref, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.historianChip}
                  onPress={() => onAddSuggestion(pref)}
                >
                  <Text style={styles.suggestionText}>{pref}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}

      <Modal
        visible={privacyModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPrivacyModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPrivacyModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Your Privacy</Text>
            <Text style={styles.modalText}>
              Your profile data is ephemeral and stored only on your device. {APP_NAME} will never store, sell, or share your personal information.
            </Text>
            <Text style={styles.modalText}>
              Profile preferences are used solely to personalize your trip recommendations during this session.
            </Text>
            <TouchableOpacity 
              style={[styles.modalButton, { backgroundColor: theme.buttonBackground }]} 
              onPress={() => setPrivacyModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>Got it</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  infoButton: {
    marginLeft: 8,
    padding: 2,
  },
  infoIcon: {
    color: '#4A9FE8',
    fontSize: 16,
  },
  resetButton: {
    padding: 2,
  },
  resetIcon: {
    color: '#4A9FE8',
    fontSize: 16,
  },
  toolSettingsButton: {
    padding: 2,
  },
  toolSettingsIcon: {
    fontSize: 14,
  },
  titleButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  clearButtonText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 10,
    color: '#FFFFFF',
    fontSize: 13,
    minHeight: 60,
    maxHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  suggestionsHeader: {
    paddingVertical: 6,
  },
  suggestionsTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  suggestionChip: {
    backgroundColor: 'rgba(22, 101, 52, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  suggestionText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
  },
  foodieHeader: {
    paddingVertical: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  foodieTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  foodieChip: {
    backgroundColor: 'rgba(22, 101, 52, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  coffeeHeader: {
    paddingVertical: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  coffeeTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  coffeeChip: {
    backgroundColor: 'rgba(22, 101, 52, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bookwormHeader: {
    paddingVertical: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  bookwormTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  bookwormChip: {
    backgroundColor: 'rgba(22, 101, 52, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  historianHeader: {
    paddingVertical: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  historianTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  historianChip: {
    backgroundColor: 'rgba(22, 101, 52, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 32,
    maxWidth: 340,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: '#166534',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 8,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  distanceContainer: {
    marginTop: 12,
    marginBottom: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
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
  distanceLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -8,
  },
  distanceLabelSmall: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
  },
  travelDatesContainer: {
    marginTop: 12,
    marginBottom: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  travelDatesLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
  travelDatesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateInputContainer: {
    flex: 1,
  },
  dateInputLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    marginBottom: 4,
  },
  dateInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tripDuration: {
    color: '#22C55E',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
  datePickerButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  datePickerLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  datePickerValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  datePickerPlaceholder: {
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '400',
  },
  clearDatesButton: {
    alignSelf: 'center',
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  clearDatesText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  datePickerModal: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  datePickerModalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  datePickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  datePickerModalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  datePickerModalDone: {
    color: '#22C55E',
    fontSize: 16,
    fontWeight: '600',
  },
  inlineCalendar: {
    height: 350,
    marginHorizontal: 8,
  },
});
