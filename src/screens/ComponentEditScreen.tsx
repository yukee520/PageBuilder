import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
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
import Button from '@/components/Button';
import Card from '@/components/Card';
import Input from '@/components/Input';
import ErrorState from '@/components/ErrorState';
import { useProjectStore } from '@/store/useProjectStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTheme } from '@/hooks/useTheme';
import { useImagePicker } from '@/hooks/useImagePicker';
import { useVideoPicker, MAX_LOCAL_VIDEO_BYTES } from '@/hooks/useVideoPicker';
import {
  GithubApiError,
  listRepoAudioFiles,
  type RepoAudioFile,
} from '@/api/github';
import type { ActionType, InteractionAction } from '@/types/action';
import { ACTION_TYPE_ICONS, ACTION_TYPE_LABELS } from '@/types/action';
import type {
  ButtonComponent,
  DividerComponent,
  HorizontalAlign,
  ImageComponent,
  InputComponent,
  MusicComponent,
  MusicTrack,
  PageComponent,
  SizePreset,
  SpacerComponent,
  TextComponent,
  VideoComponent,
} from '@/types/component';
import type { RootStackParamList } from '@/navigation/types';
import { generateComponentId } from '@/utils/id';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'ComponentEdit'>;

const SIZE_PRESETS: SizePreset[] = ['small', 'medium', 'large', 'full'];
const ALIGN_OPTIONS: HorizontalAlign[] = ['left', 'center', 'right'];
const ACTION_TYPES: ActionType[] = [
  'navigate',
  'openUrl',
  'showAlert',
  'playVideo',
  'toggleVisibility',
  'setVariable',
  'goBack',
  'nextOnboarding',
  'completeOnboarding',
];

const TEXT_COLOR_PRESETS: { label: string; value: string | null }[] = [
  { label: 'Default', value: null },
  { label: 'Dark', value: '#0F172A' },
  { label: 'Gray', value: '#64748B' },
  { label: 'White', value: '#FFFFFF' },
  { label: 'Primary', value: '#2563EB' },
  { label: 'Danger', value: '#EF4444' },
];

const ALIGN_ICONS: Record<HorizontalAlign, string> = {
  left: 'arrow-back-outline',
  center: 'remove-outline',
  right: 'arrow-forward-outline',
};

/** Human-readable cap for the video size hint under the picker button. */
const MAX_LOCAL_VIDEO_LABEL = `${(
  MAX_LOCAL_VIDEO_BYTES /
  (1024 * 1024)
).toFixed(0)} MB`;

