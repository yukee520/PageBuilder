import React from 'react';
import { Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Button from '@/components/Button';
import { useTheme } from '@/hooks/useTheme';

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export default function EmptyState({
  icon = 'cube-outline',
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View
      className={[
        'flex-1 items-center justify-center py-12 px-6',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <View className="bg-primary/10 dark:bg-primary/20 rounded-full p-5 mb-4">
        <Ionicons name={icon} size={36} color={colors.primary} />
      </View>
      <Text className="text-lg font-semibold text-text dark:text-dark-text text-center">
        {title}
      </Text>
      {description ? (
        <Text className="text-sm text-muted dark:text-dark-muted mt-2 text-center">
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View className="mt-5">
          <Button label={actionLabel} onPress={onAction} icon="add-outline" />
        </View>
      ) : null}
    </View>
  );
}