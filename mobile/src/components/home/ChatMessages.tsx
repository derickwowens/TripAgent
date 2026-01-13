import React, { useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { Message, PhotoReference } from '../../hooks';
import { ImageModal } from './ImageModal';
import { PhotoGallery } from './PhotoGallery';

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  loadingStatus: string;
  onRetry?: (lastUserMessage: string) => void;
}

// Parse markdown links [text](url) and plain URLs, with photo keyword detection
const parseMessageContent = (
  content: string, 
  isUser: boolean,
  photos?: PhotoReference[]
): Array<{ type: 'text' | 'link' | 'photo'; text: string; url?: string; caption?: string }> => {
  // Regex for markdown links: [text](url)
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  
  const parts: Array<{ type: 'text' | 'link' | 'photo'; text: string; url?: string; caption?: string }> = [];

  // First pass: find markdown links
  const processedContent = content.replace(markdownLinkRegex, (match, text, url) => {
    return `{{LINK:${text}::${url}}}`;
  });

  // Split by our link markers and plain URLs
  const segments = processedContent.split(/({{LINK:[^}]+}}|https?:\/\/[^\s\)]+)/g);
  
  segments.forEach((segment) => {
    if (!segment) return;
    
    if (segment.startsWith('{{LINK:')) {
      const inner = segment.slice(7, -2);
      const [text, url] = inner.split('::');
      parts.push({ type: 'link', text, url });
    } else if (segment.match(/^https?:\/\//)) {
      parts.push({ type: 'link', text: segment, url: segment });
    } else if (segment.trim()) {
      // Check if this text segment contains any photo keywords
      if (photos && photos.length > 0) {
        let remainingText = segment;
        let foundPhoto = false;
        
        for (const photo of photos) {
          const keywordLower = photo.keyword.toLowerCase();
          const textLower = remainingText.toLowerCase();
          const keywordIndex = textLower.indexOf(keywordLower);
          
          if (keywordIndex !== -1) {
            foundPhoto = true;
            // Add text before the keyword
            if (keywordIndex > 0) {
              parts.push({ type: 'text', text: remainingText.substring(0, keywordIndex) });
            }
            // Add the photo link (preserve original case from text)
            const originalKeyword = remainingText.substring(keywordIndex, keywordIndex + photo.keyword.length);
            parts.push({ 
              type: 'photo', 
              text: originalKeyword, 
              url: photo.url, 
              caption: photo.caption 
            });
            // Continue with remaining text
            remainingText = remainingText.substring(keywordIndex + photo.keyword.length);
            break; // Only match first occurrence per segment
          }
        }
        
        if (!foundPhoto) {
          parts.push({ type: 'text', text: segment });
        } else if (remainingText) {
          // Recursively parse remaining text for more keywords
          const remainingParts = parseMessageContent(remainingText, isUser, photos);
          parts.push(...remainingParts);
        }
      } else {
        parts.push({ type: 'text', text: segment });
      }
    }
  });

  return parts;
};

interface MessageContentProps {
  content: string;
  isUser: boolean;
  photos?: PhotoReference[];
  onPhotoPress: (url: string, caption?: string) => void;
}

const MessageContent: React.FC<MessageContentProps> = ({ content, isUser, photos, onPhotoPress }) => {
  const parts = parseMessageContent(content, isUser, photos);
  
  return (
    <Text style={[styles.text, isUser ? styles.userText : styles.assistantText]}>
      {parts.map((part, index) => {
        if (part.type === 'link' && part.url) {
          return (
            <Text
              key={index}
              style={[styles.link, isUser ? styles.userLink : styles.assistantLink]}
              onPress={() => Linking.openURL(part.url!)}
            >
              {part.text}
            </Text>
          );
        }
        if (part.type === 'photo' && part.url) {
          return (
            <Text
              key={index}
              style={[styles.photoLink, isUser ? styles.userPhotoLink : styles.assistantPhotoLink]}
              onPress={() => onPhotoPress(part.url!, part.caption)}
            >
              {part.text}
              <Text style={styles.photoIcon}> 📷</Text>
            </Text>
          );
        }
        return <Text key={index}>{part.text}</Text>;
      })}
    </Text>
  );
};

export const ChatMessages: React.FC<ChatMessagesProps> = ({ 
  messages, 
  isLoading, 
  loadingStatus,
  onRetry,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; caption?: string } | null>(null);

  const handlePhotoPress = (url: string, caption?: string) => {
    setSelectedImage({ url, caption });
    setModalVisible(true);
  };

  return (
    <>
      {messages.map((message) => (
        <View
          key={message.id}
          style={[
            styles.bubble,
            message.type === 'user' ? styles.userBubble : styles.assistantBubble,
            message.isError && styles.errorBubble,
          ]}
        >
          <MessageContent 
            content={message.content} 
            isUser={message.type === 'user'} 
            photos={message.photos}
            onPhotoPress={handlePhotoPress}
          />
          {message.type === 'assistant' && message.photos && message.photos.length > 0 && (
            <PhotoGallery photos={message.photos} />
          )}
          {message.isError && message.lastUserMessage && onRetry && (
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => onRetry(message.lastUserMessage!)}
            >
              <Text style={styles.retryText}>🔄 Tap to retry</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      
      {isLoading && (
        <View style={[styles.bubble, styles.assistantBubble, styles.loadingBubble]}>
          <ActivityIndicator size="small" color="#FFFFFF" style={styles.spinner} />
          <Text style={styles.loadingText}>{loadingStatus || 'Thinking...'}</Text>
        </View>
      )}

      <ImageModal
        visible={modalVisible}
        imageUrl={selectedImage?.url || ''}
        caption={selectedImage?.caption}
        onClose={() => {
          setModalVisible(false);
          setSelectedImage(null);
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  bubble: {
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
  text: {
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
  spinner: {
    marginRight: 4,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontStyle: 'italic',
  },
  link: {
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
  userLink: {
    color: '#166534',
  },
  assistantLink: {
    color: '#93c5fd',
  },
  errorBubble: {
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    backgroundColor: 'rgba(127, 29, 29, 0.9)',
  },
  retryButton: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  photoLink: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  userPhotoLink: {
    color: '#7c3aed',
  },
  assistantPhotoLink: {
    color: '#fbbf24',
  },
  photoIcon: {
    fontSize: 12,
  },
});
