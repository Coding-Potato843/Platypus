import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  onClose?: () => void;
}

export function CustomAlert({
  visible,
  title,
  message,
  buttons = [{ text: '확인', style: 'default' }],
  onClose,
}: CustomAlertProps) {
  const handleButtonPress = (button: AlertButton) => {
    if (button.onPress) {
      button.onPress();
    }
    if (onClose) {
      onClose();
    }
  };

  // Sort buttons: default/destructive first, cancel last (at bottom)
  const sortedButtons = [...buttons].sort((a, b) => {
    if (a.style === 'cancel' && b.style !== 'cancel') return 1;
    if (a.style !== 'cancel' && b.style === 'cancel') return -1;
    return 0;
  });

  const getButtonStyle = (style?: AlertButton['style'], isLast?: boolean) => {
    const baseStyle = [styles.button];

    if (style === 'destructive') {
      baseStyle.push(styles.destructiveButton);
    } else if (style === 'cancel') {
      baseStyle.push(styles.cancelButton);
    } else {
      baseStyle.push(styles.defaultButton);
    }

    if (!isLast) {
      baseStyle.push(styles.buttonMargin);
    }

    return baseStyle;
  };

  const getButtonTextStyle = (style?: AlertButton['style']) => {
    if (style === 'destructive') {
      return styles.destructiveButtonText;
    } else if (style === 'cancel') {
      return styles.cancelButtonText;
    }
    return styles.defaultButtonText;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          {message && <Text style={styles.message}>{message}</Text>}

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            {sortedButtons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={getButtonStyle(button.style, index === sortedButtons.length - 1)}
                onPress={() => handleButtonPress(button)}
                activeOpacity={0.7}
              >
                <Text style={getButtonTextStyle(button.style)}>{button.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Hook for easier usage (similar to Alert.alert API)
interface AlertState {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: AlertButton[];
}

export function useCustomAlert() {
  const [alertState, setAlertState] = React.useState<AlertState>({
    visible: false,
    title: '',
    message: undefined,
    buttons: undefined,
  });

  const showAlert = (
    title: string,
    message?: string,
    buttons?: AlertButton[]
  ) => {
    setAlertState({
      visible: true,
      title,
      message,
      buttons: buttons || [{ text: '확인', style: 'default' }],
    });
  };

  const hideAlert = () => {
    setAlertState((prev) => ({ ...prev, visible: false }));
  };

  const AlertComponent = () => (
    <CustomAlert
      visible={alertState.visible}
      title={alertState.title}
      message={alertState.message}
      buttons={alertState.buttons}
      onClose={hideAlert}
    />
  );

  return { showAlert, hideAlert, AlertComponent };
}

// ============================================
// Toast Component (auto-dismiss notification)
// ============================================

interface ToastProps {
  visible: boolean;
  message: string;
  duration?: number;
  onHide?: () => void;
}

export function Toast({ visible, message, duration = 2500, onHide }: ToastProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (visible) {
      // Fade in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto hide after duration
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 50,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          onHide?.();
        });
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible, duration, fadeAnim, translateY, onHide]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        toastStyles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={toastStyles.content}>
        <Text style={toastStyles.icon}>✓</Text>
        <Text style={toastStyles.message}>{message}</Text>
      </View>
    </Animated.View>
  );
}

// Hook for Toast usage
interface ToastState {
  visible: boolean;
  message: string;
}

export function useToast() {
  const [toastState, setToastState] = React.useState<ToastState>({
    visible: false,
    message: '',
  });

  const showToast = (message: string) => {
    setToastState({
      visible: true,
      message,
    });
  };

  const hideToast = () => {
    setToastState((prev) => ({ ...prev, visible: false }));
  };

  const ToastComponent = () => (
    <Toast
      visible={toastState.visible}
      message={toastState.message}
      onHide={hideToast}
    />
  );

  return { showToast, hideToast, ToastComponent };
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
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f1f5f9',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  buttonContainer: {
    width: '100%',
    marginTop: 8,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonMargin: {
    marginBottom: 8,
  },
  defaultButton: {
    backgroundColor: '#06b6d4',
  },
  defaultButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#334155',
  },
  cancelButtonText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '500',
  },
  destructiveButton: {
    backgroundColor: '#ef4444',
  },
  destructiveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

const toastStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#06b6d4',
  },
  icon: {
    fontSize: 16,
    color: '#06b6d4',
    marginRight: 10,
    fontWeight: 'bold',
  },
  message: {
    fontSize: 14,
    color: '#f1f5f9',
    fontWeight: '500',
  },
});
