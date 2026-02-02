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
  onClose: () => void;
}

export function PermissionModal({ visible, onClose }: PermissionModalProps) {
  const handleOpenSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
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
          <Text style={styles.title}>갤러리 접근 권한 필요</Text>

          {/* Description */}
          <Text style={styles.description}>
            사진을 불러오고 업로드하려면{'\n'}
            갤러리 접근 권한이 필요합니다.
          </Text>

          {/* Step-by-step guide */}
          <View style={styles.guideBox}>
            <Text style={styles.guideTitle}>설정에서 이렇게 허용해주세요:</Text>
            <View style={styles.guideSteps}>
              <Text style={styles.guideStep}>1. 권한</Text>
              <Text style={styles.guideArrow}>→</Text>
              <Text style={styles.guideStep}>2. 사진 및 동영상</Text>
              <Text style={styles.guideArrow}>→</Text>
              <Text style={styles.guideStep}>3. 허용</Text>
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleOpenSettings}
            >
              <Text style={styles.primaryButtonText}>설정으로 이동</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onClose}
            >
              <Text style={styles.secondaryButtonText}>알겠습니다</Text>
            </TouchableOpacity>
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
    marginBottom: 20,
  },
  guideBox: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  guideTitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 12,
    textAlign: 'center',
  },
  guideSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  guideStep: {
    fontSize: 14,
    color: '#06b6d4',
    fontWeight: '600',
  },
  guideArrow: {
    fontSize: 14,
    color: '#64748b',
    marginHorizontal: 8,
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
  secondaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButtonText: {
    color: '#94a3b8',
    fontSize: 15,
  },
  privacyNote: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
});
