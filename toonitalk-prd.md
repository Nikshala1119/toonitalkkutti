# ToonTalk — Product Requirements Document

**Version:** 1.0 · **Date:** July 2026 · **Status:** Draft for review

---

## 1. Overview

### 1.1 Product summary
ToonTalk is a tablet-first learning app in which an animated cartoon tutor teaches Tamil-speaking children (ages 4–7) spoken English vocabulary, colors, counting, and elementary mathematics through short, camera-validated activities. The tutor speaks Tamil for instructions and scaffolding and English for target content, shifting the ratio toward English as the child progresses. Parents get a dashboard showing activity outcomes, skill mastery, and practice habits.

### 1.2 Problem statement
Tamil-speaking families want their children to gain early English fluency and number sense, but existing options are either passive (YouTube videos with no feedback), text-heavy (unsuitable for pre-readers), or English-first (no Tamil scaffolding, so young children get lost). No product combines a friendly character, bilingual Tamil→English instruction, and real-world interaction (showing fingers and objects to the camera) with feedback a 5-year-old understands.

### 1.3 Goals
1. A child aged 4–7 can complete activities independently after one guided session, with zero reading required.
2. Feedback on a camera-validated answer arrives in under 1 second.
3. Core activities work fully offline after first sync.
4. Marginal cloud cost per active child per month stays under ₹15 (~$0.18) at launch scope.
5. Parents can see, in under 30 seconds, what their child practiced and where they struggled.

### 1.4 Non-goals (v1)
- Open-ended AI conversation with the child (deferred to Phase 3 "Conversation Corner," parent-gated).
- Real-time generative video avatars (LemonSlice-style). The character is a rigged 2D animation.
- Reading or writing instruction; handwriting recognition.
- Languages other than Tamil (source) and English (target).
- Social features, leaderboards, chat, or any child-to-child interaction.
- iOS at launch (Android tablet/phone first; iOS in Phase 2 if metrics justify).

---

## 2. Users

### 2.1 Primary: the child (age 4–7)
- Cannot read; navigates entirely by icons, colors, and the tutor's voice.
- Attention span ~5–10 minutes per session; sessions must be short, celebratory, and end on a win.
- Uses a shared family Android tablet or a parent's phone, often with intermittent connectivity.

### 2.2 Secondary: the parent
- Tamil-speaking; may prefer the dashboard UI in Tamil or English (both supported).
- Creates the account, grants consent, sets time limits, reviews progress weekly.
- Is the buyer: evaluates the app on safety, visible learning outcomes, and price.

---

## 3. Learning design

### 3.1 Curriculum map (v1)
Units unlock sequentially along a visual path map. Each unit contains 8–15 activities plus a review checkpoint.

| # | Unit | Skills | Camera used |
|---|------|--------|-------------|
| 1 | Colors I | red, blue, yellow, green — recognize and say | Yes — "find something red" |
| 2 | Numbers 1–5 | count aloud, recognize quantity | Yes — finger counting |
| 3 | Colors II | orange, purple, pink, black, white, brown | Yes |
| 4 | Numbers 6–10 | count aloud, quantity to 10 | Yes — fingers, objects |
| 5 | Counting objects | count real items, "how many?" | Yes — object counting |
| 6 | More/less, big/small | comparisons in English | No |
| 7 | Simple addition | sums to 10, with objects | Yes — "show me 2 + 3 blocks" |
| 8 | Simple subtraction | within 10 | Yes |
| 9 | Everyday words | animals, fruits, body parts | Partial |
| 10 | Review + mixed practice | spaced repetition of all skills | Yes |

### 3.2 Language scaffolding model
- **Level A (start):** instructions 80% Tamil / 20% English. Target words always English, immediately echoed with Tamil gloss. Example: "மூன்று விரல்களை காட்டு! Show me THREE fingers!"
- **Level B:** 50/50. English instruction first, Tamil repeat only if the child hesitates or fails once.
- **Level C:** 80% English. Tamil only for encouragement and error recovery.
- Level advances per skill automatically based on rolling accuracy (see §6.3).

### 3.3 Activity types (v1 — exactly these five)
1. **Tap-the-answer:** tutor asks in voice; child taps one of 2–4 large pictures. (No camera; the on-ramp activity type.)
2. **Show-me-fingers:** tutor asks for N fingers; on-device hand tracking counts extended fingers.
3. **Find-the-color:** tutor names a color; child holds any object of that color to the camera; on-device dominant-color check.
4. **Count-and-show:** tutor asks for N objects; child holds them up; on-device detection with cloud photo fallback (§5.4).
5. **Say-it-back:** tutor says a word; child repeats; constrained keyword match against the single expected word (§5.5).

