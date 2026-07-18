# ToonTalk

Tablet-first learning app: an animated cartoon tutor ("Kutti") teaches Tamil-speaking children (4–7) spoken English vocabulary, colors, counting, and early math through short, camera-validated activities. See `toonitalk-prd.md` for the full PRD.

## Repo layout

```
app/        React Native + Expo child app (Android-first)
content/    Curriculum source of truth + build-time pipeline
  curriculum/   unit-XX-*.json — activities as data (PRD §5.2)
  scripts/      sync-to-app / generate-tts / upload-curriculum
supabase/   Postgres schema migrations (RLS, mastery + streak triggers)
```

## Running the child app

```
cd app
npm install
npm run sync-content   # copy content/curriculum → app/assets/curriculum
npm start              # Expo Go on an Android device/emulator
```

Works fully offline; sync is enabled via `app/.env` (gitignored):
`EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`. The live backend
is Supabase project `toonitalk` (ref `kzibivhpauffywnsvgjz`, ap-south-1) with
`supabase/migrations/*` applied and Units 1–2 seeded into `units`/`activities`.

## Current state (Phase 1 scaffold)

Working end-to-end in Expo Go:
- Activity engine: Ask → Respond → Validate → Feedback → Retry(×2) → Reward,
  stars 3/2/1, tutor demonstrates after two misses (never punishes).
- All five activity types wired; tap-the-answer fully real.
- Bilingual prompts per language level A/B/C with per-skill auto-leveling
  (§3.2/§6.3 mirrored locally for offline).
- Path-map home, session player (5–7 activities), celebration screen, streak
  (pauses, never resets), offline attempt queue with idempotent sync.
- Camera stage with permission flow, "camera on" indicator, tap fallback.

Simulated for now (dev overlay buttons), each behind a swap-in interface:
- **Vision** (`app/src/vision/`): finger counting / color / object counting run
  through `MockVisionProvider`. Real path: MediaPipe Hands + HSV sampling via a
  dev-build native module (expo-camera has no frame-processor API).
- **Voice** (`app/src/audio/tutorVoice.ts`): device TTS (expo-speech) until the
  pre-generated clip pipeline runs (`content/scripts/generate-tts.mjs`,
  provider chosen after the week-2 voice bake-off).
- **Say-it-back**: keyword spotting needs the dev build; simulated buttons.
- **Character**: emoji placeholder behind the same `state` prop the Rive rig
  will use (`app/src/components/Tutor.tsx`).

## Next up

1. Provision a Supabase project, apply the migration, run
   `upload-curriculum.mjs`, wire auth + child-profile linking.
2. TTS voice bake-off → run clip generation → clip player in `tutorVoice.ts`.
3. Expo dev build: Rive runtime + vision-camera frame processor (MediaPipe).
4. Parent gate + dashboard (Phase 2).
