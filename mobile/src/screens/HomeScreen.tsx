import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Text,
  Alert,
  Image,
  TextInput,
} from 'react-native';
import { sendChatMessageWithStream, ChatMessage as ApiChatMessage, ChatContext, logErrorToServer, fetchStateParks, StateParkSummary } from '../services/api';
import { useLocation, useConversations, useUserProfile, useDarkMode, DarkModeContext, getLoadingStatesForQuery, Message, SavedConversation, PhotoReference, useOnboarding, useTripContext, useToolSettings, ParkThemeProvider, getThemeForMode, useTravelDates } from '../hooks';
import { WelcomeScreen, ChatMessages, ChatInput, SideMenu, PhotoGallery, CollapsibleBottomPanel, OnboardingFlow, ParkMode, ThemedLogo } from '../components/home';
import type { ParkMode as ParkModeType } from '../hooks';
import { showShareOptions, generateItinerary, saveItineraryToDevice, shareGeneratedItinerary } from '../utils/shareItinerary';
import { parseUserMessage, parseApiResponse, parseApiResponseWithValidation } from '../utils/responseParser';

// Use Haiku for faster responses - tools handle the heavy lifting
const MODEL = 'claude-3-5-haiku-20241022';

// Local bundled nature/national park backgrounds for new conversations
const DEFAULT_BACKGROUNDS = [
  require('../../assets/backgrounds/bg-01-forest.jpg'),
  require('../../assets/backgrounds/bg-02-mountain.jpg'),
  require('../../assets/backgrounds/bg-03-valley.jpg'),
  require('../../assets/backgrounds/bg-04-fog.jpg'),
  require('../../assets/backgrounds/bg-05-sunforest.jpg'),
  require('../../assets/backgrounds/bg-06-lake.jpg'),
  require('../../assets/backgrounds/bg-07-sunrise.jpg'),
  require('../../assets/backgrounds/bg-08-alpine.jpg'),
  require('../../assets/backgrounds/bg-09-waterfall.jpg'),
  require('../../assets/backgrounds/bg-10-canyon.jpg'),
  require('../../assets/backgrounds/bg-11-path.jpg'),
  require('../../assets/backgrounds/bg-12-sunbeam.jpg'),
  require('../../assets/backgrounds/bg-13-meadow.jpg'),
  require('../../assets/backgrounds/bg-14-snow.jpg'),
  require('../../assets/backgrounds/bg-15-autumn.jpg'),
  require('../../assets/backgrounds/bg-16-dusk.jpg'),
  require('../../assets/backgrounds/bg-17-cliff.jpg'),
  require('../../assets/backgrounds/bg-18-river.jpg'),
  require('../../assets/backgrounds/bg-19-sunset.jpg'),
  require('../../assets/backgrounds/bg-20-peaks.jpg'),
];

// Get a random background for new conversations
const getRandomBackground = () => DEFAULT_BACKGROUNDS[Math.floor(Math.random() * DEFAULT_BACKGROUNDS.length)];

