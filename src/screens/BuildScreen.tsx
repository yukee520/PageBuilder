import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import ScreenHeader from '@/components/ScreenHeader';
import Card from '@/components/Card';
import Button from '@/components/Button';
import Input from '@/components/Input';
import { useProject } from '@/hooks/useProject';
import { useBuild } from '@/hooks/useBuild';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useProjectStore } from '@/store/useProjectStore';
import { sanitizeRepoName } from '@/utils/format';
import { BUILD_PHASE_LABELS } from '@/types/build';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'Build'>;

export default function BuildScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const projectId = route.params?.projectId ?? '';

  const { project, loading: projectLoading, error: projectError } = useProject(
    projectId || null,
  );
  const setProject = useProjectStore(s => s.setProject);

  useEffect(() => {
    if (project) {
      setProject(project);
    }
  }, [project, setProject]);

  const githubToken = useSettingsStore(s => s.githubToken);
  const defaultRepoName = useSettingsStore(s => s.defaultRepoName);
  const makeRepoPrivate = useSettingsStore(s => s.makeRepoPrivate);
  const templateOwner = useSettingsStore(s => s.templateOwner);
  const templateRepo = useSettingsStore(s => s.templateRepo);
  const setDefaultRepoName = useSettingsStore(s => s.setDefaultRepoName);
  const setMakeRepoPrivate = useSettingsStore(s => s.setMakeRepoPrivate);

  const [repoDraft, setRepoDraft] = useState<string>('');

  useEffect(() => {
    const suggested =
      defaultRepoName || (project ? sanitizeRepoName(project.name) : '');
    setRepoDraft(suggested);
  }, [defaultRepoName, project]);

  const { state, start, reset, cancel } = useBuild();

  const isBuilding = useMemo(
    () =>
      state.phase !== 'idle' &&
      state.phase !== 'completed' &&
      state.phase !== 'failed',
    [state.phase],
  );

  const handleStart = useCallback(async (): Promise<void> => {
    if (!project) {
      Toast.show({ type: 'error', text1: 'Project not loaded' });
      return;
    }
    if (!githubToken) {
      Alert.alert(
        'GitHub not connected',
        'Add your Personal Access Token in Settings before building.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => navigation.navigate('Tabs'),
          },
        ],
      );
      return;
    }
    const cleaned = sanitizeRepoName(repoDraft);
    if (!cleaned) {
      Toast.show({
        type: 'error',
        text1: 'Repository name required',
      });
      return;
    }
    setDefaultRepoName(cleaned);
    setRepoDraft(cleaned);

    await start({
      config: {
        token: githubToken,
        repoName: cleaned,
        isPrivate: makeRepoPrivate,
        templateOwner,
        templateRepo,
      },
      files: {
        projectJson: JSON.stringify(project, null, 2),
      },
    });
  }, [
    githubToken,
    makeRepoPrivate,
    navigation,
    project,
    repoDraft,
    setDefaultRepoName,
    start,
    templateOwner,
    templateRepo,
  ]);

  const handleCancel = useCallback((): void => {
    Alert.alert('Cancel build?', 'You can always start it again.', [
      { text: 'Keep building', style: 'cancel' },
      {
        text: 'Cancel build',
        style: 'destructive',
        onPress: () => cancel(),
      },
    ]);
  }, [cancel]);

  const handleOpenRun = useCallback((): void => {
    const url = state.run?.htmlUrl ?? state.result?.runUrl ?? null;
    if (!url) return;
    Linking.openURL(url).catch(() => {
      Alert.alert('Could not open GitHub.');
    });
  }, [state.result, state.run]);

  const handleOpenApk = useCallback((): void => {
    const url = state.result?.apkUrl ?? null;
    if (!url) return;
    Linking.openURL(url).catch(() => {
      Alert.alert('Could not open download link.');
    });
  }, [state.result]);

  const handleOpenRepo = useCallback((): void => {
    const url = state.result?.repoUrl ?? null;
    if (!url) return;
    Linking.openURL(url).catch(() => {
      Alert.alert('Could not open repository.');
    });
  }, [state.result]);

  if (projectId && projectLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader title="Build APK" onBack={() => navigation.goBack()} />
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm text-muted dark:text-dark-muted">
            Loading project…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (projectId && (projectError || !project)) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader title="Build APK" onBack={() => navigation.goBack()} />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-base font-semibold text-text dark:text-dark-text text-center">
            Project not available
          </Text>
          <Text className="text-sm text-muted dark:text-dark-muted mt-2 text-center">
            {projectError ?? 'The project could not be loaded.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1 bg-background dark:bg-dark-background"
      edges={['top', 'left', 'right']}
    >
      <ScreenHeader
        title="Build APK"
        subtitle={project ? project.name : 'No project selected'}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Card className="mb-4">
          <Text className="text-base font-semibold text-text dark:text-dark-text mb-3">
            Build configuration
          </Text>

          <Input
            label="Repository name"
            value={repoDraft}
            onChangeText={setRepoDraft}
            placeholder="my-app-001"
            autoCapitalize="none"
            editable={!isBuilding}
            hint="A new GitHub repository will be created from the template if it does not exist."
            containerClassName="mb-3"
          />

          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm text-text dark:text-dark-text">
              Private repository
            </Text>
            <Switch
              value={makeRepoPrivate}
              onValueChange={setMakeRepoPrivate}
              disabled={isBuilding}
            />
          </View>

          <View className="bg-background dark:bg-dark-background rounded-xl p-3 mb-3">
            <Text className="text-xs text-muted dark:text-dark-muted">
              Source template
            </Text>
            <Text className="text-sm font-semibold text-text dark:text-dark-text mt-0.5">
              {templateOwner}/{templateRepo}
            </Text>
            <Text className="text-xs text-muted dark:text-dark-muted mt-2">
              GitHub account
            </Text>
            <Text className="text-sm font-semibold text-text dark:text-dark-text mt-0.5">
              {githubToken ? 'Connected' : 'Not connected'}
            </Text>
          </View>

          {!isBuilding ? (
            <Button
              label={state.phase === 'failed' ? 'Retry build' : 'Start build'}
              icon="hammer-outline"
              onPress={() => {
                if (state.phase === 'failed') reset();
                void handleStart();
              }}
              fullWidth
            />
          ) : (
            <Button
              label="Cancel build"
              icon="close-circle-outline"
              variant="danger"
              onPress={handleCancel}
              fullWidth
            />
          )}
        </Card>

        {state.phase !== 'idle' ? (
          <Card className="mb-4">
            <Text className="text-base font-semibold text-text dark:text-dark-text mb-3">
              Status
            </Text>

            <View className="flex-row items-center mb-2">
              <View
                className={[
                  'w-2 h-2 rounded-full mr-2',
                  state.phase === 'completed'
                    ? 'bg-success'
                    : state.phase === 'failed'
                    ? 'bg-danger'
                    : 'bg-primary',
                ].join(' ')}
              />
              <Text className="text-sm font-semibold text-text dark:text-dark-text">
                {BUILD_PHASE_LABELS[state.phase]}
              </Text>
            </View>

            <Text className="text-xs text-muted dark:text-dark-muted mb-3">
              {state.message}
            </Text>

            <View className="w-full h-2 bg-border dark:bg-dark-border rounded-full overflow-hidden mb-3">
              <View
                className={[
                  'h-full',
                  state.phase === 'failed' ? 'bg-danger' : 'bg-primary',
                ].join(' ')}
                style={{ width: `${Math.max(2, state.progress)}%` }}
              />
            </View>

            {state.error ? (
              <View className="bg-danger/10 dark:bg-danger/20 rounded-xl p-3 mb-3">
                <Text className="text-xs text-danger dark:text-danger">
                  {state.error}
                </Text>
              </View>
            ) : null}

            {state.run ? (
              <Pressable
                onPress={handleOpenRun}
                className="flex-row items-center py-2"
                accessibilityRole="link"
              >
                <Ionicons name="open-outline" size={16} color="#2563EB" />
                <Text className="text-xs font-semibold text-primary ml-2">
                  View build run on GitHub
                </Text>
              </Pressable>
            ) : null}

            {state.result?.repoUrl ? (
              <Pressable
                onPress={handleOpenRepo}
                className="flex-row items-center py-2"
                accessibilityRole="link"
              >
                <Ionicons name="git-branch-outline" size={16} color="#2563EB" />
                <Text className="text-xs font-semibold text-primary ml-2">
                  Open repository
                </Text>
              </Pressable>
            ) : null}
          </Card>
        ) : null}

        {state.phase === 'completed' && state.result ? (
          <Card className="mb-4">
            <View className="flex-row items-center mb-3">
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              <Text className="text-base font-semibold text-text dark:text-dark-text ml-2">
                Build finished
              </Text>
            </View>

            {state.result.apkUrl ? (
              <>
                <Text className="text-xs text-muted dark:text-dark-muted mb-3">
                  Your APK is ready. Download it, transfer to your Android device,
                  and install.
                </Text>
                <Button
                  label="Download APK"
                  icon="download-outline"
                  onPress={handleOpenApk}
                  fullWidth
                />
              </>
            ) : (
              <Text className="text-xs text-muted dark:text-dark-muted">
                The build finished, but the APK was not found in the release.
                Open the build run on GitHub to download the artifact.
              </Text>
            )}
          </Card>
        ) : null}

        <Card>
          <Text className="text-sm font-semibold text-text dark:text-dark-text mb-2">
            How it works
          </Text>
          <Text className="text-xs text-muted dark:text-dark-muted leading-5">
            PageBuilder creates a new GitHub repository from{' '}
            {templateOwner}/{templateRepo}. It pushes your project data, the
            runtime code, and an entry point into that repository. GitHub
            Actions then compiles the debug APK and publishes it as a release.
            The whole process usually takes 5–10 minutes.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}