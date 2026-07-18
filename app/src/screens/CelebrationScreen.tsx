import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RiveTutor } from '../components/RiveTutor';
import { speakStockLine, stockLines } from '../audio/tutorVoice';

// FR-2.2: every session ends with a celebration screen — end on a win.
export function CelebrationScreen({
  stars,
  onDone,
}: {
  stars: number;
  onDone: () => void;
}) {
  useEffect(() => {
    speakStockLine(stockLines.sessionEnd, () => undefined);
  }, []);

  return (
    <View style={styles.root}>
      <Text style={styles.confetti}>🎉🎊✨</Text>
      <RiveTutor state="celebrate" size={180} />
      <Text style={styles.stars}>
        {'⭐'.repeat(Math.max(1, Math.min(stars, 21)))}
      </Text>
      <Text style={styles.count}>{stars}</Text>
      <Pressable style={styles.homeBtn} onPress={onDone} accessibilityLabel="Home">
        <Text style={styles.homeText}>🏠</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFF3D6',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  confetti: { fontSize: 44 },
  stars: { fontSize: 30, textAlign: 'center', paddingHorizontal: 24 },
  count: { fontSize: 48, fontWeight: '800', color: '#F57C00' },
  homeBtn: {
    marginTop: 24,
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeText: { fontSize: 40 },
});
