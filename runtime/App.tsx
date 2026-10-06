import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import RuntimeRenderer from './src/RuntimeRenderer';
import { BgmPlayer } from './src/BgmPlayer';
import { RuntimeSettingsButton } from './src/RuntimeSettingsButton';
import { RuntimeSettingsSheet } from './src/RuntimeSettingsSheet';
import {
  DEFAULT_RUNTIME_SETTINGS,
  loadRuntimeSettings,
  type RuntimeSettings,
} from './src/runtimeSettings';
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
import {
  getAssetDebugInfo,
  prepareAssetCache,
  type AssetDebugInfo,
} from './src/assetResolver';
import type { PageComponent } from '../src/types/component';
import type { Project } from '../src/types/project';
import projectEnvelope from '../project.json';

/**
 * Set to false to hide the on-device asset debug overlay.
 * Flip to false before shipping a clean build to end users.
 */
const SHOW_ASSET_DEBUG = false;

interface ProjectEnvelope {
  version: number;
  project: Project;
}

function readProject(): Project {
  const envelope = projectEnvelope as unknown as ProjectEnvelope;
  const project = envelope?.project;
  if (!project || !Array.isArray(project.pages) || project.pages.length === 0) {
    throw new Error('project.json is empty or malformed.');
  }
  return project;
}

export default function App(): React.ReactElement {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<AssetDebugInfo | null>(null);
  const [showDebug, setShowDebug] = useState<boolean>(SHOW_ASSET_DEBUG);
  const [settingsVisible, setSettingsVisible] = useState<boolean>(false);
  const [runtimeSettings, setRuntimeSettings] = useState<RuntimeSettings>(
    DEFAULT_RUNTIME_SETTINGS,
  );

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
        await prepareAssetCache();
        if (cancelled) return;
        setDebug(getAssetDebugInfo());

        const loaded = readProject();
        if (cancelled) return;

        const [progress, savedSettings] = await Promise.all([
          loadProgress(loaded.id),
          loadRuntimeSettings(loaded.id),
        ]);
        if (cancelled) return;

        const startId = resolveStartPage(loaded, progress);

        setProject(loaded);
        setRuntimeSettings(savedSettings);
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
    (component: PageComponent): void => {
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

  const handleOpenSettings = useCallback((): void => {
    setSettingsVisible(true);
  }, []);

  const handleCloseSettings = useCallback((): void => {
    setSettingsVisible(false);
  }, []);

  const handleSettingsChanged = useCallback(
    (next: RuntimeSettings): void => {
      setRuntimeSettings(next);
    },
    [],
  );

  if (loading) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#F8FAFC',
          }}
        >
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={{ marginTop: 12, color: '#64748B' }}>
            Loading your app…
          </Text>
        </View>
      </GestureHandlerRootView>
    );
  }

  if (error || !project || !activePage) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 24,
            backgroundColor: '#F8FAFC',
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
      </GestureHandlerRootView>
    );
  }

  const bgmEnabled = activePage.bgmEnabled === true && !!activePage.bgmUrl;
  const bgmUrl = activePage.bgmUrl;
  const bgmLoop = activePage.bgmLoop !== false; // default true
  const assetToken = project.assetToken;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <RuntimeRenderer
          page={activePage}
          variables={state.variables}
          hiddenComponentIds={state.hiddenComponentIds}
          onComponentPress={onComponentPress}
          onInputChange={onInputChange}
          canvasBackgroundColor="#FFFFFF"
          projectAssetToken={assetToken}
        />

        <BgmPlayer
          pageId={activePage.id}
          enabled={bgmEnabled}
          url={bgmUrl}
          loop={bgmLoop}
          accessToken={assetToken}
          userEnabled={runtimeSettings.bgmEnabled}
        />

        <RuntimeSettingsButton onPress={handleOpenSettings} />

        {showDebug && debug ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              backgroundColor: 'rgba(0,0,0,0.85)',
              paddingTop: 40,
              paddingHorizontal: 12,
              paddingBottom: 12,
            }}
            pointerEvents="box-none"
          >
            <ScrollView style={{ maxHeight: 220 }} pointerEvents="box-none">
              <Text style={{ color: '#0F0', fontSize: 10, fontWeight: '700' }}>
                ASSET DEBUG
              </Text>
              <Text style={{ color: '#FFF', fontSize: 10, marginTop: 2 }}>
                attempted: {String(debug.attempted)}
              </Text>
              <Text style={{ color: '#FFF', fontSize: 10 }}>
                cacheDir exists: {String(debug.cacheDirExists)}
              </Text>
              <Text style={{ color: '#FFF', fontSize: 10 }}>
                filesFound: {debug.filesFound}
              </Text>
              <Text style={{ color: '#FFF', fontSize: 10 }}>
                filesCopied: {debug.filesCopied}
              </Text>
              <Text style={{ color: '#FFF', fontSize: 10 }}>
                bgm user setting: {String(runtimeSettings.bgmEnabled)}
              </Text>
              {debug.errors.length > 0 ? (
                <>
                  <Text style={{ color: '#F00', fontSize: 10, marginTop: 4 }}>
                    errors:
                  </Text>
                  {debug.errors.map((e, i) => (
                    <Text
                      key={`${i}-${e}`}
                      style={{ color: '#F88', fontSize: 10, marginLeft: 6 }}
                    >
                      • {e}
                    </Text>
                  ))}
                </>
              ) : null}
            </ScrollView>
            <Text
              style={{ color: '#0AF', fontSize: 10, marginTop: 4 }}
              onPress={() => setShowDebug(false)}
            >
              Tap to hide
            </Text>
          </View>
        ) : null}
      </View>

      <RuntimeSettingsSheet
        visible={settingsVisible}
        onClose={handleCloseSettings}
        projectId={project.id}
        projectName={project.name}
        appVersion={project.version}
        onSettingsChanged={handleSettingsChanged}
      />
    </GestureHandlerRootView>
  );
}