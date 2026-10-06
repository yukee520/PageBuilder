import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TabNavigator from '@/navigation/TabNavigator';
import EditorScreen from '@/screens/EditorScreen';
import ComponentEditScreen from '@/screens/ComponentEditScreen';
import ActionEditScreen from '@/screens/ActionEditScreen';
import PreviewScreen from '@/screens/PreviewScreen';
import ProjectSettingsScreen from '@/screens/ProjectSettingsScreen';
import PageSettingsScreen from '@/screens/PageSettingsScreen';
import BuildScreen from '@/screens/BuildScreen';
import { useTheme } from '@/hooks/useTheme';
import type { RootStackParamList } from '@/navigation/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator(): React.ReactElement {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen name="Editor" component={EditorScreen} />
      <Stack.Screen name="ComponentEdit" component={ComponentEditScreen} />
      <Stack.Screen name="ActionEdit" component={ActionEditScreen} />
      <Stack.Screen
        name="Preview"
        component={PreviewScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="ProjectSettings" component={ProjectSettingsScreen} />
      <Stack.Screen name="PageSettings" component={PageSettingsScreen} />
      <Stack.Screen
        name="Build"
        component={BuildScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  );
}