import { Share, Platform, ActionSheetIOS, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SavedConversation, Message } from '../hooks';
import { sendChatMessage, ChatMessage } from '../services/api';

const ITINERARIES_STORAGE_KEY = 'saved_itineraries';

export interface SavedItinerary {
  id: string;
  conversationId: string;
  destination?: string;
  content: string;
  createdAt: string;
}

/**
 * Clean markdown from text for sharing
 */
const cleanMarkdown = (text: string): string => {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert [text](url) to just text
    .replace(/\*\*/g, '') // Remove bold markers
    .replace(/\*/g, '') // Remove italic markers
    .replace(/#{1,6}\s/g, '') // Remove heading markers
    .trim();
};

/**
 * Formats a conversation as a readable chat transcript
 */
export const formatConversationForShare = (conversation: SavedConversation): string => {
  const { metadata, messages } = conversation;
  
  let content = '🏞️ TripAgent Conversation\n';
  content += '━━━━━━━━━━━━━━━━━━━━━━\n\n';
  
  // Trip header
  if (metadata.destination) {
    content += `📍 ${metadata.destination}`;
    if (metadata.duration) content += ` • ${metadata.duration}`;
    if (metadata.travelDates) content += ` • ${metadata.travelDates}`;
    content += '\n\n';
  }
  
  // Format messages as conversation
  for (const msg of messages) {
    if (msg.isError) continue;
    
    const prefix = msg.type === 'user' ? '👤 Me: ' : '🤖 TripAgent: ';
    let msgContent = cleanMarkdown(msg.content);
    
    // Truncate very long assistant messages
    if (msg.type === 'assistant' && msgContent.length > 800) {
      msgContent = msgContent.substring(0, 797) + '...';
    }
    
    content += `${prefix}${msgContent}\n\n`;
  }
  
  content += '━━━━━━━━━━━━━━━━━━━━━━\n';
  content += '📱 Planned with TripAgent';
  
  return content;
};

/**
 * Share conversation as a chat transcript
 */
export const shareConversation = async (conversation: SavedConversation): Promise<boolean> => {
  try {
    const content = formatConversationForShare(conversation);
    const title = conversation.metadata.destination 
      ? `Trip planning: ${conversation.metadata.destination}`
      : 'My Trip Planning Conversation';
    
    const result = await Share.share(
      {
        message: content,
        title: title,
        ...(Platform.OS === 'ios' && { subject: title }),
      },
      {
        dialogTitle: 'Share your conversation',
        ...(Platform.OS === 'ios' && { subject: title }),
      }
    );
    
    return result.action === Share.sharedAction;
  } catch (error) {
    console.error('Error sharing conversation:', error);
    return false;
  }
};

/**
 * Generate a polished itinerary from the conversation using AI
 */
export const generateItinerary = async (
  conversation: SavedConversation,
  onStatusUpdate?: (status: string) => void
): Promise<string | null> => {
  try {
    onStatusUpdate?.('Creating your itinerary...');
    
    // Extract key details from metadata
    const { metadata } = conversation;
    const tripContext = [
      metadata.destination && `Destination: ${metadata.destination}`,
      metadata.travelDates && `Travel dates: ${metadata.travelDates}`,
      metadata.duration && `Duration: ${metadata.duration}`,
      metadata.travelers && `Travelers: ${metadata.travelers}`,
      metadata.departingFrom && `Departing from: ${metadata.departingFrom}`,
    ].filter(Boolean).join('\n');
    
    // Build conversation history - prioritize recent messages
    const relevantMessages = conversation.messages
      .filter(m => !m.isError)
      .slice(-10); // Focus on the last 10 messages (most relevant)
    
    const conversationSummary = relevantMessages
      .map(m => `${m.type === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');
    
    // Create a focused prompt that forces generation with available info
    const prompt = `You are generating a shareable trip itinerary. You MUST create a complete itinerary using ONLY the information provided below. Do NOT ask for more details - work with what you have and make reasonable assumptions for anything missing.

TRIP DETAILS:
${tripContext || 'Not specified - infer from conversation'}

CONVERSATION CONTEXT (most recent and important):
${conversationSummary}

INSTRUCTIONS:
1. Create a polished, shareable itinerary based on the conversation above
2. Use the most recent assistant recommendations as the primary source
3. If specific dates aren't mentioned, use placeholder dates like "Day 1", "Day 2"
4. If budget isn't specified, provide general cost estimates
5. Fill in reasonable details based on the destination discussed
6. Format with clear sections using emojis for visual appeal

Generate the itinerary now with these sections:
📍 TRIP OVERVIEW
📅 DAILY ITINERARY  
🏨 ACCOMMODATIONS
🚗 TRANSPORTATION
💰 ESTIMATED BUDGET
🎒 PACKING LIST
💡 TIPS & REMINDERS

Be concise but comprehensive. This will be shared with friends and family.`;

    const chatMessages: ChatMessage[] = [
      { role: 'user', content: prompt }
    ];
    
    const response = await sendChatMessage(chatMessages, {});
    
    if (response.response) {
      return response.response;
    }
    return null;
  } catch (error) {
    console.error('Error generating itinerary:', error);
    return null;
  }
};

/**
 * Save itinerary to device storage
 */
export const saveItineraryToDevice = async (
  conversation: SavedConversation,
  itineraryContent: string
): Promise<SavedItinerary | null> => {
  try {
    const itinerary: SavedItinerary = {
      id: Date.now().toString(),
      conversationId: conversation.id,
      destination: conversation.metadata.destination,
      content: itineraryContent,
      createdAt: new Date().toISOString(),
    };
    
    // Load existing itineraries
    const existing = await AsyncStorage.getItem(ITINERARIES_STORAGE_KEY);
    const itineraries: SavedItinerary[] = existing ? JSON.parse(existing) : [];
    
    // Add new itinerary
    itineraries.unshift(itinerary);
    
    // Keep only last 10 itineraries
    const trimmed = itineraries.slice(0, 10);
    
    await AsyncStorage.setItem(ITINERARIES_STORAGE_KEY, JSON.stringify(trimmed));
    
    return itinerary;
  } catch (error) {
    console.error('Error saving itinerary:', error);
    return null;
  }
};

/**
 * Format and share a generated itinerary
 */
export const shareGeneratedItinerary = async (
  itinerary: SavedItinerary
): Promise<boolean> => {
  try {
    let content = '🏞️ My Trip Itinerary\n';
    content += '━━━━━━━━━━━━━━━━━━━━━━\n\n';
    content += cleanMarkdown(itinerary.content);
    content += '\n\n━━━━━━━━━━━━━━━━━━━━━━\n';
    content += '📱 Created with TripAgent';
    
    const title = itinerary.destination 
      ? `Itinerary: ${itinerary.destination}`
      : 'My Trip Itinerary';
    
    const result = await Share.share(
      {
        message: content,
        title: title,
        ...(Platform.OS === 'ios' && { subject: title }),
      },
      {
        dialogTitle: 'Share your itinerary',
        ...(Platform.OS === 'ios' && { subject: title }),
      }
    );
    
    return result.action === Share.sharedAction;
  } catch (error) {
    console.error('Error sharing itinerary:', error);
    return false;
  }
};

/**
 * Show share options action sheet
 */
export const showShareOptions = (
  conversation: SavedConversation,
  onGenerateItinerary: () => void
): void => {
  const options = ['Share Conversation', 'Generate & Share Itinerary', 'Cancel'];
  const cancelButtonIndex = 2;
  
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        title: 'Share Options',
        message: 'Choose how you want to share your trip',
      },
      async (buttonIndex) => {
        if (buttonIndex === 0) {
          await shareConversation(conversation);
        } else if (buttonIndex === 1) {
          onGenerateItinerary();
        }
      }
    );
  } else {
    // Android fallback using Alert
    Alert.alert(
      'Share Options',
      'Choose how you want to share your trip',
      [
        {
          text: 'Share Conversation',
          onPress: async () => {
            await shareConversation(conversation);
          },
        },
        {
          text: 'Generate & Share Itinerary',
          onPress: onGenerateItinerary,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  }
};

// Legacy export for backward compatibility
export const shareItinerary = shareConversation;
