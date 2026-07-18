import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Activity } from './src/types/curriculum';
import { HomeScreen } from './src/screens/HomeScreen';
import { SessionScreen } from './src/screens/SessionScreen';
import { CelebrationScreen } from './src/screens/CelebrationScreen';
import { useAppStore } from './src/state/appStore';

// Minimal internal router: three child-facing surfaces, no reading required.
// (The math-gated parent area — FR-5.2 — arrives with the dashboard phase.)

type Route =
  | { name: 'home' }
  | { name: 'session'; unitId: number; activities: Activity[] }
  | { name: 'celebration'; stars: number };

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const buildSession = useAppStore((s) => s.buildSession);

  return (
    <>
      <StatusBar style="dark" />
      {route.name === 'home' ? (
        <HomeScreen
          onStartSession={() => {
            const session = buildSession();
            if (session) {
              setRoute({ name: 'session', ...session });
            }
          }}
        />
      ) : route.name === 'session' ? (
        <SessionScreen
          unitId={route.unitId}
          activities={route.activities}
          onFinished={(stars) => setRoute({ name: 'celebration', stars })}
        />
      ) : (
        <CelebrationScreen
          stars={route.stars}
          onDone={() => setRoute({ name: 'home' })}
        />
      )}
    </>
  );
}
