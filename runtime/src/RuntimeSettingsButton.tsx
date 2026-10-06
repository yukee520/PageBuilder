import React from 'react';
import { Pressable, Text, View } from 'react-native';

export interface RuntimeSettingsButtonProps {
  onPress: () => void;
}

/**
 * A small pill-shaped settings button that floats in the top-right corner.
 *
 * Design:
 *   - 40x40 rounded (radius 20), light frosted-glass look.
 *   - Semi-transparent white backdrop with a thin border, so it reads as a
 *     control on any background without stealing attention.
 *   - Uses the ⚙ glyph; swap for an icon component if you prefer.
 *   - `hitSlop` extends the tap area beyond the visual for easier tapping.
 */
export function RuntimeSettingsButton({
  onPress,
}: RuntimeSettingsButtonProps): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={{
        position: 'absolute',
        top: 14,
        right: 14,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.75)',
        borderWidth: 1,
        borderColor: 'rgba(15, 23, 42, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        // Soft shadow for depth. iOS uses shadow*, Android uses elevation.
        shadowColor: '#0F172A',
        shadowOpacity: 0.15,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      }}
      accessibilityRole="button"
      accessibilityLabel="Settings"
    >
      <View
        style={{
          width: 20,
          height: 20,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: '#334155',
            fontSize: 17,
            lineHeight: 20,
            fontWeight: '500',
            // Center the glyph vertically. Different platforms render ⚙
            // with slightly different baselines.
            includeFontPadding: false,
            textAlign: 'center',
          }}
        >
          ⚙
        </Text>
      </View>
    </Pressable>
  );
}