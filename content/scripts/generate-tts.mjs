// Build-time TTS clip generation (PRD §5.2, FR-1.3). NOT a runtime service.
//
// One clip per (activity × language level) with the SAME composed utterance
// the app speaks (level A: Tamil then English; B: English then Tamil;
// C: English only), plus the stock lines — all in one consistent character
// voice. Azure is the production provider because its Speech SDK emits viseme
// events, which become the mouth-shape timelines for the Rive rig.
//
// Usage:
//   node content/scripts/generate-tts.mjs --dry-run          # list clip inventory
//   node content/scripts/generate-tts.mjs --provider azure   # generate clips/
//   node content/scripts/generate-tts.mjs --provider azure --upload
//   node content/scripts/generate-tts.mjs --bakeoff          # 3 sample lines per
//                                                              configured provider
// Env (set only what you use):
//   AZURE_SPEECH_KEY, AZURE_SPEECH_REGION   (e.g. centralindia)
//   AZURE_VOICE                             (default ta-IN-PallaviNeural)
//   GOOGLE_TTS_API_KEY, GOOGLE_VOICE        (default ta-IN-Standard-A)
//   ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID
//   GEMINI_API_KEY, GEMINI_VOICE            (default Kore)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (for --upload; never ship this key)

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LEVELS = ['A', 'B', 'C'];
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const curriculumDir = join(root, 'content', 'curriculum');
const outDir = join(root, 'content', 'clips');
const bakeoffDir = join(root, 'content', 'bakeoff');

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f, dflt) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};

// ---------------------------------------------------------------------------
// Clip inventory: composed utterances exactly as the app speaks them
// ---------------------------------------------------------------------------
function composeUtterance(prompt, level) {
  const parts = [];
  if (level === 'A') {
    if (prompt.ta) parts.push(prompt.ta);
    if (prompt.en) parts.push(prompt.en);
  } else {
    if (prompt.en) parts.push(prompt.en);
    if (level === 'B' && prompt.ta) parts.push(prompt.ta);
  }
  return parts.join(' ');
}

async function collectClips() {
  const clips = [];
  const files = (await readdir(curriculumDir)).filter(
    (f) => f.startsWith('unit-') && f.endsWith('.json'),
  );
  for (const file of files) {
    const bundle = JSON.parse(await readFile(join(curriculumDir, file), 'utf8'));
    for (const activity of bundle.activities) {
      for (const level of LEVELS) {
        const p = activity.prompts[level];
        if (!p) continue;
        clips.push({
          id: `${activity.id}_prompt_${level}`,
          text: composeUtterance(p, level),
        });
      }
    }
  }
  const stock = JSON.parse(
    await readFile(join(curriculumDir, 'stock-lines.json'), 'utf8'),
  );
  const stockLine = (l) => ({ id: l.id, text: [l.ta, l.en].filter(Boolean).join(' ') });
  for (const l of stock.encourage) clips.push(stockLine(l));
  for (const l of stock.celebrate) clips.push(stockLine(l));
  clips.push(stockLine(stock.demo));
  clips.push(stockLine(stock.sessionEnd));
  return clips;
}

// ---------------------------------------------------------------------------
// Azure (production): audio + viseme timeline via the Speech SDK
// Azure viseme ids (0–21) → our 8 placeholder mouth shapes
// ---------------------------------------------------------------------------
const AZURE_VISEME_TO_SHAPE = {
  0: 'rest', 1: 'A', 2: 'A', 3: 'O', 4: 'E', 5: 'E', 6: 'E', 7: 'W',
  8: 'O', 9: 'A', 10: 'O', 11: 'A', 12: 'E', 13: 'A', 14: 'L', 15: 'E',
  16: 'E', 17: 'L', 18: 'F', 19: 'L', 20: 'A', 21: 'M',
};

