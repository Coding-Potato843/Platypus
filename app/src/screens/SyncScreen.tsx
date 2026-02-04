import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, PhotoAsset } from '../types';
import { useAuth } from '../hooks/useAuth';
import { PhotoGrid } from '../components/PhotoGrid';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { GalleryPickerModal } from '../components/GalleryPickerModal';
import { PermissionModal } from '../components/PermissionModal';
import { useCustomAlert, useToast } from '../components/CustomAlert';
import * as MediaLibrary from 'expo-media-library';
import {
  fetchPhotosAfterDate,
  uploadPhotos,
} from '../services/photos';
import { updateLastSync } from '../services/auth';

type SyncScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Sync'>;
};

type TabType = 'scan' | 'picker';

export function SyncScreen({ navigation }: SyncScreenProps) {
  const { user, profile, logout, refreshProfile } = useAuth();
  const { showAlert, AlertComponent } = useCustomAlert();
  const { showToast, ToastComponent } = useToast();

  // 현재 활성 탭
  const [activeTab, setActiveTab] = useState<TabType>('scan');

  // 각 탭별 사진 목록 (독립적으로 관리)
  const [scanPhotos, setScanPhotos] = useState<PhotoAsset[]>([]);
  const [pickerPhotos, setPickerPhotos] = useState<PhotoAsset[]>([]);

  const [loadingMessage, setLoadingMessage] = useState('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [isUploading, setIsUploading] = useState(false);
  const [isGalleryPickerVisible, setIsGalleryPickerVisible] = useState(false);

  // 현재 탭의 사진 목록
  const currentPhotos = activeTab === 'scan' ? scanPhotos : pickerPhotos;
  const setCurrentPhotos = activeTab === 'scan' ? setScanPhotos : setPickerPhotos;

  const selectedCount = currentPhotos.filter(p => p.selected).length;

  // Supabase timestamp 컬럼은 'Z' 없이 반환하므로 UTC로 파싱하기 위해 'Z' 추가
  const lastSyncDate = profile?.last_sync_at
    ? new Date(profile.last_sync_at.endsWith('Z') ? profile.last_sync_at : profile.last_sync_at + 'Z')
    : null;

  // 이미 추가된 사진 ID Set (갤러리 피커에서 중복 방지용)
  const existingPhotoIds = useMemo(() => new Set(pickerPhotos.map(p => p.id)), [pickerPhotos]);

  // Check permission on mount and when app returns to foreground
  useEffect(() => {
    const checkPermission = async () => {
      const { status } = await MediaLibrary.getPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    // Check on mount
    checkPermission();

    // Check when app returns to foreground (after user grants permission in settings)
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkPermission();
      }
    });

    return () => subscription.remove();
  }, []);

  // Scan gallery for new photos
  const handleScanGallery = useCallback(async () => {
    if (!hasPermission) {
      // First try system permission request (photo only, no video/audio)
      const { status } = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
      if (status === 'granted') {
        setHasPermission(true);
        // Continue to scan below
      } else {
        // If denied, show custom modal with settings guide
        setShowPermissionModal(true);
        return;
      }
    }

    setIsScanning(true);
    setLoadingMessage('갤러리 스캔 중...');

    try {
      const scannedPhotos = await fetchPhotosAfterDate(lastSyncDate);
      setScanPhotos(scannedPhotos);

      if (scannedPhotos.length === 0) {
        showAlert(
          '스캔 완료',
          lastSyncDate
            ? '새로운 사진이 없습니다.'
            : '갤러리에 사진이 없습니다.'
        );
      }
    } catch (error) {
      console.error('Scan error:', error);
      showAlert('오류', '갤러리 스캔 중 오류가 발생했습니다.');
    } finally {
      setIsScanning(false);
    }
  }, [hasPermission, lastSyncDate, showAlert]);

  // Toggle photo selection
  const handleToggleSelect = useCallback((id: string) => {
    setCurrentPhotos(prev =>
      prev.map(p => (p.id === id ? { ...p, selected: !p.selected } : p))
    );
  }, [setCurrentPhotos]);

  // Select all photos
  const handleSelectAll = useCallback(() => {
    setCurrentPhotos(prev => prev.map(p => ({ ...p, selected: true })));
  }, [setCurrentPhotos]);

  // Deselect all photos
  const handleDeselectAll = useCallback(() => {
    setCurrentPhotos(prev => prev.map(p => ({ ...p, selected: false })));
  }, [setCurrentPhotos]);

  // Upload selected photos
  const handleUpload = useCallback(async () => {
    const selectedPhotos = currentPhotos.filter(p => p.selected);
    if (selectedPhotos.length === 0) {
      showAlert('알림', '업로드할 사진을 선택해주세요.');
      return;
    }

    if (!user) {
      showAlert('오류', '로그인이 필요합니다.');
      return;
    }

    const performUpload = async () => {
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

        // 갤러리 스캔 탭에서만 마지막 스캔 날짜 업데이트
        if (activeTab === 'scan') {
          await updateLastSync(user.id);
          await refreshProfile();
        }

        // Clear uploaded photos from list
        setCurrentPhotos(prev => prev.filter(p => !p.selected));

        // Build result message for toast
        let resultMessage = `${result.success}장 업로드 완료`;
        if (result.skipped > 0) {
          resultMessage += `, ${result.skipped}장 중복 제외`;
        }
        if (result.failed > 0) {
          resultMessage += `, ${result.failed}장 실패`;
        }

        showToast(resultMessage);
      } catch (error) {
        console.error('Upload error:', error);
        showAlert('오류', '업로드 중 오류가 발생했습니다.');
      } finally {
        setIsUploading(false);
        setUploadProgress({ current: 0, total: 0 });
      }
    };

    showAlert(
      '사진 업로드',
      `${selectedPhotos.length}장의 사진을 업로드하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        { text: '업로드', onPress: performUpload },
      ]
    );
  }, [currentPhotos, user, refreshProfile, activeTab, setCurrentPhotos, showAlert, showToast]);

  // Handle logout
  const handleLogout = useCallback(() => {
    showAlert('로그아웃', '로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: logout },
    ]);
  }, [logout, showAlert]);

  // Handle gallery picker open
  const handleOpenGalleryPicker = useCallback(async () => {
    if (!hasPermission) {
      // First try system permission request (photo only, no video/audio)
      const { status } = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
      if (status === 'granted') {
        setHasPermission(true);
        // Continue to open picker below
      } else {
        // If denied, show custom modal with settings guide
        setShowPermissionModal(true);
        return;
      }
    }
    setIsGalleryPickerVisible(true);
  }, [hasPermission]);

  // Handle selected photos from gallery picker
  const handleGalleryPickerComplete = useCallback((selectedPhotos: PhotoAsset[]) => {
    if (selectedPhotos.length === 0) return;

    // Merge with existing photos, avoiding duplicates
    setPickerPhotos(prev => {
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

  // 탭 전환 핸들러
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
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

      {/* Tab Buttons */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'scan' && styles.tabActive]}
          onPress={() => handleTabChange('scan')}
        >
          <Text style={[styles.tabText, activeTab === 'scan' && styles.tabTextActive]}>
            갤러리 스캔
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'picker' && styles.tabActive]}
          onPress={() => handleTabChange('picker')}
        >
          <Text style={[styles.tabText, activeTab === 'picker' && styles.tabTextActive]}>
            갤러리에서 선택
          </Text>
        </TouchableOpacity>
      </View>

      {/* 갤러리 스캔 탭에서만 마지막 스캔 날짜 표시 */}
      {activeTab === 'scan' && (
        <View style={styles.syncInfo}>
          <Text style={styles.syncLabel}>마지막 스캔 날짜</Text>
          <Text style={styles.syncDate}>{formatDate(lastSyncDate)}</Text>
        </View>
      )}

      {/* 갤러리 스캔 탭 - Empty State */}
      {activeTab === 'scan' && scanPhotos.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            마지막 스캔 날짜 이후의{'\n'}새로운 사진을 자동으로 불러옵니다.
          </Text>
          <TouchableOpacity style={styles.scanButton} onPress={handleScanGallery}>
            <Text style={styles.scanButtonText}>갤러리 스캔</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 갤러리에서 선택 탭 - Empty State */}
      {activeTab === 'picker' && pickerPhotos.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            갤러리에서 원하는 사진을{'\n'}직접 선택하여 업로드합니다.
          </Text>
          <Text style={styles.emptySubText}>
            마지막 스캔 날짜와 관계없이{'\n'}모든 사진을 선택할 수 있습니다.
          </Text>
          <TouchableOpacity style={styles.pickButton} onPress={handleOpenGalleryPicker}>
            <Text style={styles.pickButtonText}>갤러리에서 선택</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Photo grid */}
      {currentPhotos.length > 0 && (
        <>
          {/* Selection controls */}
          <View style={styles.controls}>
            <Text style={styles.photoCount}>
              {selectedCount} / {currentPhotos.length}장 선택됨
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
            <PhotoGrid photos={currentPhotos} onToggleSelect={handleToggleSelect} />
          </View>

          {/* Action buttons */}
          <View style={styles.actionButtons}>
            {activeTab === 'scan' ? (
              <TouchableOpacity
                style={styles.rescanButton}
                onPress={handleScanGallery}
              >
                <Text style={styles.rescanButtonText}>다시 스캔</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.addMoreButton}
                onPress={handleOpenGalleryPicker}
              >
                <Text style={styles.addMoreButtonText}>추가 선택</Text>
              </TouchableOpacity>
            )}
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
          // Re-check permission after user returns from settings
          const { status } = await MediaLibrary.getPermissionsAsync();
          if (status === 'granted') {
            setHasPermission(true);
          }
          setShowPermissionModal(false);
        }}
      />

      {/* Custom Alert Modal */}
      <AlertComponent />

      {/* Toast Notification */}
      <ToastComponent />
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    margin: 16,
    marginBottom: 0,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: '#06b6d4',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tabTextActive: {
    color: '#0f172a',
  },
  syncInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
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
    marginBottom: 12,
  },
  emptySubText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  scanButton: {
    backgroundColor: '#06b6d4',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  scanButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pickButton: {
    backgroundColor: '#06b6d4',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  pickButtonText: {
    color: '#0f172a',
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
