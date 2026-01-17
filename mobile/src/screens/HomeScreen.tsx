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
import { sendChatMessageWithStream, ChatMessage as ApiChatMessage, ChatContext, logErrorToServer } from '../services/api';
import { useLocation, useConversations, useUserProfile, useDarkMode, DarkModeContext, getLoadingStatesForQuery, Message, SavedConversation, PhotoReference, useOnboarding } from '../hooks';
import { WelcomeScreen, ChatMessages, ChatInput, SideMenu, PhotoGallery, CollapsibleBottomPanel, OnboardingFlow } from '../components/home';
import { showShareOptions, generateItinerary, saveItineraryToDevice, shareGeneratedItinerary } from '../utils/shareItinerary';

// Use Haiku for faster responses - tools handle the heavy lifting
const MODEL = 'claude-3-5-haiku-20241022';

// Variety of nature/national park backgrounds for new conversations
const DEFAULT_BACKGROUNDS = [
  // Forests & Mountains
  'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800', // Misty forest
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800', // Mountain peaks
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800', // Snowy mountains
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', // Alpine sunrise
  // Canyons & Deserts
  'https://images.unsplash.com/photo-1474044159687-1ee9f3a51722?w=800', // Grand Canyon
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800', // Desert road
  'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800', // Arches
  // Lakes & Water
  'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800', // Mountain lake
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800', // Beach sunset
  'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=800', // Waterfall
  // National Parks
  'https://images.unsplash.com/photo-1472396961693-142e6e269027?w=800', // Deer in meadow
  'https://images.unsplash.com/photo-1414609245224-afa02bfb3fda?w=800', // Yosemite valley
  'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800', // Camping tent
  'https://images.unsplash.com/photo-1542224566-6e85f2e6772f?w=800', // Redwood trees
];

// Get a random background for new conversations
const getRandomBackground = () => DEFAULT_BACKGROUNDS[Math.floor(Math.random() * DEFAULT_BACKGROUNDS.length)];

