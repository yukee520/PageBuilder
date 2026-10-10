import React from 'react';
import { Text, View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import Button from '@/components/Button';
import { useTheme } from '@/hooks/useTheme';

export interface ErrorStateProps {
  message: string;
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export default function ErrorState({
  message,
  title = 'Something went wrong',
  onRetry,
  retryLabel = 'Try again',
  className,
}: ErrorStateProps): React.ReactElement {
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
      <View className="bg-danger/10 dark:bg-danger/20 rounded-full p-4 mb-4">
        <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
      </View>
      <Text className="text-lg font-semibold text-text dark:text-dark-text text-center">
        {title}
      </Text>
      <Text className="text-sm text-muted dark:text-dark-muted mt-2 text-center">
        {message}
      </Text>
      {onRetry ? (
        <View className="mt-5">
          <Button
            label={retryLabel}
            onPress={onRetry}
            variant="primary"
            icon="refresh-outline"
          />
        </View>
      ) : null}
    </View>
  );
}