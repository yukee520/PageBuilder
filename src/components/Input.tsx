import React from 'react';
import {
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string | null;
  hint?: string;
  containerClassName?: string;
}

export default function Input({
  label,
  error,
  hint,
  containerClassName,
  multiline,
  ...rest
}: InputProps): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View className={['w-full', containerClassName ?? ''].filter(Boolean).join(' ')}>
      {label ? (
        <Text className="text-sm font-semibold text-text dark:text-dark-text mb-1.5">
          {label}
        </Text>
      ) : null}
      <TextInput
        {...rest}
        multiline={multiline}
        placeholderTextColor={colors.muted}
        className={[
          'bg-card dark:bg-dark-card',
          'border rounded-xl px-3 py-2.5',
          'text-text dark:text-dark-text text-base',
          error
            ? 'border-danger dark:border-danger'
            : 'border-border dark:border-dark-border',
          multiline ? 'min-h-[88px] text-top' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={multiline ? { textAlignVertical: 'top' } : undefined}
      />
      {error ? (
        <Text className="text-xs text-danger dark:text-danger mt-1">
          {error}
        </Text>
      ) : hint ? (
        <Text className="text-xs text-muted dark:text-dark-muted mt-1">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}