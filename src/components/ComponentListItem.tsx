import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import type { PageComponent } from '@/types/component';
import { COMPONENT_TYPE_ICONS } from '@/types/component';
import { describeComponent } from '@/utils/format';
import { useTheme } from '@/hooks/useTheme';

export interface ComponentListItemProps {
  component: PageComponent;
  onPress: () => void;
  onLongPress?: () => void;
  onToggleVisibility: () => void;
  isActive?: boolean;
  drag?: () => void;
  isDragging?: boolean;
}

export default function ComponentListItem({
  component,
  onPress,
  onLongPress,
  onToggleVisibility,
  isActive = false,
  drag,
  isDragging = false,
}: ComponentListItemProps): React.ReactElement {
  const { colors } = useTheme();

  const iconName = COMPONENT_TYPE_ICONS[component.type];
  const summary = describeComponent(component);
  const isHidden = !component.visible;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress ?? drag}
      delayLongPress={220}
      className={[
        'flex-row items-center px-3 py-3 rounded-xl mb-2',
        'border',
        isActive
          ? 'bg-primary/10 dark:bg-primary/20 border-primary dark:border-primary'
          : 'bg-card dark:bg-dark-card border-border dark:border-dark-border',
        isDragging ? 'opacity-80' : '',
        isHidden ? 'opacity-50' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      accessibilityRole="button"
    >
      <Pressable
        onLongPress={drag}
        delayLongPress={180}
        hitSlop={8}
        className="pr-2"
        accessibilityRole="button"
        accessibilityLabel="Drag to reorder"
      >
        <Ionicons name="reorder-three-outline" size={22} color={colors.muted} />
      </Pressable>

      <View
        className={[
          'w-9 h-9 rounded-lg items-center justify-center mr-3',
          isActive
            ? 'bg-primary'
            : 'bg-border dark:bg-dark-border',
        ].join(' ')}
      >
        <Ionicons
          name={iconName}
          size={18}
          color={isActive ? '#FFFFFF' : colors.text}
        />
      </View>

      <View className="flex-1">
        <Text
          className="text-sm font-semibold text-text dark:text-dark-text"
          numberOfLines={1}
        >
          {component.type.toUpperCase()}
        </Text>
        <Text
          className="text-xs text-muted dark:text-dark-muted mt-0.5"
          numberOfLines={1}
        >
          {summary}
        </Text>
      </View>

      <Pressable
        onPress={onToggleVisibility}
        hitSlop={8}
        className="p-2"
        accessibilityRole="button"
        accessibilityLabel={
          component.visible ? 'Hide component' : 'Show component'
        }
      >
        <Ionicons
          name={component.visible ? 'eye-outline' : 'eye-off-outline'}
          size={18}
          color={colors.muted}
        />
      </Pressable>

      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}