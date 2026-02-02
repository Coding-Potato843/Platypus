import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, PhotoAsset } from '../types';
import { useAuth } from '../hooks/useAuth';
import { PhotoGrid } from '../components/PhotoGrid';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { GalleryPickerModal } from '../components/GalleryPickerModal';
import { PermissionModal } from '../components/PermissionModal';
import * as MediaLibrary from 'expo-media-library';
import {
  requestMediaLibraryPermission,
  fetchPhotosAfterDate,
  uploadPhotos,
} from '../services/photos';
import { updateLastSync } from '../services/auth';

type SyncScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Sync'>;
};

export function SyncScreen({ navigation }: SyncScreenProps) {
  const { user, profile, logout, refreshProfile } = useAuth();
  const [photos, setPhotos] = useState<PhotoAsset[]>([]);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [isUploading, setIsUploading] = useState(false);
  const [isGalleryPickerVisible, setIsGalleryPickerVisible] = useState(false);

  const selectedCount = photos.filter(p => p.selected).length;
  // Supabase timestamp 컬럼은 'Z' 없이 반환하므로 UTC로 파싱하기 위해 'Z' 추가
  const lastSyncDate = profile?.last_sync_at
    ? new Date(profile.last_sync_at.endsWith('Z') ? profile.last_sync_at : profile.last_sync_at + 'Z')
    : null;

  // 이미 추가된 사진 ID Set (갤러리 피커에서 중복 방지용)
  const existingPhotoIds = useMemo(() => new Set(photos.map(p => p.id)), [photos]);

  // Check permission on mount and show modal only on first launch
  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.getPermissionsAsync();
      if (status === 'granted') {
        setHasPermission(true);
      } else {
        setHasPermission(false);
        // Show modal only if never shown before (first app launch)
        const hasSeenModal = await AsyncStorage.getItem('permissionModalShown');
        if (!hasSeenModal) {
          setShowPermissionModal(true);
        }
      }
    })();
  }, []);

  // Scan gallery for new photos
  const handleScanGallery = useCallback(async () => {
    if (!hasPermission) {
      const granted = await requestMediaLibraryPermission();
      if (!granted) {
        Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.');
        return;
      }
      setHasPermission(true);
    }

    setIsScanning(true);
    setLoadingMessage('갤러리 스캔 중...');

    try {
      const scannedPhotos = await fetchPhotosAfterDate(lastSyncDate);
      setPhotos(scannedPhotos);

      if (scannedPhotos.length === 0) {
        Alert.alert(
          '스캔 완료',
          lastSyncDate
            ? '새로운 사진이 없습니다.'
            : '갤러리에 사진이 없습니다.'
        );
      }
    } catch (error) {
      console.error('Scan error:', error);
      Alert.alert('오류', '갤러리 스캔 중 오류가 발생했습니다.');
    } finally {
      setIsScanning(false);
    }
  }, [hasPermission, lastSyncDate]);

  // Toggle photo selection
  const handleToggleSelect = useCallback((id: string) => {
    setPhotos(prev =>
      prev.map(p => (p.id === id ? { ...p, selected: !p.selected } : p))
    );
  }, []);

  // Select all photos
  const handleSelectAll = useCallback(() => {
    setPhotos(prev => prev.map(p => ({ ...p, selected: true })));
  }, []);

  // Deselect all photos
  const handleDeselectAll = useCallback(() => {
    setPhotos(prev => prev.map(p => ({ ...p, selected: false })));
  }, []);

  // Upload selected photos
  const handleUpload = useCallback(async () => {
    const selectedPhotos = photos.filter(p => p.selected);
    if (selectedPhotos.length === 0) {
      Alert.alert('알림', '업로드할 사진을 선택해주세요.');
      return;
    }

    if (!user) {
      Alert.alert('오류', '로그인이 필요합니다.');
      return;
    }

    Alert.alert(
      '사진 업로드',
      `${selectedPhotos.length}장의 사진을 업로드하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '업로드',
          onPress: async () => {
            setIsUploading(true);
            setUploadProgress({ current: 0, total: selectedPhotos.length });

            try {
              const result = await uploadPhotos(
                user.id,
                selectedPhotos,
                (current, total, status) => {
                  setUploadProgress({ current, total });
                  if (status === 'hashing') {
                    setLoadingMessage(`중복 검사 중... ${current}/${total}`);
                  } else {
                    setLoadingMessage(`업로드 중... ${current}/${total}`);
                  }
                }
              );

              // Update last sync time
              await updateLastSync(user.id);
              await refreshProfile();

              // Clear uploaded photos from list
              setPhotos(prev => prev.filter(p => !p.selected));

              // Build result message
              let resultMessage = `${result.success}장 성공`;
              if (result.skipped > 0) {
                resultMessage += `, ${result.skipped}장 중복 제외`;
              }
              if (result.failed > 0) {
                resultMessage += `, ${result.failed}장 실패`;
              }

              Alert.alert('업로드 완료', resultMessage);
            } catch (error) {
              console.error('Upload error:', error);
              Alert.alert('오류', '업로드 중 오류가 발생했습니다.');
            } finally {
              setIsUploading(false);
              setUploadProgress({ current: 0, total: 0 });
            }
          },
        },
      ]
    );
  }, [photos, user, refreshProfile]);

  // Handle logout
  const handleLogout = useCallback(() => {
    Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: logout,
      },
    ]);
  }, [logout]);

  // Handle gallery picker open
  const handleOpenGalleryPicker = useCallback(async () => {
    if (!hasPermission) {
      const granted = await requestMediaLibraryPermission();
      if (!granted) {
        Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.');
        return;
      }
      setHasPermission(true);
    }
    setIsGalleryPickerVisible(true);
  }, [hasPermission]);

  // Handle selected photos from gallery picker
  const handleGalleryPickerComplete = useCallback((selectedPhotos: PhotoAsset[]) => {
    if (selectedPhotos.length === 0) return;

    // Merge with existing photos, avoiding duplicates
    setPhotos(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const newPhotos = selectedPhotos.filter(p => !existingIds.has(p.id));
      return [...prev, ...newPhotos];
    });
  }, []);

  // Format date for display
  const formatDate = (date: Date | null) => {
    if (!date) return '없음';
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <LoadingOverlay
        visible={isScanning || isUploading}
        message={loadingMessage || (isScanning ? '갤러리 스캔 중...' : '업로드 중...')}
      />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>안녕하세요,</Text>
          <Text style={styles.username}>{profile?.username || user?.email}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>
      </View>

      {/* Last sync info */}
      <View style={styles.syncInfo}>
        <Text style={styles.syncLabel}>마지막 스캔 날짜</Text>
        <Text style={styles.syncDate}>{formatDate(lastSyncDate)}</Text>
      </View>

      {/* Empty state with scan buttons */}
      {photos.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            마지막으로 업로드한 날짜를 기준으로{'\n'}새롭게 생긴 사진을 불러오거나{'\n'}갤러리에서 직접 선택합니다.
          </Text>
          <View style={styles.emptyButtons}>
            <TouchableOpacity style={styles.scanButton} onPress={handleScanGallery}>
              <Text style={styles.scanButtonText}>갤러리 스캔</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pickButton} onPress={handleOpenGalleryPicker}>
              <Text style={styles.pickButtonText}>갤러리에서 선택</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Photo grid */}
      {photos.length > 0 && (
        <>
          {/* Selection controls */}
          <View style={styles.controls}>
            <Text style={styles.photoCount}>
              {selectedCount} / {photos.length}장 선택됨
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

          {/* Photo grid */}
          <View style={styles.gridContainer}>
            <PhotoGrid photos={photos} onToggleSelect={handleToggleSelect} />
          </View>

          {/* Action buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.rescanButton}
              onPress={handleScanGallery}
            >
              <Text style={styles.rescanButtonText}>다시 스캔</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addMoreButton}
              onPress={handleOpenGalleryPicker}
            >
              <Text style={styles.addMoreButtonText}>추가 선택</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.uploadButton, selectedCount === 0 && styles.uploadButtonDisabled]}
              onPress={handleUpload}
              disabled={selectedCount === 0}
            >
              <Text style={styles.uploadButtonText}>
                업로드 ({selectedCount})
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Upload progress */}
      {isUploading && uploadProgress.total > 0 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${(uploadProgress.current / uploadProgress.total) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {uploadProgress.current} / {uploadProgress.total}
          </Text>
        </View>
      )}

      {/* Gallery Picker Modal */}
      <GalleryPickerModal
        visible={isGalleryPickerVisible}
        onClose={() => setIsGalleryPickerVisible(false)}
        onPhotosSelected={handleGalleryPickerComplete}
        existingPhotoIds={existingPhotoIds}
      />

      {/* Permission Request Modal */}
      <PermissionModal
        visible={showPermissionModal}
        onClose={async () => {
          // Mark as shown so it never appears again
          await AsyncStorage.setItem('permissionModalShown', 'true');
          // Re-check permission
          const { status } = await MediaLibrary.getPermissionsAsync();
          if (status === 'granted') {
            setHasPermission(true);
          }
          setShowPermissionModal(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  greeting: {
    fontSize: 14,
    color: '#94a3b8',
  },
  username: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f1f5f9',
  },
  logoutButton: {
    padding: 8,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 14,
  },
  syncInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1e293b',
  },
  syncLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  syncDate: {
    fontSize: 14,
    color: '#06b6d4',
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  emptyButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  scanButton: {
    backgroundColor: '#06b6d4',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
  },
  scanButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pickButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#06b6d4',
  },
  pickButtonText: {
    color: '#06b6d4',
    fontSize: 16,
    fontWeight: 'bold',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  photoCount: {
    fontSize: 14,
    color: '#f1f5f9',
    fontWeight: '500',
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
  gridContainer: {
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  rescanButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#334155',
    alignItems: 'center',
  },
  rescanButtonText: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '500',
  },
  addMoreButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#06b6d4',
    alignItems: 'center',
  },
  addMoreButtonText: {
    color: '#06b6d4',
    fontSize: 14,
    fontWeight: '500',
  },
  uploadButton: {
    flex: 1.5,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#06b6d4',
    alignItems: 'center',
  },
  uploadButtonDisabled: {
    backgroundColor: '#334155',
  },
  uploadButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#06b6d4',
  },
  progressText: {
    color: '#f1f5f9',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});
