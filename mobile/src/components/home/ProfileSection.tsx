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
        <TouchableOpacity onPress={() => setPrivacyModalVisible(true)} style={styles.infoButton}>
          <Text style={styles.infoIcon}>ⓘ</Text>
        </TouchableOpacity>
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
              {suggestionsExpanded ? '▼' : '▶'} Quick add ({availableSuggestions.length})
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
