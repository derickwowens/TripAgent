import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Message } from '../../hooks';

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  loadingStatus: string;
}

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
          <Text style={[
            styles.text,
            message.type === 'user' ? styles.userText : styles.assistantText,
          ]}>
            {message.content}
          </Text>
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
});
