import React from 'react';
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
  return (
    <View style={styles.container}>
      <Text style={styles.title}>👤 Your Profile</Text>
      <TextInput
        style={styles.input}
        placeholder="Add details about yourself..."
        placeholderTextColor="rgba(255,255,255,0.5)"
        value={userProfile}
        onChangeText={onSaveProfile}
        multiline
        numberOfLines={6}
        scrollEnabled
      />
      <Text style={styles.suggestionsTitle}>Quick add:</Text>
      <View style={styles.suggestions}>
        {PROFILE_SUGGESTIONS.map((suggestion, index) => (
          <TouchableOpacity
            key={index}
            style={styles.suggestionChip}
            onPress={() => onAddSuggestion(suggestion)}
          >
            <Text style={styles.suggestionText}>{suggestion}</Text>
          </TouchableOpacity>
        ))}
      </View>
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
  suggestionsTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginBottom: 6,
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
