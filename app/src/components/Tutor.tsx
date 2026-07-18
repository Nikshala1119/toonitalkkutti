import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

// Placeholder for the Rive-rigged "Kutti" character (FR-1.1).
// Rive (rive-react-native) needs a dev build — it will replace this component
// behind the same `state` prop, so screens won't change.
// States mirror the planned Rive state machine: idle, talk, listen,
// celebrate, encourage, demonstrate, sleep.

export type TutorState =
  | 'idle'
  | 'talk'
  | 'listen'
  | 'celebrate'
  | 'encourage'
  | 'demonstrate'
  | 'sleep';

const FACES: Record<TutorState, string> = {
  idle: '🐵',
  talk: '🗣️🐵',
  listen: '🐵👂',
  celebrate: '🥳',
  encourage: '🐵💪',
  demonstrate: '🐵👉',
  sleep: '😴',
};

export function Tutor({ state, size = 120 }: { state: TutorState; size?: number }) {
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    bounce.setValue(0);
    const active = state === 'talk' || state === 'celebrate';
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: 1,
          duration: state === 'celebrate' ? 220 : 380,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: state === 'celebrate' ? 220 : 380,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [state, bounce]);

  const translateY = bounce.interpolate({
    inputRange: [0, 1],
    outputRange: [0, state === 'celebrate' ? -18 : -6],
  });

  return (
    <View style={styles.wrap}>
      <Animated.Text style={[{ fontSize: size, transform: [{ translateY }] }]}>
        {FACES[state]}
      </Animated.Text>
      {state === 'listen' ? <Text style={styles.hint}>👂 listening…</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 14, color: '#888', marginTop: 4 },
});
