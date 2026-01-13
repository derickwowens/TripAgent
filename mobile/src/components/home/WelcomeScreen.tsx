import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

const CONSIDERATIONS = [
  '✈️ One-way or round trip?',
  '🚗 Car rental needed?',
  '🏕️ Camping, hotels, or mix?',
  '🛣️ Is this a road trip?',
  '📅 How many days?',
  '📍 Destination & departure?',
];

interface WelcomeScreenProps {
  locationLoading: boolean;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ locationLoading }) => {
  if (locationLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Finding your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🌲</Text>
      <Text style={styles.title}>Where would you like to explore?</Text>
      <Text style={styles.hint}>Things to consider:</Text>
      <View style={styles.chipContainer}>
        {CONSIDERATIONS.map((item, index) => (
          <View key={index} style={styles.chip}>
            <Text style={styles.chipText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    fontWeight: '300',
  },
  loadingText: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    fontWeight: '300',
  },
  hint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 10,
  },
  chip: {
    backgroundColor: 'rgba(22, 101, 52, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
});
