import React, { memo, useCallback } from 'react';
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
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImageModalProps {
  visible: boolean;
  imageUrl: string;
  caption?: string;
  onClose: () => void;
}

export const ImageModal: React.FC<ImageModalProps> = memo(({
  visible,
  imageUrl,
  caption,
  onClose,
}) => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  const handleLoadEnd = useCallback(() => setLoading(false), []);
  const handleError = useCallback(() => {
    setLoading(false);
    setError(true);
  }, []);

  React.useEffect(() => {
    if (visible) {
      setLoading(true);
      setError(false);
    }
  }, [visible, imageUrl]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={20}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          
          <View style={styles.imageContainer}>
            {loading && (
              <ActivityIndicator size="large" color="#FFFFFF" style={styles.loader} />
            )}
            
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorEmoji}>📷</Text>
                <Text style={styles.errorText}>Unable to load image</Text>
              </View>
            ) : (
              <Image
                source={{ uri: imageUrl }}
                style={[styles.image, loading && styles.hiddenImage]}
                resizeMode="contain"
                onLoadEnd={handleLoadEnd}
                onError={handleError}
              />
            )}
          </View>
          
          {caption && (
            <Text style={styles.caption} numberOfLines={2}>{caption}</Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: SCREEN_WIDTH - 40,
    maxHeight: SCREEN_HEIGHT - 120,
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  imageContainer: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
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
  caption: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
});
