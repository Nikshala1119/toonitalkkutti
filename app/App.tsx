import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Activity } from './src/types/curriculum';
import { HomeScreen } from './src/screens/HomeScreen';
import { SessionScreen } from './src/screens/SessionScreen';
import { CelebrationScreen } from './src/screens/CelebrationScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ParentAreaScreen } from './src/screens/ParentAreaScreen';
import { ParentGate } from './src/components/ParentGate';
import { useAppStore } from './src/state/appStore';

// Minimal internal router. First run goes through parent onboarding
// (account → consent → child profile, NFR-4); after that the child surfaces
// are icon/voice-only, and the parent area sits behind the math gate (FR-5.2).

type Route =
  | { name: 'home' }
  | { name: 'session'; unitId: number; activities: Activity[] }
  | { name: 'celebration'; stars: number }
  | { name: 'parent' };

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [gateOpen, setGateOpen] = useState(false);
  const onboarded = useAppStore((s) => s.onboarded);
  const buildSession = useAppStore((s) => s.buildSession);

  if (!onboarded) {
    return (
      <>
        <StatusBar style="dark" />
        <OnboardingScreen onDone={() => setRoute({ name: 'home' })} />
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      {route.name === 'home' ? (
        <>
          <HomeScreen
            onStartSession={() => {
              const session = buildSession();
              if (session) {
                setRoute({ name: 'session', ...session });
              }
            }}
            onOpenParentArea={() => setGateOpen(true)}
          />
          <ParentGate
            visible={gateOpen}
            onPass={() => {
              setGateOpen(false);
              setRoute({ name: 'parent' });
            }}
            onCancel={() => setGateOpen(false)}
          />
        </>
      ) : route.name === 'session' ? (
        <SessionScreen
          unitId={route.unitId}
          activities={route.activities}
          onFinished={(stars) => setRoute({ name: 'celebration', stars })}
        />
      ) : route.name === 'celebration' ? (
        <CelebrationScreen
          stars={route.stars}
          onDone={() => setRoute({ name: 'home' })}
        />
      ) : (
        <ParentAreaScreen onClose={() => setRoute({ name: 'home' })} />
      )}
    </>
  );
}
