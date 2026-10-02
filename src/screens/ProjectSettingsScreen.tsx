import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import ScreenHeader from '@/components/ScreenHeader';
import Button from '@/components/Button';
import Input from '@/components/Input';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import Card from '@/components/Card';
import { useProject } from '@/hooks/useProject';
import { deleteProjectFile } from '@/hooks/useProjects';
import { useProjectStore } from '@/store/useProjectStore';
import { formatDate, sanitizePackageName, sanitizeRepoName } from '@/utils/format';
import type { Page, PageType } from '@/types/project';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'ProjectSettings'>;

export default function ProjectSettingsScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { projectId } = route.params;
  const { project, loading, error, reload, save } = useProject(projectId);
  const storeSetProject = useProjectStore(s => s.setProject);

  const [name, setName] = useState<string>('');
  const [packageName, setPackageName] = useState<string>('');
  const [version, setVersion] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [renamingPage, setRenamingPage] = useState<Page | null>(null);
  const [renameDraft, setRenameDraft] = useState<string>('');

  React.useEffect(() => {
    if (project) {
      setName(project.name);
      setPackageName(project.packageName);
      setVersion(project.version);
      storeSetProject(project);
    }
  }, [project, storeSetProject]);

  const handleSaveMeta = useCallback(async (): Promise<void> => {
    if (!project) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      Toast.show({ type: 'error', text1: 'Project name cannot be empty' });
      return;
    }
    setSaving(true);
    try {
      const next = {
        ...project,
        name: trimmedName,
        packageName: sanitizePackageName(packageName || project.packageName),
        version: version.trim() || '1.0.0',
        updatedAt: Date.now(),
      };
      await save(next);
      storeSetProject(next);
      Toast.show({ type: 'success', text1: 'Saved' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed.';
      Toast.show({ type: 'error', text1: 'Error', text2: msg });
    } finally {
      setSaving(false);
    }
  }, [name, packageName, project, save, storeSetProject, version]);

  const handleSetStartPage = useCallback(
    async (pageId: string): Promise<void> => {
      if (!project) return;
      const next = { ...project, startPageId: pageId, updatedAt: Date.now() };
      await save(next);
      storeSetProject(next);
      Toast.show({ type: 'success', text1: 'Start page updated' });
    },
    [project, save, storeSetProject],
  );

  const handleSetPageType = useCallback(
    async (pageId: string, type: PageType): Promise<void> => {
      if (!project) return;
      const pages = project.pages.map(p =>
        p.id === pageId ? { ...p, type } : p,
      );
      const next = { ...project, pages, updatedAt: Date.now() };
      await save(next);
      storeSetProject(next);
      Toast.show({
        type: 'success',
        text1:
          type === 'onboarding' ? 'Set as onboarding page' : 'Set as main page',
      });
    },
    [project, save, storeSetProject],
  );

  const handleOpenRename = useCallback((page: Page): void => {
    setRenamingPage(page);
    setRenameDraft(page.title);
  }, []);

  const handleCancelRename = useCallback((): void => {
    setRenamingPage(null);
    setRenameDraft('');
  }, []);

  const handleConfirmRename = useCallback(async (): Promise<void> => {
    if (!project || !renamingPage) return;
    const trimmed = renameDraft.trim();
    if (!trimmed) {
      Alert.alert('Page name cannot be empty');
      return;
    }
    if (trimmed === renamingPage.title) {
      handleCancelRename();
      return;
    }
    const pages = project.pages.map(p =>
      p.id === renamingPage.id ? { ...p, title: trimmed } : p,
    );
    const next = { ...project, pages, updatedAt: Date.now() };
    await save(next);
    storeSetProject(next);
    Toast.show({ type: 'success', text1: 'Page renamed' });
    handleCancelRename();
  }, [
    handleCancelRename,
    project,
    renameDraft,
    renamingPage,
    save,
    storeSetProject,
  ]);

  const handleDeletePage = useCallback(
    (page: Page): void => {
      if (!project) return;
      if (project.pages.length <= 1) {
        Toast.show({
          type: 'error',
          text1: 'Cannot delete the only page',
        });
        return;
      }
      Alert.alert('Delete page?', `"${page.title}" will be removed.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const pages = project.pages.filter(p => p.id !== page.id);
            const next = {
              ...project,
              pages,
              startPageId:
                project.startPageId === page.id
                  ? pages[0].id
                  : project.startPageId,
              updatedAt: Date.now(),
            };
            await save(next);
            storeSetProject(next);
            Toast.show({ type: 'success', text1: 'Page deleted' });
          },
        },
      ]);
    },
    [project, save, storeSetProject],
  );

  const handleDeleteProject = useCallback((): void => {
    if (!project) return;
    Alert.alert(
      'Delete project?',
      `"${project.name}" and all of its data will be permanently removed. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProjectFile(project.id);
              storeSetProject(null);
              Toast.show({ type: 'success', text1: 'Project deleted' });
              navigation.popToTop();
            } catch (err) {
              const msg =
                err instanceof Error ? err.message : 'Delete failed.';
              Toast.show({ type: 'error', text1: 'Error', text2: msg });
            }
          },
        },
      ],
    );
  }, [navigation, project, storeSetProject]);

  const pages = useMemo<Page[]>(() => project?.pages ?? [], [project]);

  const onboardingCount = useMemo(
    () => pages.filter(p => p.type === 'onboarding').length,
    [pages],
  );

  const mainCount = useMemo(
    () => pages.filter(p => p.type === 'main').length,
    [pages],
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader
          title="Project Settings"
          onBack={() => navigation.goBack()}
        />
        <LoadingState message="Loading project…" />
      </SafeAreaView>
    );
  }

  if (error || !project) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader
          title="Project Settings"
          onBack={() => navigation.goBack()}
        />
        <ErrorState
          message={error ?? 'Project not found.'}
          onRetry={() => {
            void reload();
          }}
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
        title="Project Settings"
        subtitle={project.name}
        onBack={() => navigation.goBack()}
      />

      <FlatList
        data={pages}
        keyExtractor={p => p.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListHeaderComponent={
          <View>
            <Card className="mb-4">
              <Text className="text-base font-semibold text-text dark:text-dark-text mb-3">
                General
              </Text>
              <Input
                label="Project name"
                value={name}
                onChangeText={setName}
                placeholder="My App"
                containerClassName="mb-3"
              />
              <Input
                label="Package name"
                value={packageName}
                onChangeText={setPackageName}
                placeholder="com.example.myapp"
                autoCapitalize="none"
                hint="Used as the Android application ID when building."
                containerClassName="mb-3"
              />
              <Input
                label="Version"
                value={version}
                onChangeText={setVersion}
                placeholder="1.0.0"
                autoCapitalize="none"
                containerClassName="mb-1"
              />
              <View className="flex-row justify-end mt-3">
                <Button
                  label={saving ? 'Saving…' : 'Save'}
                  icon="save-outline"
                  onPress={() => {
                    void handleSaveMeta();
                  }}
                  loading={saving}
                />
              </View>
            </Card>

            <Card className="mb-4">
              <Text className="text-base font-semibold text-text dark:text-dark-text mb-1">
                Info
              </Text>
              <Text className="text-xs text-muted dark:text-dark-muted">
                Created {formatDate(project.createdAt)}
              </Text>
              <Text className="text-xs text-muted dark:text-dark-muted mt-1">
                Last edited {formatDate(project.updatedAt)}
              </Text>
              <Text className="text-xs text-muted dark:text-dark-muted mt-1">
                Repo name suggestion: {sanitizeRepoName(project.name)}
              </Text>
            </Card>

            <Card className="mb-4">
              <Text className="text-base font-semibold text-text dark:text-dark-text mb-1">
                Onboarding
              </Text>
              <Text className="text-xs text-muted dark:text-dark-muted mb-2">
                {onboardingCount} onboarding · {mainCount} main
              </Text>
              <Text className="text-xs text-muted dark:text-dark-muted">
                Onboarding pages show only the first time the app opens. After
                the user completes them (via a "Next onboarding page" action or
                by skipping), the app jumps to the start page.
              </Text>
            </Card>

            <Text className="text-sm font-semibold text-text dark:text-dark-text mb-2 px-1">
              Pages
            </Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const isStart = project.startPageId === item.id;
          const isOnboarding = item.type === 'onboarding';
          return (
            <View className="bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-xl p-3 mb-2">
              <View className="flex-row items-center mb-2">
                <View className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20 items-center justify-center mr-3">
                  <Text className="text-xs font-bold text-primary">
                    {index + 1}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleOpenRename(item)}
                  className="flex-1"
                  hitSlop={6}
                >
                  <View className="flex-row items-center">
                    <Text
                      className="text-sm font-semibold text-text dark:text-dark-text"
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Ionicons
                      name="create-outline"
                      size={14}
                      color="#94A3B8"
                      style={{ marginLeft: 6 }}
                    />
                  </View>
                  <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
                    {item.components.length} component
                    {item.components.length === 1 ? '' : 's'}
                    {isStart ? ' · Start page' : ''}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleDeletePage(item)}
                  hitSlop={8}
                  className="p-1"
                  accessibilityRole="button"
                  accessibilityLabel="Delete page"
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </Pressable>
              </View>

              <View className="flex-row items-center mb-2">
                <Pressable
                  onPress={() =>
                    handleSetPageType(
                      item.id,
                      isOnboarding ? 'main' : 'onboarding',
                    )
                  }
                  className={[
                    'flex-row items-center px-3 py-2 rounded-lg mr-2',
                    isOnboarding
                      ? 'bg-amber-100 dark:bg-amber-900/40'
                      : 'bg-slate-100 dark:bg-slate-800',
                  ].join(' ')}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={isOnboarding ? 'play-skip-forward' : 'home'}
                    size={12}
                    color={isOnboarding ? '#D97706' : '#64748B'}
                  />
                  <Text
                    className={[
                      'text-[10px] font-bold ml-1 uppercase',
                      isOnboarding
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-slate-600 dark:text-slate-400',
                    ].join(' ')}
                  >
                    {isOnboarding ? 'Onboarding' : 'Main'}
                  </Text>
                </Pressable>

                {!isStart ? (
                  <Pressable
                    onPress={() => {
                      void handleSetStartPage(item.id);
                    }}
                    className="px-2 py-2 rounded-lg bg-primary/10 dark:bg-primary/20"
                    accessibilityRole="button"
                    accessibilityLabel="Set as start page"
                  >
                    <Text className="text-[10px] font-bold text-primary">
                      SET AS START
                    </Text>
                  </Pressable>
                ) : (
                  <View className="px-2 py-2 rounded-lg bg-success/10 dark:bg-success/20">
                    <Text className="text-[10px] font-bold text-success">
                      START PAGE
                    </Text>
                  </View>
                )}
              </View>

              <Text className="text-[10px] text-muted dark:text-dark-muted">
                Tap title to rename · Tap badge to switch Onboarding / Main
              </Text>
            </View>
          );
        }}
        ListFooterComponent={
          <View className="mt-6">
            <Button
              label="Delete project"
              icon="trash-outline"
              variant="danger"
              fullWidth
              onPress={handleDeleteProject}
            />
          </View>
        }
      />

      <Modal
        visible={renamingPage !== null}
        animationType="slide"
        transparent
        onRequestClose={handleCancelRename}
      >
        <Pressable
          onPress={handleCancelRename}
          className="flex-1 bg-black/40 justify-center px-6"
        >
          <Pressable onPress={() => undefined}>
            <View className="bg-card dark:bg-dark-card rounded-2xl p-4">
              <Text className="text-base font-semibold text-text dark:text-dark-text mb-3">
                Rename page
              </Text>
              <Input
                value={renameDraft}
                onChangeText={setRenameDraft}
                placeholder="Page title"
                autoFocus
                containerClassName="mb-3"
              />
              <View className="flex-row justify-end">
                <Button
                  label="Cancel"
                  variant="ghost"
                  onPress={handleCancelRename}
                />
                <View className="w-2" />
                <Button
                  label="Rename"
                  icon="checkmark-outline"
                  onPress={() => {
                    void handleConfirmRename();
                  }}
                />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}