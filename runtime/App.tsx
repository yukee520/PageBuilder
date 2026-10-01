import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  SafeAreaView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import RuntimeRenderer from './src/RuntimeRenderer';
import {
  handleAction,
  resolveStartPage,
  type RuntimeState,
} from './src/RuntimeActionHandler';
import {
  DEFAULT_PROGRESS,
  loadProgress,
  saveProgress,
  type OnboardingProgress,
} from './src/onboardingStorage';
import type { Project } from '../src/types/project';

const PROJECT_URL = 'project.json';

async function loadProject(): Promise<Project> {
  const response = await fetch(PROJECT_URL);
  if (!response.ok) {
    throw new Error(`Could not load project.json (status ${response.status})`);
  }
  const data = (await response.json()) as Project;
  if (!data || !Array.isArray(data.pages) || data.pages.length === 0) {
    throw new Error('project.json is empty or malformed.');
  }
  return data;
}

export default function App(): React.ReactElement {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [state, setState] = useState<RuntimeState>({
    activePageId: null,
    history: [],
    variables: {},
    hiddenComponentIds: {},
    onboardingProgress: DEFAULT_PROGRESS,
  });

  const persistProgress = useCallback(
    (progress: OnboardingProgress): void => {
      if (!project) return;
      void saveProgress(project.id, progress);
    },
    [project],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await loadProject();
        if (cancelled) return;

        const progress = await loadProgress(loaded.id);
        if (cancelled) return;

        const startId = resolveStartPage(loaded, progress);

        setProject(loaded);
        setState(prev => ({
          ...prev,
          activePageId: startId,
          onboardingProgress: progress,
        }));
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : 'The application could not be started.';
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activePage = useMemo(() => {
    if (!project) return null;
    return (
      project.pages.find(p => p.id === state.activePageId) ??
      project.pages[0] ??
      null
    );
  }, [project, state.activePageId]);

  const onComponentPress = useCallback(
    (component: import('../src/types/component').PageComponent): void => {
      if (!project) return;
      if (component.actions.length === 0) return;
      for (const action of component.actions) {
        handleAction(action, {
          project,
          state,
          setState,
          onPersistProgress: persistProgress,
          openUrl: url => {
            Linking.openURL(url).catch(() => {
              Alert.alert('Could not open link', url);
            });
          },
          showAlert: (title, message) => {
            Alert.alert(title, message);
          },
          playVideo: url => {
            Linking.openURL(url).catch(() => {
              Alert.alert('Could not play video', url);
            });
          },
        });
      }
    },
    [persistProgress, project, state],
  );

  const onInputChange = useCallback(
    (componentId: string, value: string): void => {
      if (!activePage) return;
      const component = activePage.components.find(c => c.id === componentId);
      if (component && component.type === 'input') {
        setState(prev => ({
          ...prev,
          variables: {
            ...prev.variables,
            [component.variableKey]: value,
          },
        }));
      }
    },
    [activePage],
  );

  if (loading) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
          <StatusBar barStyle="dark-content" />
          <View
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={{ marginTop: 12, color: '#64748B' }}>
              Loading your app…
            </Text>
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  if (error || !project || !activePage) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
          <StatusBar barStyle="dark-content" />
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 24,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: '600',
                color: '#0F172A',
                textAlign: 'center',
              }}
            >
              Unable to start the app
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: '#64748B',
                textAlign: 'center',
                marginTop: 8,
              }}
            >
              {error ?? 'The project data is missing.'}
            </Text>
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#E2E8F0' }}>
        <StatusBar barStyle="dark-content" />
        <RuntimeRenderer
          page={activePage}
          variables={state.variables}
          hiddenComponentIds={state.hiddenComponentIds}
          onComponentPress={onComponentPress}
          onInputChange={onInputChange}
          canvasBackgroundColor="#FFFFFF"
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}