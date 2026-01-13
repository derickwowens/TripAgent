import React, { memo, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Image,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Pressable,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { PhotoReference } from '../../hooks';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImageModalProps {
  visible: boolean;
  photos: PhotoReference[];
  initialIndex: number;
  onClose: () => void;
}

export const ImageModal: React.FC<ImageModalProps> = memo(({
  visible,
  photos,
  initialIndex,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);
  const [loadingStates, setLoadingStates] = React.useState<Record<number, boolean>>({});
  const [errorStates, setErrorStates] = React.useState<Record<number, boolean>>({});
  const scrollViewRef = useRef<ScrollView>(null);

  const handleLoadEnd = useCallback((index: number) => {
    setLoadingStates(prev => ({ ...prev, [index]: false }));
  }, []);
  
  const handleError = useCallback((index: number) => {
    setLoadingStates(prev => ({ ...prev, [index]: false }));
    setErrorStates(prev => ({ ...prev, [index]: true }));
  }, []);

  const handleLoadStart = useCallback((index: number) => {
    setLoadingStates(prev => ({ ...prev, [index]: true }));
  }, []);

  React.useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setLoadingStates({});
      setErrorStates({});
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ x: initialIndex * SCREEN_WIDTH, animated: false });
      }, 50);
    }
  }, [visible, initialIndex]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index !== currentIndex && index >= 0 && index < photos.length) {
      setCurrentIndex(index);
    }
  };

  if (!visible || photos.length === 0) return null;

  const currentPhoto = photos[currentIndex];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={20}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {photos.map((photo, index) => (
            <View key={`${photo.url}-${index}`} style={styles.imageContainer}>
              {loadingStates[index] && (
                <ActivityIndicator size="large" color="#FFFFFF" style={styles.loader} />
              )}
              
              {errorStates[index] ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorEmoji}>📷</Text>
                  <Text style={styles.errorText}>Unable to load image</Text>
                </View>
              ) : (
                <Image
                  source={{ uri: photo.url }}
                  style={[styles.image, loadingStates[index] && styles.hiddenImage]}
                  resizeMode="contain"
                  onLoadStart={() => handleLoadStart(index)}
                  onLoadEnd={() => handleLoadEnd(index)}
                  onError={() => handleError(index)}
                />
              )}
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          {currentPhoto?.caption && (
            <Text style={styles.caption} numberOfLines={2}>{currentPhoto.caption}</Text>
          )}
          <Text style={styles.counter}>{currentIndex + 1} / {photos.length}</Text>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH - 20,
    height: '100%',
  },
  hiddenImage: {
    opacity: 0,
  },
  loader: {
    position: 'absolute',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  caption: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  counter: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
});
