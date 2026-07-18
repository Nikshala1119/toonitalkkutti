import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Activity, TapPayload } from '../types/curriculum';
import {
  ActivityEvent,
  ActivityRunState,
  initialRunState,
  reduceActivity,
} from '../engine/activityEngine';
import {
  speakPrompt,
  speakStockLine,
  stockLines,
  stopSpeaking,
} from '../audio/tutorVoice';
import { prefetchClips } from '../audio/clipStore';
import { TutorState } from '../components/Tutor';
import { RiveTutor } from '../components/RiveTutor';
import { TapChoices } from '../components/TapChoices';
import { CameraStage } from '../components/CameraStage';
import { AssetTile } from '../components/assetRegistry';
import { useAppStore } from '../state/appStore';
import { enqueueAttempt, newAttemptId, syncAttempts } from '../state/attemptQueue';
import { VisionResult } from '../vision/types';

// Runs one session: 5–7 activities (FR-2.2), each through the
// Ask → Respond → Validate → Feedback → (Retry ×2) → Reward loop.

const IDLE_REPROMPT_MS = 30_000; // FR-1.4

export function SessionScreen({
  unitId,
  activities,
  onFinished,
}: {
  unitId: number;
  activities: Activity[];
  onFinished: (sessionStars: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const [run, setRun] = useState<ActivityRunState>(initialRunState);
  const [usedFallback, setUsedFallback] = useState(false);
  const [sessionStars, setSessionStars] = useState(0);
  const startedAt = useRef(Date.now());
  const repromptUsed = useRef(false);
  const recorded = useRef(false);

  const cameraEnabled = useAppStore((s) => s.cameraEnabled);
  const levelForSkill = useAppStore((s) => s.levelForSkill);
  const recordResult = useAppStore((s) => s.recordResult);
  const serverChildId = useAppStore((s) => s.serverChildId);

  const activity = activities[index];
  const level = useMemo(
    () => (activity ? levelForSkill(activity.skill) : 'A'),
    [activity, levelForSkill],
  );

  const isCameraActivity =
    activity &&
    (activity.type === 'show_fingers' ||
      activity.type === 'find_color' ||
      activity.type === 'count_show');

  const effectivePayload =
    isCameraActivity && (usedFallback || !cameraEnabled)
      ? (activity.tapFallback as TapPayload)
      : activity?.payload;

  const dispatch = useCallback((e: ActivityEvent) => {
    setRun((r) => reduceActivity(r, e));
  }, []);

  // Prefetch this session's clips so playback never waits (FR-2.3)
  useEffect(() => {
    const ids: string[] = [];
    for (const a of activities) {
      for (const lv of ['A', 'B', 'C'] as const) ids.push(`${a.id}_prompt_${lv}`);
    }
    ids.push(
      ...stockLines.encourage.map((l) => l.id),
      ...stockLines.celebrate.map((l) => l.id),
      stockLines.demo.id,
      stockLines.sessionEnd.id,
    );
    prefetchClips(ids);
  }, [activities]);

  // Phase side effects: speaking, feedback lines, demonstration
  useEffect(() => {
    if (!activity) return;

    if (run.phase === 'asking') {
      speakPrompt(
        activity.prompts[level],
        level,
        () => dispatch({ type: 'PROMPT_DONE' }),
        `${activity.id}_prompt_${level}`,
      );
      return stopSpeaking;
    }

    if (run.phase === 'celebrating') {
      const line =
        stockLines.celebrate[Math.floor(Math.random() * stockLines.celebrate.length)];
      speakStockLine(line, () => dispatch({ type: 'FEEDBACK_DONE' }));
      return stopSpeaking;
    }

    if (run.phase === 'encouraging') {
      const line =
        stockLines.encourage[Math.floor(Math.random() * stockLines.encourage.length)];
      speakStockLine(line, () => dispatch({ type: 'FEEDBACK_DONE' }));
      return stopSpeaking;
    }

    if (run.phase === 'demonstrating') {
      speakStockLine(stockLines.demo, () => dispatch({ type: 'DEMO_DONE' }));
      return stopSpeaking;
    }
  }, [run.phase, activity, level, dispatch]);

  // FR-1.4: after 30 s idle in awaiting, re-prompt once
  useEffect(() => {
    if (run.phase !== 'awaiting' || !activity || repromptUsed.current) return;
    const t = setTimeout(() => {
      repromptUsed.current = true;
      speakPrompt(
        activity.prompts[level],
        level,
        () => undefined,
        `${activity.id}_prompt_${level}`,
      );
    }, IDLE_REPROMPT_MS);
    return () => clearTimeout(t);
  }, [run.phase, activity, level]);

  // Activity finished: record + advance
  useEffect(() => {
    if (run.phase !== 'done' || !activity || recorded.current) return;
    recorded.current = true;

    const durationMs = Date.now() - startedAt.current;
    const firstTrySuccess = run.outcome === 'success' && run.tryNumber === 1;

    recordResult({
      activity,
      unitId,
      stars: run.stars,
      firstTrySuccess,
      success: true, // helped still counts as completed (never punished)
    });

    enqueueAttempt({
      id: newAttemptId(),
      child_id: serverChildId,
      activity_id: activity.id,
      skill: activity.skill,
      tries: run.tryNumber,
      stars: run.stars,
      outcome: run.outcome ?? 'helped',
      validation_source: isCameraActivity && !usedFallback ? 'device' : 'tap',
      duration_ms: durationMs,
      client_created_at: new Date().toISOString(),
    }).then(() => syncAttempts().catch(() => undefined));

    const nextStars = sessionStars + run.stars;
    setSessionStars(nextStars);

    const t = setTimeout(() => {
      if (index + 1 >= activities.length) {
        onFinished(nextStars);
      } else {
        setIndex(index + 1);
        setRun(initialRunState);
        setUsedFallback(false);
        recorded.current = false;
        repromptUsed.current = false;
        startedAt.current = Date.now();
      }
    }, 600);
    return () => clearTimeout(t);
  }, [run.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = useCallback(
    (correct: boolean) => dispatch({ type: 'ANSWER', correct }),
    [dispatch],
  );

  const onVision = useCallback(
    (r: VisionResult) => {
      if (!r.stable || !activity) return;
      if (r.kind === 'fingers' && activity.payload.kind === 'show_fingers') {
        answer(r.count === activity.payload.count);
      } else if (r.kind === 'color' && activity.payload.kind === 'find_color') {
        answer(r.color === activity.payload.color);
      } else if (r.kind === 'count' && activity.payload.kind === 'count_show') {
        answer(r.count === activity.payload.count);
      }
    },
    [activity, answer],
  );

  if (!activity) return null;

  const tutorState: TutorState =
    run.phase === 'asking'
      ? 'talk'
      : run.phase === 'awaiting'
        ? activity.type === 'say_it_back'
          ? 'listen'
          : 'idle'
        : run.phase === 'celebrating'
          ? 'celebrate'
          : run.phase === 'encouraging'
            ? 'encourage'
            : run.phase === 'demonstrating'
              ? 'demonstrate'
              : 'idle';

  const showTap =
    effectivePayload?.kind === 'tap_answer' &&
    (run.phase === 'awaiting' || run.phase === 'demonstrating');

  const showCamera =
    isCameraActivity && !usedFallback && cameraEnabled && effectivePayload?.kind !== 'tap_answer';

  return (
    <View style={styles.root}>
      <View style={styles.progressRow}>
        {activities.map((a, i) => (
          <View
            key={a.id}
            style={[styles.progressDot, i < index && styles.progressDone, i === index && styles.progressCurrent]}
          />
        ))}
        <Text style={styles.starCount}>⭐ {sessionStars}</Text>
      </View>

      <RiveTutor state={tutorState} />

      <View style={styles.stage}>
        {showTap ? (
          <TapChoices
            payload={effectivePayload as TapPayload}
            disabled={run.phase !== 'awaiting'}
            onPick={(id) => answer(id === (effectivePayload as TapPayload).correctId)}
          />
        ) : null}

        {showCamera ? (
          <CameraStage
            mode={
              activity.payload.kind === 'show_fingers'
                ? 'fingers'
                : activity.payload.kind === 'find_color'
                  ? 'color'
                  : 'count'
            }
            expected={
              activity.payload.kind === 'find_color'
                ? { color: activity.payload.color }
                : { count: (activity.payload as { count: number }).count }
            }
            active={run.phase === 'awaiting'}
            onResult={onVision}
            onUnavailable={() => setUsedFallback(true)}
          />
        ) : null}

        {activity.type === 'say_it_back' && activity.payload.kind === 'say_it_back' ? (
          <View style={styles.sayStage}>
            {activity.payload.image ? (
              <AssetTile assetKey={activity.payload.image} style={styles.sayTile} />
            ) : null}
            {/* Keyword spotting lands with the dev build (§5.5); simulated for now */}
            {__DEV__ && run.phase === 'awaiting' ? (
              <View style={styles.devRow}>
                <Pressable style={styles.devBtn} onPress={() => answer(true)}>
                  <Text style={styles.devBtnText}>✅ said "{activity.payload.word}"</Text>
                </Pressable>
                <Pressable style={styles.devBtn} onPress={() => answer(false)}>
                  <Text style={styles.devBtnText}>❌ no match</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF9F0', paddingTop: 48 },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  progressDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#E0D6C8' },
  progressDone: { backgroundColor: '#FFB300' },
  progressCurrent: { backgroundColor: '#FF7043', transform: [{ scale: 1.3 }] },
  starCount: { marginLeft: 12, fontSize: 16, fontWeight: '700' },
  stage: { flex: 1, padding: 16 },
  sayStage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  sayTile: { width: 180, height: 180 },
  devRow: { flexDirection: 'row', gap: 12 },
  devBtn: {
    backgroundColor: '#FFE0B2',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  devBtnText: { fontSize: 16, fontWeight: '600' },
});