async function azureSynthesize(text) {
  const { default: sdk } = await import('microsoft-cognitiveservices-speech-sdk');
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  const voice = process.env.AZURE_VOICE ?? 'ta-IN-PallaviNeural';
  if (!key || !region) throw new Error('Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION');

  const config = sdk.SpeechConfig.fromSubscription(key, region);
  config.speechSynthesisOutputFormat =
    sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;
  const synth = new sdk.SpeechSynthesizer(config, null);

  const events = [];
  synth.visemeReceived = (_s, e) => {
    events.push({
      t: Math.round(e.audioOffset / 10000), // ticks (100 ns) → ms
      shape: AZURE_VISEME_TO_SHAPE[e.visemeId] ?? 'rest',
    });
  };

  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ta-IN"><voice name="${voice}"><prosody rate="-10%">${escapeXml(text)}</prosody></voice></speak>`;

  const result = await new Promise((res, rej) => {
    synth.speakSsmlAsync(ssml, (r) => { synth.close(); res(r); }, (err) => { synth.close(); rej(new Error(err)); });
  });
  if (result.reason !== 10 /* SynthesizingAudioCompleted */) {
    throw new Error(`Azure synthesis failed: ${result.errorDetails ?? result.reason}`);
  }
  return {
    audio: Buffer.from(result.audioData),
    visemes: { durationMs: Math.round(result.audioDuration / 10000), events },
  };
}

// ---------------------------------------------------------------------------
// Bake-off-only providers (audio only, no visemes)
// ---------------------------------------------------------------------------
async function googleSynthesize(text) {
  const key = process.env.GOOGLE_TTS_API_KEY;
  const voice = process.env.GOOGLE_VOICE ?? 'ta-IN-Standard-A';
  if (!key) throw new Error('Set GOOGLE_TTS_API_KEY');
  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: 'ta-IN', name: voice },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 0.9 },
      }),
    },
  );
  if (!res.ok) throw new Error(`Google TTS ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return { audio: Buffer.from(json.audioContent, 'base64'), visemes: null };
}

let elevenVoiceCache = null;
async function elevenlabsSynthesize(text) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('Set ELEVENLABS_API_KEY');
  let voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!voiceId) {
    // No voice chosen yet: pick the first available voice so generation can
    // run; the bake-off decides the real one.
    if (!elevenVoiceCache) {
      const vr = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': key },
      });
      if (!vr.ok) throw new Error(`ElevenLabs voices ${vr.status}`);
      elevenVoiceCache = (await vr.json()).voices ?? [];
    }
    voiceId = elevenVoiceCache[0]?.voice_id;
    if (!voiceId) throw new Error('No ElevenLabs voices on this account');
  }
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`,
    {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
    },
  );
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  return { audio: Buffer.from(await res.arrayBuffer()), visemes: null };
}