Every activity follows the same loop: **Ask → Child responds → Validate → Feedback → (Retry ×2 max) → Reward.** After two failed tries the tutor demonstrates the answer, awards 1 star for effort, and moves on. Failure is never punished; there are no lives, timers, or lockouts.

---

## 4. Product requirements

### 4.1 Child app — functional requirements

**FR-1 Character & voice**
- FR-1.1 One rigged 2D cartoon tutor (working name: "Kutti") built in Rive with states: idle, talk, listen, celebrate, encourage, demonstrate, sleep.
- FR-1.2 Mouth animation driven by viseme timelines bundled with each audio clip (8 mouth shapes minimum).
- FR-1.3 All tutor speech is pre-generated TTS audio clips (Tamil ta-IN + Indian English en-IN, single consistent character voice), downloaded and cached on device. No runtime TTS calls during activities.
- FR-1.4 Idle behaviors (blink, look around, wave) trigger on inactivity; after 30 s idle the tutor verbally re-prompts once.

**FR-2 Activities**
- FR-2.1 The five activity types in §3.3, driven by a JSON activity schema fetched from the backend and cached (activities are data, not code — new content ships without an app release).
- FR-2.2 Session structure: 5–7 activities per session (~5 min), always ending with a celebration screen.
- FR-2.3 Full offline mode: cached units, clips, and rigs work with no connectivity; results queue locally and sync when online.

**FR-3 Camera validation**
- FR-3.1 Camera permission requested only at first camera activity, with a parent-gated explainer screen.
- FR-3.2 All frame processing on device by default (§5.4). No video is ever recorded or stored.
- FR-3.3 Validation result within 1,000 ms of a stable answer pose.
- FR-3.4 A visible "camera on" indicator whenever the camera is active; camera hard-off outside camera activities.
- FR-3.5 If camera permission is denied or hardware is unavailable, every camera activity has a tap-based fallback variant.

**FR-4 Gamification**
- FR-4.1 Stars: 3 (first try), 2 (second try), 1 (completed with help). Stars accumulate per unit.
- FR-4.2 Daily streak with in-character celebration; a missed day pauses (never resets) the streak for kids' wellbeing.
- FR-4.3 Sticker album: stars unlock stickers, character outfits, and scene backgrounds. Collection-based, never competitive.
- FR-4.4 Progress path map as the home screen: units as islands, current position marked by the character.
- FR-4.5 No leaderboards, no comparisons with other children, no purchasable advantage.

**FR-5 Session & safety controls**
- FR-5.1 Parent-configurable daily time limit (default 20 min); the tutor winds down gracefully ("nallā velaiyi! See you tomorrow!") rather than cutting off.
- FR-5.2 Parent area behind a math gate (e.g., "type 7 × 3"). Settings, subscription, and dashboard live only behind it.
- FR-5.3 No external links, ads, or web views reachable from the child surface.

### 4.2 Parent dashboard — functional requirements
- FR-6.1 Web app (Next.js) plus the in-app gated parent area; both read the same Supabase data.
- FR-6.2 Overview: minutes practiced (7/30 days), current streak, units completed, stars earned.
- FR-6.3 Skill mastery grid: each skill shown as not-started / learning / mastered, with accuracy trend.
- FR-6.4 Struggle insights: plain-language, actionable items — e.g., "Priya mixed up 'six' and 'seven' three times this week. Try counting steps together on the stairs."
- FR-6.5 Multiple child profiles per family account (max 4), each with independent progress.
- FR-6.6 Controls: daily limit, camera activities on/off, language pace (auto / hold at Level A), data export & account deletion (one tap, GDPR/COPPA requirement).
- FR-6.7 Weekly summary notification (push/email, opt-in), in Tamil or English per parent preference.

### 4.3 Non-functional requirements
- NFR-1 Performance: cold start < 4 s on a 2 GB RAM Android tablet (Android 10+); character animation ≥ 30 fps on that baseline device.
- NFR-2 Reliability: activity loop functions with zero connectivity after first sync; result sync is at-least-once with idempotent writes.
- NFR-3 Privacy: no video/audio recordings stored anywhere; cloud-fallback photos deleted immediately after inference (§5.4); analytics contain no camera/audio-derived raw data; all child data deletable on request.
- NFR-4 Compliance: COPPA + GDPR-K posture — verifiable parental consent before any child use; camera consent separate and revocable; Google Play "Designed for Families" policy compliance; data processing agreements with every cloud vendor touching child data.
- NFR-5 Accessibility: minimum touch target 64 dp; all interactive elements voice-prompted; color activities never rely on color alone in UI chrome (the color *content* is the lesson, but navigation is shape+icon coded).
- NFR-6 Cost: runtime cloud cost per active child ≤ ₹15/month at v1 scope (enforced by cached-clip architecture and on-device vision; cloud vision fallback budgeted ≤ 20 calls/child/day).

