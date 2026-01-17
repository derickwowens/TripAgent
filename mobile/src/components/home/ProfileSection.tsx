import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';

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

const PROFILE_SUGGESTIONS = [
  // Gender (mutually exclusive)
  'Male',
  'Female',
  // Family/Kids
  'Kids 1-3 yrs',
  'Kids 4-7 yrs',
  'Kids 8-12 yrs',
  'Kids 13+',
  // Vehicle (mutually exclusive)
  'Gas vehicle',
  'Tesla',
  'Other EV',
  // Climate preference (mutually exclusive)
  'Warm destinations',
  'Cold destinations',
  // Travel style
  'Avoid crowds',
  'Frugal traveler',
  'Luxury travel',
  'Backpacker',
  'Love camping',
  'Hotels only',
  // Interests
  'Hiking/outdoors',
  'Photography',
  'Wildlife viewing',
  'Cycling',
  'Fishing',
  'Skiing/snowboard',
  'Water sports',
  'Sunrise/sunset',
  'Foodie',
  'Coffee hound',
  'Book worm',
  'Historian',
  // Physical/Accessibility
  'Traveling with dog',
  'Accessible needs',
  'Limited mobility',
  'With seniors',
  'Educational trips',
  // Airlines (mutually exclusive)
  'Delta',
  'Southwest',
  'United',
  'American',
  'JetBlue',
  'Alaska',
  // Car rentals (mutually exclusive)
  'Hertz',
  'Enterprise',
  'National',
  'Budget',
  // Hotels (mutually exclusive)
  'Marriott',
  'Hilton',
  'IHG',
  'Hyatt',
  'Airbnb/VRBO',
];

interface ProfileSectionProps {
  userProfile: string;
  onSaveProfile: (profile: string) => void;
  onAddSuggestion: (suggestion: string) => void;
}

export const ProfileSection: React.FC<ProfileSectionProps> = ({
  userProfile,
  onSaveProfile,
  onAddSuggestion,
}) => {
  // Expanded by default for empty profiles, collapsed otherwise
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(!userProfile || userProfile.trim().length === 0);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [foodieExpanded, setFoodieExpanded] = useState(false);
  const [coffeeExpanded, setCoffeeExpanded] = useState(false);
  const [bookwormExpanded, setBookwormExpanded] = useState(false);
  const [historianExpanded, setHistorianExpanded] = useState(false);

  // Check if user has special badges selected
  const isFoodie = userProfile.toLowerCase().includes('foodie');
  const isCoffeeHound = userProfile.toLowerCase().includes('coffee hound');
  const isBookWorm = userProfile.toLowerCase().includes('book worm');
  const isHistorian = userProfile.toLowerCase().includes('historian');

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
      // Check if the text is already in the profile
      if (profileLower.includes(suggestion.toLowerCase())) return false;
      
      // Check if this suggestion belongs to a mutually exclusive group that already has a selection
      for (const [groupName, options] of Object.entries(EXCLUSIVE_GROUPS)) {
        if (selectedExclusiveGroups.includes(groupName) && options.includes(suggestion)) {
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
                  style={styles.suggestionChip}
                  onPress={() => onAddSuggestion(suggestion)}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
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
            <Text style={styles.modalTitle}>🔒 Your Privacy</Text>
            <Text style={styles.modalText}>
              Your profile data is ephemeral and stored only on your device. TripAgent will never store, sell, or share your personal information.
            </Text>
            <Text style={styles.modalText}>
              Profile preferences are used solely to personalize your trip recommendations during this session.
            </Text>
            <TouchableOpacity 
              style={styles.modalButton} 
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
});
