import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useAppStore } from '../state/appStore';
import { syncAttempts } from '../state/attemptQueue';
import { signOutParent } from '../data/auth';
import { supabase } from '../data/supabase';

// Minimal in-app parent area (behind the math gate — FR-5.2).
// Controls per FR-6.6; the full web dashboard is a separate Phase-2 build.

export function ParentAreaScreen({ onClose }: { onClose: () => void }) {
  const s = useAppStore();
  const [syncState, setSyncState] = useState<string>('');
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    if (!supabase) {
      setSignedIn(false);
      return;
    }
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, []);

  const runSync = async () => {
    setSyncState('syncing…');
    const r = await syncAttempts();
    setSyncState(`synced ${r.synced}, pending ${r.pending}`);
  };

  const masteredCount = Object.values(s.skills).filter((k) => k.mastered).length;
  const learningCount = Object.values(s.skills).filter((k) => !k.mastered).length;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Parent area</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{s.childNickname ?? 'Child'}</Text>
          <Text style={styles.stat}>🔥 Streak: {s.streak.current} days (best {s.streak.longest})</Text>
          <Text style={styles.stat}>
            ⭐ Stars: {Object.values(s.starsByUnit).reduce((a, b) => a + b, 0)}
          </Text>
          <Text style={styles.stat}>
            📚 Skills: {masteredCount} mastered, {learningCount} learning
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Controls</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Camera activities</Text>
            <Switch value={s.cameraEnabled} onValueChange={s.setCameraEnabled} />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Daily limit: {s.dailyLimitMinutes} min</Text>
            <View style={styles.stepRow}>
              <Pressable
                style={styles.stepBtn}
                onPress={() => s.setDailyLimit(Math.max(5, s.dailyLimitMinutes - 5))}
              >
                <Text style={styles.stepText}>−</Text>
              </Pressable>
              <Pressable
                style={styles.stepBtn}
                onPress={() => s.setDailyLimit(Math.min(120, s.dailyLimitMinutes + 5))}
              >
                <Text style={styles.stepText}>+</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account & sync</Text>
          <Text style={styles.stat}>
            {signedIn === null
              ? '…'
              : signedIn
                ? `Signed in · cloud sync ${s.serverChildId ? 'active' : 'not linked'}`
                : 'Local-only mode (no account)'}
          </Text>
          {signedIn ? (
            <>
              <Pressable style={styles.btnSmall} onPress={runSync}>
                <Text style={styles.btnSmallText}>Sync now</Text>
              </Pressable>
              {syncState ? <Text style={styles.stat}>{syncState}</Text> : null}
              <Pressable
                style={[styles.btnSmall, styles.btnDanger]}
                onPress={async () => {
                  await signOutParent();
                  setSignedIn(false);
                }}
              >
                <Text style={styles.btnSmallText}>Sign out</Text>
              </Pressable>
            </>
          ) : null}
        </View>

        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>Back to {s.childNickname ?? 'child'} 🏝️</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6F8' },
  scroll: { padding: 24, paddingTop: 56, gap: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#333' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 18, gap: 10 },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  stat: { fontSize: 15, color: '#444' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 15 },
  stepRow: { flexDirection: 'row', gap: 8 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: 22, fontWeight: '700', color: '#1E88E5' },
  btnSmall: {
    backgroundColor: '#1E88E5',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnDanger: { backgroundColor: '#B0BEC5' },
  btnSmallText: { color: '#fff', fontWeight: '700' },
  closeBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  closeText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
