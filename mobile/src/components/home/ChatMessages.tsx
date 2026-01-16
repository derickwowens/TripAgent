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

// Types for parsed content elements
type ParsedElement = 
  | { type: 'text'; text: string }
  | { type: 'link'; text: string; url: string }
  | { type: 'header'; text: string; level: number }
  | { type: 'bullet'; text: string; indent: number }
  | { type: 'bold'; text: string }
  | { type: 'newline' };

// Parse markdown content for rich formatting
const parseMessageContent = (
  content: string, 
  isUser: boolean
): ParsedElement[] => {
  // Safety check for empty or invalid content
  if (!content || typeof content !== 'string') {
    return [{ type: 'text', text: content || '' }];
  }

  const elements: ParsedElement[] = [];
  
  // Split by lines first to handle headers and bullets
  const lines = content.split('\n');
  
  lines.forEach((line, lineIndex) => {
    // Add newline between lines (not before first line)
    if (lineIndex > 0) {
      elements.push({ type: 'newline' });
    }
    
    // Check for headers (## Header or ### Header)
    const headerMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headerMatch) {
      elements.push({ 
        type: 'header', 
        text: headerMatch[2].trim(), 
        level: headerMatch[1].length 
      });
      return;
    }
    
    // Check for bullet points (- item or * item or numbered 1. item)
    const bulletMatch = line.match(/^(\s*)([-*•]|\d+\.)\s+(.+)$/);
    if (bulletMatch) {
      const indent = Math.floor(bulletMatch[1].length / 2);
      const bulletContent = bulletMatch[3];
      // Parse inline content within bullet
      const inlineElements = parseInlineContent(bulletContent);
      elements.push({ 
        type: 'bullet', 
        text: '', 
        indent 
      });
      elements.push(...inlineElements);
      return;
    }
    
    // Parse inline content (bold, links, etc.)
    const inlineElements = parseInlineContent(line);
    elements.push(...inlineElements);
  });

  return elements.length > 0 ? elements : [{ type: 'text', text: content }];
};

// Parse inline markdown (bold, links)
const parseInlineContent = (text: string): ParsedElement[] => {
  if (!text) return [];
  
  const elements: ParsedElement[] = [];
  
  // Combined regex for bold, links, and plain URLs
  const inlineRegex = /(\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)|https?:\/\/[^\s\)]+)/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = inlineRegex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      elements.push({ type: 'text', text: text.slice(lastIndex, match.index) });
    }
    
    if (match[2]) {
      // Bold text: **text**
      elements.push({ type: 'bold', text: match[2] });
    } else if (match[3] && match[4]) {
      // Markdown link: [text](url)
      elements.push({ type: 'link', text: match[3], url: match[4] });
    } else if (match[0].match(/^https?:\/\//)) {
      // Plain URL
      elements.push({ type: 'link', text: match[0], url: match[0] });
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    elements.push({ type: 'text', text: text.slice(lastIndex) });
  }
  
  return elements;
};

interface MessageContentProps {
  content: string;
  isUser: boolean;
  isDarkMode?: boolean;
}

const MessageContent: React.FC<MessageContentProps> = ({ content, isUser, isDarkMode }) => {
  const elements = parseMessageContent(content, isUser);
  
  const renderElements = () => {
    return elements.map((element, index) => {
      switch (element.type) {
        case 'header':
          return (
            <Text 
              key={index} 
              style={[
                styles.header,
                element.level === 1 && styles.header1,
                element.level === 2 && styles.header2,
                element.level >= 3 && styles.header3,
                isUser ? styles.userText : styles.assistantText,
                isUser && isDarkMode && styles.userTextDark,
              ]}
            >
              {element.text}
            </Text>
          );
        case 'bullet':
          return (
            <Text key={index} style={styles.bullet}>
              {'  '.repeat(element.indent)}{'• '}
            </Text>
          );
        case 'bold':
          return (
            <Text 
              key={index} 
              style={[
                styles.boldText,
                isUser ? styles.userText : styles.assistantText,
                isUser && isDarkMode && styles.userTextDark,
              ]}
            >
              {element.text}
            </Text>
          );
        case 'link':
          return (
            <Text
              key={index}
              style={[styles.link, isUser ? styles.userLink : styles.assistantLink]}
              onPress={() => Linking.openURL(element.url)}
            >
              {element.text}
            </Text>
          );
        case 'newline':
          return <Text key={index}>{'\n'}</Text>;
        case 'text':
        default:
          return <Text key={index}>{element.text}</Text>;
      }
    });
  };
  
  return (
    <Text style={[
      styles.text, 
      isUser ? styles.userText : styles.assistantText,
      isUser && isDarkMode && styles.userTextDark,
    ]}>
      {renderElements()}
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
            isDarkMode={isDarkMode}
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
    backgroundColor: 'rgba(74, 160, 100, 0.95)',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(22, 101, 52, 0.9)',
    borderBottomLeftRadius: 4,
  },
  assistantBubbleDark: {
    backgroundColor: 'rgba(15, 45, 25, 0.95)',
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#1F2937',
  },
  userTextDark: {
    color: '#FFFFFF',
  },
  assistantText: {
    color: '#FFFFFF',
  },
  header: {
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  header1: {
    fontSize: 20,
    lineHeight: 28,
  },
  header2: {
    fontSize: 17,
    lineHeight: 24,
  },
  header3: {
    fontSize: 15,
    lineHeight: 22,
  },
  bullet: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 24,
  },
  boldText: {
    fontWeight: '700',
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
