import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
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
import Card from '@/components/Card';
import Input from '@/components/Input';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import { useProjectStore } from '@/store/useProjectStore';
import { useTheme } from '@/hooks/useTheme';
import type {
  ActionType,
  InteractionAction,
} from '@/types/action';
import { ACTION_TYPE_ICONS, ACTION_TYPE_LABELS } from '@/types/action';
import type {
  ButtonComponent,
  DividerComponent,
  HorizontalAlign,
  ImageComponent,
  InputComponent,
  PageComponent,
  SizePreset,
  SpacerComponent,
  TextComponent,
  VideoComponent,
} from '@/types/component';
import type { RootStackParamList } from '@/navigation/types';

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
];

export default function ComponentEditScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { projectId, pageId, componentId } = route.params;
  const { colors } = useTheme();

  const project = useProjectStore(s => s.project);
  const updateComponent = useProjectStore(s => s.updateComponent);
  const removeComponent = useProjectStore(s => s.removeComponent);
  const moveComponent = useProjectStore(s => s.moveComponent);
  const addAction = useProjectStore(s => s.addAction);
  const removeAction = useProjectStore(s => s.removeAction);

  const [showActionPicker, setShowActionPicker] = useState<boolean>(false);

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
              {renderContentEditor(component, patch, colors)}
            </Card>

            <Card className="mb-4">
              <Text className="text-base font-semibold text-text dark:text-dark-text mb-3">
                Appearance
              </Text>
              {renderAppearanceEditor(component, patch, colors)}
            </Card>

            <Card className="mb-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-sm font-semibold text-text dark:text-dark-text">
                    Visible
                  </Text>
                  <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
                    Hidden components won't show during preview or in the built APK.
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
                Position
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
                  No actions yet. Add one to make this component interactive.
                </Text>
              </View>
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
  }
}

function renderContentEditor(
  c: PageComponent,
  patch: (update: Partial<PageComponent>) => void,
  colors: ReturnType<typeof useTheme>['colors'],
): React.ReactElement {
  switch (c.type) {
    case 'text':
      return (
        <Input
          label="Text content"
          value={c.content}
          onChangeText={value => patch({ content: value } as Partial<TextComponent>)}
          placeholder="Enter your text"
          multiline
        />
      );
    case 'image':
      return (
        <Input
          label="Image URL"
          value={c.uri}
          onChangeText={value => patch({ uri: value } as Partial<ImageComponent>)}
          placeholder="https://example.com/image.jpg"
          autoCapitalize="none"
          hint="You can also pick a local image from the gallery in a future update."
        />
      );
    case 'video':
      return (
        <>
          <Input
            label="Video URL"
            value={c.url}
            onChangeText={value => patch({ url: value } as Partial<VideoComponent>)}
            placeholder="https://www.youtube.com/watch?v=..."
            autoCapitalize="none"
            containerClassName="mb-3"
          />
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-text dark:text-dark-text">
              Autoplay
            </Text>
            <Switch
              value={c.autoPlay}
              onValueChange={value =>
                patch({ autoPlay: value } as Partial<VideoComponent>)
              }
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </>
      );
    case 'button':
      return (
        <Input
          label="Button label"
          value={c.label}
          onChangeText={value => patch({ label: value } as Partial<ButtonComponent>)}
          placeholder="Tap me"
        />
      );
    case 'spacer':
      return (
        <Text className="text-xs text-muted dark:text-dark-muted">
          Adjust the size in the Appearance section.
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
          This is a row container. Child components inside rows are managed on the
          canvas.
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
  }
}

function renderAppearanceEditor(
  c: PageComponent,
  patch: (update: Partial<PageComponent>) => void,
  colors: ReturnType<typeof useTheme>['colors'],
): React.ReactElement {
  switch (c.type) {
    case 'text':
      return (
        <>
          <Text className="text-xs font-semibold text-text dark:text-dark-text mb-2">
            Size
          </Text>
          <SizeRow
            value={c.fontSize}
            onChange={value => patch({ fontSize: value } as Partial<TextComponent>)}
          />
          <View className="h-3" />
          <Text className="text-xs font-semibold text-text dark:text-dark-text mb-2">
            Align
          </Text>
          <AlignRow
            value={c.align}
            onChange={value => patch({ align: value } as Partial<TextComponent>)}
          />
          <View className="h-3" />
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-text dark:text-dark-text">Bold</Text>
            <Switch
              value={c.bold}
              onValueChange={value => patch({ bold: value } as Partial<TextComponent>)}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </>
      );
    case 'image':
      return (
        <>
          <Text className="text-xs font-semibold text-text dark:text-dark-text mb-2">
            Size
          </Text>
          <SizeRow
            value={c.size}
            onChange={value => patch({ size: value } as Partial<ImageComponent>)}
          />
          <View className="h-3" />
          <View className="flex-row items-center justify-between">
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
        </>
      );
    case 'button':
      return (
        <>
          <Text className="text-xs font-semibold text-text dark:text-dark-text mb-2">
            Size
          </Text>
          <SizeRow
            value={c.size}
            onChange={value => patch({ size: value } as Partial<ButtonComponent>)}
          />
          <View className="h-3" />
          <Text className="text-xs font-semibold text-text dark:text-dark-text mb-2">
            Align
          </Text>
          <AlignRow
            value={c.align}
            onChange={value => patch({ align: value } as Partial<ButtonComponent>)}
          />
        </>
      );
    case 'spacer':
      return (
        <>
          <Text className="text-xs font-semibold text-text dark:text-dark-text mb-2">
            Size
          </Text>
          <SizeRow
            value={c.size}
            onChange={value => patch({ size: value } as Partial<SpacerComponent>)}
          />
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
    case 'video':
    case 'row':
    case 'input':
      return (
        <Text className="text-xs text-muted dark:text-dark-muted">
          No appearance options for this component yet.
        </Text>
      );
  }
}

function SizeRow({
  value,
  onChange,
}: {
  value: SizePreset;
  onChange: (v: SizePreset) => void;
}): React.ReactElement {
  return (
    <View className="flex-row flex-wrap">
      {SIZE_PRESETS.map(s => {
        const active = value === s;
        return (
          <Pressable
            key={s}
            onPress={() => onChange(s)}
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
  );
}

function AlignRow({
  value,
  onChange,
}: {
  value: HorizontalAlign;
  onChange: (v: HorizontalAlign) => void;
}): React.ReactElement {
  return (
    <View className="flex-row">
      {ALIGN_OPTIONS.map(a => {
        const active = value === a;
        return (
          <Pressable
            key={a}
            onPress={() => onChange(a)}
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
  );
}