async function geminiSynthesize(text) {
  const key = process.env.GEMINI_API_KEY;
  const voice = process.env.GEMINI_VOICE ?? 'Kore';
  if (!key) throw new Error('Set GEMINI_API_KEY');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Style directive + explicit "read this transcript" framing — without
        // it the model sometimes treats lines like "Say it: RED!" as an
        // instruction to itself and errors with "tried to generate text".
        contents: [
          {
            parts: [
              {
                text: `Read the following transcript aloud exactly as written, in a warm, cheerful, playful voice like a friendly cartoon tutor speaking to a young child. Transcript: ${text}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini TTS ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const b64 = json.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64) throw new Error('Gemini TTS returned no audio');
  // Gemini returns raw 24 kHz 16-bit mono PCM — wrap in a WAV header.
  return { audio: pcmToWav(Buffer.from(b64, 'base64'), 24000), visemes: null, ext: 'wav' };
}

function pcmToWav(pcm, sampleRate) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function escapeXml(s) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const PROVIDERS = {
  azure: azureSynthesize,
  google: googleSynthesize,
  elevenlabs: elevenlabsSynthesize,
  gemini: geminiSynthesize,
};

// Free tiers rate-limit hard (429s). Retry with backoff, and pace requests
// via --delay-ms (default 500; use e.g. --delay-ms 12000 for Gemini free tier).
const delayMs = parseInt(opt('--delay-ms', '500'), 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function synthesizeWithRetry(synthesize, text, label) {
  let wait = 5000;
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await synthesize(text);
    } catch (err) {
      const transient =
        /429|500|502|503|RESOURCE_EXHAUSTED|overloaded|timeout|no audio|fetch failed|tried to generate text/i.test(
          String(err.message),
        );
      if (!transient || attempt >= 6) throw err;
      console.log(`  ⏳ ${label}: ${err.message.slice(0, 120)} — retry in ${wait / 1000}s`);
      await sleep(wait);
      wait = Math.min(wait * 2, 60_000);
    }
  }
}

// ---------------------------------------------------------------------------
// Upload to Supabase Storage (public bucket `tutor-clips`)
// ---------------------------------------------------------------------------
async function makeUploader() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const email = process.env.SUPABASE_UPLOAD_EMAIL;
  const password = process.env.SUPABASE_UPLOAD_PASSWORD;
  if (!url) throw new Error('Set SUPABASE_URL for --upload');
  // Plain REST (storage-js sessions proved unreliable here): Authorization is
  // either the service key or the signed-in pipeline user's JWT.
  let apikey;
  let bearer;
  if (serviceKey) {
    apikey = serviceKey;
    bearer = serviceKey;
  } else if (anonKey && email && password) {
    // Dedicated pipeline account: only user with write policy on tutor-clips.
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(`pipeline sign-in failed: ${await res.text()}`);
    apikey = anonKey;
    bearer = (await res.json()).access_token;
  } else {
    throw new Error(
      'Set SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_ANON_KEY + SUPABASE_UPLOAD_EMAIL/PASSWORD',
    );
  }

  return async (path, buffer, contentType) => {
    const res = await fetch(`${url}/storage/v1/object/tutor-clips/${path}`, {
      method: 'POST',
      headers: {
        apikey,
        Authorization: `Bearer ${bearer}`,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      body: buffer,
    });
    if (!res.ok) throw new Error(`upload ${path}: ${res.status} ${await res.text()}`);
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const clips = await collectClips();

if (flag('--dry-run')) {
  console.log(`Clip inventory: ${clips.length} clips`);
  for (const c of clips) console.log(`  ${c.id}  「${c.text}」`);
  process.exit(0);
}

if (flag('--bakeoff')) {
  // PRD §10 week-2 voice bake-off: same 3 lines through every configured
  // provider so test families can compare voices side by side.
  const samples = [
    { id: 'sample_tamil', text: 'மூன்று விரல்களை காட்டு! சூப்பர்! அருமை!' },
    { id: 'sample_english', text: 'Show me THREE fingers! Great job! You did it!' },
    { id: 'sample_mixed', text: 'இது சிவப்பு! RED! சிவப்பு நிறத்தை தொடு! Touch RED!' },
  ];
  await mkdir(bakeoffDir, { recursive: true });
  for (const [name, synthesize] of Object.entries(PROVIDERS)) {
    for (const s of samples) {
      try {
        const r = await synthesizeWithRetry(synthesize, s.text, `${name}_${s.id}`);
        const file = join(bakeoffDir, `${name}_${s.id}.${r.ext ?? 'mp3'}`);
        await writeFile(file, r.audio);
        console.log(`✔ ${file}`);
      } catch (err) {
        console.log(`– ${name} skipped (${err.message})`);
        break; // missing key for this provider; skip its remaining samples
      }
    }
  }
  process.exit(0);
}

const providerName = opt('--provider', 'azure');
const synthesize = PROVIDERS[providerName];
if (!synthesize) {
  console.error(`Unknown provider '${providerName}'. One of: ${Object.keys(PROVIDERS).join(', ')}`);
  process.exit(1);
}

const upload = flag('--upload') ? await makeUploader() : null;
await mkdir(outDir, { recursive: true });

const { existsSync } = await import('node:fs');

let done = 0;
for (const clip of clips) {
  // Resume support: skip clips already generated (delete files or pass
  // --force to regenerate).
  const existing = ['mp3', 'wav'].find((e) => existsSync(join(outDir, `${clip.id}.${e}`)));
  if (existing && !flag('--force')) {
    if (upload) {
      const buf = await readFile(join(outDir, `${clip.id}.${existing}`));
      await upload(`${clip.id}.${existing}`, buf, existing === 'wav' ? 'audio/wav' : 'audio/mpeg');
    }
    done += 1;
    console.log(`↷ ${clip.id} already generated (${done}/${clips.length})`);
    continue;
  }
  const r = await synthesizeWithRetry(synthesize, clip.text, clip.id);
  await sleep(delayMs);
  const ext = r.ext ?? 'mp3';
  await writeFile(join(outDir, `${clip.id}.${ext}`), r.audio);
  if (r.visemes) {
    await writeFile(join(outDir, `${clip.id}.viseme.json`), JSON.stringify(r.visemes));
  }
  if (upload) {
    await upload(`${clip.id}.${ext}`, r.audio, ext === 'wav' ? 'audio/wav' : 'audio/mpeg');
    if (r.visemes) {
      await upload(
        `${clip.id}.viseme.json`,
        Buffer.from(JSON.stringify(r.visemes)),
        'application/json',
      );
    }
  }
  done += 1;
  console.log(`✔ ${clip.id} (${done}/${clips.length})`);
}
console.log(`Generated ${done} clips → ${outDir}${upload ? ' (uploaded)' : ''}`);
