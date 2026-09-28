import { useColorScheme } from 'react-native';

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  card: string;
  text: string;
  muted: string;
  danger: string;
  success: string;
  border: string;
}

export const LIGHT_COLORS: ThemeColors = {
  primary: '#2563EB',
  secondary: '#64748B',
  background: '#F8FAFC',
  card: '#FFFFFF',
  text: '#0F172A',
  muted: '#94A3B8',
  danger: '#EF4444',
  success: '#10B981',
  border: '#E2E8F0',
};

export const DARK_COLORS: ThemeColors = {
  primary: '#3B82F6',
  secondary: '#94A3B8',
  background: '#0F172A',
  card: '#1E293B',
  text: '#F1F5F9',
  muted: '#64748B',
  danger: '#F87171',
  success: '#34D399',
  border: '#334155',
};

export interface UseThemeResult {
  isDark: boolean;
  colors: ThemeColors;
}

export function useTheme(): UseThemeResult {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return {
    isDark,
    colors: isDark ? DARK_COLORS : LIGHT_COLORS,
  };
}