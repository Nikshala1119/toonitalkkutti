# Kutti — Rive Character Rig Specification

**For:** the Rive designer building ToonTalk's tutor character
**Deliverable:** one `.riv` file that drops into the app with zero code changes
**App integration code:** `app/src/components/RiveTutor.tsx` (already built against this contract)

---

## 1. Who Kutti is

Kutti (குட்டி, "little one") is the animated tutor who teaches Tamil-speaking
children aged 4–7 spoken English, colors, and counting. Kutti speaks every
instruction, celebrates every success, and demonstrates answers after misses —
the character IS the interface, because the audience cannot read.

Design intent:
- **Warm, silly, huggable.** Think preschool TV sidekick, not teacher.
  Failure is never punished in ToonTalk, so Kutti never frowns at the child —
  the "encourage" state is upbeat, not disappointed.
- **Species/form is open** (open question in the PRD: one mascot vs. a cast).
  Current working assumption: a single small creature (monkey/parrot/squirrel
  energy). Big eyes, big mouth — the mouth is the star, since lip-sync
  carries the teaching.
- **Reads at 200 px.** Children use low-end tablets; the silhouette and
  expressions must be legible small and at 1× scale. Bold shapes, thick
  outlines, high contrast.
- The voice is already generated (warm, cheerful, slightly stylized TTS).
  A cartoon look that matches a slightly synthetic voice is intentional
  (PRD §10).

## 2. File & artboard requirements

| Item | Requirement |
|---|---|
| File name | `kutti.riv` (replaces `app/assets/rive/placeholder.riv`) |
| Artboard name | `Kutti` |
| Artboard size | 500 × 500, transparent background, character centered with ~10% margin |
| State machine | exactly one, named `TutorStateMachine` |
| File size | ≤ 500 KB (target ~200 KB) |
| Performance | ≥ 30 fps on a 2 GB RAM Android 10 tablet (NFR-1) — prefer bone/deform animation over per-frame mesh swaps; keep vertex counts modest; no raster images over 512 px |
| Rive version | current stable editor; no features newer than the `rive-react-native` runtime we pin |

## 3. State machine contract (`TutorStateMachine`)

The app drives the rig through **two Number inputs**. No triggers, no
booleans — numbers keep the runtime interface dead simple and orderable.

### Input 1: `State` (Number, default 0)

| Value | State | What's happening in the app | Animation notes |
|---|---|---|---|
| 0 | `idle` | Waiting for the child | Gentle breathing loop. Layer micro-behaviors (§5) on top |
| 1 | `talk` | A voice clip is playing | Body animated + mouth driven by `Viseme` input (§4). Slight head bob, hand gestures on loop |
| 2 | `listen` | Say-it-back: waiting for the child to speak | Leans in, hand to ear, eyes wide, eyebrows up. Encouraging nod loop |
| 3 | `celebrate` | Child answered correctly | Big! Jump, confetti-adjacent motion, arms up. 1.5–2.5 s loop. This must feel GREAT — it is the reward |
| 4 | `encourage` | Child missed once — warm retry coming | Warm smile, "come on, you got this" gesture — fists up, nod. Never sad, never head-shake |
| 5 | `demonstrate` | After 2 misses, Kutti shows the answer | Points down/forward toward the answer area, deliberate teaching energy |
| 6 | `sleep` | 30+ s inactivity / wind-down | Sits, eyes closed, Zzz. Waking from sleep → any other state should look natural (see transitions) |

Transition rules:
- Any state → any state, cross-fade **≤ 200 ms** (children tap fast; the rig
  must never feel laggy or stuck finishing a long animation).
- `celebrate` may play a 300 ms entrance flourish before its loop; everything
  else should cut over immediately.
- Use a blend/transition duration on the state machine layers rather than
  entrance animations elsewhere.

### Input 2: `Viseme` (Number, default 0)

