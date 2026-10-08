import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
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
import Button from '@/components/Button';
import Input from '@/components/Input';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import Card from '@/components/Card';
import { useProject } from '@/hooks/useProject';
import {
  deleteProjectAndMaybeRepo,
  deleteProjectFile,
  saveProjectFile,
} from '@/hooks/useProjects';
import { useProjectStore } from '@/store/useProjectStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import {
  GithubApiError,
  createRepoFromTemplate,
  getRepo,
  listRepoAudioFiles,
  validateToken,
  type RepoAudioFile,
} from '@/api/github';
import {
  formatDate,
  sanitizePackageName,
  sanitizeRepoName,
} from '@/utils/format';
import type { Page, PageType, Project } from '@/types/project';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'ProjectSettings'>;

type RepoActionState =
  | { kind: 'idle' }
  | { kind: 'creating' }
  | { kind: 'verifying' };

export default function ProjectSettingsScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { projectId } = route.params;
  const { project, loading, error, reload, save } = useProject(projectId);
  const storeSetProject = useProjectStore(s => s.setProject);

  const githubToken = useSettingsStore(s => s.githubToken);
  const templateOwner = useSettingsStore(s => s.templateOwner);
  const templateRepo = useSettingsStore(s => s.templateRepo);

  const [name, setName] = useState<string>('');
  const [packageName, setPackageName] = useState<string>('');
  const [version, setVersion] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [renamingPage, setRenamingPage] = useState<Page | null>(null);
  const [renameDraft, setRenameDraft] = useState<string>('');

  const [assetRepoDraft, setAssetRepoDraft] = useState<string>('');
  const [assetTokenDraft, setAssetTokenDraft] = useState<string>('');
  const [savingAssets, setSavingAssets] = useState<boolean>(false);
  const [verifyingAssets, setVerifyingAssets] = useState<boolean>(false);

  const [repoAction, setRepoAction] = useState<RepoActionState>({
    kind: 'idle',
  });

  useEffect(() => {
    if (project) {
      setName(project.name);
      setPackageName(project.packageName);
      setVersion(project.version);
      setAssetRepoDraft(project.assetRepo ?? '');
      setAssetTokenDraft(project.assetToken ?? '');
      storeSetProject(project);
    }
  }, [project, storeSetProject]);

  const hasLinkedRepo = Boolean(
    project?.repoOwner && project?.repoName && project?.repoUrl,
  );

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

  const handleSaveAssets = useCallback(async (): Promise<void> => {
    if (!project) return;
    const trimmedRepo = assetRepoDraft.trim();
    const trimmedToken = assetTokenDraft.trim();

    if (trimmedRepo && !/^[^/\s]+\/[^/\s]+$/.test(trimmedRepo)) {
      Toast.show({
        type: 'error',
        text1: 'Invalid repository',
        text2: 'Use "owner/repo" format.',
      });
      return;
    }

    setSavingAssets(true);
    try {
      const next = {
        ...project,
        assetRepo: trimmedRepo || undefined,
        assetToken: trimmedToken || undefined,
        updatedAt: Date.now(),
      };
      await save(next);
      storeSetProject(next);
      Toast.show({ type: 'success', text1: 'Private assets saved' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed.';
      Toast.show({ type: 'error', text1: 'Error', text2: msg });
    } finally {
      setSavingAssets(false);
    }
  }, [assetRepoDraft, assetTokenDraft, project, save, storeSetProject]);

  const handleVerifyAssets = useCallback(async (): Promise<void> => {
    const trimmedRepo = assetRepoDraft.trim();
    const trimmedToken = assetTokenDraft.trim();
    if (!trimmedRepo) {
      Toast.show({ type: 'error', text1: 'Enter a repository first' });
      return;
    }
    if (!/^[^/\s]+\/[^/\s]+$/.test(trimmedRepo)) {
      Toast.show({
        type: 'error',
        text1: 'Invalid repository',
        text2: 'Use "owner/repo" format.',
      });
      return;
    }

    const [owner, repo] = trimmedRepo.split('/');
    setVerifyingAssets(true);
    try {
      await getRepo(trimmedToken, owner, repo);
      let files: RepoAudioFile[] = [];
      try {
        files = await listRepoAudioFiles(trimmedToken || null, owner, repo);
      } catch {
        files = [];
      }
      Toast.show({
        type: 'success',
        text1: 'Access confirmed',
        text2:
          files.length > 0
            ? `Found ${files.length} audio file${
                files.length === 1 ? '' : 's'
              } at repo root.`
            : 'Repo is readable. No audio files at root.',
      });
    } catch (err) {
      const msg =
        err instanceof GithubApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Could not verify.';
      Toast.show({ type: 'error', text1: 'Verification failed', text2: msg });
    } finally {
      setVerifyingAssets(false);
    }
  }, [assetRepoDraft, assetTokenDraft]);

  const handleClearAssets = useCallback((): void => {
    Alert.alert(
      'Clear private asset credentials?',
      'Music and BGM URLs pointing at a private repo will fail to load until you set them again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setAssetRepoDraft('');
            setAssetTokenDraft('');
          },
        },
      ],
    );
  }, []);

  const handleCreateOrLinkRepo = useCallback(async (): Promise<void> => {
    if (!project) return;
    if (!githubToken || !githubToken.trim()) {
      Toast.show({
        type: 'error',
        text1: 'No GitHub token',
        text2: 'Add one in Settings first.',
      });
      return;
    }

    const repoName = project.repoName
      ? sanitizeRepoName(project.repoName)
      : sanitizeRepoName(project.name);

    if (!repoName) {
      Toast.show({
        type: 'error',
        text1: 'Invalid repo name',
        text2: 'Rename the project and try again.',
      });
      return;
    }

    setRepoAction({ kind: 'creating' });
    try {
      const user = await validateToken(githubToken);
      const owner = user.login;

      // Try to link to an existing repo first.
      try {
        const existing = await getRepo(githubToken, owner, repoName);
        const next: Project = {
          ...project,
          repoOwner: owner,
          repoName,
          repoUrl: existing.html_url,
          repoPrivate: existing.private,
          updatedAt: Date.now(),
        };
        await save(next);
        storeSetProject(next);
        Toast.show({
          type: 'success',
          text1: 'Repo linked',
          text2: `${owner}/${repoName}`,
        });
        setRepoAction({ kind: 'idle' });
        return;
      } catch (err) {
        if (!(err instanceof GithubApiError && err.status === 404)) {
          throw err;
        }
        // Fall through to creation.
      }

      const created = await createRepoFromTemplate(
        githubToken,
        templateOwner,
        templateRepo,
        owner,
        repoName,
        project.repoPrivate ?? true,
      );

      const next: Project = {
        ...project,
        repoOwner: owner,
        repoName,
        repoUrl: created.html_url,
        repoPrivate: created.private,
        updatedAt: Date.now(),
      };
      await save(next);
      storeSetProject(next);
      Toast.show({
        type: 'success',
        text1: 'Repo created',
        text2: `${owner}/${repoName}`,
      });
      setRepoAction({ kind: 'idle' });
    } catch (err) {
      const msg =
        err instanceof GithubApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Could not create or link the repo.';
      Toast.show({ type: 'error', text1: 'Repo setup failed', text2: msg });
      setRepoAction({ kind: 'idle' });
    }
  }, [
    githubToken,
    project,
    save,
    storeSetProject,
    templateOwner,
    templateRepo,
  ]);

  const handleOpenRepo = useCallback((): void => {
    if (!project?.repoUrl) return;
    Linking.openURL(project.repoUrl).catch(() => {
      Toast.show({ type: 'error', text1: 'Could not open GitHub' });
    });
  }, [project?.repoUrl]);

  const handleUnlinkRepo = useCallback((): void => {
    if (!project) return;
    Alert.alert(
      'Unlink repository?',
      'The GitHub repo will not be deleted. You just stop linking to it from this project.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            const next: Project = {
              ...project,
              repoOwner: undefined,
              repoUrl: undefined,
              updatedAt: Date.now(),
            };
            await save(next);
            storeSetProject(next);
            Toast.show({ type: 'success', text1: 'Repository unlinked' });
          },
        },
      ],
    );
  }, [project, save, storeSetProject]);

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

  /**
   * Delete project with a two-step prompt when a repo is linked.
   *
   *   Step 1: "Delete project?"
   *   Step 2: "Also delete the GitHub repo?" (only if linked)
   */
  const handleDeleteProject = useCallback((): void => {
    if (!project) return;

    const projectRef = project;
    const hasRepo = Boolean(
      projectRef.repoOwner && projectRef.repoName,
    );

    const doLocalDelete = async (): Promise<void> => {
      try {
        await deleteProjectFile(projectRef.id);
        storeSetProject(null);
        Toast.show({ type: 'success', text1: 'Project deleted' });
        navigation.popToTop();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Delete failed.';
        Toast.show({ type: 'error', text1: 'Error', text2: msg });
      }
    };

    Alert.alert(
      'Delete project?',
      `"${projectRef.name}" and all of its data will be permanently removed. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            if (!hasRepo) {
              void doLocalDelete();
              return;
            }

            Alert.alert(
              'Also delete the GitHub repo?',
              `The repo "${projectRef.repoOwner}/${projectRef.repoName}" on GitHub can also be deleted. This cannot be undone.`,
              [
                {
                  text: 'Keep repo',
                  style: 'cancel',
                  onPress: () => {
                    void doLocalDelete();
                  },
                },
                {
                  text: 'Delete repo too',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const token =
                        useSettingsStore.getState().githubToken;
                      const result = await deleteProjectAndMaybeRepo(
                        projectRef,
                        { alsoDeleteRepo: true, token },
                      );
                      storeSetProject(null);

                      if (result.repoDeleted) {
                        Toast.show({
                          type: 'success',
                          text1: 'Project and repo deleted',
                        });
                      } else {
                        Toast.show({
                          type: 'success',
                          text1: 'Project deleted',
                          text2:
                            result.repoError ??
                            'Repo could not be deleted.',
                        });
                      }
                      navigation.popToTop();
                    } catch (err) {
                      const msg =
                        err instanceof Error
                          ? err.message
                          : 'Delete failed.';
                      Toast.show({
                        type: 'error',
                        text1: 'Error',
                        text2: msg,
                      });
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }, [navigation, project, storeSetProject]);

  const handleOpenPageSettings = useCallback(
    (pageId: string): void => {
      navigation.navigate('PageSettings', { projectId, pageId });
    },
    [navigation, projectId],
  );

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
              <View className="flex-row items-center mb-3">
                <View className="w-9 h-9 rounded-lg bg-primary/10 dark:bg-primary/20 items-center justify-center mr-3">
                  <Ionicons name="logo-github" size={18} color="#2563EB" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-text dark:text-dark-text">
                    Repository
                  </Text>
                  <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
                    {hasLinkedRepo
                      ? 'Linked. Builds push into this repo.'
                      : 'Not linked yet.'}
                  </Text>
                </View>
              </View>

              {hasLinkedRepo ? (
                <>
                  <View className="bg-background dark:bg-dark-background rounded-xl p-3 mb-3">
                    <Text className="text-xs font-mono text-text dark:text-dark-text">
                      {project.repoOwner}/{project.repoName}
                    </Text>
                    <Text className="text-[10px] text-muted dark:text-dark-muted mt-1">
                      {project.repoPrivate ? 'Private' : 'Public'}
                    </Text>
                  </View>

                  <View className="flex-row flex-wrap">
                    <Button
                      label="Open on GitHub"
                      icon="open-outline"
                      variant="secondary"
                      size="small"
                      onPress={handleOpenRepo}
                    />
                    <View className="w-2" />
                    <Button
                      label="Unlink"
                      icon="unlink-outline"
                      variant="ghost"
                      size="small"
                      onPress={handleUnlinkRepo}
                    />
                  </View>
                </>
              ) : (
                <>
                  <Text className="text-xs text-muted dark:text-dark-muted mb-3">
                    Suggested:{' '}
                    <Text className="font-mono">
                      {sanitizeRepoName(project.repoName ?? project.name)}
                    </Text>
                    {!githubToken?.trim()
                      ? '. Add a GitHub token in Settings first.'
                      : ' under your GitHub account.'}
                  </Text>
                  <Button
                    label={
                      repoAction.kind === 'creating'
                        ? 'Working…'
                        : 'Create / link repo'
                    }
                    icon="cloud-upload-outline"
                    onPress={() => {
                      void handleCreateOrLinkRepo();
                    }}
                    loading={repoAction.kind === 'creating'}
                    disabled={!githubToken?.trim()}
                    fullWidth
                  />
                </>
              )}
            </Card>

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
                hint="Used as the Android application ID when building. Changing this after a build may break in-place upgrades."
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
              <View className="flex-row items-center mb-3">
                <View className="w-9 h-9 rounded-lg bg-primary/10 dark:bg-primary/20 items-center justify-center mr-3">
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color="#2563EB"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-text dark:text-dark-text">
                    Private assets
                  </Text>
                  <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
                    Read access to a private GitHub repo used for music and
                    background audio.
                  </Text>
                </View>
              </View>

              <Input
                label="Repository"
                value={assetRepoDraft}
                onChangeText={setAssetRepoDraft}
                placeholder="owner/repo"
                autoCapitalize="none"
                hint="The private repo where your audio files live."
                containerClassName="mb-3"
              />

              <Input
                label="GitHub token"
                value={assetTokenDraft}
                onChangeText={setAssetTokenDraft}
                placeholder="github_pat_..."
                autoCapitalize="none"
                secureTextEntry
                hint="Stored inside the built APK. Anyone with the APK can read this token."
                containerClassName="mb-3"
              />

              <View className="bg-danger/10 dark:bg-danger/20 rounded-xl p-3 mb-3 flex-row items-start">
                <Ionicons name="warning-outline" size={16} color="#EF4444" />
                <Text className="text-xs text-danger dark:text-danger ml-2 flex-1">
                  Use a fine-grained token scoped to this one repo, with
                  read-only Contents access, and an expiry (90 days
                  recommended). Never grant write access.
                </Text>
              </View>

              <View className="flex-row flex-wrap">
                <Button
                  label={savingAssets ? 'Saving…' : 'Save'}
                  icon="save-outline"
                  onPress={() => {
                    void handleSaveAssets();
                  }}
                  loading={savingAssets}
                />
                <View className="w-2" />
                <Button
                  label={verifyingAssets ? 'Checking…' : 'Verify'}
                  icon="checkmark-circle-outline"
                  variant="secondary"
                  onPress={() => {
                    void handleVerifyAssets();
                  }}
                  loading={verifyingAssets}
                />
                <View className="w-2" />
                <Button
                  label="Clear"
                  icon="close-circle-outline"
                  variant="ghost"
                  onPress={handleClearAssets}
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
                the user completes them, the app jumps to the start page.
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
          const bgmOn = item.bgmEnabled === true && !!item.bgmUrl;
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
                    {bgmOn ? ' · ♪ BGM' : ''}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleOpenPageSettings(item.id)}
                  hitSlop={8}
                  className="p-1 mr-1"
                  accessibilityRole="button"
                  accessibilityLabel="Page settings"
                >
                  <Ionicons
                    name="settings-outline"
                    size={18}
                    color="#2563EB"
                  />
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
                Tap title to rename · Tap badge to switch Onboarding / Main ·
                Tap ⚙ for page settings (BGM)
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