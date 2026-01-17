import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { getParkHikes, ParkHike } from '../services/api';

const ParkSearchScreen: React.FC = () => {
  const [parkCode, setParkCode] = useState('');
  const [hikes, setHikes] = useState<ParkHike[]>([]);
  const [loading, setLoading] = useState(false);

  const parkCodes = [
    { code: 'yose', name: 'Yosemite' },
    { code: 'grca', name: 'Grand Canyon' },
    { code: 'zion', name: 'Zion' },
    { code: 'yell', name: 'Yellowstone' },
    { code: 'romo', name: 'Rocky Mountain' },
    { code: 'glac', name: 'Glacier' },
    { code: 'acad', name: 'Acadia' },
  ];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return '#10B981';
      case 'Moderate': return '#F59E0B';
      case 'Strenuous': return '#F97316';
      case 'Very Strenuous': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const searchHikes = async (code: string) => {
    setLoading(true);
    setParkCode(code);
    try {
      const response = await getParkHikes(code);
      setHikes(response.hikes || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to fetch hikes');
      setHikes([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>National Parks</Text>
        <Text style={styles.subtitle}>Select a park to see popular hikes</Text>

        <View style={styles.parkGrid}>
          {parkCodes.map((park) => (
            <TouchableOpacity
              key={park.code}
              style={[
                styles.parkChip,
                parkCode === park.code && styles.parkChipSelected,
              ]}
              onPress={() => searchHikes(park.code)}
            >
              <Text
                style={[
                  styles.parkChipText,
                  parkCode === park.code && styles.parkChipTextSelected,
                ]}
              >
                {park.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Loading hikes...</Text>
          </View>
        )}

        {!loading && hikes.length > 0 && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>
              {hikes.length} Popular Hike{hikes.length !== 1 ? 's' : ''}
            </Text>

            {hikes.map((hike, index) => (
              <View key={index} style={styles.hikeCard}>
                <View style={styles.hikeHeader}>
                  <Text style={styles.hikeName}>{hike.name}</Text>
                  <View
                    style={[
                      styles.difficultyBadge,
                      { backgroundColor: getDifficultyColor(hike.difficulty) },
                    ]}
                  >
                    <Text style={styles.difficultyText}>{hike.difficulty}</Text>
                  </View>
                </View>

                <Text style={styles.hikeDescription}>{hike.description}</Text>

                <View style={styles.hikeStats}>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>Distance</Text>
                    <Text style={styles.statValue}>{hike.distance}</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>Elevation</Text>
                    <Text style={styles.statValue}>{hike.elevationGain}</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>Duration</Text>
                    <Text style={styles.statValue}>{hike.duration}</Text>
                  </View>
                </View>

                <View style={styles.highlights}>
                  {hike.highlights.map((highlight, i) => (
                    <View key={i} style={styles.highlightChip}>
                      <Text style={styles.highlightText}>{highlight}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {!loading && parkCode && hikes.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No hikes found for this park</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 20,
  },
  parkGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  parkChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  parkChipSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  parkChipText: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },
  parkChipTextSelected: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
  },
  resultsContainer: {
    marginTop: 10,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  hikeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  hikeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  hikeName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  difficultyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  hikeDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  hikeStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  highlights: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  highlightChip: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  highlightText: {
    fontSize: 12,
    color: '#92400E',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
});

export default ParkSearchScreen;
