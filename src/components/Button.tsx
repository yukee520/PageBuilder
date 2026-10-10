import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '@/hooks/useTheme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
}

const CONTAINER_BY_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-primary dark:bg-primary',
  secondary:
    'bg-card dark:bg-dark-card border border-border dark:border-dark-border',
  danger: 'bg-danger dark:bg-danger',
  ghost: 'bg-transparent',
};

const TEXT_BY_VARIANT: Record<ButtonVariant, string> = {
  primary: 'text-white dark:text-white',
  secondary: 'text-text dark:text-dark-text',
  danger: 'text-white dark:text-white',
  ghost: 'text-primary dark:text-primary',
};

const SIZE_BY_SIZE: Record<ButtonSize, string> = {
  small: 'px-3 py-1.5 rounded-lg',
  medium: 'px-4 py-2.5 rounded-xl',
  large: 'px-6 py-3.5 rounded-2xl',
};

const TEXT_SIZE_BY_SIZE: Record<ButtonSize, string> = {
  small: 'text-sm',
  medium: 'text-base',
  large: 'text-lg',
};

const ICON_SIZE_BY_SIZE: Record<ButtonSize, number> = {
  small: 16,
  medium: 18,
  large: 20,
};

export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'medium',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = false,
  className,
}: ButtonProps): React.ReactElement {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const iconColor =
    variant === 'primary' || variant === 'danger'
      ? '#FFFFFF'
      : variant === 'ghost'
      ? colors.primary
      : colors.text;

  const content = (
    <View className="flex-row items-center justify-center">
      {loading ? (
        <ActivityIndicator
          size="small"
          color={iconColor}
          style={{ marginRight: label ? 8 : 0 }}
        />
      ) : icon && iconPosition === 'left' ? (
        <Ionicons
          name={icon}
          size={ICON_SIZE_BY_SIZE[size]}
          color={iconColor}
          style={{ marginRight: 8 }}
        />
      ) : null}
      <Text
        className={`${TEXT_BY_VARIANT[variant]} ${TEXT_SIZE_BY_SIZE[size]} font-semibold`}
        numberOfLines={1}
      >
        {label}
      </Text>
      {!loading && icon && iconPosition === 'right' ? (
        <Ionicons
          name={icon}
          size={ICON_SIZE_BY_SIZE[size]}
          color={iconColor}
          style={{ marginLeft: 8 }}
        />
      ) : null}
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={[
        CONTAINER_BY_VARIANT[variant],
        SIZE_BY_SIZE[size],
        fullWidth ? 'w-full' : 'self-start',
        isDisabled ? 'opacity-50' : 'active:opacity-80',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={label}
    >
      {content}
    </Pressable>
  );
}