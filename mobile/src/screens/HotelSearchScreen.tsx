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
import { searchHotels, HotelOffer } from '../services/api';

const HotelSearchScreen: React.FC = () => {
  const [location, setLocation] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [hotels, setHotels] = useState<HotelOffer[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!location || !checkInDate || !checkOutDate) {
      Alert.alert('Missing Info', 'Please enter location and dates');
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const response = await searchHotels({
        location,
        checkInDate,
        checkOutDate,
        adults: 1,
      });
      setHotels(response.results || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to search hotels');
      setHotels([]);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating?: number) => {
    if (!rating) return null;
    return `${rating} stars`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Search Hotels</Text>
        <Text style={styles.subtitle}>Find your perfect stay</Text>

        <View style={styles.form}>
          <Text style={styles.label}>City</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Paris, NYC, Tokyo"
            value={location}
            onChangeText={setLocation}
          />

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Check-in</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={checkInDate}
                onChangeText={setCheckInDate}
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Check-out</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={checkOutDate}
                onChangeText={setCheckOutDate}
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
              <Text style={styles.buttonText}>Search Hotels</Text>
            )}
          </TouchableOpacity>
        </View>

        {searched && !loading && (
          <View style={styles.results}>
            <Text style={styles.resultsTitle}>
              {hotels.length} Hotel{hotels.length !== 1 ? 's' : ''} Found
            </Text>

            {hotels.slice(0, 10).map((hotel, index) => (
              <View key={index} style={styles.hotelCard}>
                <View style={styles.hotelHeader}>
                  <View style={styles.hotelInfo}>
                    <Text style={styles.hotelName}>{hotel.name}</Text>
                    <Text style={styles.hotelLocation}>
                      {hotel.address.city}, {hotel.address.country}
                    </Text>
                    {hotel.starRating && (
                      <Text style={styles.stars}>{renderStars(hotel.starRating)}</Text>
                    )}
                  </View>
                  <View style={styles.priceContainer}>
                    <Text style={styles.pricePerNight}>
                      ${hotel.price.perNight.toFixed(0)}
                    </Text>
                    <Text style={styles.priceLabel}>per night</Text>
                  </View>
                </View>

                {hotel.amenities && hotel.amenities.length > 0 && (
                  <View style={styles.amenities}>
                    {hotel.amenities.slice(0, 4).map((amenity, i) => (
                      <View key={i} style={styles.amenityChip}>
                        <Text style={styles.amenityText}>{amenity}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.totalPrice}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>
                    ${hotel.price.total.toFixed(2)} {hotel.price.currency}
                  </Text>
                </View>
              </View>
            ))}

            {hotels.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No hotels found for this location</Text>
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
    backgroundColor: '#10B981',
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
  hotelCard: {
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
  hotelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hotelInfo: {
    flex: 1,
  },
  hotelName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  hotelLocation: {
    fontSize: 14,
    color: '#6B7280',
  },
  stars: {
    marginTop: 4,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  pricePerNight: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#10B981',
  },
  priceLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  amenities: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  amenityChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  amenityText: {
    fontSize: 12,
    color: '#4B5563',
  },
  totalPrice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  totalLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
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

export default HotelSearchScreen;
