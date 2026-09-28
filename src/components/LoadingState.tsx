import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export default function LoadingState({
  message = 'Loading…',
  className,
}: LoadingStateProps): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View
      className={[
        'flex-1 items-center justify-center py-10 px-6',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <ActivityIndicator size="large" color={colors.primary} />
      <Text className="text-sm text-muted dark:text-dark-muted mt-3 text-center">
        {message}
      </Text>
    </View>
  );
}