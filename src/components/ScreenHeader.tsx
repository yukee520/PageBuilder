import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '@/hooks/useTheme';

export interface ScreenHeaderAction {
  icon: string;
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
}

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightActions?: ScreenHeaderAction[];
  className?: string;
}

export default function ScreenHeader({
  title,
  subtitle,
  onBack,
  rightActions,
  className,
}: ScreenHeaderProps): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View
      className={[
        'flex-row items-center px-4 py-3',
        'bg-background dark:bg-dark-background',
        'border-b border-border dark:border-dark-border',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {onBack ? (
        <Pressable
          onPress={onBack}
          className="p-1.5 -ml-1.5 mr-2 rounded-full active:bg-border dark:active:bg-dark-border"
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
      ) : null}

      <View className="flex-1">
        <Text
          className="text-lg font-semibold text-text dark:text-dark-text"
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            className="text-xs text-muted dark:text-dark-muted mt-0.5"
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {rightActions && rightActions.length > 0 ? (
        <View className="flex-row items-center">
          {rightActions.map((action, index) => (
            <Pressable
              key={`${action.icon}-${index}`}
              onPress={action.onPress}
              disabled={action.disabled}
              className={[
                'p-2 ml-1 rounded-full active:bg-border dark:active:bg-dark-border',
                action.disabled ? 'opacity-40' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              accessibilityRole="button"
              accessibilityLabel={action.accessibilityLabel ?? action.icon}
              hitSlop={8}
            >
              <Ionicons name={action.icon} size={22} color={colors.text} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}