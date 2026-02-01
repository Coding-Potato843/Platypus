import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';

interface PermissionModalProps {
  visible: boolean;
  onRequestPermission: () => void;
  onOpenSettings: () => void;
  permissionDenied: boolean;
}

export function PermissionModal({
  visible,
  onRequestPermission,
  onOpenSettings,
  permissionDenied,
}: PermissionModalProps) {
  const handleOpenSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
    onOpenSettings();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>📷</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>
            {permissionDenied ? '갤러리 접근 권한 필요' : '갤러리 접근 권한'}
          </Text>

          {/* Description */}
          <Text style={styles.description}>
            {permissionDenied
              ? '갤러리 접근 권한이 거부되었습니다.\n설정에서 권한을 허용해주세요.'
              : '사진을 불러오고 업로드하려면\n갤러리 접근 권한이 필요합니다.'}
          </Text>

          {/* Features list */}
          {!permissionDenied && (
            <View style={styles.featureList}>
              <View style={styles.featureItem}>
                <Text style={styles.featureIcon}>✓</Text>
                <Text style={styles.featureText}>갤러리에서 사진 불러오기</Text>
              </View>
              <View style={styles.featureItem}>
                <Text style={styles.featureIcon}>✓</Text>
                <Text style={styles.featureText}>새로운 사진 자동 스캔</Text>
              </View>
              <View style={styles.featureItem}>
                <Text style={styles.featureIcon}>✓</Text>
                <Text style={styles.featureText}>사진 위치 정보 읽기</Text>
              </View>
            </View>
          )}

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            {permissionDenied ? (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleOpenSettings}
              >
                <Text style={styles.primaryButtonText}>설정으로 이동</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={onRequestPermission}
              >
                <Text style={styles.primaryButtonText}>권한 허용</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Privacy note */}
          <Text style={styles.privacyNote}>
            사진은 안전하게 보호되며,{'\n'}
            선택한 사진만 업로드됩니다.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f1f5f9',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  featureList: {
    width: '100%',
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  featureIcon: {
    fontSize: 16,
    color: '#06b6d4',
    marginRight: 12,
    fontWeight: 'bold',
  },
  featureText: {
    fontSize: 14,
    color: '#e2e8f0',
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#06b6d4',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  privacyNote: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
});
