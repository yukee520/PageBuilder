import React from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { Page } from '@/types/project';
import { useTheme } from '@/hooks/useTheme';

export interface PageTabBarProps {
  pages: Page[];
  activePageId: string | null;
  onSelectPage: (pageId: string) => void;
  onAddPage: () => void;
  onManagePages: () => void;
}

export default function PageTabBar({
  pages,
  activePageId,
  onSelectPage,
  onAddPage,
  onManagePages,
}: PageTabBarProps): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View className="bg-background dark:bg-dark-background border-b border-border dark:border-dark-border">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10 }}
      >
        {pages.map(page => {
          const active = page.id === activePageId;
          return (
            <Pressable
              key={page.id}
              onPress={() => onSelectPage(page.id)}
              className={[
                'px-3 py-2 rounded-lg mr-2 flex-row items-center',
                active
                  ? 'bg-primary'
                  : 'bg-card dark:bg-dark-card border border-border dark:border-dark-border',
              ].join(' ')}
              accessibilityRole="button"
            >
              <Ionicons
                name="document-text-outline"
                size={14}
                color={active ? '#FFFFFF' : colors.text}
                style={{ marginRight: 6 }}
              />
              <Text
                className={[
                  'text-xs font-semibold max-w-[120px]',
                  active
                    ? 'text-white'
                    : 'text-text dark:text-dark-text',
                ].join(' ')}
                numberOfLines={1}
              >
                {page.title}
              </Text>
            </Pressable>
          );
        })}

        <Pressable
          onPress={onAddPage}
          className="px-3 py-2 rounded-lg mr-2 flex-row items-center bg-card dark:bg-dark-card border border-dashed border-border dark:border-dark-border"
          accessibilityRole="button"
          accessibilityLabel="Add page"
        >
          <Ionicons name="add" size={14} color={colors.primary} />
          <Text className="text-xs font-semibold text-primary ml-1">
            New page
          </Text>
        </Pressable>

        <Pressable
          onPress={onManagePages}
          className="px-3 py-2 rounded-lg flex-row items-center bg-card dark:bg-dark-card border border-border dark:border-dark-border"
          accessibilityRole="button"
          accessibilityLabel="Manage pages"
        >
          <Ionicons name="settings-outline" size={14} color={colors.text} />
        </Pressable>
      </ScrollView>
    </View>
  );
}