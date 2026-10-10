import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@react-native-vector-icons/ionicons';
import ProjectsScreen from '@/screens/ProjectsScreen';
import PreviewScreen from '@/screens/PreviewScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import { useTheme } from '@/hooks/useTheme';
import type { TabParamList } from '@/navigation/types';

const Tab = createBottomTabNavigator<TabParamList>();

export default function TabNavigator(): React.ReactElement {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: 4,
          paddingBottom: 6,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIcon: ({ color, size, focused }) => {
          const iconName =
            route.name === 'Projects'
              ? focused
                ? 'folder-open'
                : 'folder-open-outline'
              : route.name === 'Preview'
              ? focused
                ? 'play-circle'
                : 'play-circle-outline'
              : focused
              ? 'settings'
              : 'settings-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Projects"
        component={ProjectsScreen}
        options={{ tabBarLabel: 'Projects' }}
      />
      <Tab.Screen
        name="Preview"
        component={PreviewScreen}
        options={{ tabBarLabel: 'Preview' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: 'Settings' }}
      />
    </Tab.Navigator>
  );
}