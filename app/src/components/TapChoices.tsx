import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { TapPayload } from '../types/curriculum';
import { AssetTile } from './assetRegistry';

// Large touch targets (NFR-5: minimum 64 dp; these are far larger).
export function TapChoices({
  payload,
  disabled,
  onPick,
}: {
  payload: TapPayload;
  disabled?: boolean;
  onPick: (choiceId: string) => void;
}) {
  return (
    <View style={styles.grid}>
      {payload.choices.map((c) => (
        <Pressable
          key={c.id}
          disabled={disabled}
          onPress={() => onPick(c.id)}
          style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={c.id}
        >
          <AssetTile assetKey={c.image} style={styles.tile} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    padding: 16,
  },
  cell: { width: 150, height: 150 },
  tile: { flex: 1 },
  pressed: { transform: [{ scale: 0.94 }] },
});