const HomeScreen: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [defaultBackground] = useState(() => getRandomBackground()); // Random bg per session
  const [showPhotoGallery, setShowPhotoGallery] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);

  const { userLocation, locationLoading } = useLocation();
  const { 
    messages, 
    setMessages,
    savedConversations, 
    currentConversationId,
    loadConversation, 
    startNewConversation, 
    deleteConversation,
    updateConversation,
    toggleFavorite,
    addMessage,
  } = useConversations(userLocation?.nearestAirport);
  const { 
    userProfile, 
    profileExpanded, 
    updateProfile, 
    persistProfile,
    updateAndPersistProfile,
    addSuggestion, 
    toggleExpanded 
  } = useUserProfile();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const { hasCompletedOnboarding, isLoading: onboardingLoading, completeOnboarding } = useOnboarding();

  // Handle onboarding completion
  const handleOnboardingComplete = async (profile: string, firstPrompt?: string) => {
    // Save the profile from onboarding - use updateAndPersistProfile to ensure it's saved immediately
    if (profile) {
      await updateAndPersistProfile(profile);
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

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

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
    setIsLoading(true);
    setLoadingStatus('Thinking...');

    try {
      const chatMessages: ApiChatMessage[] = updatedMessages.map(m => ({
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
      };

      // Start with initial loading state
      setLoadingStatus('Thinking...');

      // Use streaming to get real-time tool status updates
      const response = await sendChatMessageWithStream(
        chatMessages, 
        context, 
        MODEL,
        (toolStatus) => setLoadingStatus(toolStatus)
      );
      
      // If segments are provided, create multiple message bubbles for better display
      if (response.segments && response.segments.length > 1) {
        const segmentMessages: Message[] = response.segments.map((segment, index) => ({
          id: (Date.now() + index + 1).toString(),
          type: 'assistant' as const,
          content: segment,
          timestamp: new Date(),
          // Only attach photos to the last segment
          photos: index === response.segments!.length - 1 ? response.photos : undefined,
        }));
        setMessages(prev => [...prev, ...segmentMessages]);
      } else {
        // Single message as before
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: response.response,
          timestamp: new Date(),
          photos: response.photos,
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
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
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleSendWithMessage = async (messageContent: string) => {
    if (!messageContent.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: messageContent.trim(),
      timestamp: new Date(),
    };

    const updatedMessages = [userMessage];
    setMessages(updatedMessages);
    setIsLoading(true);
    setLoadingStatus('Thinking...');

    try {
      const chatMessages: ApiChatMessage[] = updatedMessages.map(m => ({
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
      };

      // Start with initial loading state
      setLoadingStatus('Thinking...');

      // Use streaming to get real-time tool status updates
      const response = await sendChatMessageWithStream(
        chatMessages, 
        context, 
        MODEL,
        (toolStatus) => setLoadingStatus(toolStatus)
      );
      
      // If segments are provided, create multiple message bubbles for better display
      if (response.segments && response.segments.length > 1) {
        const segmentMessages: Message[] = response.segments.map((segment, index) => ({
          id: (Date.now() + index + 1).toString(),
          type: 'assistant' as const,
          content: segment,
          timestamp: new Date(),
          // Only attach photos to the last segment
          photos: index === response.segments!.length - 1 ? response.photos : undefined,
        }));
        setMessages(prev => [...prev, ...segmentMessages]);
      } else {
        // Single message as before
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: response.response,
          timestamp: new Date(),
          photos: response.photos,
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
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
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleGenerateItinerary = async (conversation: SavedConversation) => {
    setMenuOpen(false);
    setIsLoading(true);
    setLoadingStatus('Generating your itinerary...');
    
    try {
      const itineraryData = await generateItinerary(conversation, setLoadingStatus, userProfile || undefined);
      
      if (itineraryData) {
        setLoadingStatus('Creating shareable page...');
        const saved = await saveItineraryToDevice(conversation, itineraryData);
        setIsLoading(false);
        setLoadingStatus('');
        
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
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  // Use first destination photo as background if available, otherwise use random default
  const backgroundUrl = allPhotos.length > 0 ? allPhotos[0].url : defaultBackground;

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

  return (
    <DarkModeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
      <ImageBackground
        source={{ uri: backgroundUrl }}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
          <StatusBar barStyle="light-content" />
        
        <View style={styles.header}>
          <TouchableOpacity style={styles.menuButton} onPress={() => setMenuOpen(true)}>
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
          {messages.length > 0 ? (
            <Image 
              source={require('../../assets/icon.png')} 
              style={styles.headerLogo}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.headerLogo} />
          )}
          {messages.length > 0 ? (
            <TouchableOpacity 
              style={styles.shareButton} 
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
              />
            )}
            
            <ChatMessages
              messages={messages}
              isLoading={isLoading}
              loadingStatus={loadingStatus}
              onRetry={async (lastUserMessage) => {
                // Remove all error messages from conversation
                const cleanedMessages = messages.filter(m => !m.isError);
                setMessages(cleanedMessages);
                setIsLoading(true);
                setLoadingStatus('Retrying...');
                
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
                  };
                  
                  const result = await sendChatMessageWithStream(
                    chatMessages, 
                    context, 
                    MODEL,
                    (toolStatus) => setLoadingStatus(toolStatus)
                  );
                  
                  // If segments are provided, create multiple message bubbles
                  if (result.segments && result.segments.length > 1) {
                    const segmentMessages: Message[] = result.segments.map((segment, index) => ({
                      id: (Date.now() + index + 1).toString(),
                      type: 'assistant' as const,
                      content: segment,
                      timestamp: new Date(),
                      photos: index === result.segments!.length - 1 ? result.photos : undefined,
                    }));
                    setMessages(prev => [...prev.filter(m => !m.isError), ...segmentMessages]);
                  } else {
                    const assistantMessage: Message = {
                      id: (Date.now() + 1).toString(),
                      type: 'assistant',
                      content: result.response,
                      timestamp: new Date(),
                      photos: result.photos,
                    };
                    setMessages(prev => [...prev.filter(m => !m.isError), assistantMessage]);
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
                  setMessages(prev => [...prev.filter(m => !m.isError), errorMessage]);
                } finally {
                  setIsLoading(false);
                  setLoadingStatus('');
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
          conversations={savedConversations}
          currentConversationId={currentConversationId}
          onLoadConversation={loadConversation}
          onDeleteConversation={deleteConversation}
          onNewConversation={startNewConversation}
          onUpdateConversation={updateConversation}
          onToggleFavorite={toggleFavorite}
        />
        </View>
      </ImageBackground>
    </DarkModeContext.Provider>
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
