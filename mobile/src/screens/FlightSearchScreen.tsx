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
import { searchFlights, FlightOffer } from '../services/api';

const FlightSearchScreen: React.FC = () => {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [flights, setFlights] = useState<FlightOffer[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!origin || !destination || !departureDate) {
      Alert.alert('Missing Info', 'Please enter origin, destination, and departure date');
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const response = await searchFlights({
        origin: origin.toUpperCase(),
        destination: destination.toUpperCase(),
        departureDate,
        returnDate: returnDate || undefined,
        adults: 1,
      });
      setFlights(response.results || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to search flights');
      setFlights([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (isoDuration: string): string => {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!match) return isoDuration;
    const hours = match[1] ? `${match[1]}h` : '';
    const minutes = match[2] ? `${match[2]}m` : '';
    return `${hours} ${minutes}`.trim();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Search Flights</Text>
        <Text style={styles.subtitle}>Find the best deals</Text>

        <View style={styles.form}>
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.label}>From</Text>
              <TextInput
                style={styles.input}
                placeholder="LAX"
                value={origin}
                onChangeText={setOrigin}
                autoCapitalize="characters"
                maxLength={3}
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.label}>To</Text>
              <TextInput
                style={styles.input}
                placeholder="JFK"
                value={destination}
                onChangeText={setDestination}
                autoCapitalize="characters"
                maxLength={3}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Departure</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={departureDate}
                onChangeText={setDepartureDate}
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Return (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={returnDate}
                onChangeText={setReturnDate}
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={handleSearch}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Search Flights</Text>
            )}
          </TouchableOpacity>
        </View>

        {searched && !loading && (
          <View style={styles.results}>
            <Text style={styles.resultsTitle}>
              {flights.length} Flight{flights.length !== 1 ? 's' : ''} Found
            </Text>

            {flights.slice(0, 10).map((flight, index) => (
              <View key={index} style={styles.flightCard}>
                <View style={styles.flightHeader}>
                  <Text style={styles.price}>
                    ${flight.price.total.toFixed(2)}
                  </Text>
                  <Text style={styles.airline}>{flight.validatingAirline}</Text>
                </View>

                {flight.itineraries.map((itinerary, i) => (
                  <View key={i} style={styles.itinerary}>
                    <Text style={styles.itineraryLabel}>
                      {i === 0 ? 'Outbound' : 'Return'} • {formatDuration(itinerary.duration)}
                    </Text>
                    {itinerary.segments.map((seg, j) => (
                      <View key={j} style={styles.segment}>
                        <Text style={styles.segmentRoute}>
                          {seg.departure.iataCode} → {seg.arrival.iataCode}
                        </Text>
                        <Text style={styles.segmentFlight}>{seg.flightNumber}</Text>
                      </View>
                    ))}
                  </View>
                ))}

                {flight.bookingUrl && (
                  <Text style={styles.bookingLink}>🔗 Booking available</Text>
                )}
              </View>
            ))}

            {flights.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No flights found for this route</Text>
              </View>
            )}
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
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
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
  button: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  results: {
    marginTop: 24,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  flightCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  flightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  price: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#10B981',
  },
  airline: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  itinerary: {
    marginBottom: 10,
  },
  itineraryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 6,
  },
  segment: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  segmentRoute: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  segmentFlight: {
    fontSize: 14,
    color: '#6B7280',
  },
  bookingLink: {
    fontSize: 13,
    color: '#3B82F6',
    marginTop: 8,
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

export default FlightSearchScreen;
