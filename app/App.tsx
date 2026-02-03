import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet, BackHandler, ToastAndroid, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from './src/hooks/useAuth';
import { LoginScreen } from './src/screens/LoginScreen';
import { SyncScreen } from './src/screens/SyncScreen';
import { RootStackParamList } from './src/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppContent() {
  const { user, loading } = useAuth();
  const lastBackPressed = useRef<number>(0);

  // Handle back button press - exit app on double press
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      const now = Date.now();

      if (now - lastBackPressed.current < 2000) {
        // Second press within 2 seconds - exit app
        BackHandler.exitApp();
        return true;
      }

      // First press - show toast and record time
      lastBackPressed.current = now;
      ToastAndroid.show('한번 더 누르면 종료됩니다', ToastAndroid.SHORT);
      return true;
    });

    return () => backHandler.remove();
  }, []);

  // Show loading screen while checking auth
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0f172a' },
          animation: 'fade',
        }}
      >
        {user ? (
          <Stack.Screen name="Sync" component={SyncScreen} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
