import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useParkTheme } from '../../hooks';

interface ThemedLogoProps {
  style?: StyleProp<ViewStyle>;
  size?: number;
}

/**
 * ThemedLogo - SVG logo component that changes color based on park mode
 * National Parks mode: Green background with white tree
 * State Parks mode: Brown background with white tree
 * 
 * This SVG approach allows us to change just the background color
 * while keeping the tree white.
 */
export const ThemedLogo: React.FC<ThemedLogoProps> = ({ style, size = 40 }) => {
  const { theme, isStateMode } = useParkTheme();
  
  // Background colors based on mode
  const bgColor = isStateMode ? '#8B5A2B' : '#2D6A4F';
  const mountainColor = isStateMode ? '#6B4423' : '#1B4332';
  const treeColor = '#FFFFFF';
  const trunkColor = '#9CA3AF';
  
  return (
    <View style={[styles.container, style, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Background */}
        <Rect x="0" y="0" width="100" height="100" fill={bgColor} rx="8" />
        
        {/* Mountains in background */}
        <Path 
          d="M0 95 L25 70 L50 85 L75 65 L100 80 L100 100 L0 100 Z" 
          fill={mountainColor} 
        />
        
        {/* Tree - 4 tiers */}
        {/* Top tier */}
        <Path d="M50 8 L62 28 L38 28 Z" fill={treeColor} />
        {/* Second tier */}
        <Path d="M50 22 L67 45 L33 45 Z" fill={treeColor} />
        {/* Third tier */}
        <Path d="M50 38 L72 62 L28 62 Z" fill={treeColor} />
        {/* Bottom tier */}
        <Path d="M50 52 L77 78 L23 78 Z" fill={treeColor} />
        
        {/* Trunk */}
        <Rect x="45" y="78" width="10" height="12" fill={trunkColor} />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 8,
  },
});
