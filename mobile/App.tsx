import React, { Component, ErrorInfo, ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from './src/screens/HomeScreen';
import FlightSearchScreen from './src/screens/FlightSearchScreen';
import HotelSearchScreen from './src/screens/HotelSearchScreen';
import ParkSearchScreen from './src/screens/ParkSearchScreen';
import TripPlannerScreen from './src/screens/TripPlannerScreen';

// Error Boundary to catch and display errors
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>Something went wrong</Text>
          <ScrollView style={errorStyles.scrollView}>
            <Text style={errorStyles.errorText}>
              {this.state.error?.toString()}
            </Text>
            <Text style={errorStyles.stackText}>
              {this.state.errorInfo?.componentStack}
            </Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: 16,
  },
  scrollView: {
    flex: 1,
  },
  errorText: {
    fontSize: 16,
    color: '#B91C1C',
    marginBottom: 12,
  },
  stackText: {
    fontSize: 12,
    color: '#7F1D1D',
    fontFamily: 'monospace',
  },
});

export type RootStackParamList = {
  Home: undefined;
  FlightSearch: undefined;
  HotelSearch: undefined;
  ParkSearch: undefined;
  TripPlanner: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <ErrorBoundary>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#FFFFFF',
          },
          headerTintColor: '#1F2937',
          headerTitleStyle: {
            fontWeight: '600',
          },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="FlightSearch"
          component={FlightSearchScreen}
          options={{ title: 'Flights' }}
        />
        <Stack.Screen
          name="HotelSearch"
          component={HotelSearchScreen}
          options={{ title: 'Hotels' }}
        />
        <Stack.Screen
          name="ParkSearch"
          component={ParkSearchScreen}
          options={{ title: 'National Parks' }}
        />
        <Stack.Screen
          name="TripPlanner"
          component={TripPlannerScreen}
          options={{ title: 'Trip Planner' }}
        />
      </Stack.Navigator>
      </NavigationContainer>
    </ErrorBoundary>
  );
}
