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
  profileExpanded: boolean;
  onToggleExpanded: () => void;
  onSaveProfile: (profile: string) => void;
  onAddSuggestion: (suggestion: string) => void;
}

export const ProfileSection: React.FC<ProfileSectionProps> = ({
  userProfile,
  profileExpanded,
  onToggleExpanded,
  onSaveProfile,
  onAddSuggestion,
}) => {
  return (
    <>
      <TouchableOpacity style={styles.section} onPress={onToggleExpanded}>
        <View style={styles.header}>
          <Text style={styles.title}>👤 Your Profile</Text>
          <Text style={styles.expandIcon}>{profileExpanded ? '▼' : '▶'}</Text>
        </View>
        {userProfile ? (
          <Text style={styles.preview} numberOfLines={profileExpanded ? undefined : 2}>
            {userProfile}
          </Text>
        ) : (
          <Text style={styles.empty}>Tap to add preferences...</Text>
        )}
      </TouchableOpacity>

      {profileExpanded && (
        <View style={styles.expanded}>
          <TextInput
            style={styles.input}
            placeholder="Add details about yourself..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={userProfile}
            onChangeText={onSaveProfile}
            multiline
            numberOfLines={4}
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
      )}
    </>
  );
};

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  expandIcon: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  preview: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  empty: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 6,
  },
  expanded: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  suggestionsTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginBottom: 8,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  suggestionChip: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  suggestionText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
});
