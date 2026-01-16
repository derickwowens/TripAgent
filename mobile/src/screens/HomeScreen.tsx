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
import { sendChatMessage, ChatMessage as ApiChatMessage, ChatContext, logErrorToServer } from '../services/api';
import { useLocation, useConversations, useUserProfile, useDarkMode, DarkModeContext, Message, SavedConversation } from '../hooks';
import { WelcomeScreen, ChatMessages, ChatInput, SideMenu, PhotoGallery, CollapsibleBottomPanel } from '../components/home';
import { showShareOptions, generateItinerary, saveItineraryToDevice, shareGeneratedItinerary } from '../utils/shareItinerary';

// Use Haiku for faster responses - tools handle the heavy lifting
const MODEL = 'claude-3-5-haiku-20241022';

// Default forest background
const DEFAULT_BACKGROUND_URL = 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800';

// Generate context-aware loading messages based on user's query
const getLoadingStatesForQuery = (query: string): string[] => {
  const q = query.toLowerCase();
  const states: string[] = [];
  
  // Detect what the user is asking about
  const isAskingAboutFlights = /flight|fly|airport|airline/i.test(q);
  const isAskingAboutHotels = /hotel|lodging|stay|accommodat|room/i.test(q);
  const isAskingAboutCars = /car|rental|rent|drive/i.test(q);
  const isAskingAboutParks = /park|hike|trail|camping|camp|national|yosemite|yellowstone|zion|glacier|canyon|sequoia|acadia|olympic|everglades|smoky/i.test(q);
  const isAskingAboutActivities = /tour|activity|activities|things to do|experience/i.test(q);
  const isAskingAboutEV = /tesla|ev|charging|electric/i.test(q);
  const isPlanningTrip = /trip|plan|itinerary|vacation|travel|visit|going to|heading to/i.test(q);
  
  // plan_park_trip is triggered when asking about parks - it fetches everything
  const isParkTrip = isAskingAboutParks && (isPlanningTrip || /want|like|help|tell me|show me|info|about/i.test(q));
  
  // Add relevant loading states based on detected intent
  if (isAskingAboutParks) {
    states.push('🏞️ Searching national parks...');
    states.push('🥾 Finding hiking trails...');
    states.push('🏕️ Checking campground availability...');
  }
  
  // park trips trigger full plan_park_trip which fetches flights, hotels, cars
  if (isAskingAboutFlights || isPlanningTrip || isParkTrip) {
    states.push('✈️ Searching flight options...');
  }
  
  if (isAskingAboutHotels || isPlanningTrip || isParkTrip) {
    states.push('🏨 Finding hotels & lodging...');
  }
  
  if (isAskingAboutCars || isPlanningTrip || isParkTrip) {
    states.push('🚗 Checking car rental prices...');
  }
  
  if (isAskingAboutActivities) {
    states.push('🎫 Discovering tours & activities...');
  }
  
  if (isAskingAboutEV) {
    states.push('⚡ Locating charging stations...');
  }
  
  if (isPlanningTrip || isParkTrip) {
    states.push('🗺️ Calculating driving distances...');
    states.push('📝 Compiling your trip plan...');
  }
  
  // Always end with a compilation message if we have multiple steps
  if (states.length > 2) {
    states.push('✨ Putting it all together...');
  }
  
  // Fallback if no specific intent detected
  if (states.length === 0) {
    states.push('🔍 Searching for information...');
  }
  
  return states;
};

