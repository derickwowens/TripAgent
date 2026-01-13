import React, { memo, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { PhotoReference } from '../../hooks';
import { ImageModal } from './ImageModal';

interface PhotoGalleryProps {
  photos: PhotoReference[];
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = memo(({ photos }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoReference | null>(null);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  if (!photos || photos.length === 0) return null;

  const handlePhotoPress = (photo: PhotoReference) => {
    setSelectedPhoto(photo);
    setModalVisible(true);
  };

  const handleLoadStart = (url: string) => {
    setLoadingStates(prev => ({ ...prev, [url]: true }));
  };

  const handleLoadEnd = (url: string) => {
    setLoadingStates(prev => ({ ...prev, [url]: false }));
  };

  return (
    <>
      <View style={styles.container}>
        <Text style={styles.title}>📷 Trip Photos</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {photos.map((photo, index) => (
            <TouchableOpacity
              key={`${photo.url}-${index}`}
              style={styles.photoCard}
              onPress={() => handlePhotoPress(photo)}
              activeOpacity={0.8}
            >
              <View style={styles.imageWrapper}>
                {loadingStates[photo.url] && (
                  <ActivityIndicator 
                    size="small" 
                    color="#FFFFFF" 
                    style={styles.loader}
                  />
                )}
                <Image
                  source={{ uri: photo.url }}
                  style={styles.thumbnail}
                  resizeMode="cover"
                  onLoadStart={() => handleLoadStart(photo.url)}
                  onLoadEnd={() => handleLoadEnd(photo.url)}
                />
              </View>
              <Text style={styles.caption} numberOfLines={2}>
                {photo.caption || photo.keyword}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ImageModal
        visible={modalVisible}
        imageUrl={selectedPhoto?.url || ''}
        caption={selectedPhoto?.caption}
        onClose={() => {
          setModalVisible(false);
          setSelectedPhoto(null);
        }}
      />
    </>
  );
});

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  title: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  scrollContent: {
    paddingRight: 8,
  },
  photoCard: {
    marginRight: 10,
    width: 100,
  },
  imageWrapper: {
    width: 100,
    height: 75,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  loader: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -10,
    marginLeft: -10,
    zIndex: 1,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  caption: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 14,
  },
});
