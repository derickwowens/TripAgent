import React, { useState, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Text,
} from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const COLLAPSED_HEIGHT = 60;
const EXPANDED_HEIGHT = 280;

interface CollapsibleBottomPanelProps {
  children: React.ReactNode;
  hasPhotos: boolean;
}

export const CollapsibleBottomPanel: React.FC<CollapsibleBottomPanelProps> = ({
  children,
  hasPhotos,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const animatedHeight = useRef(new Animated.Value(EXPANDED_HEIGHT)).current;

  const togglePanel = () => {
    const toValue = isExpanded ? COLLAPSED_HEIGHT : EXPANDED_HEIGHT;
    Animated.spring(animatedHeight, {
      toValue,
      useNativeDriver: false,
      friction: 8,
    }).start();
    setIsExpanded(!isExpanded);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        const newHeight = isExpanded 
          ? EXPANDED_HEIGHT - gestureState.dy 
          : COLLAPSED_HEIGHT - gestureState.dy;
        
        const clampedHeight = Math.max(COLLAPSED_HEIGHT, Math.min(EXPANDED_HEIGHT, newHeight));
        animatedHeight.setValue(clampedHeight);
      },
      onPanResponderRelease: (_, gestureState) => {
        const threshold = (EXPANDED_HEIGHT - COLLAPSED_HEIGHT) / 2;
        const currentHeight = isExpanded 
          ? EXPANDED_HEIGHT - gestureState.dy 
          : COLLAPSED_HEIGHT - gestureState.dy;
        
        if (currentHeight > COLLAPSED_HEIGHT + threshold) {
          Animated.spring(animatedHeight, {
            toValue: EXPANDED_HEIGHT,
            useNativeDriver: false,
            friction: 8,
          }).start();
          setIsExpanded(true);
        } else {
          Animated.spring(animatedHeight, {
            toValue: COLLAPSED_HEIGHT,
            useNativeDriver: false,
            friction: 8,
          }).start();
          setIsExpanded(false);
        }
      },
    })
  ).current;

  return (
    <Animated.View style={[styles.container, { height: animatedHeight }]}>
      <TouchableOpacity 
        style={styles.handle} 
        onPress={togglePanel}
        activeOpacity={0.8}
        {...panResponder.panHandlers}
      >
        <View style={styles.handleBar} />
      </TouchableOpacity>
      
      <View style={styles.content}>
        {children}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  handle: {
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: 'rgba(22, 101, 52, 0.9)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 2,
    marginBottom: 4,
  },
  handleText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
});