const HomeScreen: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
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
    addSuggestion, 
    toggleExpanded 
  } = useUserProfile();
  const { isDarkMode, toggleDarkMode } = useDarkMode();

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
  const allPhotos = useMemo(() => {
    const photos: Array<{ keyword: string; url: string; caption?: string }> = [];
    const MAX_PHOTOS = 24;
    const RECENT_MESSAGES_COUNT = 3;
    
    // Get the last N assistant messages that have photos
    const recentAssistantMessages = messages
      .filter(msg => msg.type === 'assistant' && msg.photos && msg.photos.length > 0)
      .slice(-RECENT_MESSAGES_COUNT);
    
    recentAssistantMessages.forEach(msg => {
      if (msg.photos && photos.length < MAX_PHOTOS) {
        msg.photos.forEach(photo => {
          // Avoid duplicates by URL, respect limit
          if (photos.length < MAX_PHOTOS && !photos.some(p => p.url === photo.url)) {
            photos.push(photo);
          }
        });
      }
    });
    return photos;
  }, [messages]);

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

      // Get context-aware loading states based on user's query
      const loadingStates = getLoadingStatesForQuery(inputText);
      
      let stateIndex = 0;
      setLoadingStatus(loadingStates[0]);
      const statusInterval = setInterval(() => {
        stateIndex++;
        if (stateIndex < loadingStates.length) {
          setLoadingStatus(loadingStates[stateIndex]);
        }
      }, 2000);

      const response = await sendChatMessage(chatMessages, context, MODEL);
      clearInterval(statusInterval);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response.response,
        timestamp: new Date(),
        photos: response.photos,
      };

      setMessages(prev => [...prev, assistantMessage]);
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
      
      // Generate user-friendly error message based on error type
      let userFriendlyMessage = '';
      const statusCode = error?.response?.status;
      
      if (statusCode === 500) {
        userFriendlyMessage = "🔧 Our servers are experiencing high demand right now. Please try again in a moment. Your trip planning request has been saved.";
      } else if (statusCode === 503) {
        userFriendlyMessage = "🔄 TripAgent is temporarily unavailable for maintenance. Please try again in a few minutes.";
      } else if (statusCode === 429) {
        userFriendlyMessage = "⏳ You're sending requests too quickly. Please wait a moment before trying again.";
      } else if (statusCode === 401 || statusCode === 403) {
        userFriendlyMessage = "🔐 There was an authentication issue. Please restart the app and try again.";
      } else if (error?.message?.includes('Network') || error?.message?.includes('network') || !statusCode) {
        userFriendlyMessage = "📶 Unable to connect. Please check your internet connection and try again.";
      } else if (statusCode >= 400 && statusCode < 500) {
        userFriendlyMessage = "⚠️ Something went wrong with your request. Please try rephrasing your question.";
      } else {
        userFriendlyMessage = "😕 Something unexpected happened. Please try again, or reach out via the feedback form in the menu if this persists.";
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

      // Get context-aware loading states based on user's query
      const loadingStates = getLoadingStatesForQuery(messageContent);
      
      let stateIndex = 0;
      setLoadingStatus(loadingStates[0]);
      const statusInterval = setInterval(() => {
        stateIndex++;
        if (stateIndex < loadingStates.length) {
          setLoadingStatus(loadingStates[stateIndex]);
        }
      }, 2000);

      const response = await sendChatMessage(chatMessages, context, MODEL);
      clearInterval(statusInterval);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response.response,
        timestamp: new Date(),
        photos: response.photos,
      };

      setMessages(prev => [...prev, assistantMessage]);
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
      const itineraryData = await generateItinerary(conversation, setLoadingStatus);
      
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

  // Use first destination photo as background if available
  const backgroundUrl = allPhotos.length > 0 ? allPhotos[0].url : DEFAULT_BACKGROUND_URL;

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
                  
                  const result = await sendChatMessage(chatMessages, context, MODEL);
                  
                  const assistantMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    type: 'assistant',
                    content: result.response,
                    timestamp: new Date(),
                    photos: result.photos,
                  };
                  
                  setMessages(prev => [...prev.filter(m => !m.isError), assistantMessage]);
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

                    
          {messages.length > 0 ? (
            <CollapsibleBottomPanel hasPhotos={allPhotos.length > 0}>
              <ChatInput
                inputText={inputText}
                onChangeText={setInputText}
                onSend={handleSend}
                isLoading={isLoading}
              />
              
              {allPhotos.length > 0 && (
                <PhotoGallery photos={allPhotos} />
              )}
            </CollapsibleBottomPanel>
          ) : (
            <ChatInput
              inputText={inputText}
              onChangeText={setInputText}
              onSend={handleSend}
              isLoading={isLoading}
            />
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
    paddingBottom: 20,
  },
});

export default HomeScreen;
