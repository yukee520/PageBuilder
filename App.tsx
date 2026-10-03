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

type FontStatus = 'loading' | 'ready' | 'failed';

function useIoniconReadiness(): FontStatus {
  const [status, setStatus] = useState<FontStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    const check = (): Promise<void> =>
      new Promise<void>((resolve, reject) => {
        try {
          Ionicons.getImageSource('add', 24, '#000000')
            .then(() => resolve())
            .catch(() => reject(new Error('icon-load-failed')));
        } catch {
          reject(new Error('icon-load-failed'));
        }
      });

    const attempt = async (): Promise<void> => {
      for (let i = 0; i < 10; i += 1) {
        try {
          await check();
          if (!cancelled) setStatus('ready');
          return;
        } catch {
          await new Promise<void>(r => {
            setTimeout(r, 300);
          });
        }
      }
      if (!cancelled) setStatus('failed');
    };

    void attempt();

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