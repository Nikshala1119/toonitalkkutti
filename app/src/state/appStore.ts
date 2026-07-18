import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Activity, LanguageLevel } from '../types/curriculum';
import { unitBundles } from '../data/curriculum';

// Local-first app state. Mirrors the server-side mastery/streak logic (§6.3,
// FR-4.2) so the app is fully functional offline; Supabase remains the source
// of truth for the parent dashboard once sync is wired to a real project.

export interface SkillState {
  level: LanguageLevel;
  /** Rolling window of first-try success (true/false), newest last, max 10 */
  window: boolean[];
  consecutiveMisses: number;
  mastered: boolean;
}

export interface StreakState {
  current: number;
  longest: number;
  lastActiveDate: string | null; // YYYY-MM-DD
}

interface AppState {
  childNickname: string | null;
  cameraEnabled: boolean;
  dailyLimitMinutes: number;

  /** activity ids completed at least once */
  completedActivities: Record<string, true>;
  starsByUnit: Record<number, number>;
  skills: Record<string, SkillState>;
  streak: StreakState;

  setNickname: (n: string) => void;
  levelForSkill: (skill: string) => LanguageLevel;
  recordResult: (args: {
    activity: Activity;
    unitId: number;
    stars: number;
    firstTrySuccess: boolean;
    success: boolean;
  }) => void;
  buildSession: () => { unitId: number; activities: Activity[] } | null;
}

const emptySkill: SkillState = {
  level: 'A',
  window: [],
  consecutiveMisses: 0,
  mastered: false,
};

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function advance(level: LanguageLevel): LanguageLevel {
  return level === 'A' ? 'B' : 'C';
}

function stepBack(level: LanguageLevel): LanguageLevel {
  return level === 'C' ? 'B' : 'A';
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      childNickname: null,
      cameraEnabled: true,
      dailyLimitMinutes: 20,
      completedActivities: {},
      starsByUnit: {},
      skills: {},
      streak: { current: 0, longest: 0, lastActiveDate: null },

      setNickname: (n) => set({ childNickname: n }),

      levelForSkill: (skill) => get().skills[skill]?.level ?? 'A',

      recordResult: ({ activity, unitId, stars, firstTrySuccess, success }) => {
        const s = get();
        const prev = s.skills[activity.skill] ?? emptySkill;

        const window = [...prev.window, firstTrySuccess].slice(-10);
        const accuracy =
          window.filter(Boolean).length / Math.max(window.length, 1);
        const nowMastered = window.length >= 5 && accuracy >= 0.8;
        const misses = firstTrySuccess ? 0 : prev.consecutiveMisses + 1;

        let level = prev.level;
        let missesOut = misses;
        if (nowMastered && !prev.mastered) {
          level = advance(level);
        } else if (misses >= 3) {
          level = stepBack(level);
          missesOut = 0;
        }

        // Streak: pauses, never resets (FR-4.2)
        const today = todayString();
        let streak = s.streak;
        if (streak.lastActiveDate !== today) {
          const current = streak.current + 1;
          streak = {
            current,
            longest: Math.max(streak.longest, current),
            lastActiveDate: today,
          };
        }

        set({
          skills: {
            ...s.skills,
            [activity.skill]: {
              level,
              window,
              consecutiveMisses: missesOut,
              mastered: nowMastered || prev.mastered,
            },
          },
          starsByUnit: {
            ...s.starsByUnit,
            [unitId]: (s.starsByUnit[unitId] ?? 0) + stars,
          },
          completedActivities: success
            ? { ...s.completedActivities, [activity.id]: true }
            : s.completedActivities,
          streak,
        });
      },

      // FR-2.2: 5–7 activities per session, from the first unit that still
      // has uncompleted activities; wraps to review when a unit is done.
      buildSession: () => {
        const s = get();
        for (const bundle of unitBundles) {
          const remaining = bundle.activities.filter(
            (a) => !s.completedActivities[a.id],
          );
          if (remaining.length > 0) {
            return {
              unitId: bundle.unit.id,
              activities: remaining.slice(0, 6),
            };
          }
        }
        // Everything completed: mixed practice from the last unit
        const last = unitBundles[unitBundles.length - 1];
        return last
          ? { unitId: last.unit.id, activities: last.activities.slice(0, 6) }
          : null;
      },
    }),
    {
      name: 'toontalk.appState.v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
