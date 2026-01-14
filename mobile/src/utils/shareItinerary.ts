import { Share, Platform, ActionSheetIOS, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SavedConversation, Message } from '../hooks';
import { sendChatMessage, ChatMessage, createHtmlItinerary, PhotoReference } from '../services/api';

const ITINERARIES_STORAGE_KEY = 'saved_itineraries';

export interface SavedItinerary {
  id: string;
  conversationId: string;
  destination?: string;
  content: string;
  createdAt: string;
  htmlUrl?: string;
  photos?: PhotoReference[];
  links?: Array<{ text: string; url: string }>;
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
 * Extract all photos from conversation messages
 */
const extractPhotosFromConversation = (conversation: SavedConversation): PhotoReference[] => {
  const photos: PhotoReference[] = [];
  for (const msg of conversation.messages) {
    if (msg.photos && msg.photos.length > 0) {
      photos.push(...msg.photos);
    }
  }
  return photos;
};

/**
 * Extract links from conversation content
 */
const extractLinksFromConversation = (conversation: SavedConversation): Array<{ text: string; url: string }> => {
  const links: Array<{ text: string; url: string }> = [];
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  
  for (const msg of conversation.messages) {
    if (msg.type === 'assistant') {
      let match: RegExpExecArray | null;
      while ((match = linkRegex.exec(msg.content)) !== null) {
        // Avoid duplicates
        if (!links.some(l => l.url === match![2])) {
          links.push({ text: match[1], url: match[2] });
        }
      }
    }
  }
  return links;
};

/**
 * Generate a polished itinerary from the conversation using AI
 */
export const generateItinerary = async (
  conversation: SavedConversation,
  onStatusUpdate?: (status: string) => void
): Promise<{ content: string; photos: PhotoReference[]; links: Array<{ text: string; url: string }> } | null> => {
  try {
    onStatusUpdate?.('Creating your itinerary...');
    
    // Extract photos and links from conversation
    const photos = extractPhotosFromConversation(conversation);
    const links = extractLinksFromConversation(conversation);
    
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
6. IMPORTANT: Preserve any links from the conversation in markdown format [text](url)
7. Format with clear sections for visual appeal

Generate the itinerary now with these sections:
## Trip Overview
## Daily Itinerary  
## Accommodations
## Transportation
## Estimated Budget
## Packing List
## Tips & Reminders

Be concise but comprehensive. This will be shared with friends and family.`;

    const chatMessages: ChatMessage[] = [
      { role: 'user', content: prompt }
    ];
    
    const response = await sendChatMessage(chatMessages, {});
    
    if (response.response) {
      return {
        content: response.response,
        photos,
        links,
      };
    }
    return null;
  } catch (error) {
    console.error('Error generating itinerary:', error);
    return null;
  }
};

/**
 * Save itinerary to device storage and create HTML version
 */
export const saveItineraryToDevice = async (
  conversation: SavedConversation,
  itineraryData: { content: string; photos: PhotoReference[]; links: Array<{ text: string; url: string }> }
): Promise<SavedItinerary | null> => {
  try {
    // Create HTML itinerary on server
    let htmlUrl: string | undefined;
    try {
      const htmlResult = await createHtmlItinerary({
        content: itineraryData.content,
        destination: conversation.metadata.destination,
        photos: itineraryData.photos,
        links: itineraryData.links,
      });
      htmlUrl = htmlResult.url;
    } catch (e) {
      console.warn('Failed to create HTML itinerary:', e);
    }
    
    const itinerary: SavedItinerary = {
      id: Date.now().toString(),
      conversationId: conversation.id,
      destination: conversation.metadata.destination,
      content: itineraryData.content,
      createdAt: new Date().toISOString(),
      htmlUrl,
      photos: itineraryData.photos,
      links: itineraryData.links,
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
    const title = itinerary.destination 
      ? `Itinerary: ${itinerary.destination}`
      : 'My Trip Itinerary';
    
    // If we have an HTML URL, share that
    if (itinerary.htmlUrl) {
      const result = await Share.share(
        {
          message: `Check out my trip itinerary for ${itinerary.destination || 'my upcoming trip'}!\n\n${itinerary.htmlUrl}`,
          title: title,
          url: itinerary.htmlUrl,
          ...(Platform.OS === 'ios' && { subject: title }),
        },
        {
          dialogTitle: 'Share your itinerary',
          ...(Platform.OS === 'ios' && { subject: title }),
        }
      );
      return result.action === Share.sharedAction;
    }
    
    // Fallback to text sharing
    let content = 'My Trip Itinerary\n';
    content += '━━━━━━━━━━━━━━━━━━━━━━\n\n';
    content += cleanMarkdown(itinerary.content);
    content += '\n\n━━━━━━━━━━━━━━━━━━━━━━\n';
    content += 'Created with TripAgent';
    
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
 * Open HTML itinerary in browser
 */
export const viewHtmlItinerary = async (itinerary: SavedItinerary): Promise<void> => {
  if (itinerary.htmlUrl) {
    await Linking.openURL(itinerary.htmlUrl);
  } else {
    Alert.alert('Not Available', 'HTML version is not available for this itinerary.');
  }
};

/**
 * Show share options action sheet
 */
export const showShareOptions = (
  conversation: SavedConversation,
  onGenerateItinerary: () => void
): void => {
  const options = ['Share Conversation', 'Generate Web Itinerary (Beta)', 'Cancel'];
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
          text: 'Generate Web Itinerary (Beta)',
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
