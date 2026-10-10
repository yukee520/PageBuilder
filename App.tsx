import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';

import RootNavigator from './src/navigation/RootNavigator';
import './global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
    },
  },
});

type FontStatus = 'loading' | 'ready';

/**
 * Load the Ionicons font once at app startup.
 *
 * The font is bundled into the APK at
 * `android/app/src/main/assets/fonts/Ionicons.ttf`, so `loadFont()`
 * resolves synchronously in practice. This hook exists so the app
 * never renders before the font is registered — that was the cause of
 * the intermittently-blank icons on cold start.
 *
 * If `loadFont()` fails for any reason, we still render the app (so
 * the user can at least see what's going on), but the icons may be
 * blank. That's the same fallback behaviour as before, just quieter.
 */
function useIoniconReadiness(): FontStatus {
  const [status, setStatus] = useState<FontStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      try {
        await Ionicons.loadFont();
      } catch {
        // Best-effort — no retry loop, no crash. If the font failed
        // to load, icons will show as blank glyphs, but the rest of
        // the app is unaffected.
      } finally {
        if (!cancelled) setStatus('ready');
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}

export default function App(): React.ReactElement {
  const iconStatus = useIoniconReadiness();

  if (iconStatus === 'loading') {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <View
            style={{
              flex: 1,
              backgroundColor: '#F8FAFC',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
          <Toast />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}