import React, { useCallback, useMemo } from 'react';
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
import Card from '@/components/Card';
import Input from '@/components/Input';
import ErrorState from '@/components/ErrorState';
import { useProjectStore } from '@/store/useProjectStore';
import type { InteractionAction } from '@/types/action';
import { ACTION_TYPE_LABELS } from '@/types/action';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'ActionEdit'>;

export default function ActionEditScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { projectId, pageId, componentId, actionId } = route.params;

  const project = useProjectStore(s => s.project);
  const updateAction = useProjectStore(s => s.updateAction);
  const removeAction = useProjectStore(s => s.removeAction);
  const moveAction = useProjectStore(s => s.moveAction);

  const page = useMemo(
    () => project?.pages.find(p => p.id === pageId) ?? null,
    [project, pageId],
  );

  const component = useMemo(
    () => page?.components.find(c => c.id === componentId) ?? null,
    [page, componentId],
  );

  const action = useMemo<InteractionAction | null>(
    () => component?.actions.find(a => a.id === actionId) ?? null,
    [actionId, component],
  );

  const patch = useCallback(
    (update: Partial<InteractionAction>): void => {
      updateAction(pageId, componentId, actionId, update);
    },
    [actionId, componentId, pageId, updateAction],
  );

  const handleDelete = useCallback((): void => {
    if (!action) return;
    Alert.alert(
      'Remove action?',
      `"${ACTION_TYPE_LABELS[action.type]}" will be removed from this component.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removeAction(pageId, componentId, actionId);
            Toast.show({ type: 'success', text1: 'Action removed' });
            navigation.goBack();
          },
        },
      ],
    );
  }, [action, actionId, componentId, navigation, pageId, removeAction]);

  if (!project || !page || !component) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader title="Edit Action" onBack={() => navigation.goBack()} />
        <ErrorState message="Component or page not found." />
      </SafeAreaView>
    );
  }

  if (!action) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader title="Edit Action" onBack={() => navigation.goBack()} />
        <ErrorState message="Action not found. It may have been deleted." />
      </SafeAreaView>
    );
  }

  const otherPages = project.pages.filter(p => p.id !== pageId);
  const otherComponents = page.components.filter(c => c.id !== componentId);

  return (
    <SafeAreaView
      className="flex-1 bg-background dark:bg-dark-background"
      edges={['top', 'left', 'right']}
    >
      <ScreenHeader
        title={ACTION_TYPE_LABELS[action.type]}
        subtitle="Configure what happens on tap"
        onBack={() => navigation.goBack()}
        rightActions={[
          {
            icon: 'trash-outline',
            onPress: handleDelete,
            accessibilityLabel: 'Delete action',
          },
        ]}
      />

      <FlatList
        data={[action]}
        keyExtractor={a => a.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        renderItem={() => (
          <View>
            <Card className="mb-4">
              <Text className="text-base font-semibold text-text dark:text-dark-text mb-3">
                Settings
              </Text>
              {renderEditor(action, patch)}
            </Card>

            <Card className="mb-4">
              <Text className="text-sm font-semibold text-text dark:text-dark-text mb-2">
                Order
              </Text>
              <Text className="text-xs text-muted dark:text-dark-muted mb-3">
                Actions run in order from top to bottom when the user taps.
              </Text>
              <View className="flex-row">
                <Pressable
                  onPress={() =>
                    moveAction(pageId, componentId, actionId, 'up')
                  }
                  className="flex-row items-center px-3 py-2 rounded-lg bg-card dark:bg-dark-card border border-border dark:border-dark-border mr-2 active:opacity-70"
                  accessibilityRole="button"
                >
                  <Ionicons name="arrow-up-outline" size={16} color="#2563EB" />
                  <Text className="text-xs font-semibold text-primary ml-1">
                    Move up
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    moveAction(pageId, componentId, actionId, 'down')
                  }
                  className="flex-row items-center px-3 py-2 rounded-lg bg-card dark:bg-dark-card border border-border dark:border-dark-border active:opacity-70"
                  accessibilityRole="button"
                >
                  <Ionicons
                    name="arrow-down-outline"
                    size={16}
                    color="#2563EB"
                  />
                  <Text className="text-xs font-semibold text-primary ml-1">
                    Move down
                  </Text>
                </Pressable>
              </View>
            </Card>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function renderEditor(
  action: InteractionAction,
  patch: (update: Partial<InteractionAction>) => void,
): React.ReactElement {
  switch (action.type) {
    case 'navigate':
      return <NavigateEditor action={action} patch={patch} />;
    case 'openUrl':
      return (
        <Input
          label="URL"
          value={action.url}
          onChangeText={value => patch({ url: value })}
          placeholder="https://example.com"
          autoCapitalize="none"
          keyboardType="url"
        />
      );
    case 'showAlert':
      return (
        <>
          <Input
            label="Title"
            value={action.title}
            onChangeText={value => patch({ title: value })}
            placeholder="Notice"
            containerClassName="mb-3"
          />
          <Input
            label="Message"
            value={action.message}
            onChangeText={value => patch({ message: value })}
            placeholder="Something happened"
            multiline
          />
        </>
      );
    case 'playVideo':
      return (
        <Input
          label="Video URL"
          value={action.url}
          onChangeText={value => patch({ url: value })}
          placeholder="https://..."
          autoCapitalize="none"
          keyboardType="url"
        />
      );
    case 'toggleVisibility':
      return <ToggleVisibilityEditor action={action} patch={patch} />;
    case 'setVariable':
      return (
        <>
          <Input
            label="Variable key"
            value={action.key}
            onChangeText={value => patch({ key: value })}
            placeholder="username"
            autoCapitalize="none"
            containerClassName="mb-3"
          />
          <Input
            label="Value"
            value={action.value}
            onChangeText={value => patch({ value })}
            placeholder="Hello"
          />
        </>
      );
    case 'goBack':
      return (
        <Text className="text-xs text-muted dark:text-dark-muted">
          This action will return to the previous page. No configuration needed.
        </Text>
      );
  }
}

function NavigateEditor({
  action,
  patch,
}: {
  action: Extract<InteractionAction, { type: 'navigate' }>;
  patch: (update: Partial<InteractionAction>) => void;
}): React.ReactElement {
  const project = useProjectStore(s => s.project);
  const pages = project?.pages ?? [];

  if (pages.length === 0) {
    return (
      <Text className="text-xs text-muted dark:text-dark-muted">
        No pages available. Add a page first.
      </Text>
    );
  }

  return (
    <View>
      <Text className="text-xs font-semibold text-text dark:text-dark-text mb-2">
        Target page
      </Text>
      {pages.map(p => {
        const active = action.pageId === p.id;
        return (
          <Pressable
            key={p.id}
            onPress={() => patch({ pageId: p.id })}
            className={[
              'flex-row items-center py-2 px-3 rounded-lg mb-1.5 border',
              active
                ? 'bg-primary/10 dark:bg-primary/20 border-primary'
                : 'bg-card dark:bg-dark-card border-border dark:border-dark-border',
            ].join(' ')}
            accessibilityRole="button"
          >
            <Ionicons
              name={active ? 'radio-button-on' : 'radio-button-off'}
              size={16}
              color={active ? '#2563EB' : '#94A3B8'}
            />
            <Text
              className={[
                'ml-2 text-sm',
                active
                  ? 'text-primary font-semibold'
                  : 'text-text dark:text-dark-text',
              ].join(' ')}
            >
              {p.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ToggleVisibilityEditor({
  action,
  patch,
}: {
  action: Extract<InteractionAction, { type: 'toggleVisibility' }>;
  patch: (update: Partial<InteractionAction>) => void;
}): React.ReactElement {
  const project = useProjectStore(s => s.project);
  const pages = project?.pages ?? [];

  const options = useMemo(() => {
    const list: { id: string; label: string }[] = [];
    for (const page of pages) {
      for (const c of page.components) {
        list.push({
          id: c.id,
          label: `${page.title} → ${c.type}`,
        });
      }
    }
    return list;
  }, [pages]);

  if (options.length === 0) {
    return (
      <Text className="text-xs text-muted dark:text-dark-muted">
        No components available to toggle.
      </Text>
    );
  }

  return (
    <View>
      <Text className="text-xs font-semibold text-text dark:text-dark-text mb-2">
        Target component
      </Text>
      {options.map(opt => {
        const active = action.targetComponentId === opt.id;
        return (
          <Pressable
            key={opt.id}
            onPress={() => patch({ targetComponentId: opt.id })}
            className={[
              'flex-row items-center py-2 px-3 rounded-lg mb-1.5 border',
              active
                ? 'bg-primary/10 dark:bg-primary/20 border-primary'
                : 'bg-card dark:bg-dark-card border-border dark:border-dark-border',
            ].join(' ')}
            accessibilityRole="button"
          >
            <Ionicons
              name={active ? 'radio-button-on' : 'radio-button-off'}
              size={16}
              color={active ? '#2563EB' : '#94A3B8'}
            />
            <Text
              className={[
                'ml-2 text-sm',
                active
                  ? 'text-primary font-semibold'
                  : 'text-text dark:text-dark-text',
              ].join(' ')}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}