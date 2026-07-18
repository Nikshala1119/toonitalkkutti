import React from 'react';
import { Text, View, ViewStyle } from 'react-native';

// Placeholder art: curriculum `image` keys render as colored tiles / emoji
// until illustrated assets exist. Keys are stable — swapping in real art is
// a registry-only change.

interface AssetDef {
  emoji?: string;
  repeat?: number;
  bg: string;
}

const ASSETS: Record<string, AssetDef> = {
  swatch_red: { bg: '#E53935' },
  swatch_blue: { bg: '#1E88E5' },
  swatch_yellow: { bg: '#FDD835' },
  swatch_green: { bg: '#43A047' },
  apple_red: { emoji: '🍎', bg: '#FFF3F2' },
  banana_yellow: { emoji: '🍌', bg: '#FFFDE9' },
  ball_blue: { emoji: '🔵', bg: '#EFF6FF' },
  leaf_green: { emoji: '🍃', bg: '#F1FFF2' },
  balls_1: { emoji: '⚽', repeat: 1, bg: '#F5F5F5' },
  balls_3: { emoji: '⚽', repeat: 3, bg: '#F5F5F5' },
  apples_2: { emoji: '🍎', repeat: 2, bg: '#FFF7F6' },
  apples_3: { emoji: '🍎', repeat: 3, bg: '#FFF7F6' },
  apples_5: { emoji: '🍎', repeat: 5, bg: '#FFF7F6' },
  stars_1: { emoji: '⭐', repeat: 1, bg: '#FFFBEB' },
  stars_3: { emoji: '⭐', repeat: 3, bg: '#FFFBEB' },
  stars_4: { emoji: '⭐', repeat: 4, bg: '#FFFBEB' },
  fingers_1: { emoji: '☝️', bg: '#F3F0FF' },
  fingers_2: { emoji: '✌️', bg: '#F3F0FF' },
  fingers_3: { emoji: '🤟', bg: '#F3F0FF' },
  fingers_4: { emoji: '🖖', bg: '#F3F0FF' },
  fingers_5: { emoji: '🖐️', bg: '#F3F0FF' },
};

export function AssetTile({ assetKey, style }: { assetKey: string; style?: ViewStyle }) {
  const def = ASSETS[assetKey] ?? { emoji: '❓', bg: '#EEEEEE' };
  return (
    <View
      style={[
        {
          backgroundColor: def.bg,
          borderRadius: 24,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          flexWrap: 'wrap',
          padding: 8,
        },
        style,
      ]}
    >
      {def.emoji ? (
        Array.from({ length: def.repeat ?? 1 }).map((_, i) => (
          <Text key={i} style={{ fontSize: (def.repeat ?? 1) > 3 ? 30 : 44 }}>
            {def.emoji}
          </Text>
        ))
      ) : null}
    </View>
  );
}
