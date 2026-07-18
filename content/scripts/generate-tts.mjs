// Build-time TTS clip generation (PRD §5.2, FR-1.3). NOT a runtime service.
//
// For every activity prompt (per language level) and every stock line, this
// script will:
//   1. call a TTS provider (ta-IN / en-IN, one consistent character voice)
//   2. save  clips/<activityId>/prompt_<level>.mp3
//   3. save  clips/<activityId>/prompt_<level>.viseme.json  (mouth-shape
//      timeline for the Rive rig — from provider timepoints, or estimated
//      from phonemes when the provider has no viseme output)
//   4. upload both to Supabase Storage and print the manifest
//
// Provider is pluggable — the week-2 bake-off (PRD §10) compares Gemini,
// Azure, Google Cloud, and ElevenLabs ta-IN voices with test families before
// we commit. Until then this scaffold enumerates and validates every line so
// the clip inventory + naming convention are locked in.
//
// Usage:  node content/scripts/generate-tts.mjs [--dry-run]

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LEVELS = ['A', 'B', 'C'];
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const curriculumDir = join(root, 'content', 'curriculum');

async function collectLines() {
  const lines = [];
  const files = (await readdir(curriculumDir)).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const bundle = JSON.parse(await readFile(join(curriculumDir, file), 'utf8'));
    for (const activity of bundle.activities) {
      for (const level of LEVELS) {
        const p = activity.prompts[level];
        if (!p) continue;
        lines.push({
          clipId: `${activity.id}/prompt_${level}`,
          ta: p.ta ?? null,
          en: p.en ?? null,
        });
      }
    }
  }
  return lines;
}

// --- provider stub ---------------------------------------------------------
// Implement one of these against the chosen provider, e.g.:
//   Azure:  tts.speech.microsoft.com, voice ta-IN-PallaviNeural / en-IN,
//           viseme events via SpeechSynthesisVisemeReceived
//   Google: texttospeech.googleapis.com with timepointing (SSML marks)
//   Gemini: generateContent audio modality (see claude/gemini docs at build time)
async function synthesize(_text, _language, _clipId) {
  throw new Error(
    'No TTS provider configured yet. Set one up after the week-2 voice bake-off.',
  );
}
// ---------------------------------------------------------------------------

const dryRun = process.argv.includes('--dry-run') || true; // provider not chosen yet

const lines = await collectLines();
console.log(`Clip inventory: ${lines.length} prompt clips`);
for (const line of lines) {
  const parts = [line.ta && `ta:「${line.ta}」`, line.en && `en:「${line.en}」`]
    .filter(Boolean)
    .join('  ');
  console.log(`  ${line.clipId}  ${parts}`);
  if (!dryRun) {
    if (line.ta) await synthesize(line.ta, 'ta-IN', line.clipId);
    if (line.en) await synthesize(line.en, 'en-IN', line.clipId);
  }
}