const HomeScreen: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [defaultBackground] = useState(() => getRandomBackground()); // Random bg per session
  const [showPhotoGallery, setShowPhotoGallery] = useState(true);
  const [parkMode, setParkMode] = useState<ParkMode>('national');
  const scrollViewRef = useRef<ScrollView>(null);
  
  // State parks near user for Quick Start prefills in state park mode
  const [nearbyStateParks, setNearbyStateParks] = useState<StateParkSummary[]>([]);
  
  // Selected state for State Parks mode (allows user to browse parks in other states)
  const [selectedStateParkState, setSelectedStateParkState] = useState<string | undefined>(undefined);
  
  // Handle park mode change - close current conversation and show welcome screen
  const handleParkModeChange = (newMode: ParkMode) => {
    if (newMode !== parkMode) {
      setParkMode(newMode);
      // Clear current conversation to show welcome/new trip screen
      startNewConversation();
      // Close the side menu
      setMenuOpen(false);
    }
  };
  
  // Per-conversation loading state (allows multiple conversations to load simultaneously)
  const [conversationLoadingState, setConversationLoadingState] = useState<Map<string | null, { loading: boolean; status: string }>>(new Map());
  
  // Separate loading state for non-conversation operations (itinerary generation, etc.)
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalLoadingStatus, setGlobalLoadingStatus] = useState('');

  const { userLocation, locationLoading } = useLocation();
  const { 
    messages, 
    setMessages,
    savedConversations,
    filteredConversations,
    currentConversationId,
    loadConversation, 
    startNewConversation, 
    deleteConversation,
    updateConversation,
    toggleFavorite,
    addMessage,
    addMessagesToConversation,
    ensureConversationId,
  } = useConversations(userLocation?.nearestAirport, parkMode, userLocation?.state);
  
  // Derived loading state for current conversation
  const currentLoadingState = conversationLoadingState.get(currentConversationId) || { loading: false, status: '' };
  const isLoading = currentLoadingState.loading;
  const loadingStatus = currentLoadingState.status;
  
  // Helper to update loading state for a specific conversation
  const setConversationLoading = (conversationId: string | null, loading: boolean, status: string = '') => {
    setConversationLoadingState(prev => {
      const next = new Map(prev);
      if (loading) {
        next.set(conversationId, { loading, status });
      } else {
        next.delete(conversationId);
      }
      return next;
    });
  };
  const { 
    userProfile, 
    profileExpanded, 
    maxTravelDistance,
    blacklistedParkCodes,
    updateProfile, 
    persistProfile,
    updateAndPersistProfile,
    addSuggestion, 
    toggleExpanded,
    updateMaxTravelDistance,
  } = useUserProfile(userLocation ? { lat: userLocation.lat!, lng: userLocation.lng! } : undefined);
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const { hasCompletedOnboarding, isLoading: onboardingLoading, completeOnboarding, resetOnboarding } = useOnboarding();
  const { travelDates, updateTravelDates, getFormattedDates } = useTravelDates();
  
  // Get theme colors based on current park mode
  const parkTheme = getThemeForMode(parkMode);
  
  // Tool settings for enabling/disabling API tools and language model selection
  const {
    settings: toolSettings,
    toggleTool,
    setLanguageModel,
    enableAllTools,
    disableAllTools,
    enabledToolCount,
    totalToolCount,
    getToolsForCurrentMode,
  } = useToolSettings(parkMode);
  
  // Trip context cache - persists structured trip data locally
  const {
    tripContext,
    updatePark,
    updateRestaurants,
    addLinks,
    updateTravelDetails,
    getContextForApi,
  } = useTripContext(currentConversationId);

  // Fetch nearby state parks when in state mode for Quick Start prefills
  useEffect(() => {
    const loadNearbyStateParks = async () => {
      if (parkMode === 'state' && userLocation?.state) {
        try {
          // Fetch state parks for the user's state
          const parks = await fetchStateParks(userLocation.state);
          // Filter by distance if maxTravelDistance is set and parks have coordinates
          let filteredParks = parks;
          if (maxTravelDistance && userLocation.lat && userLocation.lng) {
            filteredParks = parks.filter(park => {
              if (!park.coordinates) return true; // Keep parks without coordinates
              const distance = calculateDistance(
                userLocation.lat!,
                userLocation.lng!,
                park.coordinates.latitude,
                park.coordinates.longitude
              );
              return distance <= maxTravelDistance;
            });
          }
          setNearbyStateParks(filteredParks.slice(0, 20)); // Limit to 20 parks
        } catch (error) {
          console.error('Failed to fetch nearby state parks:', error);
          setNearbyStateParks([]);
        }
      }
    };
    loadNearbyStateParks();
  }, [parkMode, userLocation?.state, maxTravelDistance]);

  // Haversine distance calculation for state park filtering
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Handle onboarding completion
  const handleOnboardingComplete = async (profile: string, firstPrompt?: string, onboardingMaxDistance?: number | null) => {
    // Save the profile from onboarding - use updateAndPersistProfile to ensure it's saved immediately
    if (profile) {
      await updateAndPersistProfile(profile);
    }
    
    // Save max travel distance if set during onboarding
    if (onboardingMaxDistance !== undefined) {
      updateMaxTravelDistance(onboardingMaxDistance);
      // Persist immediately
      persistProfile();
    }
    
    // Mark onboarding as complete
    await completeOnboarding();
    
    // If user selected a first trip prompt, set it as input
    if (firstPrompt) {
      setInputText(firstPrompt);
    }
  };

  const handleOnboardingSkip = async () => {
    await completeOnboarding();
  };

  // Scroll to bottom when messages change or loading state changes
  useEffect(() => {
    if (scrollViewRef.current && messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, isLoading]);

  // Get photos only from the most recent assistant messages (reflects current context)
  // Only shows photos from the last 3 assistant responses to keep context relevant
  // Gallery: 28 photos total - first 24 for destination/parks, last 4 for restaurants
  const allPhotos = useMemo(() => {
    const destinationPhotos: PhotoReference[] = [];
    const restaurantPhotos: PhotoReference[] = [];
    const MAX_DESTINATION_PHOTOS = 24;
    const MAX_RESTAURANT_PHOTOS = 4;
    const RECENT_MESSAGES_COUNT = 3;
    
    // Get the last N assistant messages that have photos
    const recentAssistantMessages = messages
      .filter(msg => msg.type === 'assistant' && msg.photos && msg.photos.length > 0)
      .slice(-RECENT_MESSAGES_COUNT);
    
    recentAssistantMessages.forEach(msg => {
      if (msg.photos) {
        msg.photos.forEach(photo => {
          // Check if this is a restaurant photo (source: 'other' or caption contains restaurant-related text)
          const isRestaurantPhoto = photo.source === 'other' || photo.caption?.includes('miles to') || photo.caption?.includes('near');
          
          if (isRestaurantPhoto) {
            // Add to restaurant photos if not duplicate and under limit
            if (restaurantPhotos.length < MAX_RESTAURANT_PHOTOS && !restaurantPhotos.some(p => p.url === photo.url)) {
              restaurantPhotos.push(photo);
            }
          } else {
            // Add to destination photos if not duplicate and under limit
            if (destinationPhotos.length < MAX_DESTINATION_PHOTOS && !destinationPhotos.some(p => p.url === photo.url)) {
              destinationPhotos.push(photo);
            }
          }
        });
      }
    });
    
    // Combine: destination photos first, then restaurant photos at the end
    return [...destinationPhotos, ...restaurantPhotos];
  }, [messages]);

  // Show photo gallery when new photos arrive
  useEffect(() => {
    if (allPhotos.length > 0) {
      setShowPhotoGallery(true);
    }
  }, [allPhotos.length]);

  // Switching conversations - requests continue in background, loading state is per-conversation
  const handleLoadConversation = (conversation: SavedConversation) => {
    // Simply load the conversation - any in-flight requests for other conversations
    // continue in the background and will update their respective conversations
    loadConversation(conversation);
  };

  // Starting new conversation - requests continue in background
  const handleStartNewConversation = () => {
    startNewConversation();
  };

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    // CRITICAL: Ensure conversation has an ID before sending to prevent race conditions
    // when user switches conversations while requests are in-flight
    const requestConversationId = ensureConversationId();

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputText.trim(),
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputText('');
    
    // Scroll to bottom immediately after sending
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 50);
    
    // Set loading state for THIS conversation
    setConversationLoading(requestConversationId, true, 'Thinking...');

    try {
      const chatMessages: ApiChatMessage[] = updatedMessages.map(m => ({
        role: m.type === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));

      // Parse user message to extract trip details dynamically
      const parsedUserInput = parseUserMessage(userMessage.content);
      
      // Update local context cache based on user input
      if (parsedUserInput.park) {
        updatePark(parsedUserInput.park);
      }
      if (parsedUserInput.travelDates || parsedUserInput.travelers || parsedUserInput.departingFrom) {
        updateTravelDetails({
          arrival: parsedUserInput.travelDates?.arrival,
          departure: parsedUserInput.travelDates?.departure,
          travelers: parsedUserInput.travelers,
          departingFrom: parsedUserInput.departingFrom,
        });
      }
      
      // Build context with cached trip data (reduces redundant API calls)
      const cachedContext = getContextForApi();
      const context: ChatContext = {
        userLocation: userLocation ? {
          city: userLocation.city,
          state: userLocation.state,
          nearestAirport: userLocation.nearestAirport,
        } : undefined,
        userProfile: userProfile || undefined,
        maxTravelDistance: maxTravelDistance ?? undefined,
        blacklistedParkCodes: blacklistedParkCodes.length > 0 ? blacklistedParkCodes : undefined,
        parkMode: parkMode, // 'national' or 'state' parks mode
        // Travel dates for booking links
        travelDates: travelDates.departure ? {
          departure: travelDates.departure,
          return: travelDates.return,
        } : undefined,
        // Include cached context from local storage
        ...(cachedContext || {}),
        // Tool settings for API
        toolSettings: {
          languageModel: toolSettings.languageModel,
          enabledTools: toolSettings.tools.filter(t => t.enabled).map(t => t.id),
        },
      };

      // Use streaming to get real-time tool status updates
      const response = await sendChatMessageWithStream(
        chatMessages, 
        context, 
        MODEL,
        (toolStatus) => {
          // Update status for this specific conversation
          setConversationLoading(requestConversationId, true, toolStatus);
        }
      );
      
      // Build response messages
      let responseMessages: Message[];
      if (response.segments && response.segments.length > 1) {
        responseMessages = response.segments.map((segment, index) => ({
          id: (Date.now() + index + 1).toString(),
          type: 'assistant' as const,
          content: segment,
          timestamp: new Date(),
          photos: index === response.segments!.length - 1 ? response.photos : undefined,
        }));
      } else {
        responseMessages = [{
          id: (Date.now() + 1).toString(),
          type: 'assistant' as const,
          content: response.response,
          timestamp: new Date(),
          photos: response.photos,
        }];
      }
      
      // Route response to the correct conversation
      // If user is still on this conversation, update live state
      // Otherwise, update the saved conversation in storage
      if (currentConversationId === requestConversationId) {
        setMessages(prev => [...prev, ...responseMessages]);
      } else {
        // User switched - update the background conversation
        await addMessagesToConversation(requestConversationId, responseMessages);
        console.log(`[Conversation Queue] Response routed to background conversation ${requestConversationId}`);
      }
      
      // Validate and cache links AFTER displaying response (async, non-blocking)
      parseApiResponseWithValidation(response.response).then(validated => {
        if (validated.links.length > 0) {
          addLinks(validated.links);
        }
      });
    } catch (error: any) {
      console.error('Chat error:', error);
      
      logErrorToServer({
        message: error?.message || 'Unknown chat error',
        stack: error?.stack,
        endpoint: '/api/chat',
        context: {
          model: MODEL,
          messageCount: updatedMessages.length,
          userLocation: userLocation?.city,
          errorCode: error?.response?.status,
          errorData: error?.response?.data,
        },
      });
      
      // Generate user-friendly error message with helpful guidance
      let userFriendlyMessage = '';
      const statusCode = error?.response?.status;
      
      if (statusCode === 500) {
        userFriendlyMessage = "I'm having trouble processing that request right now. Try being more specific - for example, instead of 'plan a trip' try 'Help me plan a 3-day trip to Yellowstone National Park'.";
      } else if (statusCode === 503) {
        userFriendlyMessage = "I'm temporarily unavailable. This usually resolves in a minute or two - tap retry when you're ready!";
      } else if (statusCode === 429) {
        userFriendlyMessage = "Let's slow down a bit! Wait a moment and then tap retry.";
      } else if (statusCode === 401 || statusCode === 403) {
        userFriendlyMessage = "There was a connection issue. Please close and reopen the app, then try again.";
      } else if (error?.message?.includes('Network') || error?.message?.includes('network') || !statusCode) {
        userFriendlyMessage = "I can't reach the server right now. Check your internet connection and tap retry when you're back online.";
      } else if (statusCode >= 400 && statusCode < 500) {
        userFriendlyMessage = "I didn't quite understand that. Try rephrasing - for example: 'What are the best hikes in Zion?' or 'Help me plan a weekend trip to the Grand Canyon'.";
      } else {
        userFriendlyMessage = "Something went wrong on my end. Tap retry, or try asking in a different way. If this keeps happening, use the feedback form in the menu.";
      }
      
      // Find the last user message for retry functionality
      const lastUserMsg = messages.length > 0 
        ? messages.filter(m => m.type === 'user').pop()?.content 
        : inputText;
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: userFriendlyMessage,
        timestamp: new Date(),
        isError: true,
        lastUserMessage: lastUserMsg || inputText,
      };
      
      // Route error to the correct conversation
      if (currentConversationId === requestConversationId) {
        setMessages(prev => [...prev, errorMessage]);
      } else {
        await addMessagesToConversation(requestConversationId, [errorMessage]);
      }
    } finally {
      // Clear loading state for this specific conversation
      setConversationLoading(requestConversationId, false);
      if (currentConversationId === requestConversationId) {
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      }
    }
  };

  const handleSendWithMessage = async (messageContent: string) => {
    if (!messageContent.trim() || isLoading) return;

    // CRITICAL: Ensure conversation has an ID before sending to prevent race conditions
    const requestConversationId = ensureConversationId();

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: messageContent.trim(),
      timestamp: new Date(),
    };

    const updatedMessages = [userMessage];
    setMessages(updatedMessages);
    
    // Set loading state for THIS conversation
    setConversationLoading(requestConversationId, true, 'Thinking...');

    try {
      const chatMessages: ApiChatMessage[] = updatedMessages.map(m => ({
        role: m.type === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));

      // Parse user message to extract trip details dynamically
      const parsedUserInput = parseUserMessage(messageContent.trim());
      
      // Update local context cache based on user input
      if (parsedUserInput.park) {
        updatePark(parsedUserInput.park);
      }
      if (parsedUserInput.travelDates || parsedUserInput.travelers || parsedUserInput.departingFrom) {
        updateTravelDetails({
          arrival: parsedUserInput.travelDates?.arrival,
          departure: parsedUserInput.travelDates?.departure,
          travelers: parsedUserInput.travelers,
          departingFrom: parsedUserInput.departingFrom,
        });
      }

      // Build context with cached trip data
      const cachedContext = getContextForApi();
      const context: ChatContext = {
        userLocation: userLocation ? {
          city: userLocation.city,
          state: userLocation.state,
          nearestAirport: userLocation.nearestAirport,
        } : undefined,
        userProfile: userProfile || undefined,
        maxTravelDistance: maxTravelDistance ?? undefined,
        blacklistedParkCodes: blacklistedParkCodes.length > 0 ? blacklistedParkCodes : undefined,
        parkMode: parkMode,
        ...(cachedContext || {}),
        // Tool settings for API
        toolSettings: {
          languageModel: toolSettings.languageModel,
          enabledTools: toolSettings.tools.filter(t => t.enabled).map(t => t.id),
        },
      };

      // Use streaming to get real-time tool status updates
      const response = await sendChatMessageWithStream(
        chatMessages, 
        context, 
        MODEL,
        (toolStatus) => {
          // Update status for this specific conversation
          setConversationLoading(requestConversationId, true, toolStatus);
        }
      );
      
      // Build response messages
      let responseMessages: Message[];
      if (response.segments && response.segments.length > 1) {
        responseMessages = response.segments.map((segment, index) => ({
          id: (Date.now() + index + 1).toString(),
          type: 'assistant' as const,
          content: segment,
          timestamp: new Date(),
          photos: index === response.segments!.length - 1 ? response.photos : undefined,
        }));
      } else {
        responseMessages = [{
          id: (Date.now() + 1).toString(),
          type: 'assistant' as const,
          content: response.response,
          timestamp: new Date(),
          photos: response.photos,
        }];
      }
      
      // Route response to the correct conversation
      if (currentConversationId === requestConversationId) {
        setMessages(prev => [...prev, ...responseMessages]);
      } else {
        await addMessagesToConversation(requestConversationId, responseMessages);
        console.log(`[Conversation Queue] Response routed to background conversation ${requestConversationId}`);
      }
      
      // Validate and cache links AFTER displaying response (async, non-blocking)
      parseApiResponseWithValidation(response.response).then(validated => {
        if (validated.links.length > 0) {
          addLinks(validated.links);
        }
      });
    } catch (error: any) {
      console.error('Chat error:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: "😕 Something went wrong. Please try again.",
        timestamp: new Date(),
        isError: true,
        lastUserMessage: messageContent,
      };
      
      // Route error to the correct conversation
      if (currentConversationId === requestConversationId) {
        setMessages(prev => [...prev, errorMessage]);
      } else {
        await addMessagesToConversation(requestConversationId, [errorMessage]);
      }
    } finally {
      // Clear loading state for this specific conversation
      setConversationLoading(requestConversationId, false);
      if (currentConversationId === requestConversationId) {
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      }
    }
  };

  const handleGenerateItinerary = async (conversation: SavedConversation) => {
    setMenuOpen(false);
    setGlobalLoading(true);
    setGlobalLoadingStatus('Generating your itinerary...');
    
    try {
      const itineraryData = await generateItinerary(conversation, setGlobalLoadingStatus, userProfile || undefined);
      
      if (itineraryData) {
        setGlobalLoadingStatus('Creating shareable page...');
        const saved = await saveItineraryToDevice(conversation, itineraryData);
        setGlobalLoading(false);
        setGlobalLoadingStatus('');
        
        if (saved) {
          const hasHtmlUrl = !!saved.htmlUrl;
          Alert.alert(
            'Itinerary Created (Beta)',
            hasHtmlUrl 
              ? 'Your web itinerary is ready! This is an experimental feature - the link will expire in 7 days.'
              : 'Your itinerary has been saved. Would you like to share it now?',
            hasHtmlUrl ? [
              { text: 'Later', style: 'cancel' },
              { 
                text: 'View', 
                onPress: async () => {
                  if (saved.htmlUrl) {
                    const { Linking } = require('react-native');
                    await Linking.openURL(saved.htmlUrl);
                  }
                }
              },
              { 
                text: 'Share', 
                onPress: () => shareGeneratedItinerary(saved)
              },
            ] : [
              { text: 'Later', style: 'cancel' },
              { 
                text: 'Share', 
                onPress: () => shareGeneratedItinerary(saved)
              },
            ]
          );
        }
      } else {
        Alert.alert('Error', 'Unable to generate itinerary. Please try again.');
      }
    } catch (error) {
      console.error('Error generating itinerary:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setGlobalLoading(false);
      setGlobalLoadingStatus('');
    }
  };

  // Use first destination photo as background if available, otherwise use random default
  // defaultBackground is a local require() result, allPhotos[0].url is a remote URL
  const backgroundSource = allPhotos.length > 0 
    ? { uri: allPhotos[0].url } 
    : defaultBackground;

  // Show loading state while checking onboarding status
  if (onboardingLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Show onboarding for first-time users
  if (hasCompletedOnboarding === false) {
    return (
      <OnboardingFlow
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
      />
    );
  }

  // Get theme colors based on park mode
  const theme = getThemeForMode(parkMode);

  return (
    <ParkThemeProvider mode={parkMode}>
    <DarkModeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
      <ImageBackground
        source={backgroundSource}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
          <StatusBar barStyle="light-content" />
        
        <View style={styles.header}>
          <TouchableOpacity style={styles.menuButton} onPress={() => setMenuOpen(true)}>
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
          {messages.length > 0 ? (
            <ThemedLogo size={32} style={styles.headerLogo} />
          ) : (
            <View style={styles.headerLogo} />
          )}
          {messages.length > 0 ? (
            <TouchableOpacity 
              style={[styles.shareButton, { backgroundColor: parkTheme.buttonBackground }]} 
              onPress={() => {
                const currentConv = savedConversations.find(c => c.id === currentConversationId);
                if (currentConv) {
                  showShareOptions(currentConv, () => handleGenerateItinerary(currentConv));
                } else {
                  Alert.alert('Share', 'Save your conversation first to share it');
                }
              }}
            >
              <Text style={styles.shareButtonText}>↗</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.menuButton} />
          )}
        </View>

        {messages.length > 0 && currentConversationId && (() => {
          const currentConv = savedConversations.find(c => c.id === currentConversationId);
          if (currentConv && (currentConv.metadata.title || currentConv.metadata.destination)) {
            return (
              <View style={styles.conversationHeader}>
                {editingTitle ? (
                  <TextInput
                    style={styles.conversationTitleInput}
                    value={tempTitle}
                    onChangeText={setTempTitle}
                    onBlur={() => {
                      if (tempTitle.trim()) {
                        updateConversation(currentConversationId, { title: tempTitle.trim() });
                      }
                      setEditingTitle(false);
                    }}
                    onSubmitEditing={() => {
                      if (tempTitle.trim()) {
                        updateConversation(currentConversationId, { title: tempTitle.trim() });
                      }
                      setEditingTitle(false);
                    }}
                    autoFocus
                    maxLength={50}
                    returnKeyType="done"
                    placeholderTextColor="rgba(255,255,255,0.5)"
                  />
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      setTempTitle(currentConv.metadata.title || currentConv.metadata.destination || '');
                      setEditingTitle(true);
                    }}
                  >
                    <Text style={styles.conversationTitle} numberOfLines={1}>
                      {currentConv.metadata.title || currentConv.metadata.destination}
                    </Text>
                  </TouchableOpacity>
                )}
                {currentConv.metadata.description && (
                  <Text style={styles.conversationDescription} numberOfLines={1}>
                    {currentConv.metadata.description}
                  </Text>
                )}
              </View>
            );
          }
          return null;
        })()}

        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.length === 0 && (
              <WelcomeScreen 
                locationLoading={locationLoading} 
                userProfile={userProfile}
                userLocation={userLocation || undefined}
                onSetPrompt={setInputText}
                blacklistedParkCodes={blacklistedParkCodes}
                parkMode={parkMode}
                nearbyStateParks={nearbyStateParks}
              />
            )}
            
            <ChatMessages
              messages={messages}
              isLoading={isLoading || globalLoading}
              loadingStatus={loadingStatus || globalLoadingStatus}
              onRetry={async (lastUserMessage) => {
                const retryConversationId = currentConversationId;
                
                // Remove all error messages from conversation
                const cleanedMessages = messages.filter(m => !m.isError);
                setMessages(cleanedMessages);
                setConversationLoading(retryConversationId, true, 'Retrying...');
                
                try {
                  // Use full conversation history for context
                  const chatMessages: ApiChatMessage[] = cleanedMessages.map(m => ({
                    role: m.type === 'user' ? 'user' : 'assistant',
                    content: m.content,
                  }));
                  
                  const context: ChatContext = {
                    userLocation: userLocation ? {
                      city: userLocation.city,
                      state: userLocation.state,
                      nearestAirport: userLocation.nearestAirport,
                    } : undefined,
                    userProfile: userProfile || undefined,
                    maxTravelDistance: maxTravelDistance ?? undefined,
                    blacklistedParkCodes: blacklistedParkCodes.length > 0 ? blacklistedParkCodes : undefined,
                    parkMode: parkMode,
                    // Tool settings for API
                    toolSettings: {
                      languageModel: toolSettings.languageModel,
                      enabledTools: toolSettings.tools.filter(t => t.enabled).map(t => t.id),
                    },
                  };
                  
                  const result = await sendChatMessageWithStream(
                    chatMessages, 
                    context, 
                    MODEL,
                    (toolStatus) => setConversationLoading(retryConversationId, true, toolStatus)
                  );
                  
                  // Build response messages
                  let responseMessages: Message[];
                  if (result.segments && result.segments.length > 1) {
                    responseMessages = result.segments.map((segment, index) => ({
                      id: (Date.now() + index + 1).toString(),
                      type: 'assistant' as const,
                      content: segment,
                      timestamp: new Date(),
                      photos: index === result.segments!.length - 1 ? result.photos : undefined,
                    }));
                  } else {
                    responseMessages = [{
                      id: (Date.now() + 1).toString(),
                      type: 'assistant' as const,
                      content: result.response,
                      timestamp: new Date(),
                      photos: result.photos,
                    }];
                  }
                  
                  // Route to correct conversation
                  if (currentConversationId === retryConversationId) {
                    setMessages(prev => [...prev.filter(m => !m.isError), ...responseMessages]);
                  } else {
                    await addMessagesToConversation(retryConversationId, responseMessages);
                  }
                } catch (error: any) {
                  const errorMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    type: 'assistant',
                    content: "😕 Still having trouble. Please try again later or use the feedback form.",
                    timestamp: new Date(),
                    isError: true,
                    lastUserMessage,
                  };
                  if (currentConversationId === retryConversationId) {
                    setMessages(prev => [...prev.filter(m => !m.isError), errorMessage]);
                  } else {
                    await addMessagesToConversation(retryConversationId, [errorMessage]);
                  }
                } finally {
                  setConversationLoading(retryConversationId, false);
                }
              }}
            />
          </ScrollView>

                    
          <ChatInput
            inputText={inputText}
            onChangeText={setInputText}
            onSend={handleSend}
            isLoading={isLoading}
            hasPhotos={allPhotos.length > 0}
            galleryOpen={showPhotoGallery}
            onOpenGallery={() => setShowPhotoGallery(true)}
          />
          
          {messages.length > 0 && allPhotos.length > 0 && showPhotoGallery && (
            <CollapsibleBottomPanel hasPhotos={true}>
              <PhotoGallery 
                photos={allPhotos} 
                onClose={() => setShowPhotoGallery(false)}
              />
            </CollapsibleBottomPanel>
          )}
        </KeyboardAvoidingView>

        <SideMenu
          visible={menuOpen}
          onClose={() => {
            persistProfile();
            setMenuOpen(false);
          }}
          userProfile={userProfile}
          onSaveProfile={updateProfile}
          onAddProfileSuggestion={addSuggestion}
          conversations={filteredConversations}
          currentConversationId={currentConversationId}
          onLoadConversation={handleLoadConversation}
          onDeleteConversation={deleteConversation}
          onNewConversation={handleStartNewConversation}
          onUpdateConversation={updateConversation}
          onToggleFavorite={toggleFavorite}
          onResetOnboarding={() => {
            setMenuOpen(false);
            resetOnboarding();
          }}
          toolSettings={toolSettings}
          onToggleTool={toggleTool}
          onSetLanguageModel={setLanguageModel}
          onEnableAllTools={enableAllTools}
          onDisableAllTools={disableAllTools}
          enabledToolCount={enabledToolCount}
          totalToolCount={totalToolCount}
          maxTravelDistance={maxTravelDistance}
          onUpdateMaxTravelDistance={updateMaxTravelDistance}
          userLocation={userLocation ? { lat: userLocation.lat!, lng: userLocation.lng!, state: userLocation.state } : null}
          parkMode={parkMode}
          onParkModeChange={handleParkModeChange}
          selectedState={selectedStateParkState}
          onStateChange={setSelectedStateParkState}
          travelDates={travelDates}
          onUpdateTravelDates={updateTravelDates}
        />
        </View>
      </ImageBackground>
    </DarkModeContext.Provider>
    </ParkThemeProvider>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a1a0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 40, 20, 0.75)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
  },
  menuButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: {
    fontSize: 28,
    color: '#FFFFFF',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuLogo: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#166534',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButtonText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  headerLogo: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  conversationHeader: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    alignItems: 'center',
  },
  conversationTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  conversationDescription: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
  conversationTitleInput: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  container: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesContent: {
    paddingBottom: 220,
  },
});

export default HomeScreen;
