import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PhotoAsset, GalleryFilter } from '../types';
import { fetchAllPhotos } from '../services/photos';
import { reverseGeocode } from '../services/geocoding';
import { FilterBar } from './FilterBar';

const { width } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const IMAGE_SIZE = (width - 4 * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

interface GalleryPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onPhotosSelected: (photos: PhotoAsset[]) => void;
  existingPhotoIds: Set<string>;
}

export function GalleryPickerModal({
  visible,
  onClose,
  onPhotosSelected,
  existingPhotoIds,
}: GalleryPickerModalProps) {
  const [allPhotos, setAllPhotos] = useState<PhotoAsset[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [endCursor, setEndCursor] = useState<string | undefined>(undefined);
  const [filter, setFilter] = useState<GalleryFilter>({
    startDate: null,
    endDate: null,
    locationSearch: '',
  });
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [geocodingInProgress, setGeocodingInProgress] = useState<Set<string>>(new Set());

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setAllPhotos([]);
      setSelectedIds(new Set());
      setHasNextPage(true);
      setEndCursor(undefined);
      setFilter({ startDate: null, endDate: null, locationSearch: '' });
      setIsFilterExpanded(false);
      loadPhotosWithFilter({ startDate: null, endDate: null, locationSearch: '' });
    }
  }, [visible]);

  // Reload photos when date filter changes
  useEffect(() => {
    if (visible) {
      // Debounce to avoid excessive reloads
      const timer = setTimeout(() => {
        setAllPhotos([]);
        setHasNextPage(true);
        setEndCursor(undefined);
        loadPhotosWithFilter(filter);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [filter.startDate, filter.endDate, visible]);

  // Load photos from gallery with filter
  const loadPhotosWithFilter = useCallback(async (currentFilter: GalleryFilter, loadMore = false) => {
    if (loadMore) {
      if (!hasNextPage || isLoadingMore) return;
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const result = await fetchAllPhotos({
        limit: 50,
        after: loadMore ? endCursor : undefined,
        createdAfter: currentFilter.startDate,
        createdBefore: currentFilter.endDate,
      });

      setAllPhotos(prev => loadMore ? [...prev, ...result.photos] : result.photos);
      setHasNextPage(result.hasNextPage);
      setEndCursor(result.endCursor);

      // Start background geocoding for photos with GPS
      geocodePhotos(result.photos);
    } catch (error) {
      console.error('Failed to load photos:', error);
      Alert.alert('오류', '갤러리를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [hasNextPage, isLoadingMore, endCursor]);

  // Wrapper for load more
  const loadPhotos = useCallback((loadMore = false) => {
    loadPhotosWithFilter(filter, loadMore);
  }, [filter, loadPhotosWithFilter]);

  // Background geocoding for photos with GPS
  const geocodePhotos = useCallback(async (photos: PhotoAsset[]) => {
    const photosWithGPS = photos.filter(
      p => p.exif?.GPSLatitude && p.exif?.GPSLongitude && !p.location
    );

    for (const photo of photosWithGPS) {
      if (geocodingInProgress.has(photo.id)) continue;

      setGeocodingInProgress(prev => new Set(prev).add(photo.id));

      try {
        const location = await reverseGeocode(
          photo.exif!.GPSLatitude!,
          photo.exif!.GPSLongitude!
        );

        setAllPhotos(prev =>
          prev.map(p => (p.id === photo.id ? { ...p, location } : p))
        );
      } catch (error) {
        console.warn('Geocoding failed for photo:', photo.id);
      } finally {
        setGeocodingInProgress(prev => {
          const next = new Set(prev);
          next.delete(photo.id);
          return next;
        });
      }

      // Rate limiting - wait 1.1 seconds between requests
      await new Promise(resolve => setTimeout(resolve, 1100));
    }
  }, [geocodingInProgress]);

  // Apply client-side filters (location search only - date filter is handled at native level)
  const filteredPhotos = useMemo(() => {
    return allPhotos.filter(photo => {
      // Skip already existing photos
      if (existingPhotoIds.has(photo.id)) return false;

      // Location search filter (case insensitive partial match)
      if (filter.locationSearch.trim()) {
        if (!photo.location) return false;
        const searchLower = filter.locationSearch.toLowerCase();
        if (!photo.location.toLowerCase().includes(searchLower)) return false;
      }

      return true;
    });
  }, [allPhotos, filter.locationSearch, existingPhotoIds]);

  // Toggle photo selection
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Select all visible photos
  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(filteredPhotos.map(p => p.id)));
  }, [filteredPhotos]);

  // Deselect all photos
  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Confirm selection and close
  const handleConfirm = useCallback(() => {
    const selectedPhotos = allPhotos
      .filter(p => selectedIds.has(p.id))
      .map(p => ({ ...p, selected: true }));
    onPhotosSelected(selectedPhotos);
    onClose();
  }, [allPhotos, selectedIds, onPhotosSelected, onClose]);

  // Load more when reaching end
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isLoadingMore) {
      loadPhotos(true);
    }
  }, [hasNextPage, isLoadingMore, loadPhotos]);

  // Reset filter
  const handleResetFilter = useCallback(() => {
    setFilter({ startDate: null, endDate: null, locationSearch: '' });
  }, []);

  // Render photo item
  const renderPhotoItem = useCallback(({ item }: { item: PhotoAsset }) => {
    const isSelected = selectedIds.has(item.id);
    const isExisting = existingPhotoIds.has(item.id);

    return (
      <TouchableOpacity
        style={[styles.photoItem, isExisting && styles.photoItemDisabled]}
        onPress={() => !isExisting && handleToggleSelect(item.id)}
        disabled={isExisting}
        activeOpacity={0.7}
      >
        <Image source={{ uri: item.uri }} style={styles.photoImage} />
        {!isExisting && (
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && <Text style={styles.checkmark}>✓</Text>}
          </View>
        )}
        {isExisting && (
          <View style={styles.existingOverlay}>
            <Text style={styles.existingText}>추가됨</Text>
          </View>
        )}
        {item.location && (
          <View style={styles.locationBadge}>
            <Text style={styles.locationText} numberOfLines={1}>
              📍 {item.location}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [selectedIds, existingPhotoIds, handleToggleSelect]);

  // Footer component (loading more indicator)
  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator color="#06b6d4" />
      </View>
    );
  }, [isLoadingMore]);

  const selectedCount = selectedIds.size;
  const hasActiveFilter = filter.startDate || filter.endDate || filter.locationSearch.trim();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>갤러리에서 선택</Text>
          <TouchableOpacity
            onPress={handleConfirm}
            style={[styles.confirmButton, selectedCount === 0 && styles.confirmButtonDisabled]}
            disabled={selectedCount === 0}
          >
            <Text style={[styles.confirmButtonText, selectedCount === 0 && styles.confirmButtonTextDisabled]}>
              완료
            </Text>
          </TouchableOpacity>
        </View>

        {/* Filter Bar */}
        <FilterBar
          filter={filter}
          onFilterChange={setFilter}
          onReset={handleResetFilter}
          isExpanded={isFilterExpanded}
          onToggleExpand={() => setIsFilterExpanded(!isFilterExpanded)}
          hasActiveFilter={hasActiveFilter}
        />

        {/* Selection Controls */}
        <View style={styles.controls}>
          <Text style={styles.photoCount}>
            {selectedCount}장 선택됨 (총 {filteredPhotos.length}장)
          </Text>
          <View style={styles.selectButtons}>
            <TouchableOpacity onPress={handleSelectAll} style={styles.selectButton}>
              <Text style={styles.selectButtonText}>전체 선택</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDeselectAll} style={styles.selectButton}>
              <Text style={styles.selectButtonText}>전체 해제</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Photo Grid */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#06b6d4" />
            <Text style={styles.loadingText}>갤러리 불러오는 중...</Text>
          </View>
        ) : filteredPhotos.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🖼️</Text>
            <Text style={styles.emptyText}>
              {hasActiveFilter
                ? '필터 조건에 맞는 사진이 없습니다'
                : '갤러리에 사진이 없습니다'}
            </Text>
            {hasActiveFilter && (
              <TouchableOpacity onPress={handleResetFilter} style={styles.resetButton}>
                <Text style={styles.resetButtonText}>필터 초기화</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredPhotos}
            renderItem={renderPhotoItem}
            keyExtractor={item => item.id}
            numColumns={NUM_COLUMNS}
            contentContainerStyle={styles.gridContent}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={5}
          />
        )}

        {/* Bottom Action */}
        {selectedCount > 0 && (
          <View style={styles.bottomAction}>
            <TouchableOpacity onPress={handleConfirm} style={styles.bottomConfirmButton}>
              <Text style={styles.bottomConfirmText}>
                {selectedCount}장 선택 완료
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#94a3b8',
    fontSize: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f1f5f9',
  },
  confirmButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#06b6d4',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonTextDisabled: {
    color: '#64748b',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  photoCount: {
    fontSize: 14,
    color: '#f1f5f9',
  },
  selectButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  selectButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#334155',
    borderRadius: 6,
  },
  selectButtonText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  gridContent: {
    padding: 4,
  },
  photoItem: {
    margin: 4,
    position: 'relative',
  },
  photoItemDisabled: {
    opacity: 0.5,
  },
  photoImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 8,
  },
  checkbox: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#06b6d4',
    borderColor: '#06b6d4',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  existingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  existingText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  locationBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  locationText: {
    color: '#f1f5f9',
    fontSize: 9,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
  },
  loadingMore: {
    padding: 16,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  resetButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#334155',
    borderRadius: 8,
  },
  resetButtonText: {
    color: '#f1f5f9',
    fontSize: 14,
  },
  bottomAction: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  bottomConfirmButton: {
    backgroundColor: '#06b6d4',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  bottomConfirmText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
