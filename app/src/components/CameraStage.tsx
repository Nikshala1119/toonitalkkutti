import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { mockVision } from '../vision/mockProvider';
import { VisionMode, VisionResult } from '../vision/types';

// Camera activity stage (FR-3):
//  - permission requested only here, at first camera activity (FR-3.1)
//  - visible "camera on" indicator while active (FR-3.4)
//  - nothing recorded or stored (FR-3.2)
//  - onUnavailable() lets the caller swap to the tap fallback (FR-3.5)
//
// Detection currently runs through MockVisionProvider (dev overlay below the
// preview simulates stable poses). The real MediaPipe provider plugs into the
// same start/stop interface — see src/vision/types.ts.

export function CameraStage({
  mode,
  expected,
  active,
  onResult,
  onUnavailable,
}: {
  mode: VisionMode;
  /** expected answer for the dev simulator buttons */
  expected: { count?: number; color?: string };
  /** only analyze while true (i.e. phase === awaiting) */
  active: boolean;
  onResult: (r: VisionResult) => void;
  onUnavailable: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted && !asked) {
      setAsked(true);
      if (permission.canAskAgain) {
        requestPermission().then((p) => {
          if (!p.granted) onUnavailable();
        });
      } else {
        onUnavailable();
      }
    }
  }, [permission, asked, requestPermission, onUnavailable]);

  useEffect(() => {
    if (active && permission?.granted) {
      mockVision.start(mode, onResult);
      return () => mockVision.stop();
    }
  }, [active, permission?.granted, mode, onResult]);

  if (!permission?.granted) {
    return (
      <View style={[styles.stage, styles.center]}>
        <Text style={styles.waiting}>📷 …</Text>
      </View>
    );
  }

  const wrongCount = expected.count !== undefined ? (expected.count % 5) + 1 : 0;

  return (
    <View style={styles.stage}>
      <CameraView style={styles.camera} facing="front" />
      <View style={styles.indicator}>
        <View style={styles.dot} />
        <Text style={styles.indicatorText}>camera on</Text>
      </View>

      {/* DEV ONLY: simulated detections until the MediaPipe provider lands */}
      {__DEV__ && active ? (
        <View style={styles.devRow}>
          {mode === 'fingers' && expected.count !== undefined ? (
            <>
              <DevButton
                label={`✅ ${expected.count} fingers`}
                onPress={() => mockVision.simulateFingers(expected.count!)}
              />
              <DevButton
                label={`❌ ${wrongCount} fingers`}
                onPress={() => mockVision.simulateFingers(wrongCount)}
              />
            </>
          ) : null}
          {mode === 'color' && expected.color ? (
            <>
              <DevButton
                label={`✅ ${expected.color}`}
                onPress={() => mockVision.simulateColor(expected.color!)}
              />
              <DevButton
                label="❌ wrong color"
                onPress={() =>
                  mockVision.simulateColor(expected.color === 'red' ? 'blue' : 'red')
                }
              />
            </>
          ) : null}
          {mode === 'count' && expected.count !== undefined ? (
            <>
              <DevButton
                label={`✅ ${expected.count} objects`}
                onPress={() => mockVision.simulateCount(expected.count!)}
              />
              <DevButton
                label={`❌ ${wrongCount} objects`}
                onPress={() => mockVision.simulateCount(wrongCount)}
              />
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function DevButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.devBtn}>
      <Text style={styles.devBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, borderRadius: 24, overflow: 'hidden', backgroundColor: '#000' },
  camera: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  waiting: { fontSize: 40 },
  indicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF5252' },
  indicatorText: { color: '#fff', fontSize: 12 },
  devRow: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  devBtn: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  devBtnText: { fontSize: 14, fontWeight: '600' },
});
