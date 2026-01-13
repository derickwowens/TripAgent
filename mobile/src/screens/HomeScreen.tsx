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
} from 'react-native';
import { sendChatMessage, ChatMessage as ApiChatMessage, ChatContext, logErrorToServer } from '../services/api';
import { useLocation, useConversations, useUserProfile, Message, SavedConversation } from '../hooks';
import { WelcomeScreen, ConsiderationsHint, ChatMessages, ChatInput, SideMenu, PhotoGallery, CollapsibleBottomPanel } from '../components/home';
import { showShareOptions, generateItinerary, saveItineraryToDevice, shareGeneratedItinerary } from '../utils/shareItinerary';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

const HomeScreen: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
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
    addMessage,
  } = useConversations(userLocation?.nearestAirport);
  const { 
    userProfile, 
    profileExpanded, 
    saveProfile, 
    addSuggestion, 
    toggleExpanded 
  } = useUserProfile();

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

      const loadingStates = [
        '🔍 Searching for information...',
        '✈️ Checking flight options...',
        '🏕️ Finding camping & lodging...',
        '🥾 Loading hiking trails...',
        '📝 Compiling your trip plan...',
      ];
      
      let stateIndex = 0;
      const statusInterval = setInterval(() => {
        if (stateIndex < loadingStates.length) {
          setLoadingStatus(loadingStates[stateIndex]);
          stateIndex++;
        }
      }, 1500);

      const response = await sendChatMessage(chatMessages, context, selectedModel);
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
          model: selectedModel,
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

      const loadingStates = [
        '🔍 Searching for information...',
        '✈️ Checking flight options...',
        '🏕️ Finding camping & lodging...',
        '🥾 Loading hiking trails...',
        '📝 Compiling your trip plan...',
      ];
      
      let stateIndex = 0;
      const statusInterval = setInterval(() => {
        if (stateIndex < loadingStates.length) {
          setLoadingStatus(loadingStates[stateIndex]);
          stateIndex++;
        }
      }, 1500);

      const response = await sendChatMessage(chatMessages, context, selectedModel);
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
      const itineraryContent = await generateItinerary(conversation, setLoadingStatus);
      
      if (itineraryContent) {
        const saved = await saveItineraryToDevice(conversation, itineraryContent);
        setIsLoading(false);
        setLoadingStatus('');
        
        if (saved) {
          Alert.alert(
            'Itinerary Created!',
            'Your itinerary has been saved. Would you like to share it now?',
            [
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

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800' }}
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
                  
                  const result = await sendChatMessage(chatMessages, context, selectedModel);
                  
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

          {messages.length === 0 && <ConsiderationsHint />}
          
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
          onClose={() => setMenuOpen(false)}
          userProfile={userProfile}
          onSaveProfile={saveProfile}
          onAddProfileSuggestion={addSuggestion}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          conversations={savedConversations}
          currentConversationId={currentConversationId}
          onLoadConversation={loadConversation}
          onDeleteConversation={deleteConversation}
          onNewConversation={startNewConversation}
          onUpdateConversation={updateConversation}
        />
      </View>
    </ImageBackground>
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
