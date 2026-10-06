import React from 'react';
import { Pressable, Text } from 'react-native';

export interface RuntimeSettingsButtonProps {
  onPress: () => void;
}

/**
 * A small semi-transparent gear button that floats in the top-right corner
 * of the screen. Tapping it opens the runtime settings sheet.
 *
 * Design choices:
 *   - 36x36 tap target, ~0.6 alpha so it's visible but doesn't fight with
 *     the page design.
 *   - Positioned absolutely; sits above all page content (rendered after
 *     RuntimeRenderer in App.tsx).
 *   - `hitSlop` extends the actual touch area to 56x56 without enlarging
 *     the visual, so it's easy to tap on small screens.
 *   - Uses a text glyph (⚙) rather than an icon library, since the runtime
 *     is not supposed to depend on `react-native-vector-icons` — that
 *     package is in the template but it's heavyweight and I'd rather keep
 *     the runtime's dependency surface small.
 */
export function RuntimeSettingsButton({
  onPress,
}: RuntimeSettingsButtonProps): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      accessibilityRole="button"
      accessibilityLabel="Settings"
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: 18,
          lineHeight: 20,
          fontWeight: '600',
        }}
      >
        ⚙
      </Text>
    </Pressable>
  );
}