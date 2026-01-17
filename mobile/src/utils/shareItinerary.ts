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
  
  let content = 'TripAgent Conversation\n';
  content += '━━━━━━━━━━━━━━━━━━━━━━\n\n';
  
  // Trip header
  if (metadata.destination) {
    content += `${metadata.destination}`;
    if (metadata.duration) content += ` • ${metadata.duration}`;
    if (metadata.travelDates) content += ` • ${metadata.travelDates}`;
    content += '\n\n';
  }
  
  // Format messages as conversation
  for (const msg of messages) {
    if (msg.isError) continue;
    
    const prefix = msg.type === 'user' ? 'Me: ' : 'TripAgent: ';
    let msgContent = cleanMarkdown(msg.content);
    
    // Truncate very long assistant messages
    if (msg.type === 'assistant' && msgContent.length > 800) {
      msgContent = msgContent.substring(0, 797) + '...';
    }
    
    content += `${prefix}${msgContent}\n\n`;
  }
  
  content += '━━━━━━━━━━━━━━━━━━━━━━\n';
  content += 'Planned with TripAgent';
  
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
 * Extract links from conversation content, categorized by type
 */
const extractLinksFromConversation = (conversation: SavedConversation): Array<{ text: string; url: string; category?: string }> => {
  const links: Array<{ text: string; url: string; category?: string }> = [];
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  
  for (const msg of conversation.messages) {
    if (msg.type === 'assistant') {
      let match: RegExpExecArray | null;
      while ((match = linkRegex.exec(msg.content)) !== null) {
        // Avoid duplicates
        if (!links.some(l => l.url === match![2])) {
          const url = match[2];
          const text = match[1];
          
          // Categorize links by type
          let category = 'general';
          if (url.includes('opentable.com') || url.includes('resy.com') || text.toLowerCase().includes('reserv')) {
            category = 'reservation';
          } else if (url.includes('yelp.com') || url.includes('google.com/maps') || text.toLowerCase().includes('review')) {
            category = 'review';
          } else if (url.includes('nps.gov')) {
            category = 'park';
          } else if (url.includes('booking.com') || url.includes('hotels.com') || url.includes('airbnb.com')) {
            category = 'lodging';
          } else if (url.includes('amadeus') || url.includes('flight') || text.toLowerCase().includes('flight')) {
            category = 'flight';
          }
          
          links.push({ text, url, category });
        }
      }
    }
  }
  return links;
};

/**
 * Check if user declined an item in the conversation
 */
