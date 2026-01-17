import React, { useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const MIN_HEIGHT = 70;
const MAX_HEIGHT = SCREEN_HEIGHT * 0.7; // Allow up to 70% of screen height
const DEFAULT_HEIGHT = 200;

interface CollapsibleBottomPanelProps {
  children: React.ReactNode;
  hasPhotos: boolean;
}

export const CollapsibleBottomPanel: React.FC<CollapsibleBottomPanelProps> = ({
  children,
  hasPhotos,
}) => {
  const animatedHeight = useRef(new Animated.Value(DEFAULT_HEIGHT)).current;
  const currentHeightRef = useRef(DEFAULT_HEIGHT);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return Math.abs(gestureState.dy) > 3;
    },
    onPanResponderMove: (_, gestureState) => {
      const newHeight = currentHeightRef.current - gestureState.dy;
      const clampedHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, newHeight));
      animatedHeight.setValue(clampedHeight);
    },
    onPanResponderRelease: (_, gestureState) => {
      const newHeight = currentHeightRef.current - gestureState.dy;
      const clampedHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, newHeight));
      currentHeightRef.current = clampedHeight;
    },
  });

  // If no photos, just render children without the collapsible panel
  if (!hasPhotos) {
    return <View style={styles.inputOnly}>{children}</View>;
  }

  return (
    <Animated.View style={[styles.container, { height: animatedHeight }]}>
      <View style={styles.handle} {...panResponder.panHandlers}>
        <View style={styles.handleBar} />
      </View>
      
      <View style={styles.content}>
        {children}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  handle: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: 'rgba(22, 101, 52, 0.9)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  handleBar: {
    width: 100,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 4,
  },
  content: {
    flex: 1,
  },
  inputOnly: {
    backgroundColor: 'transparent',
  },
});