export default function ComponentEditScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { projectId, pageId, componentId } = route.params;
  const { colors } = useTheme();
  const { picking: pickingImage, pick: pickImage } = useImagePicker();
  const { picking: pickingVideo, pick: pickVideo } = useVideoPicker();

  const project = useProjectStore(s => s.project);
  const updateComponent = useProjectStore(s => s.updateComponent);
  const removeComponent = useProjectStore(s => s.removeComponent);
  const moveComponent = useProjectStore(s => s.moveComponent);
  const addAction = useProjectStore(s => s.addAction);
  const removeAction = useProjectStore(s => s.removeAction);

  const githubToken = useSettingsStore(s => s.githubToken);

  const [showActionPicker, setShowActionPicker] = useState<boolean>(false);
  const [showTrackEditor, setShowTrackEditor] = useState<MusicTrack | null>(
    null,
  );
  const [showRepoBrowser, setShowRepoBrowser] = useState<boolean>(false);

  const page = useMemo(
    () => project?.pages.find(p => p.id === pageId) ?? null,
    [project, pageId],
  );

  const component = useMemo<PageComponent | null>(
    () => page?.components.find(c => c.id === componentId) ?? null,
    [page, componentId],
  );

  const patch = useCallback(
    (update: Partial<PageComponent>): void => {
      updateComponent(pageId, componentId, update);
    },
    [componentId, pageId, updateComponent],
  );

  const handlePickImage = useCallback(async (): Promise<void> => {
    const result = await pickImage();
    if (!result) return;
    patch({ uri: result.uri } as Partial<ImageComponent>);
    Toast.show({ type: 'success', text1: 'Image added' });
  }, [patch, pickImage]);

  const handlePickVideo = useCallback(async (): Promise<void> => {
    const result = await pickVideo();
    if (!result) return;
    patch({ url: result.uri } as Partial<VideoComponent>);
    Toast.show({
      type: 'success',
      text1: 'Video added',
      text2:
        result.size > 0
          ? `${(result.size / (1024 * 1024)).toFixed(1)} MB — bundled locally`
          : 'Bundled locally',
    });
  }, [patch, pickVideo]);

  const handleDelete = useCallback((): void => {
    Alert.alert('Delete component?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeComponent(pageId, componentId);
          navigation.goBack();
        },
      },
    ]);
  }, [componentId, navigation, pageId, removeComponent]);

  const handleAddAction = useCallback(
    (type: ActionType): void => {
      const newId = addAction(pageId, componentId, type);
      setShowActionPicker(false);
      if (newId) {
        navigation.navigate('ActionEdit', {
          projectId,
          pageId,
          componentId,
          actionId: newId,
        });
      }
    },
    [addAction, componentId, navigation, pageId, projectId],
  );

  const handleOpenAction = useCallback(
    (action: InteractionAction): void => {
      navigation.navigate('ActionEdit', {
        projectId,
        pageId,
        componentId,
        actionId: action.id,
      });
    },
    [componentId, navigation, pageId, projectId],
  );

  const handleRemoveAction = useCallback(
    (action: InteractionAction): void => {
      Alert.alert(
        'Remove action?',
        `"${ACTION_TYPE_LABELS[action.type]}" will be removed.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              removeAction(pageId, componentId, action.id);
              Toast.show({ type: 'success', text1: 'Action removed' });
            },
          },
        ],
      );
    },
    [componentId, pageId, removeAction],
  );

  const handleAlign = useCallback(
    (align: HorizontalAlign): void => {
      if (!component) return;
      if (component.type === 'text') {
        patch({ align } as Partial<TextComponent>);
        return;
      }
      const newX =
        align === 'left'
          ? 0
          : align === 'center'
          ? Math.max(0, (1 - component.width) / 2)
          : Math.max(0, 1 - component.width);
      patch({ x: newX } as Partial<PageComponent>);
      Toast.show({
        type: 'success',
        text1: `Aligned ${align}`,
      });
    },
    [component, patch],
  );

  const handleAddTrack = useCallback((): void => {
    if (!component || component.type !== 'music') return;
    const newTrack: MusicTrack = {
      id: generateComponentId(),
      title: 'New track',
      artist: '',
      url: '',
    };
    patch({
      tracks: [...component.tracks, newTrack],
    } as Partial<MusicComponent>);
    setShowTrackEditor(newTrack);
  }, [component, patch]);

  const handleUpdateTrack = useCallback(
    (trackId: string, updates: Partial<MusicTrack>): void => {
      if (!component || component.type !== 'music') return;
      patch({
        tracks: component.tracks.map(t =>
          t.id === trackId ? { ...t, ...updates } : t,
        ),
      } as Partial<MusicComponent>);
    },
    [component, patch],
  );

  const handleRemoveTrack = useCallback(
    (trackId: string): void => {
      if (!component || component.type !== 'music') return;
      Alert.alert('Remove track?', 'This track will be removed.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            patch({
              tracks: component.tracks.filter(t => t.id !== trackId),
            } as Partial<MusicComponent>);
          },
        },
      ]);
    },
    [component, patch],
  );

  const handleMoveTrack = useCallback(
    (trackId: string, direction: 'up' | 'down'): void => {
      if (!component || component.type !== 'music') return;
      const tracks = [...component.tracks];
      const index = tracks.findIndex(t => t.id === trackId);
      if (index < 0) return;
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= tracks.length) return;
      const [moved] = tracks.splice(index, 1);
      tracks.splice(target, 0, moved);
      patch({ tracks } as Partial<MusicComponent>);
    },
    [component, patch],
  );

  const handleAddTracksFromRepo = useCallback(
    (files: RepoAudioFile[]): void => {
      if (!component || component.type !== 'music') return;
      const newTracks: MusicTrack[] = files.map(f => ({
        id: generateComponentId(),
        title: f.title,
        artist: '',
        url: f.downloadUrl,
      }));
      patch({
        tracks: [...component.tracks, ...newTracks],
      } as Partial<MusicComponent>);
      Toast.show({
        type: 'success',
        text1: `Added ${newTracks.length} track${
          newTracks.length === 1 ? '' : 's'
        }`,
      });
    },
    [component, patch],
  );

  if (!project || !page) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader title="Edit Component" onBack={() => navigation.goBack()} />
        <ErrorState message="Project or page not found." />
      </SafeAreaView>
    );
  }

  if (!component) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader title="Edit Component" onBack={() => navigation.goBack()} />
        <ErrorState message="Component not found. It may have been deleted." />
      </SafeAreaView>
    );
  }

  const supportsActions =
    component.type !== 'input' &&
    component.type !== 'divider' &&
    component.type !== 'spacer' &&
    component.type !== 'music';

  return (
    <SafeAreaView
      className="flex-1 bg-background dark:bg-dark-background"
      edges={['top', 'left', 'right']}
    >
      <ScreenHeader
        title={`Edit ${component.type}`}
        subtitle={page.title}
        onBack={() => navigation.goBack()}
        rightActions={[
          {
            icon: 'trash-outline',
            onPress: handleDelete,
            accessibilityLabel: 'Delete component',
          },
        ]}
      />

      <FlatList
        data={component.actions}
        keyExtractor={a => a.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListHeaderComponent={
          <View>
            <Card className="mb-4">
              <Text className="text-base font-semibold text-text dark:text-dark-text mb-3">
                Content
              </Text>
              {renderContentEditor(
                component,
                patch,
                colors,
                pickingImage,
                handlePickImage,
                pickingVideo,
                handlePickVideo,
              )}
            </Card>

            {component.type === 'music' ? (
              <Card className="mb-4">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-base font-semibold text-text dark:text-dark-text">
                    Music tracks
                  </Text>
                  <Text className="text-xs text-muted dark:text-dark-muted">
                    {component.tracks.length} track
                    {component.tracks.length === 1 ? '' : 's'}
                  </Text>
                </View>

                <View className="flex-row flex-wrap mb-3">
                  <ToolbarButton
                    icon="add-outline"
                    label="Add track"
                    onPress={handleAddTrack}
                  />
                  <ToolbarButton
                    icon="logo-github"
                    label="From GitHub repo"
                    onPress={() => setShowRepoBrowser(true)}
                  />
                </View>

                {component.tracks.length === 0 ? (
                  <View className="bg-background dark:bg-dark-background rounded-xl p-4 items-center">
                    <Ionicons
                      name="musical-notes-outline"
                      size={24}
                      color={colors.muted}
                    />
                    <Text className="text-xs text-muted dark:text-dark-muted text-center mt-2">
                      No tracks yet. Tap "Add track" to add a URL, or "From
                      GitHub repo" to import MP3s.
                    </Text>
                  </View>
                ) : (
                  component.tracks.map((track, index) => (
                    <View
                      key={track.id}
                      className="bg-background dark:bg-dark-background rounded-xl p-3 mb-2"
                    >
                      <View className="flex-row items-center mb-1">
                        <Text className="text-xs font-bold text-muted dark:text-dark-muted w-6">
                          {index + 1}.
                        </Text>
                        <Text
                          className="text-sm font-semibold text-text dark:text-dark-text flex-1"
                          numberOfLines={1}
                        >
                          {track.title || 'Untitled'}
                        </Text>
                        <Pressable
                          onPress={() => setShowTrackEditor(track)}
                          hitSlop={6}
                          className="p-1.5"
                        >
                          <Ionicons
                            name="create-outline"
                            size={16}
                            color={colors.primary}
                          />
                        </Pressable>
                        <Pressable
                          onPress={() => handleRemoveTrack(track.id)}
                          hitSlop={6}
                          className="p-1.5"
                        >
                          <Ionicons
                            name="trash-outline"
                            size={16}
                            color={colors.danger}
                          />
                        </Pressable>
                      </View>
                      {track.artist ? (
                        <Text
                          className="text-xs text-muted dark:text-dark-muted ml-6 mb-1"
                          numberOfLines={1}
                        >
                          {track.artist}
                        </Text>
                      ) : null}
                      <Text
                        className="text-[10px] text-muted dark:text-dark-muted ml-6"
                        numberOfLines={1}
                      >
                        {track.url || '(no URL)'}
                      </Text>
                      <View className="flex-row ml-6 mt-2">
                        <Pressable
                          onPress={() => handleMoveTrack(track.id, 'up')}
                          disabled={index === 0}
                          className={[
                            'px-2 py-1 rounded mr-2 border',
                            index === 0
                              ? 'opacity-30 border-border dark:border-dark-border'
                              : 'border-border dark:border-dark-border active:bg-card dark:active:bg-dark-card',
                          ].join(' ')}
                        >
                          <Ionicons
                            name="arrow-up-outline"
                            size={12}
                            color={colors.text}
                          />
                        </Pressable>
                        <Pressable
                          onPress={() => handleMoveTrack(track.id, 'down')}
                          disabled={index === component.tracks.length - 1}
                          className={[
                            'px-2 py-1 rounded border',
                            index === component.tracks.length - 1
                              ? 'opacity-30 border-border dark:border-dark-border'
                              : 'border-border dark:border-dark-border active:bg-card dark:active:bg-dark-card',
                          ].join(' ')}
                        >
                          <Ionicons
                            name="arrow-down-outline"
                            size={12}
                            color={colors.text}
                          />
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}

                <Text className="text-xs text-muted dark:text-dark-muted mt-3">
                  For tracks hosted in a private GitHub repo, configure the
                  project's private-assets token in Project Settings.
                </Text>
              </Card>
            ) : null}

            <Card className="mb-4">
              <Text className="text-base font-semibold text-text dark:text-dark-text mb-3">
                Appearance
              </Text>
              {renderAppearanceEditor(component, patch, colors, handleAlign)}
            </Card>

            {component.type !== 'spacer' && component.type !== 'divider' ? (
              <Card className="mb-4">
                <Text className="text-base font-semibold text-text dark:text-dark-text mb-2">
                  Position
                </Text>
                <Text className="text-xs text-muted dark:text-dark-muted mb-3">
                  Current: x {(component.x * 100).toFixed(0)}% · y{' '}
                  {(component.y * 100).toFixed(0)}% ·{' '}
                  {(component.width * 100).toFixed(0)}% ×{' '}
                  {(component.height * 100).toFixed(0)}%
                </Text>
                <View className="flex-row flex-wrap">
                  <AlignButton
                    icon="arrow-back-outline"
                    label="Left"
                    active={Math.abs(component.x) < 0.02}
                    onPress={() => handleAlign('left')}
                  />
                  <AlignButton
                    icon="remove-outline"
                    label="Center"
                    active={
                      Math.abs(
                        component.x - Math.max(0, (1 - component.width) / 2),
                      ) < 0.02
                    }
                    onPress={() => handleAlign('center')}
                  />
                  <AlignButton
                    icon="arrow-forward-outline"
                    label="Right"
                    active={
                      Math.abs(
                        component.x - Math.max(0, 1 - component.width),
                      ) < 0.02
                    }
                    onPress={() => handleAlign('right')}
                  />
                </View>
              </Card>
            ) : null}

            <Card className="mb-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-sm font-semibold text-text dark:text-dark-text">
                    Visible
                  </Text>
                  <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
                    Hidden components won't show during preview or in the built
                    APK.
                  </Text>
                </View>
                <Switch
                  value={component.visible}
                  onValueChange={value => patch({ visible: value })}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
            </Card>

            <Card className="mb-4">
              <Text className="text-sm font-semibold text-text dark:text-dark-text mb-2">
                Order
              </Text>
              <View className="flex-row">
                <Button
                  label="Move up"
                  icon="arrow-up-outline"
                  variant="secondary"
                  size="small"
                  onPress={() => moveComponent(pageId, componentId, 'up')}
                />
                <View className="w-2" />
                <Button
                  label="Move down"
                  icon="arrow-down-outline"
                  variant="secondary"
                  size="small"
                  onPress={() => moveComponent(pageId, componentId, 'down')}
                />
              </View>
            </Card>

            {supportsActions ? (
              <>
                <View className="flex-row items-center justify-between mb-2 px-1">
                  <Text className="text-sm font-semibold text-text dark:text-dark-text">
                    Interactions
                  </Text>
                  <Pressable
                    onPress={() => setShowActionPicker(true)}
                    className="flex-row items-center bg-primary/10 dark:bg-primary/20 px-3 py-1.5 rounded-lg"
                    accessibilityRole="button"
                  >
                    <Ionicons name="add" size={16} color="#2563EB" />
                    <Text className="text-xs font-semibold text-primary ml-1">
                      Add action
                    </Text>
                  </Pressable>
                </View>

                {component.actions.length === 0 ? (
                  <View className="bg-card dark:bg-dark-card border border-dashed border-border dark:border-dark-border rounded-xl p-4 mb-2 items-center">
                    <Text className="text-xs text-muted dark:text-dark-muted text-center">
                      No actions yet. Add one to make this component
                      interactive.
                    </Text>
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleOpenAction(item)}
            onLongPress={() => handleRemoveAction(item)}
            className="flex-row items-center bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-xl p-3 mb-2 active:opacity-80"
            accessibilityRole="button"
          >
            <View className="w-9 h-9 rounded-lg bg-primary/10 dark:bg-primary/20 items-center justify-center mr-3">
              <Ionicons
                name={ACTION_TYPE_ICONS[item.type]}
                size={18}
                color="#2563EB"
              />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-text dark:text-dark-text">
                {ACTION_TYPE_LABELS[item.type]}
              </Text>
              <Text
                className="text-xs text-muted dark:text-dark-muted mt-0.5"
                numberOfLines={1}
              >
                {describeAction(item)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        )}
        ListEmptyComponent={null}
      />

      {showActionPicker ? (
        <Pressable
          onPress={() => setShowActionPicker(false)}
          className="absolute inset-0 bg-black/40 justify-end"
        >
          <Pressable onPress={() => undefined}>
            <View className="bg-card dark:bg-dark-card rounded-t-3xl p-4 pb-8">
              <View className="w-10 h-1 rounded-full bg-border dark:bg-dark-border self-center mb-3" />
              <Text className="text-base font-semibold text-text dark:text-dark-text mb-3">
                Choose an action
              </Text>
              {ACTION_TYPES.map(type => (
                <Pressable
                  key={type}
                  onPress={() => handleAddAction(type)}
                  className="flex-row items-center py-3 px-2 rounded-xl active:bg-background dark:active:bg-dark-background"
                  accessibilityRole="button"
                >
                  <View className="w-9 h-9 rounded-lg bg-primary/10 dark:bg-primary/20 items-center justify-center mr-3">
                    <Ionicons
                      name={ACTION_TYPE_ICONS[type]}
                      size={18}
                      color="#2563EB"
                    />
                  </View>
                  <Text className="text-sm font-semibold text-text dark:text-dark-text">
                    {ACTION_TYPE_LABELS[type]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      ) : null}

      {showTrackEditor ? (
        <TrackEditorModal
          track={showTrackEditor}
          onClose={() => setShowTrackEditor(null)}
          onSave={updates => {
            handleUpdateTrack(showTrackEditor.id, updates);
            setShowTrackEditor(null);
            Toast.show({ type: 'success', text1: 'Track saved' });
          }}
        />
      ) : null}

      {showRepoBrowser ? (
        <RepoBrowserModal
          initialToken={githubToken}
          onClose={() => setShowRepoBrowser(false)}
          onImport={files => {
            handleAddTracksFromRepo(files);
            setShowRepoBrowser(false);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function describeAction(action: InteractionAction): string {
  switch (action.type) {
    case 'navigate':
      return action.pageId ? 'Target page selected' : 'No page selected';
    case 'openUrl':
      return action.url || 'No URL';
    case 'showAlert':
      return action.title || 'No title';
    case 'playVideo':
      return action.url || 'No URL';
    case 'toggleVisibility':
      return action.targetComponentId ? 'Target set' : 'No target';
    case 'setVariable':
      return action.key ? `${action.key} = ${action.value || '""'}` : 'No key';
    case 'goBack':
      return 'Return to previous page';
    case 'nextOnboarding':
      return 'Advance to next onboarding page';
    case 'completeOnboarding':
      return 'Skip the rest of onboarding';
  }
}

function renderContentEditor(
  c: PageComponent,
  patch: (update: Partial<PageComponent>) => void,
  colors: ReturnType<typeof useTheme>['colors'],
  pickingImage: boolean,
  onPickImage: () => void,
  pickingVideo: boolean,
  onPickVideo: () => void,
): React.ReactElement {
  switch (c.type) {
    case 'text':
      return (
        <Input
          label="Text content"
          value={c.content}
          onChangeText={value =>
            patch({ content: value } as Partial<TextComponent>)
          }
          placeholder="Enter your text"
          multiline
        />
      );

    case 'image':
      return (
        <View>
          <Text className="text-sm font-semibold text-text dark:text-dark-text mb-2">
            Image source
          </Text>

          {c.uri ? (
            <View className="mb-3 rounded-xl overflow-hidden border border-border dark:border-dark-border bg-background dark:bg-dark-background">
              <Image
                source={{ uri: c.uri }}
                style={{ width: '100%', height: 180 }}
                resizeMode="cover"
              />
            </View>
          ) : (
            <View
              className="mb-3 rounded-xl border border-dashed border-border dark:border-dark-border items-center justify-center bg-background dark:bg-dark-background"
              style={{ height: 140 }}
            >
              <Ionicons name="image-outline" size={32} color={colors.muted} />
              <Text className="text-xs text-muted dark:text-dark-muted mt-2">
                No image selected
              </Text>
            </View>
          )}

          <Button
            label={
              pickingImage
                ? 'Opening gallery…'
                : c.uri
                ? 'Replace image'
                : 'Pick from gallery'
            }
            icon="images-outline"
            onPress={onPickImage}
            loading={pickingImage}
            fullWidth
          />

          {c.uri ? (
            <View className="mt-2">
              <Button
                label="Remove image"
                icon="close-circle-outline"
                variant="ghost"
                size="small"
                onPress={() => patch({ uri: '' } as Partial<ImageComponent>)}
              />
            </View>
          ) : null}

          <View className="mt-4">
            <Input
              label="Or paste an image URL"
              value={c.uri.startsWith('http') ? c.uri : ''}
              onChangeText={value =>
                patch({ uri: value } as Partial<ImageComponent>)
              }
              placeholder="https://example.com/image.jpg"
              autoCapitalize="none"
              hint="Useful for images hosted online."
            />
          </View>
        </View>
      );

    case 'video':
      return (
        <View>
          <Text className="text-sm font-semibold text-text dark:text-dark-text mb-2">
            Video source
          </Text>

          {c.url ? (
            <View className="mb-3 rounded-xl border border-border dark:border-dark-border bg-background dark:bg-dark-background p-3">
              <View className="flex-row items-center">
                <Ionicons
                  name="videocam-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text
                  className="text-xs text-text dark:text-dark-text ml-2 flex-1"
                  numberOfLines={2}
                >
                  {c.url}
                </Text>
              </View>
            </View>
          ) : (
            <View
              className="mb-3 rounded-xl border border-dashed border-border dark:border-dark-border items-center justify-center bg-background dark:bg-dark-background"
              style={{ height: 100 }}
            >
              <Ionicons
                name="videocam-outline"
                size={28}
                color={colors.muted}
              />
              <Text className="text-xs text-muted dark:text-dark-muted mt-2">
                No video selected
              </Text>
            </View>
          )}

          <Button
            label={
              pickingVideo
                ? 'Opening gallery…'
                : c.url
                ? 'Replace video'
                : 'Pick video from gallery'
            }
            icon="videocam-outline"
            onPress={onPickVideo}
            loading={pickingVideo}
            fullWidth
          />
          <Text className="text-xs text-muted dark:text-dark-muted mt-2">
            Local videos are bundled into the APK — max{' '}
            {MAX_LOCAL_VIDEO_LABEL}. For longer videos, paste a URL below.
          </Text>

          {c.url ? (
            <View className="mt-2">
              <Button
                label="Remove video"
                icon="close-circle-outline"
                variant="ghost"
                size="small"
                onPress={() => patch({ url: '' } as Partial<VideoComponent>)}
              />
            </View>
          ) : null}

          <View className="mt-4">
            <Input
              label="Or paste a video URL"
              value={c.url.startsWith('http') ? c.url : ''}
              onChangeText={value =>
                patch({ url: value } as Partial<VideoComponent>)
              }
              placeholder="https://www.youtube.com/watch?v=..."
              autoCapitalize="none"
              hint="Useful for videos hosted online."
              containerClassName="mb-3"
            />
          </View>

          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-1 pr-3">
              <Text className="text-sm text-text dark:text-dark-text">
                Autoplay
              </Text>
              <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
                Plays automatically when the page loads. No play button. BGM
                pauses while the video plays.
              </Text>
            </View>
            <Switch
              value={c.autoPlay}
              onValueChange={value =>
                patch({ autoPlay: value } as Partial<VideoComponent>)
              }
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-sm text-text dark:text-dark-text">
                Loop
              </Text>
              <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
                Restart from the beginning after the video ends. Only applies
                to autoplay videos.
              </Text>
            </View>
            <Switch
              value={c.loop}
              onValueChange={value =>
                patch({ loop: value } as Partial<VideoComponent>)
              }
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </View>
      );

    case 'button':
      return (
        <>
          <Input
            label="Button label"
            value={c.label}
            onChangeText={value =>
              patch({ label: value } as Partial<ButtonComponent>)
            }
            placeholder="Tap me"
            containerClassName="mb-3"
          />
          <Text className="text-xs font-semibold text-text dark:text-dark-text mb-2">
            Style
          </Text>
          <View className="flex-row flex-wrap">
            {(['primary', 'secondary', 'danger'] as const).map(v => {
              const active = c.variant === v;
              return (
                <Pressable
                  key={v}
                  onPress={() =>
                    patch({ variant: v } as Partial<ButtonComponent>)
                  }
                  className={[
                    'px-3 py-2 rounded-lg mr-2 mb-2 border',
                    active
                      ? 'bg-primary border-primary'
                      : 'bg-card dark:bg-dark-card border-border dark:border-dark-border',
                  ].join(' ')}
                >
                  <Text
                    className={[
                      'text-xs font-semibold capitalize',
                      active ? 'text-white' : 'text-text dark:text-dark-text',
                    ].join(' ')}
                  >
                    {v}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      );

    case 'spacer':
      return (
        <Text className="text-xs text-muted dark:text-dark-muted">
          Adjust the height of this spacer by resizing it on the canvas.
        </Text>
      );

    case 'divider':
      return (
        <Text className="text-xs text-muted dark:text-dark-muted">
          Adjust thickness in the Appearance section.
        </Text>
      );

    case 'row':
      return (
        <Text className="text-xs text-muted dark:text-dark-muted">
          This is a row container. Child components inside rows are managed on
          the canvas.
        </Text>
      );

    case 'input':
      return (
        <>
          <Input
            label="Placeholder"
            value={c.placeholder}
            onChangeText={value =>
              patch({ placeholder: value } as Partial<InputComponent>)
            }
            placeholder="Enter text"
            containerClassName="mb-3"
          />
          <Input
            label="Variable key"
            value={c.variableKey}
            onChangeText={value =>
              patch({ variableKey: value } as Partial<InputComponent>)
            }
            placeholder="username"
            autoCapitalize="none"
            hint="Used in actions such as Set variable."
          />
        </>
      );

    case 'music':
      return (
        <Text className="text-xs text-muted dark:text-dark-muted">
          Manage tracks in the "Music tracks" section below. Each track plays
          when tapped. Tracks advance automatically, and loop back to the first
          after the last one finishes.
        </Text>
      );
  }
}

function renderAppearanceEditor(
  c: PageComponent,
  patch: (update: Partial<PageComponent>) => void,
  colors: ReturnType<typeof useTheme>['colors'],
  onAlign: (align: HorizontalAlign) => void,
): React.ReactElement {
  switch (c.type) {
    case 'text':
      return (
        <>
          <Text className="text-xs font-semibold text-text dark:text-dark-text mb-2">
            Text size
          </Text>
          <View className="flex-row flex-wrap mb-3">
            {SIZE_PRESETS.map(s => {
              const active = c.fontSize === s;
              return (
                <Pressable
                  key={s}
                  onPress={() =>
                    patch({ fontSize: s } as Partial<TextComponent>)
                  }
                  className={[
                    'px-3 py-2 rounded-lg mr-2 mb-2 border',
                    active
                      ? 'bg-primary border-primary'
                      : 'bg-card dark:bg-dark-card border-border dark:border-dark-border',
                  ].join(' ')}
                >
                  <Text
                    className={[
                      'text-xs font-semibold capitalize',
                      active ? 'text-white' : 'text-text dark:text-dark-text',
                    ].join(' ')}
                  >
                    {s}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="text-xs font-semibold text-text dark:text-dark-text mb-2">
            Text align (inside box)
          </Text>
          <View className="flex-row mb-3">
            {ALIGN_OPTIONS.map(a => {
              const active = c.align === a;
              return (
                <Pressable
                  key={a}
                  onPress={() => patch({ align: a } as Partial<TextComponent>)}
                  className={[
                    'px-3 py-2 rounded-lg mr-2 border',
                    active
                      ? 'bg-primary border-primary'
                      : 'bg-card dark:bg-dark-card border-border dark:border-dark-border',
                  ].join(' ')}
                >
                  <Text
                    className={[
                      'text-xs font-semibold capitalize',
                      active ? 'text-white' : 'text-text dark:text-dark-text',
                    ].join(' ')}
                  >
                    {a}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="text-xs font-semibold text-text dark:text-dark-text mb-2">
            Text color
          </Text>
          <View className="flex-row flex-wrap mb-3">
            {TEXT_COLOR_PRESETS.map(preset => {
              const active = (c.color ?? null) === preset.value;
              return (
                <Pressable
                  key={preset.label}
                  onPress={() =>
                    patch({ color: preset.value } as Partial<TextComponent>)
                  }
                  className={[
                    'px-3 py-2 rounded-lg mr-2 mb-2 border',
                    active
                      ? 'bg-primary border-primary'
                      : 'bg-card dark:bg-dark-card border-border dark:border-dark-border',
                  ].join(' ')}
                >
                  <Text
                    className={[
                      'text-xs font-semibold',
                      active ? 'text-white' : 'text-text dark:text-dark-text',
                    ].join(' ')}
                  >
                    {preset.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-text dark:text-dark-text">Bold</Text>
            <Switch
              value={c.bold}
              onValueChange={value =>
                patch({ bold: value } as Partial<TextComponent>)
              }
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </>
      );

    case 'image':
      return (
        <>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm text-text dark:text-dark-text">
              Rounded corners
            </Text>
            <Switch
              value={c.rounded}
              onValueChange={value =>
                patch({ rounded: value } as Partial<ImageComponent>)
              }
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-sm text-text dark:text-dark-text">
                Fill the box (cover)
              </Text>
              <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
                Off: image fits inside the box. On: image fills the box, may
                crop.
              </Text>
            </View>
            <Switch
              value={c.backgroundMode}
              onValueChange={value =>
                patch({ backgroundMode: value } as Partial<ImageComponent>)
              }
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </>
      );

    case 'button':
      return (
        <>
          <Text className="text-xs text-muted dark:text-dark-muted mb-3">
            Use the toolbar in the editor to resize, or "Fit width" to make the
            button span the full canvas width.
          </Text>
          <Text className="text-xs font-semibold text-text dark:text-dark-text mb-2">
            Horizontal align (move box)
          </Text>
          <View className="flex-row">
            {ALIGN_OPTIONS.map(a => (
              <AlignButton
                key={a}
                icon={ALIGN_ICONS[a]}
                label={a.charAt(0).toUpperCase() + a.slice(1)}
                active={false}
                onPress={() => onAlign(a)}
              />
            ))}
          </View>
        </>
      );

    case 'divider':
      return (
        <>
          <Text className="text-xs font-semibold text-text dark:text-dark-text mb-2">
            Thickness
          </Text>
          <View className="flex-row">
            {(['thin', 'medium', 'thick'] as const).map(t => {
              const active = c.thickness === t;
              return (
                <Pressable
                  key={t}
                  onPress={() =>
                    patch({ thickness: t } as Partial<DividerComponent>)
                  }
                  className={[
                    'px-3 py-2 rounded-lg mr-2 border',
                    active
                      ? 'bg-primary border-primary'
                      : 'bg-card dark:bg-dark-card border-border dark:border-dark-border',
                  ].join(' ')}
                >
                  <Text
                    className={[
                      'text-xs font-semibold capitalize',
                      active ? 'text-white' : 'text-text dark:text-dark-text',
                    ].join(' ')}
                  >
                    {t}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      );

    case 'spacer':
      return (
        <Text className="text-xs text-muted dark:text-dark-muted">
          Resize this spacer on the canvas to change its height.
        </Text>
      );

    case 'video':
      return (
        <>
          <Text className="text-xs font-semibold text-text dark:text-dark-text mb-2">
            Horizontal align (move box)
          </Text>
          <View className="flex-row">
            {ALIGN_OPTIONS.map(a => (
              <AlignButton
                key={a}
                icon={ALIGN_ICONS[a]}
                label={a.charAt(0).toUpperCase() + a.slice(1)}
                active={false}
                onPress={() => onAlign(a)}
              />
            ))}
          </View>
        </>
      );

    case 'music':
      return (
        <>
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-1 pr-3">
              <Text className="text-sm text-text dark:text-dark-text">
                Show artist name
              </Text>
              <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
                Displays the artist under each track title.
              </Text>
            </View>
            <Switch
              value={c.showArtist}
              onValueChange={value =>
                patch({ showArtist: value } as Partial<MusicComponent>)
              }
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-sm text-text dark:text-dark-text">
                Autoplay first track
              </Text>
              <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
                Starts the first track when this page is opened.
              </Text>
            </View>
            <Switch
              value={c.autoplay}
              onValueChange={value =>
                patch({ autoplay: value } as Partial<MusicComponent>)
              }
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </>
      );

    case 'row':
    case 'input':
      return (
        <Text className="text-xs text-muted dark:text-dark-muted">
          No appearance options for this component yet.
        </Text>
      );
  }
}

function AlignButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: string;
  label: string;
  active: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      className={[
        'flex-row items-center px-3 py-2 rounded-lg mr-2 mb-2 border',
        active
          ? 'bg-primary border-primary'
          : 'bg-card dark:bg-dark-card border-border dark:border-dark-border',
      ].join(' ')}
    >
      <Ionicons
        name={icon}
        size={14}
        color={active ? '#FFFFFF' : '#2563EB'}
      />
      <Text
        className={[
          'text-xs font-semibold ml-1',
          active ? 'text-white' : 'text-text dark:text-dark-text',
        ].join(' ')}
      >
        {label}
      </Text>
    </Pressable>
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

interface TrackEditorModalProps {
  track: MusicTrack;
  onClose: () => void;
  onSave: (updates: Partial<MusicTrack>) => void;
}

function TrackEditorModal({
  track,
  onClose,
  onSave,
}: TrackEditorModalProps): React.ReactElement {
  const [title, setTitle] = useState<string>(track.title);
  const [artist, setArtist] = useState<string>(track.artist);
  const [url, setUrl] = useState<string>(track.url);

  const handleSave = (): void => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      Alert.alert('Missing URL', 'Please paste the MP3 URL for this track.');
      return;
    }
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      Alert.alert(
        'Invalid URL',
        'The URL must start with http:// or https://.',
      );
      return;
    }
    onSave({
      title: title.trim() || 'Untitled',
      artist: artist.trim(),
      url: trimmedUrl,
    });
  };

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader
          title="Track details"
          onBack={onClose}
          rightActions={[
            {
              icon: 'checkmark-outline',
              onPress: handleSave,
              accessibilityLabel: 'Save',
            },
          ]}
        />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Card className="mb-4">
            <Input
              label="Title"
              value={title}
              onChangeText={setTitle}
              placeholder="Song title"
              containerClassName="mb-3"
            />
            <Input
              label="Artist"
              value={artist}
              onChangeText={setArtist}
              placeholder="Artist name (optional)"
              containerClassName="mb-3"
            />
            <Input
              label="Audio URL"
              value={url}
              onChangeText={setUrl}
              placeholder="https://example.com/song.mp3"
              autoCapitalize="none"
              hint="Direct link to an MP3, M4A, WAV, or OGG file."
            />
          </Card>
          <Button
            label="Save track"
            icon="checkmark-circle-outline"
            onPress={handleSave}
            fullWidth
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

interface RepoBrowserModalProps {
  initialToken: string;
  onClose: () => void;
  onImport: (files: RepoAudioFile[]) => void;
}

function RepoBrowserModal({
  initialToken,
  onClose,
  onImport,
}: RepoBrowserModalProps): React.ReactElement {
  const { colors } = useTheme();
  const [repoInput, setRepoInput] = useState<string>('');
  const [files, setFiles] = useState<RepoAudioFile[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState<boolean>(false);

  const handleFetch = useCallback(async (): Promise<void> => {
    const trimmed = repoInput.trim();
    const match = trimmed.match(
      /^(?:https?:\/\/github\.com\/)?([^/\s]+)\/([^/\s]+?)(?:\.git)?$/,
    );
    if (!match) {
      Alert.alert(
        'Invalid format',
        'Enter the repository as "owner/repo" (for example: yukee520/my-music).',
      );
      return;
    }
    const [, owner, repo] = match;
    setLoading(true);
    setError(null);
    setFiles([]);
    setSelected({});
    setSearched(false);
    try {
      const result = await listRepoAudioFiles(
        initialToken || null,
        owner,
        repo,
      );
      setFiles(result);
      setSearched(true);
      if (result.length === 0) {
        setError(
          'No audio files found at the root of this repository. Supported formats: MP3, M4A, WAV, OGG, AAC, FLAC.',
        );
      } else {
        const initialSelected: Record<string, boolean> = {};
        for (const f of result) initialSelected[f.path] = true;
        setSelected(initialSelected);
      }
    } catch (err) {
      const message =
        err instanceof GithubApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Could not load repository contents.';
      setError(message);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, [initialToken, repoInput]);

  const toggleFile = useCallback((path: string): void => {
    setSelected(prev => ({ ...prev, [path]: !prev[path] }));
  }, []);

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const handleImport = (): void => {
    const chosen = files.filter(f => selected[f.path]);
    if (chosen.length === 0) {
      Alert.alert('Nothing selected', 'Select at least one track to import.');
      return;
    }
    onImport(chosen);
  };

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader
          title="Import from GitHub"
          subtitle="Public repository, MP3 files at root"
          onBack={onClose}
          rightActions={[
            {
              icon: 'checkmark-outline',
              onPress: handleImport,
              accessibilityLabel: 'Import',
              disabled: selectedCount === 0,
            },
          ]}
        />
        <View style={{ padding: 16 }}>
          <Input
            label="Repository"
            value={repoInput}
            onChangeText={setRepoInput}
            placeholder="owner/repo (e.g., yukee520/my-music)"
            autoCapitalize="none"
            hint="Enter any public GitHub repo. Files must be at the repository root."
            containerClassName="mb-3"
          />
          <Button
            label={loading ? 'Loading…' : 'Browse files'}
            icon="search-outline"
            onPress={() => {
              void handleFetch();
            }}
            loading={loading}
            fullWidth
          />
        </View>
        <View style={{ flex: 1 }}>
          {loading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color={colors.primary} />
              <Text className="text-xs text-muted dark:text-dark-muted mt-3">
                Reading repository…
              </Text>
            </View>
          ) : error ? (
            <View className="px-6 pt-4">
              <View className="bg-danger/10 dark:bg-danger/20 rounded-xl p-3">
                <Text className="text-xs text-danger dark:text-danger">
                  {error}
                </Text>
              </View>
            </View>
          ) : searched && files.length > 0 ? (
            <FlatList
              data={files}
              keyExtractor={item => item.path}
              contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
              renderItem={({ item }) => {
                const isSelected = Boolean(selected[item.path]);
                return (
                  <Pressable
                    onPress={() => toggleFile(item.path)}
                    className={[
                      'flex-row items-center rounded-xl p-3 mb-2 border',
                      isSelected
                        ? 'bg-primary/10 dark:bg-primary/20 border-primary'
                        : 'bg-card dark:bg-dark-card border-border dark:border-dark-border',
                    ].join(' ')}
                  >
                    <View
                      className={[
                        'w-5 h-5 rounded-md border-2 items-center justify-center mr-3',
                        isSelected
                          ? 'bg-primary border-primary'
                          : 'border-border dark:border-dark-border',
                      ].join(' ')}
                    >
                      {isSelected ? (
                        <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                      ) : null}
                    </View>
                    <View className="flex-1">
                      <Text
                        className="text-sm font-semibold text-text dark:text-dark-text"
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      <Text
                        className="text-[10px] text-muted dark:text-dark-muted mt-0.5"
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                    </View>
                  </Pressable>
                );
              }}
              ListFooterComponent={
                <View className="mt-4">
                  <Button
                    label={`Import ${selectedCount} track${
                      selectedCount === 1 ? '' : 's'
                    }`}
                    icon="cloud-download-outline"
                    onPress={handleImport}
                    disabled={selectedCount === 0}
                    fullWidth
                  />
                </View>
              }
            />
          ) : (
            <View className="flex-1 items-center justify-center px-6">
              <Ionicons name="logo-github" size={40} color={colors.muted} />
              <Text className="text-xs text-muted dark:text-dark-muted mt-3 text-center">
                Enter a public GitHub repository and tap Browse files.
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}