const isItemDeclined = (conversation: SavedConversation, itemName: string): boolean => {
  const declinePatterns = [
    /no,?\s*(i'?m?\s*)?(not|won't|don't|skip|pass|decline)/i,
    /let'?s?\s*(skip|pass|not)/i,
    /i('?ll|'?m)?\s*(skip|pass|not\s*(going|book|interest))/i,
    /won'?t\s*(be\s*)?(book|go|need)/i,
    /don'?t\s*(need|want|book)/i,
  ];
  
  const itemLower = itemName.toLowerCase();
  
  for (const msg of conversation.messages) {
    if (msg.type === 'user') {
      const contentLower = msg.content.toLowerCase();
      // Check if user mentioned the item and declined it
      if (contentLower.includes(itemLower)) {
        for (const pattern of declinePatterns) {
          if (pattern.test(msg.content)) {
            return true;
          }
        }
      }
    }
  }
  return false;
};

/**
 * Generate a polished itinerary from the conversation using AI
 */
export const generateItinerary = async (
  conversation: SavedConversation,
  onStatusUpdate?: (status: string) => void,
  userProfile?: string
): Promise<{ content: string; photos: PhotoReference[]; links: Array<{ text: string; url: string }> } | null> => {
  try {
    onStatusUpdate?.('Creating your itinerary...');
    
    // Extract photos and links from conversation
    const photos = extractPhotosFromConversation(conversation);
    const allLinks = extractLinksFromConversation(conversation);
    
    // Categorize links for the prompt
    const reservationLinks = allLinks.filter(l => l.category === 'reservation');
    const reviewLinks = allLinks.filter(l => l.category === 'review');
    const parkLinks = allLinks.filter(l => l.category === 'park');
    const lodgingLinks = allLinks.filter(l => l.category === 'lodging');
    const otherLinks = allLinks.filter(l => !['reservation', 'review', 'park', 'lodging'].includes(l.category || ''));
    
    // Extract key details from metadata
    const { metadata } = conversation;
    const tripContext = [
      metadata.destination && `Destination: ${metadata.destination}`,
      metadata.travelDates && `Travel dates: ${metadata.travelDates}`,
      metadata.duration && `Duration: ${metadata.duration}`,
      metadata.travelers && `Travelers: ${metadata.travelers}`,
      metadata.departingFrom && `Departing from: ${metadata.departingFrom}`,
    ].filter(Boolean).join('\n');
    
    // Build user preferences context
    let preferencesContext = '';
    if (userProfile) {
      preferencesContext = `\nTRAVELER PREFERENCES:\n${userProfile}\n`;
    }
    
    // Build links context for the AI
    let linksContext = '\nAVAILABLE LINKS TO INCLUDE:\n';
    if (reservationLinks.length > 0) {
      linksContext += `Reservation Links: ${reservationLinks.map(l => `[${l.text}](${l.url})`).join(', ')}\n`;
    }
    if (reviewLinks.length > 0) {
      linksContext += `Review Links: ${reviewLinks.map(l => `[${l.text}](${l.url})`).join(', ')}\n`;
    }
    if (parkLinks.length > 0) {
      linksContext += `Park Info Links: ${parkLinks.map(l => `[${l.text}](${l.url})`).join(', ')}\n`;
    }
    if (lodgingLinks.length > 0) {
      linksContext += `Lodging Links: ${lodgingLinks.map(l => `[${l.text}](${l.url})`).join(', ')}\n`;
    }
    if (otherLinks.length > 0) {
      linksContext += `Other Links: ${otherLinks.map(l => `[${l.text}](${l.url})`).join(', ')}\n`;
    }
    
    // Build conversation history - prioritize recent messages
    const relevantMessages = conversation.messages
      .filter(m => !m.isError)
      .slice(-12); // Focus on the last 12 messages
    
    const conversationSummary = relevantMessages
      .map(m => `${m.type === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');
    
    // Create a focused prompt that forces generation with available info
    const prompt = `You are generating a shareable trip itinerary. You MUST create a complete itinerary using ONLY the information provided below. Do NOT ask for more details - work with what you have and make reasonable assumptions for anything missing.

TRIP DETAILS:
${tripContext || 'Not specified - infer from conversation'}
${preferencesContext}
CONVERSATION CONTEXT (most recent and important):
${conversationSummary}
${linksContext}
CRITICAL INSTRUCTIONS:
1. Create a polished, shareable itinerary based on the conversation above
2. Use the most recent assistant recommendations as the primary source
3. If specific dates aren't mentioned, use placeholder dates like "Day 1", "Day 2"
4. If budget isn't specified, provide general cost estimates
5. Fill in reasonable details based on the destination discussed
6. IMPORTANT: Include relevant links from the AVAILABLE LINKS section above:
   - Add reservation links next to restaurants (e.g., "Dinner at Restaurant Name - [Make Reservation](link)")
   - Add review links so users can read more (e.g., "[Read Reviews](link)")
   - Include park information links in relevant sections
7. DO NOT include items the user explicitly declined or said they wouldn't book
8. Consider the traveler preferences when formatting recommendations
9. If the user is a Foodie, Coffee hound, Book worm, or Historian, highlight relevant spots
10. Format with clear sections for visual appeal

Generate the itinerary now with these sections:
## Trip Overview
## Daily Itinerary (include restaurant reservations and activity links)
## Dining Recommendations (with reservation links where available)
## Accommodations
## Transportation
## Useful Links (categorized: Reviews, Reservations, Park Info)
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
        links: allLinks,
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
