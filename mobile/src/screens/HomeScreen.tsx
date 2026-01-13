import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { sendChatMessage, ChatMessage as ApiChatMessage, ChatContext, logErrorToServer } from '../services/api';
import { useLocation, useConversations, useUserProfile, Message } from '../hooks';
import { WelcomeScreen, ChatMessages, ChatInput, SideMenu } from '../components/home';

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
    addMessage,
  } = useConversations(userLocation?.nearestAirport);
  const { 
    userProfile, 
    profileExpanded, 
    saveProfile, 
    addSuggestion, 
    toggleExpanded 
  } = useUserProfile();

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
          <Text style={styles.headerTitle}>TripAgent</Text>
          <View style={styles.menuButton} />
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
              <WelcomeScreen locationLoading={locationLoading} />
            )}
            
            <ChatMessages
              messages={messages}
              isLoading={isLoading}
              loadingStatus={loadingStatus}
              onRetry={async (lastUserMessage) => {
                // Remove the error message
                const cleanedMessages = messages.filter(m => !m.isError);
                setMessages(cleanedMessages);
                
                // Create a new user message and resend
                const retryMessage: Message = {
                  id: Date.now().toString(),
                  type: 'user',
                  content: lastUserMessage,
                  timestamp: new Date(),
                };
                
                const updatedMessages = [...cleanedMessages, retryMessage];
                setMessages(updatedMessages);
                setIsLoading(true);
                setLoadingStatus('Retrying...');
                
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
                  
                  const result = await sendChatMessage(chatMessages, context, selectedModel);
                  
                  const assistantMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    type: 'assistant',
                    content: result.response,
                    timestamp: new Date(),
                  };
                  
                  setMessages(prev => [...prev, assistantMessage]);
                } catch (error: any) {
                  const errorMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    type: 'assistant',
                    content: "😕 Still having trouble. Please try again later or use the feedback form.",
                    timestamp: new Date(),
                    isError: true,
                    lastUserMessage,
                  };
                  setMessages(prev => [...prev, errorMessage]);
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
          />
        </KeyboardAvoidingView>

        <SideMenu
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          userProfile={userProfile}
          profileExpanded={profileExpanded}
          onToggleProfile={toggleExpanded}
          onSaveProfile={saveProfile}
          onAddProfileSuggestion={addSuggestion}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          conversations={savedConversations}
          currentConversationId={currentConversationId}
          onLoadConversation={loadConversation}
          onDeleteConversation={deleteConversation}
          onNewConversation={startNewConversation}
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
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
