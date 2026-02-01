import React, { useCallback } from 'react';
import {
  View,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Text,
} from 'react-native';
import { PhotoAsset } from '../types';

interface PhotoGridProps {
  photos: PhotoAsset[];
  onToggleSelect: (id: string) => void;
  numColumns?: number;
}

const { width } = Dimensions.get('window');

export function PhotoGrid({ photos, onToggleSelect, numColumns = 3 }: PhotoGridProps) {
  const imageSize = (width - 4 * (numColumns + 1)) / numColumns;

  const renderItem = useCallback(
    ({ item }: { item: PhotoAsset }) => (
      <TouchableOpacity
        style={[styles.photoContainer, { width: imageSize, height: imageSize }]}
        onPress={() => onToggleSelect(item.id)}
        activeOpacity={0.8}
      >
        <Image source={{ uri: item.uri }} style={styles.photo} />
        <View style={[styles.checkmark, item.selected && styles.checkmarkSelected]}>
          {item.selected && <Text style={styles.checkIcon}>✓</Text>}
        </View>
        {!item.selected && <View style={styles.deselectedOverlay} />}
      </TouchableOpacity>
    ),
    [imageSize, onToggleSelect]
  );

  const keyExtractor = useCallback((item: PhotoAsset) => item.id, []);

  return (
    <FlatList
      data={photos}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={numColumns}
      contentContainerStyle={styles.grid}
      showsVerticalScrollIndicator={false}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={5}
    />
  );
}

const styles = StyleSheet.create({
  grid: {
    padding: 4,
  },
  photoContainer: {
    margin: 2,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#334155',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  checkmark: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkSelected: {
    backgroundColor: '#06b6d4',
    borderColor: '#06b6d4',
  },
  checkIcon: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  deselectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
});
