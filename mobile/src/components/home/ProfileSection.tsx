import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

const PROFILE_SUGGESTIONS = [
  '👨‍👩‍👧‍👦 Family of four',
  '🌴 Prefer warm destinations',
  '👴 Parents live in Florida',
  '🚫 Avoid crowded tourist spots',
  '🐕 Traveling with a dog',
  '♿ Need accessible accommodations',
  '💰 Budget-conscious traveler',
  '🏔️ Love hiking and outdoors',
  '✈️ Delta Airlines preferred',
  '✈️ Southwest Airlines preferred',
  '✈️ United Airlines preferred',
  '✈️ American Airlines preferred',
  '🚗 Hertz preferred',
  '🚗 Enterprise preferred',
  '🚗 National preferred',
  '🏨 Marriott preferred',
  '🏨 Hilton preferred',
  '🏨 IHG preferred',
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

  // Filter out suggestions that are already in the user's profile
  const availableSuggestions = useMemo(() => {
    const profileLower = userProfile.toLowerCase();
    return PROFILE_SUGGESTIONS.filter(suggestion => {
      // Remove emoji and check if the text is already in the profile
      const textWithoutEmoji = suggestion.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim().toLowerCase();
      return !profileLower.includes(textWithoutEmoji);
    });
  }, [userProfile]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>👤 Your Profile</Text>
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
  title: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 14,
    minHeight: 120,
    maxHeight: 180,
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  suggestionText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
  },
});
