import React, { useCallback, useMemo, useState } from 'react';
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
import Button from '@/components/Button';
import Input from '@/components/Input';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import Card from '@/components/Card';
import { useProject } from '@/hooks/useProject';
import { deleteProjectFile } from '@/hooks/useProjects';
import { useProjectStore } from '@/store/useProjectStore';
import { formatDate } from '@/utils/format';
import { sanitizePackageName, sanitizeRepoName } from '@/utils/format';
import type { Page } from '@/types/project';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'ProjectSettings'>;

export default function ProjectSettingsScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { projectId } = route.params;
  const { project, loading, error, reload, save } = useProject(projectId);
  const setProject = useProjectStore(s => s.setProject);

  const [name, setName] = useState<string>('');
  const [packageName, setPackageName] = useState<string>('');
  const [version, setVersion] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  React.useEffect(() => {
    if (project) {
      setName(project.name);
      setPackageName(project.packageName);
      setVersion(project.version);
    }
  }, [project]);

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
      setProject(next);
      Toast.show({ type: 'success', text1: 'Saved' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed.';
      Toast.show({ type: 'error', text1: 'Error', text2: msg });
    } finally {
      setSaving(false);
    }
  }, [name, packageName, project, save, setProject, version]);

  const handleSetStartPage = useCallback(
    async (pageId: string): Promise<void> => {
      if (!project) return;
      const next = { ...project, startPageId: pageId, updatedAt: Date.now() };
      await save(next);
      setProject(next);
      Toast.show({ type: 'success', text1: 'Start page updated' });
    },
    [project, save, setProject],
  );

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
            setProject(next);
            Toast.show({ type: 'success', text1: 'Page deleted' });
          },
        },
      ]);
    },
    [project, save, setProject],
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
              setProject(null);
              Toast.show({ type: 'success', text1: 'Project deleted' });
              navigation.popToTop();
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Delete failed.';
              Toast.show({ type: 'error', text1: 'Error', text2: msg });
            }
          },
        },
      ],
    );
  }, [navigation, project, setProject]);

  const pages = useMemo<Page[]>(() => project?.pages ?? [], [project]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader title="Project Settings" onBack={() => navigation.goBack()} />
        <LoadingState message="Loading project…" />
      </SafeAreaView>
    );
  }

  if (error || !project) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader title="Project Settings" onBack={() => navigation.goBack()} />
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
                Repo name suggestion:{' '}
                {sanitizeRepoName(project.name)}
              </Text>
            </Card>

            <Text className="text-sm font-semibold text-text dark:text-dark-text mb-2 px-1">
              Pages
            </Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const isStart = project.startPageId === item.id;
          return (
            <View className="bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-xl p-3 mb-2 flex-row items-center">
              <View className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20 items-center justify-center mr-3">
                <Text className="text-xs font-bold text-primary">
                  {index + 1}
                </Text>
              </View>
              <View className="flex-1">
                <Text
                  className="text-sm font-semibold text-text dark:text-dark-text"
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
                  {item.components.length} component
                  {item.components.length === 1 ? '' : 's'}
                  {isStart ? ' · Start page' : ''}
                </Text>
              </View>
              {!isStart ? (
                <Pressable
                  onPress={() => {
                    void handleSetStartPage(item.id);
                  }}
                  className="px-2 py-1 rounded-md bg-primary/10 dark:bg-primary/20 mr-2"
                  accessibilityRole="button"
                  accessibilityLabel="Set as start page"
                >
                  <Text className="text-[10px] font-bold text-primary">
                    SET START
                  </Text>
                </Pressable>
              ) : (
                <View className="px-2 py-1 rounded-md bg-success/10 dark:bg-success/20 mr-2">
                  <Text className="text-[10px] font-bold text-success">
                    START
                  </Text>
                </View>
              )}
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
    </SafeAreaView>
  );
}