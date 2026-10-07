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
import Ionicons from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import ScreenHeader from '@/components/ScreenHeader';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import EmptyState from '@/components/EmptyState';
import PageTabBar from '@/components/PageTabBar';
import PageViewRenderer from '@/components/PageViewRenderer';
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
  'music',
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
  const updateComponent = useProjectStore(s => s.updateComponent);
  const toggleComponentVisibility = useProjectStore(
    s => s.toggleComponentVisibility,
  );

  const [showPicker, setShowPicker] = useState<boolean>(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<boolean>(false);
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
        .then(() => markClean())
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

  const selectedComponent = useMemo<PageComponent | null>(() => {
    if (!activePage || !selectedId) return null;
    return activePage.components.find(c => c.id === selectedId) ?? null;
  }, [activePage, selectedId]);

  const saveNow = useCallback((): void => {
    const current = useProjectStore.getState().project;
    const isDirty = useProjectStore.getState().dirty;
    if (current && isDirty) {
      void saveProjectFile(current);
    }
  }, []);

  const saveImmediately = useCallback((): void => {
    const current = useProjectStore.getState().project;
    if (current) {
      void saveProjectFile(current);
      markClean();
    }
  }, [markClean]);

  const handleBack = useCallback((): void => {
    saveNow();
    navigation.goBack();
  }, [navigation, saveNow]);

  const handlePreviewTab = useCallback((): void => {
    saveNow();
    navigation.navigate('Preview', { projectId });
  }, [navigation, projectId, saveNow]);

  const handleOpenBuild = useCallback((): void => {
    saveNow();
    navigation.navigate('Build', { projectId });
  }, [navigation, projectId, saveNow]);

  const handleOpenProjectSettings = useCallback((): void => {
    saveNow();
    navigation.navigate('ProjectSettings', { projectId });
  }, [navigation, projectId, saveNow]);

  const handleAddComponent = useCallback(
    (type: ComponentType): void => {
      if (!activePage) return;
      const newId = addComponent(activePage.id, type);
      setShowPicker(false);
      if (newId) {
        setSelectedId(newId);
      }
    },
    [activePage, addComponent],
  );

  const handleComponentChange = useCallback(
    (
      id: string,
      next: { x: number; y: number; width: number; height: number },
    ): void => {
      if (!activePage) return;
      updateComponent(activePage.id, id, next);
    },
    [activePage, updateComponent],
  );

  const handleRequestEdit = useCallback(
    (id: string): void => {
      if (!activePage) return;
      setSelectedId(id);
      navigation.navigate('ComponentEdit', {
        projectId,
        pageId: activePage.id,
        componentId: id,
      });
    },
    [activePage, navigation, projectId],
  );

  const handleDeleteSelected = useCallback((): void => {
    if (!activePage || !selectedComponent) return;
    Alert.alert(
      'Remove component?',
      `This ${COMPONENT_TYPE_LABELS[selectedComponent.type]} will be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removeComponent(activePage.id, selectedComponent.id);
            setSelectedId(null);
            saveImmediately();
            Toast.show({ type: 'success', text1: 'Component removed' });
          },
        },
      ],
    );
  }, [activePage, removeComponent, saveImmediately, selectedComponent]);

  const handleEditSelected = useCallback((): void => {
    if (!activePage || !selectedComponent) return;
    navigation.navigate('ComponentEdit', {
      projectId,
      pageId: activePage.id,
      componentId: selectedComponent.id,
    });
  }, [activePage, navigation, projectId, selectedComponent]);

  const handleToggleVisibleSelected = useCallback((): void => {
    if (!activePage || !selectedComponent) return;
    toggleComponentVisibility(activePage.id, selectedComponent.id);
    saveImmediately();
  }, [
    activePage,
    saveImmediately,
    selectedComponent,
    toggleComponentVisibility,
  ]);

  const handleBringForward = useCallback((): void => {
    if (!activePage || !selectedComponent) return;
    const maxZ = Math.max(...activePage.components.map(c => c.zIndex));
    if (selectedComponent.zIndex >= maxZ) return;
    updateComponent(activePage.id, selectedComponent.id, {
      zIndex: maxZ + 1,
    });
    saveImmediately();
  }, [activePage, saveImmediately, selectedComponent, updateComponent]);

  const handleSendBackward = useCallback((): void => {
    if (!activePage || !selectedComponent) return;
    const minZ = Math.min(...activePage.components.map(c => c.zIndex));
    if (selectedComponent.zIndex <= minZ) return;
    updateComponent(activePage.id, selectedComponent.id, {
      zIndex: Math.max(1, minZ - 1),
    });
    saveImmediately();
  }, [activePage, saveImmediately, selectedComponent, updateComponent]);

  const handleFitWidth = useCallback((): void => {
    if (!activePage || !selectedComponent) return;
    updateComponent(activePage.id, selectedComponent.id, {
      x: 0,
      width: 1,
    });
    saveImmediately();
    Toast.show({ type: 'success', text1: 'Stretched to full width' });
  }, [activePage, saveImmediately, selectedComponent, updateComponent]);

  const handleFitCanvas = useCallback((): void => {
    if (!activePage || !selectedComponent) return;
    updateComponent(activePage.id, selectedComponent.id, {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    });
    saveImmediately();
    Toast.show({ type: 'success', text1: 'Set to full canvas' });
  }, [activePage, saveImmediately, selectedComponent, updateComponent]);

  const handleSetAsBackground = useCallback((): void => {
    if (!activePage || !selectedComponent) return;
    if (selectedComponent.type !== 'image') {
      Toast.show({
        type: 'error',
        text1: 'Only images can be set as background',
      });
      return;
    }
    updateComponent(activePage.id, selectedComponent.id, {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      rounded: false,
      backgroundMode: true,
      zIndex: 0,
    });
    saveImmediately();
    Toast.show({ type: 'success', text1: 'Image set as background' });
  }, [activePage, saveImmediately, selectedComponent, updateComponent]);

  const handleClearBackgroundMode = useCallback((): void => {
    if (!activePage || !selectedComponent) return;
    updateComponent(activePage.id, selectedComponent.id, {
      backgroundMode: false,
    });
    saveImmediately();
    Toast.show({ type: 'success', text1: 'Background mode off' });
  }, [activePage, saveImmediately, selectedComponent, updateComponent]);

  const handleAddPage = useCallback((): void => {
    addPage();
    saveImmediately();
    Toast.show({ type: 'success', text1: 'Page added' });
  }, [addPage, saveImmediately]);

  const handleSelectPage = useCallback(
    (pageId: string): void => {
      setActivePage(pageId);
      setSelectedId(null);
    },
    [setActivePage],
  );

  const handleSelectComponent = useCallback((id: string | null): void => {
    setSelectedId(id);
  }, []);

  const handleDeselect = useCallback((): void => {
    setSelectedId(null);
  }, []);

  const togglePreviewMode = useCallback((): void => {
    setPreviewMode(p => !p);
    setSelectedId(null);
  }, []);

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

  const isImageSelected =
    selectedComponent !== null && selectedComponent.type === 'image';
  const isBackgroundActive =
    isImageSelected &&
    (selectedComponent as { backgroundMode?: boolean } | null)
      ?.backgroundMode === true;

  return (
    <SafeAreaView
      className="flex-1 bg-background dark:bg-dark-background"
      edges={['top', 'left', 'right']}
    >
      <ScreenHeader
        title={storeProject.name}
        subtitle={
          previewMode
            ? 'Preview mode'
            : saving
            ? 'Saving…'
            : `${activePage.title} · ${activePage.components.length} item${
                activePage.components.length === 1 ? '' : 's'
              }`
        }
        onBack={handleBack}
        rightActions={[
          {
            icon: previewMode ? 'create-outline' : 'eye-outline',
            onPress: togglePreviewMode,
            accessibilityLabel: previewMode ? 'Edit mode' : 'Preview mode',
          },
          {
            icon: 'play-circle-outline',
            onPress: handlePreviewTab,
            accessibilityLabel: 'Open Preview tab',
          },
          {
            icon: 'hammer-outline',
            onPress: handleOpenBuild,
            accessibilityLabel: 'Build APK',
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

      <View className="flex-1 bg-slate-300 dark:bg-slate-950">
        <View className="flex-1 m-2 rounded-2xl overflow-hidden">
          <PageViewRenderer
            page={activePage}
            editable={!previewMode}
            selectedComponentId={selectedId}
            onSelectComponent={handleSelectComponent}
            onComponentChange={handleComponentChange}
            onRequestEdit={handleRequestEdit}
            onComponentPress={component => {
              if (component.actions.length === 0) return;
              for (const action of component.actions) {
                if (action.type === 'navigate' && action.pageId) {
                  setActivePage(action.pageId);
                } else if (action.type === 'showAlert') {
                  Alert.alert(
                    action.title || 'Notice',
                    action.message || '',
                  );
                } else if (action.type === 'openUrl' && action.url) {
                  Alert.alert('Link', action.url);
                }
              }
            }}
            inputValues={{}}
            canvasBackgroundColor="#FFFFFF"
          />

          {!previewMode ? (
            <Pressable
              onPress={() => setShowPicker(true)}
              className="absolute right-5 bottom-6 w-14 h-14 rounded-full bg-primary items-center justify-center active:opacity-80"
              style={{
                shadowColor: '#000',
                shadowOpacity: 0.25,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 3 },
                elevation: 6,
              }}
              accessibilityRole="button"
              accessibilityLabel="Add component"
            >
              <Ionicons name="add" size={28} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {selectedComponent && !previewMode ? (
        <View className="bg-card dark:bg-dark-card border-t border-border dark:border-dark-border px-3 py-2">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs text-muted dark:text-dark-muted">
              {COMPONENT_TYPE_LABELS[selectedComponent.type]} selected
            </Text>
            <Pressable
              onPress={() => setSelectedId(null)}
              hitSlop={8}
              className="p-1"
            >
              <Ionicons name="close" size={16} color="#94A3B8" />
            </Pressable>
          </View>

          {isImageSelected ? (
            <View className="flex-row flex-wrap mb-2">
              <ToolbarButton
                icon="expand-outline"
                label="Fit width"
                onPress={handleFitWidth}
              />
              <ToolbarButton
                icon="scan-outline"
                label="Fit canvas"
                onPress={handleFitCanvas}
              />
              {isBackgroundActive ? (
                <ToolbarButton
                  icon="close-circle-outline"
                  label="Remove bg mode"
                  onPress={handleClearBackgroundMode}
                />
              ) : (
                <ToolbarButton
                  icon="image-outline"
                  label="Set as background"
                  onPress={handleSetAsBackground}
                />
              )}
            </View>
          ) : (
            <View className="flex-row flex-wrap mb-2">
              <ToolbarButton
                icon="expand-outline"
                label="Fit width"
                onPress={handleFitWidth}
              />
              <ToolbarButton
                icon="scan-outline"
                label="Fit canvas"
                onPress={handleFitCanvas}
              />
            </View>
          )}

          <View className="flex-row flex-wrap">
            <ToolbarButton
              icon="create-outline"
              label="Edit"
              onPress={handleEditSelected}
            />
            <ToolbarButton
              icon="arrow-up-outline"
              label="Up"
              onPress={handleBringForward}
            />
            <ToolbarButton
              icon="arrow-down-outline"
              label="Down"
              onPress={handleSendBackward}
            />
            <ToolbarButton
              icon={
                selectedComponent.visible ? 'eye-off-outline' : 'eye-outline'
              }
              label={selectedComponent.visible ? 'Hide' : 'Show'}
              onPress={handleToggleVisibleSelected}
            />
            <ToolbarButton
              icon="trash-outline"
              label="Delete"
              danger
              onPress={handleDeleteSelected}
            />
            <ToolbarButton
              icon="close-circle-outline"
              label="Deselect"
              onPress={handleDeselect}
            />
          </View>
        </View>
      ) : null}

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

interface ToolbarButtonProps {
  icon: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
}

function ToolbarButton({
  icon,
  label,
  onPress,
  danger,
}: ToolbarButtonProps): React.ReactElement {
  const color = danger ? '#EF4444' : '#2563EB';
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-3 py-2 rounded-lg bg-background dark:bg-dark-background mr-2 mb-2 active:opacity-70"
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={14} color={color} />
      <Text className="text-xs font-semibold ml-1" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}