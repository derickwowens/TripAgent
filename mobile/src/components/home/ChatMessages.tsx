import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { Message, useDarkModeContext } from '../../hooks';

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  loadingStatus: string;
  onRetry?: (lastUserMessage: string) => void;
}

// Dark mode colors for softer appearance
const darkModeColors = {
  userBubble: 'rgba(200, 200, 210, 0.9)',
  userText: '#1a1a2e',
  assistantBubble: 'rgba(40, 80, 60, 0.85)',
  assistantText: 'rgba(255, 255, 255, 0.95)',
};

// Parse markdown links [text](url) and plain URLs, with photo keyword detection
const parseMessageContent = (
  content: string, 
  isUser: boolean
): Array<{ type: 'text' | 'link'; text: string; url?: string }> => {
  // Safety check for empty or invalid content
  if (!content || typeof content !== 'string') {
    return [{ type: 'text', text: content || '' }];
  }

  // Regex for markdown links: [text](url)
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  
  const parts: Array<{ type: 'text' | 'link'; text: string; url?: string }> = [];

  // First pass: find markdown links
  const processedContent = content.replace(markdownLinkRegex, (match, text, url) => {
    return `{{LINK:${text}::${url}}}`;
  });

  // Split by our link markers and plain URLs
  const segments = processedContent.split(/({{LINK:[^}]+}}|https?:\/\/[^\s\)]+)/g);
  
  segments.forEach((segment) => {
    if (!segment || segment.length === 0) return;
    
    if (segment.startsWith('{{LINK:')) {
      const inner = segment.slice(7, -2);
      const [text, url] = inner.split('::');
      parts.push({ type: 'link', text: text || '', url: url || '' });
    } else if (segment.match(/^https?:\/\//)) {
      parts.push({ type: 'link', text: segment, url: segment });
    } else {
      // Just add as text
      parts.push({ type: 'text', text: segment });
    }
  });

  // Ensure we return at least the original content if nothing was parsed
  if (parts.length === 0) {
    return [{ type: 'text', text: content }];
  }

  return parts;
};

interface MessageContentProps {
  content: string;
  isUser: boolean;
}

const MessageContent: React.FC<MessageContentProps> = ({ content, isUser }) => {
  const parts = parseMessageContent(content, isUser);
  
  return (
    <Text style={[
      styles.text, 
      isUser ? styles.userText : styles.assistantText,
    ]}>
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
  const { isDarkMode } = useDarkModeContext();
  
  return (
    <>
      {messages.map((message) => (
        <View
          key={message.id}
          style={[
            styles.bubble,
            message.type === 'user' ? styles.userBubble : styles.assistantBubble,
            message.type === 'user' && isDarkMode && styles.userBubbleDark,
            message.type === 'assistant' && isDarkMode && styles.assistantBubbleDark,
            message.isError && styles.errorBubble,
          ]}
        >
          <MessageContent 
            content={message.content} 
            isUser={message.type === 'user'}
          />
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
        <View style={[
          styles.bubble, 
          styles.assistantBubble, 
          styles.loadingBubble,
          isDarkMode && styles.assistantBubbleDark,
        ]}>
          <ActivityIndicator size="small" color="#FFFFFF" style={styles.spinner} />
          <Text style={styles.loadingText}>{loadingStatus || 'Thinking...'}</Text>
        </View>
      )}
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
  userBubbleDark: {
    backgroundColor: 'rgba(180, 185, 200, 0.85)',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(22, 101, 52, 0.9)',
    borderBottomLeftRadius: 4,
  },
  assistantBubbleDark: {
    backgroundColor: 'rgba(35, 75, 55, 0.9)',
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
});
