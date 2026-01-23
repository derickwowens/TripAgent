import React, { memo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { PhotoReference } from '../../hooks';
import { ImageModal } from './ImageModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = 4;
const PHOTO_GAP = 4;
const PHOTO_SIZE = (SCREEN_WIDTH - 24 - (NUM_COLUMNS - 1) * PHOTO_GAP) / NUM_COLUMNS;

interface PhotoGalleryProps {
  photos: PhotoReference[];
  onClose?: () => void;
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = memo(({ photos, onClose }) => {
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  if (!photos || photos.length === 0) return null;

  const handlePhotoPress = (index: number) => {
    setSelectedIndex(index);
    setModalVisible(true);
  };

  const handleLoadStart = (url: string) => {
    setLoadingStates(prev => ({ ...prev, [url]: true }));
  };

  const handleLoadEnd = (url: string) => {
    setLoadingStates(prev => ({ ...prev, [url]: false }));
  };

  const renderPhoto = ({ item, index }: { item: PhotoReference; index: number }) => (
    <TouchableOpacity
      style={styles.photoCard}
      onPress={() => handlePhotoPress(index)}
      activeOpacity={0.8}
    >
      <View style={styles.imageWrapper}>
        {loadingStates[item.url] && (
          <ActivityIndicator 
            size="small" 
            color="#FFFFFF" 
            style={styles.loader}
          />
        )}
        <Image
          source={{ uri: item.url }}
          style={styles.thumbnail}
          contentFit="cover"
          cachePolicy="disk"
          transition={150}
          onLoadStart={() => handleLoadStart(item.url)}
          onLoadEnd={() => handleLoadEnd(item.url)}
        />
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>📷 Trip Photos ({photos.length})</Text>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <FlatList
          data={photos}
          renderItem={renderPhoto}
          keyExtractor={(item, index) => `${item.url}-${index}`}
          numColumns={NUM_COLUMNS}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
          scrollEnabled={true}
        />
      </View>

      <ImageModal
        visible={modalVisible}
        photos={photos}
        initialIndex={selectedIndex}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 18,
    fontWeight: '600',
  },
  row: {
    justifyContent: 'flex-start',
    gap: PHOTO_GAP,
    marginBottom: PHOTO_GAP,
  },
  photoCard: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
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
});