Drives the mouth while `State == 1 (talk)`. The app sets this many times per
second from the audio timeline. Mouth changes must apply **instantly** (no
easing on the mouth layer — snappy mouth = convincing sync).

| Value | Shape | Description | Example sounds |
|---|---|---|---|
| 0 | `rest` | Closed, relaxed, slight smile | silence |
| 1 | `A` | Wide open | "f**a**ther", த**ா** |
| 2 | `E` | Spread, teeth showing | "s**ee**", க**ீ** |
| 3 | `O` | Round open | "g**o**", ஓ |
| 4 | `M` | Pressed closed | m, b, p — "**m**ummy", **ம** |
| 5 | `F` | Lower lip under teeth | f, v — "**f**ive" |
| 6 | `L` | Tongue visible on ridge | l — "ye**ll**ow", **ல** |
| 7 | `W` | Tight small round | w, oo — "t**w**o", ஊ |

Implementation suggestion: one mouth layer with 8 keyed frames (or nested
artboard), driven by the `Viseme` number via a 1D blend or per-value
transitions with 0 ms duration.

Even without frame-accurate viseme data, the app cycles plausible values at
~8 Hz during speech — so the mouth set must look good in any order.

## 4. What the app does (so you can test like the runtime)

```
On activity start:        State = 1 (talk), Viseme animating 0–7 during audio
Prompt done:              State = 0 (idle)  — or 2 (listen) for say-it-back
Child answers correctly:  State = 3 (celebrate) for ~2 s
Child misses:             State = 4 (encourage) for ~1.5 s, then back to 1
Two misses:               State = 5 (demonstrate) for ~2.5 s
No input for 30 s:        one re-prompt (talk), later 6 (sleep)
```

Test in the Rive editor by scrubbing `State` 0→1→3→1→4→1→5→0→6 with
`Viseme` cycling — every combination should look coherent.

## 5. Idle micro-behaviors (FR-1.4)

Inside the `idle` state, on a separate layer (do NOT require app input):
- **Blink** every 3–6 s (randomized if possible).
- **Look around** occasionally — eyes/head drift left/right every ~8 s.
- **Wave** at the child roughly every 20–30 s in idle.

These keep Kutti alive without any runtime cost or app logic.

## 6. Future-proofing (don't build yet, don't preclude)

- **Outfits & accessories (FR-4.3):** stars unlock outfits in the sticker
  album. Structure the rig so hats/accessories can be added later as nested
  artboards or toggleable layers without re-rigging the body.
- **Second character (Phase 3):** keep the state machine + input contract
  character-agnostic; a second `.riv` with the same contract must be able to
  swap in.

## 7. Delivery & acceptance checklist

- [ ] `kutti.riv`, artboard `Kutti`, state machine `TutorStateMachine`
- [ ] Number inputs `State` (0–6) and `Viseme` (0–7) exactly as specified
- [ ] All 7 states readable at 200 px on a 1080p screen
- [ ] Mouth snaps between all 8 shapes with no easing artifacts
- [ ] Any-to-any state switch under 200 ms with no pops
- [ ] Blink/look/wave run inside idle with no inputs
- [ ] File ≤ 500 KB; 30 fps in the Rive editor's low-power preview
- [ ] Drop-in test: replace `app/assets/rive/placeholder.riv`, rename the
      require in `RiveTutor.tsx` — character appears and responds in the dev
      build with no other changes

## 8. Reference

- PRD: `toonitalk-prd.md` §FR-1 (character & voice), §3.3 (activity loop),
  NFR-1 (performance)
- App contract code: `app/src/components/RiveTutor.tsx`
  (`KUTTI_STATE_MACHINE`, `KUTTI_STATE_TO_NUMBER`, `VISEME_TO_NUMBER`)
- Voice clips the mouth syncs to: public bucket `tutor-clips`
  (e.g. `.../storage/v1/object/public/tutor-clips/u1-a01_prompt_A.wav`)
