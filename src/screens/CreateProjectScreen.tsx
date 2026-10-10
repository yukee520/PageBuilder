import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@react-native-vector-icons/ionicons';
import Toast from 'react-native-toast-message';
import ScreenHeader from '@/components/ScreenHeader';
import Card from '@/components/Card';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { useProjectStore } from '@/store/useProjectStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { createProjectRecord, saveProjectFile } from '@/hooks/useProjects';
import {
  GithubApiError,
  createRepoFromTemplate,
  getRepo,
  validateToken,
} from '@/api/github';
import {
  derivePackageName,
  deriveRepoName,
  sanitizePackageName,
  sanitizeRepoName,
} from '@/utils/format';
import type { Project } from '@/types/project';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type RepoPhase =
  | { kind: 'idle' }
  | { kind: 'creating' }
  | { kind: 'done'; owner: string; repoUrl: string }
  | { kind: 'failed'; message: string };

export default function CreateProjectScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();

  const setProject = useProjectStore(s => s.setProject);

  const githubToken = useSettingsStore(s => s.githubToken);
  const templateOwner = useSettingsStore(s => s.templateOwner);
  const templateRepo = useSettingsStore(s => s.templateRepo);

  const [name, setName] = useState<string>('');
  const [repoNameDraft, setRepoNameDraft] = useState<string>('');
  const [repoNameTouched, setRepoNameTouched] = useState<boolean>(false);
  const [repoPrivate, setRepoPrivate] = useState<boolean>(true);

  const [creating, setCreating] = useState<boolean>(false);
  const [repoPhase, setRepoPhase] = useState<RepoPhase>({ kind: 'idle' });

  const derivedPackageName = useMemo(
    () => derivePackageName(name || 'My App'),
    [name],
  );

  const derivedRepoName = useMemo(
    () => deriveRepoName(name || 'My App'),
    [name],
  );

  const effectiveRepoName = repoNameTouched
    ? repoNameDraft
    : derivedRepoName;

  useEffect(() => {
    if (!repoNameTouched) {
      setRepoNameDraft(derivedRepoName);
    }
  }, [derivedRepoName, repoNameTouched]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', e => {
      if (!creating) return;
      e.preventDefault();
    });
    return unsubscribe;
  }, [creating, navigation]);

  const handleRepoNameChange = useCallback((value: string): void => {
    setRepoNameTouched(true);
    setRepoNameDraft(value);
  }, []);

  const handleResetRepoName = useCallback((): void => {
    setRepoNameTouched(false);
    setRepoNameDraft(derivedRepoName);
  }, [derivedRepoName]);

  const handleCreate = useCallback(async (): Promise<void> => {
    if (creating) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      Toast.show({
        type: 'error',
        text1: 'Please enter a project name',
      });
      return;
    }

    const sanitizedRepo = sanitizeRepoName(effectiveRepoName);
    if (!sanitizedRepo) {
      Toast.show({
        type: 'error',
        text1: 'Invalid repo name',
        text2: 'Use letters, numbers, dashes, and underscores.',
      });
      return;
    }

    setCreating(true);
    setRepoPhase({ kind: 'idle' });

    // ── Step 1: create the local project file ─────────────────────────
    let project: Project;
    try {
      project = await createProjectRecord(trimmedName, {
        packageName: sanitizePackageName(derivedPackageName),
        repoName: sanitizedRepo,
        repoPrivate,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not create the project.';
      Toast.show({ type: 'error', text1: 'Creation failed', text2: message });
      setCreating(false);
      return;
    }

    let finalProject = project;

    // ── Step 2: link or create the repo ───────────────────────────────
    const liveToken = useSettingsStore.getState().githubToken;
    if (!liveToken || !liveToken.trim()) {
      setRepoPhase({
        kind: 'failed',
        message: 'No GitHub token. Add one in Settings to create the repo.',
      });
      Toast.show({
        type: 'success',
        text1: 'Project created',
        text2: 'Add a GitHub token in Settings to create the repo.',
      });
    } else {
      setRepoPhase({ kind: 'creating' });
      try {
        const user = await validateToken(liveToken);
        const owner = user.login;

        // ── Strict check: reject if the repo name is already taken ────
        let repoExistsAlready = false;
        try {
          await getRepo(liveToken, owner, sanitizedRepo);
          repoExistsAlready = true;
        } catch (err) {
          if (!(err instanceof GithubApiError && err.status === 404)) {
            throw err;
          }
          // 404 → repo does not exist, proceed to creation.
        }

        if (repoExistsAlready) {
          const message = `A repo named "${owner}/${sanitizedRepo}" already exists on GitHub. Pick a different name, or open Project Settings to link to it instead.`;
          setRepoPhase({ kind: 'failed', message });
          Toast.show({
            type: 'success',
            text1: 'Project created',
            text2: 'Repo name is taken. Retry from Project Settings.',
          });
          setProject(project);
          setCreating(false);
          setTimeout(() => {
            navigation.replace('Editor', { projectId: project.id });
          }, 400);
          return;
        }

        // ── Create from template ──────────────────────────────────────
        const created = await createRepoFromTemplate(
          liveToken,
          templateOwner,
          templateRepo,
          owner,
          sanitizedRepo,
          repoPrivate,
        );

        finalProject = {
          ...project,
          repoOwner: owner,
          repoUrl: created.html_url,
          repoPrivate: created.private,
        };
        await saveProjectFile(finalProject);

        setRepoPhase({
          kind: 'done',
          owner,
          repoUrl: created.html_url,
        });

        Toast.show({
          type: 'success',
          text1: 'Project created',
          text2: `Linked to ${owner}/${sanitizedRepo}`,
        });
      } catch (err) {
        const message =
          err instanceof GithubApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : 'Could not create the repo.';
        setRepoPhase({ kind: 'failed', message });
        Toast.show({
          type: 'success',
          text1: 'Project created',
          text2: 'Repo creation failed. Retry from Project Settings.',
        });
      }
    }

    setProject(finalProject);
    setCreating(false);

    setTimeout(() => {
      navigation.replace('Editor', { projectId: finalProject.id });
    }, 400);
  }, [
    creating,
    derivedPackageName,
    effectiveRepoName,
    navigation,
    name,
    repoPrivate,
    setProject,
    templateOwner,
    templateRepo,
  ]);

  const handleCancel = useCallback((): void => {
    if (creating) {
      Alert.alert(
        'Cancel creation?',
        'Your project is being created. You can discard it and go back.',
        [
          { text: 'Keep going', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.goBack(),
          },
        ],
      );
      return;
    }
    navigation.goBack();
  }, [creating, navigation]);

  const hasToken = Boolean(githubToken && githubToken.trim());

  return (
    <SafeAreaView
      className="flex-1 bg-background dark:bg-dark-background"
      edges={['top', 'left', 'right']}
    >
      <ScreenHeader
        title="New project"
        subtitle="Name it, then we'll set everything up"
        onBack={handleCancel}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <Card className="mb-4">
            <Text className="text-base font-semibold text-text dark:text-dark-text mb-1">
              Project name
            </Text>
            <Text className="text-xs text-muted dark:text-dark-muted mb-3">
              This becomes your app name and the suggested repo name.
            </Text>
            <Input
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="My Cool App"
              autoFocus
              containerClassName="mb-3"
              maxLength={60}
            />

            <View className="bg-background dark:bg-dark-background rounded-xl p-3">
              <Text className="text-[10px] font-bold text-muted dark:text-dark-muted uppercase tracking-wider mb-2">
                Preview
              </Text>

              <View className="flex-row items-center mb-1.5">
                <Ionicons name="cube-outline" size={14} color="#94A3B8" />
                <Text className="text-xs text-muted dark:text-dark-muted ml-2">
                  Package
                </Text>
              </View>
              <Text
                className="text-xs font-mono text-text dark:text-dark-text mb-3"
                numberOfLines={1}
              >
                {derivedPackageName}
              </Text>

              <View className="flex-row items-center mb-1.5">
                <Ionicons name="logo-github" size={14} color="#94A3B8" />
                <Text className="text-xs text-muted dark:text-dark-muted ml-2">
                  Repository
                </Text>
              </View>
              <Text
                className="text-xs font-mono text-text dark:text-dark-text"
                numberOfLines={1}
              >
                {hasToken ? 'you/' : '(owner)/'}
                {sanitizeRepoName(effectiveRepoName) || 'my-app'}
              </Text>
            </View>
          </Card>

          <Card className="mb-4">
            <Text className="text-base font-semibold text-text dark:text-dark-text mb-1">
              Repository name
            </Text>
            <Text className="text-xs text-muted dark:text-dark-muted mb-3">
              Optional. Edit if you want a different repo name on GitHub.
            </Text>
            <Input
              label="Repo name"
              value={repoNameDraft}
              onChangeText={handleRepoNameChange}
              placeholder={derivedRepoName}
              autoCapitalize="none"
              autoCorrect={false}
              containerClassName="mb-2"
              maxLength={80}
            />
            {repoNameTouched ? (
              <Pressable
                onPress={handleResetRepoName}
                className="self-start"
                hitSlop={6}
              >
                <Text className="text-xs font-semibold text-primary">
                  Reset to "{derivedRepoName}"
                </Text>
              </Pressable>
            ) : null}
          </Card>

          <Card className="mb-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-sm font-semibold text-text dark:text-dark-text">
                  Private repository
                </Text>
                <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
                  Recommended. Anyone can still download the APK from the
                  release. Private repos keep the source and assets out of
                  public view.
                </Text>
              </View>
              <Switch
                value={repoPrivate}
                onValueChange={setRepoPrivate}
                trackColor={{ false: '#E2E8F0', true: '#2563EB' }}
              />
            </View>
          </Card>

          <Card className="mb-4">
            <View className="flex-row items-center mb-2">
              <Ionicons
                name={hasToken ? 'checkmark-circle' : 'information-circle'}
                size={18}
                color={hasToken ? '#16A34A' : '#2563EB'}
              />
              <Text className="text-sm font-semibold text-text dark:text-dark-text ml-2">
                {hasToken ? 'GitHub connected' : 'GitHub not connected'}
              </Text>
            </View>
            <Text className="text-xs text-muted dark:text-dark-muted">
              {hasToken
                ? 'We will create the repository immediately. If a repo with the same name already exists, we will not overwrite it — you will be asked to pick a new name.'
                : 'Without a GitHub token, the project is created locally. You can create the repo later from Project Settings.'}
            </Text>
          </Card>

          {repoPhase.kind === 'creating' ? (
            <View className="bg-primary/10 dark:bg-primary/20 rounded-xl p-3 mb-4 flex-row items-center">
              <ActivityIndicator color="#2563EB" />
              <Text className="text-xs text-text dark:text-dark-text ml-3">
                Creating repository on GitHub…
              </Text>
            </View>
          ) : null}

          {repoPhase.kind === 'done' ? (
            <View className="bg-success/10 dark:bg-success/20 rounded-xl p-3 mb-4 flex-row items-start">
              <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
              <Text className="text-xs text-text dark:text-dark-text ml-2 flex-1">
                Linked to {repoPhase.owner}/repo. You'll see it in Project
                Settings.
              </Text>
            </View>
          ) : null}

          {repoPhase.kind === 'failed' ? (
            <View className="bg-danger/10 dark:bg-danger/20 rounded-xl p-3 mb-4 flex-row items-start">
              <Ionicons name="warning-outline" size={16} color="#EF4444" />
              <Text className="text-xs text-danger dark:text-danger ml-2 flex-1">
                {repoPhase.message}
              </Text>
            </View>
          ) : null}

          <Button
            label={creating ? 'Creating…' : 'Create project'}
            icon="checkmark-circle-outline"
            onPress={() => {
              void handleCreate();
            }}
            loading={creating}
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}