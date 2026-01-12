import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  Dimensions,
  ActivityIndicator,
  Modal,
  StatusBar,
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendChatMessage, ChatMessage as ApiChatMessage, ChatContext } from '../services/api';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface SavedConversation {
  id: string;
  messages: Message[];
  metadata: {
    destination?: string;
    travelers?: number;
    departingFrom?: string;
    createdAt: string;
    updatedAt: string;
  };
}

interface UserLocation {
  city: string;
  state: string;
  nearestAirport: string;
}

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const AIRPORT_MAPPING: Record<string, string> = {
  'California': 'LAX',
  'New York': 'JFK',
  'Texas': 'DFW',
  'Florida': 'MIA',
  'Illinois': 'ORD',
  'Washington': 'SEA',
  'Colorado': 'DEN',
  'Arizona': 'PHX',
  'Nevada': 'LAS',
  'Georgia': 'ATL',
  'Massachusetts': 'BOS',
  'Pennsylvania': 'PHL',
  'Ohio': 'CLE',
  'Michigan': 'DTW',
  'Oregon': 'PDX',
};

const PARK_NAMES = ['yosemite', 'yellowstone', 'grand canyon', 'zion', 'glacier', 'acadia', 'rocky mountain', 'joshua tree', 'sequoia', 'death valley'];

interface ModelOption {
  id: string;
  name: string;
  tier: string;
  description: string;
}

const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Haiku',
    tier: '⚡ Fast',
    description: 'Quick responses, basic trip info',
  },
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Sonnet',
    tier: '⭐ Balanced',
    description: 'Best for most trip planning',
  },
  {
    id: 'claude-opus-4-20250514',
    name: 'Opus',
    tier: '🧠 Advanced',
    description: 'Complex itineraries & deep research',
  },
];

