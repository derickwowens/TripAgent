import React, { useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { useParkTheme } from '../../hooks';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const MIN_HEIGHT = SCREEN_HEIGHT * 0.3; // Minimum 30% of screen
const MAX_HEIGHT = SCREEN_HEIGHT * 0.85; // Maximum 85% of screen
const DEFAULT_HEIGHT = SCREEN_HEIGHT * 0.65; // Default 65% of screen

interface DraggableConversationPanelProps {
  children: React.ReactNode;
  hasMessages: boolean;
}

export const DraggableConversationPanel: React.FC<DraggableConversationPanelProps> = ({
  children,
  hasMessages,
}) => {
  const { theme } = useParkTheme();
  const animatedHeight = useRef(new Animated.Value(DEFAULT_HEIGHT)).current;
  const currentHeightRef = useRef(DEFAULT_HEIGHT);

  // Reset to default height when messages change from 0 to some
  useEffect(() => {
    if (hasMessages) {
      // Animate to default height when conversation starts
      Animated.spring(animatedHeight, {
        toValue: DEFAULT_HEIGHT,
        useNativeDriver: false,
        tension: 50,
        friction: 10,
      }).start();
      currentHeightRef.current = DEFAULT_HEIGHT;
    }
  }, [hasMessages]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to vertical drags
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        // Store the current height when drag starts
        animatedHeight.stopAnimation((value) => {
          currentHeightRef.current = value;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        // Dragging down (positive dy) should decrease height (panel goes down)
        // Dragging up (negative dy) should increase height (panel goes up)
        const newHeight = currentHeightRef.current - gestureState.dy;
        const clampedHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, newHeight));
        animatedHeight.setValue(clampedHeight);
      },
      onPanResponderRelease: (_, gestureState) => {
        const newHeight = currentHeightRef.current - gestureState.dy;
        const clampedHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, newHeight));
        
        // Snap to certain positions based on velocity and position
        let targetHeight = clampedHeight;
        
        // If flicked quickly, snap to min or max
        if (Math.abs(gestureState.vy) > 0.5) {
          if (gestureState.vy > 0) {
            // Flicked down - minimize
            targetHeight = MIN_HEIGHT;
          } else {
            // Flicked up - maximize
            targetHeight = MAX_HEIGHT;
          }
        } else {
          // Otherwise snap to nearest third
          const third = (MAX_HEIGHT - MIN_HEIGHT) / 3;
          if (clampedHeight < MIN_HEIGHT + third) {
            targetHeight = MIN_HEIGHT;
          } else if (clampedHeight > MAX_HEIGHT - third) {
            targetHeight = MAX_HEIGHT;
          } else {
            targetHeight = DEFAULT_HEIGHT;
          }
        }
        
        Animated.spring(animatedHeight, {
          toValue: targetHeight,
          useNativeDriver: false,
          tension: 50,
          friction: 10,
        }).start();
        
        currentHeightRef.current = targetHeight;
      },
    })
  ).current;

  // If no messages, show welcome screen at full height without drag handle
  if (!hasMessages) {
    return <View style={styles.fullContainer}>{children}</View>;
  }

  return (
    <Animated.View style={[styles.container, { height: animatedHeight }]}>
      <View 
        style={[styles.handle, { backgroundColor: theme.buttonBackground }]} 
        {...panResponder.panHandlers}
      >
        <View style={styles.handleBar} />
      </View>
      <View style={styles.content}>
        {children}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
  },
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  handle: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: 'rgba(22, 101, 52, 0.8)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleBar: {
    width: 60,
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 3,
  },
  content: {
    flex: 1,
  },
});
