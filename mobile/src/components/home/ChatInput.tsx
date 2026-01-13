import React, { memo, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';

interface ChatInputProps {
  inputText: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  isLoading: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = memo(({
  inputText,
  onChangeText,
  onSend,
  isLoading,
}) => {
  const isDisabled = !inputText.trim() || isLoading;
  
  const handleChangeText = useCallback((text: string) => {
    onChangeText(text);
  }, [onChangeText]);
  
  const handleSubmit = useCallback(() => {
    if (!isDisabled) {
      onSend();
    }
  }, [onSend, isDisabled]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Ask about parks, flights, or trips..."
        placeholderTextColor="rgba(255,255,255,0.6)"
        value={inputText}
        onChangeText={handleChangeText}
        onSubmitEditing={handleSubmit}
        returnKeyType="send"
        blurOnSubmit={true}
        multiline
        maxLength={500}
        autoCorrect={false}
        autoCapitalize="sentences"
      />
      <TouchableOpacity
        style={[styles.sendButton, isDisabled && styles.sendButtonDisabled]}
        onPress={handleSubmit}
        disabled={isDisabled}
      >
        <Text style={styles.sendButtonText}>→</Text>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
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
    transform: [{ translateY: -2 }],
  },
});