const HomeScreen: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('');
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [savedConversations, setSavedConversations] = useState<SavedConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('claude-sonnet-4-20250514');
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    requestLocationPermission();
    loadConversations();
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      autoSaveConversation();
    }
  }, [messages]);

  const loadConversations = async () => {
    try {
      const saved = await AsyncStorage.getItem('travel_conversations');
      if (saved) {
        setSavedConversations(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const extractMetadata = (msgs: Message[]): SavedConversation['metadata'] => {
    const allText = msgs.map(m => m.content.toLowerCase()).join(' ');
    
    let destination: string | undefined;
    for (const park of PARK_NAMES) {
      if (allText.includes(park)) {
        destination = park.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        break;
      }
    }

    let travelers: number | undefined;
    const travelerMatch = allText.match(/(\d+)\s*(people|travelers|persons|adults)/);
    if (travelerMatch) {
      travelers = parseInt(travelerMatch[1]);
    } else if (allText.includes('solo') || allText.includes('just me')) {
      travelers = 1;
    } else if (allText.includes('couple')) {
      travelers = 2;
    }

    return {
      destination,
      travelers,
      departingFrom: userLocation?.nearestAirport,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  const autoSaveConversation = async () => {
    if (messages.length === 0) return;

    try {
      const saved = await AsyncStorage.getItem('travel_conversations');
      let conversations: SavedConversation[] = saved ? JSON.parse(saved) : [];

      const metadata = extractMetadata(messages);

      if (currentConversationId) {
        const index = conversations.findIndex(c => c.id === currentConversationId);
        if (index >= 0) {
          conversations[index] = {
            ...conversations[index],
            messages,
            metadata: { ...conversations[index].metadata, ...metadata, updatedAt: new Date().toISOString() },
          };
        }
      } else {
        const newId = Date.now().toString();
        setCurrentConversationId(newId);
        conversations.unshift({
          id: newId,
          messages,
          metadata,
        });
      }

      conversations = conversations.slice(0, 20);
      await AsyncStorage.setItem('travel_conversations', JSON.stringify(conversations));
      setSavedConversations(conversations);
    } catch (error) {
      console.error('Failed to auto-save:', error);
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      const state = address.region || 'California';
      const nearestAirport = AIRPORT_MAPPING[state] || 'LAX';

      setUserLocation({
        city: address.city || 'Unknown',
        state: state,
        nearestAirport: nearestAirport,
      });
      setLocationLoading(false);

    } catch (error) {
      console.error('Location error:', error);
      setLocationLoading(false);
    }
  };

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
      };

      // Simulate progressive loading states
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
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I had trouble connecting. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const loadConversation = (conversation: SavedConversation) => {
    setMessages(conversation.messages);
    setCurrentConversationId(conversation.id);
    setMenuOpen(false);
  };

  const startNewConversation = () => {
    setMessages([]);
    setCurrentConversationId(null);
    setMenuOpen(false);
  };

  const deleteConversation = async (id: string) => {
    try {
      const updated = savedConversations.filter(c => c.id !== id);
      await AsyncStorage.setItem('travel_conversations', JSON.stringify(updated));
      setSavedConversations(updated);
      if (currentConversationId === id) {
        setMessages([]);
        setCurrentConversationId(null);
      }
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800' }}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <StatusBar barStyle="light-content" />
        {/* Header with Menu Button */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.menuButton} onPress={() => setMenuOpen(true)}>
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>TripAgent</Text>
          <View style={styles.menuButton} />
        </View>

        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.length === 0 && (
              <View style={styles.welcomeContainer}>
                {locationLoading ? (
                  <>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                    <Text style={styles.welcomeText}>Finding your location...</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.welcomeEmoji}>🌲</Text>
                    <Text style={styles.welcomeText}>
                      {userLocation 
                        ? `Hi from ${userLocation.city}!\nWhere would you like to explore?`
                        : 'Where would you like to explore?'}
                    </Text>
                  </>
                )}
              </View>
            )}
            
            {messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageBubble,
                  message.type === 'user' ? styles.userBubble : styles.assistantBubble,
                ]}
              >
                <Text style={[
                  styles.messageText,
                  message.type === 'user' ? styles.userText : styles.assistantText,
                ]}>
                  {message.content}
                </Text>
              </View>
            ))}
            
            {isLoading && (
              <View style={[styles.messageBubble, styles.assistantBubble, styles.loadingBubble]}>
                <ActivityIndicator size="small" color="#FFFFFF" style={styles.loadingSpinner} />
                <Text style={styles.loadingText}>{loadingStatus || 'Thinking...'}</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Ask about parks, flights, or trips..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim() || isLoading}
            >
              <Text style={styles.sendButtonText}>→</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* Side Menu */}
        <Modal
          visible={menuOpen}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setMenuOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.sideMenu}>
              <View style={styles.menuHeader}>
                <Text style={styles.menuTitle}>Recent Trips</Text>
                <TouchableOpacity onPress={() => setMenuOpen(false)}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.newChatButton} onPress={startNewConversation}>
                <Text style={styles.newChatText}>+ New Conversation</Text>
              </TouchableOpacity>

              {/* Model Selection */}
              <View style={styles.modelSection}>
                <Text style={styles.modelSectionTitle}>AI Model</Text>
                {MODEL_OPTIONS.map((model) => (
                  <TouchableOpacity
                    key={model.id}
                    style={[
                      styles.modelOption,
                      selectedModel === model.id && styles.modelOptionSelected,
                    ]}
                    onPress={() => setSelectedModel(model.id)}
                  >
                    <View style={styles.modelOptionHeader}>
                      <Text style={styles.modelName}>{model.name}</Text>
                      <Text style={styles.modelTier}>{model.tier}</Text>
                    </View>
                    <Text style={styles.modelDescription}>{model.description}</Text>
                    {selectedModel === model.id && (
                      <Text style={styles.modelSelected}>✓ Selected</Text>
                    )}
                  </TouchableOpacity>
                ))}
                <Text style={styles.modelNote}>
                  💡 Haiku is fastest, Sonnet balances speed & quality, Opus handles complex planning
                </Text>
              </View>

              <Text style={styles.conversationsTitle}>Saved Trips</Text>

              <ScrollView style={styles.conversationList}>
                {savedConversations.map((conv) => (
                  <View
                    key={conv.id}
                    style={[
                      styles.conversationItem,
                      currentConversationId === conv.id && styles.activeConversation,
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.conversationContent}
                      onPress={() => loadConversation(conv)}
                    >
                      <View style={styles.conversationHeader}>
                        <Text style={styles.conversationDestination}>
                          {conv.metadata.destination ? `🏞️ ${conv.metadata.destination}` : '💬 Trip Planning'}
                        </Text>
                        <Text style={styles.conversationDate}>
                          {formatDate(conv.metadata.updatedAt)}
                        </Text>
                      </View>
                      <View style={styles.conversationMeta}>
                        {conv.metadata.travelers && (
                          <Text style={styles.metaTag}>👥 {conv.metadata.travelers}</Text>
                        )}
                        {conv.metadata.departingFrom && (
                          <Text style={styles.metaTag}>✈️ {conv.metadata.departingFrom}</Text>
                        )}
                      </View>
                      <Text style={styles.conversationPreview} numberOfLines={1}>
                        {conv.messages[0]?.content || 'Empty conversation'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => deleteConversation(conv.id)}
                    >
                      <Text style={styles.deleteIcon}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {savedConversations.length === 0 && (
                  <Text style={styles.emptyText}>No saved conversations yet</Text>
                )}
              </ScrollView>
            </View>
            <TouchableOpacity 
              style={styles.menuBackdrop} 
              onPress={() => setMenuOpen(false)}
              activeOpacity={1}
            />
          </View>
        </Modal>
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
  welcomeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: SCREEN_HEIGHT * 0.2,
  },
  welcomeEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    fontWeight: '300',
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(22, 101, 52, 0.9)',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#1F2937',
  },
  assistantText: {
    color: '#FFFFFF',
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingSpinner: {
    marginRight: 4,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 34,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
    maxHeight: 120,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#166534',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  sideMenu: {
    width: SCREEN_WIDTH * 0.8,
    backgroundColor: '#1a1a2e',
    height: '100%',
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  menuTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    fontSize: 24,
    color: 'rgba(255,255,255,0.7)',
  },
  newChatButton: {
    margin: 16,
    padding: 14,
    backgroundColor: '#166534',
    borderRadius: 12,
    alignItems: 'center',
  },
  newChatText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modelSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modelSectionTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  modelOption: {
    padding: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modelOptionSelected: {
    backgroundColor: 'rgba(22, 101, 52, 0.3)',
    borderColor: '#166534',
  },
  modelOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modelName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modelTier: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  modelDescription: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  modelSelected: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  modelNote: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 16,
  },
  conversationsTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  conversationList: {
    flex: 1,
    paddingHorizontal: 12,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  conversationContent: {
    flex: 1,
    padding: 14,
  },
  deleteButton: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIcon: {
    fontSize: 18,
  },
  activeConversation: {
    backgroundColor: 'rgba(22, 101, 52, 0.3)',
    borderColor: '#166534',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  conversationDestination: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  conversationDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  conversationMeta: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  metaTag: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  conversationPreview: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  emptyText: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.4)',
    marginTop: 40,
    fontSize: 15,
  },
  menuHint: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    padding: 16,
  },
});

export default HomeScreen;
