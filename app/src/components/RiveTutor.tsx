import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Asset } from 'expo-asset';
import { Tutor, TutorState } from './Tutor';

// Rive-rigged tutor (FR-1.1/FR-1.2). Degrades gracefully:
//  - In Expo Go the rive-react-native native module is absent → emoji Tutor.
//  - In the dev build it renders the rig; TutorState maps to the rig's state
//    machine inputs, and viseme events will drive the mouth states once the
//    real Kutti rig exists.
//
// assets/rive/placeholder.riv is Rive's sample rig (from the
// rive-react-native example app) purely to prove the render path in the dev
// build. It is NOT the ToonTalk character and must be replaced by the
// designed Kutti rig (states: idle, talk, listen, celebrate, encourage,
// demonstrate, sleep; 8+ mouth shapes) before anything user-facing ships.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let RiveModule: any = null;
try {
  // Throws in Expo Go (no native module) — that's the supported fallback path.
  RiveModule = require('rive-react-native');
} catch {
  RiveModule = null;
}

// The designed Kutti rig will expose a state machine with these input names.
export const KUTTI_STATE_MACHINE = 'TutorStateMachine';
export const KUTTI_STATE_INPUTS: Record<TutorState, string> = {
  idle: 'idle',
  talk: 'talk',
  listen: 'listen',
  celebrate: 'celebrate',
  encourage: 'encourage',
  demonstrate: 'demonstrate',
  sleep: 'sleep',
};

export function RiveTutor({ state, size = 160 }: { state: TutorState; size?: number }) {
  const [rigUri, setRigUri] = useState<string | null>(null);

  useEffect(() => {
    if (!RiveModule) return;
    Asset.fromModule(require('../../assets/rive/placeholder.riv'))
      .downloadAsync()
      .then((asset) => setRigUri(asset.localUri ?? asset.uri))
      .catch(() => setRigUri(null));
  }, []);

  if (!RiveModule || !rigUri) {
    return <Tutor state={state} size={Math.round(size * 0.75)} />;
  }

  const Rive = RiveModule.default;
  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <Rive url={rigUri} autoplay style={{ width: size, height: size }} />
    </View>
  );
}
