import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
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
import { useProjectStore } from '@/store/useProjectStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useAssetPicker } from '@/hooks/useAssetPicker';
import {
  buildUploadContext,
  useAssetUpload,
} from '@/hooks/useAssetUpload';
import { formatBytes } from '@/services/assetUploader';
import type { Page, PageType } from '@/types/project';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'PageSettings'>;

export default function PageSettingsScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { projectId, pageId } = route.params;

  const { project, loading, error, reload, save } = useProject(projectId);
  const storeSetProject = useProjectStore(s => s.setProject);
  const githubToken = useSettingsStore(s => s.githubToken);
  const { picking: pickingAsset, pickAudio } = useAssetPicker();

  const [title, setTitle] = useState<string>('');
  const [type, setType] = useState<PageType>('main');
  const [bgmEnabled, setBgmEnabled] = useState<boolean>(false);
  const [bgmUrl, setBgmUrl] = useState<string>('');
  const [bgmLoop, setBgmLoop] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const uploadContext = useMemo(
    () => buildUploadContext(project, githubToken),
    [project, githubToken],
  );
  const {
    uploading: uploadingAsset,
    upload: uploadAsset,
    phase: uploadPhase,
    reset: resetUpload,
  } = useAssetUpload(uploadContext);

  const page: Page | null = useMemo(() => {
    if (!project) return null;
    return project.pages.find(p => p.id === pageId) ?? null;
  }, [project, pageId]);

  const isStartPage = useMemo(
    () => project?.startPageId === pageId,
    [project, pageId],
  );

  useEffect(() => {
    if (!page) return;
    setTitle(page.title);
    setType(page.type);
    setBgmEnabled(page.bgmEnabled === true);
    setBgmUrl(page.bgmUrl ?? '');
    setBgmLoop(page.bgmLoop !== false);
  }, [page]);

  useEffect(() => {
    if (project) storeSetProject(project);
  }, [project, storeSetProject]);

  const handleUploadBgm = useCallback(async (): Promise<void> => {
    if (!uploadContext) {
      Toast.show({
        type: 'error',
        text1: 'Upload unavailable',
        text2: 'Link this project to a repo first (Project Settings).',
      });
      return;
    }
    const picked = await pickAudio();
    if (!picked) return;
    const result = await uploadAsset({
      localUri: picked.uri,
      fileName: picked.fileName,
      mimeType: picked.mimeType,
      kind: 'audio',
    });
    if (!result) {
      Toast.show({
        type: 'error',
        text1: 'Upload failed',
        text2:
          uploadPhase.kind === 'error'
            ? uploadPhase.message
            : 'Please try again.',
      });
      resetUpload();
      return;
    }
    setBgmUrl(result.url);
    setBgmEnabled(true);
    Toast.show({
      type: 'success',
      text1: 'BGM uploaded',
      text2: `${formatBytes(result.size)} — remember to Save`,
    });
    resetUpload();
  }, [
    pickAudio,
    resetUpload,
    uploadAsset,
    uploadContext,
    uploadPhase,
  ]);

  const handleSave = useCallback(async (): Promise<void> => {
    if (!project || !page) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Toast.show({ type: 'error', text1: 'Page title cannot be empty' });
      return;
    }

    const trimmedBgmUrl = bgmUrl.trim();
    if (bgmEnabled && !trimmedBgmUrl) {
      Toast.show({
        type: 'error',
        text1: 'BGM URL is empty',
        text2: 'Add a URL or turn off background music.',
      });
      return;
    }
    if (trimmedBgmUrl && !/^https?:\/\//i.test(trimmedBgmUrl)) {
      Toast.show({
        type: 'error',
        text1: 'Invalid BGM URL',
        text2: 'Must start with http:// or https://.',
      });
      return;
    }

    setSaving(true);
    try {
      const pages = project.pages.map(p =>
        p.id === pageId
          ? {
              ...p,
              title: trimmedTitle,
              type,
              bgmEnabled,
              bgmUrl: trimmedBgmUrl || undefined,
              bgmLoop,
            }
          : p,
      );
      const next = { ...project, pages, updatedAt: Date.now() };
      await save(next);
      storeSetProject(next);
      Toast.show({ type: 'success', text1: 'Page saved' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed.';
      Toast.show({ type: 'error', text1: 'Error', text2: msg });
    } finally {
      setSaving(false);
    }
  }, [
    bgmEnabled,
    bgmLoop,
    bgmUrl,
    page,
    pageId,
    project,
    save,
    storeSetProject,
    title,
    type,
  ]);

  const handleSetStartPage = useCallback(async (): Promise<void> => {
    if (!project) return;
    if (isStartPage) return;
    try {
      const next = { ...project, startPageId: pageId, updatedAt: Date.now() };
      await save(next);
      storeSetProject(next);
      Toast.show({ type: 'success', text1: 'Set as start page' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed.';
      Toast.show({ type: 'error', text1: 'Error', text2: msg });
    }
  }, [isStartPage, pageId, project, save, storeSetProject]);

  const handleClearBgm = useCallback((): void => {
    Alert.alert('Clear background music?', 'The URL will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          setBgmUrl('');
          setBgmEnabled(false);
        },
      },
    ]);
  }, []);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader
          title="Page Settings"
          onBack={() => navigation.goBack()}
        />
        <LoadingState message="Loading page…" />
      </SafeAreaView>
    );
  }

  if (error || !project || !page) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader
          title="Page Settings"
          onBack={() => navigation.goBack()}
        />
        <ErrorState
          message={error ?? 'Page not found.'}
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
        title="Page Settings"
        subtitle={page.title}
        onBack={() => navigation.goBack()}
        rightActions={[
          {
            icon: 'checkmark-outline',
            onPress: () => {
              void handleSave();
            },
            accessibilityLabel: 'Save page',
          },
        ]}
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Card className="mb-4">
          <Text className="text-base font-semibold text-text dark:text-dark-text mb-3">
            General
          </Text>
          <Input
            label="Page title"
            value={title}
            onChangeText={setTitle}
            placeholder="Home"
            containerClassName="mb-3"
          />

          <Text className="text-xs font-semibold text-text dark:text-dark-text mb-2">
            Page type
          </Text>
          <View className="flex-row mb-3">
            <Pressable
              onPress={() => setType('main')}
              className={[
                'flex-1 items-center px-3 py-3 rounded-lg mr-2 border',
                type === 'main'
                  ? 'bg-primary border-primary'
                  : 'bg-card dark:bg-dark-card border-border dark:border-dark-border',
              ].join(' ')}
              accessibilityRole="button"
            >
              <Ionicons
                name="home-outline"
                size={16}
                color={type === 'main' ? '#FFFFFF' : '#2563EB'}
              />
              <Text
                className={[
                  'text-xs font-semibold mt-1',
                  type === 'main'
                    ? 'text-white'
                    : 'text-text dark:text-dark-text',
                ].join(' ')}
              >
                Main
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setType('onboarding')}
              className={[
                'flex-1 items-center px-3 py-3 rounded-lg border',
                type === 'onboarding'
                  ? 'bg-primary border-primary'
                  : 'bg-card dark:bg-dark-card border-border dark:border-dark-border',
              ].join(' ')}
              accessibilityRole="button"
            >
              <Ionicons
                name="play-skip-forward-outline"
                size={16}
                color={type === 'onboarding' ? '#FFFFFF' : '#2563EB'}
              />
              <Text
                className={[
                  'text-xs font-semibold mt-1',
                  type === 'onboarding'
                    ? 'text-white'
                    : 'text-text dark:text-dark-text',
                ].join(' ')}
              >
                Onboarding
              </Text>
            </Pressable>
          </View>

          <Text className="text-xs text-muted dark:text-dark-muted mb-3">
            Onboarding pages show only on first launch. After the user completes
            them, the app jumps to the start page.
          </Text>

          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-sm text-text dark:text-dark-text">
                Start page
              </Text>
              <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
                {isStartPage
                  ? 'This page is the start page.'
                  : 'Make this the first page users see after onboarding.'}
              </Text>
            </View>
            {isStartPage ? (
              <View className="px-3 py-2 rounded-lg bg-success/10 dark:bg-success/20">
                <Text className="text-xs font-bold text-success">CURRENT</Text>
              </View>
            ) : (
              <Button
                label="Set as start"
                icon="flag-outline"
                variant="secondary"
                size="small"
                onPress={() => {
                  void handleSetStartPage();
                }}
              />
            )}
          </View>
        </Card>

        <Card className="mb-4">
          <View className="flex-row items-center mb-3">
            <View className="w-9 h-9 rounded-lg bg-primary/10 dark:bg-primary/20 items-center justify-center mr-3">
              <Ionicons
                name="musical-notes-outline"
                size={18}
                color="#2563EB"
              />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-text dark:text-dark-text">
                Background music
              </Text>
              <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
                Plays while this page is open. Stops when the user navigates.
              </Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm text-text dark:text-dark-text">
              Enable BGM for this page
            </Text>
            <Switch
              value={bgmEnabled}
              onValueChange={setBgmEnabled}
              trackColor={{ false: '#E2E8F0', true: '#2563EB' }}
            />
          </View>

          <Input
            label="Audio URL"
            value={bgmUrl}
            onChangeText={setBgmUrl}
            placeholder="https://api.github.com/repos/owner/repo/contents/song.mp3"
            autoCapitalize="none"
            hint="Public https URL, or an api.github.com contents URL for a private repo (uses the project's private-assets token)."
            containerClassName="mb-3"
          />

          {uploadContext ? (
            <View className="mb-3">
              <Button
                label={
                  pickingAsset || uploadingAsset
                    ? 'Uploading…'
                    : 'Upload audio file'
                }
                icon="cloud-upload-outline"
                variant="secondary"
                onPress={() => {
                  void handleUploadBgm();
                }}
                loading={pickingAsset || uploadingAsset}
                fullWidth
              />
              <Text className="text-xs text-muted dark:text-dark-muted mt-2">
                Uploads the file to your project's GitHub repo and fills the
                URL field above. Tap Save to apply.
              </Text>
            </View>
          ) : (
            <View className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-3 mb-3 flex-row items-start">
              <Ionicons
                name="information-circle-outline"
                size={16}
                color="#D97706"
              />
              <Text className="text-xs text-amber-900 dark:text-amber-200 ml-2 flex-1">
                Link this project to a GitHub repo (Project Settings) to enable
                direct uploads. Otherwise, paste a public URL above.
              </Text>
            </View>
          )}

          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-1 pr-3">
              <Text className="text-sm text-text dark:text-dark-text">
                Loop
              </Text>
              <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
                Restart from the beginning when the track ends.
              </Text>
            </View>
            <Switch
              value={bgmLoop}
              onValueChange={setBgmLoop}
              trackColor={{ false: '#E2E8F0', true: '#2563EB' }}
            />
          </View>

          {bgmUrl ? (
            <Button
              label="Clear BGM"
              icon="close-circle-outline"
              variant="ghost"
              size="small"
              onPress={handleClearBgm}
            />
          ) : null}

          <Text className="text-xs text-muted dark:text-dark-muted mt-3">
            The runtime attaches the project's private-assets token to any
            api.github.com URL automatically. Configure that token in Project
            Settings → Private assets.
          </Text>
        </Card>

        <Button
          label={saving ? 'Saving…' : 'Save changes'}
          icon="save-outline"
          onPress={() => {
            void handleSave();
          }}
          loading={saving}
          fullWidth
        />
      </ScrollView>
    </SafeAreaView>
  );
}