---

## 5. Technical architecture

### 5.1 Stack summary

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Child app | React Native + Expo (Android first) | One codebase, strong camera APIs, official Rive runtime |
| Character | Rive (.riv rigs + state machines) | Tiny files, 60 fps on low-end devices, viseme-driven mouth |
| Tutor audio | Pre-generated TTS clips + viseme JSON, cached on device | Near-zero runtime cost, offline, perfect lip-sync |
| TTS generation (build-time) | Gemini TTS or Azure/Google TTS (ta-IN, en-IN) | One-time cost ≈ $5 for whole curriculum; visemes/timepoints available |
| Vision (on-device) | MediaPipe Hands + dominant-color sampling + lite object detection | Free, < 100 ms, private — no child video leaves the device |
| Vision (cloud fallback) | Single downscaled photo → vision LLM via Supabase Edge Function | Only for object counting when on-device confidence is low |
| Speech check | On-device keyword spotting against single expected word | Constrained task; no open transcription of child speech |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions, RLS) | Fits family-account model; already in team's stack |
| Parent dashboard | Next.js on Vercel | Fast to build; shares Supabase client |
| Analytics | PostHog (EU hosting), no child PII, no raw media | COPPA-safe product analytics |

### 5.2 Content pipeline (build-time, not runtime)
1. Curriculum authors write activities as rows in a `curriculum` table / JSON files: prompt text (Tamil + English variants per level), expected answer, activity type, assets.
2. A generation script calls the TTS API per line, per language level → audio file + viseme/timing JSON.
3. Script uploads audio + viseme JSON to Supabase Storage; writes asset URLs into the activity rows.
4. App syncs the activity manifest and downloads clips for unlocked + next units in the background.

Adding or fixing content = re-running the script. No app release, no runtime AI cost.

### 5.3 Data model (Supabase, RLS-enforced)
- `families` (parent auth user, consent records, subscription)
- `children` (profile: nickname, avatar, birth-year band only — no full DOB, no photos; belongs to family)
- `units`, `activities` (curriculum content; public-read)
- `attempts` (child_id, activity_id, tries, stars, outcome, validation_source: device|cloud|tap, duration, synced_at)
- `skill_mastery` (child_id, skill, level A/B/C, rolling accuracy — updated by a Postgres function on attempt insert)
- `rewards` (child_id, sticker/outfit ids, earned_at)
- `streaks` (child_id, current, longest, paused_at)
- RLS: parents read/write only their family's rows; children's app sessions use a scoped token per child profile.

### 5.4 Camera validation logic
- **Fingers:** MediaPipe Hands → 21 landmarks → extended-finger count; require the same count across 5 consecutive frames ("stable pose") before judging.
- **Colors:** center-region pixel sampling → HSV dominant color → match against target ranges; tuned for indoor lighting; require 5-frame stability.
- **Object counting:** on-device detector first; if confidence < threshold, capture ONE downscaled (≤ 512 px) still, send via Edge Function to vision LLM with a counting prompt, store only `{expected, detected, outcome}`, delete the image in the same function invocation. Hard cap 20 cloud calls/child/day, then fall back to tap-based variant.
- All thresholds remotely configurable (feature flags) for field tuning without releases.

### 5.5 Say-it-back validation
- On-device streaming keyword spotter checks for the single expected English word (e.g., "seven") within a 5-second listen window. Match → success; no match → tutor models the word and re-asks once. Child audio is never stored or uploaded. (If on-device accuracy proves insufficient for child voices in beta, v1 fallback is: mark say-it-back activities as practice-only, ungraded.)

### 5.6 Explicitly deferred: Gemini Live "Conversation Corner" (Phase 3)
Parent-enabled, 5-minute-capped free-talk mode using a realtime speech-to-speech API with a strict bilingual tutor system prompt, run through Vertex AI with a DPA. Amplitude-based mouth animation. Ships only after: legal review of child-data terms, red-team testing of the system prompt, and a per-family monthly minute cap to protect unit economics.

---

## 6. Feedback, mastery & adaptivity

