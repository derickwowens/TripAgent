import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { Message } from '../../hooks';

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  loadingStatus: string;
}

// Parse markdown links [text](url) and plain URLs
const parseMessageContent = (content: string, isUser: boolean) => {
  // Regex for markdown links: [text](url)
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  // Regex for plain URLs
  const urlRegex = /(https?:\/\/[^\s\)]+)/g;
  
  const parts: Array<{ type: 'text' | 'link'; text: string; url?: string }> = [];
  let lastIndex = 0;
  let match;

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
      parts.push({ type: 'text', text: segment });
    }
  });

  return parts;
};

const MessageContent: React.FC<{ content: string; isUser: boolean }> = ({ content, isUser }) => {
  const parts = parseMessageContent(content, isUser);
  
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
        return <Text key={index}>{part.text}</Text>;
      })}
    </Text>
  );
};

export const ChatMessages: React.FC<ChatMessagesProps> = ({ 
  messages, 
  isLoading, 
  loadingStatus 
}) => {
  return (
    <>
      {messages.map((message) => (
        <View
          key={message.id}
          style={[
            styles.bubble,
            message.type === 'user' ? styles.userBubble : styles.assistantBubble,
          ]}
        >
          <MessageContent content={message.content} isUser={message.type === 'user'} />
        </View>
      ))}
      
      {isLoading && (
        <View style={[styles.bubble, styles.assistantBubble, styles.loadingBubble]}>
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
});
