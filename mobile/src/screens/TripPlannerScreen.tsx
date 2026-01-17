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
import { planParkTrip, TripPlan } from '../services/api';

const TripPlannerScreen: React.FC = () => {
  const [parkCode, setParkCode] = useState('yose');
  const [originAirport, setOriginAirport] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [tripPlan, setTripPlan] = useState<TripPlan | null>(null);

  const parkOptions = [
    { code: 'yose', name: 'Yosemite' },
    { code: 'grca', name: 'Grand Canyon' },
    { code: 'zion', name: 'Zion' },
    { code: 'yell', name: 'Yellowstone' },
  ];

  const handlePlanTrip = async () => {
    if (!originAirport || !arrivalDate || !departureDate) {
      Alert.alert('Missing Info', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const plan = await planParkTrip({
        parkCode,
        originAirport: originAirport.toUpperCase(),
        arrivalDate,
        departureDate,
        adults: 1,
      });
      setTripPlan(plan);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to plan trip');
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return '#10B981';
      case 'Moderate': return '#F59E0B';
      case 'Strenuous': return '#F97316';
      case 'Very Strenuous': return '#EF4444';
      default: return '#6B7280';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>🗺️ Plan Park Trip</Text>
        <Text style={styles.subtitle}>Get flights, lodging & hikes in one place</Text>

        {!tripPlan && (
          <View style={styles.form}>
            <Text style={styles.label}>Select Park</Text>
            <View style={styles.parkGrid}>
              {parkOptions.map((park) => (
                <TouchableOpacity
                  key={park.code}
                  style={[
                    styles.parkChip,
                    parkCode === park.code && styles.parkChipSelected,
                  ]}
                  onPress={() => setParkCode(park.code)}
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

            <Text style={styles.label}>Your Airport Code</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., LAX, JFK, ORD"
              value={originAirport}
              onChangeText={setOriginAirport}
              autoCapitalize="characters"
              maxLength={3}
            />

            <Text style={styles.label}>Arrival Date</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={arrivalDate}
              onChangeText={setArrivalDate}
            />

            <Text style={styles.label}>Departure Date</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={departureDate}
              onChangeText={setDepartureDate}
            />

            <TouchableOpacity
              style={styles.button}
              onPress={handlePlanTrip}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Plan My Trip</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {tripPlan && (
          <View style={styles.results}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setTripPlan(null)}
            >
              <Text style={styles.backButtonText}>← Plan Another Trip</Text>
            </TouchableOpacity>

            {/* Trip Summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{tripPlan.tripSummary.park}</Text>
              <Text style={styles.summaryText}>{tripPlan.tripSummary.dates}</Text>
              <Text style={styles.summaryText}>{tripPlan.tripSummary.nearestAirport}</Text>
            </View>

            {/* Park Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Park Info</Text>
              <View style={styles.card}>
                <Text style={styles.cardText}>Entrance: {tripPlan.park.entranceFee}</Text>
                <Text style={styles.cardText}>States: {tripPlan.park.states}</Text>
              </View>
            </View>

            {/* Flights */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Flights</Text>
              <View style={styles.card}>
                {tripPlan.flights.options?.length ? (
                  tripPlan.flights.options.slice(0, 3).map((flight, i) => (
                    <View key={i} style={styles.flightRow}>
                      <Text style={styles.flightPrice}>{flight.price}</Text>
                      <Text style={styles.flightDetails}>
                        {flight.airline} • {flight.duration} • {flight.stops} stops
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.cardText}>{tripPlan.flights.note}</Text>
                )}
              </View>
            </View>

            {/* Campgrounds */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Campgrounds</Text>
              <View style={styles.card}>
                {tripPlan.lodging.campgrounds?.length ? (
                  tripPlan.lodging.campgrounds.map((camp, i) => (
                    <View key={i} style={styles.campRow}>
                      <Text style={styles.campName}>{camp.name}</Text>
                      <Text style={styles.campDetails}>{camp.sites} sites • {camp.fees}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.cardText}>No campground data available</Text>
                )}
                <Text style={styles.tipText}>{tripPlan.lodging.note}</Text>
              </View>
            </View>

            {/* Hikes */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Popular Hikes</Text>
              {tripPlan.hikes?.map((hike, i) => (
                <View key={i} style={styles.hikeCard}>
                  <View style={styles.hikeHeader}>
                    <Text style={styles.hikeName}>{hike.name}</Text>
                    <View style={[styles.badge, { backgroundColor: getDifficultyColor(hike.difficulty) }]}>
                      <Text style={styles.badgeText}>{hike.difficulty}</Text>
                    </View>
                  </View>
                  <Text style={styles.hikeStats}>
                    {hike.distance} • ↑{hike.elevationGain} • {hike.duration}
                  </Text>
                </View>
              ))}
            </View>

            {/* Budget Tips */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💰 Budget Tips</Text>
              <View style={styles.card}>
                {tripPlan.budgetTips?.map((tip, i) => (
                  <Text key={i} style={styles.tipItem}>• {tip}</Text>
                ))}
              </View>
            </View>
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
    marginBottom: 24,
  },
  form: {
    gap: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  parkGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
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
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  parkChipText: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },
  parkChipTextSelected: {
    color: '#FFFFFF',
  },
  button: {
    backgroundColor: '#8B5CF6',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  results: {
    gap: 16,
  },
  backButton: {
    marginBottom: 10,
  },
  backButtonText: {
    color: '#8B5CF6',
    fontSize: 16,
    fontWeight: '500',
  },
  summaryCard: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    padding: 20,
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#E9D5FF',
    marginBottom: 4,
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  cardText: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 4,
  },
  flightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  flightPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
  flightDetails: {
    fontSize: 14,
    color: '#6B7280',
  },
  campRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  campName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  campDetails: {
    fontSize: 13,
    color: '#6B7280',
  },
  tipText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 10,
    fontStyle: 'italic',
  },
  hikeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  hikeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hikeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  hikeStats: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  tipItem: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 6,
  },
});

export default TripPlannerScreen;