- 6.1 Feedback is instant, voiced, and in-character: success → celebration animation + star; miss → warm Tamil encouragement + English re-ask; second miss → tutor demonstrates the answer visually, then moves on.
- 6.2 Every attempt writes an `attempts` row (offline-queued) — this is the raw feed for the parent dashboard.
- 6.3 Mastery: a skill is *mastered* at ≥ 80% first-try accuracy over the last 10 attempts; language level per skill advances A→B→C at mastery and steps back after 3 consecutive misses.
- 6.4 Review unit uses spaced repetition: mastered skills resurface at 2, 7, and 21 days.

---

## 7. Monetization (v1 hypothesis)
- Freemium: Units 1–2 free forever; subscription unlocks all units + sticker album expansion.
- Price test: ₹199 / ₹299 / month and LKR equivalents; annual at ~50% discount; one subscription covers all child profiles in the family.
- No ads ever on child surfaces; no in-app purchases reachable by the child (parent gate + platform family policies).

---

## 8. Success metrics
- **Activation:** ≥ 60% of new children complete 5 activities in first session.
- **Learning:** median child masters Colors I + Numbers 1–5 within 3 weeks; first-try accuracy on reviewed skills ≥ 75% at day-21 resurfacing.
- **Retention:** D7 ≥ 35%, D30 ≥ 20% (child profiles active).
- **Camera trust:** ≥ 70% of camera-permitted families keep camera activities enabled at day 30.
- **Validation quality:** on-device validation agrees with human labeling ≥ 92% (measured in beta with consented test families); cloud fallback rate < 15% of count-and-show attempts.
- **Parent engagement:** ≥ 40% of parents open the dashboard weekly.
- **Cost:** cloud cost per MAU child ≤ ₹15.

---

## 9. Milestones

**Phase 1 — Playable core (weeks 1–6)**
Rive character with talk/celebrate states · TTS clip pipeline with visemes · activity engine + JSON schema · activity types 1–3 (tap, fingers, colors) · Supabase schema + auth + offline attempt sync · stars + streak · Units 1–2 content in both languages. *Exit: a real child completes a full session unaided on a low-end tablet.*

**Phase 2 — Trust & habit (weeks 7–12)**
Parent dashboard (web + in-app gate) · sticker album + path map · count-and-show with cloud fallback + daily cap · say-it-back (or practice-only fallback) · time limits + weekly summary · Units 3–6 · closed beta with 30–50 Tamil-speaking families (Chennai / Jaffna / diaspora mix) · Play Store "Designed for Families" review prep.

**Phase 3 — Depth (weeks 13–20)**
Units 7–10 (addition/subtraction) · adaptive difficulty tuning from beta data · second character · iOS build · Conversation Corner behind parent toggle (contingent on §5.6 gates) · public launch.

---

## 10. Risks & mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| On-device finger/color detection unreliable in dim homes | Core loop feels broken | 5-frame stability rule, lighting hint from tutor ("go near the window!"), tap fallback always available, remote threshold tuning |
| Child speech recognition too inaccurate for say-it-back | Frustration | Constrained single-keyword matching only; downgrade to ungraded practice if beta accuracy < 85% |
| Play/App Store family-policy rejection over camera | Launch blocker | On-device-only default, no media storage, early pre-review consultation, camera-off mode fully functional |
| COPPA/GDPR-K exposure via cloud fallback | Legal | Photos ephemeral & size-capped, DPA with vendor, parent toggle to force on-device-only, log audits |
| Tamil TTS voice sounds robotic/adult | Kids disengage | Bake-off of Gemini/Azure/Google/ElevenLabs ta-IN voices with test families in week 2; character design leans cartoon so a slightly stylized voice fits |
| Content pipeline bottleneck (bilingual authoring) | Slow unit velocity | Activities as data + generation script; native-speaker reviewer in the loop; LLM-drafted variants human-approved |
| Low-end device performance | Excludes target market | 2 GB RAM device is the performance baseline in CI; Rive over video assets; clip pre-fetch |

---

## 11. Open questions
1. Character design: one mascot or a small cast (one per subject)? Affects Rive scope and brand.
2. Sri Lankan Tamil vs Indian Tamil voice/dialect — one voice for both markets or per-region variants?
3. Should parents be able to add custom practice words (e.g., family names, local objects)?
4. Kindergarten/tuition-center B2B mode (teacher dashboard, classroom device) — v2 exploration?
5. Payment rails for Sri Lanka (Play billing coverage, local pricing) — needs market check before price test.
