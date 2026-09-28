import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ScreenHeader from '@/components/ScreenHeader';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import EmptyState from '@/components/EmptyState';
import PageViewRenderer from '@/components/PageViewRenderer';
import Button from '@/components/Button';
import { useProject } from '@/hooks/useProject';
import { usePreviewStore } from '@/store/usePreviewStore';
import type { InteractionAction } from '@/types/action';
import type { PageComponent } from '@/types/component';
import type { Page, Project } from '@/types/project';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'Preview'>;

export default function PreviewScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const params = route.params ?? {};
  const projectId = params.projectId ?? null;

  const { project, loading, error, reload } = useProject(projectId);

  const activePageId = usePreviewStore(s => s.activePageId);
  const history = usePreviewStore(s => s.history);
  const variables = usePreviewStore(s => s.variables);
  const hiddenComponentIds = usePreviewStore(s => s.hiddenComponentIds);
  const init = usePreviewStore(s => s.init);
  const goToPage = usePreviewStore(s => s.goToPage);
  const goBack = usePreviewStore(s => s.goBack);
  const setVariable = usePreviewStore(s => s.setVariable);
  const toggleHidden = usePreviewStore(s => s.toggleHidden);
  const reset = usePreviewStore(s => s.reset);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (project) {
      const startId =
        project.pages.find(p => p.id === project.startPageId)?.id ??
        project.pages[0]?.id ??
        null;
      init(startId);
    }
  }, [project, init]);

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  const activePage = useMemo<Page | null>(() => {
    if (!project) return null;
    if (activePageId) {
      const found = project.pages.find(p => p.id === activePageId);
      if (found) return found;
    }
    return project.pages[0] ?? null;
  }, [project, activePageId]);

  const executeAction = useCallback(
    (action: InteractionAction): void => {
      switch (action.type) {
        case 'navigate':
          if (action.pageId) {
            goToPage(action.pageId);
          } else {
            Alert.alert('This action is not configured yet.');
          }
          break;
        case 'openUrl':
          if (action.url) {
            Linking.openURL(action.url).catch(() => {
              Alert.alert('Could not open URL', action.url);
            });
          }
          break;
        case 'showAlert':
          Alert.alert(action.title || 'Notice', action.message || '');
          break;
        case 'playVideo':
          if (action.url) {
            setVideoUrl(action.url);
          }
          break;
        case 'toggleVisibility':
          if (action.targetComponentId) {
            toggleHidden(action.targetComponentId);
          }
          break;
        case 'setVariable':
          if (action.key) {
            setVariable(action.key, action.value);
          }
          break;
        case 'goBack': {
          const didGoBack = goBack();
          if (!didGoBack) {
            Alert.alert('Nothing to go back to.');
          }
          break;
        }
      }
    },
    [goBack, goToPage, setVariable, toggleHidden],
  );

  const handleComponentPress = useCallback(
    (component: PageComponent): void => {
      if (component.actions.length === 0) return;
      for (const action of component.actions) {
        executeAction(action);
      }
    },
    [executeAction],
  );

  const handleInputChange = useCallback(
    (component: PageComponent, value: string): void => {
      if (component.type === 'input') {
        setVariable(component.variableKey, value);
      }
    },
    [setVariable],
  );

  const inputValues = useMemo(() => variables, [variables]);

  if (!projectId) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader title="Preview" />
        <EmptyState
          icon="play-circle-outline"
          title="Nothing to preview"
          description="Open a project and tap Preview in the editor."
        />
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader title="Preview" onBack={() => navigation.goBack()} />
        <LoadingState message="Preparing preview…" />
      </SafeAreaView>
    );
  }

  if (error || !project) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader title="Preview" onBack={() => navigation.goBack()} />
        <ErrorState
          message={error ?? 'Project not found.'}
          onRetry={() => {
            void reload();
          }}
        />
      </SafeAreaView>
    );
  }

  if (!activePage) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader title={project.name} onBack={() => navigation.goBack()} />
        <EmptyState
          icon="document-outline"
          title="No pages to preview"
          description="Add a page first."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1 bg-background dark:bg-dark-background"
      edges={['top', 'left', 'right']}
    >
      <ScreenHeader
        title="Preview"
        subtitle={activePage.title}
        onBack={() => navigation.goBack()}
        rightActions={[
          {
            icon: 'refresh-outline',
            onPress: () => {
              reset();
              const startId =
                project.pages.find(p => p.id === project.startPageId)?.id ??
                project.pages[0]?.id ??
                null;
              init(startId);
            },
            accessibilityLabel: 'Reset preview',
          },
        ]}
      />

      <FlatList
        data={[activePage]}
        keyExtractor={p => p.id}
        contentContainerStyle={{ paddingVertical: 20 }}
        renderItem={() => (
          <PageViewRenderer
            page={activePage}
            onComponentPress={handleComponentPress}
            onInputChange={(componentId, value) => {
              const comp = activePage.components.find(c => c.id === componentId);
              if (comp) handleInputChange(comp, value);
            }}
            inputValues={inputValues}
            hiddenComponentIds={hiddenComponentIds}
            editable
          />
        )}
      />

      {history.length > 0 ? (
        <View className="absolute left-4 bottom-5">
          <Button
            label="Back"
            icon="arrow-back-outline"
            size="small"
            variant="secondary"
            onPress={() => {
              goBack();
            }}
          />
        </View>
      ) : null}

      <Modal
        visible={videoUrl !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setVideoUrl(null)}
      >
        <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
          <ScreenHeader
            title="Video"
            onBack={() => setVideoUrl(null)}
            rightActions={[
              {
                icon: 'close-outline',
                onPress: () => setVideoUrl(null),
                accessibilityLabel: 'Close',
              },
            ]}
          />
          <View className="flex-1 items-center justify-center p-6">
            <Ionicons name="videocam-outline" size={48} color="#2563EB" />
            <Text className="text-sm text-text dark:text-dark-text mt-4 text-center">
              Video URL:
            </Text>
            <Text
              className="text-xs text-muted dark:text-dark-muted mt-1 text-center"
              selectable
            >
              {videoUrl ?? ''}
            </Text>
            <View className="mt-6">
              <Button
                label="Open externally"
                icon="open-outline"
                variant="secondary"
                onPress={() => {
                  if (videoUrl) {
                    Linking.openURL(videoUrl).catch(() => {
                      Alert.alert('Could not open video URL');
                    });
                  }
                }}
              />
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}