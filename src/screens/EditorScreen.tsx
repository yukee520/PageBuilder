import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import ScreenHeader from '@/components/ScreenHeader';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import EmptyState from '@/components/EmptyState';
import PageTabBar from '@/components/PageTabBar';
import ComponentListItem from '@/components/ComponentListItem';
import { useProject } from '@/hooks/useProject';
import { saveProjectFile } from '@/hooks/useProjects';
import { useProjectStore } from '@/store/useProjectStore';
import type { ComponentType, PageComponent } from '@/types/component';
import { COMPONENT_TYPE_ICONS, COMPONENT_TYPE_LABELS } from '@/types/component';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'Editor'>;

const COMPONENT_TYPES: ComponentType[] = [
  'text',
  'image',
  'video',
  'button',
  'input',
  'row',
  'spacer',
  'divider',
];

const AUTOSAVE_DELAY_MS = 500;

export default function EditorScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { projectId } = route.params;
  const { project, loading, error, reload } = useProject(projectId);

  const storeProject = useProjectStore(s => s.project);
  const dirty = useProjectStore(s => s.dirty);
  const setProject = useProjectStore(s => s.setProject);
  const markClean = useProjectStore(s => s.markClean);
  const activePageId = useProjectStore(s => s.activePageId);
  const setActivePage = useProjectStore(s => s.setActivePage);
  const addPage = useProjectStore(s => s.addPage);
  const addComponent = useProjectStore(s => s.addComponent);
  const removeComponent = useProjectStore(s => s.removeComponent);
  const reorderComponents = useProjectStore(s => s.reorderComponents);
  const toggleComponentVisibility = useProjectStore(
    s => s.toggleComponentVisibility,
  );

  const [showPicker, setShowPicker] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasHydratedRef = useRef<boolean>(false);

  useEffect(() => {
    if (project) {
      setProject(project);
      hasHydratedRef.current = true;
    }
  }, [project, setProject]);

  useEffect(() => {
    if (!hasHydratedRef.current) return;
    if (!dirty) return;
    if (!storeProject) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      setSaving(true);
      saveProjectFile(storeProject)
        .then(() => {
          markClean();
        })
        .catch((err: unknown) => {
          const msg =
            err instanceof Error ? err.message : 'Autosave failed.';
          Toast.show({
            type: 'error',
            text1: 'Could not save',
            text2: msg,
          });
        })
        .finally(() => {
          setSaving(false);
          saveTimerRef.current = null;
        });
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [dirty, storeProject, markClean]);

  useEffect(() => {
    return () => {
      const current = useProjectStore.getState().project;
      const isDirty = useProjectStore.getState().dirty;
      if (current && isDirty) {
        void saveProjectFile(current);
      }
    };
  }, []);

  const activePage = useMemo(() => {
    if (!storeProject) return null;
    return (
      storeProject.pages.find(p => p.id === activePageId) ??
      storeProject.pages[0] ??
      null
    );
  }, [storeProject, activePageId]);

  const components = useMemo<PageComponent[]>(
    () => activePage?.components ?? [],
    [activePage],
  );

  const handleBack = useCallback((): void => {
    const current = useProjectStore.getState().project;
    const isDirty = useProjectStore.getState().dirty;
    if (current && isDirty) {
      saveProjectFile(current).catch(() => {
        // silent: best-effort save on exit
      });
    }
    navigation.goBack();
  }, [navigation]);

  const handleOpenProjectSettings = useCallback((): void => {
    navigation.navigate('ProjectSettings', { projectId });
  }, [navigation, projectId]);

  const handlePreview = useCallback((): void => {
    const current = useProjectStore.getState().project;
    const isDirty = useProjectStore.getState().dirty;
    if (current && isDirty) {
      saveProjectFile(current).catch(() => undefined);
    }
    navigation.navigate('Preview', { projectId });
  }, [navigation, projectId]);

  const handleAddComponent = useCallback(
    (type: ComponentType): void => {
      if (!activePage) return;
      const newId = addComponent(activePage.id, type);
      setShowPicker(false);
      if (newId) {
        navigation.navigate('ComponentEdit', {
          projectId,
          pageId: activePage.id,
          componentId: newId,
        });
      }
    },
    [activePage, addComponent, navigation, projectId],
  );

  const handleComponentPress = useCallback(
    (component: PageComponent): void => {
      if (!activePage) return;
      navigation.navigate('ComponentEdit', {
        projectId,
        pageId: activePage.id,
        componentId: component.id,
      });
    },
    [activePage, navigation, projectId],
  );

  const handleRemoveComponent = useCallback(
    (component: PageComponent): void => {
      if (!activePage) return;
      Alert.alert(
        'Remove component?',
        `This ${COMPONENT_TYPE_LABELS[component.type]} will be deleted from this page.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              removeComponent(activePage.id, component.id);
              Toast.show({ type: 'success', text1: 'Component removed' });
            },
          },
        ],
      );
    },
    [activePage, removeComponent],
  );

  const handleAddPage = useCallback((): void => {
    addPage();
    Toast.show({ type: 'success', text1: 'Page added' });
  }, [addPage]);

  const handleSelectPage = useCallback(
    (pageId: string): void => {
      setActivePage(pageId);
    },
    [setActivePage],
  );

  const renderComponentItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<PageComponent>) => (
      <ScaleDecorator>
        <ComponentListItem
          component={item}
          onPress={() => handleComponentPress(item)}
          onLongPress={() => handleRemoveComponent(item)}
          onToggleVisibility={() => {
            if (activePage) {
              toggleComponentVisibility(activePage.id, item.id);
            }
          }}
          drag={drag}
          isActive={isActive}
        />
      </ScaleDecorator>
    ),
    [
      activePage,
      handleComponentPress,
      handleRemoveComponent,
      toggleComponentVisibility,
    ],
  );

  const handleDragEnd = useCallback(
    ({ data }: { data: PageComponent[] }): void => {
      if (!activePage) return;
      reorderComponents(
        activePage.id,
        data.map(c => c.id),
      );
    },
    [activePage, reorderComponents],
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader title="Editor" onBack={handleBack} />
        <LoadingState message="Opening project…" />
      </SafeAreaView>
    );
  }

  if (error || !storeProject) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader title="Editor" onBack={handleBack} />
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
        <ScreenHeader title={storeProject.name} onBack={handleBack} />
        <EmptyState
          icon="document-outline"
          title="No pages yet"
          description="Add a page to start building."
          actionLabel="Add page"
          onAction={handleAddPage}
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
        title={storeProject.name}
        subtitle={saving ? 'Saving…' : activePage.title}
        onBack={handleBack}
        rightActions={[
          {
            icon: 'play-circle-outline',
            onPress: handlePreview,
            accessibilityLabel: 'Preview',
          },
          {
            icon: 'settings-outline',
            onPress: handleOpenProjectSettings,
            accessibilityLabel: 'Project settings',
          },
        ]}
      />

      <PageTabBar
        pages={storeProject.pages}
        activePageId={activePage.id}
        onSelectPage={handleSelectPage}
        onAddPage={handleAddPage}
        onManagePages={handleOpenProjectSettings}
      />

      <View className="flex-1">
        {components.length === 0 ? (
          <EmptyState
            icon="cube-outline"
            title="This page is empty"
            description="Tap the + button to add your first component."
            actionLabel="Add component"
            onAction={() => setShowPicker(true)}
          />
        ) : (
          <DraggableFlatList
            data={components}
            keyExtractor={item => item.id}
            renderItem={renderComponentItem}
            onDragEnd={handleDragEnd}
            contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
          />
        )}

        <Pressable
          onPress={() => setShowPicker(true)}
          className="absolute right-5 bottom-6 w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel="Add component"
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      </View>

      {showPicker ? (
        <Pressable
          onPress={() => setShowPicker(false)}
          className="absolute inset-0 bg-black/40 justify-end"
        >
          <Pressable onPress={() => undefined}>
            <View className="bg-card dark:bg-dark-card rounded-t-3xl p-4 pb-8">
              <View className="w-10 h-1 rounded-full bg-border dark:bg-dark-border self-center mb-3" />
              <Text className="text-base font-semibold text-text dark:text-dark-text mb-3">
                Add component
              </Text>
              <FlatList
                data={COMPONENT_TYPES}
                keyExtractor={t => t}
                numColumns={4}
                columnWrapperStyle={{ justifyContent: 'space-between' }}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => handleAddComponent(item)}
                    className="w-[24%] items-center py-3 mb-2 rounded-xl bg-background dark:bg-dark-background active:opacity-70"
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name={COMPONENT_TYPE_ICONS[item]}
                      size={24}
                      color="#2563EB"
                    />
                    <Text className="text-[10px] text-text dark:text-dark-text mt-1 text-center">
                      {COMPONENT_TYPE_LABELS[item]}
                    </Text>
                  </Pressable>
                )}
              />
            </View>
          </Pressable>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}