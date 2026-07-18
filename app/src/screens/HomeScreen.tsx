import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { unitBundles } from '../data/curriculum';
import { useAppStore } from '../state/appStore';

// FR-4.4: progress path map as the home screen — units as islands,
// current position marked by the character. Simplified vertical path for now.

export function HomeScreen({
  onStartSession,
  onOpenParentArea,
}: {
  onStartSession: () => void;
  onOpenParentArea: () => void;
}) {
  const completed = useAppStore((s) => s.completedActivities);
  const starsByUnit = useAppStore((s) => s.starsByUnit);
  const streak = useAppStore((s) => s.streak);

  const unitDone = (unitId: number) => {
    const bundle = unitBundles.find((b) => b.unit.id === unitId);
    return bundle ? bundle.activities.every((a) => completed[a.id]) : false;
  };

  const firstIncomplete = unitBundles.find((b) => !unitDone(b.unit.id));
  const currentUnitId = firstIncomplete?.unit.id ?? unitBundles.at(-1)?.unit.id;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>ToonTalk</Text>
        <View style={styles.headerRight}>
          <Text style={styles.streak}>🔥 {streak.current}</Text>
          <Pressable
            onPress={onOpenParentArea}
            style={styles.parentBtn}
            accessibilityLabel="Parent area"
          >
            <Text style={styles.parentBtnText}>👤</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.path}>
        {unitBundles.map((bundle, i) => {
          const done = unitDone(bundle.unit.id);
          const isCurrent = bundle.unit.id === currentUnitId;
          const locked = !done && !isCurrent;
          return (
            <View
              key={bundle.unit.id}
              style={[styles.islandRow, i % 2 === 1 && styles.islandRowAlt]}
            >
              <View
                style={[
                  styles.island,
                  done && styles.islandDone,
                  isCurrent && styles.islandCurrent,
                  locked && styles.islandLocked,
                ]}
              >
                <Text style={styles.islandEmoji}>
                  {done ? '🏆' : locked ? '🔒' : '🏝️'}
                </Text>
                <Text style={styles.islandTitle}>{bundle.unit.titleTa}</Text>
                <Text style={styles.islandSub}>{bundle.unit.titleEn}</Text>
                <Text style={styles.islandStars}>
                  ⭐ {starsByUnit[bundle.unit.id] ?? 0}
                </Text>
                {isCurrent ? <Text style={styles.kutti}>🐵</Text> : null}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* One giant voice-first start button — no reading required (NFR-5) */}
      <Pressable style={styles.playBtn} onPress={onStartSession} accessibilityLabel="Play">
        <Text style={styles.playText}>▶️</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E3F6FF' },
  header: {
    paddingTop: 56,
    paddingHorizontal: 24,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 28, fontWeight: '800', color: '#1E5AA8' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  streak: { fontSize: 22, fontWeight: '700' },
  parentBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  parentBtnText: { fontSize: 22 },
  path: { padding: 24, paddingBottom: 140, gap: 20 },
  islandRow: { alignItems: 'flex-start' },
  islandRowAlt: { alignItems: 'flex-end' },
  island: {
    width: 200,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    padding: 16,
    alignItems: 'center',
    elevation: 3,
  },
  islandDone: { backgroundColor: '#FFF8E1' },
  islandCurrent: { borderWidth: 3, borderColor: '#FF7043' },
  islandLocked: { opacity: 0.5 },
  islandEmoji: { fontSize: 40 },
  islandTitle: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  islandSub: { fontSize: 13, color: '#777' },
  islandStars: { fontSize: 15, marginTop: 6, fontWeight: '600' },
  kutti: { position: 'absolute', top: -22, right: -10, fontSize: 36 },
  playBtn: {
    position: 'absolute',
    bottom: 28,
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FF7043',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  playText: { fontSize: 44 },
});
