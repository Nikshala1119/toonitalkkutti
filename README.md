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

## Content pipeline (`content/`)

```
cd content && npm install
npm run dry-run          # list the 70-clip inventory
npm run bakeoff          # 3 sample lines per configured provider (PRD §10)
npm run generate:upload  # Azure clips + visemes → Supabase Storage
```

Azure is the production provider (its SDK emits viseme events → mouth
timelines). Set `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION`; for the bake-off
optionally `GOOGLE_TTS_API_KEY`, `ELEVENLABS_API_KEY`+`ELEVENLABS_VOICE_ID`,
`GEMINI_API_KEY`. Upload needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
(dashboard → Settings → API; never ship it). The app downloads clips from the
public `tutor-clips` bucket on first use, caches them on device, and falls
back to device TTS for any clip not yet generated.

## Dev build (Rive + real vision)

Expo Go can't load native modules, so the Rive character and MediaPipe hand
tracking need a dev build. EAS cloud builds are configured (`app/eas.json`) —
no local Android SDK required:

```
cd app
eas login          # Expo account
eas init           # links the project (writes projectId into app.json)
eas build --profile development --platform android
```

`RiveTutor` renders the rig in the dev build and falls back to the emoji
placeholder in Expo Go. `assets/rive/placeholder.riv` is Rive's sample file
to prove the render path — replace with the designed Kutti rig (state machine
`TutorStateMachine`, inputs per `KUTTI_STATE_INPUTS`, 8+ mouth shapes).

## Next up

1. Run the voice bake-off with real keys → generate + upload the clip set.
2. Commission/design the Kutti rig in Rive; swap `placeholder.riv`.
3. In the dev build: vision-camera frame processor + MediaPipe hand landmarks
   to replace `MockVisionProvider` (interface in `app/src/vision/types.ts`).
4. Parent dashboard (Next.js) — Phase 2.
