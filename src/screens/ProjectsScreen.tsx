import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import LoadingState from '@/components/LoadingState';
import ScreenHeader from '@/components/ScreenHeader';
import Button from '@/components/Button';
import { useProjects } from '@/hooks/useProjects';
import { useProjectStore } from '@/store/useProjectStore';
import { createProject } from '@/utils/factory';
import { saveProjectFile } from '@/hooks/useProjects';
import { formatRelativeTime } from '@/utils/format';
import type { ProjectMeta } from '@/types/project';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProjectsScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const { projects, loading, error, refresh, remove } = useProjects();
  const setProject = useProjectStore(s => s.setProject);
  const [creating, setCreating] = useState<boolean>(false);

  const openProject = useCallback(
    (id: string): void => {
      navigation.navigate('Editor', { projectId: id });
    },
    [navigation],
  );

  const handleCreate = useCallback(async (): Promise<void> => {
    if (creating) return;
    setCreating(true);
    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      const project = createProject(`My App ${timestamp}`);
      await saveProjectFile(project);
      setProject(project);
      await refresh();
      Toast.show({
        type: 'success',
        text1: 'Project created',
        text2: project.name,
      });
      navigation.navigate('Editor', { projectId: project.id });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not create the project.';
      Toast.show({ type: 'error', text1: 'Creation failed', text2: message });
    } finally {
      setCreating(false);
    }
  }, [creating, navigation, refresh, setProject]);

  const confirmDelete = useCallback(
    (meta: ProjectMeta): void => {
      Alert.alert(
        'Delete project?',
        `"${meta.name}" and all of its pages will be permanently removed.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              remove(meta.id)
                .then(() => {
                  Toast.show({
                    type: 'success',
                    text1: 'Project deleted',
                  });
                })
                .catch((err: unknown) => {
                  const message =
                    err instanceof Error
                      ? err.message
                      : 'Delete failed.';
                  Toast.show({ type: 'error', text1: 'Error', text2: message });
                });
            },
          },
        ],
      );
    },
    [remove],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      tabBarLabel: 'Projects',
    });
  }, [navigation]);

  const renderItem = useCallback(
    ({ item }: { item: ProjectMeta }) => (
      <Pressable
        onPress={() => openProject(item.id)}
        onLongPress={() => confirmDelete(item)}
        delayLongPress={400}
        className="bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-2xl p-4 mb-3 active:opacity-80"
        accessibilityRole="button"
      >
        <View className="flex-row items-center mb-2">
          <View className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 items-center justify-center mr-3">
            <Ionicons name="folder-open-outline" size={20} color="#2563EB" />
          </View>
          <View className="flex-1">
            <Text
              className="text-base font-semibold text-text dark:text-dark-text"
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
              {item.pageCount} page{item.pageCount === 1 ? '' : 's'} ·{' '}
              {item.componentCount} component
              {item.componentCount === 1 ? '' : 's'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-xs text-muted dark:text-dark-muted">
            Edited {formatRelativeTime(item.updatedAt)}
          </Text>
          <Pressable
            onPress={() => confirmDelete(item)}
            hitSlop={8}
            className="p-1"
            accessibilityRole="button"
            accessibilityLabel="Delete project"
          >
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
          </Pressable>
        </View>
      </Pressable>
    ),
    [confirmDelete, openProject],
  );

  if (loading && projects.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader title="Projects" />
        <LoadingState message="Loading your projects…" />
      </SafeAreaView>
    );
  }

  if (error && projects.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader title="Projects" />
        <ErrorState
          title="Could not load projects"
          message={error}
          onRetry={() => {
            void refresh();
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
        title="Projects"
        subtitle={`${projects.length} project${projects.length === 1 ? '' : 's'}`}
        rightActions={[
          {
            icon: 'add-circle-outline',
            onPress: () => {
              void handleCreate();
            },
            accessibilityLabel: 'New project',
            disabled: creating,
          },
        ]}
      />

      {projects.length === 0 ? (
        <EmptyState
          icon="folder-open-outline"
          title="No projects yet"
          description="Create your first app by tapping the button below. Add pages, drop in components, and build an APK."
          actionLabel={creating ? 'Creating…' : 'Create your first app'}
          onAction={() => {
            void handleCreate();
          }}
        />
      ) : (
        <FlatList
          data={projects}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => {
                void refresh();
              }}
              tintColor="#2563EB"
            />
          }
          ListFooterComponent={
            <View className="mt-4">
              <Button
                label={creating ? 'Creating…' : 'New project'}
                icon="add-outline"
                onPress={() => {
                  void handleCreate();
                }}
                loading={creating}
                fullWidth
                variant="secondary"
              />
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}