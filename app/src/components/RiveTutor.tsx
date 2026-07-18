import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Asset } from 'expo-asset';
import { Tutor, TutorState } from './Tutor';
import { subscribeVisemes } from '../audio/tutorVoice';

// Rive-rigged tutor (FR-1.1/FR-1.2). Contract: docs/kutti-rive-spec.md.
// Degrades gracefully:
//  - In Expo Go the rive-react-native native module is absent → emoji Tutor.
//  - In the dev build it renders the rig and drives the `State` and `Viseme`
//    Number inputs of the `TutorStateMachine` state machine.
//
// assets/rive/placeholder.riv is Rive's sample rig (from the
// rive-react-native example app) purely to prove the render path — it has no
// TutorStateMachine, so input calls no-op until the designed kutti.riv lands.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let RiveModule: any = null;
try {
  // Throws in Expo Go (no native module) — that's the supported fallback path.
  RiveModule = require('rive-react-native');
} catch {
  RiveModule = null;
}

export const KUTTI_STATE_MACHINE = 'TutorStateMachine';

// docs/kutti-rive-spec.md §3 — `State` Number input
export const KUTTI_STATE_TO_NUMBER: Record<TutorState, number> = {
  idle: 0,
  talk: 1,
  listen: 2,
  celebrate: 3,
  encourage: 4,
  demonstrate: 5,
  sleep: 6,
};

// docs/kutti-rive-spec.md §3 — `Viseme` Number input
export const VISEME_TO_NUMBER: Record<string, number> = {
  rest: 0,
  A: 1,
  E: 2,
  O: 3,
  M: 4,
  F: 5,
  L: 6,
  W: 7,
};

export function RiveTutor({ state, size = 160 }: { state: TutorState; size?: number }) {
  const [rigUri, setRigUri] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const riveRef = useRef<any>(null);

  useEffect(() => {
    if (!RiveModule) return;
    Asset.fromModule(require('../../assets/rive/placeholder.riv'))
      .downloadAsync()
      .then((asset) => setRigUri(asset.localUri ?? asset.uri))
      .catch(() => setRigUri(null));
  }, []);

  // Drive the State input (no-op on rigs without TutorStateMachine)
  useEffect(() => {
    try {
      riveRef.current?.setInputState(
        KUTTI_STATE_MACHINE,
        'State',
        KUTTI_STATE_TO_NUMBER[state],
      );
    } catch {
      // placeholder rig — ignore
    }
  }, [state, rigUri]);

  // Drive the Viseme input from the audio timeline
  useEffect(() => {
    if (!RiveModule) return;
    return subscribeVisemes((shape) => {
      try {
        riveRef.current?.setInputState(
          KUTTI_STATE_MACHINE,
          'Viseme',
          VISEME_TO_NUMBER[shape] ?? 0,
        );
      } catch {
        // placeholder rig — ignore
      }
    });
  }, [rigUri]);

  if (!RiveModule || !rigUri) {
    return <Tutor state={state} size={Math.round(size * 0.75)} />;
  }

  const Rive = RiveModule.default;
  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <Rive
        ref={riveRef}
        url={rigUri}
        autoplay
        style={{ width: size, height: size }}
      />
    </View>
  );
}
