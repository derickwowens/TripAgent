import React, { memo, useCallback, useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Platform, Alert } from 'react-native';

// Try to import speech recognition - may not be available in Expo Go
let ExpoSpeechRecognitionModule: any = null;
let useSpeechRecognitionEvent: any = null;
let speechRecognitionAvailable = false;

try {
  const speechModule = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = speechModule.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = speechModule.useSpeechRecognitionEvent;
  speechRecognitionAvailable = !!ExpoSpeechRecognitionModule;
} catch (e) {
  console.log('Speech recognition not available (requires native build)');
}

interface ChatInputProps {
  inputText: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  isLoading: boolean;
}

// Wrapper hook that no-ops when speech recognition isn't available
const useSpeechEvent = (event: string, callback: (e: any) => void) => {
  if (speechRecognitionAvailable && useSpeechRecognitionEvent) {
    useSpeechRecognitionEvent(event, callback);
  }
};

export const ChatInput: React.FC<ChatInputProps> = memo(({
  inputText,
  onChangeText,
  onSend,
  isLoading,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  
  const isDisabled = !inputText.trim() || isLoading;
  
  const handleChangeText = useCallback((text: string) => {
    onChangeText(text);
  }, [onChangeText]);
  
  const handleSubmit = useCallback(() => {
    if (!isDisabled) {
      onSend();
    }
  }, [onSend, isDisabled]);

  // Handle speech recognition results (only when available)
  useSpeechEvent('result', (event: any) => {
    if (event.results && event.results.length > 0) {
      const transcript = event.results[0]?.transcript || '';
      if (transcript) {
        const newText = inputText ? `${inputText} ${transcript}` : transcript;
        onChangeText(newText);
      }
    }
  });

  useSpeechEvent('end', () => {
    setIsListening(false);
  });

  useSpeechEvent('error', (event: any) => {
    console.error('Speech recognition error:', event.error);
    setIsListening(false);
  });

  const requestPermission = async () => {
    if (!ExpoSpeechRecognitionModule) return false;
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    setHasPermission(result.granted);
    return result.granted;
  };

  const toggleListening = async () => {
    if (!speechRecognitionAvailable) {
      Alert.alert(
        'Voice Input Unavailable',
        'Voice input requires a production build. It will work once you install the app from the Play Store or a development build.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (isListening) {
      await ExpoSpeechRecognitionModule.stop();
      setIsListening(false);
      return;
    }

    // Check/request permission
    if (hasPermission === null) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert(
          'Microphone Permission',
          'Please enable microphone access in Settings to use voice input.',
          [{ text: 'OK' }]
        );
        return;
      }
    } else if (!hasPermission) {
      Alert.alert(
        'Microphone Permission',
        'Please enable microphone access in Settings to use voice input.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setIsListening(true);
      await ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: false,
      });
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      setIsListening(false);
      Alert.alert('Error', 'Failed to start voice input. Please try again.');
    }
  };

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
        blurOnSubmit={false}
        multiline
        maxLength={500}
        autoCorrect={false}
        autoCapitalize="sentences"
        editable={!isLoading}
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
